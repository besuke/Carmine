import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchCalibration } from "../src/api/calibration";

// The calibration chapter's API against the manuscript's code run with GaussQuant (tests/golden/calibration_golden.json,
// written by reconciliation/calibration/reconcile_calibration.R, which also checks the model against the manuscript's
// own results).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "calibration_golden.json"), "utf8")) as {
  normal_price: number[]; sabr_par: { alpha: number; volvol: number; rho: number }; sabr_rmse: number; sabr_fitted: number[];
  hw_market: number[]; hw_par: { a: number; sigma: number }; hw_objective: number; hw_model: number[];
  bgm_proxy: number; bgm_decay: number;
};
// the same optim on functions that agree to the last bits stops a little apart (RECONCILIATION_CALIBRATION.md)
const TOL = { price: 1e-14, optim: 1e-9, vol: 1e-10 };
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
  writeFileSync(path.join(root, "test-results", "calibration-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Calibration chapter (II-6) against the manuscript's code", () => {
  it("prices the normal model and reproduces the SABR fit of the manuscript's procedure", async () => {
    const d = await fetchCalibration({}, { baseUrl });
    d.normal.by_strike.forEach((r, i) => record("Normal 型の価格", r.normal - golden.normal_price[i], TOL.price));
    expect(d.normal.by_strike.filter((r) => r.strike <= 0).every((r) => r.black === null)).toBe(true);
    const m = d.sabr.fits[0];
    record("SABR α（原稿の手順）", m.alpha - golden.sabr_par.alpha, TOL.optim);
    record("SABR ν（原稿の手順）", m.nu - golden.sabr_par.volvol, TOL.optim);
    record("SABR ρ（原稿の手順）", m.rho - golden.sabr_par.rho, TOL.optim);
    d.sabr.quotes.forEach((q, i) => record("SABR あてはめたボラ", q.manuscript_fit - golden.sabr_fitted[i], TOL.vol));
    expect(d.sabr.fits[1].rmse).toBeLessThanOrEqual(m.rmse + 1e-12); // calibrate_sabr fits at least as well
  });

  it("reproduces the Hull-White market prices and the manuscript's fit, and recovers the reference parameters", async () => {
    const h = (await fetchCalibration({}, { baseUrl })).hw;
    h.options.forEach((o, i) => record("HW 市場価格", o.market_price - golden.hw_market[i], TOL.price));
    record("HW a（原稿の手順）", h.fits[0].a - golden.hw_par.a, TOL.optim);
    record("HW σ（原稿の手順）", h.fits[0].sigma - golden.hw_par.sigma, TOL.optim);
    h.options.forEach((o, i) => record("HW 原稿の手順の再評価", o.manuscript_price - golden.hw_model[i], 1e-12));
    expect(h.fits[1].a).toBeCloseTo(0.08, 9);
    expect(h.fits[1].sigma).toBeCloseTo(0.012, 9);
  });

  it("reproduces the BGM proxy, moves with the inputs, and rejects bad input", async () => {
    const d = await fetchCalibration({ bgm: { decay: 1 }, hw: { aPct: 15 } }, { baseUrl });
    const base = await fetchCalibration({}, { baseUrl });
    record("BGM 固定ウェイト近似", base.bgm.proxy_vol - golden.bgm_proxy, 0);
    record("BGM 減衰の推定", base.bgm.fitted_decay - golden.bgm_decay, 0);
    expect(d.bgm.proxy_vol).toBeLessThan(base.bgm.proxy_vol); // less correlation, less swaption volatility
    expect(Math.abs(d.bgm.fitted_decay - 1)).toBeLessThan(1e-4);
    expect(d.hw.fits[1].a).toBeCloseTo(0.15, 8);
    // a negative forward: the normal model still prices, Black has no value
    const neg = await fetchCalibration({ normal: { forwardPct: -0.2 } }, { baseUrl });
    expect(neg.normal.atm.black).toBeNull();
    expect(neg.normal.by_strike.every((r) => r.black === null)).toBe(true);
    expect(neg.normal.atm.normal).toBeGreaterThan(0);
    await expect(fetchCalibration({ sabr: { beta: 2 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchCalibration({ hw: { other: 1 } as never }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
