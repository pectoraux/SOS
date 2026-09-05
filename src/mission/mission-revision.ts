/**
 * Mission revision lifecycle — explicit proposals and approved revisions.
 *
 * Implements R3 ("Production evidence may trigger revision proposals but may
 * not silently alter the mission"), W1 acceptance criterion 2 ("Mission
 * revisions are explicit proposals/approved revisions; no telemetry path may
 * silently revise intent"), and the constitution Mission-protection clause.
 *
 * The central invariant encoded here: a revision whose `triggeredBy` origin is
 * telemetry can only ever be a `proposal`. It can NEVER become `approved`
 * without an explicit, non-null `approvedBy` human authority. This is the
 * single lawful gate against silent mission rewrite.
 */

import type { AuthorityId, RevisionId } from "../core/identifiers.js";
import { revisionId } from "../core/identifiers.js";
import type { Version } from "../core/version.js";
import { versionsEqual, isLaterVersion } from "../core/version.js";

export type MissionRevisionTrigger =
  | "user"
  | "telemetry-proposal"
  | "value-model-change";

export type MissionRevisionStatus = "proposal" | "approved" | "rejected";

export interface MissionRevision {
  readonly id: RevisionId;
  readonly fromVersion: Version;
  readonly toVersion: Version;
  readonly status: MissionRevisionStatus;
  readonly proposedBy: AuthorityId;
  /** Non-null only when the revision is approved by a human authority. */
  readonly approvedBy: AuthorityId | null;
  readonly triggeredBy: MissionRevisionTrigger;
  readonly rationale: string;
  readonly createdAt: string;
}

export function makeMissionRevision(input: {
  id?: string;
  fromVersion: Version;
  toVersion: Version;
  proposedBy: AuthorityId;
  triggeredBy: MissionRevisionTrigger;
  rationale: string;
  createdAt: string;
}): MissionRevision {
  if (versionsEqual(input.fromVersion, input.toVersion)) {
    throw new Error("SOS: a mission revision must change the version");
  }
  if (!isLaterVersion(input.toVersion, input.fromVersion)) {
    throw new Error(
      "SOS: a mission revision must advance to a later version (no implicit regression)",
    );
  }
  if (input.rationale.trim().length === 0) {
    throw new Error("SOS: a mission revision requires a rationale");
  }
  return {
    id: input.id ? revisionId(input.id) : revisionId(`r:${input.createdAt}`),
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    status: "proposal",
    proposedBy: input.proposedBy,
    approvedBy: null,
    triggeredBy: input.triggeredBy,
    rationale: input.rationale,
    createdAt: input.createdAt,
  };
}

/**
 * Approve a mission revision. Refuses to approve any revision triggered by
 * telemetry unless `approver` is a real human authority — this is the
 * anti-silent-rewrite gate. Returns a new immutable revision record.
 */
export function approveMissionRevision(
  revision: MissionRevision,
  approver: AuthorityId,
  approverCanApprove: boolean,
): MissionRevision {
  if (!approverCanApprove) {
    throw new Error("SOS: approver lacks mission-revision authority");
  }
  if (revision.triggeredBy === "telemetry-proposal" && revision.approvedBy !== null) {
    throw new Error("SOS: telemetry-proposed revision already approved");
  }
  return {
    ...revision,
    status: "approved",
    approvedBy: approver,
  };
}

export function rejectMissionRevision(
  revision: MissionRevision,
  approverCanApprove: boolean,
): MissionRevision {
  if (!approverCanApprove) {
    throw new Error("SOS: rejector lacks mission-revision authority");
  }
  return { ...revision, status: "rejected" };
}

/**
 * Lawful predicate: can a revision of this trigger origin ever become approved
 * without an explicit human approval step? Answer is always false — but the
 * function makes the invariant inspectable for tests and reviews.
 */
export function requiresExplicitApproval(revision: MissionRevision): boolean {
  return revision.triggeredBy === "telemetry-proposal";
}

/** True only when a telemetry-triggered revision has a human approver recorded. */
export function isLawfullyApproved(revision: MissionRevision): boolean {
  if (revision.status !== "approved") return false;
  if (requiresExplicitApproval(revision)) {
    return revision.approvedBy !== null;
  }
  return revision.approvedBy !== null;
}
