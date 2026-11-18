import { ApiError, newRequestId } from "./client";
import type { ResponseStamp } from "./asw";

// The calibration chapter's API (server/R/calibration_model.R). Rates and volatilities as decimals; option prices per
// unit of notional (bond options: per bond worth 1).

export interface NormalInputs { forwardPct: number; blackVolPct: number; normalVolBp: number; expiry: number }
export interface SabrInputs { beta: number }
export interface HwInputs { aPct: number; sigmaPct: number; zeroPct: number }
export interface BgmInputs { decay: number }

export interface CalibrationResponse {
  inputs: { normal: NormalInputs; sabr: SabrInputs; hw: HwInputs; bgm: BgmInputs };
  conventions: Record<"normal" | "sabr" | "hw" | "bgm" | "engine", string>;
  normal: {
    forward: number; expiry: number; black_volatility: number; normal_volatility: number;
    by_strike: { strike: number; normal: number; black: number | null }[];
    atm: { normal: number; black: number | null }; atm_normal_equivalent_bp: number;
  };
  sabr: {
    forward: number; expiry: number; beta: number;
    quotes: { strike: number; market: number; manuscript_fit: number; riemann_fit: number }[];
    fits: { method: string; alpha: number; nu: number; rho: number; rmse: number; iterations: number; convergence: number }[];
    smile: { strike: number; manuscript_fit: number; riemann_fit: number }[];
  };
  hw: {
    zero_rate: number; reference: { a: number; sigma: number };
    options: { option_maturity: number; bond_maturity: number; strike_multiplier: number; sample: string; strike: number;
      market_price: number; manuscript_price: number; riemann_price: number }[];
    fits: { method: string; a: number; sigma: number; objective: number; evaluations: number | null; convergence: number }[];
    objective_slice: { a: number; objective: number }[];
  };
  bgm: {
    tenor: number[]; caplet_vol: number[]; weights: number[]; decay: number; proxy_vol: number; fitted_decay: number;
    lmm_forward: number; rebonato_vol: number; rebonato_fitted_decay: number;
    by_decay: { decay: number; proxy: number; rebonato: number }[];
  };
  response: ResponseStamp;
}

export type CalibrationRequest = { normal?: Partial<NormalInputs>; sabr?: Partial<SabrInputs>; hw?: Partial<HwInputs>; bgm?: Partial<BgmInputs> };

export async function fetchCalibration(request: CalibrationRequest, options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {}): Promise<CalibrationResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/calibration`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。npm run api で起動してください。", null);
  }
  const body = (await res.json().catch(() => null)) as (CalibrationResponse & { error?: string }) | null;
  if (!res.ok || !body) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  if (body.response?.request_id !== requestId) throw new ApiError("APIの応答が要求と対応していません", res.status);
  return body;
}
