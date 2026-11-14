import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { fetchZeroCurves, type ZeroCurvesResponse } from "../src/api/curves";

// The yield-curve chapter's API against GaussQuant / QuantLib 1.42 running the manuscript's code
// (tests/golden/yield_curve_golden.json, written by reconciliation/curves/reconcile_yield_curve.R).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "yield_curve_golden.json"), "utf8")) as {
  tenor_table: { tenor: string; date: string; discount: number; zero_rate: number }[];
  comparison: { date: string; zero_curve_discount: number; discount_curve_discount: number }[];
  shifted_tenor_table: { tenor: string; date: string; discount: number; zero_rate: number }[];
  node_recovery: { tenor: string; date: string; zero_curve_discount: number; discount_curve_discount: number }[];
};
// Discount factors: relative 1e-12 (the other curve tests); zero rates: absolute 1e-10.
const TOL = { dfRel: 1e-12, rate: 1e-10 };
const observed: Record<string, { n: number; maxAbsDiff: number; tolerance: number }> = {};
const record = (item: string, d: number, tol: number) => {
  const o = (observed[item] ??= { n: 0, maxAbsDiff: 0, tolerance: tol });
  o.n += 1;
  o.maxAbsDiff = Math.max(o.maxAbsDiff, Math.abs(d));
  expect(Math.abs(d), item).toBeLessThanOrEqual(tol);
};

const baseUrl = inject("apiBaseUrl");
let base: ZeroCurvesResponse;
beforeAll(async () => {
  base = await fetchZeroCurves({}, { baseUrl });
});
afterAll(() => {
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  writeFileSync(path.join(root, "test-results", "curves-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Yield-curve chapter (II-2) against GaussQuant", () => {
  it("reproduces the zero curve at the standard tenors (II-2.2.2)", () => {
    expect(base.zero_curve.table.map((r) => [r.tenor, r.date])).toEqual(golden.tenor_table.map((r) => [r.tenor, r.date]));
    base.zero_curve.table.forEach((r, i) => {
      record("ZeroCurve 割引係数（年限）", r.discount / golden.tenor_table[i].discount - 1, TOL.dfRel);
      record("ZeroCurve ゼロ金利（年限）", r.zero_continuous! - golden.tenor_table[i].zero_rate, TOL.rate);
    });
  });

  it("reproduces both interpolation targets on the manuscript's 300-point grid (II-2.3.1)", () => {
    const zc = new Map(base.zero_curve.points.map((p) => [p.date, p.discount]));
    const dc = new Map(base.discount_curve.points.map((p) => [p.date, p.discount]));
    for (const g of golden.comparison) {
      expect(zc.has(g.date), g.date).toBe(true);
      record("ZeroCurve 割引係数（300点）", zc.get(g.date)! / g.zero_curve_discount - 1, TOL.dfRel);
      record("DiscountCurve 割引係数（300点）", dc.get(g.date)! / g.discount_curve_discount - 1, TOL.dfRel);
    }
  });

  it("reproduces the +50bp shift with simple, annual spread compounding (II-2.5.2)", () => {
    expect(base.request.shiftBp).toBe(50);
    base.shifted_curve.table.forEach((r, i) => {
      record("シフト後の割引係数（年限）", r.discount / golden.shifted_tenor_table[i].discount - 1, TOL.dfRel);
      record("シフト後のゼロ金利（年限）", r.zero_continuous! - golden.shifted_tenor_table[i].zero_rate, TOL.rate);
    });
  });

  it("recovers the nodes and validates the curves (II-2.5.3)", () => {
    for (const r of base.node_recovery) {
      expect(Math.abs(r.zero_curve_error)).toBeLessThan(1e-14);
      expect(Math.abs(r.discount_curve_error)).toBeLessThan(1e-14);
    }
    for (const v of base.validation) {
      expect([v.nonpositive_discount_count, v.missing_discount_count, v.missing_zero_rate_count]).toEqual([0, 0, 0]);
      expect([v.first_date, v.last_date]).toEqual(["2022-08-19", "2032-08-19"]);
    }
  });

  it("moves only the edited node's neighbourhood, and rejects bad input", async () => {
    const rates = [0.05, 0.06, 0.08, 0.11, 0.18, 0.32, 0.48, 1.0, 1.15]; // 5Y node 0.75% -> 1.00%
    const moved = await fetchZeroCurves({ zeroRatesPct: rates, shiftBp: 0 }, { baseUrl });
    const z = (d: ZeroCurvesResponse, tenor: string) => d.zero_curve.table.find((r) => r.tenor === tenor)!.zero_continuous!;
    expect(z(moved, "2Y")).toBeCloseTo(z(base, "2Y"), 14); // before the 3Y node: unchanged
    expect(z(moved, "5Y") - z(base, "5Y")).toBeCloseTo(0.0025, 10);
    expect(z(moved, "10Y")).toBeCloseTo(z(base, "10Y"), 14);
    expect(moved.shifted_curve.table[5].discount).toBeCloseTo(moved.zero_curve.table[5].discount, 14); // shift 0 (equal up to the last bit)
    await expect(fetchZeroCurves({ zeroRatesPct: [1, 2] }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchZeroCurves({ shiftBp: 1000 }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
