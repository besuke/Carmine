import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchBlack } from "../src/api/black";

// The Black model chapter's API against GaussQuant running the manuscript's code on the same inputs
// (tests/golden/black_golden.json, written by tests/reconciliation/black/reconcile_black.R, which also checks the model
// against the manuscript's own results). Pseudo-random Monte Carlo is not compared: the random numbers differ.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "black_golden.json"), "utf8")) as {
  black_calculator: Record<string, number>; analytic: Record<string, number>; black_sobol_3x4: number[];
  european: Record<string, number>; american: Record<string, number>; sobol_64_paths: number[];
  lsm: Record<string, number>; lsm_exercise: { exercise_step: number; paths: number }[];
  lsm_diagnostics: { step: number; in_the_money_paths: number; exercised_paths: number }[];
};
// Trees: up to 500 backward steps, so the last bits differ by up to 5e-12 (RECONCILIATION_BLACK.md)
const TOL = { greek: 1e-12, tree: 1e-10, path: 1e-11 };
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
  writeFileSync(path.join(root, "test-results", "black-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Black model chapter (II-4) against GaussQuant", () => {
  it("reproduces Black 76 by the formula and by the process, and recovers the volatility", async () => {
    const d = await fetchBlack({}, { baseUrl });
    const g = golden.black_calculator, a = golden.analytic;
    record("Black 公式：価格", d.black.formula.value - g.npv, TOL.greek);
    record("Black 公式：Delta", d.black.formula.delta_forward - g.delta, TOL.greek);
    record("Black 公式：Gamma", d.black.formula.gamma_forward - g.gamma, TOL.greek);
    record("Black 公式：Vega", d.black.formula.vega - g.vega, TOL.greek);
    for (const k of ["delta", "gamma", "vega", "theta", "theta_per_day"] as const) record(`Black process：${k}`, d.black.process[k] - a[k], TOL.greek);
    record("Black process：価格", d.black.process.value - a.npv, TOL.greek);
    expect(d.black.implied_volatility).toBeCloseTo(0.052, 9);
    d.mc.one_path.forEach((r) => record("1パスの確認：生成 − 手計算（qnorm）", r.difference, 1e-8));
    record("Sobol 3ステップのパス", Math.max(...d.mc.one_path.map((r, i) => Math.abs(r.generated_price - golden.black_sobol_3x4[i + 4]))), TOL.path);
  });

  it("reproduces the European and American puts, the Sobol paths and Longstaff-Schwartz", async () => {
    const d = await fetchBlack({}, { baseUrl });
    d.bsm.european_engines.forEach((r) => record("European put", r.npv - golden.european[r.method], TOL.tree));
    d.bsm.american_engines.forEach((r) => record("American put", r.npv - golden.american[r.method], TOL.tree));
    d.lsm.shown_paths.forEach((r, i) => record("Sobol 64本のパス", r.price - golden.sobol_64_paths[i], TOL.path));
    record("LSM：価格", d.lsm.value - golden.lsm.lsm_npv, TOL.greek);
    record("LSM：標準誤差", d.lsm.standard_error - golden.lsm.standard_error, TOL.greek);
    for (const e of golden.lsm_exercise) expect(d.lsm.exercise.find((x) => x.step === e.exercise_step)!.paths_in_table).toBe(e.paths);
    for (const g of golden.lsm_diagnostics) {
      const r = d.lsm.regressions.find((x) => x.step === g.step)!;
      expect([r.in_the_money_paths, r.exercised_paths]).toEqual([g.in_the_money_paths, g.exercised_paths]);
    }
  });

  it("moves with the inputs, converges, and rejects bad input", async () => {
    const d = await fetchBlack({ mc: { sequence: "sobol", paths: 20000 }, bsm: { volPct: 30 } }, { baseUrl });
    expect(Math.abs(d.mc.difference)).toBeLessThan(4 * d.mc.standard_error);
    expect(d.bsm.american_engines.find((r) => r.method === "crr_500")!.npv).toBeGreaterThan(golden.american.crr_500);
    expect(d.bsm.early_exercise_premium).toBeGreaterThan(0);
    await expect(fetchBlack({ mc: { sequence: "halton" as "sobol" } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchBlack({ black: { volPct: 0 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchBlack({ lsm: { paths: 100000 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
