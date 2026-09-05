/**
 * Autonomy policy — configurable, per-action/per-environment decision thresholds.
 *
 * Implements R15, spec/architecture.md §5, and W1 acceptance criterion 5
 * ("Autonomy policy can express per-action/environment thresholds and required
 * human approval"). Per §5, autonomy is a structured decision over confidence,
 * risk, reversibility, blast radius, evidence and authority — never a raw
 * confidence threshold alone.
 *
 * The policy is a selector: given a proposed action's profile, it decides
 * whether the action is within granted autonomy (`ACT`/`EXPERIMENT`), must
 * `GATHER_EVIDENCE` first, or must `ASK` the user (insufficient authority).
 */

import type { AutonomyPolicyId, ConstitutionId } from "../core/identifiers.js";
import { autonomyPolicyId } from "../core/identifiers.js";
import type { Version } from "../core/version.js";
import type { Traceability } from "../core/traceability.js";
import type { BlastRadius, Reversibility, RiskLevel } from "../core/confidence.js";
import { blastRank, reversibilityRank, riskRank } from "../core/confidence.js";

export type ActionClass =
  | "config-change"
  | "deploy"
  | "experiment"
  | "rollback"
  | "mission-revision"
  | "value-model-approval"
  | "architecture-mutation";

export interface AutonomyThreshold {
  /** Minimum calibrated confidence required to ACT autonomously. */
  readonly minConfidence: number;
  /** Maximum risk level that may be ACTed upon autonomously. */
  readonly maxRisk: RiskLevel;
  /** Maximum blast radius that may be ACTed upon autonomously. */
  readonly maxBlastRadius: BlastRadius;
  /** Maximum reversibility difficulty still eligible for autonomous ACT. */
  readonly maxReversibility: Reversibility;
}

export interface AutonomyRule {
  readonly actionClass: ActionClass;
  readonly environment?: string | undefined;
  readonly threshold: AutonomyThreshold;
  /** When true, the action always requires explicit human approval → ASK. */
  readonly requiresHumanApproval: boolean;
}

export interface AutonomyPolicy {
  readonly id: AutonomyPolicyId;
  readonly version: Version;
  readonly constitutionRef: ConstitutionId;
  readonly defaultThreshold: AutonomyThreshold;
  readonly rules: readonly AutonomyRule[];
  readonly traceability: Traceability;
  readonly createdAt: string;
}

export function makeAutonomyPolicy(input: {
  id?: string;
  version: Version;
  constitutionRef: ConstitutionId;
  defaultThreshold: AutonomyThreshold;
  rules?: AutonomyRule[];
  traceability: Traceability;
  createdAt: string;
}): AutonomyPolicy {
  validateThreshold(input.defaultThreshold);
  for (const r of input.rules ?? []) {
    validateThreshold(r.threshold);
    if (r.requiresHumanApproval === false && !ruleMeetsMinimumDefault(r.threshold, input.defaultThreshold)) {
      throw new Error(
        `SOS: autonomy rule for ${r.actionClass} is looser than the constitution default`,
      );
    }
  }
  if (input.traceability.constitutionRef !== input.constitutionRef) {
    throw new Error("SOS: autonomyPolicy.traceability.constitutionRef must match constitutionRef");
  }
  return {
    id: input.id ? autonomyPolicyId(input.id) : autonomyPolicyId(`ap:${input.createdAt}`),
    version: input.version,
    constitutionRef: input.constitutionRef,
    defaultThreshold: input.defaultThreshold,
    rules: input.rules ?? [],
    traceability: input.traceability,
    createdAt: input.createdAt,
  };
}

function validateThreshold(t: AutonomyThreshold): void {
  if (t.minConfidence < 0 || t.minConfidence > 1) {
    throw new Error("SOS: autonomyThreshold.minConfidence must be within [0,1]");
  }
}

function ruleMeetsMinimumDefault(rule: AutonomyThreshold, def: AutonomyThreshold): boolean {
  // A rule may be stricter than the default, never looser.
  return (
    rule.minConfidence >= def.minConfidence &&
    riskRank(rule.maxRisk) <= riskRank(def.maxRisk) &&
    blastRank(rule.maxBlastRadius) <= blastRank(def.maxBlastRadius) &&
    reversibilityRank(rule.maxReversibility) <= reversibilityRank(def.maxReversibility)
  );
}

export interface ActionProfile {
  readonly actionClass: ActionClass;
  readonly environment?: string | undefined;
  readonly confidence: number;
  readonly risk: RiskLevel;
  readonly blastRadius: BlastRadius;
  readonly reversibility: Reversibility;
  readonly authorityPresent: boolean;
}

export type AutonomyDecision = "ACT" | "EXPERIMENT" | "GATHER_EVIDENCE" | "ASK";

/**
 * Evaluate a proposed action against the policy. Returns the lawful autonomy
 * decision. When authority is insufficient, the answer is always ASK — this is
 * the constitution "ASK or governed escalation" gate.
 */
export function evaluateAutonomy(policy: AutonomyPolicy, profile: ActionProfile): AutonomyDecision {
  const rule = matchRule(policy, profile);
  const threshold = rule?.threshold ?? policy.defaultThreshold;

  if (rule?.requiresHumanApproval && !profile.authorityPresent) {
    return "ASK";
  }
  if (!profile.authorityPresent && rule?.requiresHumanApproval) {
    // authority must be present for human-approval-required actions
    return "ASK";
  }

  const enoughConfidence = profile.confidence >= threshold.minConfidence;
  const acceptableRisk = riskRank(profile.risk) <= riskRank(threshold.maxRisk);
  const acceptableBlast = blastRank(profile.blastRadius) <= blastRank(threshold.maxBlastRadius);
  const acceptableReversibility =
    reversibilityRank(profile.reversibility) <= reversibilityRank(threshold.maxReversibility);

  if (!enoughConfidence) {
    // Low confidence is not always inaction (§5): reversible, low-blast changes
    // may be EXPERIMENTED rather than blocked.
    if (
      acceptableRisk &&
      acceptableBlast &&
      acceptableReversibility &&
      profile.actionClass === "experiment"
    ) {
      return "EXPERIMENT";
    }
    return "GATHER_EVIDENCE";
  }
  if (!acceptableRisk || !acceptableBlast || !acceptableReversibility) {
    return "ASK";
  }
  if (rule?.requiresHumanApproval === true) {
    return profile.authorityPresent ? "ACT" : "ASK";
  }
  return "ACT";
}

function matchRule(policy: AutonomyPolicy, profile: ActionProfile): AutonomyRule | null {
  let best: AutonomyRule | null = null;
  for (const r of policy.rules) {
    if (r.actionClass !== profile.actionClass) continue;
    if (r.environment !== undefined && r.environment !== profile.environment) continue;
    // Prefer environment-specific rules over generic ones.
    if (best === null) {
      best = r;
    } else if (r.environment !== undefined && best.environment === undefined) {
      best = r;
    }
  }
  return best;
}
