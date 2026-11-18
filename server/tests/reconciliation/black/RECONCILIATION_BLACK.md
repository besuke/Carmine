# ブラックモデルの照合：GaussQuant・原稿と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-4（`part2_quantive_riemann/ch04_black_model.qmd`）の II-4.1〜4.6
- 照合する側：API が実際に使う `server/R/black_model.R`（RiemannFinMath 0.3.0）をそのまま読み込んで比べる
- 再実行：`npm run reconcile:black`（参照値 `server/tests/golden/black_golden.json` も書き直す）、`npm test`（`tests/black.api.test.ts`）

## 入力

すべて原稿の例示的な値で、市場の気配値は使っていない。

| 例 | 値 |
|---|---|
| Black 76（II-4.1〜4.4） | 取引日 2023-07-21、満期 2023-08-26（36日、Actual/365 Fixed）、フォワード 107+6.75/32、行使価格 107.5、σ 5.2%、r 5%（連続複利） |
| BSM（II-4.3、4.5、4.6） | 取引日 2024-03-01、満期 2025-03-03（TARGET で1年、367日）、S 100、K 100、σ 20%、r 5%、q 0% |
| モンテカルロ | 12ステップ、原稿は疑似乱数 200 パス（seed 1）、Sobol 64 本（表示）と 2,048 本（LSM） |

## 原稿と同じにした設定

| 項目 | 原稿（GaussQuant／QuantLib） | RiemannFinMath |
|---|---|---|
| Black process | `black_process_bundle_GQL()`：現物＝フォワード、配当利回り＝金利の BSM process | `compute_european_option_value(F, K, r, q = r, …)` |
| Black 公式 | `BlackCalculator`（σ√T と割引係数） | `compute_forward_option_value("black", …)` |
| ツリーと近似式 | `BinomialCRRVanillaEngine`、`BaroneAdesiWhaleyApproximationEngine`、`BjerksundStenslandApproximationEngine` | `compute_binomial_option_value`、`compute_american_approximation_value` |
| Sobol パス | `generate_path_table_GQL(sequence = "sobol")` | `generate_black_scholes_paths()`（既定の Sobol） |
| Longstaff–Schwartz | `lsm_american_put_GQL()`：基底 1・S・S²、回帰と評価に同じパス、ITM が3本未満の日は継続 | `compute_longstaff_schwartz_value()` の既定（同じ条件） |
| 行使の内訳 | 満期まで行使しなかったパスは満期の行に数える | `paths` に `unexercised_paths` を満期の行で足す |

## 結果【実行照合済み】

37 項目が許容誤差内で一致、4 項目は判定しない参考値（`results/black_diffs.csv`）。

| 比べたもの | 項目 | 最大差 | 許容誤差 |
|---|---|---|---|
| RiemannFinMath − GaussQuant | Black 76 の価格（公式・process） | 0 | 1e-13 |
| 同上 | Delta、Gamma、Vega、Theta、Theta（1日） | 9.8e-15 | 1e-12〜1e-14 |
| 同上 | European put（解析・CRR 25・100・500）、American put（CRR 25・500、BAW、BjS） | 4.8e-12 | 1e-10 |
| 同上 | Sobol パス（Black 3ステップ×4本、BSM 64本×13点） | 1.7e-13 | 1e-11〜1e-12 |
| 同上 | LSM の価格・標準誤差、ステップごとの行使パス数・ITM パス数・回帰で行使したパス数 | 2.7e-15（件数は 0） | 1e-12（件数は 0） |
| RiemannFinMath − 原稿の計算結果 | Black 76 の価格と Greeks、European／American put の全エンジン、Sobol 64 本の合計、LSM の価格・標準誤差・行使の内訳 | 4.8e-12（件数は 0） | 同上 |
| 1パスの手計算（Sobol） | 生成パス − 手計算 | 6.4e-10 | 1e-8 |

**許容誤差を 0 にしなかった項目**

- 二項ツリー：最大 500 ステップの後ろ向き計算で、演算順序の違いによる最下位ビットの差が積み上がる（最大 4.8e-12）。
- 1パスの手計算：手計算の $Z$ は R の `qnorm`、パス生成は QuantLib と同じ逆正規の近似（相対精度 1e-9 程度）を使う。差はその近似誤差と考えている（未確認の推定。QuantLib の `InverseCumulativeNormal` との直接比較はしていない）。原稿は疑似乱数のパスで手計算するが、RiemannFinMath の疑似乱数は取り出せないので、Sobol 点で行った。

**判定しない項目**

- インプライド・ボラティリティ：原稿は QuantLib の既定の精度 1e-4 で止めた 5.19932%。RiemannFinMath は 1e-10 で、入力の 5.2% を再現する（差 6.8e-6）。
- 疑似乱数のモンテカルロ（200 パス）：RiemannFinMath の疑似乱数は QuantLib の Mersenne Twister と別の列。今回の値は原稿の値と、原稿の標準誤差 0.0597 の 2.82 倍だけ離れている（独立な二つの推定の差の標準誤差は約 √2 倍なので、約 2.0 標準誤差に当たる）。

**このページで加えたもの**：MC のパス数と収束の表（擬似乱数・Sobol）、CRR のステップ数による収束、フォワード価格と Black 76 価格のグラフ。満期分布のヒストグラムの区間は、原稿の図と同じ `ggplot2::geom_histogram(bins = 24)` の区間を `layer_data()` で取り出して API が返す。
