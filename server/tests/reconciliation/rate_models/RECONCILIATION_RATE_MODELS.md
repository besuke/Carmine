# 金利モデルの照合：原稿のコードと RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-7（`part2_quantive_riemann/ch07_irs_rate_models.qmd`）の II-7.2〜7.5
- 照合する側：API が実際に使う `server/R/rate_models_model.R` をそのまま読み込んで比べる
- 再実行：`npm run reconcile:rate-models`（参照値 `server/tests/golden/rate_models_golden.json` も書き直す）、`npm test`（`tests/rateModels.api.test.ts`）

## 入力と乱数

すべて原稿の説明用の値で、翌日物金利は原稿の架空の値（水準 1%、振幅 0.4%、90 日）。原稿は乱数を R の `set.seed` と `rnorm` で作る（Hull–White 617、キャップレット 618、相関ショック 619）。API も同じ種で同じ乱数を作り、セッションの乱数の状態は元に戻す。

| 節 | このページの計算 |
|---|---|
| II-7.2 Hull–White | 原稿の R の手順（OU 状態の厳密な遷移、半月刻み、5年、8000本、割引は左端の値の和）。並べて RiemannFinMath `generate_hull_white_monthly_rates()`（月次、antithetic、パッケージの乱数） |
| II-7.3 HJM | 1因子 Hull–White のフォワードの変動係数 σ e^(−a(T−t))（式） |
| II-7.4.2 キャップレット | Black の公式は RiemannFinMath `compute_caplet_value()`、モンテカルロは同じ R の正規乱数を `compute_caplet_from_normals()` に渡す。追加で後決めキャップレット `compute_backward_caplet_value()` |
| II-7.4.3 相関ショック | 同じ R の独立な正規乱数を `compute_correlated_normals()` に渡す |
| II-7.5 後決め金利 | 原稿の式（R） |

## 結果【実行照合済み】

13 項目が許容誤差内、1 項目は判定しない参考値（`results/rate_models_diffs.csv`）。

| 比べたもの | 最大差 | 許容誤差 |
|---|---|---|
| Hull–White：表示する経路（8本 × 121点）、平均の経路、経路別割引の平均（1・2・5年） | 0 | 0〜1e-15 |
| キャップレット：Black の公式、モンテカルロ、標準誤差（RFM − 原稿の R） | 1.3e-18 | 1e-17 |
| 相関ショックの標本相関（RFM − 原稿の R、9要素） | 0 | 1e-14 |
| 後決め金利：90日の複利、当日までの年率 | 1.7e-18 | 1e-16、0 |
| RiemannFinMath − 原稿の計算結果：キャップレット（Black・MC・標準誤差、bp） | 1.4e-14 | 1e-12 |
| RiemannFinMath − 原稿の計算結果：標本相関 | 0 | 1e-12 |

**許容誤差を 0 にしなかった項目**：90日の複利は、期間の日数割合を 1/365 の和で割るか 90/365 で割るかで最下位ビットが違う。

**判定しない項目**：RiemannFinMath の月次の Hull–White の経路はパッケージの乱数なので、原稿の経路とは一致しない。経路別割引の平均と初期曲線の差は標準誤差の最大 0.01 倍で、初期曲線と整合する。

**途中で直したこと**：目標相関が正定値でない組み合わせ（例：ρ(A,B) = −0.5、ρ(A,C) = 0.5、ρ(B,C) = 0.7）は、API が 400 と日本語の理由を返し、画面は直前の結果を残して入力欄の横に理由を表示する。

**このページで加えたもの**：Hull–White の 5%・95% 点と φ(t)、月次の RiemannFinMath の経路の割引の検証、満期のフォワードの分布（行使金利の上下で色分け）、後決めキャップレット、相関ショックの散布図、目標相関・架空の翌日物金利の変更。
