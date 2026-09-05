/**
 * Confidence, risk and uncertainty types.
 *
 * Per spec/sos-meta-model.md ("Uncertainty semantics"): confidence is a
 * calibrated probability estimate where technically justified; otherwise it is
 * a qualitative uncertainty class. The system preserves raw evidence and never
 * treats an LLM's self-reported confidence as ground truth. Per
 * spec/architecture.md §5, a decision is a function of confidence, calibration,
 * expected impact, risk, reversibility, blast radius, evidence and authority —
 * never a raw confidence threshold alone.
 */

export type Confidence =
  | { readonly kind: "calibrated"; readonly probability: number; readonly calibration: Calibration }
  | { readonly kind: "qualitative"; readonly class: UncertaintyClass; readonly rationale: string };

export interface Calibration {
  /** Number of past predictions with comparable evidence available to score. */
  readonly sampleSize: number;
  /** Observed relative frequency of correctness on comparable predictions. */
  readonly observedAccuracy: number;
}

export type UncertaintyClass = "low" | "moderate" | "high" | "severe";

export type RiskLevel = "negligible" | "low" | "medium" | "high" | "critical";
export type BlastRadius = "none" | "limited" | "service" | "system" | "organization";
export type Reversibility = "reversible" | "difficult" | "irreversible";

export function calibratedConfidence(
  probability: number,
  calibration: Calibration,
): Confidence {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error(`SOS: calibrated probability must be within [0,1] (${probability})`);
  }
  if (
    !Number.isFinite(calibration.observedAccuracy) ||
    calibration.observedAccuracy < 0 ||
    calibration.observedAccuracy > 1
  ) {
    throw new Error(`SOS: calibration.observedAccuracy must be within [0,1]`);
  }
  if (!Number.isInteger(calibration.sampleSize) || calibration.sampleSize < 0) {
    throw new Error(`SOS: calibration.sampleSize must be a non-negative integer`);
  }
  return { kind: "calibrated", probability, calibration };
}

export function qualitativeConfidence(cls: UncertaintyClass, rationale: string): Confidence {
  if (rationale.length === 0) {
    throw new Error("SOS: qualitative confidence requires a rationale");
  }
  return { kind: "qualitative", class: cls, rationale };
}

/** Order risk levels for threshold comparison. Higher index = more severe. */
const RISK_ORDER: readonly RiskLevel[] = ["negligible", "low", "medium", "high", "critical"];
const BLAST_ORDER: readonly BlastRadius[] = ["none", "limited", "service", "system", "organization"];
const REVERSIBILITY_ORDER: readonly Reversibility[] = ["reversible", "difficult", "irreversible"];

export function riskRank(r: RiskLevel): number {
  return RISK_ORDER.indexOf(r);
}
export function blastRank(b: BlastRadius): number {
  return BLAST_ORDER.indexOf(b);
}
export function reversibilityRank(r: Reversibility): number {
  return REVERSIBILITY_ORDER.indexOf(r);
}
