import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The deterministic cash-flow chapter's API (server/R/bond_model.R). Prices per 100 face; yields named *_pct are in
// percent, the others are decimals.

export interface ShapeInputs { normalLevelPct: number; normalSlopePct: number; invertedLevelPct: number; invertedSlopePct: number }
export interface BondInputs {
  simpleYieldPct: number; couponPct: number; zSpreadBp: number;
  /** ISO dates. The defaults are the manuscript's example (trade 2022-03-30, issue 2022-04-01, maturity 2062-04-01). */
  tradeDate: string; issueDate: string; maturityDate: string;
}

export interface BondResponse {
  inputs: { shapes: ShapeInputs; bond: BondInputs };
  conventions: Record<"tonar" | "bond" | "yen" | "engine", string>;
  tonar: { quote_id: string; tenor: string; pillar_date: string; par_rate: number; discount_factor: number; zero_rate: number;
    inst_fwd_rate: number; repricing_error: number }[];
  shapes: { curve_shape: string; maturity: number; spot_rate: number; discount_factor: number; forward_rate: number; par_rate: number }[];
  bond: {
    trade_date: string; settlement_date: string; issue_date: string; maturity_date: string;
    coupon_pct: number; simple_yield_pct: number; z_spread_bp: number;
    cashflows: { payment_date: string; amount: number; kind: string; accrual_start: string | null; accrual_end: string | null }[];
    remaining_years: number; clean_price: number; simple_from_price: number; compound_yield_pct: number; compound_price: number;
    accrued: number; dirty_price: number; flat_dirty_price: number; continuous_yield: number; z_spread_npv: number; z_spread_back_bp: number;
    risk: { price: number; dp_dy_pct: number; d2p_dy2_pct: number; bpv_yen: number; bpv_sen: number; modified_duration: number; convexity: number };
    formula: { price: number; dp_dy_pct: number; d2p_dy2_pct: number; bpv_sen: number; bpv_yen: number; modified_duration: number; convexity: number };
    zero_yield: { price: number; dp_dy_pct: number; d2p_dy2_pct: number; modified_duration: number; convexity: number };
    price_yield: { yield_pct: number; price: number; duration_approx: number; convexity_approx: number }[];
    solvers: { method: string; yield_pct: number; iterations: number | null; price_error: number; average_us: number }[];
    newton_steps: { iteration: number; yield_pct: number; objective: number; derivative: number }[];
    bisection_steps: { iteration: number; lower: number; upper: number; midpoint: number; objective: number }[];
    bisection_iterations: number;
    polyroot: { degree: number; roots: number; real_positive: number };
  };
  response: ResponseStamp;
}

export type BondRequest = { shapes?: Partial<ShapeInputs>; bond?: Partial<BondInputs> };

export async function fetchBond(request: BondRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<BondResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/bond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (BondResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
