/**
 * In-memory SOS store — enforces the frozen invariants at the persistence
 * boundary. This is the reference implementation of `SosStore`.
 *
 * Boundary invariants enforced here (in addition to domain constructors):
 *   1. Anti-silent-rewrite: a superseding Mission version MUST carry an approved
 *      revision in its change history; a telemetry-triggered revision MUST have
 *      a non-null human approver before any Mission version built on it is
 *      accepted. (W1 criterion 2, R3, constitution Mission-protection.)
 *   2. Subordination: a ValueModel MUST reference an existing, APPROVED Mission;
 *      business model never outranks mission/constitution. (W1 criterion 3.)
 *   3. Context MUST reference an existing Mission. (W1 criterion 4.)
 *   4. Every record's traceability.constitutionRef/authorityRef must resolve to
 *      registered authorities. (W1 criterion 9.)
 *   5. Decision ASK↔askPayload pairing is re-checked defensively, and the
 *      decision's missionRef/autonomyPolicyRef must resolve. (W1 criteria 6–7.)
 *
 * All reads return an `Availability`; nothing throws across the boundary.
 */

import type { SosStore } from "./repository.js";
import { BOOTSTRAP_CONSTITUTION_ID } from "./repository.js";
import type { Availability } from "../core/availability.js";
import { available, failed, unknown, unavailable } from "../core/availability.js";
import { provenance } from "../core/provenance.js";
import type { Version } from "../core/version.js";
import { versionToString, isLaterVersion } from "../core/version.js";
import type { AuthorityId, ConstitutionId, MissionId, ValueModelId, ContextId, AutonomyPolicyId, DecisionId, RevisionId } from "../core/identifiers.js";
import type { Mission } from "../mission/mission.js";
import type { MissionRevision } from "../mission/mission-revision.js";
import { approveMissionRevision } from "../mission/mission-revision.js";
import type { ValueModel } from "../value-model/value-model.js";
import type { Context } from "../context/context.js";
import type { AutonomyPolicy } from "../autonomy/autonomy-policy.js";
import type { Decision } from "../decisions/decision.js";
import type { Authority } from "../core/authority.js";

const NOW = () => new Date().toISOString();

interface MissionRecord {
  readonly versions: Map<string, Mission>; // version string → mission
  latestVersion: Version | null;
}

export class InMemorySosStore implements SosStore {
  private readonly constitutions = new Set<ConstitutionId>();
  private readonly authorities = new Map<AuthorityId, Authority>();
  private readonly missions = new Map<MissionId, MissionRecord>();
  private readonly revisions = new Map<RevisionId, MissionRevision>();
  private readonly valueModels = new Map<ValueModelId, Map<string, ValueModel>>();
  private readonly contexts = new Map<ContextId, Context>();
  private readonly autonomyPolicies = new Map<AutonomyPolicyId, AutonomyPolicy>();
  private readonly decisions = new Map<DecisionId, Decision>();

  constructor() {
    this.constitutions.add(BOOTSTRAP_CONSTITUTION_ID);
  }

  // --- constitution / authority -----------------------------------------

  async registerConstitution(id: ConstitutionId): Promise<Availability<ConstitutionId>> {
    this.constitutions.add(id);
    return available(id, provenance("system", NOW()));
  }

  async registerAuthority(authority: Authority): Promise<Availability<Authority>> {
    this.authorities.set(authority.id, authority);
    return available(authority, provenance("system", NOW()));
  }

  private resolveAuthority(id: AuthorityId): Authority | null {
    return this.authorities.get(id) ?? null;
  }

  // --- mission -----------------------------------------------------------

  async saveMission(mission: Mission): Promise<Availability<Mission>> {
    const p = provenance("approved-revision", mission.createdAt, null);
    if (!this.constitutions.has(mission.constitutionRef)) {
      return failed<Mission>(`unknown constitution ${mission.constitutionRef as string}`, p);
    }
    if (!this.resolveAuthority(mission.authority)) {
      return failed<Mission>(`unknown authority ${mission.authority as string}`, p);
    }
    if (mission.traceability.authorityRef !== mission.authority && !this.resolveAuthority(mission.traceability.authorityRef)) {
      return failed<Mission>("traceability.authorityRef not registered", p);
    }

    // Anti-silent-rewrite gate: a superseding mission version must be enacted
    // via an approved revision. A telemetry-triggered revision requires an
    // explicit human approver.
    if (mission.parentVersion !== null) {
      const lastRevision = mission.changeHistory[mission.changeHistory.length - 1];
      if (!lastRevision) {
        return failed<Mission>(
          "superseding mission version must record the revision that enacted it",
          p,
        );
      }
      if (lastRevision.toVersion !== mission.version || lastRevision.fromVersion !== mission.parentVersion) {
        return failed<Mission>("changeHistory does not enact parentVersion→version", p);
      }
      if (lastRevision.status !== "approved") {
        return failed<Mission>(
          "mission supersession requires an approved revision (bare proposal rejected)",
          p,
        );
      }
      if (lastRevision.triggeredBy === "telemetry-proposal" && lastRevision.approvedBy === null) {
        return failed<Mission>(
          "telemetry-proposed mission revision lacks a human approver (silent rewrite blocked)",
          p,
        );
      }
    }

    let rec = this.missions.get(mission.id);
    if (!rec) {
      rec = { versions: new Map(), latestVersion: null };
      this.missions.set(mission.id, rec);
    }
    // Refuse to regress: a lower version cannot overwrite a higher latest.
    if (rec.latestVersion !== null && !isLaterVersion(mission.version, rec.latestVersion)) {
      return failed<Mission>(
        `mission version ${versionToString(mission.version)} does not advance latest ${versionToString(rec.latestVersion)}`,
        p,
      );
    }
    rec.versions.set(versionToString(mission.version), mission);
    rec.latestVersion = mission.version;
    return available(mission, p);
  }

  async loadMission(id: MissionId, version?: Version): Promise<Availability<Mission>> {
    const p = provenance("derived", NOW(), null);
    const rec = this.missions.get(id);
    if (!rec) return unknown<Mission>(`mission ${id as string} not found`, p);
    if (version) {
      const m = rec.versions.get(versionToString(version));
      if (!m) return unavailable<Mission>(`mission ${id as string} v${versionToString(version)} not stored`, p);
      return available(m, p);
    }
    if (!rec.latestVersion) return unknown<Mission>(`mission ${id as string} has no versions`, p);
    const m = rec.versions.get(versionToString(rec.latestVersion));
    return m ? available(m, p) : failed<Mission>("latest version pointer is stale", p);
  }

  async loadLatestMission(id: MissionId): Promise<Availability<Mission>> {
    return this.loadMission(id);
  }

  async listMissions(): Promise<Availability<readonly Mission[]>> {
    const p = provenance("derived", NOW(), null);
    const out: Mission[] = [];
    for (const rec of this.missions.values()) {
      if (rec.latestVersion) {
        const m = rec.versions.get(versionToString(rec.latestVersion));
        if (m) out.push(m);
      }
    }
    return available(out, p);
  }

  async missionHistory(id: MissionId): Promise<Availability<readonly MissionRevision[]>> {
    const p = provenance("derived", NOW(), null);
    const rec = this.missions.get(id);
    if (!rec) return unknown<readonly MissionRevision[]>(`mission ${id as string} not found`, p);
    const all: MissionRevision[] = [];
    for (const m of rec.versions.values()) {
      all.push(...m.changeHistory);
    }
    all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return available(all, p);
  }

  // --- mission revision --------------------------------------------------

  async proposeMissionRevision(revision: MissionRevision): Promise<Availability<MissionRevision>> {
    const p = provenance("telemetry-proposal", revision.createdAt, null);
    this.revisions.set(revision.id, revision);
    return available(revision, p);
  }

  async approveMissionRevision(
    revId: RevisionId,
    approver: AuthorityId,
    approverCanApproveMission: boolean,
  ): Promise<Availability<MissionRevision>> {
    const p = provenance("approved-revision", NOW(), null);
    const existing = this.revisions.get(revId);
    if (!existing) return unknown<MissionRevision>(`revision ${revId as string} not found`, p);
    if (!approverCanApproveMission) {
      return failed<MissionRevision>(
        `approver ${approver as string} lacks mission-revision authority`,
        p,
      );
    }
    try {
      const approved = approveMissionRevision(existing, approver, approverCanApproveMission);
      this.revisions.set(revId, approved);
      return available(approved, p);
    } catch (e) {
      return failed<MissionRevision>((e as Error).message, p);
    }
  }

  // --- value model -------------------------------------------------------

  async saveValueModel(vm: ValueModel): Promise<Availability<ValueModel>> {
    const p = provenance("approved-revision", vm.createdAt, null);
    if (!this.constitutions.has(vm.constitutionRef)) {
      return failed<ValueModel>("unknown constitution", p);
    }
    // Subordination: the value model must serve an existing, APPROVED mission.
    const missionResult = await this.loadMission(vm.missionRef);
    if (missionResult.status !== "available") {
      return failed<ValueModel>(
        `value model references unknown mission ${vm.missionRef as string}`,
        p,
      );
    }
    if (missionResult.value.status !== "approved" && missionResult.value.status !== "superseded") {
      return failed<ValueModel>(
        `value model cannot be saved against a non-approved mission (status=${missionResult.value.status})`,
        p,
      );
    }
    let versions = this.valueModels.get(vm.id);
    if (!versions) {
      versions = new Map();
      this.valueModels.set(vm.id, versions);
    }
    versions.set(versionToString(vm.version), vm);
    return available(vm, p);
  }

  async loadValueModel(id: ValueModelId, version?: Version): Promise<Availability<ValueModel>> {
    const p = provenance("derived", NOW(), null);
    const versions = this.valueModels.get(id);
    if (!versions) return unknown<ValueModel>(`value model ${id as string} not found`, p);
    if (version) {
      const v = versions.get(versionToString(version));
      return v ? available(v, p) : unavailable<ValueModel>("version not stored", p);
    }
    // latest = highest version
    let best: ValueModel | null = null;
    for (const v of versions.values()) {
      if (best === null || isLaterVersion(v.version, best.version)) best = v;
    }
    return best ? available(best, p) : unknown<ValueModel>("no versions", p);
  }

  async listValueModels(missionRef: MissionId): Promise<Availability<readonly ValueModel[]>> {
    const p = provenance("derived", NOW(), null);
    const out: ValueModel[] = [];
    for (const versions of this.valueModels.values()) {
      let best: ValueModel | null = null;
      for (const v of versions.values()) {
        if (best === null || isLaterVersion(v.version, best.version)) best = v;
      }
      if (best && (best.missionRef as string) === (missionRef as string)) out.push(best);
    }
    return available(out, p);
  }

  // --- context -----------------------------------------------------------

  async saveContext(ctx: Context): Promise<Availability<Context>> {
    const p = provenance("approved-revision", ctx.createdAt, null);
    const missionResult = await this.loadMission(ctx.missionRef);
    if (missionResult.status !== "available") {
      return failed<Context>(`context references unknown mission`, p);
    }
    this.contexts.set(ctx.id, ctx);
    return available(ctx, p);
  }

  async loadContext(id: ContextId): Promise<Availability<Context>> {
    const p = provenance("derived", NOW(), null);
    const c = this.contexts.get(id);
    if (!c) return unknown<Context>(`context ${id as string} not found`, p);
    return available(c, p);
  }

  async listContexts(missionRef: MissionId): Promise<Availability<readonly Context[]>> {
    const p = provenance("derived", NOW(), null);
    const out: Context[] = [];
    for (const c of this.contexts.values()) {
      if ((c.missionRef as string) === (missionRef as string)) out.push(c);
    }
    return available(out, p);
  }

  // --- autonomy policy ---------------------------------------------------

  async saveAutonomyPolicy(policy: AutonomyPolicy): Promise<Availability<AutonomyPolicy>> {
    const p = provenance("system", policy.createdAt, null);
    if (!this.constitutions.has(policy.constitutionRef)) {
      return failed<AutonomyPolicy>("unknown constitution", p);
    }
    this.autonomyPolicies.set(policy.id, policy);
    return available(policy, p);
  }

  async loadAutonomyPolicy(id: AutonomyPolicyId): Promise<Availability<AutonomyPolicy>> {
    const p = provenance("derived", NOW(), null);
    const pol = this.autonomyPolicies.get(id);
    return pol ? available(pol, p) : unknown<AutonomyPolicy>(`autonomy policy ${id as string} not found`, p);
  }

  // --- decision ----------------------------------------------------------

  async saveDecision(decision: Decision): Promise<Availability<Decision>> {
    const p = provenance("approved-revision", decision.createdAt, null);
    const missionResult = await this.loadMission(decision.missionRef);
    if (missionResult.status !== "available") {
      return failed<Decision>(`decision references unknown mission`, p);
    }
    if (!this.autonomyPolicies.has(decision.autonomyPolicyRef)) {
      return failed<Decision>(`decision references unknown autonomy policy`, p);
    }
    // Defensive re-check of the ASK↔payload pairing (criterion 6 & 7).
    if (decision.action === "ASK" && decision.askPayload === null) {
      return failed<Decision>("ASK decision missing askPayload", p);
    }
    if (decision.action !== "ASK" && decision.askPayload !== null) {
      return failed<Decision>(`non-ASK decision (${decision.action}) carries an askPayload`, p);
    }
    this.decisions.set(decision.id, decision);
    return available(decision, p);
  }

  async loadDecision(id: DecisionId): Promise<Availability<Decision>> {
    const p = provenance("derived", NOW(), null);
    const d = this.decisions.get(id);
    return d ? available(d, p) : unknown<Decision>(`decision ${id as string} not found`, p);
  }

  async listDecisions(missionRef: MissionId): Promise<Availability<readonly Decision[]>> {
    const p = provenance("derived", NOW(), null);
    const out: Decision[] = [];
    for (const d of this.decisions.values()) {
      if ((d.missionRef as string) === (missionRef as string)) out.push(d);
    }
    return available(out, p);
  }
}
