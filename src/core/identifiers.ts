/**
 * SOS core identifiers — branded nominal types.
 *
 * Branding prevents the accidental cross-use of structurally identical string
 * identifiers that belong to different SOS authorities (e.g. mixing a MissionId
 * with a ValueModelId). Per spec/sos-meta-model.md every first-class entity has
 * a stable identity; these brands enforce that identity at the type level.
 */

/** Branded nominal type helper. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type ConstitutionId = Brand<string, "ConstitutionId">;
export type MissionId = Brand<string, "MissionId">;
export type ValueModelId = Brand<string, "ValueModelId">;
export type ContextId = Brand<string, "ContextId">;
export type AutonomyPolicyId = Brand<string, "AutonomyPolicyId">;
export type DecisionId = Brand<string, "DecisionId">;
export type AuthorityId = Brand<string, "AuthorityId">;
export type ConstraintId = Brand<string, "ConstraintId">;
export type RevisionId = Brand<string, "RevisionId">;

/** Any SOS branded identifier. */
export type SosId =
  | ConstitutionId
  | MissionId
  | ValueModelId
  | ContextId
  | AutonomyPolicyId
  | DecisionId
  | AuthorityId
  | ConstraintId
  | RevisionId;

/** Safe, deterministic id factory (no unguarded Math.random in domain logic). */
export function id<T extends string>(value: string, _brand: T): Brand<string, T> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`SOS: invalid identifier (empty)`);
  }
  return value as Brand<string, T>;
}

export const constitutionId = (v: string): ConstitutionId => id(v, "ConstitutionId");
export const missionId = (v: string): MissionId => id(v, "MissionId");
export const valueModelId = (v: string): ValueModelId => id(v, "ValueModelId");
export const contextId = (v: string): ContextId => id(v, "ContextId");
export const autonomyPolicyId = (v: string): AutonomyPolicyId => id(v, "AutonomyPolicyId");
export const decisionId = (v: string): DecisionId => id(v, "DecisionId");
export const authorityId = (v: string): AuthorityId => id(v, "AuthorityId");
export const constraintId = (v: string): ConstraintId => id(v, "ConstraintId");
export const revisionId = (v: string): RevisionId => id(v, "RevisionId");
