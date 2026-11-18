// Shapes of the R API (server/server.R). All numbers are unrounded doubles from RiemannFinMath.

export interface ScenarioRequest {
  bumpTenor: string;
  bumpBp: number;
}

export interface Conventions {
  index: string;
  calendar: string;
  curve_day_count: string;
  settlement_days: number;
  payment_frequency: number;
  payment_lag: number;
  interpolation: string;
  accuracy: number;
  schedule_rule: string;
  schedule_convention: string;
  fixed_leg_day_count: string;
  pillar: string;
  forward_definition: string;
}

export interface QuoteRow {
  quote_id: string;
  tenor: string;
  rate_base: number;
  rate_scenario: number;
}

export interface Instrument {
  tenor: string;
  rate: number;
  start_date: string;
  maturity_date: string;
  pillar_date: string;
  implied_rate: number;
  reproduction_error: number;
}

export interface Node {
  date: string;
  time: number;
  discount: number;
  /** Continuously compounded zero rate, Actual/365 Fixed; null at the reference date. */
  zero_continuous: number | null;
}

export interface Segment {
  start_date: string;
  end_date: string;
  forward_continuous: number;
}

export interface CurvePoint {
  date: string;
  /** Years from the evaluation date, Actual/365 Fixed. */
  time: number;
  discount: number;
  /** Continuously compounded zero rate, Actual/365 Fixed; null at the reference date. */
  zero_continuous: number | null;
  forward_1d_simple: number;
}

export interface Cashflow {
  leg: "fixed" | "overnight";
  accrual_start: string;
  accrual_end: string;
  payment_date: string;
  amount: number;
  discount: number;
}

export interface SwapValue {
  npv: number;
  fixed_leg_npv: number;
  overnight_leg_npv: number;
  fixed_leg_bps: number;
  par_rate: number;
  cashflows: Cashflow[];
}

export interface CaseResult {
  instruments: Instrument[];
  nodes: Node[];
  segments: Segment[];
  curve_points: CurvePoint[];
  swap: SwapValue;
}

export interface SwapTerms {
  tenor: string;
  side: "payer";
  notional: number;
  fixed_rate: number;
  effective_date: string;
  termination_date: string;
  fixed_rate_source: string;
}

export interface ScenarioResponse {
  api_version: number;
  engine: { name: string; version: string; built: string };
  request: ScenarioRequest;
  evaluation_date: string;
  quote_unit: string;
  quote_source: string;
  conventions: Conventions;
  quotes: QuoteRow[];
  swap_terms: SwapTerms;
  cases: { base: CaseResult; scenario: CaseResult };
  pv_change: number;
  par_change_bp: number;
  /** The request ID the page sent (X-Request-Id), echoed by the server, and when the server computed it. */
  response: { request_id: string; computed_at: string };
}
