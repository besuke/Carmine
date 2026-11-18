import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The credit risk and CDS chapter's API (server/R/cds_model.R). Values are unrounded; rates as decimals, money in
// currency units of the notional (10,000,000), signed from the protection buyer.

export interface CdsInputs { spreadBp: number; couponBp: number; recoveryPct: number; ratePct: number }

export interface CdsValue {
  npv: number;
  coupon_leg_npv: number;
  default_leg_npv: number;
  upfront_npv: number;
  accrual_rebate_npv: number;
  fair_spread: number;
  fair_upfront: number;
}

export interface CdsCashflow {
  payment_date: string;
  accrual_start: string | null;
  accrual_days: number | null;
  coupon_amount: number | null;
  discount_factor: number;
  survival_probability: number;
  default_probability: number;
  midpoint_date: string | null;
  midpoint_discount_factor: number | null;
  midpoint_survival_probability: number | null;
}

export interface CdsHand {
  coupon_leg_npv: number;
  default_leg_npv: number;
  npv: number;
  risky_pv01: number;
  protection_leg_per_unit: number;
  fair_spread: number;
}

export interface CdsResponse {
  inputs: { flat: CdsInputs; isda: CdsInputs };
  conventions: Record<"flat" | "isda" | "curves" | "engine", string>;
  flat: {
    trade_date: string; protection_start: string; maturity_date: string; notional: number;
    spread: number; coupon: number; recovery: number; rate: number; hazard_approx: number;
    probability_curve: { time: number; survival_probability: number; default_probability: number }[];
    discount_at_maturity: number; survival_at_maturity: number;
    value: CdsValue; cashflows: CdsCashflow[]; hand: CdsHand;
    calibration: { hazard: number; npv: number; fair_spread: number };
  };
  sensitivity: {
    market_spread_bp: number; recovery: number; loss_given_default: number; hazard_approx: number;
    survival_probability_5y: number; default_probability_5y: number; hazard_calibrated: number;
  }[];
  isda: {
    trade_date: string; maturity_date: string; maturity_serial: number; notional: number;
    spread: number; coupon: number; recovery: number; rate: number; schedule: string[];
    discount_at_maturity: number; hazard: number; hazard_approx: number; survival_at_maturity: number;
    isda: CdsValue; fair_upfront_amount: number; midpoint: CdsValue; cashflows: CdsCashflow[]; hand: CdsHand;
  };
  upfront_by_spread: { spread_bp: number; hazard: number; fair_upfront: number; npv: number }[];
  response: ResponseStamp;
}

export type CdsRequest = { flat?: Partial<CdsInputs>; isda?: Partial<CdsInputs> };

export async function fetchCds(request: CdsRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<CdsResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/cds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (CdsResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
