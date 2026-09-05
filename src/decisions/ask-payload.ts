/**
 * ASK payload — the first-class decision outcome when autonomy is insufficient.
 *
 * Implements R16, spec/architecture.md §5 ("When autonomous authority is
 * insufficient, `ASK` is mandatory. Questions should present alternatives,
 * expected outcomes, trade-offs, evidence quality, and the exact decision
 * needed."), and W1 acceptance criterion 7.
 */

export interface Alternative {
  readonly id: string;
  readonly label: string;
  readonly expectedOutcome: string;
  readonly tradeoffs: readonly Tradeoff[];
}

export interface Tradeoff {
  readonly dimension: string;
  /** Direction: + improves the dimension, − worsens it, ~ neutral. */
  readonly direction: "positive" | "negative" | "neutral";
  readonly note: string;
}

export type EvidenceQuality = "none" | "observational" | "intervention" | "mixed";

export interface UncertaintySummary {
  readonly class: "low" | "moderate" | "high" | "severe";
  readonly rationale: string;
  /** Whether confidence is calibrated or qualitative. */
  readonly basis: "calibrated" | "qualitative";
}

export interface AskPayload {
  /** The exact decision the user must make. */
  readonly decisionNeeded: string;
  readonly alternatives: readonly Alternative[];
  readonly evidenceQuality: EvidenceQuality;
  readonly uncertainty: UncertaintySummary;
  readonly tradeoffs: readonly Tradeoff[];
  /** What happens if the user does not respond (the bounded fallback). */
  readonly noResponseFallback: "gather-evidence" | "experiment" | "no-action" | "escalate";
}

export function makeAskPayload(input: {
  decisionNeeded: string;
  alternatives: Alternative[];
  evidenceQuality: EvidenceQuality;
  uncertainty: UncertaintySummary;
  tradeoffs?: Tradeoff[];
  noResponseFallback: AskPayload["noResponseFallback"];
}): AskPayload {
  if (input.decisionNeeded.trim().length === 0) {
    throw new Error("SOS: askPayload.decisionNeeded must be non-empty");
  }
  if (input.alternatives.length < 2) {
    throw new Error("SOS: an ASK must present at least two alternatives");
  }
  if (input.uncertainty.rationale.trim().length === 0) {
    throw new Error("SOS: askPayload.uncertainty.rationale must be non-empty");
  }
  return {
    decisionNeeded: input.decisionNeeded,
    alternatives: input.alternatives,
    evidenceQuality: input.evidenceQuality,
    uncertainty: input.uncertainty,
    tradeoffs: input.tradeoffs ?? [],
    noResponseFallback: input.noResponseFallback,
  };
}
