# 信用リスクとCDS の照合：GaussQuant・原稿と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-5（`part2_quantive_riemann/ch05_credit_risk_cds.qmd`）の II-5.2〜5.6 の全計算と、このページで加えた2つ（感応度表のゼロ NPV Hazard、Fair Upfront と市場 Spread のグラフの元になる計算）
- 照合する側：API が実際に使う `server/R/cds_model.R`（RiemannFinMath 0.3.0）をそのまま読み込んで比べる
- 再実行：`npm run reconcile:cds`（参照値 `tests/golden/cds_golden.json` も書き直す）、`npm test`（`tests/cds.api.test.ts`）

## 入力

すべて原稿の例示的な値で、市場の気配値は使っていない。

| 例 | 値 |
|---|---|
| 1年物（II-5.2〜5.4） | 評価日 2022-09-19、Schedule 2022-09-20〜2023-09-20（3か月、週末のみ休日、Following、満期は調整なし、Forward）、Notional 10,000,000、割引率 10%（連続複利、Actual/365 Fixed）、市場 Spread 130bp、契約 Coupon 100bp、Recovery 40%、Premium は Actual/360 |
| 標準5年物（II-5.5〜5.6） | 取引日 2022-08-19、満期は CDS2015 の 5Y（2027-06-20）、市場 Spread 30.426bp、契約 Coupon 100bp、Recovery 40%、OIS 割引率 0.25% |

## 原稿と同じにした設定

| 項目 | 原稿（GaussQuant／QuantLib） | RiemannFinMath |
|---|---|---|
| フラットな割引カーブ | `flat_curve_GQL()`（FlatForward、連続複利） | `create_flat_curve(…, "continuous")` |
| 1年物の CDS | `CreditDefaultSwap` の素のコンストラクタ | `create_credit_default_swap()` の既定（Forward、Protection は Schedule の最初の日から） |
| 標準5年物の CDS | `make_cds_GQL()`（QuantLib の `MakeCreditDefaultSwap`） | `rule = "cds2015"`、`trade_date`・`protection_start` を取引日、`last_period_day_count = "actual_360_include_last_day"` |
| ゼロ NPV の Hazard Rate | `uniroot`（区間 1e-8〜0.5、tol 1e-10） | 同じ `uniroot` を RiemannFinMath の NPV に対して使う |
| 支払日ごとの表 | `cds_cashflow_table_GQL()` | RiemannFinMath の `generate_schedule()`・`compute_discount()`・`compute_survival_probability()` から、同じ規則で組み立てる（中点は前の支払日＋日数の半分の切り捨て） |

## 結果【実行照合済み】

64 項目すべてで差 0（`results/cds_diffs.csv`）。

| 比べたもの | 項目 | 最大差 |
|---|---|---|
| RiemannFinMath − GaussQuant（1年物） | Hazard 近似、満期の割引係数・生存確率、NPV、Coupon Leg、Default Leg、Fair Spread、Fair Upfront、Schedule、支払日ごとの表（7列）、手計算（Premium・Protection・Risky PV01・Fair Spread）、ゼロ NPV の Hazard Rate | すべて 0 |
| 同上（感応度表） | 9通りの近似 Hazard、9通りのゼロ NPV Hazard | すべて 0 |
| 同上（標準5年物） | 満期、CDS2015 Schedule（21日付）、割引係数、ゼロ NPV の Hazard Rate、ISDA と MidPoint の NPV・各レグ・Accrual Rebate・Fair Spread・Fair Upfront、支払日ごとの表、手計算 | すべて 0 |
| RiemannFinMath − 原稿の計算結果（Riemann `comparison/baseline/lagrange_values.csv` の `cds.*` 17件） | 1年物の NPV・Fair Spread・各レグ・Hazard、標準5年物の満期・Hazard、ISDA と MidPoint の NPV・各レグ・Rebate・Fair Spread・Fair Upfront | すべて 0 |

主な値：1年物 NPV 28,116.05、Fair Spread 129.8327bp、ゼロ NPV Hazard 2.169459%（近似 2.166667%）。標準5年物 Hazard 0.513981%、ISDA NPV −334,962.57、Accrual Rebate 16,943.86、Fair Upfront −3.3497%、ISDA − MidPoint の NPV 差 −11.67。

許容誤差（金額 1e-8、Spread と Upfront 1e-15、Hazard 1e-10、表 1e-12 相対）は、RiemannFinMath のビルドや実行環境が変わったときの最下位ビットの差を許すためのもの。今回の差はすべて 0 だった。
