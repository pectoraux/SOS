import { describe, it, expect } from "bun:test";
import { version } from "../../src/core/version.js";
import { buildMission, OWNER_AUTHORITY_ID, OPERATOR_AUTHORITY_ID } from "../helpers.js";
import { makeMission } from "../../src/mission/mission.js";
import { applyApprovedRevision } from "../../src/mission/mission.js";
import { makeMissionRevision, approveMissionRevision } from "../../src/mission/mission-revision.js";
import { EMPTY_FORMALIZATION, advanceFormalization } from "../../src/mission/formalization-state.js";
import { traceability } from "../../src/core/traceability.js";
import { CONSTITUTION } from "../helpers.js";

describe("Mission — identity/version/authority/history (W1 criterion 1)", () => {
  it("carries stable identity, version, owner authority, goals, outcomes, assumptions, ambiguities and change history", () => {
    const m = buildMission();
    expect(m.id as string).toBe("m:sos-mission");
    expect(m.version).toEqual(version(1, 0, 0));
    expect(m.authority).toBe(OWNER_AUTHORITY_ID);
    expect(m.goals.length).toBeGreaterThan(0);
    expect(m.desiredOutcomes.length).toBeGreaterThan(0);
    expect(m.assumptions.length).toBeGreaterThan(0);
    expect(m.ambiguities.length).toBeGreaterThan(0);
    expect(m.stakeholders.length).toBeGreaterThan(0);
    expect(m.measures.length).toBeGreaterThan(0);
    expect(m.changeHistory).toEqual([]);
    expect(m.parentVersion).toBeNull();
  });

  it("requires a non-empty statement", () => {
    expect(() =>
      makeMission({
        version: version(1, 0, 0),
        authority: OWNER_AUTHORITY_ID,
        constitutionRef: CONSTITUTION,
        statement: "  ",
        formalization: EMPTY_FORMALIZATION,
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "user-formalization",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("formalization cannot be frozen without collaborative human sign-off (R2)", () => {
    expect(() =>
      advanceFormalization(EMPTY_FORMALIZATION, "frozen", false),
    ).toThrow();
    const ok = advanceFormalization(EMPTY_FORMALIZATION, "structured", false);
    expect(ok.stage).toBe("structured");
  });

  it("records parent version + change history when superseded by an approved revision", () => {
    const m1 = buildMission({ status: "approved" });
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(1, 1, 0),
      proposedBy: OPERATOR_AUTHORITY_ID,
      triggeredBy: "user",
      rationale: "Refine scope after stakeholder review",
      createdAt: "2025-03-01T00:00:00.000Z",
    });
    const approved = approveMissionRevision(rev, OWNER_AUTHORITY_ID, true);
    const m2 = applyApprovedRevision(
      m1,
      approved,
      { statement: "Refined mission scope." },
      advanceFormalization(EMPTY_FORMALIZATION, "validated", true),
      traceability({
        constitutionRef: CONSTITUTION,
        missionRef: m1.id,
        authorityRef: OWNER_AUTHORITY_ID,
        origin: "approved-revision",
      }),
      "2025-03-02T00:00:00.000Z",
    );
    expect(m2.parentVersion).toEqual(version(1, 0, 0));
    expect(m2.version).toEqual(version(1, 1, 0));
    expect(m2.changeHistory.length).toBe(1);
    expect(m2.changeHistory[0]!.status).toBe("approved");
  });
});

describe("Mission revision — no telemetry path may silently revise intent (W1 criterion 2, R3)", () => {
  it("a telemetry-triggered revision starts as a proposal and cannot be enacted without an approver", () => {
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(2, 0, 0),
      proposedBy: OPERATOR_AUTHORITY_ID,
      triggeredBy: "telemetry-proposal",
      rationale: "Telemetry suggests mission drift",
      createdAt: "2025-04-01T00:00:00.000Z",
    });
    expect(rev.status).toBe("proposal");
    expect(rev.approvedBy).toBeNull();
  });

  it("rejects approval when the approver lacks mission-revision authority (negative test)", () => {
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(2, 0, 0),
      proposedBy: OWNER_AUTHORITY_ID,
      triggeredBy: "telemetry-proposal",
      rationale: "Telemetry drift",
      createdAt: "2025-04-02T00:00:00.000Z",
    });
    expect(() => approveMissionRevision(rev, OPERATOR_AUTHORITY_ID, false)).toThrow();
  });

  it("a telemetry-proposed revision only becomes lawfully approved with a human approver", () => {
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(2, 0, 0),
      proposedBy: OPERATOR_AUTHORITY_ID,
      triggeredBy: "telemetry-proposal",
      rationale: "Drift",
      createdAt: "2025-04-03T00:00:00.000Z",
    });
    const approved = approveMissionRevision(rev, OWNER_AUTHORITY_ID, true);
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe(OWNER_AUTHORITY_ID);
  });

  it("refuses to advance a version to a non-later (regressing) version (no implicit rollback of intent)", () => {
    expect(() =>
      makeMissionRevision({
        fromVersion: version(2, 0, 0),
        toVersion: version(1, 0, 0),
        proposedBy: OWNER_AUTHORITY_ID,
        triggeredBy: "user",
        rationale: "rollback intent",
        createdAt: "2025-04-04T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
