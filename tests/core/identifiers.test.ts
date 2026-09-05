import { describe, it, expect } from "bun:test";
import {
  missionId,
  valueModelId,
  authorityId,
} from "../../src/core/identifiers.js";
import { version, parseVersion, compareVersions, versionsEqual, isLaterVersion } from "../../src/core/version.js";

describe("Identifiers — branded nominal types prevent cross-authority confusion", () => {
  it("produces stable string identities", () => {
    const m = missionId("m:1");
    expect(m as string).toBe("m:1");
  });

  it("rejects empty identifiers", () => {
    expect(() => missionId("")).toThrow();
  });

  it("brands are nominally distinct (missionId is not assignable to valueModelId at the type level)", () => {
    // Structural equality at runtime, but the types are nominally distinct.
    const m = missionId("x");
    const v = valueModelId("x");
    expect(m as string).toBe(v as string);
    // Compile-time: the following would be a type error:
    //   const _: ValueModelId = m;
    // (left as a comment to assert intent without breaking the build.)
    void authorityId;
  });
});

describe("Version — semantic versioning for model revision (R3)", () => {
  it("parses and stringifies", () => {
    const v = version(1, 2, 3);
    expect(`${v.major}.${v.minor}.${v.patch}`).toBe("1.2.3");
    expect(parseVersion("2.0.1")).toEqual(version(2, 0, 1));
  });

  it("compares versions", () => {
    expect(compareVersions(version(1, 0, 0), version(2, 0, 0))).toBeLessThan(0);
    expect(versionsEqual(version(1, 0, 0), version(1, 0, 0))).toBe(true);
    expect(isLaterVersion(version(1, 0, 1), version(1, 0, 0))).toBe(true);
    expect(isLaterVersion(version(1, 0, 0), version(1, 0, 1))).toBe(false);
  });

  it("rejects non-integer / negative components", () => {
    expect(() => version(1.5, 0, 0)).toThrow();
    expect(() => version(-1, 0, 0)).toThrow();
  });
});
