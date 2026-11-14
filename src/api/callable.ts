import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The early redemption chapter's API (server/R/callable_model.R). Prices per 100; rates as decimals.

export interface BondInputs { ratePct: number; aPct: number; sigmaPct: number; couponPct: number; firstCallYear: number; callPrice: number }
export interface MbsInputs { psaPct: number; incentive: number; refiCostPct: number }

export interface CallableResponse {
  inputs: { bond: BondInputs; mbs: MbsInputs };
  conventions: Record<"bond" | "mbs" | "static" | "engine", string>;
  bond: {
    flows: { time: number; coupon: number; principal: number; call_price: number | null }[];
    rate: number; a: number; sigma: number;
    bullet_from_curve: number; bullet: number; callable: number; issuer_call_value: number;
    by_volatility: { volatility: number; callable: number; issuer_call_value: number }[];
    curve_by_volatility: { volatility: number; issuer_call_value: number }[];
    grid_convergence: { points: number; nodes: number; callable: number; bullet_grid_error: number; change_from_previous: number | null }[];
    exercise_boundary: { payment_time: number; call_below_short_rate: number | null; share_of_grid_called: number }[];
    decision_year2: { short_rate: number; continuation_ex_coupon: number; call_price: number; exercise_now: boolean }[];
  };
  mbs: {
    pool: { balance: number; mortgage_rate: number; pass_through_rate: number; months: number; psa: number; incentive: number; refinancing_cost: number };
    scenarios: { scenario: string; weighted_average_life: number; price_fixed_discount: number; price_path_discount: number; total_principal: number }[];
    cpr: { month: number; falling: number; flat: number; rising: number }[];
    flat_cashflows: { month: number; interest: number; scheduled_principal: number; prepaid_principal: number; end_balance: number }[];
    paths: { seed: number; count: number; rates: number[][]; price: number[]; weighted_average_life: number[]; mean_price: number; mean_wal: number };
    own_paths: { count: number; seed: number; mean_price: number; standard_error: number; mean_wal: number };
  };
  static: {
    table: { psa_percent: number; assumed_price: number; oas_bp: number }[];
    price_curve: { psa_percent: number; spread_bp: number; price: number }[];
  };
  response: ResponseStamp;
}

export type CallableRequest = { bond?: Partial<BondInputs>; mbs?: Partial<MbsInputs> };

export async function fetchCallable(request: CallableRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<CallableResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/callable`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (CallableResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
