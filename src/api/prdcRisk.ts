import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// Part III's page (server/R/prdc_risk_model.R): the PRDC of III-7 by automatic differentiation, on threads, and in
// jobs sent by the browser. Money in yen on a notional of 100 million.

export interface RiskInputs { market: { spot: number; volPct: number }; mc: { paths: number; seed: number }; threads: { paths: number } }

export interface PrdcRiskResponse {
  inputs: RiskInputs;
  note: { notional: number; reference_fx: number; fixed_coupon: number; leverage: number; cap: number; floor: number;
    curve: { year: number; date: string; jpy_rate: number; foreign_rate: number }[] };
  payoff: { fx: number; coupon: number }[];
  machine: { logical_processors: number };
  conventions: Record<"note" | "ad" | "engine", string>;
  ad: {
    npv: number;
    per_year: { year: number; jpy_rate_per_bp: number; foreign_rate_per_bp: number }[];
    table: { factor: string; automatic_differentiation: number; bump_and_revalue: number; difference: number }[];
    evaluations: { automatic_differentiation: number; bump_and_revalue: number };
    seconds: { automatic_differentiation: number; bump_and_revalue: number };
  };
  mc: { paths: number; seed: number; npv: number; standard_error: number; fx_delta: number; fx_vega: number;
    curve: { curve: string; year: number; npv_per_bp: number }[] };
  threads: { paths: number; table: { threads: number; seconds: number; npv: number; fx_delta: number; standard_error: number; speedup: number; difference_from_one_thread: number }[] };
  response: ResponseStamp;
}

export interface JobScenario { id: number; spot: number; volPct: number }
export interface JobResponse {
  results: { id: number; spot: number; volPct: number; npv: number; fx_delta: number; fx_vega: number }[];
  server_seconds: number; worker: string; response: ResponseStamp;
}

async function post<T extends { response: ResponseStamp }>(url: string, body: unknown, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string }): Promise<T> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new ApiError(data?.error ?? `HTTP ${res.status}`, res.status);
  if (data.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return data;
}

export const fetchPrdcRisk = (request: Partial<{ [K in keyof RiskInputs]: Partial<RiskInputs[K]> }>, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}) =>
  post<PrdcRiskResponse>("/api/prdc-risk", request, options);

export const runPrdcJob = (scenarios: JobScenario[], options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}) =>
  post<JobResponse>("/api/prdc-risk/job", { scenarios }, options);
