# JGB and US Treasury month-end yields

## 1. Japanese Government Bonds (JGB)
- Source: Ministry of Finance, Japan, "Interest Rate Historical Data" (`jgbcme_all.csv`)
  - Overview page: https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm
  - Historical CSV: https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv
- License: Public data of the Japanese government, used under the Government of Japan Standard Terms of Use (compatible with CC BY 4.0).
- File: `jgb_month_end.csv` — the last observation of each month from 1990-01 to 2026-10 (442 months), long form (`month, date, tenor_years, yield_pct`).
- Rebuild with: `Rscript scripts/jgb/fetch_jgb_month_end.R`

## 2. US Treasury Constant Maturity Rates (UST)
- Source: Board of Governors of the Federal Reserve System (US), H.15 Selected Interest Rates, retrieved from FRED, Federal Reserve Bank of St. Louis:
  - Category page: https://fred.stlouisfed.org/categories/115
  - Series: `DGS1` (1Y), `DGS2` (2Y), `DGS3` (3Y), `DGS5` (5Y), `DGS7` (7Y), `DGS10` (10Y), `DGS20` (20Y), `DGS30` (30Y)
- File: `ust_month_end.csv` — the last observation of each month from 1990-01 to 2026-10 (442 months), long form (`month, date, tenor_years, yield_pct`).
- Rebuild with: `Rscript scripts/jgb/fetch_ust_month_end.R`
