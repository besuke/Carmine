import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The parallel computing chapter's API (server/R/parallel_model.R). Times are measured on the server.

export interface BatchInputs { count: number; maxThreads: number }

export interface ParallelResponse {
  inputs: { batch: BatchInputs };
  machine: { logical_processors: number; r_version: string };
  conventions: Record<"example" | "batch" | "engine", string>;
  example: { scenario_ID: number; cashflow: number; discount_rate: number; maturity: number; present_value: number }[];
  batch: {
    count: number;
    timing: { threads: number; seconds: number; bonds_per_second: number; max_abs_diff_from_one_thread: number; errors: number; speedup: number }[];
    sample: { yield: number; clean_price: number; duration_modified: number; basis_point_value: number }[];
    price_by_yield: { yield: number; clean_price: number }[];
  };
  response: ResponseStamp;
}

export async function fetchParallel(request: { batch?: Partial<BatchInputs> }, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<ParallelResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/parallel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (ParallelResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
