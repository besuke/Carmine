# Month-end US Treasury Constant Maturity yields by tenor from FRED, for the yield-curve explorer.
#
#   Rscript server/scripts/jgb/fetch_ust_month_end.R
#
# Source: Board of Governors of the Federal Reserve System (US), H.15 Selected Interest Rates,
# retrieved from FRED, Federal Reserve Bank of St. Louis (https://fred.stlouisfed.org/categories/115).
# Series: DGS1 (1Y), DGS2 (2Y), DGS3 (3Y), DGS5 (5Y), DGS7 (7Y), DGS10 (10Y), DGS20 (20Y), DGS30 (30Y).

suppressPackageStartupMessages({
  library(dplyr)
  library(purrr)
  library(readr)
  library(tidyr)
})

series_map <- tibble::tribble(
  ~series_id, ~tenor_years,
  "DGS1",  1,
  "DGS2",  2,
  "DGS3",  3,
  "DGS5",  5,
  "DGS7",  7,
  "DGS10", 10,
  "DGS20", 20,
  "DGS30", 30
)

out_dir <- file.path("server", "data", "jgb_curves")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

jgb_months <- read_csv(file.path(out_dir, "jgb_month_end.csv"), col_types = cols(month = "c", .default = "c"), show_col_types = FALSE) |>
  distinct(month)

fetch_one <- function(series_id, tenor_years) {
  url <- sprintf("https://fred.stlouisfed.org/graph/fredgraph.csv?id=%s", series_id)
  raw <- read_csv(url, col_types = cols(.default = col_character()), na = c("", ".", "ND"), show_col_types = FALSE)
  names(raw) <- c("date_text", "yield_text")
  raw |>
    mutate(
      date = as.Date(date_text),
      tenor_years = tenor_years,
      yield_pct = suppressWarnings(as.numeric(yield_text))
    ) |>
    filter(!is.na(date), !is.na(yield_pct), date >= as.Date("1990-01-01")) |>
    select(date, tenor_years, yield_pct)
}

yields <- pmap_dfr(series_map, fetch_one)

valid_dates <- yields |>
  count(date) |>
  filter(n >= 5)

month_end <- yields |>
  semi_join(valid_dates, by = "date") |>
  mutate(month = format(date, "%Y%m")) |>
  semi_join(jgb_months, by = "month") |>
  group_by(month) |>
  filter(date == max(date)) |>
  ungroup() |>
  select(month, date, tenor_years, yield_pct) |>
  arrange(month, tenor_years)

write_csv(month_end, file.path(out_dir, "ust_month_end.csv"))
message(sprintf("UST: %d rows, %d months (%s to %s) -> %s/ust_month_end.csv",
                nrow(month_end), n_distinct(month_end$month), min(month_end$month), max(month_end$month), out_dir))
