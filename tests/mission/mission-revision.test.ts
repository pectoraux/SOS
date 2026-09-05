import { describe, it, expect } from "bun:test";
import { version } from "../../src/core/version.js";
import { buildMission, buildRevision, OWNER_AUTHORITY_ID, OPERATOR_AUTHORITY_ID } from "../helpers.js";
import { applyApprovedRevision } from "../../src/mission/mission.js";
import {
  makeMissionRevision,
  approveMissionRevision,
  rejectMissionRevision,
  requiresExplicitApproval,
  isLawfullyApproved,
} from "../../src/mission/mission-revision.js";
import { traceability } from "../../src/core/traceability.js";
import { CONSTITUTION } from "../helpers.js";

describe("Mission revision lifecycle — anti-silent-rewrite gate", () => {
  it("a telemetry-proposed revision requires explicit approval (predicate)", () => {
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0));
    expect(requiresExplicitApproval(rev)).toBe(true);
  });

  it("an unapproved telemetry revision is not lawfully approved", () => {
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0));
    expect(isLawfullyApproved(rev)).toBe(false);
  });

  it("applyApprovedRevision refuses an unapproved revision (negative test)", () => {
    const m1 = buildMission({ status: "approved" });
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0)); // status: proposal
    expect(() =>
      applyApprovedRevision(
        m1,
        rev,
        { statement: "x" },
        m1.formalization,
        traceability({ constitutionRef: CONSTITUTION, authorityRef: OWNER_AUTHORITY_ID, origin: "approved-revision" }),
        "2025-05-01T00:00:00.000Z",
      ),
    ).toThrow();
  });

  it("applyApprovedRevision refuses an approved revision missing an approver (negative test)", () => {
    const m1 = buildMission({ status: "approved" });
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(2, 0, 0),
      proposedBy: OWNER_AUTHORITY_ID,
      triggeredBy: "telemetry-proposal",
      rationale: "drift",
      createdAt: "2025-05-02T00:00:00.000Z",
    });
    // Force status approved without setting approvedBy (simulated corruption).
    const corrupted = { ...rev, status: "approved" as const, approvedBy: null };
    expect(() =>
      applyApprovedRevision(
        m1,
        corrupted,
        { statement: "x" },
        m1.formalization,
        traceability({ constitutionRef: CONSTITUTION, authorityRef: OWNER_AUTHORITY_ID, origin: "approved-revision" }),
        "2025-05-03T00:00:00.000Z",
      ),
    ).toThrow();
  });

  it("rejectMissionRevision requires authority (negative test)", () => {
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0));
    expect(() => rejectMissionRevision(rev, false)).toThrow();
    expect(rejectMissionRevision(rev, true).status).toBe("rejected");
  });
});
