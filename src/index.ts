/**
 * SOS public API surface — W1: Mission / Value / Context Model.
 *
 * Exports the authoritative domain model, the autonomy/decision policy, and the
 * persistence/API boundary (`SosStore` + `InMemorySosStore`). Downstream Work
 * Orders (W2+) depend on this surface.
 */

// Core
export * from "./core/identifiers.js";
export * from "./core/version.js";
export * from "./core/provenance.js";
export * from "./core/availability.js";
export * from "./core/traceability.js";
export * from "./core/constraints.js";
export * from "./core/confidence.js";
export * from "./core/authority.js";

// Mission
export * from "./mission/formalization-state.js";
export * from "./mission/mission-revision.js";
export * from "./mission/mission.js";

// Value model
export * from "./value-model/value-model.js";

// Context
export * from "./context/context.js";

// Autonomy + decisions
export * from "./autonomy/autonomy-policy.js";
export * from "./decisions/ask-payload.js";
export * from "./decisions/decision.js";

// Persistence / API boundary
export * from "./persistence/serialization.js";
export * from "./persistence/validators.js";
export * from "./persistence/repository.js";
export { InMemorySosStore } from "./persistence/in-memory-store.js";
