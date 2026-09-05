/**
 * Collaborative progressive formalization state for a Mission.
 *
 * Implements R2 ("SOS MUST help users progressively formalize an initially
 * natural-language mission into goals, outcomes, stakeholders, measures,
 * assumptions, ambiguities, constraints and preferences. The user remains the
 * authority over mission meaning.").
 *
 * Formalization is collaborative and progressive: a mission starts `raw` and
 * moves through `structured` → `validated` → `frozen` only by explicit user
 * action. SOS never auto-advances formalization; doing so would silently
 * rewrite mission intent (forbidden by the constitution Mission-protection
 * clause and architecture-lock.md).
 */

export type FormalizationStage = "raw" | "structured" | "validated" | "frozen";

export type MissionField =
  | "statement"
  | "goals"
  | "desiredOutcomes"
  | "stakeholders"
  | "measures"
  | "assumptions"
  | "ambiguities";

export type FieldCompleteness = "missing" | "partial" | "complete";

export interface FormalizationState {
  readonly stage: FormalizationStage;
  readonly completeness: Readonly<Record<MissionField, FieldCompleteness>>;
  /** True only when a human authority has signed off the formalization. */
  readonly collaborativelyFormalized: boolean;
}

export const EMPTY_FORMALIZATION: FormalizationState = {
  stage: "raw",
  completeness: {
    statement: "missing",
    goals: "missing",
    desiredOutcomes: "missing",
    stakeholders: "missing",
    measures: "missing",
    assumptions: "missing",
    ambiguities: "missing",
  },
  collaborativelyFormalized: false,
};

const STAGE_ORDER: readonly FormalizationStage[] = ["raw", "structured", "validated", "frozen"];

export function stageRank(s: FormalizationStage): number {
  return STAGE_ORDER.indexOf(s);
}

/**
 * Advance formalization to a later stage. Refuses to skip the collaborative
 * gate: `frozen` requires `collaborativelyFormalized === true`.
 */
export function advanceFormalization(
  current: FormalizationState,
  target: FormalizationStage,
  collaborativelyFormalized: boolean,
): FormalizationState {
  if (stageRank(target) <= stageRank(current.stage)) {
    throw new Error(
      `SOS: formalization cannot regress or stay (${current.stage} → ${target})`,
    );
  }
  if (target === "frozen" && !collaborativelyFormalized) {
    throw new Error(
      "SOS: a mission cannot be frozen without collaborative human formalization",
    );
  }
  return {
    ...current,
    stage: target,
    collaborativelyFormalized,
  };
}

/** Compute completeness from a mission's structured fields. */
export function deriveCompleteness(
  fields: Readonly<Record<MissionField, { length: number } | null>>,
): Readonly<Record<MissionField, FieldCompleteness>> {
  const out = {} as Record<MissionField, FieldCompleteness>;
  (Object.keys(fields) as MissionField[]).forEach((k) => {
    const v = fields[k];
    if (v === null) {
      out[k] = "missing";
    } else if (v.length === 0) {
      out[k] = "missing";
    } else if (v.length < 2) {
      out[k] = "partial";
    } else {
      out[k] = "complete";
    }
  });
  return out;
}
