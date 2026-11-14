# Copy Curie's ASW offer-sheet demo (fictitious data) into LagrangeFinLab, so the API does not read Curie at run time.
#
#   node scripts/run-r.mjs scripts/asw/snapshot_curie_demo.R
#
# Writes
#   server/data/asw_demo/offers.csv       offers as Curie's converter read them from the demo Excel books
#                                          (Curie output/work/{JPY,ISO}/offers_standard_*_20261006.xlsx)
#   server/data/asw_demo/attributes.csv   bond attributes (Curie data/demo/attributes/demo_attributes_20261006.rds)
#   server/data/asw_demo/ois_{JPY,USD,EUR}.txt  OIS quotes, copied unchanged (Curie data/demo/market)
#   server/data/asw_demo/PROVENANCE.md    sources, Curie commit, file times and SHA-256
#   tests/golden/asw_curie_demo_results.json  the old demo results (Curie output/offer_results_*_demo_20261006.xlsx)
# Curie is only read.

suppressPackageStartupMessages({ library(dplyr); library(readxl); library(jsonlite) })

curie <- "C:/AnalyticFin/Projects/Curie"
root <- "C:/AnalyticFin/Projects/LagrangeFinLab"
data_dir <- file.path(root, "server/data/asw_demo")
dir.create(data_dir, recursive = TRUE, showWarnings = FALSE)

src <- list(
  offers_jpy = "output/work/JPY/offers_standard_JPY_20261006.xlsx",
  offers_iso = "output/work/ISO/offers_standard_ISO_20261006.xlsx",
  attributes = "data/demo/attributes/demo_attributes_20261006.rds",
  ois_JPY = "data/demo/market/demo_ois_JPY_20261006.txt",
  ois_USD = "data/demo/market/demo_ois_USD_20261006.txt",
  ois_EUR = "data/demo/market/demo_ois_EUR_20261006.txt",
  results_jpy = "output/offer_results_JPY_demo_20261006.xlsx",
  results_iso = "output/offer_results_ISO_demo_20261006.xlsx"
)
path <- function(key) file.path(curie, src[[key]])

# Offers: keep the order of the books (JPY then ISO), with Curie's source row for traceability
read_offers <- function(key, book) {
  read_excel(path(key), sheet = "offers") |>
    mutate(offer_book = book, offer_date = as.Date(offer_date), offer_settlementdate = as.Date(offer_settlementdate))
}
offers <- bind_rows(read_offers("offers_jpy", "JPY"), read_offers("offers_iso", "ISO")) |>
  mutate(offer_id = sprintf("%s-%02d", offer_book, row_number()), .by = offer_book) |>
  transmute(offer_id, offer_book, offer_date, ISIN, broker_names, offer_price, offer_size, offer_size_unit,
            offer_settlementdate, offer_currency, offer_security_name, sheet_issue_price,
            offer_source_file = basename(offer_source_file), offer_source_sheet, offer_source_row)
utils::write.csv(offers, file.path(data_dir, "offers.csv"), row.names = FALSE, fileEncoding = "UTF-8")

attributes <- readRDS(path("attributes")) |> tibble::as_tibble()
utils::write.csv(attributes, file.path(data_dir, "attributes.csv"), row.names = FALSE, fileEncoding = "UTF-8", na = "")

for (ccy in c("JPY", "USD", "EUR")) file.copy(path(paste0("ois_", ccy)), file.path(data_dir, paste0("ois_", ccy, ".txt")), overwrite = TRUE)

# Old results, unrounded, for the regression test
read_results <- function(key) {
  read_excel(path(key), sheet = "オファー結果") |>
    transmute(ISIN, broker_names, offer_price, accrued_per_100, dirty_price, native_asw_bp,
              asw_effective_date = format(as.Date(asw_effective_date)), asw_maturity_date = format(as.Date(asw_maturity_date)),
              validation_status, pricing_status, pricing_message)
}
results <- bind_rows(read_results("results_jpy"), read_results("results_iso"))
golden <- list(
  description = "Curie ASW offer-sheet demo results (fictitious data), the reference for the LagrangeFinLab ASW API",
  source = c(src$results_jpy, src$results_iso),
  curie_commit = system2("git", c("-C", curie, "rev-parse", "HEAD"), stdout = TRUE),
  generated_by = "scripts/asw/snapshot_curie_demo.R",
  conditions = list(valuation_date = "2026-10-06", curve = "log_cubic_discount (MonotonicLogCubic), OIS annual, payment lag 0",
                    asw_overnight_leg = "Semiannual, payment lag 0 (Curie demo assumption)",
                    engine = "QuantLib 1.42 with GaussQuant 2026.9.12.1 (Curie run of 2026-10-27)"),
  results = results
)
write(toJSON(golden, auto_unbox = TRUE, digits = I(17), pretty = TRUE, na = "null"),
      file.path(root, "tests/golden/asw_curie_demo_results.json"))

sha <- function(f) tryCatch(digest_sha <- system2("certutil", c("-hashfile", shQuote(f), "SHA256"), stdout = TRUE)[2], error = function(e) NA)
prov <- c(
  "# ASW デモデータの出所",
  "",
  "Curie の A1 オファーシートのデモデータ（**すべて架空**。実在の銘柄・市場価格ではない）をコピーしたもの。",
  "`scripts/asw/snapshot_curie_demo.R` が作る。Curie は読むだけで変更しない。",
  "",
  paste0("- Curie のコミット：`", system2("git", c("-C", curie, "rev-parse", "--short", "HEAD"), stdout = TRUE), "`"),
  paste0("- 作成日時：", format(Sys.time(), "%Y-%m-%d %H:%M:%S %Z")),
  "",
  "| このフォルダ | Curie の元ファイル | 更新日時 | SHA-256 |",
  "|---|---|---|---|",
  vapply(names(src)[1:6], function(k) {
    out <- c(offers_jpy = "offers.csv", offers_iso = "offers.csv", attributes = "attributes.csv",
             ois_JPY = "ois_JPY.txt", ois_USD = "ois_USD.txt", ois_EUR = "ois_EUR.txt")[[k]]
    sprintf("| `%s` | `%s` | %s | `%s` |", out, src[[k]], format(file.info(path(k))$mtime, "%Y-%m-%d %H:%M"), gsub(" ", "", sha(path(k))))
  }, ""),
  "",
  "オファーは、Curie の `convert_offer_sheet_Curie()` がデモの Excel（`data/demo/offers/`）から読んだ標準形式（`output/work/`）を使う。",
  "単価は額面100あたりのクリーン価格、数量は額面金額（通貨単位）。"
)
writeLines(prov, file.path(data_dir, "PROVENANCE.md"), useBytes = TRUE)
cat("offers:", nrow(offers), " attributes:", nrow(attributes), " results:", nrow(results), "\n")
print(offers |> select(offer_id, ISIN, offer_currency, offer_price, offer_settlementdate), n = 20)
