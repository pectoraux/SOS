import { describe, it, expect } from "bun:test";
import {
  makeConstraint,
  constraintRank,
  validateConstraints,
  type Constraint,
} from "../../src/core/constraints.js";

describe("Constraints — hard/soft/risk/preference classes (R4, invariant §13.3)", () => {
  it("ranks precedence hard > risk > soft > preference", () => {
    expect(constraintRank("hard")).toBeGreaterThan(constraintRank("risk"));
    expect(constraintRank("risk")).toBeGreaterThan(constraintRank("soft"));
    expect(constraintRank("soft")).toBeGreaterThan(constraintRank("preference"));
  });

  it("rejects an empty description (a constraint must state what it binds)", () => {
    expect(() =>
      makeConstraint({ kind: "hard", description: "  ", subject: "x" }),
    ).toThrow();
  });

  it("detects two contradictory hard bounds on the same subject", () => {
    const constraints: Constraint[] = [
      makeConstraint({ kind: "hard", description: "latency <= 200ms", subject: "max-latency", bound: { op: "<=", value: 200, unit: "ms" } }),
      makeConstraint({ kind: "hard", description: "latency > 200ms", subject: "max-latency", bound: { op: ">", value: 200, unit: "ms" } }),
    ];
    const conflicts = validateConstraints(constraints);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.subject).toBe("max-latency");
    expect(conflicts[0]!.reason).toContain("mutually exclusive");
  });

  it("rejects a preference that relaxes a hard bound on the same subject", () => {
    const constraints: Constraint[] = [
      makeConstraint({ kind: "hard", description: "latency <= 200ms", subject: "max-latency", bound: { op: "<=", value: 200, unit: "ms" } }),
      makeConstraint({ kind: "preference", description: "prefer up to 400ms", subject: "max-latency", bound: { op: "<=", value: 400, unit: "ms" } }),
    ];
    const conflicts = validateConstraints(constraints);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.reason).toContain("relaxes a hard constraint");
  });

  it("accepts compatible constraints on different subjects", () => {
    const constraints: Constraint[] = [
      makeConstraint({ kind: "hard", description: "latency <= 200ms", subject: "max-latency", bound: { op: "<=", value: 200, unit: "ms" } }),
      makeConstraint({ kind: "soft", description: "cost <= $10k", subject: "monthly-cost", bound: { op: "<=", value: 10000, unit: "USD" } }),
    ];
    expect(validateConstraints(constraints).length).toBe(0);
  });
});
