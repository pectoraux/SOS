import { describe, it, expect } from "bun:test";
import { buildAskPayload } from "../helpers.js";
import { makeAskPayload } from "../../src/decisions/ask-payload.js";

describe("AskPayload — first-class ASK outcome (W1 criterion 7, R16)", () => {
  it("carries the exact decision, alternatives, evidence quality, uncertainty and trade-offs", () => {
    const ask = buildAskPayload();
    expect(ask.decisionNeeded.length).toBeGreaterThan(0);
    expect(ask.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(ask.evidenceQuality).toBe("mixed");
    expect(ask.uncertainty.class).toBe("moderate");
    expect(ask.tradeoffs.length).toBeGreaterThan(0);
    expect(ask.noResponseFallback).toBe("gather-evidence");
    expect(ask.alternatives[0]!.tradeoffs.length).toBeGreaterThan(0);
  });

  it("requires at least two alternatives (an ASK must present a real choice)", () => {
    expect(() =>
      makeAskPayload({
        decisionNeeded: "x",
        alternatives: [{ id: "a1", label: "only", expectedOutcome: "y", tradeoffs: [] }],
        evidenceQuality: "none",
        uncertainty: { class: "high", rationale: "r", basis: "qualitative" },
        noResponseFallback: "no-action",
      }),
    ).toThrow();
  });

  it("requires a non-empty decision and uncertainty rationale", () => {
    expect(() =>
      makeAskPayload({
        decisionNeeded: " ",
        alternatives: [
          { id: "a1", label: "l", expectedOutcome: "o", tradeoffs: [] },
          { id: "a2", label: "l", expectedOutcome: "o", tradeoffs: [] },
        ],
        evidenceQuality: "none",
        uncertainty: { class: "low", rationale: " ", basis: "qualitative" },
        noResponseFallback: "no-action",
      }),
    ).toThrow();
  });
});
