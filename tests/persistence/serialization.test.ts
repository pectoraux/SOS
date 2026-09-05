import { describe, it, expect } from "bun:test";
import {
  stringify,
  parse,
  deepEqual,
} from "../../src/persistence/serialization.js";
import {
  validateMission,
  validateValueModel,
  validateContext,
  validateAutonomyPolicy,
  validateDecision,
} from "../../src/persistence/validators.js";
import {
  buildMission,
  buildValueModel,
  buildContext,
  buildAutonomyPolicy,
  buildDecision,
} from "../helpers.js";
import { isAvailable, isFailed, isUnknown } from "../../src/core/availability.js";

const TS = "2025-06-01T00:00:00.000Z";

describe("Serialization — canonical round-trips (W1 verification)", () => {
  it("Mission round-trips losslessly", () => {
    const m = buildMission();
    const json = stringify(m);
    const result = parse(json, validateMission, TS);
    expect(isAvailable(result)).toBe(true);
    if (isAvailable(result)) {
      expect(deepEqual(result.value, m)).toBe(true);
    }
  });

  it("ValueModel round-trips losslessly", () => {
    const vm = buildValueModel();
    const json = stringify(vm);
    const result = parse(json, validateValueModel, TS);
    expect(isAvailable(result)).toBe(true);
    if (isAvailable(result)) expect(deepEqual(result.value, vm)).toBe(true);
  });

  it("Context round-trips losslessly", () => {
    const ctx = buildContext();
    const json = stringify(ctx);
    const result = parse(json, validateContext, TS);
    expect(isAvailable(result)).toBe(true);
    if (isAvailable(result)) expect(deepEqual(result.value, ctx)).toBe(true);
  });

  it("AutonomyPolicy round-trips losslessly", () => {
    const p = buildAutonomyPolicy();
    const json = stringify(p);
    const result = parse(json, validateAutonomyPolicy, TS);
    expect(isAvailable(result)).toBe(true);
    if (isAvailable(result)) expect(deepEqual(result.value, p)).toBe(true);
  });

  it("Decision round-trips losslessly (including ASK payload)", () => {
    const d = buildDecision("ASK");
    const json = stringify(d);
    const result = parse(json, validateDecision, TS);
    expect(isAvailable(result)).toBe(true);
    if (isAvailable(result)) expect(deepEqual(result.value, d)).toBe(true);
  });

  it("canonical stringification is stable (same record → same bytes)", () => {
    const m = buildMission();
    expect(stringify(m)).toBe(stringify(JSON.parse(stringify(m))));
  });
});

describe("Serialization — failed-read conflation negative tests (R21, criterion 8)", () => {
  it("malformed JSON yields a failed Availability, never an empty success", () => {
    const result = parse("{ not valid json", validateMission, TS);
    expect(isFailed(result)).toBe(true);
    expect(result.value).toBeNull();
  });

  it("structurally invalid JSON yields a failed Availability (validation-error)", () => {
    const result = parse(JSON.stringify({ id: "m:1", version: "1.0.0" }), validateMission, TS);
    expect(isFailed(result)).toBe(true);
  });

  it("a null/undefined input yields unknown, not a phantom available", () => {
    expect(isUnknown(parse(null as unknown as string, validateMission, TS))).toBe(true);
  });

  it("a Mission missing required fields yields failed (never silently coerced)", () => {
    const broken = { ...buildMission(), statement: "" };
    const result = parse(JSON.stringify(broken), validateMission, TS);
    // Empty string is structurally present but the validator rejects non-empty requirement via asNonEmptyString.
    expect(isFailed(result)).toBe(true);
  });

  it("an AskPayload with fewer than two alternatives yields failed", () => {
    const d = buildDecision("ASK");
    const broken = {
      ...d,
      askPayload: { ...d.askPayload, alternatives: [d.askPayload!.alternatives[0]] },
    };
    const result = parse(JSON.stringify(broken), validateDecision, TS);
    expect(isFailed(result)).toBe(true);
  });
});
