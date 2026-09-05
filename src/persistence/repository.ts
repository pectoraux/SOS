/**
 * SOS persistence / API boundary.
 *
 * Defines the repository contracts through which the rest of SOS accesses the
 * mission/value/context/autonomy/decision models. This is the "persistence/API
 * boundary" named in the W1 goal. All reads return an `Availability` so that
 * unknown / unavailable / failed states are never conflated with empty results
 * (criterion 8, R21).
 *
 * The boundary is intentionally a contract (interface) so that:
 *   - W2+ can depend on a stable programmatic API;
 *   - the in-memory implementation (`in-memory-store.ts`) enforces the frozen
 *     invariants (mission subordination, anti-silent-rewrite, traceability) at
 *     the boundary, not just in the domain constructors.
 */

import type { Availability } from "../core/availability.js";
import type { Version } from "../core/version.js";
import type { MissionId, ValueModelId, ContextId, AutonomyPolicyId, DecisionId, AuthorityId, RevisionId, ConstitutionId } from "../core/identifiers.js";
import type { Mission } from "../mission/mission.js";
import type { MissionRevision } from "../mission/mission-revision.js";
import type { ValueModel } from "../value-model/value-model.js";
import type { Context } from "../context/context.js";
import type { AutonomyPolicy } from "../autonomy/autonomy-policy.js";
import type { Decision } from "../decisions/decision.js";
import type { Authority } from "../core/authority.js";

export interface SosStore {
  // --- constitution / authority registry ---
  registerConstitution(id: ConstitutionId): Promise<Availability<ConstitutionId>>;
  registerAuthority(authority: Authority): Promise<Availability<Authority>>;

  // --- mission ---
  saveMission(mission: Mission): Promise<Availability<Mission>>;
  loadMission(id: MissionId, version?: Version): Promise<Availability<Mission>>;
  loadLatestMission(id: MissionId): Promise<Availability<Mission>>;
  listMissions(): Promise<Availability<readonly Mission[]>>;
  missionHistory(id: MissionId): Promise<Availability<readonly MissionRevision[]>>;

  // --- mission revision (explicit proposal/approval; anti-silent-rewrite gate) ---
  proposeMissionRevision(revision: MissionRevision): Promise<Availability<MissionRevision>>;
  approveMissionRevision(revId: RevisionId, approver: AuthorityId, approverCanApproveMission: boolean): Promise<Availability<MissionRevision>>;

  // --- value model (subordinate to mission) ---
  saveValueModel(vm: ValueModel): Promise<Availability<ValueModel>>;
  loadValueModel(id: ValueModelId, version?: Version): Promise<Availability<ValueModel>>;
  listValueModels(missionRef: MissionId): Promise<Availability<readonly ValueModel[]>>;

  // --- context ---
  saveContext(ctx: Context): Promise<Availability<Context>>;
  loadContext(id: ContextId): Promise<Availability<Context>>;
  listContexts(missionRef: MissionId): Promise<Availability<readonly Context[]>>;

  // --- autonomy policy ---
  saveAutonomyPolicy(policy: AutonomyPolicy): Promise<Availability<AutonomyPolicy>>;
  loadAutonomyPolicy(id: AutonomyPolicyId): Promise<Availability<AutonomyPolicy>>;

  // --- decision ---
  saveDecision(decision: Decision): Promise<Availability<Decision>>;
  loadDecision(id: DecisionId): Promise<Availability<Decision>>;
  listDecisions(missionRef: MissionId): Promise<Availability<readonly Decision[]>>;
}

/**
 * Sentinel constitution identifier used to seed a fresh store. A real
 * constitution is read-only in W1 (frozen); the store only needs its identity
 * to validate traceability references.
 */
export const BOOTSTRAP_CONSTITUTION_ID = "constitution:sos-v1" as unknown as ConstitutionId;
