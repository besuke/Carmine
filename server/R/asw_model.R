# OIS asset swap offer sheet for the LagrangeFinLab API. All calculations are RiemannFinMath.
# Inputs: Curie's demo (fictitious) offers, bond attributes and OIS quotes, copied into server/data/asw_demo.
#
# Conventions follow Curie's A1 demo (reconciled in reconciliation/asw/): OIS curves MonotonicLogCubic,
# annual, payment lag 0, no extrapolation; the ASW overnight leg semiannual, lag 0 (a demo assumption in
# Curie); the swap starts on the bond's settlement date; spread day count = the index's.
#
# ASW (LagrangeFinance docs/asw_offer_sheet_spec.qmd): with dirty price P_d, U = N (P_d/100 - 1),
#   s* = (B - L - R - U D(t,S)) / A
# B bond cash flows after S, L the overnight leg, R the principal at the last overnight payment, A the spread annuity.

suppressPackageStartupMessages(library(RiemannFinMath))

# server.R defines script_dir (the server folder); the data can also be pointed to with LFL_ASW_DATA.
ASW_DATA_DIR <- Sys.getenv("LFL_ASW_DATA", file.path(if (exists("script_dir")) script_dir else "server", "data", "asw_demo"))

asw_read_csv <- function(name) {
  utils::read.csv(file.path(ASW_DATA_DIR, name), stringsAsFactors = FALSE, encoding = "UTF-8", na.strings = c("", "NA"))
}

ASW_CURRENCIES <- list(
  JPY = list(index = "tonar", settlement_days = 2L, day_count = "actual_365_fixed", index_name = "TONAR"),
  USD = list(index = "sofr", settlement_days = 2L, day_count = "actual_360", index_name = "SOFR"),
  EUR = list(index = "estr", settlement_days = 2L, day_count = "actual_360", index_name = "€STR")
)
ASW_CALENDARS <- c(Japan = "japan", UnitedStates_GovernmentBond = "us_government_bond", TARGET = "target")
ASW_DAY_COUNTS <- c(Actual365Fixed = "actual_365_fixed", Thirty360_BondBasis = "thirty_360_bond_basis", ActualActual_Bond = "act_act_isma")
ASW_FREQ_TENOR <- c(`1` = "12M", `2` = "6M", `4` = "3M", `12` = "1M")
ASW_SETTINGS <- list(asw_payment_frequency = 2L, asw_payment_lag = 0L, curve_interpolation = "monotonic_log_cubic",
                     curve_payment_frequency = 1L, curve_payment_lag = 0L, extrapolation = FALSE)

ASW_DATA <- local({
  offers <- asw_read_csv("offers.csv")
  offers$offer_date <- as.Date(offers$offer_date)
  offers$offer_settlementdate <- as.Date(offers$offer_settlementdate)
  attributes <- asw_read_csv("attributes.csv")
  for (col in c("issue_date", "maturity_date", "first_call_date", "attribute_date")) attributes[[col]] <- as.Date(attributes[[col]])
  ois <- lapply(stats::setNames(names(ASW_CURRENCIES), names(ASW_CURRENCIES)), function(ccy) {
    q <- utils::read.delim(file.path(ASW_DATA_DIR, paste0("ois_", ccy, ".txt")), sep = "|", encoding = "UTF-8", stringsAsFactors = FALSE)
    q$marketdate <- as.Date(q$marketdate)
    q
  })
  list(offers = offers, attributes = attributes, ois = ois)
})

ASW_VALUATION_DATE <- as.Date("2026-10-06")

# One curve per currency on the valuation date; a failure is kept with its reason.
ASW_CURVES <- lapply(stats::setNames(names(ASW_CURRENCIES), names(ASW_CURRENCIES)), function(ccy) {
  spec <- ASW_CURRENCIES[[ccy]]
  q <- ASW_DATA$ois[[ccy]]
  q <- q[q$marketdate == ASW_VALUATION_DATE & q$instrument_type == "spot_ois", ]
  if (!nrow(q)) return(list(error = paste0(ccy, " の評価日のOIS気配がない")))
  tryCatch({
    instruments <- RiemannFinMath::create_ois_instruments(q$tenor, q$rate_pct / 100, spec$settlement_days,
                                                          ASW_SETTINGS$curve_payment_frequency, ASW_SETTINGS$curve_payment_lag)
    curve <- RiemannFinMath::bootstrap_ois_curve(ASW_VALUATION_DATE, ASW_VALUATION_DATE, spec$index, spec$day_count, instruments,
                                                 interpolation = ASW_SETTINGS$curve_interpolation)
    rep <- RiemannFinMath::get_quote_repricing(curve)
    list(curve = curve, quotes = q, repricing = rep, last_date = max(rep$pillar_date), quote_time = unique(q$quote_time)[1],
         source = unique(q$source)[1])
  }, error = function(e) list(error = conditionMessage(e)))
})

# Join each offer with the attributes of the same ISIN on the offer date (Curie's "exact" policy), and check
# what the model supports. Returns the reason the offer cannot be computed, or "" .
asw_offer_rows <- function() {
  o <- ASW_DATA$offers
  a <- ASW_DATA$attributes
  lapply(seq_len(nrow(o)), function(i) {
    offer <- as.list(o[i, ])
    hit <- a[a$ISIN == offer$ISIN & a$attribute_date == offer$offer_date, ]
    attr <- if (nrow(hit) == 1L) as.list(hit[1, ]) else NULL
    reason <- if (nrow(hit) == 0L) {
      "銘柄属性がない（同じISIN・オファー日の属性が見つからない）"
    } else if (nrow(hit) > 1L) {
      "銘柄属性が一つに定まらない"
    } else if (!identical(attr$coupon_type, "FIXED")) {
      paste0("未対応：変動利付等（coupon_type = ", attr$coupon_type, "）。固定利付債として代用しない")
    } else if (!is.na(attr$first_call_date)) {
      paste0("未対応：期限前償還条項あり（First Call日 ", attr$first_call_date, "）。オプション価値は扱わない")
    } else if (!isTRUE(attr$redemption == 100)) {
      "未対応：償還額が100ではない"
    } else if (is.null(ASW_CURRENCIES[[attr$currency]])) {
      paste0("未対応の通貨：", attr$currency)
    } else if (!is.null(ASW_CURVES[[attr$currency]]$error)) {
      paste0(attr$currency, " のOISカーブを構築できない：", ASW_CURVES[[attr$currency]]$error)
    } else if (is.na(ASW_CALENDARS[attr$calendar]) || is.na(ASW_DAY_COUNTS[attr$day_count]) ||
               is.na(ASW_FREQ_TENOR[as.character(attr$coupon_frequency)])) {
      "未対応の規約（カレンダー・日数計算・利払回数）"
    } else if (attr$maturity_date > ASW_CURVES[[attr$currency]]$last_date) {
      paste0("満期 ", attr$maturity_date, " がカーブの最後のピラー ", ASW_CURVES[[attr$currency]]$last_date, " より後（外挿しない）")
    } else {
      ""
    }
    list(offer = offer, attr = attr, reason = reason)
  })
}

asw_bond <- function(attr) {
  RiemannFinMath::create_fixed_rate_bond(
    settlement_days = as.integer(attr$settlement_days), face_amount = 100,
    effective_date = attr$issue_date, termination_date = attr$maturity_date,
    tenor = ASW_FREQ_TENOR[[as.character(attr$coupon_frequency)]], calendar = ASW_CALENDARS[[attr$calendar]],
    convention = tolower(attr$schedule_convention), termination_convention = tolower(attr$maturity_convention),
    rule = tolower(attr$date_generation), end_of_month = isTRUE(as.logical(attr$end_of_month)),
    coupon_rate = attr$coupon_rate, day_count = ASW_DAY_COUNTS[[attr$day_count]],
    payment_convention = tolower(attr$payment_convention), redemption = attr$redemption
  )
}

iso <- function(d) format(as.Date(d), "%Y-%m-%d")

# The ASW of one supported offer. detail = TRUE adds cash flows, the curve and the checks.
asw_price <- function(row, detail = FALSE) {
  attr <- row$attr
  offer <- row$offer
  cv <- ASW_CURVES[[attr$currency]]
  bond <- asw_bond(attr)
  settle <- RiemannFinMath::compute_settlement_date(bond, ASW_VALUATION_DATE)
  if (settle != offer$offer_settlementdate) {
    return(list(error = paste0("受渡日の不一致：債券の受渡日 ", settle, "（評価日＋", attr$settlement_days,
                               "営業日）とオファー受渡日 ", offer$offer_settlementdate, " が異なる")))
  }
  v <- RiemannFinMath::compute_ois_asset_swap(bond, offer$offer_price, cv$curve, ASW_VALUATION_DATE,
                                              payment_frequency = ASW_SETTINGS$asw_payment_frequency,
                                              payment_lag = ASW_SETTINGS$asw_payment_lag, on_error = "na")
  if (!is.na(v$error)) return(list(error = paste("計算エラー：", v$error)))
  summary <- list(
    accrued = v$accrued, dirty_price = v$dirty_price, fair_spread_bp = v$fair_spread_bp,
    effective_date = iso(v$effective_date), maturity_date = iso(v$maturity_date), settlement_date = iso(settle)
  )
  if (!detail) return(list(summary = summary))

  curve <- cv$curve
  N <- 100
  # Bond cash flows after the start of the swap, as the ASW pays them
  bcf <- RiemannFinMath::get_bond_cashflows(bond)
  bcf <- bcf[bcf$payment_date > v$effective_date, ]
  bcf_df <- RiemannFinMath::compute_discount(curve, bcf$payment_date)
  # The overnight leg and the spread annuity: an OIS from the start to the maturity, semiannual, lag 0,
  # fixed rate 1 so that its fixed amounts are N * tau (the annuity units).
  swap <- RiemannFinMath::create_ois_swap("receiver", N, v$effective_date, v$maturity_date, ASW_CURRENCIES[[attr$currency]]$index, 1,
                                          fixed_frequency = ASW_SETTINGS$asw_payment_frequency,
                                          overnight_frequency = ASW_SETTINGS$asw_payment_frequency,
                                          payment_lag = ASW_SETTINGS$asw_payment_lag)
  scf <- RiemannFinMath::compute_ois_swap_cashflows(swap, curve, ASW_VALUATION_DATE)
  on <- scf[scf$leg == "overnight", ]
  fx <- scf[scf$leg == "fixed", ]
  on_df <- RiemannFinMath::compute_discount(curve, on$payment_date)
  fx_df <- RiemannFinMath::compute_discount(curve, fx$payment_date)
  start_df <- RiemannFinMath::compute_discount(curve, v$effective_date)
  last_pay <- max(on$payment_date)
  upfront <- N * (v$dirty_price / 100 - 1)
  # Components rebuilt from the cash flows; they must agree with compute_ois_asset_swap
  parts <- list(
    bond_pv = sum(bcf$amount * bcf_df), overnight_pv = sum(on$amount * on_df), annuity = sum(fx$amount * fx_df),
    principal_pv = N * RiemannFinMath::compute_discount(curve, last_pay), upfront_pv = upfront * start_df
  )
  rebuilt_spread <- (parts$bond_pv - parts$overnight_pv - parts$principal_pv - parts$upfront_pv) / parts$annuity
  # Curve for the chart: weekly dates from the valuation date to the bond's maturity (+ the pillars)
  rep <- cv$repricing
  dates <- sort(unique(c(seq(ASW_VALUATION_DATE, as.Date(v$maturity_date) + 30L, by = "1 week"), rep$pillar_date)))
  dates <- dates[dates <= cv$last_date]
  zero <- RiemannFinMath::compute_zero_rate(curve, dates, "actual_365_fixed", "continuous")
  zero[dates == ASW_VALUATION_DATE] <- NA_real_
  spec <- ASW_CURRENCIES[[attr$currency]]
  list(summary = summary, detail = list(
    curve = list(
      currency = attr$currency, index = spec$index_name, day_count = spec$day_count, settlement_days = spec$settlement_days,
      interpolation = ASW_SETTINGS$curve_interpolation, payment_frequency = ASW_SETTINGS$curve_payment_frequency,
      payment_lag = ASW_SETTINGS$curve_payment_lag, extrapolation = ASW_SETTINGS$extrapolation,
      marketdate = iso(ASW_VALUATION_DATE), quote_time = cv$quote_time, source = cv$source,
      quotes = data.frame(tenor = rep$tenor, rate = rep$rate, start_date = iso(rep$start_date), pillar_date = iso(rep$pillar_date),
                          implied_rate = rep$implied_rate, reproduction_error = rep$reproduction_error),
      points = data.frame(date = iso(dates), time = as.numeric(dates - ASW_VALUATION_DATE) / 365,
                          discount = RiemannFinMath::compute_discount(curve, dates), zero_continuous = zero)
    ),
    price = list(
      clean_price = offer$offer_price, accrued = v$accrued, dirty_price = v$dirty_price, upfront = upfront,
      upfront_discount = start_df, upfront_pv = v$upfront_pv, settlement_date = iso(settle),
      accrual_day_count = attr$day_count
    ),
    bond_cashflows = data.frame(payment_date = iso(bcf$payment_date), kind = bcf$kind,
                                accrual_start = ifelse(is.na(bcf$accrual_start), NA, iso(bcf$accrual_start)),
                                accrual_end = ifelse(is.na(bcf$accrual_end), NA, iso(bcf$accrual_end)),
                                amount = bcf$amount, discount = bcf_df, pv = bcf$amount * bcf_df),
    overnight_cashflows = data.frame(accrual_start = iso(on$accrual_start), accrual_end = iso(on$accrual_end),
                                     payment_date = iso(on$payment_date), amount = on$amount, spread_unit = fx$amount,
                                     discount = on_df, pv = on$amount * on_df, spread_unit_pv = fx$amount * fx_df),
    principal = list(payment_date = iso(last_pay), amount = N, discount = RiemannFinMath::compute_discount(curve, last_pay)),
    components = list(
      notional = N, bond_pv = parts$bond_pv, overnight_pv = parts$overnight_pv, principal_pv = parts$principal_pv,
      upfront_pv = parts$upfront_pv, annuity = parts$annuity, fair_spread_bp = v$fair_spread_bp,
      engine = list(bond_leg_pv = v$bond_leg_pv, overnight_leg_pv = v$overnight_leg_pv, principal_pv = v$principal_pv,
                    upfront_pv = v$upfront_pv, spread_annuity = v$spread_annuity, npv_at_zero_spread = v$npv)
    ),
    checks = list(
      rebuilt_spread_bp = rebuilt_spread * 1e4,
      rebuilt_minus_engine_bp = rebuilt_spread * 1e4 - v$fair_spread_bp,
      npv_at_fair_spread = parts$overnight_pv + parts$principal_pv + parts$upfront_pv + v$fair_spread_bp / 1e4 * parts$annuity - parts$bond_pv,
      price_sensitivity_bp_per_price = -N * start_df / 100 / parts$annuity * 1e4
    )
  ))
}

asw_conditions <- function() {
  list(
    valuation_date = iso(ASW_VALUATION_DATE),
    asw_definition = "債券CFを支払い、翌日物（日次複利）＋スプレッドを受け取る。受渡日にダーティ価格と100の差を授受（par-par）",
    asw_overnight_leg = list(payment_frequency = ASW_SETTINGS$asw_payment_frequency, payment_lag = ASW_SETTINGS$asw_payment_lag,
                             note = "半年払い・支払ラグ0は Curie のデモの仮定（実取引の条件は未確定）"),
    curve = list(interpolation = ASW_SETTINGS$curve_interpolation, payment_frequency = ASW_SETTINGS$curve_payment_frequency,
                 payment_lag = ASW_SETTINGS$curve_payment_lag, extrapolation = ASW_SETTINGS$extrapolation),
    attribute_policy = "exact（オファー日と同じ日の属性だけを使う）",
    data_note = "Curie のデモデータ（架空）。実在の銘柄・市場価格ではない",
    engine = paste("RiemannFinMath", as.character(utils::packageVersion("RiemannFinMath")))
  )
}

# GET /api/asw/offers
asw_list <- function() {
  rows <- asw_offer_rows()
  items <- lapply(rows, function(r) {
    o <- r$offer
    a <- r$attr
    res <- if (nzchar(r$reason)) list(error = r$reason) else tryCatch(asw_price(r), error = function(e) list(error = paste("計算エラー：", conditionMessage(e))))
    list(
      offer_id = o$offer_id, book = o$offer_book, ISIN = o$ISIN,
      security_name = if (is.null(a)) o$offer_security_name else a$security_name,
      currency = if (is.null(a)) o$offer_currency else a$currency,
      coupon_rate = if (is.null(a)) NA else a$coupon_rate, maturity_date = if (is.null(a)) NA else iso(a$maturity_date),
      broker = o$broker_names, offer_price = o$offer_price, offer_size = o$offer_size, offer_size_unit = o$offer_size_unit,
      offer_date = iso(o$offer_date), settlement_date = iso(o$offer_settlementdate),
      status = if (!is.null(res$error)) (if (startsWith(res$error, "未対応")) "unsupported" else "failed") else "computed",
      reason = if (is.null(res$error)) "" else res$error,
      fair_spread_bp = if (is.null(res$summary)) NA else res$summary$fair_spread_bp,
      accrued = if (is.null(res$summary)) NA else res$summary$accrued,
      dirty_price = if (is.null(res$summary)) NA else res$summary$dirty_price
    )
  })
  list(conditions = asw_conditions(), offers = items)
}

# GET /api/asw/offers/<id>
asw_detail <- function(offer_id) {
  rows <- asw_offer_rows()
  hit <- Filter(function(r) identical(r$offer$offer_id, offer_id), rows)
  if (!length(hit)) return(NULL)
  r <- hit[[1]]
  res <- if (nzchar(r$reason)) list(error = r$reason) else tryCatch(asw_price(r, detail = TRUE), error = function(e) list(error = paste("計算エラー：", conditionMessage(e))))
  offer <- r$offer
  offer$offer_date <- iso(offer$offer_date)
  offer$offer_settlementdate <- iso(offer$offer_settlementdate)
  attr <- r$attr
  if (!is.null(attr)) for (k in names(attr)) if (inherits(attr[[k]], "Date")) attr[[k]] <- if (is.na(attr[[k]])) NA else iso(attr[[k]])
  list(conditions = asw_conditions(), offer = offer, attributes = attr,
       status = if (is.null(res$error)) "computed" else if (startsWith(res$error, "未対応")) "unsupported" else "failed",
       reason = if (is.null(res$error)) "" else res$error, summary = res$summary, detail = res$detail)
}
