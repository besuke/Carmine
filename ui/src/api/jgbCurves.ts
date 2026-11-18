import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The yield-curve explorer's API (server/R/jgb_curve_model.R): every month-end JGB and US Treasury curve,
// built by rmql on the server. The page fetches them once and reuses them while the reader moves
// the slider or plays the months.

export interface JgbMonth {
  month: string; // YYYYMM
  date: string; // the month's last observation
  node_tenor: number[];
  node_yield_pct: number[];
  curve_yield_pct: number[]; // at curve_step, 2 curve_step, ...
}

export interface MarketCurveDataset {
  months: JgbMonth[];
  curve_step: number;
  axis: { x_max: number; y_min: number; y_max: number };
  conventions: {
    source: string;
    source_url?: string;
    data_url?: string;
    curve: string;
    engine: string;
  };
}

export interface JgbCurvesResponse extends MarketCurveDataset {
  ust?: MarketCurveDataset;
  response: ResponseStamp;
}

export async function fetchJgbCurves(options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<JgbCurvesResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/jgb-curves`, { headers: { "X-Request-Id": requestId }, signal: options.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (JgbCurvesResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
