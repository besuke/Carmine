# The universe of Part I: banks and securities companies in TOPIX100, with their EDINET codes.
#
#   Rscript tools/capm/01_universe.R
#
# Sources (public, fetched now): JPX's list of TOPIX constituents with the New Index Series class, and EDINET's
# code list. Writes market_data/universe/ (ignored by git): the two files as fetched, and universe.csv.
# TOPIX100 = TOPIX Core30 + TOPIX Large70 at the date of JPX's list (today's members; earlier years are not
# reconstructed).

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(stringr)
  library(purrr)
})

out_dir <- file.path("market_data", "universe")
raw_dir <- file.path(out_dir, "raw")
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)

download <- function(url, path) {
  utils::download.file(url, path, mode = "wb", quiet = TRUE, headers = c(`User-Agent` = "Mozilla/5.0"))
  path
}
topix_path <- download("https://www.jpx.co.jp/automation/markets/indices/topix/files/topixweight_j.csv",
                       file.path(raw_dir, "topixweight_j.csv"))
codes_zip <- download("https://disclosure2dl.edinet-fsa.go.jp/searchdocument/codelist/Edinetcode.zip",
                      file.path(raw_dir, "Edinetcode.zip"))
utils::unzip(codes_zip, exdir = raw_dir, overwrite = TRUE)

topix <- read_csv(topix_path, locale = locale(encoding = "CP932"), col_types = cols(.default = col_character()),
                  show_col_types = FALSE) |>
  rename(as_of = 日付, name = 銘柄名, code = コード, industry = 業種, weight = `TOPIXに占める個別銘柄のウエイト`,
         index_class = `ニューインデックス区分`) |>
  filter(!is.na(code))

# EDINET's list: one line of the date, then the header; securities codes have five digits (code and a check 0)
edinet <- read_csv(file.path(raw_dir, "EdinetcodeDlInfo.csv"), locale = locale(encoding = "CP932"), skip = 1,
                   col_types = cols(.default = col_character()), show_col_types = FALSE) |>
  select(edinet_code = ＥＤＩＮＥＴコード, filer = 提出者名, filer_en = `提出者名（英字）`, consolidated = 連結の有無,
         fiscal_year_end = 決算日, securities_code = 証券コード) |>
  filter(!is.na(securities_code)) |>
  mutate(code = str_sub(securities_code, 1, 4))

universe <- topix |>
  filter(index_class %in% c("TOPIX Core30", "TOPIX Large70"), industry %in% c("銀行業", "証券、商品先物取引業")) |>
  left_join(edinet, by = "code", relationship = "one-to-one") |>
  mutate(ticker = paste0(code, ".T"), weight_pct = as.numeric(str_remove(weight, "%"))) |>
  select(code, ticker, name, industry, index_class, weight_pct, edinet_code, filer, filer_en, consolidated, fiscal_year_end, as_of) |>
  arrange(industry, code)

stopifnot(!anyNA(universe$edinet_code))
write_csv(universe, file.path(out_dir, "universe.csv"))
message(sprintf("%d companies -> %s", nrow(universe), file.path(out_dir, "universe.csv")))
print(universe |> select(code, name, industry, edinet_code, fiscal_year_end), n = Inf)
