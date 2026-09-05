/**
 * Traceability — the cross-model lineage every SOS record MUST carry.
 *
 * Implements W1 acceptance criterion 9 ("Every model carries traceability to
 * owning mission/value/authority records") and the Core invariant §2
 * (every consequential decision traceable through Constitution → Mission →
 * Value Model → Context → ...).
 *
 * Traceability is mandatory, not optional metadata. A record with no owning
 * authority is not a lawful SOS record.
 */

import type {
  AuthorityId,
  ConstitutionId,
  MissionId,
  ValueModelId,
} from "./identifiers.js";

export interface Traceability {
  /** Governing constitution version reference (highest authority). */
  readonly constitutionRef: ConstitutionId;
  /** Owning mission this record serves (null only for a Mission's own ancestry root). */
  readonly missionRef: MissionId | null;
  /** Owning value-model record, when business-derived. */
  readonly valueModelRef: ValueModelId | null;
  /** The authority that authorized this record to exist. */
  readonly authorityRef: AuthorityId;
  /** How this record came into being. */
  readonly origin: TraceabilityOrigin;
}

export type TraceabilityOrigin =
  | "user-formalization"
  | "approved-revision"
  | "derived-from-value-model"
  | "context-derivation"
  | "autonomy-configuration"
  | "system-bootstrap";

export function traceability(input: {
  constitutionRef: ConstitutionId;
  missionRef?: MissionId | null;
  valueModelRef?: ValueModelId | null;
  authorityRef: AuthorityId;
  origin: TraceabilityOrigin;
}): Traceability {
  if (!input.authorityRef) {
    throw new Error("SOS: traceability.authorityRef is mandatory");
  }
  if (!input.constitutionRef) {
    throw new Error("SOS: traceability.constitutionRef is mandatory");
  }
  const missionRef = input.missionRef ?? null;
  const valueModelRef = input.valueModelRef ?? null;
  return { ...input, missionRef, valueModelRef };
}
