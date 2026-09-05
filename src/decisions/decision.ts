/**
 * Decision — the control-plane decision record.
 *
 * Implements spec/architecture.md §4 capability 8 ("Decide — choose ACT,
 * EXPERIMENT, GATHER_EVIDENCE, or ASK, subject to authority policy"),
 * spec/sos-meta-model.md (Decision entity), R15–R16, and W1 acceptance
 * criteria 6 & 7.
 *
 * Invariant: when `action === "ASK"`, `askPayload` MUST be non-null and
 * well-formed. When `action !== "ASK"`, `askPayload` MUST be null. This pairing
 * is enforced at construction and validated by the store.
 */

import type { DecisionId, ConstitutionId, MissionId, AuthorityId, AutonomyPolicyId } from "../core/identifiers.js";
import { decisionId } from "../core/identifiers.js";
import type { Version } from "../core/version.js";
import type { Traceability } from "../core/traceability.js";
import type { Confidence, RiskLevel } from "../core/confidence.js";
import type { AskPayload } from "./ask-payload.js";

export type DecisionAction = "ACT" | "EXPERIMENT" | "GATHER_EVIDENCE" | "ASK" | "REJECT" | "ROLLBACK";

export interface Decision {
  readonly id: DecisionId;
  readonly version: Version;
  readonly constitutionRef: ConstitutionId;
  readonly missionRef: MissionId;
  readonly action: DecisionAction;
  readonly rationale: string;
  readonly authorityRef: AuthorityId;
  readonly confidence: Confidence;
  readonly risk: RiskLevel;
  readonly evidenceRefs: readonly string[];
  readonly autonomyPolicyRef: AutonomyPolicyId;
  /** Present iff action === "ASK". Null otherwise (type-enforced pairing). */
  readonly askPayload: AskPayload | null;
  /** Candidate the decision acts upon. Null in W1 (candidates arrive in W6). */
  readonly candidateRef: string | null;
  readonly traceability: Traceability;
  readonly createdAt: string;
}

export function makeDecision(input: {
  id?: string;
  version: Version;
  constitutionRef: ConstitutionId;
  missionRef: MissionId;
  action: DecisionAction;
  rationale: string;
  authorityRef: AuthorityId;
  confidence: Confidence;
  risk: RiskLevel;
  evidenceRefs?: string[];
  autonomyPolicyRef: AutonomyPolicyId;
  askPayload?: AskPayload | null;
  candidateRef?: string | null;
  traceability: Traceability;
  createdAt: string;
}): Decision {
  if (input.rationale.trim().length === 0) {
    throw new Error("SOS: decision.rationale must be non-empty");
  }
  // The ASK/payload pairing invariant — the heart of R16.
  if (input.action === "ASK") {
    if (input.askPayload === null || input.askPayload === undefined) {
      throw new Error("SOS: an ASK decision MUST carry an askPayload");
    }
  } else {
    if (input.askPayload !== null && input.askPayload !== undefined) {
      throw new Error(
        `SOS: a non-ASK decision (${input.action}) MUST NOT carry an askPayload`,
      );
    }
  }
  if (input.traceability.constitutionRef !== input.constitutionRef) {
    throw new Error("SOS: decision.traceability.constitutionRef must match constitutionRef");
  }
  if (input.traceability.missionRef !== input.missionRef) {
    throw new Error("SOS: decision.traceability.missionRef must match missionRef");
  }
  return {
    id: input.id ? decisionId(input.id) : decisionId(`d:${input.createdAt}`),
    version: input.version,
    constitutionRef: input.constitutionRef,
    missionRef: input.missionRef,
    action: input.action,
    rationale: input.rationale,
    authorityRef: input.authorityRef,
    confidence: input.confidence,
    risk: input.risk,
    evidenceRefs: input.evidenceRefs ?? [],
    autonomyPolicyRef: input.autonomyPolicyRef,
    askPayload: input.action === "ASK" ? (input.askPayload ?? null) : null,
    candidateRef: input.candidateRef ?? null,
    traceability: input.traceability,
    createdAt: input.createdAt,
  };
}
