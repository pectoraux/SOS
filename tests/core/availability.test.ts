import { describe, it, expect } from "bun:test";
import {
  available,
  unknown,
  unavailable,
  failed,
  isAvailable,
  isUnknown,
  isUnavailable,
  isFailed,
  mapAvailability,
  foldAvailability,
} from "../../src/core/availability.js";
import { provenance } from "../../src/core/provenance.js";

const p = () => provenance("derived", "2025-01-01T00:00:00.000Z", null);

describe("Availability — truthful-state algebra (W1 criterion 8, R21)", () => {
  it("keeps available/unknown/unavailable/failed as distinct discriminated states", () => {
    const a = available(42, p());
    const u = unknown<string>("no data", p());
    const un = unavailable<string>("source offline", p());
    const f = failed<string>("parse error", p());

    expect(a.status).toBe("available");
    expect(u.status).toBe("unknown");
    expect(un.status).toBe("unavailable");
    expect(f.status).toBe("failed");

    expect(isAvailable(a)).toBe(true);
    expect(isUnknown(u)).toBe(true);
    expect(isUnavailable(un)).toBe(true);
    expect(isFailed(f)).toBe(true);

    // Cross-guards: each state is NOT the others.
    expect(isAvailable(u)).toBe(false);
    expect(isUnknown(f)).toBe(false);
    expect(isUnavailable(a)).toBe(false);
    expect(isFailed(un)).toBe(false);
  });

  it("non-available states carry null value (never a phantom successful value)", () => {
    const u = unknown<string>("no data", p());
    const un = unavailable<string>("offline", p());
    const f = failed<string>("err", p());
    expect(u.value).toBeNull();
    expect(un.value).toBeNull();
    expect(f.value).toBeNull();
  });

  it("mapAvailability propagates non-available states unchanged (no silent conflation)", () => {
    const ok = available(2, p());
    const mappedOk = mapAvailability(ok, (n) => n * 10);
    expect(isAvailable(mappedOk) && mappedOk.value).toBe(20);

    const failedRead = failed<number>("read failed", p());
    const mappedFailed = mapAvailability(failedRead, (n) => n * 10);
    // A failed read MUST NOT become a successful value through mapping.
    expect(isFailed(mappedFailed)).toBe(true);
    expect(mappedFailed.value).toBeNull();

    const unknownRead = unknown<number>("unknown", p());
    const mappedUnknown = mapAvailability(unknownRead, (n) => n * 10);
    expect(isUnknown(mappedUnknown)).toBe(true);
  });

  it("foldAvailability forces every branch to be handled (no default-to-empty)", () => {
    const states = [
      available("x", p()),
      unknown<string>("no data", p()),
      unavailable<string>("offline", p()),
      failed<string>("err", p()),
    ];
    const labels = states.map((s) =>
      foldAvailability(s, {
        available: () => "OK",
        unknown: () => "UNKNOWN",
        unavailable: () => "UNAVAILABLE",
        failed: () => "FAILED",
      }),
    );
    expect(labels).toEqual(["OK", "UNKNOWN", "UNAVAILABLE", "FAILED"]);
  });
});
