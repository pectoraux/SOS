# W1 — Mission / Value / Context Model — Implementation Evidence

**Work Order:** `spec/work-orders/W1-mission-value-context-model.md`
**Dispatch:** GitHub Issue #1 (`pectoraux/SOS`)
**Governing architecture:** `spec/architecture.md` §§3.1–3.4, 5–8
**Requirements:** R1–R5, R15–R18, R22–R23
**Lifecycle state:** `CHECKPOINTED` → `WAITING_FOR_ARCHITECT`

## Exact revisions

- **base SHA:** `5ab20436555e4e41679ef4137c07f938ad1a4353` (live `main`, verified against the GitHub `main` branch ref at dispatch time)
- **head SHA:** recorded in the PR description (the authoritative head is the PR `head.sha`; per `ARCHITECT-REVIEW-PROTOCOL.md` §2 the Architect verifies the actual PR head, not prose).
- **branch:** `w1/mission-value-context-model`
- **dependency proof:** W0 bootstrap commit `8158bc441025e6e815999deb965dd4b7adf989ac` is on `main` (ancestor of base SHA). No unmerged sibling is a dependency.

## Scope compliance

- Implemented the authoritative domain model + persistence/API boundary for Mission, Value Model, Context, autonomy policy and explicit `ASK` decisions only.
- Did NOT implement W2+ capabilities (architecture graph, runtime recovery, evidence/telemetry graph, candidate search, production experimentation).
- Did NOT modify any frozen artifact: `spec/constitution.md`, `spec/architecture.md`, `spec/architecture-lock.md`, `spec/requirements.md`, `spec/implementation-roadmap.md`, `spec/sos-meta-model.md`, `spec/development-state/*`, `AGENTS.md`, `ARCHITECT_START_HERE.md`.
- Did NOT merge, self-approve, or create successor work.

## Implementation surface

```
package.json, tsconfig.json, .gitignore
src/
  index.ts                      public API surface (barrel)
  core/
    identifiers.ts              branded nominal ids (MissionId, ValueModelId, …)
    version.ts                  semantic versioning (parent_version, no-regression)
    provenance.ts               exact-source attribution
    availability.ts             truthful-state algebra (available/unknown/unavailable/failed)
    traceability.ts             cross-model lineage (criterion 9)
    constraints.ts              hard/soft/risk/preference + validation
    confidence.ts               calibrated/qualitative confidence, risk, blast, reversibility
    authority.ts                explicit authority model (R22)
  mission/
    formalization-state.ts      collaborative progressive formalization (R2)
    mission-revision.ts         explicit proposal/approval — anti-silent-rewrite gate (R3)
    mission.ts                  versioned Mission (criterion 1)
  value-model/value-model.ts    business-derived typed records (criterion 3, R4)
  context/context.ts            multi-dimensional, extensible context (criterion 4, R5)
  autonomy/autonomy-policy.ts   per-action/env thresholds + required human approval (criterion 5, R15)
  decisions/
    ask-payload.ts              first-class ASK payload (criterion 7, R16)
    decision.ts                 ACT/EXPERIMENT/GATHER_EVIDENCE/ASK/REJECT/ROLLBACK (criterion 6)
  persistence/
    serialization.ts            canonical JSON + truthful parse (never throws)
    validators.ts               structural validators preserving invariants on deserialize
    repository.ts               SosStore contract — the persistence/API boundary
    in-memory-store.ts          reference impl enforcing boundary invariants
tests/
  helpers.ts + 12 spec files
docs/implementation/
  W1-evidence.md                this file
```

## Deterministic verification

Commands (run from repo root):

```bash
bun run verify      # == bun run typecheck && bun run test
bun run typecheck   # tsc --noEmit  (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
bun run test        # bun test
```

Results (exact-head):

```
$ bun run typecheck
$ tsc --noEmit
(exit 0, no diagnostics)

$ bun test
77 pass
0 fail
178 expect() calls
Ran 77 tests across 12 files. [~52ms]
```

## Requirement → implementation → test mapping

| Req | Acceptance criterion | Implementation | Test |
|---|---|---|---|
| R1, R3 | C1 — Mission identity/version/authority/goals/outcomes/assumptions/ambiguities/change-history | `src/mission/mission.ts` (`Mission`, `makeMission`, `applyApprovedRevision`) | `tests/mission/mission.test.ts` |
| R2, R3 | C2 — explicit proposals/approved; no telemetry silent revision | `src/mission/mission-revision.ts` (`makeMissionRevision`, `approveMissionRevision`, `requiresExplicitApproval`) + store gate `in-memory-store.ts` `saveMission` | `tests/mission/mission-revision.test.ts`, `tests/persistence/store.test.ts` (anti-silent-rewrite gate) |
| R4 | C3 — Value Model derives typed objective/constraint/incentive/opportunity; cannot outrank Mission/Constitution | `src/value-model/value-model.ts` + store subordination gate | `tests/value-model/value-model.test.ts`, `tests/persistence/store.test.ts` (subordination) |
| R5 | C4 — Context extensible, distinguishes user/cohort/device/platform/environment | `src/context/context.ts` | `tests/context/context.test.ts` |
| R15 | C5 — autonomy per-action/env thresholds + required human approval | `src/autonomy/autonomy-policy.ts` (`evaluateAutonomy`) | `tests/autonomy/autonomy-policy.test.ts` |
| R16 | C6 — decision states ACT/EXPERIMENT/GATHER_EVIDENCE/ASK | `src/decisions/decision.ts` (`DecisionAction`) + `autonomy-policy.ts` | `tests/decisions/decision.test.ts`, `tests/autonomy/autonomy-policy.test.ts` |
| R16 | C7 — ASK payload carries decision/alternatives/evidence-quality/uncertainty/trade-offs | `src/decisions/ask-payload.ts` + `decision.ts` pairing invariant | `tests/decisions/ask-payload.test.ts`, `tests/decisions/decision.test.ts` |
| R21 | C8 — failed/unavailable/unknown distinct from empty/success | `src/core/availability.ts` + `serialization.ts` `parse` (never throws) | `tests/core/availability.test.ts`, `tests/persistence/serialization.test.ts` (failed-read conflation) |
| R22 | C9 — every model carries traceability to owning mission/value/authority | `src/core/traceability.ts` + each model's `traceability` field + store refs check | `tests/persistence/store.test.ts` (cross-model traceability) |
| R23, R24 | C10 — tests + static validation prove invariants | full suite + `tsc --noEmit` | all test files + typecheck |

### Negative tests (explicitly required by the Work Order)

- **Invalid authority transitions:** `mission-revision.test.ts` (approver lacks authority), `store.test.ts` (`approveMissionRevision` denied), `autonomy-policy.test.ts` (rule looser than constitution default rejected).
- **Failed-read conflation:** `serialization.test.ts` (malformed JSON → `failed`; structurally invalid → `failed`; null input → `unknown`; ASK payload <2 alternatives → `failed`); `store.test.ts` (missing mission → `unknown`, missing version → `unavailable`).
- **Anti-silent-rewrite:** `store.test.ts` (superseding mission from unapproved telemetry revision rejected; telemetry revision "approved" without human approver rejected; no change-history entry rejected; version regression rejected).
- **Subordination:** `store.test.ts` (value model against non-approved mission rejected; value model referencing unknown mission rejected).
- **ASK↔payload pairing:** `decision.test.ts` (ASK without payload rejected; non-ASK with payload rejected).

## Architecture-invariant preservation

| Frozen invariant (architecture.md §13 / lock) | How preserved |
|---|---|
| Mission outranks architecture | ValueModel cannot be saved without an approved Mission (`store.saveValueModel`) |
| Constitution outranks autonomous optimization | AutonomyPolicy rules may not be looser than the constitution default (`makeAutonomyPolicy`) |
| Hard constraints outrank preferences | `constraints.validateConstraints` rejects preferences that relax hard bounds |
| Evidence outranks assertion / failed-unknown-unavailable distinct | `Availability` discriminated union; `parse` never throws |
| Candidate cannot become production just by generation | Out of W1 scope (W6/W8); no production path exists |
| Mission revision is explicit and versioned | `mission-revision.ts` + store anti-silent-rewrite gate |
| LLM output not authoritative | No LLM integration in W1; `Confidence` separates calibrated vs qualitative |

## Known limitations

1. **Persistence is in-memory only.** The `SosStore` contract is durable; the reference implementation is `InMemorySosStore`. A durable backend (file/DB) is intentionally deferred — W1's persistence evidence requirement is the serialization round-trip + boundary contract, not a live store. The `serialization.ts` + `validators.ts` modules make a durable backend a drop-in.
2. **Constitution is referenced by identity only.** W1 does not parse the frozen `spec/constitution.md` into a runtime object (the Constitution is frozen prose; modeling it as a runtime authority is a separate governed concern). The store validates that every record's `traceability.constitutionRef` resolves to a registered constitution id.
3. **`candidateRef` on `Decision` is nullable.** Candidates arrive in W6; W1 models the field and enforces the ASK↔payload pairing, but does not generate candidates.
4. **`Authority` is a static record.** Runtime authentication/session mechanics are out of W1 scope; `Authority` captures the authorization model (R22), not authentication.
5. **No HTTP/REST server.** The "API boundary" is the programmatic `SosStore` contract — the contract W2+ will depend on. A network API is a later integration slice, not W1.

## Risk and rollback

- **Risk:** low. W1 adds a new, isolated implementation tree (`src/`, `tests/`) and one evidence doc. It touches no frozen artifact and introduces no runtime service.
- **Rollback:** revert the merge commit; no data migration, no running services to drain.

## Worker stop state

The worker stops at `WAITING_FOR_ARCHITECT`. No merge, no self-approval, no successor Work Order creation. The Architect review should follow `docs/implementation/ARCHITECT-REVIEW-PROTOCOL.md`, verifying the actual PR head SHA against the base SHA recorded above.
