/**
 * Availability — the truthful-state algebra for SOS reads.
 *
 * Implements spec/architecture.md §13 invariant 6 ("Failed/unknown/unavailable
 * reads remain distinguishable") and R21, plus W1 acceptance criterion 8
 * ("Failed/unavailable/unknown state is distinct from empty/successful state").
 *
 * A read MUST NOT conflate a failure with an empty/successful result. Every
 * terminal branch is a distinct discriminated-union member, so the type system
 * forces callers to handle each truthful state explicitly.
 */

import type { Provenance } from "./provenance.js";

export type Availability<T> =
  | Available<T>
  | Unknown<T>
  | Unavailable<T>
  | Failed<T>;

/** A value was successfully read. `value` is the authoritative payload. */
export interface Available<T> {
  readonly status: "available";
  readonly value: T;
  readonly provenance: Provenance;
}

/** No data exists / could not be determined, but the read mechanism succeeded. */
export interface Unknown<T> {
  readonly status: "unknown";
  readonly reason: string;
  readonly provenance: Provenance;
  readonly value: null;
}

/** The data source exists but is currently not accessible (transient). */
export interface Unavailable<T> {
  readonly status: "unavailable";
  readonly reason: string;
  readonly provenance: Provenance;
  readonly value: null;
}

/** The read attempt itself failed (exception, corrupt data, invariant violation). */
export interface Failed<T> {
  readonly status: "failed";
  readonly error: string;
  readonly provenance: Provenance;
  readonly value: null;
}

export function available<T>(value: T, provenance: Provenance): Available<T> {
  return { status: "available", value, provenance };
}

export function unknown<T>(reason: string, provenance: Provenance): Unknown<T> {
  return { status: "unknown", reason, provenance, value: null };
}

export function unavailable<T>(reason: string, provenance: Provenance): Unavailable<T> {
  return { status: "unavailable", reason, provenance, value: null };
}

export function failed<T>(error: string, provenance: Provenance): Failed<T> {
  return { status: "failed", error, provenance, value: null };
}

/** Type guard helpers. */
export function isAvailable<T>(a: Availability<T>): a is Available<T> {
  return a.status === "available";
}
export function isUnknown<T>(a: Availability<T>): a is Unknown<T> {
  return a.status === "unknown";
}
export function isUnavailable<T>(a: Availability<T>): a is Unavailable<T> {
  return a.status === "unavailable";
}
export function isFailed<T>(a: Availability<T>): a is Failed<T> {
  return a.status === "failed";
}

/**
 * Map over an Availability without collapsing failure states. A non-available
 * state is propagated unchanged — this is the single lawful way to transform a
 * value while preserving truthfulness.
 */
export function mapAvailability<T, U>(a: Availability<T>, fn: (value: T) => U): Availability<U> {
  if (a.status === "available") {
    return available(fn(a.value), a.provenance);
  }
  if (a.status === "unknown") return unknown(a.reason, a.provenance);
  if (a.status === "unavailable") return unavailable(a.reason, a.provenance);
  return failed(a.error, a.provenance);
}

/**
 * Fold an Availability into a scalar. Forces the caller to acknowledge each
 * truthful branch — preventing silent defaulting to "empty".
 */
export function foldAvailability<T, R>(a: Availability<T>, folder: {
  available: (value: T, provenance: Provenance) => R;
  unknown: (reason: string, provenance: Provenance) => R;
  unavailable: (reason: string, provenance: Provenance) => R;
  failed: (error: string, provenance: Provenance) => R;
}): R {
  switch (a.status) {
    case "available":
      return folder.available(a.value, a.provenance);
    case "unknown":
      return folder.unknown(a.reason, a.provenance);
    case "unavailable":
      return folder.unavailable(a.reason, a.provenance);
    case "failed":
      return folder.failed(a.error, a.provenance);
  }
}
