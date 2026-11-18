import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchPrdc } from "../src/api/prdc";

// The PRDC chapter's API against QuantLib (schedule, blackFormula) and the manuscript's Monte Carlo
// (tests/golden/prdc_golden.json, written by tests/reconciliation/prdc/reconcile_prdc.R).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "prdc_golden.json"), "utf8")) as {
  schedule: string[]; expected_coupon: number[]; floor_probability: number[]; cap_probability: number[];
  npv_closed: number; manuscript_mc_npv: number; manuscript_mc_se: number;
};
const TOL = { coupon: 1e-15, probability: 1e-12, npv: 1e-6 };
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
  writeFileSync(path.join(root, "test-results", "prdc-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("PRDC chapter (II-9) against QuantLib and the manuscript", () => {
  it("reproduces the schedule, the expected coupons, the probabilities and the closed-form value", async () => {
    const n = (await fetchPrdc({}, { baseUrl })).note;
    expect(n.schedule.full).toEqual(golden.schedule);
    expect(Array.isArray(n.sample_paths) && n.sample_paths.every((p) => Array.isArray(p) && p.length === n.sample_times.length)).toBe(true);
    n.coupons.forEach((c, i) => {
      record("期待クーポン", c.expected_coupon_rate - golden.expected_coupon[i], TOL.coupon);
      record("フロア確率", c.floor_probability - golden.floor_probability[i], TOL.probability);
      record("キャップ確率", c.cap_probability - golden.cap_probability[i], TOL.probability);
    });
    record("現在価値（閉じた式）", n.closed.npv - golden.npv_closed, TOL.npv);
    record("キャッシュフローの現在価値の合計", n.coupons.reduce((a, c) => a + c.total_present_value, 0) - n.closed.npv, TOL.npv);
    // the manuscript's 300-path Monte Carlo lies within three of its standard errors
    expect(Math.abs(n.closed.npv - golden.manuscript_mc_npv)).toBeLessThan(3 * golden.manuscript_mc_se);
    for (const id of new Set(n.distribution.map((r) => r.coupon_number))) {
      const total = n.distribution.filter((r) => r.coupon_number === id).reduce((a, r) => a + r.probability, 0);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  it("converges by Monte Carlo and moves with the inputs", async () => {
    const d = await fetchPrdc({ mc: { paths: 30000, seed: 7 } }, { baseUrl });
    expect(Math.abs(d.mc.npv - d.note.closed.npv)).toBeLessThan(4 * d.mc.standard_error);
    const up = await fetchPrdc({ note: { spot: 145 } }, { baseUrl });
    expect(up.note.closed.npv).toBeGreaterThan(golden.npv_closed);
    const vol = await fetchPrdc({ note: { volPct: 15 } }, { baseUrl });
    expect(vol.note.closed.npv).toBeLessThan(golden.npv_closed);
    await expect(fetchPrdc({ note: { capPct: 0, floorPct: 1 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchPrdc({ mc: { paths: 10 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
