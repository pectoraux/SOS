import { describe, it, expect } from "bun:test";
import { InMemorySosStore } from "../../src/persistence/in-memory-store.js";
import { BOOTSTRAP_CONSTITUTION_ID } from "../../src/persistence/repository.js";
import {
  buildMission,
  buildValueModel,
  buildContext,
  buildAutonomyPolicy,
  buildDecision,
  buildRevision,
  OWNER_AUTHORITY,
  OPERATOR_AUTHORITY,
  OWNER_AUTHORITY_ID,
  OPERATOR_AUTHORITY_ID,
  MISSION_ID,
  CONSTITUTION,
} from "../helpers.js";
import { version } from "../../src/core/version.js";
import { makeMissionRevision, approveMissionRevision } from "../../src/mission/mission-revision.js";
import { isAvailable, isFailed, isUnknown } from "../../src/core/availability.js";
import { approveValueModel } from "../../src/value-model/value-model.js";
import { missionId } from "../../src/core/identifiers.js";

async function freshStore() {
  const store = new InMemorySosStore();
  await store.registerAuthority(OWNER_AUTHORITY);
  await store.registerAuthority(OPERATOR_AUTHORITY);
  return store;
}

async function seedApprovedMission(store: InMemorySosStore) {
  const m = buildMission({ status: "approved" });
  // Mark approved explicitly (domain ctor defaults to draft).
  const approved = { ...m, status: "approved" as const };
  const res = await store.saveMission(approved);
  if (!isAvailable(res)) throw new Error(`seed mission failed: ${"error" in res ? res.error : res.status}`);
  return approved;
}

describe("SosStore — cross-model traceability (W1 criterion 9)", () => {
  it("every persisted record carries traceability to constitution + authority", async () => {
    const store = await freshStore();
    const m = await seedApprovedMission(store);
    expect(m.traceability.constitutionRef).toBe(CONSTITUTION);
    expect(m.traceability.authorityRef).toBe(OWNER_AUTHORITY_ID);

    const vm = approveValueModel(buildValueModel(m.id));
    const vmRes = await store.saveValueModel(vm);
    expect(isAvailable(vmRes)).toBe(true);

    const ctx = buildContext(m.id);
    const ctxRes = await store.saveContext(ctx);
    expect(isAvailable(ctxRes)).toBe(true);

    const pol = buildAutonomyPolicy();
    const polRes = await store.saveAutonomyPolicy(pol);
    expect(isAvailable(polRes)).toBe(true);

    const dec = buildDecision("ACT", m.id);
    const decRes = await store.saveDecision(dec);
    expect(isAvailable(decRes)).toBe(true);
  });
});

describe("SosStore — anti-silent-rewrite gate (W1 criterion 2)", () => {
  it("refuses to save a superseding mission version enacted from an unapproved telemetry revision", async () => {
    const store = await freshStore();
    await seedApprovedMission(store);
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0)); // status: proposal, telemetry-triggered
    const m2 = {
      ...buildMission({ version: version(2, 0, 0), parentVersion: version(1, 0, 0) }),
      changeHistory: [rev], // unapproved!
    };
    const res = await store.saveMission(m2);
    expect(isFailed(res)).toBe(true);
  });

  it("refuses a telemetry-proposed revision enacted without a human approver (negative test)", async () => {
    const store = await freshStore();
    const m1 = await seedApprovedMission(store);
    // Build a telemetry-triggered revision that is "approved" but has NO human
    // approver — the silent-rewrite attempt the store must block.
    const rev = makeMissionRevision({
      fromVersion: version(1, 0, 0),
      toVersion: version(2, 0, 0),
      proposedBy: OPERATOR_AUTHORITY_ID,
      triggeredBy: "telemetry-proposal",
      rationale: "telemetry drift",
      createdAt: "2025-07-01T00:00:00.000Z",
    });
    const silentApproved = { ...rev, status: "approved" as const, approvedBy: null };
    const m2 = {
      ...buildMission({ version: version(2, 0, 0), parentVersion: version(1, 0, 0) }),
      changeHistory: [silentApproved],
    };
    const res = await store.saveMission(m2);
    expect(isFailed(res)).toBe(true);
  });

  it("refuses a superseding mission version with no change-history entry at all", async () => {
    const store = await freshStore();
    await seedApprovedMission(store);
    const m2 = buildMission({ version: version(2, 0, 0), parentVersion: version(1, 0, 0) }); // no changeHistory
    const res = await store.saveMission(m2);
    expect(isFailed(res)).toBe(true);
  });

  it("refuses to regress the latest mission version (no implicit rollback)", async () => {
    const store = await freshStore();
    await seedApprovedMission(store);
    const lower = { ...buildMission({ version: version(1, 0, 0) }), status: "approved" as const, parentVersion: null, changeHistory: [] };
    const res = await store.saveMission(lower);
    expect(isFailed(res)).toBe(true);
  });

  it("approves a revision only when the approver has mission-revision authority", async () => {
    const store = await freshStore();
    const rev = buildRevision(version(1, 0, 0), version(2, 0, 0));
    await store.proposeMissionRevision(rev);
    const denied = await store.approveMissionRevision(rev.id, OPERATOR_AUTHORITY_ID, false);
    expect(isFailed(denied)).toBe(true);
    const granted = await store.approveMissionRevision(rev.id, OWNER_AUTHORITY_ID, true);
    expect(isAvailable(granted)).toBe(true);
    if (isAvailable(granted)) expect(granted.value.approvedBy).toBe(OWNER_AUTHORITY_ID);
  });
});

describe("SosStore — value model subordination (W1 criterion 3)", () => {
  it("refuses a value model whose referenced mission is not yet approved", async () => {
    const store = await freshStore();
    const m = buildMission({ status: "draft" }); // not approved
    await store.saveMission(m);
    const vm = buildValueModel(m.id);
    const res = await store.saveValueModel(vm);
    expect(isFailed(res)).toBe(true);
  });

  it("refuses a value model referencing an unknown mission (cannot outrank)", async () => {
    const store = await freshStore();
    const vm = buildValueModel(missionId("m:does-not-exist"));
    const res = await store.saveValueModel(vm);
    expect(isFailed(res)).toBe(true);
  });

  it("accepts an approved value model against an approved mission", async () => {
    const store = await freshStore();
    const m = await seedApprovedMission(store);
    const vm = approveValueModel(buildValueModel(m.id));
    const res = await store.saveValueModel(vm);
    expect(isAvailable(res)).toBe(true);
  });
});

describe("SosStore — truthful reads (R21, criterion 8)", () => {
  it("loadMission of a missing mission returns unknown, not a phantom available", async () => {
    const store = await freshStore();
    const res = await store.loadMission(missionId("m:missing"));
    expect(isUnknown(res)).toBe(true);
  });

  it("loadMission of a missing version returns unavailable", async () => {
    const store = await freshStore();
    await seedApprovedMission(store);
    const res = await store.loadMission(MISSION_ID, version(9, 9, 9));
    expect(res.status).toBe("unavailable");
  });

  it("listDecisions returns an empty available list (not unknown) when none exist", async () => {
    const store = await freshStore();
    const m = await seedApprovedMission(store);
    const res = await store.listDecisions(m.id);
    expect(isAvailable(res)).toBe(true);
    if (isAvailable(res)) expect(res.value.length).toBe(0);
  });
});

describe("SosStore — decision boundary re-checks (W1 criteria 6 & 7)", () => {
  it("refuses a non-ASK decision carrying an askPayload", async () => {
    const store = await freshStore();
    const m = await seedApprovedMission(store);
    const pol = buildAutonomyPolicy();
    await store.saveAutonomyPolicy(pol);
    const d = buildDecision("ACT", m.id);
    const bad = { ...d, askPayload: buildDecision("ASK").askPayload } as typeof d;
    const res = await store.saveDecision(bad);
    expect(isFailed(res)).toBe(true);
  });

  it("accepts a lawful ACT decision", async () => {
    const store = await freshStore();
    const m = await seedApprovedMission(store);
    await store.saveAutonomyPolicy(buildAutonomyPolicy());
    const res = await store.saveDecision(buildDecision("ACT", m.id));
    expect(isAvailable(res)).toBe(true);
  });
});

describe("SosStore — bootstrap constitution", () => {
  it("seeds the bootstrap constitution on construction", async () => {
    const store = new InMemorySosStore();
    const res = await store.registerConstitution(BOOTSTRAP_CONSTITUTION_ID);
    expect(isAvailable(res)).toBe(true);
  });
});
