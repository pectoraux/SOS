import { describe, it, expect } from "bun:test";
import { buildDecision, AUTONOMY_POLICY_ID, MISSION_ID, CONSTITUTION, OWNER_AUTHORITY_ID } from "../helpers.js";
import { makeDecision } from "../../src/decisions/decision.js";
import { traceability } from "../../src/core/traceability.js";
import { version } from "../../src/core/version.js";
import { calibratedConfidence, qualitativeConfidence } from "../../src/core/confidence.js";

describe("Decision — ACT/EXPERIMENT/GATHER_EVIDENCE/ASK states (W1 criteria 6 & 7)", () => {
  it("an ASK decision MUST carry an askPayload (type-enforced pairing)", () => {
    const d = buildDecision("ASK");
    expect(d.action).toBe("ASK");
    expect(d.askPayload).not.toBeNull();
    expect(d.askPayload!.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses an ASK decision without an askPayload (negative test)", () => {
    expect(() =>
      makeDecision({
        version: version(1, 0, 0),
        constitutionRef: CONSTITUTION,
        missionRef: MISSION_ID,
        action: "ASK",
        rationale: "insufficient authority",
        authorityRef: OWNER_AUTHORITY_ID,
        confidence: qualitativeConfidence("high", "mixed"),
        risk: "high",
        autonomyPolicyRef: AUTONOMY_POLICY_ID,
        askPayload: null,
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: MISSION_ID,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "approved-revision",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("refuses a non-ASK decision that carries an askPayload (negative test)", () => {
    expect(() =>
      makeDecision({
        version: version(1, 0, 0),
        constitutionRef: CONSTITUTION,
        missionRef: MISSION_ID,
        action: "ACT",
        rationale: "ok",
        authorityRef: OWNER_AUTHORITY_ID,
        confidence: calibratedConfidence(0.95, { sampleSize: 50, observedAccuracy: 0.93 }),
        risk: "low",
        autonomyPolicyRef: AUTONOMY_POLICY_ID,
        askPayload: buildDecision("ASK").askPayload,
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: MISSION_ID,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "approved-revision",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("supports the full decision action set", () => {
    const actions = ["ACT", "EXPERIMENT", "GATHER_EVIDENCE", "ASK", "REJECT", "ROLLBACK"] as const;
    for (const a of actions) {
      if (a === "ASK") continue;
      const d = makeDecision({
        version: version(1, 0, 0),
        constitutionRef: CONSTITUTION,
        missionRef: MISSION_ID,
        action: a,
        rationale: `r-${a}`,
        authorityRef: OWNER_AUTHORITY_ID,
        confidence: calibratedConfidence(0.9, { sampleSize: 10, observedAccuracy: 0.9 }),
        risk: "low",
        autonomyPolicyRef: AUTONOMY_POLICY_ID,
        askPayload: null,
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: MISSION_ID,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "approved-revision",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      });
      expect(d.action).toBe(a);
      expect(d.askPayload).toBeNull();
    }
  });
});
