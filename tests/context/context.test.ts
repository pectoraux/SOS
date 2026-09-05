import { describe, it, expect } from "bun:test";
import { buildContext, MISSION_ID, CONSTITUTION, OWNER_AUTHORITY_ID } from "../helpers.js";
import { makeContext } from "../../src/context/context.js";
import { traceability } from "../../src/core/traceability.js";

describe("Context — multi-dimensional, extensible (W1 criterion 4, R5)", () => {
  it("distinguishes user/cohort, platform, device, environment, workload, geography, time, regulatory", () => {
    const ctx = buildContext();
    expect(ctx.userOrCohort?.kind).toBe("cohort");
    expect(ctx.platform?.surface).toBe("web");
    expect(ctx.device?.formFactor).toBe("desktop");
    expect(ctx.environment.tier).toBe("production");
    expect(ctx.workload?.intensity).toBe("peak");
    expect(ctx.geography?.country).toBe("IE");
    expect(ctx.time?.timezone).toBe("Europe/Dublin");
    expect(ctx.regulatoryContext?.jurisdictions).toContain("EU");
  });

  it("is extensible via attributes (the open extension seam)", () => {
    const ctx = buildContext();
    expect(ctx.attributes.customFlag).toBe(true);
    expect((ctx.attributes as Record<string, unknown>).customTier).toBe("pro");
  });

  it("null dimensions are lawful and remain distinguishable (truthful null != empty success)", () => {
    const minimal = makeContext({
      missionRef: MISSION_ID,
      constitutionRef: CONSTITUTION,
      environment: { name: "dev", tier: "development" },
      traceability: traceability({
        constitutionRef: CONSTITUTION,
        missionRef: MISSION_ID,
        authorityRef: OWNER_AUTHORITY_ID,
        origin: "context-derivation",
      }),
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(minimal.userOrCohort).toBeNull();
    expect(minimal.platform).toBeNull();
    expect(minimal.device).toBeNull();
    expect(minimal.workload).toBeNull();
    expect(minimal.geography).toBeNull();
    expect(minimal.time).toBeNull();
    expect(minimal.regulatoryContext).toBeNull();
    expect(minimal.environment.name).toBe("dev");
  });

  it("rejects an empty environment name", () => {
    expect(() =>
      makeContext({
        missionRef: MISSION_ID,
        constitutionRef: CONSTITUTION,
        environment: { name: " ", tier: "production" },
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: MISSION_ID,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "context-derivation",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
