import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The Black model chapter's API (server/R/black_model.R). Values are unrounded; rates and volatilities as decimals.

export interface BlackInputs { forward: number; strike: number; volPct: number; ratePct: number }
export interface McInputs { sequence: "pseudo" | "sobol"; paths: number }
export interface BsmInputs { spot: number; strike: number; volPct: number; ratePct: number; dividendPct: number }
export interface LsmInputs { paths: number }
export type PathRow = { path_id: number; step: number; time: number; price: number };

export interface BlackResponse {
  inputs: { black: BlackInputs; mc: McInputs; bsm: BsmInputs; lsm: LsmInputs };
  conventions: Record<"black" | "bsm" | "mc" | "lsm" | "engine", string>;
  black: {
    trade_date: string; expiry_date: string; time: number; discount: number; forward: number; strike: number;
    volatility: number; rate: number; std_dev: number;
    formula: { value: number; delta_forward: number; gamma_forward: number; vega: number };
    process: { value: number; delta: number; gamma: number; vega: number; theta: number; rho: number; theta_per_day: number };
    implied_volatility: number;
    by_forward: { forward: number; value: number; delta: number; intrinsic: number }[];
  };
  mc: {
    sequence: string; paths: number; steps: number; seed: number; npv: number; standard_error: number; analytic: number; difference: number;
    convergence: { sequence: string; paths: number; npv: number; standard_error: number }[];
    shown_paths: PathRow[]; terminal_prices: number[];
    terminal_histogram: { xmin: number; xmax: number; x: number; count: number }[];
    one_path: { path_id: number; step: number; time: number; z: number | null; generated_price: number; hand_price: number; difference: number }[];
  };
  bsm: {
    trade_date: string; expiry_date: string; time: number; spot: number; strike: number; volatility: number; rate: number; dividend: number;
    european: { value: number; delta: number; gamma: number; vega: number; theta: number; rho: number };
    european_engines: { method: string; npv: number; difference_from_analytic: number }[];
    american_engines: { method: string; npv: number; difference_from_crr_500: number }[];
    early_exercise_premium: number;
    tree_convergence: { steps: number; european: number; american: number }[];
  };
  lsm: {
    paths: number; steps: number; value: number; standard_error: number; european_value: number; exercise_probability: number;
    unexercised_paths: number; crr_500: number; difference_from_crr_500: number;
    exercise: { step: number; time: number; paths: number; paths_in_table: number }[];
    regressions: { step: number; time: number; in_the_money_paths: number; exercised_paths: number; mean_immediate_value: number;
      mean_realized_continuation: number; exercise_boundary: number | null; too_few_paths: boolean }[];
    shown_paths: PathRow[]; first_paths_sum: number;
  };
  response: ResponseStamp;
}

export type BlackRequest = { black?: Partial<BlackInputs>; mc?: Partial<McInputs>; bsm?: Partial<BsmInputs>; lsm?: Partial<LsmInputs> };

export async function fetchBlack(request: BlackRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<BlackResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/black`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (BlackResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
