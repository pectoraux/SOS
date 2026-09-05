/**
 * Shared test fixtures for W1 tests.
 *
 * Centralizes the construction of lawful, internally-consistent SOS records so
 * each test can focus on the invariant under examination. These builders do NOT
 * bypass domain constructors — they call them with valid inputs.
 */

import {
  authorityId,
  constitutionId,
  missionId,
  valueModelId,
  contextId,
  autonomyPolicyId,
  decisionId,
} from "../src/core/identifiers.js";
import { version } from "../src/core/version.js";
import { traceability } from "../src/core/traceability.js";
import { makeAuthority } from "../src/core/authority.js";
import { makeConstraint } from "../src/core/constraints.js";
import { calibratedConfidence, qualitativeConfidence } from "../src/core/confidence.js";
import { EMPTY_FORMALIZATION, advanceFormalization, deriveCompleteness } from "../src/mission/formalization-state.js";
import { makeMissionRevision } from "../src/mission/mission-revision.js";
import { makeMission } from "../src/mission/mission.js";
import { makeValueModel } from "../src/value-model/value-model.js";
import { makeContext } from "../src/context/context.js";
import { makeAutonomyPolicy } from "../src/autonomy/autonomy-policy.js";
import { makeDecision } from "../src/decisions/decision.js";
import { makeAskPayload } from "../src/decisions/ask-payload.js";
import type { Mission } from "../src/mission/mission.js";

export const CONSTITUTION = constitutionId("constitution:sos-v1");
export const OWNER_AUTHORITY_ID = authorityId("a:owner");
export const OPERATOR_AUTHORITY_ID = authorityId("a:operator");

export const OWNER_AUTHORITY = makeAuthority({
  id: "a:owner",
  principal: "owner@example.org",
  roles: ["owner"],
  canApproveMissionRevision: true,
  canApproveValueModel: true,
  canAuthorizeDecision: true,
});

export const OPERATOR_AUTHORITY = makeAuthority({
  id: "a:operator",
  principal: "operator@example.org",
  roles: ["operator"],
  canApproveMissionRevision: false,
  canApproveValueModel: false,
  canAuthorizeDecision: false,
});

export const MISSION_ID = missionId("m:sos-mission");
export const VALUE_MODEL_ID = valueModelId("v:sos-value");
export const CONTEXT_ID = contextId("ctx:prod-web");
export const AUTONOMY_POLICY_ID = autonomyPolicyId("ap:default");
export const DECISION_ID = decisionId("d:001");

export function buildMission(opts?: {
  version?: ReturnType<typeof version>;
  status?: Mission["status"];
  parentVersion?: ReturnType<typeof version> | null;
  changeHistory?: Mission["changeHistory"];
}): Mission {
  const v = opts?.version ?? version(1, 0, 0);
  return makeMission({
    id: "m:sos-mission",
    version: v,
    authority: OWNER_AUTHORITY_ID,
    constitutionRef: CONSTITUTION,
    statement: "Continuously improve the realization of an owner-approved mission.",
    goals: [
      { id: "g1", statement: "Reduce mission shortfall" },
      { id: "g2", statement: "Preserve safety invariants" },
    ],
    desiredOutcomes: [
      { id: "o1", description: "Fewer production regressions", target: "<1/month" },
      { id: "o2", description: "Stable rollout confidence" },
    ],
    stakeholders: [
      { id: "s1", name: "Owner", interest: "Mission success" },
      { id: "s2", name: "Users", interest: "Reliable experience" },
    ],
    measures: [
      { id: "m1", name: "Regression rate", definition: "Count of prod regressions per month" },
    ],
    assumptions: [{ id: "a1", statement: "Telemetry reflects real behavior", status: "open" }],
    ambiguities: [{ id: "amb1", statement: "Definition of 'regression' edge cases", resolution: "Deferred" }],
    formalization: advanceFormalization(EMPTY_FORMALIZATION, "validated", true),
    parentVersion: opts?.parentVersion ?? null,
    changeHistory: opts?.changeHistory ?? [],
    traceability: traceability({
      constitutionRef: CONSTITUTION,
      missionRef: null,
      authorityRef: OWNER_AUTHORITY_ID,
      origin: "user-formalization",
    }),
    createdAt: "2025-01-01T00:00:00.000Z",
  });
}

export function buildRevision(from: ReturnType<typeof version>, to: ReturnType<typeof version>) {
  return makeMissionRevision({
    fromVersion: from,
    toVersion: to,
    proposedBy: OPERATOR_AUTHORITY_ID,
    triggeredBy: "telemetry-proposal",
    rationale: "Telemetry suggests a refinement to mission scope",
    createdAt: "2025-02-01T00:00:00.000Z",
  });
}

export function buildValueModel(missionRef = MISSION_ID) {
  return makeValueModel({
    id: "v:sos-value",
    version: version(1, 0, 0),
    missionRef,
    constitutionRef: CONSTITUTION,
    businessModel: {
      summary: "Subscription platform with usage-based upside",
      revenueStreams: ["subscription", "usage-overage"],
      costDrivers: ["compute", "support"],
    },
    economicObjectives: [
      { id: "eo1", description: "Maximize net revenue", direction: "maximize", measureRef: "m1" },
    ],
    budgets: [{ id: "b1", category: "compute", limit: 10000, unit: "USD", period: "monthly" }],
    incentives: [{ id: "i1", description: "Growth bonus", target: "sales", alignment: "aligned" }],
    opportunities: [{ id: "op1", description: "Edge caching", estimatedUplift: "+8% latency win" }],
    constraints: [
      makeConstraint({ kind: "hard", description: "p99 latency <= 200ms", subject: "max-latency", bound: { op: "<=", value: 200, unit: "ms" } }),
      makeConstraint({ kind: "preference", description: "Prefer managed services", subject: "managed-services" }),
    ],
    traceability: traceability({
      constitutionRef: CONSTITUTION,
      missionRef,
      valueModelRef: null,
      authorityRef: OWNER_AUTHORITY_ID,
      origin: "derived-from-value-model",
    }),
    createdAt: "2025-01-02T00:00:00.000Z",
  });
}

export function buildContext(missionRef = MISSION_ID) {
  return makeContext({
    id: "ctx:prod-web",
    missionRef,
    constitutionRef: CONSTITUTION,
    environment: { name: "prod-eu", tier: "production" },
    userOrCohort: { kind: "cohort", identifier: "cohort:power-users", attributes: { tier: "pro" } },
    platform: { surface: "web", name: "next", version: "16" },
    device: { model: "browser", formFactor: "desktop" },
    workload: { profile: "api-heavy", intensity: "peak" },
    geography: { region: "eu-west", country: "IE" },
    time: { epochMs: 1735689600000, timezone: "Europe/Dublin" },
    regulatoryContext: { jurisdictions: ["EU"], constraints: ["GDPR"] },
    attributes: { customFlag: true, customTier: "pro" },
    traceability: traceability({
      constitutionRef: CONSTITUTION,
      missionRef,
      authorityRef: OWNER_AUTHORITY_ID,
      origin: "context-derivation",
    }),
    createdAt: "2025-01-03T00:00:00.000Z",
  });
}

export function buildAutonomyPolicy() {
  return makeAutonomyPolicy({
    id: "ap:default",
    version: version(1, 0, 0),
    constitutionRef: CONSTITUTION,
    defaultThreshold: {
      minConfidence: 0.8,
      maxRisk: "medium",
      maxBlastRadius: "service",
      maxReversibility: "reversible",
    },
    rules: [
      {
        actionClass: "deploy",
        environment: "production",
        threshold: {
          minConfidence: 0.9,
          maxRisk: "low",
          maxBlastRadius: "limited",
          maxReversibility: "reversible",
        },
        requiresHumanApproval: false,
      },
      {
        actionClass: "mission-revision",
        threshold: {
          minConfidence: 1.0,
          maxRisk: "negligible",
          maxBlastRadius: "none",
          maxReversibility: "reversible",
        },
        requiresHumanApproval: true,
      },
    ],
    traceability: traceability({
      constitutionRef: CONSTITUTION,
      missionRef: MISSION_ID,
      authorityRef: OWNER_AUTHORITY_ID,
      origin: "autonomy-configuration",
    }),
    createdAt: "2025-01-04T00:00:00.000Z",
  });
}

export function buildAskPayload() {
  return makeAskPayload({
    decisionNeeded: "Promote candidate C2 to canary in production?",
    alternatives: [
      {
        id: "alt1",
        label: "Promote to 5% canary",
        expectedOutcome: "Latency -8%, risk of 0.2% error spike",
        tradeoffs: [{ dimension: "latency", direction: "positive", note: "p99 improvement" }],
      },
      {
        id: "alt2",
        label: "Hold for more evidence",
        expectedOutcome: "No change; gather 2 more weeks of data",
        tradeoffs: [{ dimension: "velocity", direction: "negative", note: "delayed benefit" }],
      },
    ],
    evidenceQuality: "mixed",
    uncertainty: { class: "moderate", rationale: "Observational correlation only; no intervention evidence yet", basis: "qualitative" },
    tradeoffs: [{ dimension: "safety", direction: "negative", note: "canary error budget consumed" }],
    noResponseFallback: "gather-evidence",
  });
}

export function buildDecision(action: "ACT" | "ASK" = "ASK", missionRef = MISSION_ID) {
  return makeDecision({
    id: "d:001",
    version: version(1, 0, 0),
    constitutionRef: CONSTITUTION,
    missionRef,
    action,
    rationale: action === "ASK" ? "Authority insufficient for production promotion" : "Within granted autonomy",
    authorityRef: action === "ASK" ? OWNER_AUTHORITY_ID : OPERATOR_AUTHORITY_ID,
    confidence: action === "ASK" ? qualitativeConfidence("moderate", "Mixed evidence") : calibratedConfidence(0.92, { sampleSize: 40, observedAccuracy: 0.9 }),
    risk: action === "ASK" ? "high" : "low",
    evidenceRefs: ["ev:1", "ev:2"],
    autonomyPolicyRef: AUTONOMY_POLICY_ID,
    askPayload: action === "ASK" ? buildAskPayload() : null,
    traceability: traceability({
      constitutionRef: CONSTITUTION,
      missionRef,
      authorityRef: OWNER_AUTHORITY_ID,
      origin: "approved-revision",
    }),
    createdAt: "2025-01-05T00:00:00.000Z",
  });
}

// Expose deriveCompleteness for tests that assert formalization completeness.
export { deriveCompleteness };
