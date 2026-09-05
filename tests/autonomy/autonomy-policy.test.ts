import { describe, it, expect } from "bun:test";
import { buildAutonomyPolicy, CONSTITUTION, OWNER_AUTHORITY_ID } from "../helpers.js";
import { makeAutonomyPolicy, evaluateAutonomy } from "../../src/autonomy/autonomy-policy.js";
import { traceability } from "../../src/core/traceability.js";
import { version } from "../../src/core/version.js";
import { missionId } from "../../src/core/identifiers.js";

const MISSION = missionId("m:sos-mission");

describe("AutonomyPolicy — per-action/environment thresholds + required human approval (W1 criterion 5)", () => {
  it("expresses per-action thresholds and environment-specific overrides", () => {
    const policy = buildAutonomyPolicy();
    const deployProd = policy.rules.find((r) => r.actionClass === "deploy" && r.environment === "production");
    expect(deployProd).toBeDefined();
    expect(deployProd!.threshold.minConfidence).toBe(0.9);
    const missionRule = policy.rules.find((r) => r.actionClass === "mission-revision");
    expect(missionRule!.requiresHumanApproval).toBe(true);
  });

  it("refuses a rule looser than the constitution default (no silent threshold lowering)", () => {
    expect(() =>
      makeAutonomyPolicy({
        version: version(1, 0, 0),
        constitutionRef: CONSTITUTION,
        defaultThreshold: { minConfidence: 0.8, maxRisk: "medium", maxBlastRadius: "service", maxReversibility: "reversible" },
        rules: [
          {
            actionClass: "deploy",
            threshold: { minConfidence: 0.5, maxRisk: "high", maxBlastRadius: "system", maxReversibility: "difficult" },
            requiresHumanApproval: false,
          },
        ],
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: MISSION,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "autonomy-configuration",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("returns ASK when a human-approval-required action lacks authority present", () => {
    const policy = buildAutonomyPolicy();
    const decision = evaluateAutonomy(policy, {
      actionClass: "mission-revision",
      confidence: 0.99,
      risk: "negligible",
      blastRadius: "none",
      reversibility: "reversible",
      authorityPresent: false,
    });
    expect(decision).toBe("ASK");
  });

  it("returns ACT when confidence/risk/blast/reversibility are within threshold and authority present", () => {
    const policy = buildAutonomyPolicy();
    const decision = evaluateAutonomy(policy, {
      actionClass: "deploy",
      environment: "production",
      confidence: 0.95,
      risk: "low",
      blastRadius: "limited",
      reversibility: "reversible",
      authorityPresent: true,
    });
    expect(decision).toBe("ACT");
  });

  it("returns GATHER_EVIDENCE when confidence is below threshold (low confidence is not always inaction, §5)", () => {
    const policy = buildAutonomyPolicy();
    const decision = evaluateAutonomy(policy, {
      actionClass: "deploy",
      environment: "production",
      confidence: 0.5,
      risk: "low",
      blastRadius: "limited",
      reversibility: "reversible",
      authorityPresent: true,
    });
    expect(decision).toBe("GATHER_EVIDENCE");
  });

  it("can return EXPERIMENT for low-confidence reversible experiment-class actions (§5 nuance)", () => {
    const policy = buildAutonomyPolicy();
    const decision = evaluateAutonomy(policy, {
      actionClass: "experiment",
      confidence: 0.5,
      risk: "low",
      blastRadius: "limited",
      reversibility: "reversible",
      authorityPresent: true,
    });
    expect(decision).toBe("EXPERIMENT");
  });

  it("returns ASK when risk/blast exceed threshold even at high confidence", () => {
    const policy = buildAutonomyPolicy();
    const decision = evaluateAutonomy(policy, {
      actionClass: "deploy",
      environment: "production",
      confidence: 0.99,
      risk: "critical",
      blastRadius: "organization",
      reversibility: "irreversible",
      authorityPresent: true,
    });
    expect(decision).toBe("ASK");
  });
});
