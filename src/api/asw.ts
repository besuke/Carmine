import { ApiError, newRequestId } from "./client";

// Types and calls of the ASW offer-sheet API (server/R/asw_model.R). Values are unrounded; amounts are per 100 face.

export interface AswConditions {
  valuation_date: string;
  asw_definition: string;
  asw_overnight_leg: { payment_frequency: number; payment_lag: number; note: string };
  curve: { interpolation: string; payment_frequency: number; payment_lag: number; extrapolation: boolean };
  attribute_policy: string;
  data_note: string;
  yen_asw: { collateral: string; ccs: string; calibration: string; fx: string; not_included: string };
  engine: string;
}

export type AswStatus = "computed" | "unsupported" | "failed";
/** Yen-converted ASW: only for foreign-currency bonds whose native ASW is computed. */
export type YenStatus = "computed" | "not_computed" | "not_applicable";

export interface YenAsw {
  status: Exclude<YenStatus, "not_applicable">;
  reason: string;
  fx_spot: number | null;
  basis_bp: number | null;
  yen_asw_bp: number | null;
  native_asw_bp?: number;
  simple_sum_bp?: number;
  calibrated_discount_spread_bp?: number;
  hedged_bond_pv_yen?: number;
  yen_base_leg_pv?: number;
  upfront_pv_yen?: number;
  spread_annuity_yen?: number;
  npv_yen?: number;
  detail?: {
    fx: { spot: number; spot_date: string; quote_time: string; convention: string; source: string };
    basis: {
      terms: { spread_leg: string; pay_leg: string; receive_leg: string; notional_type: string; collateral_currency: string };
      interpolated_bp: number; maturity_date: string; maturity_time: number; method: string;
      points: { maturity_date: string; time: number; basis_bp: number; n_quotes: number }[];
      curve: { time: number; date: string; basis_bp: number }[];
    };
    hedged_cashflows: { payment_date: string; kind: string; foreign_amount: number; fx_forward: number; yen_amount: number; yen_discount: number; yen_pv: number }[];
    components: {
      fx_spot: number; z_bp: number; hedged_bond_pv: number; yen_base_leg_pv: number; upfront_pv: number; annuity: number;
      foreign_base_leg_pv: number; basis_annuity_pv: number; yen_asw_bp: number;
    };
    checks: {
      rebuilt_yen_asw_bp: number; rebuilt_minus_engine_bp: number; hedged_bond_pv_minus_engine: number;
      yen_base_leg_pv_minus_engine: number; ccs_residual_yen: number; npv_at_fair_spread_yen: number;
    };
  };
}

export interface AswOfferRow {
  offer_id: string;
  book: string;
  ISIN: string;
  security_name: string;
  currency: string;
  coupon_rate: number | null;
  maturity_date: string | null;
  broker: string;
  offer_price: number;
  offer_size: number;
  offer_size_unit: string;
  offer_date: string;
  settlement_date: string;
  status: AswStatus;
  reason: string;
  fair_spread_bp: number | null;
  accrued: number | null;
  dirty_price: number | null;
  yen_status: YenStatus;
  yen_reason: string;
  yen_asw_bp: number | null;
  basis_bp: number | null;
  fx_spot: number | null;
  simple_sum_bp: number | null;
  /** Yen bonds: (compound yield − interpolated JGB compound yield) × 100. */
  jgb_spread_bp: number | null;
  /** Input-check codes, as Curie names them (empty when the offer passes). */
  validation_issues: string[];
}

export interface JgbSpread {
  status: "computed" | "not_computed";
  reason: string;
  remaining_years?: number;
  compound_yield_pct?: number;
  jgb_interpolated_yield_pct?: number;
  jgb_spread_bp?: number;
}

export interface OfferColumn {
  offer_book: string;
  file: string;
  sheet: string;
  header_row: number;
  source_header: string;
  field: string;
  size_unit: string;
  size_multiplier: number;
}

export interface JgbSpreadQuote {
  offer_id: string;
  spread_bp: number;
  jgb_interpolated_yield_pct: number;
  compound_yield_pct: number;
  remaining_years: number;
  clean_price: number;
  clean_price_3dp: number;
  round_trip_spread_bp: number;
  native_asw_bp: number;
  assumption: string;
  response: ResponseStamp;
}

type Ref = Record<string, string | number | null>;

export interface ReportOffer {
  offer_id: string;
  book: "JPY" | "ISO";
  ISIN: string;
  security_name: string;
  currency: string;
  offer_price: number;
  settlement_date: string;
  validation_status: "valid" | "invalid";
  validation_issues: string[];
  pricing_status: "success" | "partial" | "failed" | "unsupported" | "skipped";
  pricing_message: string;
  native_asw_bp: number | null;
  asw_effective_date: string | null;
  jpy_compound_yield_pct: number | null;
  jgb_interpolated_yield_pct: number | null;
  jgb_spread_bp: number | null;
  fx_spot: number | null;
  basis_bp: number | null;
  yen_asw_bp: number | null;
  simple_sum_bp: number | null;
  calibrated_discount_spread_bp: number | null;
  calculation_end_date: string | null;
  /** The old Curie demo's row for the same ISIN. */
  reference: Ref | null;
}

export interface AswReport {
  conditions: AswConditions;
  valuation_date: string;
  reference_note: Record<string, string>;
  inputs: Record<"JPY" | "ISO", { offer_file: string; columns: OfferColumn[]; market_log: Ref[] }>;
  attributes_source: string[];
  offers: ReportOffer[];
  curve_check: { currency: string; status: string; index: string; marketdate: string; quote_time: string; quotes: number; max_abs_quote_error_bp: number; last_pillar: string }[];
  curve_reference: Record<"JPY" | "ISO", Ref[]>;
  jgb: {
    yields: { ISIN: string; security_name: string; maturity_date: string; settlement_date: string; coupon_rate: number; coupon_frequency: number; clean_price: number; remaining_years: number; compound_yield_pct: number; yield_message: string }[];
    reference_yields: Ref[];
    average: { maturity_date: string; settlement_date: string; jgb_yield_pct_mean: number; n_jgbs: number; jgb_isins: string }[];
    reference_average: Ref[];
    curve: { time: number; date: string; yield_pct: number }[] | null;
    settlement_date: string;
  };
  basis: {
    table: { currency_pair: string; notional_type: string; maturity_date: string; n_quotes: number; basis_bp_mean: number; quote_sources: string; used: boolean }[];
    reference: Ref[];
    curves: { currency: string; points: { maturity_date: string; time: number; basis_bp: number }[]; curve: { time: number; date: string; basis_bp: number }[] }[];
  };
  residuals: { offer_id: string; ISIN: string; security_name: string; currency: string; fx_spot: number; fx_spot_date: string; asw_effective_date: string; calibrated_discount_spread_bp: number; ccs_residual_yen: number; fair_spread_residual_yen: number; reference: Ref }[];
  provenance: string[];
  response: ResponseStamp;
}

export interface ResponseStamp {
  request_id: string;
  computed_at: string;
}

export interface AswListResponse {
  conditions: AswConditions;
  offers: AswOfferRow[];
  response: ResponseStamp;
}

export interface AswDetailResponse {
  conditions: AswConditions;
  offer: Record<string, string | number | null>;
  attributes: Record<string, string | number | boolean | null> | null;
  status: AswStatus;
  reason: string;
  summary?: null | { accrued: number; dirty_price: number; fair_spread_bp: number; effective_date: string; maturity_date: string; settlement_date: string };
  yen?: null | YenAsw;
  jgb?: null | JgbSpread;
  validation_issues: string[];
  offer_columns: OfferColumn[];
  detail?: null | {
    curve: {
      currency: string; index: string; day_count: string; settlement_days: number; interpolation: string;
      payment_frequency: number; payment_lag: number; extrapolation: boolean; marketdate: string; quote_time: string; source: string;
      quotes: { tenor: string; rate: number; start_date: string; pillar_date: string; implied_rate: number; reproduction_error: number }[];
      points: { date: string; time: number; discount: number; zero_continuous: number | null }[];
    };
    price: {
      clean_price: number; accrued: number; dirty_price: number; upfront: number; upfront_discount: number; upfront_pv: number;
      settlement_date: string; accrual_day_count: string;
    };
    bond_cashflows: { payment_date: string; kind: string; accrual_start: string | null; accrual_end: string | null; amount: number; discount: number; pv: number }[];
    overnight_cashflows: { accrual_start: string; accrual_end: string; payment_date: string; amount: number; spread_unit: number; discount: number; pv: number; spread_unit_pv: number }[];
    principal: { payment_date: string; amount: number; discount: number };
    components: {
      notional: number; bond_pv: number; overnight_pv: number; principal_pv: number; upfront_pv: number; annuity: number; fair_spread_bp: number;
      engine: { bond_leg_pv: number; overnight_leg_pv: number; principal_pv: number; upfront_pv: number; spread_annuity: number; npv_at_zero_spread: number };
    };
    checks: { rebuilt_spread_bp: number; rebuilt_minus_engine_bp: number; npv_at_fair_spread: number; price_sensitivity_bp_per_price: number };
  };
  response: ResponseStamp;
}

async function getJson<T extends { response: ResponseStamp }>(path: string, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string }): Promise<T> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}${path}`, { headers: { "X-Request-Id": requestId }, signal: options.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`APIの応答がJSONではありません（HTTP ${res.status}）`, res.status);
  }
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : res.statusText;
    throw new ApiError(message, res.status);
  }
  const data = body as T;
  if (data.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return data;
}

export const fetchAswList = (options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}) =>
  getJson<AswListResponse>("/api/asw/offers", options);

export const fetchAswDetail = (offerId: string, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}) =>
  getJson<AswDetailResponse>(`/api/asw/offers/${encodeURIComponent(offerId)}`, options);

export const fetchAswReport = (options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}) =>
  getJson<AswReport>("/api/asw/report", options);

/** A quote given as a spread over JGBs (yen bonds), converted to a price by the R API. */
export async function postJgbSpread(
  offerId: string,
  spreadBp: number,
  options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {},
): Promise<JgbSpreadQuote> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/asw/offers/${encodeURIComponent(offerId)}/jgb-spread`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify({ spreadBp }),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (JgbSpreadQuote & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
