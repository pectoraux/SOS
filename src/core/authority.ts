/**
 * Authority model — who may authorize what.
 *
 * Implements R22 ("SOS MUST expose an explicit authority model showing what
 * users have authorized SOS to decide and act upon") and the constitution
 * principle #6 ("No autonomous action may exceed the authority explicitly
 * granted by the owner"). Authority records are referenced by every Mission /
 * Value Model / Decision / AutonomyPolicy via Traceability.
 */

import type { AuthorityId } from "./identifiers.js";
import { authorityId } from "./identifiers.js";

export type AuthorityRole = "owner" | "mission-authority" | "value-approver" | "operator" | "assurer";

export interface Authority {
  readonly id: AuthorityId;
  /** Human principal name (not a machine identity). */
  readonly principal: string;
  readonly roles: readonly AuthorityRole[];
  /** Whether this authority may approve a mission revision (R3: human-authorized). */
  readonly canApproveMissionRevision: boolean;
  /** Whether this authority may approve a value-model commitment. */
  readonly canApproveValueModel: boolean;
  /** Whether this authority may authorize a high-impact decision (else → ASK). */
  readonly canAuthorizeDecision: boolean;
}

export function makeAuthority(input: {
  id?: string;
  principal: string;
  roles?: AuthorityRole[];
  canApproveMissionRevision?: boolean;
  canApproveValueModel?: boolean;
  canAuthorizeDecision?: boolean;
}): Authority {
  if (input.principal.trim().length === 0) {
    throw new Error("SOS: authority.principal must be non-empty");
  }
  const roles = input.roles ?? [];
  // An owner is implicitly a mission-authority and value-approver.
  const isOwner = roles.includes("owner");
  return {
    id: input.id ? authorityId(input.id) : authorityId(`a:${input.principal}`),
    principal: input.principal,
    roles,
    canApproveMissionRevision: input.canApproveMissionRevision ?? isOwner,
    canApproveValueModel: input.canApproveValueModel ?? isOwner,
    canAuthorizeDecision: input.canAuthorizeDecision ?? false,
  };
}

/** True when the authority may approve a mission revision. */
export function mayApproveMissionRevision(a: Authority): boolean {
  return a.canApproveMissionRevision;
}
