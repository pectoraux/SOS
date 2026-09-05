/**
 * Provenance — exact-source attribution for every value and evidence record.
 *
 * Per spec/architecture-lock.md ("Evidence must preserve exact source revision,
 * deployment revision and temporal context") and R21 ("truthful failure states"),
 * any value that flows through SOS must carry where it came from so that unknown /
 * unavailable / failed states are never silently replaced by inferred values.
 */

import type { RevisionId } from "./identifiers.js";

export interface Provenance {
  /** Source git revision / commit hash when known, else null. */
  readonly sourceRevision: string | null;
  /** Logical provenance kind. */
  readonly kind: ProvenanceKind;
  /** ISO-8601 timestamp the value was observed/recorded. */
  readonly observedAt: string;
  /** Optional reference to a revision record that introduced this value. */
  readonly revisionRef: RevisionId | null;
}

export type ProvenanceKind =
  | "user-input"
  | "approved-revision"
  | "telemetry-proposal"
  | "derived"
  | "external"
  | "system";

export function provenance(
  kind: ProvenanceKind,
  observedAt: string,
  sourceRevision: string | null = null,
  revisionRef?: RevisionId | null,
): Provenance {
  if (typeof observedAt !== "string" || observedAt.length === 0) {
    throw new Error("SOS: provenance.observedAt must be a non-empty ISO timestamp");
  }
  return { kind, observedAt, sourceRevision, revisionRef: revisionRef ?? null };
}
