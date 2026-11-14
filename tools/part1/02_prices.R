# Monthly stock prices and returns of the universe, with tidyquant (Yahoo Finance, tickers such as 8306.T).
#
#   Rscript tools/part1/02_prices.R
#
# Reads market_data/universe/universe.csv; writes market_data/prices/ (ignored by git: prices from Yahoo Finance
# are not redistributed): daily.csv as fetched, and monthly.csv with the month-end adjusted price and the monthly
# return from it. The adjusted price includes splits and dividends.

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyquant)
})

from <- "2019-01-01"
out_dir <- file.path("market_data", "prices")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
universe <- read_csv(file.path("market_data", "universe", "universe.csv"), col_types = cols(.default = col_character()),
                     show_col_types = FALSE)

daily <- tq_get(universe$ticker, get = "stock.prices", from = from) |>
  rename(ticker = symbol)
missing <- setdiff(universe$ticker, unique(daily$ticker))
if (length(missing)) warning("no prices for ", paste(missing, collapse = ", "))

monthly <- daily |>
  group_by(ticker) |>
  tq_transmute(select = adjusted, mutate_fun = to.monthly, indexAt = "lastof", col_rename = "adjusted") |>
  arrange(date, .by_group = TRUE) |>
  mutate(monthly_return = adjusted / lag(adjusted) - 1) |>
  ungroup() |>
  left_join(universe |> select(ticker, code, name), by = "ticker") |>
  select(code, ticker, name, month_end = date, adjusted, monthly_return)

write_csv(daily, file.path(out_dir, "daily.csv"))
write_csv(monthly, file.path(out_dir, "monthly.csv"))
writeLines(c(
  "# Stock prices (local, not committed)",
  "",
  sprintf("Fetched %s with tidyquant %s (Yahoo Finance) from %s, %d tickers.", format(Sys.time(), "%Y-%m-%d %H:%M %z"),
          as.character(packageVersion("tidyquant")), from, length(unique(daily$ticker))),
  "daily.csv: as fetched (open, high, low, close, volume, adjusted). monthly.csv: month-end adjusted price and the return from it."
), file.path(out_dir, "PROVENANCE.md"))
message(sprintf("%d daily rows, %d monthly rows -> %s", nrow(daily), nrow(monthly), out_dir))
print(monthly |> group_by(code, name) |> summarise(months = n(), first = min(month_end), last = max(month_end),
                                                   mean_return = mean(monthly_return, na.rm = TRUE), .groups = "drop"))
