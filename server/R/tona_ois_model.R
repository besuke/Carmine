# JPY TONA OIS model for the Carmine Studio API. All calculations are RiemannFinMath (R, native build).
# Inputs (13 quotes, evaluation date, conventions, 7Y OIS terms) are held here, on the R side.
#
# The conditions are those reconciled against GaussQuant (QuantLib 1.42) in reconciliation/RECONCILIATION.md:
# set `without_7y`, interpolation `log_linear`.

suppressPackageStartupMessages({
  library(RiemannFinMath)
  library(GaussQuant) # only for the sample quotes
})

TONA_MODEL <- local({
  evaluation_date <- as.Date("2026-09-10")
  q <- GaussQuant::bluegamma_tonar_quotes_GQL()
  q <- q[q$quote_id != "TONAR-7Y", ]
  quotes <- data.frame(
    quote_id = q$quote_id,
    tenor = paste0(q$tenor_n, ifelse(q$tenor_unit == "Years", "Y", "M")),
    rate = q$rate,
    stringsAsFactors = FALSE
  )
  stopifnot(nrow(quotes) == 13L)
  list(
    evaluation_date = evaluation_date,
    quotes = quotes,
    quote_source = "GaussQuant::bluegamma_tonar_quotes_GQL() without TONAR-7Y (sample data, BlueGamma TONAR OIS as of 2026-09-10)",
    conventions = list(
      index = "tonar", calendar = "japan", curve_day_count = "actual_365_fixed", settlement_days = 2L,
      payment_frequency = 1L, payment_lag = 0L, interpolation = "log_linear", accuracy = 1e-12,
      schedule_rule = "backward", schedule_convention = "modified_following",
      fixed_leg_day_count = "actual_365_fixed", pillar = "last_relevant_date",
      forward_definition = "1-day simple forward, Actual/365 Fixed: (P(d)/P(d+1) - 1) / (1/365)"
    ),
    swap = list(tenor = "7Y", years = 7L, side = "payer", notional = 1e10),
    max_abs_bump_bp = 100
  )
})

tona_build_curve <- function(rates, interpolation = "log_linear") {
  cv <- TONA_MODEL$conventions
  instruments <- RiemannFinMath::create_ois_instruments(
    TONA_MODEL$quotes$tenor, rates, cv$settlement_days, cv$payment_frequency, cv$payment_lag
  )
  RiemannFinMath::bootstrap_ois_curve(
    TONA_MODEL$evaluation_date, TONA_MODEL$evaluation_date, cv$index, cv$curve_day_count, instruments,
    interpolation = interpolation, accuracy = cv$accuracy
  )
}

# 7Y OIS dates with QuantLib MakeOIS's rule on Riemann's calendar functions (see RECONCILIATION.md 6 #1).
TONA_SWAP_DATES <- local({
  ev <- TONA_MODEL$evaluation_date
  spot <- RiemannFinMath::compute_advanced_date("japan", RiemannFinMath::compute_adjusted_date("japan", ev), "2D")
  if (RiemannFinMath::compute_end_of_month("japan", spot) == spot) stop("An end-of-month start is not supported.")
  list(effective = spot, termination = seq(spot, by = paste(TONA_MODEL$swap$years, "years"), length.out = 2L)[2L])
})

tona_make_swap <- function(fixed_rate) {
  RiemannFinMath::create_ois_swap(
    TONA_MODEL$swap$side, TONA_MODEL$swap$notional, TONA_SWAP_DATES$effective, TONA_SWAP_DATES$termination,
    "tonar", fixed_rate, fixed_frequency = 1L, overnight_frequency = 1L, payment_lag = 0L
  )
}

# Dates for the curve: weekly to 30Y for the charts, plus the dates of the regression values
# (monthly grid, key anniversaries, pillars and their neighbours, swap dates).
tona_curve_dates <- function(pillars) {
  ev <- TONA_MODEL$evaluation_date
  end <- as.Date("2056-09-10")
  key <- do.call(c, lapply(c(1L, 2L, 3L, 4L, 5L, 7L, 10L, 15L, 20L, 30L), function(n) seq(ev, by = paste(n, "years"), length.out = 2L)[2L]))
  d <- sort(unique(c(seq(ev, end, by = "1 week"), seq(ev, end, by = "1 month"), key, pillars, pillars - 1L, pillars + 1L,
                     TONA_SWAP_DATES$effective, TONA_SWAP_DATES$termination)))
  d[d + 1L <= max(pillars)] # no extrapolation
}

iso <- function(d) format(as.Date(d), "%Y-%m-%d")

tona_case <- function(rates, interpolation = "log_linear", fixed_rate = NULL) {
  ev <- TONA_MODEL$evaluation_date
  curve <- tona_build_curve(rates, interpolation)
  rep <- RiemannFinMath::get_quote_repricing(curve)
  nodes <- RiemannFinMath::get_discount_nodes(curve)
  dates <- tona_curve_dates(rep$pillar_date)
  disc <- RiemannFinMath::compute_discount(curve, dates)
  fwd <- RiemannFinMath::compute_forward_rate(curve, dates, dates + 1L, "actual_365_fixed", "simple")
  node_t <- as.numeric(nodes$date - ev) / 365
  # Continuously compounded zero rate, Actual/365 Fixed. Undefined at the reference date (t = 0): NA -> null.
  zero_at <- function(d) {
    z <- RiemannFinMath::compute_zero_rate(curve, d, "actual_365_fixed", "continuous")
    z[d == ev] <- NA_real_
    z
  }
  seg_fwd <- log(nodes$discount[-nrow(nodes)] / nodes$discount[-1L]) / diff(node_t)
  swap_rate <- if (is.null(fixed_rate)) RiemannFinMath::compute_ois_swap_value(tona_make_swap(0), curve, ev)$fair_rate else fixed_rate
  swap <- tona_make_swap(swap_rate)
  value <- RiemannFinMath::compute_ois_swap_value(swap, curve, ev)
  flows <- RiemannFinMath::compute_ois_swap_cashflows(swap, curve, ev)
  if (any(!is.na(flows$error))) stop("A cash flow could not be computed.")
  flow_df <- RiemannFinMath::compute_discount(curve, flows$payment_date)
  list(
    # data frames serialise as arrays of row objects
    instruments = data.frame(
      tenor = rep$tenor, rate = rep$rate, start_date = iso(rep$start_date), maturity_date = iso(rep$maturity_date),
      pillar_date = iso(rep$pillar_date), implied_rate = rep$implied_rate, reproduction_error = rep$reproduction_error
    ),
    nodes = data.frame(date = iso(nodes$date), time = node_t, discount = nodes$discount, zero_continuous = zero_at(nodes$date)),
    segments = data.frame(start_date = iso(nodes$date[-nrow(nodes)]), end_date = iso(nodes$date[-1L]), forward_continuous = seg_fwd),
    curve_points = data.frame(date = iso(dates), time = as.numeric(dates - ev) / 365, discount = disc,
                              zero_continuous = zero_at(dates), forward_1d_simple = fwd),
    swap = list(
      npv = value$npv, fixed_leg_npv = value$fixed_leg_npv, overnight_leg_npv = value$overnight_leg_npv,
      fixed_leg_bps = value$fixed_leg_bps, par_rate = value$fair_rate,
      cashflows = data.frame(
        leg = flows$leg, accrual_start = iso(flows$accrual_start), accrual_end = iso(flows$accrual_end),
        payment_date = iso(flows$payment_date), amount = flows$amount, discount = flow_df
      )
    )
  )
}

# The whole response for one request. Errors from validation carry class "tona_bad_request".
tona_compute_scenario <- function(bump_tenor, bump_bp, interpolation = "log_linear") {
  bad <- function(msg) stop(structure(class = c("tona_bad_request", "error", "condition"), list(message = msg, call = NULL)))
  if (!is.character(bump_tenor) || length(bump_tenor) != 1L || !(bump_tenor %in% TONA_MODEL$quotes$tenor)) {
    bad(paste0("bumpTenor must be one of: ", paste(TONA_MODEL$quotes$tenor, collapse = ", ")))
  }
  if (!is.numeric(bump_bp) || length(bump_bp) != 1L || !is.finite(bump_bp) || abs(bump_bp) > TONA_MODEL$max_abs_bump_bp) {
    bad(paste0("bumpBp must be a finite number with |bumpBp| <= ", TONA_MODEL$max_abs_bump_bp))
  }
  if (!is.character(interpolation) || length(interpolation) != 1L || !(interpolation %in% c("log_linear", "monotonic_log_cubic"))) {
    bad("interpolation must be 'log_linear' or 'monotonic_log_cubic'")
  }
  q <- TONA_MODEL$quotes
  scenario_rates <- q$rate
  scenario_rates[q$tenor == bump_tenor] <- scenario_rates[q$tenor == bump_tenor] + bump_bp * 1e-4

  base_curve <- tona_build_curve(q$rate, interpolation)
  fixed_rate <- RiemannFinMath::compute_ois_swap_value(tona_make_swap(0), base_curve, TONA_MODEL$evaluation_date)$fair_rate

  base <- tona_case(q$rate, interpolation, fixed_rate)
  scenario <- if (identical(scenario_rates, q$rate)) base else tona_case(scenario_rates, interpolation, fixed_rate)

  conv <- TONA_MODEL$conventions
  conv$interpolation <- interpolation

  list(
    api_version = 1L,
    engine = list(name = "RiemannFinMath", version = as.character(utils::packageVersion("RiemannFinMath")),
                  built = utils::packageDescription("RiemannFinMath")$Built),
    request = list(bumpTenor = bump_tenor, bumpBp = bump_bp, interpolation = interpolation),
    evaluation_date = iso(TONA_MODEL$evaluation_date),
    quote_unit = "decimal rate (0.0224 = 2.24%)",
    quote_source = TONA_MODEL$quote_source,
    conventions = conv,
    quotes = data.frame(quote_id = q$quote_id, tenor = q$tenor, rate_base = q$rate, rate_scenario = scenario_rates),
    swap_terms = list(
      tenor = TONA_MODEL$swap$tenor, side = TONA_MODEL$swap$side, notional = TONA_MODEL$swap$notional, fixed_rate = fixed_rate,
      effective_date = iso(TONA_SWAP_DATES$effective), termination_date = iso(TONA_SWAP_DATES$termination),
      fixed_rate_source = "unrounded 7Y par rate of the base curve"
    ),
    cases = list(base = base, scenario = scenario),
    pv_change = scenario$swap$npv - base$swap$npv,
    par_change_bp = 1e4 * (scenario$swap$par_rate - base$swap$par_rate)
  )
}

tona_to_json <- function(x) jsonlite::toJSON(x, auto_unbox = TRUE, digits = I(17), null = "null", na = "null")
