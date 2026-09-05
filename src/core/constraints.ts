/**
 * Constraint model — hard / soft / risk / preference classes.
 *
 * Implements R4 ("derive ... hard constraints, soft constraints, risk [and]
 * preference constraints from [the value model]") and the frozen invariant
 * §13.3 ("Hard constraints outrank preferences") and §13.2 ("Constitution
 * outranks autonomous optimization").
 *
 * Constraint precedence (highest authority first):
 *   hard > risk > soft > preference
 *
 * Validation rejects:
 *   - two hard constraints that contradict each other (unsatisfiable system);
 *   - a preference that claims to relax a hard constraint;
 *   - empty/blank constraint descriptions (a constraint must state what it binds).
 */

import type { ConstraintId } from "./identifiers.js";
import { constraintId } from "./identifiers.js";

export type ConstraintKind = "hard" | "soft" | "risk" | "preference";

export interface Constraint {
  readonly id: ConstraintId;
  readonly kind: ConstraintKind;
  readonly description: string;
  /** Stable key used to detect contradictions (e.g. "max-latency"). */
  readonly subject: string;
  /** Optional numeric bound, e.g. { op: "<=", value: 200, unit: "ms" }. */
  readonly bound?: ConstraintBound | undefined;
}

export interface ConstraintBound {
  readonly op: "<" | "<=" | "==" | ">=" | ">";
  readonly value: number;
  readonly unit: string;
}

export function makeConstraint(input: {
  id?: string;
  kind: ConstraintKind;
  description: string;
  subject: string;
  bound?: ConstraintBound;
}): Constraint {
  if (input.description.trim().length === 0) {
    throw new Error("SOS: constraint.description must be non-empty");
  }
  if (input.subject.trim().length === 0) {
    throw new Error("SOS: constraint.subject must be non-empty");
  }
  const id = input.id ? constraintId(input.id) : constraintId(`c:${input.subject}:${input.kind}`);
  const bound = input.bound === undefined ? undefined : input.bound;
  return bound === undefined
    ? { id, kind: input.kind, description: input.description, subject: input.subject }
    : { id, kind: input.kind, description: input.description, subject: input.subject, bound };
}

/** Precedence rank; higher outranks lower. */
export function constraintRank(kind: ConstraintKind): number {
  switch (kind) {
    case "hard":
      return 4;
    case "risk":
      return 3;
    case "soft":
      return 2;
    case "preference":
      return 1;
  }
}

export interface ConstraintConflict {
  readonly subject: string;
  readonly reason: string;
  readonly conflicting: readonly Constraint[];
}

/**
 * Validate a constraint set. Returns the list of conflicts (empty when valid).
 * A set is invalid when two hard bounds on the same subject are mutually
 * exclusive, or when a preference directly relaxes a hard bound on the same
 * subject without an explicit higher-authority exception.
 */
export function validateConstraints(constraints: readonly Constraint[]): ConstraintConflict[] {
  const bySubject = new Map<string, Constraint[]>();
  for (const c of constraints) {
    const list = bySubject.get(c.subject) ?? [];
    list.push(c);
    bySubject.set(c.subject, list);
  }

  const conflicts: ConstraintConflict[] = [];

  for (const [subject, list] of bySubject) {
    if (list.length < 2) continue;
    const hard = list.filter((c) => c.kind === "hard");
    // Two hard constraints on the same subject with incompatible bounds conflict.
    for (let i = 0; i < hard.length; i++) {
      for (let j = i + 1; j < hard.length; j++) {
        const a = hard[i]!;
        const b = hard[j]!;
        if (a.bound && b.bound && boundsContradict(a.bound, b.bound)) {
          conflicts.push({
            subject,
            reason: `mutually exclusive hard bounds on "${subject}"`,
            conflicting: [a, b],
          });
        }
      }
    }
    // A preference must not relax a hard bound on the same subject.
    const hardBound = hard.find((c) => c.bound !== undefined);
    if (hardBound?.bound) {
      for (const pref of list.filter((c) => c.kind === "preference")) {
        if (pref.bound && boundsRelax(hardBound.bound, pref.bound)) {
          conflicts.push({
            subject,
            reason: `preference relaxes a hard constraint on "${subject}"`,
            conflicting: [hardBound, pref],
          });
        }
      }
    }
  }

  return conflicts;
}

function boundsContradict(a: ConstraintBound, b: ConstraintBound): boolean {
  if (a.unit !== b.unit) return false;
  // Simple contradiction: one demands <=X, the other demands >X (or vice versa).
  const aMax = (a.op === "<" || a.op === "<=") ? a.value : null;
  const bMin = (b.op === ">" || b.op === ">=") ? b.value : null;
  const bMax = (b.op === "<" || b.op === "<=") ? b.value : null;
  const aMin = (a.op === ">" || a.op === ">=") ? a.value : null;
  if (aMax !== null && bMin !== null) return aMax <= bMin;
  if (bMax !== null && aMin !== null) return bMax <= aMin;
  return false;
}

function boundsRelax(hard: ConstraintBound, pref: ConstraintBound): boolean {
  if (hard.unit !== pref.unit) return false;
  // A preference that pushes a hard ceiling upward relaxes the hard constraint.
  if (
    (hard.op === "<" || hard.op === "<=") &&
    (pref.op === "<" || pref.op === "<=") &&
    pref.value > hard.value
  ) {
    return true;
  }
  // A preference that pushes a hard floor downward relaxes the hard constraint.
  if (
    (hard.op === ">" || hard.op === ">=") &&
    (pref.op === ">" || pref.op === ">=") &&
    pref.value < hard.value
  ) {
    return true;
  }
  return false;
}
