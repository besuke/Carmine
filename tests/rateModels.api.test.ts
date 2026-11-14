import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchRateModels } from "../src/api/rateModels";

// The interest-rate models chapter's API against the manuscript's code with its seeds (tests/golden/rate_models_golden.json,
// written by reconciliation/rate_models/reconcile_rate_models.R, which also checks the manuscript's own results).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "rate_models_golden.json"), "utf8")) as {
  hw_sample_paths: number[][]; hw_discount: number[];
  caplet: { black: number; simulated: number; se: number }; correlation: number[][]; compounded: number;
};
const TOL = { same_numbers: 1e-15, caplet: 1e-17, correlation: 1e-14 };
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
  writeFileSync(path.join(root, "test-results", "rate-models-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Interest-rate models chapter (II-7) against the manuscript's code", () => {
  it("reproduces the Hull-White paths and the discount check with the manuscript's random numbers", async () => {
    const h = (await fetchRateModels({}, { baseUrl })).hw;
    h.sample_paths.forEach((p, i) => p.forEach((r, k) => record("HW の経路", r - golden.hw_sample_paths[i][k], TOL.same_numbers)));
    const ms = h.discount_check.filter((r) => !r.model.startsWith("RiemannFinMath"));
    ms.forEach((r, i) => record("HW 割引の平均", r.simulation - golden.hw_discount[i], TOL.same_numbers));
    // RiemannFinMath's own monthly paths: within three standard errors of the initial curve
    for (const r of h.discount_check.filter((x) => x.model.startsWith("RiemannFinMath"))) expect(Math.abs(r.difference)).toBeLessThan(3 * r.mc_standard_error);
  });

  it("reproduces the caplet, the correlated shocks and the compounded rate", async () => {
    const d = await fetchRateModels({}, { baseUrl });
    record("キャップレット Black", d.caplet.black_price - golden.caplet.black, TOL.caplet);
    record("キャップレット MC", d.caplet.simulated_price - golden.caplet.simulated, TOL.caplet);
    record("キャップレット 標準誤差", d.caplet.mc_standard_error - golden.caplet.se, TOL.caplet);
    const idx = { A: 0, B: 1, C: 2 } as const;
    for (const r of d.shocks.table) record("標本相関", r.simulated - golden.correlation[idx[r.forward_1 as "A"]][idx[r.forward_2 as "A"]], TOL.correlation);
    record("後決め金利の複利", d.fixings.compounded_rate - golden.compounded, 1e-16);
    expect(d.caplet.backward_price).toBeGreaterThan(d.caplet.black_price);
  });

  it("moves with the inputs and rejects a correlation that is not positive definite", async () => {
    const d = await fetchRateModels({ hw: { sigmaPct: 2 }, caplet: { strikePct: 2 }, fixings: { amplitudePct: 0 } }, { baseUrl });
    expect(d.hw.quantile_95[60] - d.hw.quantile_05[60]).toBeGreaterThan(0);
    expect(d.caplet.black_price).toBeGreaterThan(golden.caplet.black);
    expect(d.fixings.compounded_rate).toBeGreaterThan(d.fixings.simple_average); // compounding of a flat 1%
    await expect(fetchRateModels({ shocks: { ab: 0.99, ac: -0.99, bc: 0.99 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchRateModels({ caplet: { volPct: 0 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
