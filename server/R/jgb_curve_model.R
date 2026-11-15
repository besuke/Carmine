# Month-end JGB yield curves for the yield-curve slider (GET /api/jgb-curves). The yields are the Ministry of
# Finance's month-end compound yields (server/data/jgb_curves/, scripts/jgb/fetch_jgb_month_end.R). Each month's
# curve is built by RiemannFinMath: the yields become discount factors (1 + y)^-t at their tenors, a monotonic
# log-cubic discount curve runs through them, and its annually compounded zero rates are read every half year.
# All months are computed once, on the first request, and kept: the page fetches them together and reuses them
# while the reader moves the slider or plays the months.

JGB_CURVE_FILE <- file.path(script_dir, "data", "jgb_curves", "jgb_month_end.csv")
JGB_CURVES <- new.env()

jgb_month_curve <- function(rows) {
  ref <- as.Date(rows$date[1])
  tenors <- rows$tenor_years
  node_dates <- ref + round(365.25 * tenors)
  t <- as.numeric(node_dates - ref) / 365
  df <- (1 + rows$yield_pct / 100)^(-t)
  curve <- RiemannFinMath::with_extrapolation(
    RiemannFinMath::create_discount_curve(c(ref, node_dates), c(1, df), "actual_365_fixed", "monotonic_log_cubic")
  )
  grid <- seq(0.5, max(tenors), by = 0.5)
  grid_dates <- ref + round(365.25 * grid)
  zero <- RiemannFinMath::compute_zero_rate(curve, grid_dates, "actual_365_fixed", "compounded", 1L)
  # columns, to keep the response small: the curve's tenors are 0.5, 1.0, ... (curve_step)
  list(month = rows$month[1], date = format(ref), node_tenor = tenors, node_yield_pct = rows$yield_pct,
       curve_yield_pct = round(100 * zero, 4))
}

jgb_curves <- function() {
  if (!is.null(JGB_CURVES$value)) return(JGB_CURVES$value)
  months <- readr::read_csv(JGB_CURVE_FILE, col_types = readr::cols(month = "c", date = "c", .default = "d")) |>
    dplyr::arrange(month, tenor_years) |>
    dplyr::group_split(month) |>
    purrr::map(jgb_month_curve)
  all_y <- purrr::map(months, \(m) c(m$curve_yield_pct, m$node_yield_pct)) |> purrr::list_c()
  JGB_CURVES$value <- list(
    months = months,
    curve_step = 0.5,
    axis = list(x_max = 40, y_min = floor(min(all_y) * 2) / 2, y_max = ceiling(max(all_y) * 2) / 2),
    conventions = list(
      source = "財務省「国債金利情報」（Interest Rate Historical Data、jgbcme_all.csv）の各月の最終観測日の複利利回り",
      curve = "各年限の複利利回りを割引係数 (1+y)^-t にし、RiemannFinMath の単調な対数3次補間の割引カーブ（create_discount_curve）を通して、0.5年刻みの年複利のゼロ金利を読む",
      engine = paste("RiemannFinMath", as.character(utils::packageVersion("RiemannFinMath")))
    )
  )
  JGB_CURVES$value
}
