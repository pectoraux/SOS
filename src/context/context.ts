/**
 * Context — the conditions under which a mission realization is chosen.
 *
 * Implements spec/architecture.md §3.4, R5, and W1 acceptance criterion 4
 * ("Context is extensible and can distinguish user/cohort/device/platform/
 * environment dimensions"). Per §7, contextual realization is always
 * subordinate to the global mission and hard constraints; Context is a
 * selector, never an authority that can redefine mission semantics.
 */

import type { ContextId, ConstitutionId, MissionId } from "../core/identifiers.js";
import { contextId } from "../core/identifiers.js";
import type { Traceability } from "../core/traceability.js";

export interface UserOrCohort {
  readonly kind: "user" | "cohort";
  readonly identifier: string;
  readonly attributes?: Readonly<Record<string, string>> | undefined;
}

export type PlatformSurface =
  | "web"
  | "mobile"
  | "desktop"
  | "tv"
  | "cross-platform"
  | "wearable"
  | "api"
  | "edge"
  | "cloud"
  | "other";

export interface Platform {
  readonly surface: PlatformSurface;
  readonly name?: string | undefined;
  readonly version?: string | undefined;
}

export interface Device {
  readonly model: string;
  readonly formFactor: "phone" | "tablet" | "laptop" | "desktop" | "tv" | "wearable" | "server" | "embedded" | "other";
}

export interface Environment {
  readonly name: string;
  readonly tier: "development" | "staging" | "production" | "experiment" | "sandbox";
}

export interface Workload {
  readonly profile: string;
  readonly intensity: "idle" | "normal" | "peak" | "burst";
}

export interface Geography {
  readonly region: string;
  readonly country?: string | undefined;
}

export interface TimeContext {
  readonly epochMs: number;
  readonly timezone: string;
}

export interface RegulatoryContext {
  readonly jurisdictions: readonly string[];
  readonly constraints: readonly string[];
}

export interface Context {
  readonly id: ContextId;
  readonly missionRef: MissionId;
  readonly constitutionRef: ConstitutionId;
  readonly userOrCohort: UserOrCohort | null;
  readonly platform: Platform | null;
  readonly device: Device | null;
  readonly environment: Environment;
  readonly workload: Workload | null;
  readonly geography: Geography | null;
  readonly time: TimeContext | null;
  readonly regulatoryContext: RegulatoryContext | null;
  /** Extensible attributes — the open extension seam (criterion 4). */
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly traceability: Traceability;
  readonly createdAt: string;
}

export function makeContext(input: {
  id?: string;
  missionRef: MissionId;
  constitutionRef: ConstitutionId;
  environment: Environment;
  userOrCohort?: UserOrCohort | null;
  platform?: Platform | null;
  device?: Device | null;
  workload?: Workload | null;
  geography?: Geography | null;
  time?: TimeContext | null;
  regulatoryContext?: RegulatoryContext | null;
  attributes?: Readonly<Record<string, unknown>>;
  traceability: Traceability;
  createdAt: string;
}): Context {
  if (input.environment.name.trim().length === 0) {
    throw new Error("SOS: context.environment.name must be non-empty");
  }
  if (input.time !== null && input.time !== undefined) {
    if (!Number.isFinite(input.time.epochMs)) {
      throw new Error("SOS: context.time.epochMs must be finite");
    }
  }
  return {
    id: input.id ? contextId(input.id) : contextId(`ctx:${input.createdAt}`),
    missionRef: input.missionRef,
    constitutionRef: input.constitutionRef,
    userOrCohort: input.userOrCohort ?? null,
    platform: input.platform ?? null,
    device: input.device ?? null,
    environment: input.environment,
    workload: input.workload ?? null,
    geography: input.geography ?? null,
    time: input.time ?? null,
    regulatoryContext: input.regulatoryContext ?? null,
    attributes: input.attributes ?? {},
    traceability: input.traceability,
    createdAt: input.createdAt,
  };
}
