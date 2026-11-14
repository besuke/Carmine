import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The JGB futures chapter's API (server/R/futures_model.R). Values are unrounded; prices per 100 face.

export interface FuturesRow {
  issue: number;
  coupon_pct: number;
  maturity_date: string;
  conversion_factor: number;
  price: number;
  yield: number;
  duration: number;
  dv01: number;
  bpv_analytic: number;
  accrued_start: number;
  accrued_end: number;
  coupon_income: number;
  futures_invoice: number;
  gross_basis: number;
  funding_cost: number;
  carry: number;
  net_basis: number;
  implied_repo: number;
  ctd: boolean;
}

export interface FuturesResponse {
  mode: "current" | "flat";
  valuation_date: string;
  delivery_date: string;
  flat_yield: number | null;
  inputs_note: string;
  current_curve: { tenor_years: number; yield_pct: number }[];
  stress_curve: { tenor_years: number; yield_pct: number }[];
  conventions: Record<string, string>;
  rows: FuturesRow[];
  futures_price: number;
  funding_rate: number;
  ctd_issue: number;
  futures_bpv: number;
  ctd_dv01: number;
  ctd_conversion_factor: number;
  ctd_by_level: { yield_pct: number; ctd_issue: number; ctd_duration: number; futures_price: number; futures_bpv: number }[];
  response: ResponseStamp;
}

export async function fetchFutures(
  request: { mode: "current" | "flat"; yieldPct?: number; fundingPct?: number },
  options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {},
): Promise<FuturesResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/futures/basket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (FuturesResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
