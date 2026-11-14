import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The PRDC chapter's API (server/R/prdc_model.R). Money in yen on a notional of 300 million; rates as decimals.

export interface NoteInputs {
  spot: number; volPct: number; domesticPct: number; foreignPct: number; discountPct: number;
  fxBase: number; leveragePct: number; subtractionPct: number; floorPct: number; capPct: number;
}
export interface McInputs { paths: number; seed: number }

export interface PrdcResponse {
  inputs: { note: NoteInputs; mc: McInputs };
  conventions: Record<"note" | "model" | "mc" | "engine", string>;
  note: {
    valuation_date: string; notional: number; drift: number; domestic_curve_rate: number; foreign_curve_rate: number;
    schedule: { full: string[]; total_dates: number; remaining: number; intro_dates: number; intro_remaining: number; intro_rate: number };
    thresholds: { floor_fx: number; cap_fx: number; spot: number };
    payoff: { fx_rate: number; uncapped_coupon: number; coupon_rate: number }[];
    closed: { npv: number; fx_delta: number; fx_vega: number; coupon_leg_pv: number; redemption_pv: number };
    coupons: {
      coupon_number: number; accrual_start: string; coupon_date: string; time: number; accrual_fraction: number; expected_fx: number;
      coupon_at_expected_fx: number; expected_coupon_rate: number; floor_probability: number; cap_probability: number;
      coupon_amount: number; redemption_amount: number; discount_factor: number; total_amount: number; total_present_value: number;
    }[];
    distribution: { coupon_number: number; coupon_date: string; lower: number; upper: number; probability: number; kind: "between" | "floor" | "cap" }[];
    spot_scenarios: { scenario: string; fx_spot: number; npv: number }[];
    vol_scenarios: { scenario: string; fx_volatility: number; npv: number }[];
    spot_curve: { fx_spot: number; npv: number }[];
    sample_paths: number[][]; sample_times: number[];
  };
  mc: { paths: number; seed: number; npv: number; standard_error: number; fx_delta: number; fx_vega: number;
    by_paths: { paths: number; npv: number; standard_error: number }[] };
  response: ResponseStamp;
}

export type PrdcRequest = { note?: Partial<NoteInputs>; mc?: Partial<McInputs> };

export async function fetchPrdc(request: PrdcRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<PrdcResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/prdc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (PrdcResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
