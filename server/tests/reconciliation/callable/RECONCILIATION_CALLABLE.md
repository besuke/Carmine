# 早期償還モデルの照合：原稿の関数・原稿の結果と rmql

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-8（`part2_quantive_riemann/ch08_early_redemption_models.qmd`）の II-8.1〜8.6、II-8.8
- 照合する側：API が実際に使う `server/R/callable_model.R` をそのまま読み込んで比べる
- 比べる相手：原稿の qmd から該当するチャンク（`early-redemption-contract` から `mbs-static-psa-oas` まで）をそのまま読み込んで実行した値と、原稿の計算結果（rmql `comparison/baseline/lagrange_values.csv`）
- 再実行：`npm run reconcile:callable`（参照値 `server/tests/golden/callable_golden.json` も書き直す）、`npm test`（`tests/callable.api.test.ts`）

## 入力

すべて原稿の説明用の値。コール債は額面100、クーポン年3%（半年 1.5）、5年、コールは 1〜4.5 年の利払日にコール価格 100、初期曲線は連続複利 2% のフラット、Hull–White の a = 15%、σ = 1.2%、状態の格子 321 点（±0.13）、求積 24 点。MBS は元本 100、モーゲージ金利 5%、パススルー金利 4.5%、360 か月、PSA 100%、β = 20、借換えコスト 0.5%、Hull–White の20経路は原稿の乱数（R の seed 48、antithetic）。

## 計算の分担

| 項目 | このページの計算 |
|---|---|
| Bullet・Callable・コール権の価値、ボラ別・格子別の価格 | rmql `compute_hull_white_callable_bond_value()` |
| コール日ごとの判断（継続価値とコール価格の比較、II-8.4.3 の図） | 原稿と同じ式の R 関数（`cb_decisions`、同じ格子と求積）。rmql は判断の表を返さないため |
| MBS のキャッシュフロー、シナリオ、経路の価格、静的 OAS | rmql `create_mbs_pass_through()`、`compute_mbs_cashflows()`、`compute_mbs_path_values()`、`compute_mbs_oas()` |
| Hull–White の20経路 | 原稿と同じ R の手順（seed 48、antithetic） |
| 2000経路の参考値 | rmql `generate_hull_white_monthly_rates()`（パッケージの乱数） |

## 結果【実行照合済み】

23 項目が許容誤差内、2 項目は判定しない参考値（`results/callable_diffs.csv`）。

| 比べたもの | 最大差 | 許容誤差 |
|---|---|---|
| Bullet（初期曲線・格子）、Callable、コール権の価値（RFM − 原稿の関数） | 1.6e-13 | 1e-12〜1e-13 |
| コール判断の表（8日 × 321点の継続価値、行使するか） | 0 | 1e-12、0 |
| ボラ別（0・0.6・1.2・2%）、格子別（161・321・641 点）の Callable | 3.3e-13 | 1e-12 |
| MBS シナリオ（加重平均残存年数、固定 4% の価格、経路の金利の価格、元本の合計） | 1.1e-13 | 1e-11〜1e-12 |
| MBS の20経路の金利、価格、加重平均残存年数 | 1.7e-13 | 0〜1e-11 |
| 原稿の計算結果（callable.*、mbs.scenario.*、mbs.path.*） | 3.3e-13 | 1e-11〜1e-12 |

**判定しない項目**

- 静的 OAS：原稿の `uniroot` は既定の許容誤差（スプレッドで約 1.2e-4）で止まり、rmql は 1e-12 まで解く。差は最大 0.26 bp。
- 2000経路の平均価格：経路の本数と乱数が原稿の20経路と違う。差は 0.155、2000経路の標準誤差は 0.173。

**途中で直したこと**：20経路の金利で最下位ビットの差（1.4e-17）が出た。原稿は `time <- m * dt` を作ってから φ を求め、φ に x を足す。同じ演算の順序にして差は 0 になった。最初のコール日が利払日でない入力（例 1.2 年）は、API が 400 と日本語の理由を返す。

**このページで加えたもの**：コール日ごとのコールする短期金利の上限、コール権の価値のボラティリティに沿った曲線、借換え金利別の CPR と毎月の元本のグラフ、20経路の金利のグラフ、2000経路の参考値、PSA 別のスプレッドと価格の曲線。
