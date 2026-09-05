/**
 * Mission — the enduring purpose SOS is optimizing.
 *
 * Implements spec/architecture.md §3.2, spec/sos-meta-model.md (Mission entity),
 * R1–R3, and W1 acceptance criteria 1 & 2. Mission is the highest product-level
 * intent beneath the Constitution and above architecture/implementation.
 *
 * Invariants encoded:
 *   - stable identity + version + owner/authority;
 *   - goals, outcomes, assumptions, ambiguities, measures, stakeholders;
 *   - explicit, parented change history of revisions;
 *   - no telemetry path may silently revise intent (delegated to mission-revision.ts);
 *   - traceability to the Constitution and the approving authority.
 */

import type { AuthorityId, ConstitutionId, MissionId } from "../core/identifiers.js";
import { missionId as makeMissionId } from "../core/identifiers.js";
import type { Version } from "../core/version.js";
import { versionsEqual } from "../core/version.js";
import type { Traceability } from "../core/traceability.js";
import type { FormalizationState } from "./formalization-state.js";
import type { MissionRevision } from "./mission-revision.js";

export type MissionStatus = "draft" | "proposed" | "approved" | "superseded";

export interface Goal {
  readonly id: string;
  readonly statement: string;
}

export interface Outcome {
  readonly id: string;
  readonly description: string;
  /** Optional measurable target bound to a Measure. */
  readonly target?: string | undefined;
}

export interface Stakeholder {
  readonly id: string;
  readonly name: string;
  readonly interest: string;
}

export interface Measure {
  readonly id: string;
  readonly name: string;
  readonly definition: string;
}

export interface Assumption {
  readonly id: string;
  readonly statement: string;
  /** Assumptions may be invalidated; explicit tracking required. */
  readonly status: "open" | "invalidated";
}

export interface Ambiguity {
  readonly id: string;
  readonly statement: string;
  readonly resolution?: string | undefined;
}

export interface Mission {
  readonly id: MissionId;
  readonly version: Version;
  readonly authority: AuthorityId;
  readonly constitutionRef: ConstitutionId;
  readonly statement: string;
  readonly goals: readonly Goal[];
  readonly desiredOutcomes: readonly Outcome[];
  readonly stakeholders: readonly Stakeholder[];
  readonly measures: readonly Measure[];
  readonly assumptions: readonly Assumption[];
  readonly ambiguities: readonly Ambiguity[];
  readonly status: MissionStatus;
  readonly formalization: FormalizationState;
  /** Parent version this one supersedes, or null for the root mission. */
  readonly parentVersion: Version | null;
  /** Append-only revision history. */
  readonly changeHistory: readonly MissionRevision[];
  readonly traceability: Traceability;
  readonly createdAt: string;
}

export function makeMission(input: {
  id?: string;
  version: Version;
  authority: AuthorityId;
  constitutionRef: ConstitutionId;
  statement: string;
  goals?: readonly Goal[];
  desiredOutcomes?: readonly Outcome[];
  stakeholders?: readonly Stakeholder[];
  measures?: readonly Measure[];
  assumptions?: readonly Assumption[];
  ambiguities?: readonly Ambiguity[];
  formalization: FormalizationState;
  traceability: Traceability;
  createdAt: string;
  parentVersion?: Version | null;
  changeHistory?: readonly MissionRevision[];
}): Mission {
  if (input.statement.trim().length === 0) {
    throw new Error("SOS: mission.statement must be non-empty");
  }
  if (input.traceability.constitutionRef !== input.constitutionRef) {
    throw new Error("SOS: mission.constitutionRef must match traceability.constitutionRef");
  }
  if (input.traceability.missionRef !== null) {
    // A mission's own traceability links upward to its parent mission, if any.
    // The root mission carries missionRef === null (it is the authority root).
  }
  return {
    id: input.id ? makeMissionId(input.id) : makeMissionId(`m:${input.createdAt}`),
    version: input.version,
    authority: input.authority,
    constitutionRef: input.constitutionRef,
    statement: input.statement,
    goals: input.goals ?? [],
    desiredOutcomes: input.desiredOutcomes ?? [],
    stakeholders: input.stakeholders ?? [],
    measures: input.measures ?? [],
    assumptions: input.assumptions ?? [],
    ambiguities: input.ambiguities ?? [],
    status: "draft",
    formalization: input.formalization,
    parentVersion: input.parentVersion ?? null,
    changeHistory: input.changeHistory ?? [],
    traceability: input.traceability,
    createdAt: input.createdAt,
  };
}

/**
 * Apply an approved revision to produce a new Mission version. The previous
 * version becomes `superseded`. The revision MUST be approved (never a bare
 * proposal) — this function refuses to enact an unapproved revision.
 */
export function applyApprovedRevision(
  current: Mission,
  revision: MissionRevision,
  nextFields: Partial<Pick<Mission, "statement" | "goals" | "desiredOutcomes" | "assumptions" | "ambiguities">>,
  formalization: FormalizationState,
  traceability: Traceability,
  createdAt: string,
): Mission {
  if (revision.status !== "approved") {
    throw new Error("SOS: only an approved revision may be enacted");
  }
  if (revision.approvedBy === null) {
    throw new Error("SOS: an approved revision must record a human approver");
  }
  if (!versionsEqual(revision.fromVersion, current.version)) {
    throw new Error("SOS: revision.fromVersion must match the current mission version");
  }
  return {
    ...current,
    version: revision.toVersion,
    statement: nextFields.statement ?? current.statement,
    goals: nextFields.goals ?? current.goals,
    desiredOutcomes: nextFields.desiredOutcomes ?? current.desiredOutcomes,
    assumptions: nextFields.assumptions ?? current.assumptions,
    ambiguities: nextFields.ambiguities ?? current.ambiguities,
    status: "approved",
    parentVersion: current.version,
    formalization,
    changeHistory: [...current.changeHistory, revision],
    traceability,
    createdAt,
  };
}
