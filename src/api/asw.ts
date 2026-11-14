import { ApiError, newRequestId } from "./client";

// Types and calls of the ASW offer-sheet API (server/R/asw_model.R). Values are unrounded; amounts are per 100 face.

export interface AswConditions {
  valuation_date: string;
  asw_definition: string;
  asw_overnight_leg: { payment_frequency: number; payment_lag: number; note: string };
  curve: { interpolation: string; payment_frequency: number; payment_lag: number; extrapolation: boolean };
  attribute_policy: string;
  data_note: string;
  engine: string;
}

export type AswStatus = "computed" | "unsupported" | "failed";

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
