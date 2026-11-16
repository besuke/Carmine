import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { ApiError, fetchScenario } from "../src/api/client";
import type { CaseResult, ScenarioResponse } from "../src/api/types";

// Regression test of the R API against the reconciled expected values (tests/golden/tona_ois_golden.json,
// written by golden/generate_golden.R from RiemannFinMath). All comparisons use unrounded values.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface GoldenCase {
  quotes: { quote_id: string; tenor: string; rate: number }[];
  instruments: { tenor: string; start_date: string; maturity_date: string; pillar_date: string; implied_rate: number }[];
  nodes: { date: string; discount: number; zero_continuous: number | null }[];
  curve_points: { date: string; discount: number; zero_continuous: number | null; forward_1d_simple: number }[];
  swap: {
    npv: number; fixed_leg_npv: number; overnight_leg_npv: number; fixed_leg_bps: number; par_rate: number;
    cashflows: { leg: string; accrual_start: string; accrual_end: string; payment_date: string; amount: number }[];
  };
}
interface Golden {
  evaluation_date: string;
  conventions: Record<string, unknown>;
  bump: { quote_id: string; size: number };
  swap_terms: { notional: number; fixed_rate: number; effective_date: string; termination_date: string };
  cases: { base: GoldenCase; bump_5y: GoldenCase };
  pv_change: number;
}

const golden: Golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "tona_ois_golden.json"), "utf8"));

// Tolerances (README "照合と許容誤差"): the same as the GaussQuant–RiemannFinMath reconciliation.
const TOL = {
  discountRel: 1e-12,
  rateAbs: 1e-10,
  pvAbsYen: 0.1,
  pvChangeAbsYen: 0.2,
};

/** Largest observed difference per item, written to test-results/regression-report.json. */
const observed: Record<string, { n: number; maxAbsDiff: number; tolerance: string }> = {};
function record(item: string, diff: number, tolerance: string) {
  const o = (observed[item] ??= { n: 0, maxAbsDiff: 0, tolerance });
  o.n += 1;
  o.maxAbsDiff = Math.max(o.maxAbsDiff, Math.abs(diff));
}

let bumped: ScenarioResponse;
let zero: ScenarioResponse;
const baseUrl = inject("apiBaseUrl");

beforeAll(async () => {
  bumped = await fetchScenario({ bumpTenor: "5Y", bumpBp: 1 }, { baseUrl });
  zero = await fetchScenario({ bumpTenor: "5Y", bumpBp: 0 }, { baseUrl });
});

afterAll(() => {
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  writeFileSync(
    path.join(root, "test-results", "regression-report.json"),
    JSON.stringify({ run_at: new Date().toISOString(), api: baseUrl, tolerances: TOL, observed }, null, 2),
  );
});

function compareCase(label: string, api: CaseResult, gold: GoldenCase) {
  // Instruments: dates exactly, implied rates within the rate tolerance
  expect(api.instruments.map((i) => i.tenor)).toEqual(gold.instruments.map((i) => i.tenor));
  api.instruments.forEach((a, i) => {
    const g = gold.instruments[i];
    expect([a.start_date, a.maturity_date, a.pillar_date], `${label} ${a.tenor} dates`).toEqual([g.start_date, g.maturity_date, g.pillar_date]);
    const d = a.implied_rate - g.implied_rate;
    record("implied quote", d, `abs ${TOL.rateAbs}`);
    expect(Math.abs(d), `${label} ${a.tenor} implied`).toBeLessThanOrEqual(TOL.rateAbs);
  });

  // Curve nodes
  expect(api.nodes.map((n) => n.date)).toEqual(gold.nodes.map((n) => n.date));
  api.nodes.forEach((a, i) => {
    const rel = a.discount / gold.nodes[i].discount - 1;
    record("discount factor (nodes)", rel, `rel ${TOL.discountRel}`);
    expect(Math.abs(rel), `${label} node ${a.date}`).toBeLessThanOrEqual(TOL.discountRel);
  });

  // Discount factors and 1-day forwards on every expected date
  const byDate = new Map(api.curve_points.map((p) => [p.date, p]));
  for (const g of gold.curve_points) {
    const a = byDate.get(g.date);
    expect(a, `${label} curve point ${g.date} is missing`).toBeDefined();
    const rel = a!.discount / g.discount - 1;
    const fwd = a!.forward_1d_simple - g.forward_1d_simple;
    record("discount factor (curve points)", rel, `rel ${TOL.discountRel}`);
    record("1-day forward", fwd, `abs ${TOL.rateAbs}`);
    if (g.zero_continuous === null) expect(a!.zero_continuous, `${label} zero at ${g.date}`).toBeNull();
    else {
      const z = a!.zero_continuous! - g.zero_continuous;
      record("zero rate (continuous)", z, `abs ${TOL.rateAbs}`);
      expect(Math.abs(z), `${label} zero ${g.date}`).toBeLessThanOrEqual(TOL.rateAbs);
    }
    expect(Math.abs(rel), `${label} DF ${g.date}`).toBeLessThanOrEqual(TOL.discountRel);
    expect(Math.abs(fwd), `${label} forward ${g.date}`).toBeLessThanOrEqual(TOL.rateAbs);
  }

  // 7Y OIS
  const par = api.swap.par_rate - gold.swap.par_rate;
  record("7Y par rate", par, `abs ${TOL.rateAbs}`);
  expect(Math.abs(par), `${label} par`).toBeLessThanOrEqual(TOL.rateAbs);
  for (const k of ["npv", "fixed_leg_npv", "overnight_leg_npv"] as const) {
    const d = api.swap[k] - gold.swap[k];
    record(`7Y OIS ${k} (JPY)`, d, `abs ${TOL.pvAbsYen} yen`);
    expect(Math.abs(d), `${label} ${k}`).toBeLessThanOrEqual(TOL.pvAbsYen);
  }
  expect(api.swap.cashflows.map((c) => [c.leg, c.accrual_start, c.accrual_end, c.payment_date])).toEqual(
    gold.swap.cashflows.map((c) => [c.leg, c.accrual_start, c.accrual_end, c.payment_date]),
  );
  api.swap.cashflows.forEach((c, i) => {
    const d = c.amount - gold.swap.cashflows[i].amount;
    record("7Y OIS cash flow amount (JPY)", d, `abs ${TOL.pvAbsYen} yen`);
    expect(Math.abs(d)).toBeLessThanOrEqual(TOL.pvAbsYen);
  });
}

describe("R API regression against the reconciled JSON", () => {
  it("uses the recorded inputs and conventions", () => {
    expect(bumped.evaluation_date).toBe(golden.evaluation_date);
    for (const [k, v] of Object.entries(golden.conventions)) {
      const actual = k === "side" ? bumped.swap_terms.side : bumped.conventions[k as keyof typeof bumped.conventions];
      expect(actual, k).toEqual(v);
    }
    expect(bumped.quotes.map((q) => [q.tenor, q.rate_base])).toEqual(golden.cases.base.quotes.map((q) => [q.tenor, q.rate]));
    expect(bumped.quotes.map((q) => q.rate_scenario)).toEqual(golden.cases.bump_5y.quotes.map((q) => q.rate));
    expect(bumped.quotes).toHaveLength(13);
    expect(bumped.quotes.some((q) => q.tenor === "7Y")).toBe(false);
  });

  it("uses the unrounded base 7Y par rate as the fixed rate in both cases", () => {
    const t = bumped.swap_terms;
    expect([t.notional, t.effective_date, t.termination_date]).toEqual([
      golden.swap_terms.notional, golden.swap_terms.effective_date, golden.swap_terms.termination_date,
    ]);
    const d = t.fixed_rate - golden.swap_terms.fixed_rate;
    record("fixed rate", d, `abs ${TOL.rateAbs}`);
    expect(Math.abs(d)).toBeLessThanOrEqual(TOL.rateAbs);
    // The par rate of the swap at K is K - NPV/annuity, so it may differ from K in the last bits.
    const self = bumped.cases.base.swap.par_rate - t.fixed_rate;
    record("base 7Y par rate at K minus K", self, `abs ${TOL.rateAbs}`);
    expect(Math.abs(self)).toBeLessThanOrEqual(TOL.rateAbs);
    expect(zero.swap_terms.fixed_rate).toBe(t.fixed_rate);
  });

  it("matches the base case", () => compareCase("base", bumped.cases.base, golden.cases.base));

  it("matches the case with the 5Y quote +1 bp", () => compareCase("bump_5y", bumped.cases.scenario, golden.cases.bump_5y));

  it("gives an initial PV of zero within numerical error", () => {
    record("initial PV |PV| (JPY)", bumped.cases.base.swap.npv, `abs ${TOL.pvAbsYen} yen`);
    expect(Math.abs(bumped.cases.base.swap.npv)).toBeLessThanOrEqual(TOL.pvAbsYen);
  });

  it("reproduces the reported PV change of about +2,821,127 yen on 10 billion yen", () => {
    const d = bumped.pv_change - golden.pv_change;
    record("PV change (JPY)", d, `abs ${TOL.pvChangeAbsYen} yen`);
    expect(Math.abs(d)).toBeLessThanOrEqual(TOL.pvChangeAbsYen);
    expect(Math.abs(bumped.pv_change - (bumped.cases.scenario.swap.npv - bumped.cases.base.swap.npv))).toBe(0);
    expect(Math.round(bumped.pv_change)).toBe(2_821_127);
    expect(bumped.par_change_bp).toBeGreaterThan(0);
  });

  it("returns the base curve for both cases when the bump is 0", () => {
    expect(zero.pv_change).toBe(0);
    expect(zero.cases.scenario).toEqual(zero.cases.base);
    expect(zero.cases.base).toEqual(bumped.cases.base);
  });

  it("echoes the request ID, and keeps no state between requests", async () => {
    const r = await fetchScenario({ bumpTenor: "5Y", bumpBp: 1 }, { baseUrl, requestId: "test-echo-1" });
    expect(r.response.request_id).toBe("test-echo-1");
    expect(bumped.response.request_id).toMatch(/^lfl-[0-9a-f]{16}$/);
    expect(zero.response.request_id).not.toBe(bumped.response.request_id);
    // Same request, same numbers: nothing in the response depends on earlier requests.
    const { response: _a, ...rest1 } = r;
    const { response: _b, ...rest2 } = bumped;
    expect(rest1).toEqual(rest2);
    expect(Number.isNaN(Date.parse(r.response.computed_at.replace(/([+-]d{2})(d{2})$/, "$1:$2")))).toBe(false);
    // Without the header the server draws an ID; an invalid header is replaced.
    const plain = await fetch(`${baseUrl}/api/scenario`, { method: "POST", body: JSON.stringify({ bumpTenor: "5Y", bumpBp: 0 }) });
    expect(((await plain.json()) as ScenarioResponse).response.request_id).toMatch(/^srv-[0-9a-f]{16}$/);
    const bad = await fetch(`${baseUrl}/api/scenario`, { method: "POST", headers: { "X-Request-Id": "bad id!" }, body: JSON.stringify({ bumpTenor: "5Y", bumpBp: 0 }) });
    expect(bad.headers.get("X-Request-Id")).toMatch(/^srv-/);
  });

  it("rejects invalid requests with HTTP 400", async () => {
    for (const body of [{ bumpTenor: "7Y", bumpBp: 1 }, { bumpTenor: "5Y", bumpBp: 1000 }]) {
      await expect(fetchScenario(body, { baseUrl })).rejects.toMatchObject({ status: 400 });
    }
    const res = await fetch(`${baseUrl}/api/scenario`, { method: "POST", body: "{\"bumpTenor\":\"5Y\",\"bumpBp\":1,\"x\":1}" });
    expect(res.status).toBe(400);
    expect((await fetch(`${baseUrl}/api/scenario`)).status).toBe(405);
    await expect(fetchScenario({ bumpTenor: "5Y", bumpBp: 1 }, { baseUrl: "http://127.0.0.1:9" })).rejects.toBeInstanceOf(ApiError);
  });
});
