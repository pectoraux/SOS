/**
 * Structural validators — turn untyped parsed JSON into typed SOS records or
 * throw. Used by `serialization.parse`, which converts any thrown error into a
 * `failed` Availability (preserving the failed/unknown distinction).
 */

import type { Mission, Goal, Outcome, Stakeholder, Measure, Assumption, Ambiguity } from "../mission/mission.js";
import type { MissionRevision } from "../mission/mission-revision.js";
import type { FormalizationState, FieldCompleteness, MissionField } from "../mission/formalization-state.js";
import type { ValueModel, BusinessModel, Objective, Budget, Incentive, Opportunity } from "../value-model/value-model.js";
import type { Context, UserOrCohort, Platform, Device, Environment, Workload, Geography, TimeContext, RegulatoryContext, PlatformSurface } from "../context/context.js";
import type { AutonomyPolicy, AutonomyRule, AutonomyThreshold, ActionClass } from "../autonomy/autonomy-policy.js";
import type { Decision } from "../decisions/decision.js";
import type { AskPayload, Alternative, Tradeoff, EvidenceQuality, UncertaintySummary } from "../decisions/ask-payload.js";
import type { Confidence, Calibration, UncertaintyClass, RiskLevel, BlastRadius, Reversibility } from "../core/confidence.js";
import type { Constraint, ConstraintBound, ConstraintKind } from "../core/constraints.js";
import type { Traceability, TraceabilityOrigin } from "../core/traceability.js";
import type { Provenance, ProvenanceKind } from "../core/provenance.js";
import type { Version } from "../core/version.js";

import { parseVersion } from "../core/version.js";
import {
  constitutionId, missionId, valueModelId, contextId, autonomyPolicyId, decisionId,
  authorityId, constraintId, revisionId,
} from "../core/identifiers.js";

// --- primitives -----------------------------------------------------------

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`${field}: expected string`);
  return v;
}
function asNonEmptyString(v: unknown, field: string): string {
  const s = asString(v, field);
  if (s.length === 0) throw new Error(`${field}: empty string`);
  return s;
}
function asNumber(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${field}: expected finite number`);
  return v;
}
function asBool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new Error(`${field}: expected boolean`);
  return v;
}
function asArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${field}: expected array`);
  return v;
}
function asObject(v: unknown, field: string): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${field}: expected object`);
  }
  return v as Record<string, unknown>;
}
function asOpt<T>(v: unknown, fn: (v: unknown, f: string) => T, field: string): T | null {
  if (v === null || v === undefined) return null;
  return fn(v, field);
}
function asReadonlyArray<T>(v: unknown, fn: (v: unknown, f: string) => T, field: string): readonly T[] {
  return asArray(v, field).map((item, i) => fn(item, `${field}[${i}]`));
}
function asRecord(v: unknown, field: string): Record<string, unknown> {
  const o = asObject(v, field);
  return o;
}

function asEnum<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  const s = asString(v, field);
  if (!allowed.includes(s as T)) throw new Error(`${field}: invalid enum "${s}"`);
  return s as T;
}

// --- core validators ------------------------------------------------------

export function validateVersion(v: unknown): Version {
  const o = asObject(v, "version");
  return parseVersion(`${asNumber(o.major, "version.major")}.${asNumber(o.minor, "version.minor")}.${asNumber(o.patch, "version.patch")}`);
}

export function validateProvenance(v: unknown): Provenance {
  const o = asObject(v, "provenance");
  const kind = asEnum<ProvenanceKind>(o.kind, ["user-input", "approved-revision", "telemetry-proposal", "derived", "external", "system"], "provenance.kind");
  const observedAt = asNonEmptyString(o.observedAt, "provenance.observedAt");
  const sourceRevision = asOpt(o.sourceRevision, asString, "provenance.sourceRevision");
  const revisionRef = asOpt(o.revisionRef, asString, "provenance.revisionRef");
  return {
    kind,
    observedAt,
    sourceRevision,
    revisionRef: revisionRef === null ? null : revisionId(revisionRef),
  };
}

export function validateTraceability(v: unknown): Traceability {
  const o = asObject(v, "traceability");
  const origin = asEnum<TraceabilityOrigin>(o.origin, ["user-formalization", "approved-revision", "derived-from-value-model", "context-derivation", "autonomy-configuration", "system-bootstrap"], "traceability.origin");
  const authorityRef = authorityId(asNonEmptyString(o.authorityRef, "traceability.authorityRef"));
  const constitutionRef = constitutionId(asNonEmptyString(o.constitutionRef, "traceability.constitutionRef"));
  const missionRef = asOpt(o.missionRef, asString, "traceability.missionRef");
  const valueModelRef = asOpt(o.valueModelRef, asString, "traceability.valueModelRef");
  return {
    origin,
    authorityRef,
    constitutionRef,
    missionRef: missionRef === null ? null : missionId(missionRef),
    valueModelRef: valueModelRef === null ? null : valueModelId(valueModelRef),
  };
}

function validateConstraintBound(v: unknown): ConstraintBound {
  const o = asObject(v, "constraint.bound");
  const op = asEnum<ConstraintBound["op"]>(o.op, ["<", "<=", "==", ">=", ">"], "constraint.bound.op");
  return { op, value: asNumber(o.value, "constraint.bound.value"), unit: asNonEmptyString(o.unit, "constraint.bound.unit") };
}

export function validateConstraint(v: unknown): Constraint {
  const o = asObject(v, "constraint");
  const kind = asEnum<ConstraintKind>(o.kind, ["hard", "soft", "risk", "preference"], "constraint.kind");
  const id = constraintId(asNonEmptyString(o.id, "constraint.id"));
  const description = asNonEmptyString(o.description, "constraint.description");
  const subject = asNonEmptyString(o.subject, "constraint.subject");
  const bound = asOpt(o.bound, validateConstraintBound, "constraint.bound");
  if (bound === null) return { id, kind, description, subject };
  return { id, kind, description, subject, bound };
}

function validateCalibration(v: unknown): Calibration {
  const o = asObject(v, "confidence.calibration");
  return { sampleSize: asNumber(o.sampleSize, "confidence.calibration.sampleSize"), observedAccuracy: asNumber(o.observedAccuracy, "confidence.calibration.observedAccuracy") };
}

export function validateConfidence(v: unknown): Confidence {
  const o = asObject(v, "confidence");
  const kind = asEnum<"calibrated" | "qualitative">(o.kind, ["calibrated", "qualitative"], "confidence.kind");
  if (kind === "calibrated") {
    return { kind, probability: asNumber(o.probability, "confidence.probability"), calibration: validateCalibration(o.calibration) };
  }
  const cls = asEnum<UncertaintyClass>(o.class, ["low", "moderate", "high", "severe"], "confidence.class");
  return { kind, class: cls, rationale: asNonEmptyString(o.rationale, "confidence.rationale") };
}

// --- mission validators ---------------------------------------------------

function validateGoal(v: unknown): Goal {
  const o = asObject(v, "goal");
  return { id: asNonEmptyString(o.id, "goal.id"), statement: asNonEmptyString(o.statement, "goal.statement") };
}
function validateOutcome(v: unknown): Outcome {
  const o = asObject(v, "outcome");
  const base = { id: asNonEmptyString(o.id, "outcome.id"), description: asNonEmptyString(o.description, "outcome.description") };
  const t = asOpt(o.target, asString, "outcome.target");
  return t === null ? base : { ...base, target: t };
}
function validateStakeholder(v: unknown): Stakeholder {
  const o = asObject(v, "stakeholder");
  return { id: asNonEmptyString(o.id, "stakeholder.id"), name: asNonEmptyString(o.name, "stakeholder.name"), interest: asNonEmptyString(o.interest, "stakeholder.interest") };
}
function validateMeasure(v: unknown): Measure {
  const o = asObject(v, "measure");
  return { id: asNonEmptyString(o.id, "measure.id"), name: asNonEmptyString(o.name, "measure.name"), definition: asNonEmptyString(o.definition, "measure.definition") };
}
function validateAssumption(v: unknown): Assumption {
  const o = asObject(v, "assumption");
  const status = asEnum<Assumption["status"]>(o.status, ["open", "invalidated"], "assumption.status");
  return { id: asNonEmptyString(o.id, "assumption.id"), statement: asNonEmptyString(o.statement, "assumption.statement"), status };
}
function validateAmbiguity(v: unknown): Ambiguity {
  const o = asObject(v, "ambiguity");
  const base = { id: asNonEmptyString(o.id, "ambiguity.id"), statement: asNonEmptyString(o.statement, "ambiguity.statement") };
  const r = asOpt(o.resolution, asString, "ambiguity.resolution");
  return r === null ? base : { ...base, resolution: r };
}

function validateFormalization(v: unknown): FormalizationState {
  const o = asObject(v, "formalization");
  const stage = asEnum<FormalizationState["stage"]>(o.stage, ["raw", "structured", "validated", "frozen"], "formalization.stage");
  const collaborativelyFormalized = asBool(o.collaborativelyFormalized, "formalization.collaborativelyFormalized");
  const co = asObject(o.completeness, "formalization.completeness");
  const fields: MissionField[] = ["statement", "goals", "desiredOutcomes", "stakeholders", "measures", "assumptions", "ambiguities"];
  const completeness = {} as Record<MissionField, FieldCompleteness>;
  for (const f of fields) {
    completeness[f] = asEnum<FieldCompleteness>(co[f], ["missing", "partial", "complete"], `formalization.completeness.${f}`);
  }
  return { stage, collaborativelyFormalized, completeness };
}

function validateMissionRevision(v: unknown): MissionRevision {
  const o = asObject(v, "missionRevision");
  const id = revisionId(asNonEmptyString(o.id, "missionRevision.id"));
  const fromVersion = validateVersion(o.fromVersion);
  const toVersion = validateVersion(o.toVersion);
  const status = asEnum<MissionRevision["status"]>(o.status, ["proposal", "approved", "rejected"], "missionRevision.status");
  const proposedBy = authorityId(asNonEmptyString(o.proposedBy, "missionRevision.proposedBy"));
  const approvedBy = asOpt(o.approvedBy, asString, "missionRevision.approvedBy");
  const triggeredBy = asEnum<MissionRevision["triggeredBy"]>(o.triggeredBy, ["user", "telemetry-proposal", "value-model-change"], "missionRevision.triggeredBy");
  const rationale = asNonEmptyString(o.rationale, "missionRevision.rationale");
  const createdAt = asNonEmptyString(o.createdAt, "missionRevision.createdAt");
  return {
    id, fromVersion, toVersion, status, proposedBy,
    approvedBy: approvedBy === null ? null : authorityId(approvedBy),
    triggeredBy, rationale, createdAt,
  };
}

export function validateMission(v: unknown): Mission {
  const o = asObject(v, "mission");
  return {
    id: missionId(asNonEmptyString(o.id, "mission.id")),
    version: validateVersion(o.version),
    authority: authorityId(asNonEmptyString(o.authority, "mission.authority")),
    constitutionRef: constitutionId(asNonEmptyString(o.constitutionRef, "mission.constitutionRef")),
    statement: asNonEmptyString(o.statement, "mission.statement"),
    goals: asReadonlyArray(o.goals, validateGoal, "mission.goals"),
    desiredOutcomes: asReadonlyArray(o.desiredOutcomes, validateOutcome, "mission.desiredOutcomes"),
    stakeholders: asReadonlyArray(o.stakeholders, validateStakeholder, "mission.stakeholders"),
    measures: asReadonlyArray(o.measures, validateMeasure, "mission.measures"),
    assumptions: asReadonlyArray(o.assumptions, validateAssumption, "mission.assumptions"),
    ambiguities: asReadonlyArray(o.ambiguities, validateAmbiguity, "mission.ambiguities"),
    status: asEnum<Mission["status"]>(o.status, ["draft", "proposed", "approved", "superseded"], "mission.status"),
    formalization: validateFormalization(o.formalization),
    parentVersion: asOpt(o.parentVersion, validateVersion, "mission.parentVersion"),
    changeHistory: asReadonlyArray(o.changeHistory, validateMissionRevision, "mission.changeHistory"),
    traceability: validateTraceability(o.traceability),
    createdAt: asNonEmptyString(o.createdAt, "mission.createdAt"),
  };
}

// --- value model ----------------------------------------------------------

function validateBusinessModel(v: unknown): BusinessModel {
  const o = asObject(v, "valueModel.businessModel");
  return {
    summary: asNonEmptyString(o.summary, "valueModel.businessModel.summary"),
    revenueStreams: asReadonlyArray(o.revenueStreams, asString, "valueModel.businessModel.revenueStreams"),
    costDrivers: asReadonlyArray(o.costDrivers, asString, "valueModel.businessModel.costDrivers"),
  };
}
function validateObjective(v: unknown): Objective {
  const o = asObject(v, "objective");
  const base = { id: asNonEmptyString(o.id, "objective.id"), description: asNonEmptyString(o.description, "objective.description"), direction: asEnum<Objective["direction"]>(o.direction, ["maximize", "minimize", "maintain"], "objective.direction") };
  const m = asOpt(o.measureRef, asString, "objective.measureRef");
  return m === null ? base : { ...base, measureRef: m };
}
function validateBudget(v: unknown): Budget {
  const o = asObject(v, "budget");
  return { id: asNonEmptyString(o.id, "budget.id"), category: asNonEmptyString(o.category, "budget.category"), limit: asNumber(o.limit, "budget.limit"), unit: asNonEmptyString(o.unit, "budget.unit"), period: asNonEmptyString(o.period, "budget.period") };
}
function validateIncentive(v: unknown): Incentive {
  const o = asObject(v, "incentive");
  return { id: asNonEmptyString(o.id, "incentive.id"), description: asNonEmptyString(o.description, "incentive.description"), target: asNonEmptyString(o.target, "incentive.target"), alignment: asEnum<Incentive["alignment"]>(o.alignment, ["aligned", "misaligned"], "incentive.alignment") };
}
function validateOpportunity(v: unknown): Opportunity {
  const o = asObject(v, "opportunity");
  return { id: asNonEmptyString(o.id, "opportunity.id"), description: asNonEmptyString(o.description, "opportunity.description"), estimatedUplift: asNonEmptyString(o.estimatedUplift, "opportunity.estimatedUplift") };
}

export function validateValueModel(v: unknown): ValueModel {
  const o = asObject(v, "valueModel");
  return {
    id: valueModelId(asNonEmptyString(o.id, "valueModel.id")),
    version: validateVersion(o.version),
    missionRef: missionId(asNonEmptyString(o.missionRef, "valueModel.missionRef")),
    constitutionRef: constitutionId(asNonEmptyString(o.constitutionRef, "valueModel.constitutionRef")),
    businessModel: validateBusinessModel(o.businessModel),
    economicObjectives: asReadonlyArray(o.economicObjectives, validateObjective, "valueModel.economicObjectives"),
    budgets: asReadonlyArray(o.budgets, validateBudget, "valueModel.budgets"),
    incentives: asReadonlyArray(o.incentives, validateIncentive, "valueModel.incentives"),
    opportunities: asReadonlyArray(o.opportunities, validateOpportunity, "valueModel.opportunities"),
    constraints: asReadonlyArray(o.constraints, validateConstraint, "valueModel.constraints"),
    status: asEnum<ValueModel["status"]>(o.status, ["draft", "proposed", "approved", "superseded"], "valueModel.status"),
    parentVersion: asOpt(o.parentVersion, validateVersion, "valueModel.parentVersion"),
    traceability: validateTraceability(o.traceability),
    createdAt: asNonEmptyString(o.createdAt, "valueModel.createdAt"),
  };
}

// --- context --------------------------------------------------------------

function validateUserOrCohort(v: unknown): UserOrCohort {
  const o = asObject(v, "context.userOrCohort");
  const kind = asEnum<UserOrCohort["kind"]>(o.kind, ["user", "cohort"], "context.userOrCohort.kind");
  const identifier = asNonEmptyString(o.identifier, "context.userOrCohort.identifier");
  const attributes = asOpt(o.attributes, (x) => {
    const rec = asObject(x, "context.userOrCohort.attributes");
    const out: Record<string, string> = {};
    for (const k of Object.keys(rec)) out[k] = asString(rec[k], `context.userOrCohort.attributes.${k}`);
    return out as Readonly<Record<string, string>>;
  }, "context.userOrCohort.attributes");
  return attributes === null ? { kind, identifier } : { kind, identifier, attributes };
}
function validatePlatform(v: unknown): Platform {
  const o = asObject(v, "context.platform");
  const surface = asEnum<PlatformSurface>(o.surface, ["web", "mobile", "desktop", "tv", "cross-platform", "wearable", "api", "edge", "cloud", "other"], "context.platform.surface");
  const name = asOpt(o.name, asString, "context.platform.name");
  const version = asOpt(o.version, asString, "context.platform.version");
  const base = { surface } as Platform;
  if (name !== null && version !== null) return { ...base, name, version };
  if (name !== null) return { ...base, name };
  if (version !== null) return { ...base, version };
  return base;
}
function validateDevice(v: unknown): Device {
  const o = asObject(v, "context.device");
  return { model: asNonEmptyString(o.model, "context.device.model"), formFactor: asEnum<Device["formFactor"]>(o.formFactor, ["phone", "tablet", "laptop", "desktop", "tv", "wearable", "server", "embedded", "other"], "context.device.formFactor") };
}
function validateEnvironment(v: unknown): Environment {
  const o = asObject(v, "context.environment");
  return { name: asNonEmptyString(o.name, "context.environment.name"), tier: asEnum<Environment["tier"]>(o.tier, ["development", "staging", "production", "experiment", "sandbox"], "context.environment.tier") };
}
function validateWorkload(v: unknown): Workload {
  const o = asObject(v, "context.workload");
  return { profile: asNonEmptyString(o.profile, "context.workload.profile"), intensity: asEnum<Workload["intensity"]>(o.intensity, ["idle", "normal", "peak", "burst"], "context.workload.intensity") };
}
function validateGeography(v: unknown): Geography {
  const o = asObject(v, "context.geography");
  const region = asNonEmptyString(o.region, "context.geography.region");
  const country = asOpt(o.country, asString, "context.geography.country");
  return country === null ? { region } : { region, country };
}
function validateTimeContext(v: unknown): TimeContext {
  const o = asObject(v, "context.time");
  return { epochMs: asNumber(o.epochMs, "context.time.epochMs"), timezone: asNonEmptyString(o.timezone, "context.time.timezone") };
}
function validateRegulatoryContext(v: unknown): RegulatoryContext {
  const o = asObject(v, "context.regulatoryContext");
  return { jurisdictions: asReadonlyArray(o.jurisdictions, asString, "context.regulatoryContext.jurisdictions"), constraints: asReadonlyArray(o.constraints, asString, "context.regulatoryContext.constraints") };
}

export function validateContext(v: unknown): Context {
  const o = asObject(v, "context");
  const attributes = asOpt(o.attributes, (x) => asObject(x, "context.attributes") as Record<string, unknown>, "context.attributes");
  return {
    id: contextId(asNonEmptyString(o.id, "context.id")),
    missionRef: missionId(asNonEmptyString(o.missionRef, "context.missionRef")),
    constitutionRef: constitutionId(asNonEmptyString(o.constitutionRef, "context.constitutionRef")),
    userOrCohort: asOpt(o.userOrCohort, validateUserOrCohort, "context.userOrCohort"),
    platform: asOpt(o.platform, validatePlatform, "context.platform"),
    device: asOpt(o.device, validateDevice, "context.device"),
    environment: validateEnvironment(o.environment),
    workload: asOpt(o.workload, validateWorkload, "context.workload"),
    geography: asOpt(o.geography, validateGeography, "context.geography"),
    time: asOpt(o.time, validateTimeContext, "context.time"),
    regulatoryContext: asOpt(o.regulatoryContext, validateRegulatoryContext, "context.regulatoryContext"),
    attributes: attributes === null ? {} : attributes,
    traceability: validateTraceability(o.traceability),
    createdAt: asNonEmptyString(o.createdAt, "context.createdAt"),
  };
}

// --- autonomy + decision --------------------------------------------------

function validateAutonomyThreshold(v: unknown): AutonomyThreshold {
  const o = asObject(v, "autonomyThreshold");
  return {
    minConfidence: asNumber(o.minConfidence, "autonomyThreshold.minConfidence"),
    maxRisk: asEnum<RiskLevel>(o.maxRisk, ["negligible", "low", "medium", "high", "critical"], "autonomyThreshold.maxRisk"),
    maxBlastRadius: asEnum<BlastRadius>(o.maxBlastRadius, ["none", "limited", "service", "system", "organization"], "autonomyThreshold.maxBlastRadius"),
    maxReversibility: asEnum<Reversibility>(o.maxReversibility, ["reversible", "difficult", "irreversible"], "autonomyThreshold.maxReversibility"),
  };
}
function validateAutonomyRule(v: unknown): AutonomyRule {
  const o = asObject(v, "autonomyRule");
  const actionClass = asEnum<ActionClass>(o.actionClass, ["config-change", "deploy", "experiment", "rollback", "mission-revision", "value-model-approval", "architecture-mutation"], "autonomyRule.actionClass");
  const environment = asOpt(o.environment, asString, "autonomyRule.environment");
  const threshold = validateAutonomyThreshold(o.threshold);
  const requiresHumanApproval = asBool(o.requiresHumanApproval, "autonomyRule.requiresHumanApproval");
  const base = { actionClass, threshold, requiresHumanApproval } as AutonomyRule;
  return environment === null ? base : { ...base, environment };
}

export function validateAutonomyPolicy(v: unknown): AutonomyPolicy {
  const o = asObject(v, "autonomyPolicy");
  return {
    id: autonomyPolicyId(asNonEmptyString(o.id, "autonomyPolicy.id")),
    version: validateVersion(o.version),
    constitutionRef: constitutionId(asNonEmptyString(o.constitutionRef, "autonomyPolicy.constitutionRef")),
    defaultThreshold: validateAutonomyThreshold(o.defaultThreshold),
    rules: asReadonlyArray(o.rules, validateAutonomyRule, "autonomyPolicy.rules"),
    traceability: validateTraceability(o.traceability),
    createdAt: asNonEmptyString(o.createdAt, "autonomyPolicy.createdAt"),
  };
}

function validateTradeoff(v: unknown): Tradeoff {
  const o = asObject(v, "tradeoff");
  return { dimension: asNonEmptyString(o.dimension, "tradeoff.dimension"), direction: asEnum<Tradeoff["direction"]>(o.direction, ["positive", "negative", "neutral"], "tradeoff.direction"), note: asNonEmptyString(o.note, "tradeoff.note") };
}
function validateAlternative(v: unknown): Alternative {
  const o = asObject(v, "alternative");
  return { id: asNonEmptyString(o.id, "alternative.id"), label: asNonEmptyString(o.label, "alternative.label"), expectedOutcome: asNonEmptyString(o.expectedOutcome, "alternative.expectedOutcome"), tradeoffs: asReadonlyArray(o.tradeoffs, validateTradeoff, "alternative.tradeoffs") };
}
function validateUncertaintySummary(v: unknown): UncertaintySummary {
  const o = asObject(v, "uncertainty");
  return { class: asEnum<UncertaintyClass>(o.class, ["low", "moderate", "high", "severe"], "uncertainty.class"), rationale: asNonEmptyString(o.rationale, "uncertainty.rationale"), basis: asEnum<UncertaintySummary["basis"]>(o.basis, ["calibrated", "qualitative"], "uncertainty.basis") };
}

export function validateAskPayload(v: unknown): AskPayload {
  const o = asObject(v, "askPayload");
  const alternatives = asReadonlyArray(o.alternatives, validateAlternative, "askPayload.alternatives");
  // Preserve the domain invariant on deserialization: an ASK must present at
  // least two real alternatives (R16). A malformed payload with fewer must
  // deserialize to a `failed` Availability, never a phantom success.
  if (alternatives.length < 2) {
    throw new Error("askPayload.alternatives: an ASK must present at least two alternatives");
  }
  return {
    decisionNeeded: asNonEmptyString(o.decisionNeeded, "askPayload.decisionNeeded"),
    alternatives,
    evidenceQuality: asEnum<EvidenceQuality>(o.evidenceQuality, ["none", "observational", "intervention", "mixed"], "askPayload.evidenceQuality"),
    uncertainty: validateUncertaintySummary(o.uncertainty),
    tradeoffs: asReadonlyArray(o.tradeoffs, validateTradeoff, "askPayload.tradeoffs"),
    noResponseFallback: asEnum<AskPayload["noResponseFallback"]>(o.noResponseFallback, ["gather-evidence", "experiment", "no-action", "escalate"], "askPayload.noResponseFallback"),
  };
}

export function validateDecision(v: unknown): Decision {
  const o = asObject(v, "decision");
  const action = asEnum<Decision["action"]>(o.action, ["ACT", "EXPERIMENT", "GATHER_EVIDENCE", "ASK", "REJECT", "ROLLBACK"], "decision.action");
  const askPayload = asOpt(o.askPayload, validateAskPayload, "decision.askPayload");
  const candidateRef = asOpt(o.candidateRef, asString, "decision.candidateRef");
  // Preserve the ASK↔askPayload pairing invariant on deserialization (R16).
  if (action === "ASK" && askPayload === null) {
    throw new Error("decision: an ASK decision MUST carry an askPayload");
  }
  if (action !== "ASK" && askPayload !== null) {
    throw new Error(`decision: a non-ASK decision (${action}) MUST NOT carry an askPayload`);
  }
  return {
    id: decisionId(asNonEmptyString(o.id, "decision.id")),
    version: validateVersion(o.version),
    constitutionRef: constitutionId(asNonEmptyString(o.constitutionRef, "decision.constitutionRef")),
    missionRef: missionId(asNonEmptyString(o.missionRef, "decision.missionRef")),
    action,
    rationale: asNonEmptyString(o.rationale, "decision.rationale"),
    authorityRef: authorityId(asNonEmptyString(o.authorityRef, "decision.authorityRef")),
    confidence: validateConfidence(o.confidence),
    risk: asEnum<RiskLevel>(o.risk, ["negligible", "low", "medium", "high", "critical"], "decision.risk"),
    evidenceRefs: asReadonlyArray(o.evidenceRefs, asString, "decision.evidenceRefs"),
    autonomyPolicyRef: autonomyPolicyId(asNonEmptyString(o.autonomyPolicyRef, "decision.autonomyPolicyRef")),
    askPayload,
    candidateRef,
    traceability: validateTraceability(o.traceability),
    createdAt: asNonEmptyString(o.createdAt, "decision.createdAt"),
  };
}
