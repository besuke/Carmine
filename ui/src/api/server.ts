import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The connection page's API (server/R/server_info.R). The page measures the round trip; the server measures
// one RiemannFinMath call, so the two can be told apart.

export interface ServerRoute { method: "GET" | "POST"; path: string; page: string }

export interface ServerInfo {
  status: "ok";
  engine: { name: string; version: string; library: string };
  runtime: { r_version: string; platform: string; pid: number; logical_processors: number };
  listen: { host: string; port: number; lan: boolean; serves_page: boolean };
  started_at: string;
  server_time: string;
  uptime_seconds: number;
  requests_served: number;
  probe: { calculation: string; repeats: number; seconds_each: number; check_value: number };
  routes: ServerRoute[];
  /** The addresses people on the LAN use: the configured host name first, then this server's LAN addresses. */
  public?: { host: string; source: "config" | "env" | "lan"; port: number; serving: boolean; urls: string[] };
  response: ResponseStamp;
}

export interface ServerCheck { info: ServerInfo; roundTripMs: number; checkedAt: Date }

export async function fetchServerInfo(options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<ServerCheck> {
  const requestId = options.requestId ?? newRequestId();
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/server`, { headers: { "X-Request-Id": requestId }, signal: options.signal, cache: "no-store" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Riemann Compute Server に接続できません。", null);
  }
  const body = (await res.json().catch(() => null)) as (ServerInfo & { error?: string }) | null;
  const roundTripMs = performance.now() - t0;
  if (!res.ok || !body) {
    // The page's own server answers 502/504 when it cannot reach the calculation server behind it.
    if (res.status === 502 || res.status === 504 || (!body && res.status >= 500)) throw new ApiError("Riemann Compute Server に接続できません。", res.status);
    throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  }
  if (body.response?.request_id !== requestId) throw new ApiError("サーバーの応答が要求と対応していません", res.status);
  return { info: body, roundTripMs, checkedAt: new Date() };
}
