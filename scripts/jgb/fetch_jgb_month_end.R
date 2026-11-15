# The month-end JGB compound yields by tenor, for the yield-curve slider (src/components/curves/JgbCurveExplorer.tsx).
#
#   Rscript scripts/jgb/fetch_jgb_month_end.R
#
# Source: Ministry of Finance, Japan, "Interest Rate Historical Data" (jgbcme_all.csv), the same file as Coral Book
# II-2.1. Public data of the Japanese government, used under the Government of Japan Standard Terms of Use
# (compatible with CC BY 4.0); the source is credited on the page. Writes server/data/jgb_curves/: the month-end rows
# (the last observation of each month) in long form, and PROVENANCE.md.

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyr)
  library(stringr)
})

url <- "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv"
out_dir <- file.path("server", "data", "jgb_curves")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

raw <- read_csv(url, skip = 1, col_types = cols(.default = col_character()), na = c("", "-"), show_col_types = FALSE)

yields <- raw |>
  rename(date_text = Date) |>
  pivot_longer(-date_text, names_to = "tenor", values_to = "yield_text") |>
  mutate(
    date = parse_date(date_text, format = "%Y/%m/%d"),
    tenor_years = parse_number(tenor),
    yield_pct = parse_double(yield_text, na = c("", "-"))
  ) |>
  filter(!is.na(date), !is.na(tenor_years), !is.na(yield_pct), date >= as.Date("1990-01-01"))

month_end <- yields |>
  mutate(month = format(date, "%Y%m")) |>
  group_by(month) |>
  filter(date == max(date)) |>
  ungroup() |>
  select(month, date, tenor_years, yield_pct) |>
  arrange(month, tenor_years)

write_csv(month_end, file.path(out_dir, "jgb_month_end.csv"))
writeLines(c(
  "# JGB month-end compound yields",
  "",
  sprintf("Fetched %s from %s (Ministry of Finance, Japan, Interest Rate Historical Data).", format(Sys.time(), "%Y-%m-%d %H:%M %z"), url),
  "Public data of the Japanese government, used under the Government of Japan Standard Terms of Use (compatible with CC BY 4.0).",
  sprintf("jgb_month_end.csv: the last observation of each month from 1990, long form (month, date, tenor_years, yield_pct). %d months, %s to %s.",
          n_distinct(month_end$month), min(month_end$month), max(month_end$month)),
  "Rebuild with: Rscript scripts/jgb/fetch_jgb_month_end.R"
), file.path(out_dir, "PROVENANCE.md"))
message(sprintf("%d rows, %d months (%s to %s) -> %s", nrow(month_end), n_distinct(month_end$month), min(month_end$month),
                max(month_end$month), out_dir))
print(month_end |> count(month) |> summarise(min_tenors = min(n), max_tenors = max(n)))
