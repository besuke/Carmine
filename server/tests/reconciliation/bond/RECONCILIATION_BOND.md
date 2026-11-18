# 確定キャッシュフローの照合：GaussQuant・原稿と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-1（`part2_quantive_riemann/ch01_deterministic_cashflow.qmd`）の II-1.2.4〜1.8
- 照合する側：API が実際に使う `server/R/bond_model.R`（RiemannFinMath 0.3.0）をそのまま読み込んで比べる
- 再実行：`npm run reconcile:bond`（参照値 `server/tests/golden/bond_golden.json` も書き直す）、`npm test`（`tests/bond.api.test.ts`）

## 入力

| 例 | 値 |
|---|---|
| TONAR（II-1.2.4） | GaussQuant のサンプル気配 `bluegamma_tonar_quotes_GQL()`（2026-09-10、14本）。第II-3章と同じ。市場から取得した気配ではない |
| 模式図（II-1.2.5） | 原稿の年1回複利のスポット：順イールド 1% + 0.2%·T、逆イールド 3.5% − 0.15%·T |
| 債券（II-1.3〜1.8） | 原稿の例示的な 7.5%・40年債（取引日 2022-03-30、受渡 2022-04-01、償還 2062-04-01、半年払い、30/360 Bond Basis、日付は調整なし）、単利 6.515%、Zスプレッド 50bp |

## 原稿と同じにした設定

| 項目 | 原稿（GaussQuant／QuantLib） | RiemannFinMath |
|---|---|---|
| TONAR カーブ | `PiecewiseLogCubicDiscount`、スポット開始2日、年1回払い | `bootstrap_ois_curve()`（monotonic_log_cubic）、`create_ois_instruments(…, 2L, 1L, 0L)` |
| 瞬間フォワード | `forwardRate(d, d)`（日付の前後 0.0001 年） | `compute_forward_rate(curve, d, d, …)`（同じ定義） |
| 日本の単利・複利 | `bond_*_YEN_GQL()`（残存年数・単価・利回りの切り捨て） | `compute_remaining_years()`、`compute_price_from_simple_rate()` など |
| フラットイールド | `FlatForward(受渡日, y, 30/360, Compounded, Semiannual)` と `DiscountingBondEngine`（評価日は取引日） | `create_flat_curve(受渡日, y, "thirty_360_bond_basis", "compounded", 2L)`、`compute_bond_value_on_curve(…, 取引日)$npv` |
| 利回りの逆算（II-1.8.6） | `bond_yield_from_price_GQL()`（QuantLib の既定の精度 1e-8） | `compute_yield_from_price(…, accuracy = 1e-8)` |
| 解析式と数値解法（II-1.7〜1.8） | 原稿の R 関数 | 同じ式を `bond_model.R` に書き、RiemannFinMath の値と並べる |

## 結果【実行照合済み】

39 項目すべて許容誤差内（`results/bond_diffs.csv`）。

| 比べたもの | 項目 | 最大差 | 許容誤差 |
|---|---|---|---|
| RiemannFinMath − GaussQuant | TONAR のピラー日・割引係数・ゼロ・瞬間フォワード（14本） | 1.0e-15 | 0〜1e-11 |
| 同上 | 受渡日、キャッシュフローの支払日と金額（81件） | 0 | 0〜1e-12 |
| 同上 | 残存年数、単利→単価、単価→単利、単価→複利利回り、複利利回り→単価 | 0 | 0 |
| 同上 | フラットイールドのダーティ価格、Zスプレッド 50bp の NPV | 0 | 1e-11 |
| 同上 | BPV（円）、修正デュレーション、コンベクシティ | 2.8e-13 | 1e-14〜1e-10 |
| 同上 | QuantLib 方式の利回り（精度 1e-8） | 0 | 1e-12 |
| 原稿の解析式 − RiemannFinMath | 単価、dP/dY、d²P/dY² | 2.8e-14 | 1e-11 |
| 数値解法どうし | 二分法・Brent 法・多項式求根法 − ニュートン法 | 3.1e-10 | 1e-9 |
| 数値解法 − RiemannFinMath | ニュートン法 − 複利利回り（RiemannFinMath は小数7桁で切り捨て） | 2.1e-8 | 1e-7 |
| 模式図 | 原稿の dplyr の計算 − API（40点 × 4列） | 6.9e-18 | 1e-15 |
| RiemannFinMath − 原稿の計算結果 | 受渡日、キャッシュフロー、残存年数、単価、単利、複利利回り、フラットイールドの価格、Zスプレッドの NPV、BPV、修正デュレーション、コンベクシティ、利回り | 2.8e-13 | 上と同じ |

**途中で直したこと**：フラットイールドの価格で、初めは評価日に受渡日を渡していたため、RiemannFinMath がさらに2営業日後を受渡日として評価し、0.081 の差が出た。QuantLib の評価日は取引日なので、評価日を取引日にして差は 0 になった。

**判定しないもの**：計算時間。環境で変わるので、ページには API の実測値（50 ms 以上くり返した平均）を出す。

**このページで加えたもの**：TONAR の各ピラーの表、債券キャッシュフローの棒グラフ、価格と利回りの曲線とデュレーション・コンベクシティの近似、ニュートン法の反復表、二分法の区間の縮み方。
