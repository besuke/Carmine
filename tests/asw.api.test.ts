import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { fetchAswDetail, fetchAswList, type AswDetailResponse, type AswListResponse } from "../src/api/asw";
import { ApiError } from "../src/api/client";

// The ASW offer-sheet API against Curie's old demo results (tests/golden/asw_curie_demo_results.json,
// written by scripts/asw/snapshot_curie_demo.R from Curie output/offer_results_*_demo_20261006.xlsx).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
interface OldRow {
  ISIN: string; broker_names: string; offer_price: number; accrued_per_100: number | null; dirty_price: number | null;
  native_asw_bp: number | null; asw_effective_date: string | null; asw_maturity_date: string | null;
  fx_spot: number | null; basis_bp: number | null; jpy_asw_bp: number | null; simple_sum_bp: number | null;
  calibrated_discount_spread_bp: number | null; ccs_repricing_npv_jpy: number | null; fair_spread_npv_jpy: number | null;
  jpy_asw_status: string | null;
  validation_status: string; pricing_status: string; pricing_message: string | null;
}
const golden: { results: OldRow[] } = JSON.parse(readFileSync(path.join(root, "tests", "golden", "asw_curie_demo_results.json"), "utf8"));

// ASW in bp: 1e-6 bp (1e-10 as a rate, the rate tolerance of the other tests); prices per 100: 1e-10.
const TOL = { aswBp: 1e-6, price: 1e-10, rebuiltBp: 1e-9, npvPer100: 1e-10 };
const observed: Record<string, { n: number; maxAbsDiff: number; tolerance: number }> = {};
const record = (item: string, diff: number, tolerance: number) => {
  const o = (observed[item] ??= { n: 0, maxAbsDiff: 0, tolerance });
  o.n += 1;
  o.maxAbsDiff = Math.max(o.maxAbsDiff, Math.abs(diff));
};

const baseUrl = inject("apiBaseUrl");
let list: AswListResponse;
let detail: AswDetailResponse;

beforeAll(async () => {
  list = await fetchAswList({ baseUrl });
  detail = await fetchAswDetail("JPY-02", { baseUrl });
});

afterAll(() => {
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  writeFileSync(path.join(root, "test-results", "asw-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("ASW offer sheet API", () => {
  it("keeps every offer, in the order of the books, with a reason for the rows it cannot compute", () => {
    expect(list.offers).toHaveLength(12);
    expect(list.offers.map((o) => o.ISIN)).toEqual(golden.results.map((r) => r.ISIN));
    const counts = list.offers.reduce<Record<string, number>>((m, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {});
    expect(counts).toEqual({ computed: 10, unsupported: 2 });
    for (const o of list.offers) {
      if (o.status === "computed") expect(o.reason).toBe("");
      else expect(o.reason.length).toBeGreaterThan(0);
    }
    expect(list.offers.find((o) => o.ISIN === "JPTESTFRN018")!.reason).toMatch(/変動利付/);
    expect(list.offers.find((o) => o.ISIN === "USTESTCAL016")!.reason).toMatch(/期限前償還/);
  });

  it("reproduces the old demo's ASW, accrued interest and dirty price for every computed offer", () => {
    list.offers.forEach((o, i) => {
      const old = golden.results[i];
      expect(o.broker).toBe(old.broker_names);
      expect(o.offer_price).toBe(old.offer_price);
      if (old.pricing_status !== "success") {
        expect(o.status).toBe("unsupported");
        expect(old.pricing_status).toBe("unsupported");
        return;
      }
      expect(o.status, o.ISIN).toBe("computed");
      const d = o.fair_spread_bp! - old.native_asw_bp!;
      record("ASW（bp）", d, TOL.aswBp);
      expect(Math.abs(d), `${o.ISIN} ASW`).toBeLessThanOrEqual(TOL.aswBp);
      record("経過利子", o.accrued! - old.accrued_per_100!, TOL.price);
      expect(Math.abs(o.accrued! - old.accrued_per_100!)).toBeLessThanOrEqual(TOL.price);
      record("ダーティ価格", o.dirty_price! - old.dirty_price!, TOL.price);
      expect(Math.abs(o.dirty_price! - old.dirty_price!)).toBeLessThanOrEqual(TOL.price);
    });
  });

  it("explains the reconciled offer (JPY-02, テスト円債B) in a way that adds up", () => {
    const old = golden.results.find((r) => r.ISIN === "JPTEST000022")!;
    expect(detail.status).toBe("computed");
    expect(detail.summary!.effective_date).toBe(old.asw_effective_date);
    expect(detail.summary!.maturity_date).toBe(old.asw_maturity_date);
    expect(detail.summary!.fair_spread_bp).toBe(list.offers.find((o) => o.offer_id === "JPY-02")!.fair_spread_bp);
    const x = detail.detail!;
    const c = x.components;
    record("内訳から組み立てたASW − エンジン（bp）", x.checks.rebuilt_minus_engine_bp, TOL.rebuiltBp);
    expect(Math.abs(x.checks.rebuilt_minus_engine_bp)).toBeLessThanOrEqual(TOL.rebuiltBp);
    record("フェアスプレッドでのNPV（額面100）", x.checks.npv_at_fair_spread, TOL.npvPer100);
    expect(Math.abs(x.checks.npv_at_fair_spread)).toBeLessThanOrEqual(TOL.npvPer100);
    // The cash-flow tables add up to the engine's components
    const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9);
    close(c.bond_pv, -c.engine.bond_leg_pv);
    close(c.overnight_pv, c.engine.overnight_leg_pv);
    close(c.principal_pv, c.engine.principal_pv);
    close(c.upfront_pv, c.engine.upfront_pv);
    close(c.annuity, c.engine.spread_annuity);
    close(x.bond_cashflows.reduce((s, f) => s + f.pv, 0), c.bond_pv);
    close(x.overnight_cashflows.reduce((s, f) => s + f.spread_unit_pv, 0), c.annuity);
    close(x.price.dirty_price, x.price.clean_price + x.price.accrued);
    // Every bond cash flow is after the start, and the overnight leg covers start to maturity
    expect(x.bond_cashflows.every((f) => f.payment_date > detail.summary!.effective_date)).toBe(true);
    expect(x.overnight_cashflows[0].accrual_start).toBe(detail.summary!.effective_date);
    expect(x.curve.quotes.every((q) => q.reproduction_error < 1e-9)).toBe(true);
    expect(x.curve.points.length).toBeGreaterThan(50);
  });

  it("returns the reason for an offer it cannot compute, and rejects unknown ids", async () => {
    const callable = await fetchAswDetail("ISO-06", { baseUrl });
    expect(callable.status).toBe("unsupported");
    expect(callable.reason).toMatch(/First Call日 2031-03-01/);
    expect(callable.detail ?? null).toBeNull();
    await expect(fetchAswDetail("JPY-99", { baseUrl })).rejects.toMatchObject({ status: 404 });
    await expect(fetchAswDetail("../x", { baseUrl })).rejects.toBeInstanceOf(ApiError);
    const r = await fetchAswList({ baseUrl, requestId: "asw-test-1" });
    expect(r.response.request_id).toBe("asw-test-1");
  });
});

// Yen-converted ASW (円担保・元本一定・満期のベーシス1点で校正) against the old demo's jpy_asw_bp.
// Tolerance 1e-6 bp as for the native ASW; the CCS and fair-spread residuals are in yen per 100 of foreign face.
const YEN_TOL = { bp: 1e-6, residualYen: 1e-6, rebuiltBp: 1e-9 };

describe("Yen-converted ASW", () => {
  it("reproduces the old demo's yen-converted ASW, basis and FX for every foreign-currency offer", () => {
    let compared = 0;
    list.offers.forEach((o, i) => {
      const old = golden.results[i];
      if (o.currency === "JPY") {
        expect(o.yen_status).toBe("not_applicable");
        expect(o.yen_asw_bp).toBeNull();
        return;
      }
      if (old.jpy_asw_status !== "computed") {
        expect(o.yen_asw_bp, o.ISIN).toBeNull();
        return;
      }
      expect(o.yen_status, o.ISIN).toBe("computed");
      expect(o.fx_spot).toBe(old.fx_spot);
      for (const [item, api, ref] of [
        ["円換算ASW（bp）", o.yen_asw_bp!, old.jpy_asw_bp!],
        ["補間したベーシス（bp）", o.basis_bp!, old.basis_bp!],
        ["単純和（bp）", o.simple_sum_bp!, old.simple_sum_bp!],
      ] as const) {
        record(item, api - ref, YEN_TOL.bp);
        expect(Math.abs(api - ref), `${o.ISIN} ${item}`).toBeLessThanOrEqual(YEN_TOL.bp);
      }
      compared += 1;
    });
    expect(compared).toBe(5);
  });

  it("explains the reconciled offer (ISO-01, TEST USD BOND F) in a way that adds up", async () => {
    const d = await fetchAswDetail("ISO-01", { baseUrl });
    const old = golden.results.find((r) => r.ISIN === "USTEST000016")!;
    const y = d.yen!;
    const x = y.detail!;
    expect(y.status).toBe("computed");
    expect(x.fx.spot_date).toBe(d.summary!.effective_date);
    record("外貨割引の一定スプレッド z（bp）", x.components.z_bp - old.calibrated_discount_spread_bp!, YEN_TOL.bp);
    expect(Math.abs(x.components.z_bp - old.calibrated_discount_spread_bp!)).toBeLessThanOrEqual(YEN_TOL.bp);
    record("CCS 校正の残差（円）", x.checks.ccs_residual_yen, YEN_TOL.residualYen);
    expect(Math.abs(x.checks.ccs_residual_yen)).toBeLessThanOrEqual(YEN_TOL.residualYen);
    record("フェアスプレッドでのNPV（円）", x.checks.npv_at_fair_spread_yen, YEN_TOL.residualYen);
    expect(Math.abs(x.checks.npv_at_fair_spread_yen)).toBeLessThanOrEqual(YEN_TOL.residualYen);
    record("内訳から組み立てた円換算ASW − エンジン（bp）", x.checks.rebuilt_minus_engine_bp, YEN_TOL.rebuiltBp);
    expect(Math.abs(x.checks.rebuilt_minus_engine_bp)).toBeLessThanOrEqual(YEN_TOL.rebuiltBp);
    expect(Math.abs(x.checks.hedged_bond_pv_minus_engine)).toBeLessThanOrEqual(1e-7);
    expect(Math.abs(x.checks.yen_base_leg_pv_minus_engine)).toBeLessThanOrEqual(1e-7);
    expect(Math.abs(x.hedged_cashflows.reduce((s, f) => s + f.yen_pv, 0) - x.components.hedged_bond_pv)).toBeLessThanOrEqual(1e-9);
    // Only constant-notional quotes are used: two sources per maturity, the MtM-reset quotes are left out
    expect(x.basis.points.every((p) => p.n_quotes === 2)).toBe(true);
    expect(x.basis.terms.notional_type).toBe("constant");
  });

  it("has no yen-converted ASW for yen bonds", async () => {
    const d = await fetchAswDetail("JPY-02", { baseUrl });
    expect(d.yen ?? null).toBeNull();
  });
});
