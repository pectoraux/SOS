/**
 * Serialization — canonical JSON (de)serialization with truthful round-trips.
 *
 * Implements the W1 verification requirement ("serialization/deserialization
 * round trips") and the failed-read conflation negative test: a malformed or
 * schema-invalid payload MUST deserialize to a `failed` Availability, NEVER to
 * an empty/successful value (R21, architecture invariant §13.6, criterion 8).
 *
 * `parse` never throws — it returns an Availability so callers cannot silently
 * conflate a thrown error with "no data".
 */

import type { Availability } from "../core/availability.js";
import { available, failed, unknown } from "../core/availability.js";
import { provenance } from "../core/provenance.js";

/** Canonical, deterministically-keyed JSON string (stable key order). */
export function stringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = sortKeys(obj[k]);
  }
  return out;
}

export type Validator<T> = (value: unknown) => T;

/**
 * Parse and validate JSON. Never throws.
 *  - malformed JSON       → failed
 *  - structurally invalid → failed
 *  - valid + present      → available
 *  - null/undefined input → unknown
 */
export function parse<T>(json: string, validate: Validator<T>, observedAt: string): Availability<T> {
  const p = provenance("derived", observedAt, null);
  if (json === null || json === undefined) {
    return unknown<T>("no input provided", p);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return failed<T>(`json-parse-error: ${(e as Error).message}`, p);
  }
  if (raw === null || raw === undefined) {
    return unknown<T>("parsed value was null/undefined", p);
  }
  try {
    return available(validate(raw), p);
  } catch (e) {
    return failed<T>(`validation-error: ${(e as Error).message}`, p);
  }
}

/** Structural deep equality for round-trip verification. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const ka = Object.keys(oa).sort();
  const kb = Object.keys(ob).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && deepEqual(oa[k], ob[k]));
}
