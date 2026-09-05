import { describe, it, expect } from "bun:test";
import { version } from "../../src/core/version.js";
import { buildValueModel, MISSION_ID, OWNER_AUTHORITY_ID, CONSTITUTION } from "../helpers.js";
import { makeValueModel, approveValueModel } from "../../src/value-model/value-model.js";
import { traceability } from "../../src/core/traceability.js";
import { missionId } from "../../src/core/identifiers.js";

describe("ValueModel — business-derived typed records (W1 criterion 3, R4)", () => {
  it("derives typed objectives, budgets, incentives, opportunities and constraints", () => {
    const vm = buildValueModel();
    expect(vm.businessModel.summary.length).toBeGreaterThan(0);
    expect(vm.economicObjectives.length).toBeGreaterThan(0);
    expect(vm.budgets.length).toBeGreaterThan(0);
    expect(vm.incentives.length).toBeGreaterThan(0);
    expect(vm.opportunities.length).toBeGreaterThan(0);
    expect(vm.constraints.length).toBeGreaterThan(0);
    expect(vm.constraints.some((c) => c.kind === "hard")).toBe(true);
    expect(vm.constraints.some((c) => c.kind === "preference")).toBe(true);
  });

  it("references the owning mission (subordination, traceability)", () => {
    const vm = buildValueModel();
    expect(vm.missionRef).toBe(MISSION_ID);
    expect(vm.traceability.missionRef).toBe(MISSION_ID);
    expect(vm.traceability.constitutionRef).toBe(CONSTITUTION);
  });

  it("cannot be constructed with a traceability.missionRef that disagrees with missionRef (cannot outrank)", () => {
    expect(() =>
      makeValueModel({
        version: version(1, 0, 0),
        missionRef: MISSION_ID,
        constitutionRef: CONSTITUTION,
        businessModel: { summary: "x", revenueStreams: [], costDrivers: [] },
        traceability: traceability({
          constitutionRef: CONSTITUTION,
          missionRef: missionId("m:other"),
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "derived-from-value-model",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("cannot be constructed with a mismatched constitution ref", () => {
    expect(() =>
      makeValueModel({
        version: version(1, 0, 0),
        missionRef: MISSION_ID,
        constitutionRef: CONSTITUTION,
        businessModel: { summary: "x", revenueStreams: [], costDrivers: [] },
        traceability: traceability({
          constitutionRef: missionId("constitution:other") as unknown as typeof CONSTITUTION,
          missionRef: MISSION_ID,
          authorityRef: OWNER_AUTHORITY_ID,
          origin: "derived-from-value-model",
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("approval is an explicit step (proposal != approval)", () => {
    const vm = buildValueModel();
    expect(vm.status).toBe("draft");
    const approved = approveValueModel(vm);
    expect(approved.status).toBe("approved");
  });
});
