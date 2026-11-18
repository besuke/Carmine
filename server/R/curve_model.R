# Zero-rate nodes to curves, for the yield-curve chapter (Coral Book II-2.2, II-2.3.1, II-2.5.2, II-2.5.3).
# All calculations are RiemannFinMath; reconciled with GaussQuant in tests/reconciliation/curves/ (difference 0).
#
# POST /api/curves/zero  {"zeroRatesPct": [9 numbers, or omitted for the manuscript's], "shiftBp": 50}
#   ZeroCurve      : zero rates linear in time (QuantLib ZeroCurve), continuous, Actual/365 Fixed
#   DiscountCurve  : the nodes' zero rates turned into discount factors, log-linear (QuantLib DiscountCurve)
#   shifted curve  : ZeroCurve + shift, the spread compounding simple and annual (GaussQuant's default in II-2.5.2)

CURVE_MODEL <- list(
  evaluation_date = as.Date("2022-08-19"),
  tenors = c("0D", "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "10Y"),
  dates = as.Date(c("2022-08-19", "2022-09-19", "2022-11-21", "2023-02-20", "2023-08-21", "2024-08-19", "2025-08-19", "2027-08-19", "2032-08-19")),
  zero_rates = c(0.0005, 0.0006, 0.0008, 0.0011, 0.0018, 0.0032, 0.0048, 0.0075, 0.0115),
  table_tenors = c("1D", "1W", "1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y"),
  max_abs_rate = 0.2, max_abs_shift_bp = 500
)

# Date + period as QuantLib's Date + Period (calendar days, months with end-of-month clamping, no business days)
curve_add_tenor <- function(d, tenor) {
  n <- as.integer(sub("[DWMY]$", "", tenor))
  u <- sub("^[0-9]+", "", tenor)
  if (u == "D") return(d + n)
  if (u == "W") return(d + 7L * n)
  months <- if (u == "M") n else 12L * n
  y <- as.integer(format(d, "%Y")); m <- as.integer(format(d, "%m")) + months; dd <- as.integer(format(d, "%d"))
  y <- y + (m - 1L) %/% 12L; m <- (m - 1L) %% 12L + 1L
  last <- as.integer(format(seq(as.Date(sprintf("%d-%02d-01", y, m)), by = "1 month", length.out = 2L)[2L] - 1L, "%d"))
  as.Date(sprintf("%d-%02d-%02d", y, m, min(dd, last)))
}

curve_points <- function(curve, dates, ev) {
  t <- as.numeric(dates - ev) / 365
  df <- RiemannFinMath::compute_discount(curve, dates)
  zero <- ifelse(t > 0, -log(df) / t, NA_real_)
  # one-step forward between neighbouring grid dates, as in II-2.2.3: -log(D(t2)/D(t1)) / (t2 - t1)
  fwd <- c(-log(df[-1] / df[-length(df)]) / diff(t), NA_real_)
  data.frame(date = format(dates), time = t, discount = df, zero_continuous = zero, forward_step = fwd)
}

curve_compute <- function(zero_rates_pct = NULL, shift_bp = 50) {
  bad <- function(msg) stop(structure(class = c("tona_bad_request", "error", "condition"), list(message = msg, call = NULL)))
  m <- CURVE_MODEL
  rates <- if (is.null(zero_rates_pct)) m$zero_rates else {
    if (!is.numeric(zero_rates_pct) || length(zero_rates_pct) != length(m$dates) || any(!is.finite(zero_rates_pct)) ||
        any(abs(zero_rates_pct) > 100 * m$max_abs_rate)) bad(paste0("zeroRatesPct must be ", length(m$dates), " finite numbers within ±", 100 * m$max_abs_rate))
    zero_rates_pct / 100
  }
  if (!is.numeric(shift_bp) || length(shift_bp) != 1L || !is.finite(shift_bp) || abs(shift_bp) > m$max_abs_shift_bp) {
    bad(paste0("shiftBp must be a finite number with |shiftBp| <= ", m$max_abs_shift_bp))
  }
  ev <- m$evaluation_date
  t_nodes <- as.numeric(m$dates - ev) / 365
  zc <- RiemannFinMath::with_extrapolation(RiemannFinMath::create_zero_curve(m$dates, rates, "actual_365_fixed", "continuous"))
  dcv <- RiemannFinMath::with_extrapolation(RiemannFinMath::create_discount_curve(m$dates, exp(-rates * t_nodes), "actual_365_fixed", "log_linear"))
  shifted <- RiemannFinMath::create_zero_spreaded_curve(zc, shift_bp / 1e4, "simple", 1L)
  grid_t <- seq(0, max(t_nodes), length.out = 300)
  grid <- ev + round(grid_t * 365)
  grid <- sort(unique(c(grid, m$dates)))
  tdates <- do.call(c, lapply(m$table_tenors, function(x) curve_add_tenor(ev, x)))
  table <- function(curve) {
    p <- curve_points(curve, tdates, ev)
    data.frame(tenor = m$table_tenors, date = p$date, discount = p$discount, zero_continuous = p$zero_continuous)
  }
  zc_nodes <- RiemannFinMath::compute_discount(zc, m$dates)
  dc_nodes <- RiemannFinMath::compute_discount(dcv, m$dates)
  recovered <- function(df) ifelse(t_nodes > 0, -log(df) / t_nodes, rates)
  validation <- function(name, curve) {
    p <- curve_points(curve, grid, ev)
    list(curve = name, first_date = p$date[1], last_date = p$date[nrow(p)], min_discount = min(p$discount), max_discount = max(p$discount),
         nonpositive_discount_count = sum(p$discount <= 0), missing_discount_count = sum(is.na(p$discount)),
         missing_zero_rate_count = sum(is.na(p$zero_continuous[-1])))
  }
  list(
    evaluation_date = format(ev),
    conventions = list(day_count = "Actual/365 Fixed", zero_curve = "ゼロ金利を時間について線形補間（QuantLib ZeroCurve、連続複利）",
                       discount_curve = "ノードのゼロ金利を割引係数に直し、対数線形補間（QuantLib DiscountCurve）",
                       shift = "ゼロ金利に単利・年1回の複利で一定のスプレッドを加える（QuantLib ZeroSpreadedTermStructure、GaussQuant の既定）",
                       engine = paste("RiemannFinMath", as.character(utils::packageVersion("RiemannFinMath")))),
    request = list(zeroRatesPct = I(rates * 100), shiftBp = shift_bp),
    nodes = data.frame(tenor = m$tenors, date = format(m$dates), time = t_nodes, zero_rate = rates),
    zero_curve = list(table = table(zc), points = curve_points(zc, grid, ev)),
    discount_curve = list(table = table(dcv), points = curve_points(dcv, grid, ev)),
    shifted_curve = list(table = table(shifted), points = curve_points(shifted, grid, ev)),
    node_recovery = data.frame(tenor = m$tenors, date = format(m$dates), zero_rate = rates,
                               zero_curve_implied_rate = recovered(zc_nodes), discount_curve_implied_rate = recovered(dc_nodes),
                               zero_curve_error = recovered(zc_nodes) - rates, discount_curve_error = recovered(dc_nodes) - rates),
    validation = list(validation("ZeroCurve", zc), validation("DiscountCurve", dcv), validation(sprintf("ZeroCurve %+gbp", shift_bp), shifted))
  )
}
