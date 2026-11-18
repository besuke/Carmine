import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchBond } from "../src/api/bond";

// The deterministic cash-flow chapter's API against GaussQuant running the manuscript's code on the same inputs
// (server/tests/golden/bond_golden.json, written by server/tests/reconciliation/bond/reconcile_bond.R, which also checks the model
// against the manuscript's own results).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "..", "server", "tests", "golden", "bond_golden.json"), "utf8")) as {
  tonar: { pillar_date: string; discount_factor: number; zero_rate: number; inst_fwd_rate: number }[];
  settlement: string; cashflows: { date: string; amount: number }[];
  remaining_years: number; clean_price: number; simple_from_price: number; compound_yield_pct: number; compound_price: number;
  flat_dirty_price: number; z_spread_npv: number;
  risk: { bpv_yen: number; modified_duration: number; convexity: number }; yield_quantlib_pct: number;
};
const TOL = { curve: 1e-14, forward: 1e-11, price: 1e-11, risk: 1e-10 };
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
  writeFileSync(path.join(root, "test-results", "bond-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Deterministic cash-flow chapter (II-1) against GaussQuant", () => {
  it("reproduces the TONAR par, spot and forward rates at the pillars", async () => {
    const d = await fetchBond({}, { baseUrl });
    expect(d.tonar.map((r) => r.pillar_date)).toEqual(golden.tonar.map((r) => r.pillar_date));
    d.tonar.forEach((r, i) => {
      record("TONAR 割引係数", r.discount_factor - golden.tonar[i].discount_factor, TOL.curve);
      record("TONAR スポット", r.zero_rate - golden.tonar[i].zero_rate, TOL.curve);
      record("TONAR 瞬間フォワード", r.inst_fwd_rate - golden.tonar[i].inst_fwd_rate, TOL.forward);
    });
  });

  it("reproduces the 40-year bond: cash flows, Japanese yields, flat yield, zero spread and risk", async () => {
    const trunc3 = (x: number) => Math.trunc(x * 1000) / 1000;
    const b = (await fetchBond({}, { baseUrl })).bond;
    expect(b.settlement_date).toBe(golden.settlement);
    expect(b.cashflows.map((c) => c.payment_date)).toEqual(golden.cashflows.map((c) => c.date));
    b.cashflows.forEach((c, i) => record("キャッシュフローの金額", c.amount - golden.cashflows[i].amount, TOL.price));
    // Japanese rules truncate, so these are equal, not close
    expect([b.remaining_years, b.clean_price, b.simple_from_price, b.compound_yield_pct, b.compound_price])
      .toEqual([golden.remaining_years, golden.clean_price, golden.simple_from_price, trunc3(golden.compound_yield_pct), golden.compound_price]);
    record("フラットイールドのダーティ価格", b.flat_dirty_price - golden.flat_dirty_price, TOL.price);
    record("Zスプレッド 50bp の NPV", b.z_spread_npv - golden.z_spread_npv, TOL.price);
    record("BPV（円）", b.risk.bpv_yen - golden.risk.bpv_yen, TOL.risk);
    record("修正デュレーション", b.risk.modified_duration - trunc3(golden.risk.modified_duration), TOL.risk);
    record("コンベクシティ", b.risk.convexity - trunc3(golden.risk.convexity), TOL.risk);
    record("QuantLib 方式の利回り", b.solvers[5].yield_pct - golden.yield_quantlib_pct, TOL.price);
    // the root finders agree, and the manuscript's formulas agree with RiemannFinMath
    for (const s of b.solvers.slice(1, 4)) expect(Math.abs(s.yield_pct - b.solvers[0].yield_pct)).toBeLessThan(1e-9);
    expect(Math.abs(b.formula.modified_duration - b.risk.modified_duration)).toBeLessThan(1e-10);
  });

  it("moves with the inputs, keeps the curve relations, and rejects bad input", async () => {
    const d = await fetchBond({ bond: { simpleYieldPct: 3, zSpreadBp: 100 } }, { baseUrl });
    expect(d.bond.clean_price).toBeGreaterThan(golden.clean_price);
    expect(d.bond.z_spread_npv).toBeLessThan(d.bond.flat_dirty_price);
    expect(Math.abs(d.bond.z_spread_back_bp - 100)).toBeLessThan(1e-6);
    const normal = d.shapes.filter((r) => r.curve_shape === "順イールド" && r.maturity > 1);
    for (const r of normal) expect(r.par_rate < r.spot_rate && r.spot_rate < r.forward_rate).toBe(true);
    await expect(fetchBond({ bond: { simpleYieldPct: 99 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchBond({ shapes: { other: 1 } as never }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });

  it("takes the trade, issue and maturity dates; the defaults are the manuscript's", async () => {
    const def = await fetchBond({}, { baseUrl });
    expect([def.bond.trade_date, def.bond.issue_date, def.bond.maturity_date]).toEqual(["2022-03-30", "2022-04-01", "2062-04-01"]);
    expect(def.bond.clean_price).toBeCloseTo(golden.clean_price, 10);
    const ten = await fetchBond({ bond: { tradeDate: "2026-11-18", issueDate: "2026-11-20", maturityDate: "2036-11-20", couponPct: 1.5, simpleYieldPct: 1.6 } }, { baseUrl });
    expect(ten.bond.maturity_date).toBe("2036-11-20");
    expect(ten.bond.remaining_years).toBeCloseTo(10, 6); // settles on the issue date: exactly ten years
    expect(ten.bond.cashflows.at(-1)!.payment_date).toBe("2036-11-20");
    expect(ten.bond.cashflows).toHaveLength(21); // 20 coupons, the last with the redemption
    expect(Math.abs(ten.bond.z_spread_back_bp - 50)).toBeLessThan(1e-6);
    await expect(fetchBond({ bond: { maturityDate: "2022-13-45" } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchBond({ bond: { maturityDate: "2100-04-01" } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchBond({ bond: { tradeDate: "2020-01-01" } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
