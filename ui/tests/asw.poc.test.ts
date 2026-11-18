import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { fetchAswDetail, fetchAswList, fetchAswReport, postJgbSpread, type AswReport } from "../src/api/asw";

// The A1 offer-sheet POC report (GET /api/asw/report) and the JGB spread of yen bonds, against the old Curie
// demo run (server/data/asw_demo/curie_reference.json, carried in the report as `reference`).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOL = { bp: 1e-6, yieldPct: 1e-10, basisAvg: 1e-12, curveBp: 1e-9, residualYen: 1e-6 };
const observed: Record<string, { n: number; maxAbsDiff: number; tolerance: number | string }> = {};
const record = (item: string, diff: number, tolerance: number | string) => {
  const o = (observed[item] ??= { n: 0, maxAbsDiff: 0, tolerance });
  o.n += 1;
  o.maxAbsDiff = Math.max(o.maxAbsDiff, Math.abs(diff));
};
const close = (item: string, api: number | null | undefined, ref: unknown, tol: number) => {
  expect(typeof api, item).toBe("number");
  expect(typeof ref, item).toBe("number");
  const d = (api as number) - (ref as number);
  record(item, d, tol);
  expect(Math.abs(d), item).toBeLessThanOrEqual(tol);
};

const baseUrl = inject("apiBaseUrl");
let report: AswReport;
beforeAll(async () => {
  report = await fetchAswReport({ baseUrl });
});
afterAll(() => {
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  writeFileSync(path.join(root, "test-results", "asw-poc-report.json"), JSON.stringify({ run_at: new Date().toISOString(), tolerances: TOL, observed }, null, 2));
});

describe("A1 offer-sheet POC report", () => {
  it("has the same input checks and pricing status as the old demo for every offer", () => {
    expect(report.offers).toHaveLength(12);
    for (const o of report.offers) {
      expect(o.reference, o.ISIN).not.toBeNull();
      expect(o.validation_issues.join("; "), `${o.ISIN} issues`).toBe(o.reference!.validation_message ?? "");
      expect(o.pricing_status, `${o.ISIN} status`).toBe(o.reference!.pricing_status);
    }
    expect(report.offers.find((o) => o.ISIN === "JPTESTFRN018")!.validation_issues).toEqual(["unsupported_coupon_type", "unsupported_product"]);
    expect(report.offers.find((o) => o.ISIN === "USTESTCAL016")!.validation_issues).toEqual(["unsupported_product"]);
  });

  it("reproduces the JPY results: compound yield, interpolated JGB yield, OIS ASW and JGB spread", () => {
    const jpy = report.offers.filter((o) => o.book === "JPY" && o.pricing_status === "success");
    expect(jpy).toHaveLength(5);
    for (const o of jpy) {
      close("対象債の複利利回り（%）", o.jpy_compound_yield_pct, o.reference!.jpy_compound_yield_pct, TOL.yieldPct);
      close("補間JGB利回り（%）", o.jgb_interpolated_yield_pct, o.reference!.jgb_interpolated_yield_pct, TOL.yieldPct);
      close("JPY OIS ASW（bp）", o.native_asw_bp, o.reference!.native_asw_bp, TOL.bp);
      close("JGBスプレッド（bp）", o.jgb_spread_bp, o.reference!.jgb_spread_bp, TOL.bp);
    }
  });

  it("reproduces the ISO results", () => {
    const iso = report.offers.filter((o) => o.book === "ISO" && o.pricing_status === "success");
    expect(iso).toHaveLength(5);
    for (const o of iso) {
      close("自国通貨 OIS ASW（bp）", o.native_asw_bp, o.reference!.native_asw_bp, TOL.bp);
      close("補間ベーシス（bp）", o.basis_bp, o.reference!.basis_bp, TOL.bp);
      close("円換算ASW（bp）", o.yen_asw_bp, o.reference!.jpy_asw_bp, TOL.bp);
      close("単純合算（bp）", o.simple_sum_bp, o.reference!.simple_sum_bp, TOL.bp);
    }
  });

  it("reproduces the verification details: OIS curves, JGB yields, basis averages and yen residuals", () => {
    const refCurves = [...report.curve_reference.JPY, ...report.curve_reference.ISO];
    for (const c of report.curve_check) {
      const ref = refCurves.find((r) => r.currency === c.currency)!;
      expect(c.quotes).toBe(ref.quotes);
      close("OISカーブの最大再現誤差（bp）", c.max_abs_quote_error_bp, ref.max_abs_quote_error_bp, TOL.curveBp);
      expect(c.max_abs_quote_error_bp).toBeLessThan(1e-4);
    }
    for (const j of report.jgb.yields) {
      const ref = report.jgb.reference_yields.find((r) => r.ISIN === j.ISIN)!;
      expect(j.remaining_years, j.ISIN).toBe(ref.remaining_years); // truncated to 7 decimals: exact
      expect(j.compound_yield_pct, j.ISIN).toBe(ref.compound_yield_pct); // truncated to 7 decimals: exact
      record("JGB複利利回り（%）", j.compound_yield_pct - (ref.compound_yield_pct as number), "完全一致");
    }
    expect(report.jgb.average).toHaveLength(report.jgb.reference_average.length);
    for (const a of report.jgb.average) {
      close("JGB 同一償還日の平均（%）", a.jgb_yield_pct_mean, report.jgb.reference_average.find((r) => r.maturity_date === a.maturity_date)!.jgb_yield_pct_mean, TOL.basisAvg);
    }
    expect(report.jgb.average.find((a) => a.n_jgbs === 2)?.maturity_date).toBe("2033-06-20");
    for (const b of report.basis.table) {
      const ref = report.basis.reference.find((r) => r.currency_pair === b.currency_pair && r.notional_type === b.notional_type && r.maturity_date === b.maturity_date)!;
      close("ベーシスの平均（bp）", b.basis_bp_mean, ref.basis_bp_mean, TOL.basisAvg);
      expect(b.used).toBe(b.notional_type === "constant");
    }
    expect(report.basis.table).toHaveLength(report.basis.reference.length);
    expect(report.residuals).toHaveLength(5);
    for (const r of report.residuals) {
      close("校正した割引スプレッド z（bp）", r.calibrated_discount_spread_bp, r.reference.calibrated_discount_spread_bp, TOL.bp);
      record("CCS校正のNPV残差（円）", r.ccs_residual_yen, TOL.residualYen);
      expect(Math.abs(r.ccs_residual_yen)).toBeLessThan(TOL.residualYen);
      expect(Math.abs(r.fair_spread_residual_yen)).toBeLessThan(TOL.residualYen);
    }
  });

  it("describes the offer sheet's input columns as Curie's converter read them", () => {
    // Fields that are lists must stay JSON arrays even with one element (jsonlite would unbox them)
    expect(Array.isArray(report.attributes_source)).toBe(true);
    for (const o of report.offers) expect(Array.isArray(o.validation_issues), o.ISIN).toBe(true);
    const jpy = report.inputs.JPY.columns;
    expect(jpy.map((c) => c.source_header)).toEqual(["オファー日", "ISINコード", "銘柄名", "業者名", "単価", "数量(億円)", "受渡日", "参考:発行価格"]);
    expect(jpy[0].sheet).toBe("円債オファー");
    expect(jpy[0].header_row).toBe(5);
    expect(jpy[0].size_multiplier).toBe(1e8);
    for (const f of ["offer_date", "ISIN", "broker_names", "offer_price", "offer_size", "offer_settlementdate"]) {
      expect(jpy.map((c) => c.field)).toContain(f);
    }
    // No column for a spread: offers are quoted as prices only
    expect(jpy.some((c) => /spread|スプレッド/i.test(c.source_header + c.field))).toBe(false);
  });
});

describe("JGB spread of yen bonds", () => {
  it("appears in the offer list and the detail of yen bonds only", async () => {
    const list = await fetchAswList({ baseUrl });
    for (const o of list.offers) {
      const r = report.offers.find((x) => x.offer_id === o.offer_id)!;
      if (r.book === "JPY" && r.pricing_status === "success") expect(o.jgb_spread_bp).toBe(r.jgb_spread_bp);
      else expect(o.jgb_spread_bp).toBeNull();
      expect(o.validation_issues).toEqual(r.validation_issues);
    }
    const d = await fetchAswDetail("JPY-02", { baseUrl });
    expect(d.jgb?.status).toBe("computed");
    expect(d.offer_columns).toHaveLength(8);
    expect((await fetchAswDetail("ISO-01", { baseUrl })).jgb ?? null).toBeNull();
  });

  it("converts a quote given as a spread over JGBs back to the offer's price (round trip)", async () => {
    for (const o of report.offers.filter((x) => x.book === "JPY" && x.pricing_status === "success")) {
      const q = await postJgbSpread(o.offer_id, o.jgb_spread_bp!, { baseUrl });
      // The yield is truncated to 7 decimals, so the untruncated price moves by at most a few 1e-7
      record("スプレッド→単価（切り捨てなし）− オファー単価", q.clean_price - o.offer_price, 1e-6);
      expect(Math.abs(q.clean_price - o.offer_price), o.ISIN).toBeLessThan(1e-6);
      expect(q.clean_price_3dp, o.ISIN).toBe(o.offer_price);
      record("戻し確認のスプレッド（bp）", q.round_trip_spread_bp - o.jgb_spread_bp!, 1e-4);
      expect(Math.abs(q.round_trip_spread_bp - o.jgb_spread_bp!)).toBeLessThan(1e-4);
      record("その単価での ASW − オファーの ASW（bp）", q.native_asw_bp - o.native_asw_bp!, 1e-4);
      expect(Math.abs(q.native_asw_bp - o.native_asw_bp!)).toBeLessThan(1e-4);
    }
    // A wider spread gives a lower price
    const a = await postJgbSpread("JPY-02", 10, { baseUrl });
    const b = await postJgbSpread("JPY-02", 20, { baseUrl });
    expect(b.clean_price).toBeLessThan(a.clean_price);
    expect(b.compound_yield_pct - a.compound_yield_pct).toBeCloseTo(0.1, 12);
  });

  it("refuses foreign bonds, unsupported bonds and bad input", async () => {
    await expect(postJgbSpread("ISO-01", 10, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(postJgbSpread("JPY-06", 10, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(postJgbSpread("JPY-99", 10, { baseUrl })).rejects.toMatchObject({ status: 404 });
    await expect(postJgbSpread("JPY-02", 5000, { baseUrl })).rejects.toMatchObject({ status: 400 });
    const r = await fetch(`${baseUrl}/api/asw/offers/JPY-02/jgb-spread`, { method: "POST", body: "{\"spreadBp\":1,\"x\":2}" });
    expect(r.status).toBe(400);
  });
});
