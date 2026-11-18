import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The interest-rate models chapter's API (server/R/rate_models_model.R). Rates as decimals; caplet prices per unit of
// notional.

export interface HwInputs { ratePct: number; aPct: number; sigmaPct: number }
export interface CapletInputs { forwardPct: number; strikePct: number; volPct: number; expiry: number; accrual: number; ratePct: number }
export interface ShockInputs { ab: number; ac: number; bc: number }
export interface FixingInputs { basePct: number; amplitudePct: number; days: number }

export interface RateModelsResponse {
  inputs: { hw: HwInputs; caplet: CapletInputs; shocks: ShockInputs; fixings: FixingInputs };
  conventions: Record<"hw" | "caplet" | "shocks" | "fixings" | "engine", string>;
  hw: {
    flat_rate: number; a: number; sigma: number; steps_per_year: number; paths: number; seed: number;
    times: number[]; sample_paths: number[][]; mean_path: number[]; quantile_05: number[]; quantile_95: number[]; shift: number[];
    riemann_sample_paths: (number | null)[][]; riemann_times: number[];
    discount_check: { model: string; maturity: number; initial_curve: number; simulation: number; mc_standard_error: number; difference: number }[];
    hjm_loading: { time_to_maturity: number; forward_volatility: number }[];
  };
  caplet: {
    forward: number; strike: number; volatility: number; expiry: number; accrual: number; discount_factor: number; paths: number; seed: number;
    black_price: number; simulated_price: number; mc_standard_error: number; in_the_money: number; terminal_mean: number;
    terminal_histogram: { xmin: number; xmax: number; x: number; count: number }[]; backward_price: number;
  };
  shocks: {
    paths: number; seed: number; table: { forward_1: string; forward_2: string; target: number; simulated: number }[];
    eigenvalues: number[]; scatter: { a: number; b: number; c: number }[];
  };
  fixings: {
    days: number; compounded_rate: number; simple_average: number;
    daily: { observation: number; overnight_rate: number; realized_factor: number; realized_rate_to_date: number }[];
  };
  response: ResponseStamp;
}

export type RateModelsRequest = { hw?: Partial<HwInputs>; caplet?: Partial<CapletInputs>; shocks?: Partial<ShockInputs>; fixings?: Partial<FixingInputs> };

export async function fetchRateModels(request: RateModelsRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<RateModelsResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/rate-models`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (RateModelsResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
