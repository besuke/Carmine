import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, inject, it } from "vitest";
import { fetchCallable } from "../src/api/callable";

// The early redemption chapter's API against the manuscript's own R functions (tests/golden/callable_golden.json,
// written by reconciliation/callable/reconcile_callable.R, which also checks the manuscript's results).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "callable_golden.json"), "utf8")) as {
  bullet_curve: number; bullet: number; callable: number; issuer_call_value: number; by_volatility: number[]; by_grid: number[];
  scenarios: { weighted_average_life: number; price_fixed_discount: number; price_path_discount: number; total_principal: number }[];
  path_price: number[]; path_wal: number[]; static_oas_bp: number[];
};
const TOL = { bond: 1e-12, mbs: 1e-11 };
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
  writeFileSync(path.join(root, "test-results", "callable-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("Early redemption chapter (II-8) against the manuscript's functions", () => {
  it("reproduces the callable bond, its volatility sensitivity and grid convergence", async () => {
    const b = (await fetchCallable({}, { baseUrl })).bond;
    record("Bullet（初期曲線）", b.bullet_from_curve - golden.bullet_curve, TOL.bond);
    record("Bullet（格子）", b.bullet - golden.bullet, TOL.bond);
    record("Callable", b.callable - golden.callable, TOL.bond);
    record("コール権の価値", b.issuer_call_value - golden.issuer_call_value, TOL.bond);
    b.by_volatility.forEach((r, i) => record("ボラ別の Callable", r.callable - golden.by_volatility[i], TOL.bond));
    b.grid_convergence.forEach((r, i) => record("格子別の Callable", r.callable - golden.by_grid[i], TOL.bond));
    // the issuer calls when rates are low: on every call date there is a boundary
    expect(b.exercise_boundary).toHaveLength(8);
    for (const r of b.exercise_boundary) expect(r.call_below_short_rate).not.toBeNull();
  });

  it("reproduces the mortgage pool: scenarios, the 20 Hull-White paths and the static spreads", async () => {
    const m = await fetchCallable({}, { baseUrl });
    m.mbs.scenarios.forEach((r, i) => {
      record("MBS 加重平均残存年数", r.weighted_average_life - golden.scenarios[i].weighted_average_life, TOL.mbs);
      record("MBS 固定 4% の価格", r.price_fixed_discount - golden.scenarios[i].price_fixed_discount, TOL.mbs);
      record("MBS 経路の金利の価格", r.price_path_discount - golden.scenarios[i].price_path_discount, TOL.mbs);
    });
    m.mbs.paths.price.forEach((p, i) => record("MBS 20経路の価格", p - golden.path_price[i], TOL.mbs));
    m.mbs.paths.weighted_average_life.forEach((w, i) => record("MBS 20経路の WAL", w - golden.path_wal[i], TOL.mbs));
    // static spreads: the manuscript stops uniroot at its default tolerance, so within 0.5 bp
    const sorted = [...m.static.table].sort((a, b) => a.psa_percent - b.psa_percent || a.assumed_price - b.assumed_price);
    sorted.forEach((r, i) => expect(Math.abs(r.oas_bp - golden.static_oas_bp[i])).toBeLessThan(0.5));
    expect(m.mbs.scenarios[0].weighted_average_life).toBeLessThan(m.mbs.scenarios[2].weighted_average_life);
  });

  it("moves with the inputs and rejects bad input", async () => {
    const hi = await fetchCallable({ bond: { sigmaPct: 2 }, mbs: { psaPct: 200 } }, { baseUrl });
    expect(hi.bond.issuer_call_value).toBeGreaterThan(golden.issuer_call_value);
    expect(hi.mbs.scenarios[1].weighted_average_life).toBeLessThan(golden.scenarios[1].weighted_average_life);
    const noCall = await fetchCallable({ bond: { firstCallYear: 4.5, callPrice: 120 } }, { baseUrl });
    expect(noCall.bond.issuer_call_value).toBeLessThan(golden.issuer_call_value);
    await expect(fetchCallable({ bond: { firstCallYear: 1.2 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchCallable({ mbs: { other: 1 } as never }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
