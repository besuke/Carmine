# 金利デリバティブのキャリブレーションの照合：GaussQuant・原稿と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-6（`part2_quantive_riemann/ch06_irs_calibration.qmd`）の II-6.2〜6.5
- 照合する側：API が実際に使う `server/R/calibration_model.R`（RiemannFinMath 0.3.0）をそのまま読み込んで比べる
- 再実行：`npm run reconcile:calibration`（参照値 `server/tests/golden/calibration_golden.json` も書き直す）、`npm test`（`tests/calibration.api.test.ts`）

## 入力

すべて原稿の説明用の値。原稿自身が「市場実勢値と主張しない」としている。

| 節 | 値 |
|---|---|
| II-6.2 | フォワード 0.56%、Black 40%、Normal 40bp、満期 2 年、割引係数 1 |
| II-6.3 | SABR の7点（行使金利 0.06〜2.56%、Black ボラ 90.78〜62.72%）、フォワード 0.56%、満期 2 年、β = 0.5 |
| II-6.4 | フラットなゼロ金利 3%（連続複利）、基準 a = 8%・σ = 1.2% で作った4本の債券オプション（3本で推定、1本で検証） |
| II-6.5 | キャップレット・ボラ 24・22・21・20%、ウェイト 0.28・0.26・0.24・0.22、基準の減衰 0.45 |

## 計算の分担

| 項目 | 原稿 | このページ |
|---|---|---|
| Normal 型の価格 | 原稿の R 関数 | RiemannFinMath `compute_forward_option_value("bachelier")` |
| SABR のボラ | GaussQuant `safe_sabr_vol_GQL()`（QuantLib `sabrVolatility`） | RiemannFinMath `compute_sabr_volatility("lognormal")` |
| SABR のあてはめ | `optim`（L-BFGS-B、初期値 0.1、範囲、ボラの二乗誤差の平均） | 同じ `optim` を RiemannFinMath のボラの上で。並べて `calibrate_sabr`（Levenberg–Marquardt） |
| HW の債券オプション | 原稿の R 関数（閉じた式） | RiemannFinMath `compute_hull_white_bond_option_value()`（フラットカーブは `create_flat_curve`） |
| HW のあてはめ | `optim`（L-BFGS-B、初期値 a = 5%・σ = 1%、価格差 × 1万の二乗和） | 同じ `optim` を RiemannFinMath の価格の上で。並べて `calibrate_hull_white` |
| BGM | 原稿の固定ウェイト近似と `optimize` | 同じ式（R）。追加で RiemannFinMath の LMM の Rebonato の近似と `calibrate_lmm_correlation` |

## 結果【実行照合済み】

18 項目が許容誤差内、1 項目は判定しない参考値（`results/calibration_diffs.csv`）。

| 比べたもの | 最大差 | 許容誤差 |
|---|---|---|
| Normal 型の価格（RFM − 原稿の R 関数、71 行使） | 3.5e-18 | 1e-15 |
| SABR：GaussQuant で原稿の手順を動かした解 − 原稿の計算結果 | 0 | 0 |
| SABR：原稿の解での RFM のボラ − 原稿（%、7点） | 2.8e-14 | 1e-12 |
| SABR：原稿の手順を RFM で − GaussQuant（α・ν・ρ） | 2.6e-11 | 1e-9 |
| SABR：同上（あてはめたボラ、RMSE） | 8.3e-12、1.5e-15 | 1e-10、1e-12 |
| HW：市場価格（RFM − 原稿の R 関数、原稿の結果） | 5.7e-13 bp | 1e-10 bp |
| HW：原稿の解でのモデル価格・価格誤差（RFM − 原稿の結果） | 1.1e-12 bp | 1e-10 bp |
| HW：原稿の手順を RFM で − 原稿の R 関数（a・σ）、原稿の結果（%） | 1.7e-13、1.7e-11 | 1e-9、1e-7 |
| HW：目的関数（RFM − 原稿の結果） | 5.0e-12 | 1e-9 |
| HW：calibrate_hull_white − 基準の a・σ | 6.8e-15 | 1e-9 |
| BGM：固定ウェイト近似のボラ、減衰の推定 | 0 | 0 |
| BGM（追加）：Rebonato の近似から推定した減衰 − 基準 | 9.8e-13 | 1e-8 |

**許容誤差を 0 にしなかった理由**：SABR と HW のあてはめは、同じ `optim`・同じ初期値と範囲でも、目的関数の値が最下位ビットで違うと止まる位置がわずかに動く（最大 2.6e-11）。

**判定しない項目**：`calibrate_sabr` の α・ν・ρ は、原稿の手順と最適化の方法が違うので判定しない（差は最大 2.4e-4）。同じクォートへの当てはまりは RMSE で比べ、RiemannFinMath が 0.0138805989、原稿の手順が 0.0138807545 で、RiemannFinMath の方がわずかに小さい。HW では、原稿の手順は目的関数 0.0348 で止まり（a = 7.7479%、σ = 1.1933%、原稿と同じ）、`calibrate_hull_white` は価格を作った基準の a = 8%、σ = 1.2% に戻る。

**途中で直したこと**：フォワードを 0 以下にすると Black 型の価格で計算が失敗し、API が 500 を返していた。Black 型はフォワードと行使金利が正のときだけ定義されるので、それ以外は価格なし（null）にして、Normal 型だけを計算するようにした（テストを追加）。

**このページで加えたもの**：行使金利ごとの Normal・Black の価格のグラフ、SABR の β の変更、HW の基準パラメータとゼロ金利の変更と目的関数の断面、BGM の Rebonato の近似（フォワード 3% は仮定）と相関の減衰のグラフ。
