/**
 * Value Model — how the organization creates and sustains value.
 *
 * Implements spec/architecture.md §3.3, R4, and W1 acceptance criterion 3
 * ("Value Model represents business-model inputs and derives typed
 * objective/constraint/incentive/opportunity records without outranking
 * Mission or Constitution").
 *
 * Subordination invariant: every ValueModel MUST reference an approved Mission
 * (missionRef). A ValueModel with no owning mission, or whose referenced
 * mission is not yet approved, is unlawful and rejected at construction time
 * in the store layer. Business-model-derived constraints are explicit and typed
 * (hard / soft / risk / preference) but never outrank the Constitution.
 */

import type { ConstitutionId, MissionId, ValueModelId } from "../core/identifiers.js";
import { valueModelId } from "../core/identifiers.js";
import type { Version } from "../core/version.js";
import type { Traceability } from "../core/traceability.js";
import type { Constraint } from "../core/constraints.js";

export type ValueModelStatus = "draft" | "proposed" | "approved" | "superseded";

export interface BusinessModel {
  readonly summary: string;
  readonly revenueStreams: readonly string[];
  readonly costDrivers: readonly string[];
}

export interface Objective {
  readonly id: string;
  readonly description: string;
  /** Direction of desired movement. */
  readonly direction: "maximize" | "minimize" | "maintain";
  readonly measureRef?: string | undefined;
}

export interface Budget {
  readonly id: string;
  readonly category: string;
  readonly limit: number;
  readonly unit: string;
  readonly period: string;
}

export interface Incentive {
  readonly id: string;
  readonly description: string;
  /** Who the incentive acts upon. */
  readonly target: string;
  /** Whether the incentive aligns with or misaligns from the mission. */
  readonly alignment: "aligned" | "misaligned";
}

export interface Opportunity {
  readonly id: string;
  readonly description: string;
  readonly estimatedUplift: string;
}

export interface ValueModel {
  readonly id: ValueModelId;
  readonly version: Version;
  readonly missionRef: MissionId;
  readonly constitutionRef: ConstitutionId;
  readonly businessModel: BusinessModel;
  readonly economicObjectives: readonly Objective[];
  readonly budgets: readonly Budget[];
  readonly incentives: readonly Incentive[];
  readonly opportunities: readonly Opportunity[];
  readonly constraints: readonly Constraint[];
  readonly status: ValueModelStatus;
  readonly parentVersion: Version | null;
  readonly traceability: Traceability;
  readonly createdAt: string;
}

export function makeValueModel(input: {
  id?: string;
  version: Version;
  missionRef: MissionId;
  constitutionRef: ConstitutionId;
  businessModel: BusinessModel;
  economicObjectives?: Objective[];
  budgets?: Budget[];
  incentives?: Incentive[];
  opportunities?: Opportunity[];
  constraints?: Constraint[];
  traceability: Traceability;
  createdAt: string;
  parentVersion?: Version | null;
}): ValueModel {
  if (input.businessModel.summary.trim().length === 0) {
    throw new Error("SOS: valueModel.businessModel.summary must be non-empty");
  }
  // Subordination: the traceability must point at the same mission this value
  // model serves, and the constitution ref must match.
  if (input.traceability.missionRef !== input.missionRef) {
    throw new Error(
      "SOS: valueModel.traceability.missionRef must equal valueModel.missionRef",
    );
  }
  if (input.traceability.constitutionRef !== input.constitutionRef) {
    throw new Error(
      "SOS: valueModel.traceability.constitutionRef must equal valueModel.constitutionRef",
    );
  }
  return {
    id: input.id ? valueModelId(input.id) : valueModelId(`v:${input.createdAt}`),
    version: input.version,
    missionRef: input.missionRef,
    constitutionRef: input.constitutionRef,
    businessModel: input.businessModel,
    economicObjectives: input.economicObjectives ?? [],
    budgets: input.budgets ?? [],
    incentives: input.incentives ?? [],
    opportunities: input.opportunities ?? [],
    constraints: input.constraints ?? [],
    status: "draft",
    parentVersion: input.parentVersion ?? null,
    traceability: input.traceability,
    createdAt: input.createdAt,
  };
}

/** Approve a value-model commitment (separates proposal from approval). */
export function approveValueModel(vm: ValueModel): ValueModel {
  return { ...vm, status: "approved" };
}
