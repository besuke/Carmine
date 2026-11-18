import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The yield-curve chapter's API (server/R/curve_model.R): zero-rate nodes to curves. Values are unrounded.

export interface CurvePointRow {
  date: string;
  time: number;
  discount: number;
  zero_continuous: number | null;
  /** One-step forward to the next grid date, continuously compounded (II-2.2.3). */
  forward_step: number | null;
}

export interface CurveTableRow {
  tenor: string;
  date: string;
  discount: number;
  zero_continuous: number | null;
}

export interface CurveBlock {
  table: CurveTableRow[];
  points: CurvePointRow[];
}

/** One row of the single-node simulation: a node or a table tenor, base against bumped. */
export interface ZeroBumpRow {
  tenor: string; date: string; time: number; is_node: boolean; is_bumped: boolean;
  discount_base: number; discount_bumped: number; price_base: number; price_bumped: number; price_change: number; price_change_pct: number;
  zero_base: number | null; zero_bumped: number | null;
}
/** One node's zero rate moved by bp; the ZeroCurve rebuilt (request field `bump`). */
export interface ZeroBump { tenor: string; bp: number; node_date: string; table: ZeroBumpRow[]; points: CurvePointRow[] }

export interface ZeroCurvesResponse {
  evaluation_date: string;
  conventions: { day_count: string; zero_curve: string; discount_curve: string; shift: string; engine: string };
  request: { zeroRatesPct: number[]; shiftBp: number };
  nodes: { tenor: string; date: string; time: number; zero_rate: number }[];
  zero_curve: CurveBlock;
  discount_curve: CurveBlock;
  shifted_curve: CurveBlock;
  /** Present when the request has `bump`. */
  bump?: ZeroBump;
  node_recovery: { tenor: string; date: string; zero_rate: number; zero_curve_implied_rate: number; discount_curve_implied_rate: number; zero_curve_error: number; discount_curve_error: number }[];
  validation: { curve: string; first_date: string; last_date: string; min_discount: number; max_discount: number; nonpositive_discount_count: number; missing_discount_count: number; missing_zero_rate_count: number }[];
  response: ResponseStamp;
}

export async function fetchZeroCurves(
  request: { zeroRatesPct?: number[]; shiftBp?: number; bump?: { tenor: string; bp: number } },
  options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {},
): Promise<ZeroCurvesResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/curves/zero`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (ZeroCurvesResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
