import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchCds, type CdsValue } from "../src/api/cds";

// The credit risk and CDS chapter's API against GaussQuant running the manuscript's code on the same inputs
// (server/tests/golden/cds_golden.json, written by server/tests/reconciliation/cds/reconcile_cds.R). Those inputs are the manuscript's,
// and reconcile_cds.R also checks them against the manuscript's own results (difference 0).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type Row = Record<string, number | string | null>;
type Legs = CdsValue & Record<string, number>;
const golden = JSON.parse(readFileSync(path.join(root, "..", "server", "tests", "golden", "cds_golden.json"), "utf8")) as {
  flat: Legs & { hazard_calibrated: number; cashflows: Row[]; hand: Record<string, number> };
  sensitivity_hazard_calibrated: number[];
  isda: Legs & { hazard: number; maturity: string; schedule: string[]; cashflows: Row[]; hand: Record<string, number> };
  midpoint: Legs;
};
const TOL = { money: 1e-8, rate: 1e-15, hazard: 1e-10, table: 1e-12 };
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
  writeFileSync(path.join(root, "test-results", "cds-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

const legs = (label: string, api: CdsValue, ref: Legs, keys: (keyof CdsValue)[]) => {
  for (const k of keys) record(`${label}：${k}`, api[k] - ref[k], k.startsWith("fair") ? TOL.rate : TOL.money);
};
const table = (label: string, api: Row[], ref: Row[]) => {
  expect(api).toHaveLength(ref.length);
  for (const k of ["accrual_days", "coupon_amount", "discount_factor", "survival_probability", "default_probability", "midpoint_discount_factor", "midpoint_survival_probability"]) {
    api.forEach((r, i) => {
      const a = r[k], b = ref[i][k];
      if (a == null || b == null) { expect(a, `${label}：${k}[${i}]`).toBe(b); return; }
      record(`${label}：${k}`, ((a as number) - (b as number)) / Math.max(1, Math.abs(b as number)), TOL.table);
    });
  }
  expect(api.map((r) => r.payment_date)).toEqual(ref.map((r) => r.payment_date));
};

describe("Credit risk and CDS chapter (II-5) against GaussQuant", () => {
  it("reproduces the one-year MidPoint swap, its cash-flow table, hand calculation and zero-NPV hazard", async () => {
    const d = await fetchCds({}, { baseUrl });
    legs("1年物", d.flat.value, golden.flat, ["npv", "coupon_leg_npv", "default_leg_npv", "fair_spread", "fair_upfront"]);
    table("1年物 CF表", d.flat.cashflows as unknown as Row[], golden.flat.cashflows);
    for (const k of ["coupon_leg_npv", "default_leg_npv", "npv"] as const) record(`1年物 手計算：${k}`, d.flat.hand[k] - golden.flat.hand[k], TOL.money);
    record("1年物 手計算：fair_spread", d.flat.hand.fair_spread - golden.flat.hand.fair_spread, TOL.rate);
    record("1年物：ゼロNPV Hazard", d.flat.calibration.hazard - golden.flat.hazard_calibrated, TOL.hazard);
    d.sensitivity.forEach((r, i) => record("感応度：ゼロNPV Hazard", r.hazard_calibrated - golden.sensitivity_hazard_calibrated[i], TOL.hazard));
    expect(d.flat.hazard_approx).toBe(0.013 / 0.6);
  });

  it("reproduces the standard five-year swap: CDS2015 maturity and schedule, ISDA and MidPoint engines", async () => {
    const d = await fetchCds({}, { baseUrl });
    expect(d.isda.maturity_date).toBe(golden.isda.maturity);
    expect(d.isda.schedule).toEqual(golden.isda.schedule);
    record("標準5年物：ゼロNPV Hazard", d.isda.hazard - golden.isda.hazard, TOL.hazard);
    const keys: (keyof CdsValue)[] = ["npv", "coupon_leg_npv", "default_leg_npv", "accrual_rebate_npv", "fair_spread", "fair_upfront"];
    legs("ISDA", d.isda.isda, golden.isda, keys);
    legs("MidPoint", d.isda.midpoint, golden.midpoint, keys);
    table("標準5年物 CF表", d.isda.cashflows as unknown as Row[], golden.isda.cashflows);
    record("標準5年物 手計算：npv", d.isda.hand.npv - golden.isda.hand.npv, TOL.money);
    // the decomposition adds up, and the upfront chart passes through the current market spread
    expect(d.isda.isda.npv).toBeCloseTo(d.isda.isda.coupon_leg_npv + d.isda.isda.default_leg_npv + d.isda.isda.accrual_rebate_npv, 6);
    expect(d.upfront_by_spread).toHaveLength(30);
  });

  it("moves with the inputs and rejects bad ones", async () => {
    const at = await fetchCds({ flat: { couponBp: 130 } }, { baseUrl });
    // a coupon at the market spread: the buyer pays more, so the NPV falls, and the fair spread does not change
    expect(at.flat.value.npv).toBeLessThan(golden.flat.npv);
    expect(at.flat.value.fair_spread).toBeCloseTo(golden.flat.fair_spread, 12);
    const hi = await fetchCds({ isda: { spreadBp: 150 } }, { baseUrl });
    expect(hi.isda.isda.fair_upfront).toBeGreaterThan(0);
    expect(hi.isda.hazard).toBeGreaterThan(golden.isda.hazard);
    await expect(fetchCds({ flat: { spreadBp: 5000 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchCds({ isda: { recoveryPct: 95 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchCds({ flat: { other: 1 } as never }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
