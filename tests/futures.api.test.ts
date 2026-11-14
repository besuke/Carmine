import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchFutures } from "../src/api/futures";

// The JGB futures chapter's API against GaussQuant running the manuscript's code on the same fictitious inputs
// (tests/golden/futures_golden.json, written by reconciliation/futures/reconcile_futures.R). The stress scenario
// there also matches the manuscript's own results (Riemann comparison/baseline/lagrange_values.csv).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type G = Record<string, number | boolean>[]; // the GaussQuant tables, one object per bond
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "futures_golden.json"), "utf8")) as {
  current: G; current_futures_bpv: number; current_ctd_issue: number;
  stress: G; stress_futures_price: number; stress_futures_bpv: number; stress_ctd_issue: number;
};
const TOL = { value: 1e-10, duration: 1e-8 };
const observed: Record<string, { n: number; maxAbsDiff: number; tolerance: number }> = {};
const record = (item: string, d: number, tol: number) => {
  const o = (observed[item] ??= { n: 0, maxAbsDiff: 0, tolerance: tol });
  o.n += 1;
  o.maxAbsDiff = Math.max(o.maxAbsDiff, Math.abs(d));
  expect(Math.abs(d), item).toBeLessThanOrEqual(tol);
};
const baseUrl = inject("apiBaseUrl");
afterAll(() => {
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  writeFileSync(path.join(root, "test-results", "futures-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

const fields: [string, string, number][] = [
  ["accrued_start", "accrued_start", TOL.value], ["accrued_end", "accrued_end", TOL.value], ["coupon_income", "coupon_income", TOL.value],
  ["yield", "yield", TOL.value], ["duration", "duration", TOL.duration], ["dv01", "dv01", TOL.value],
  ["gross_basis", "gross_basis", TOL.value], ["carry", "carry", TOL.value], ["net_basis", "net_basis", TOL.value], ["implied_repo", "implied_repo", TOL.value],
];

describe("JGB futures chapter (II-2.6–2.7) against GaussQuant", () => {
  it("reproduces the current market: basis, implied repo, CTD and futures BPV", async () => {
    const d = await fetchFutures({ mode: "current" }, { baseUrl });
    expect(d.rows).toHaveLength(11);
    for (const [api, ref, tol] of fields) {
      d.rows.forEach((r, i) => record(`現在：${api}`, (r as unknown as Record<string, number>)[api] - (golden.current[i][ref] as number), tol));
    }
    expect(d.ctd_issue).toBe(golden.current_ctd_issue);
    record("現在：先物BPV", d.futures_bpv - golden.current_futures_bpv, TOL.value);
    expect(d.futures_bpv).toBeCloseTo(d.ctd_dv01 / d.ctd_conversion_factor, 15);
  });

  it("reproduces the manuscript's stress scenario (8% long, 9% funding)", async () => {
    const d = await fetchFutures({ mode: "flat", yieldPct: 8, fundingPct: 9 }, { baseUrl });
    record("ストレス：先物価格", d.futures_price - golden.stress_futures_price, TOL.value);
    for (const [api, ref, tol] of [["price", "price", TOL.value], ...fields.filter(([k]) => k !== "yield")] as [string, string, number][]) {
      d.rows.forEach((r, i) => record(`ストレス：${api}`, (r as unknown as Record<string, number>)[api] - (golden.stress[i][ref] as number), tol));
    }
    expect(d.ctd_issue).toBe(golden.stress_ctd_issue);
    record("ストレス：先物BPV", d.futures_bpv - golden.stress_futures_bpv, TOL.value);
  });

  it("shows the CTD switching across the 6% standard coupon, and rejects bad input", async () => {
    const d = await fetchFutures({ mode: "flat", yieldPct: 8, fundingPct: 9 }, { baseUrl });
    const at = (y: number) => d.ctd_by_level.find((r) => r.yield_pct === y)!.ctd_issue;
    expect(at(2)).toBe(golden.current_ctd_issue); // low yields: the short-duration issue
    expect(at(8)).toBe(golden.stress_ctd_issue); // high yields: the long-duration issue
    await expect(fetchFutures({ mode: "flat", yieldPct: 50 }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchFutures({ mode: "other" as "current" }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
