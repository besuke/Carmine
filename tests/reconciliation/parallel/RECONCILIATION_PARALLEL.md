# 計算の進化と並列計算の照合：原稿の例と RiemannFinMath の並列バッチ

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance III-1（`part3_enterprise_riemann/ch01_computational_evolution_parallel.qmd`）の III-1.4〜1.6
- 照合する側：API が実際に使う `server/R/parallel_model.R` をそのまま読み込んで比べる
- 比べる相手：原稿の qmd から計算部分（`parallel-present-value-function` から `sequential-plan-restore` まで）をそのまま読み込んで実行した値。逐次は `purrr::pmap()`、並列は `furrr::future_pmap()`（`future::multisession`、ワーカー2）
- 再実行：`npm run reconcile:parallel`（参照値 `tests/golden/parallel_golden.json` も書き直す）、`npm test`（`tests/parallel.api.test.ts`）

## 計算の分担

| 項目 | このページの計算 |
|---|---|
| 6シナリオの現在価値（III-1.4） | 原稿と同じ R の関数を `purrr::pmap()` で各行に当てる |
| 一括評価の時間（III-1.5〜1.6） | RiemannFinMath `compute_bond_values_batch(bonds, threads)`：残存約10年の固定利付債（クーポン 1.5%、半年払い）を、0.1%〜3% の複利利回りで件数分だけ評価する。スレッド数 1・2・4・8（上限まで）で同じ評価を行い、時間を測る |

原稿の III-1.5 は `Sys.sleep(0.1)` の12タスクで逐次と並列の時間を比べる。ページでは、実際の計算量を持つ債券の評価で同じ構造（独立したタスクを複数のワーカーに配る）を測る。

## 結果【実行照合済み】

7 項目が許容誤差内、1 項目は判定しない参考値（`results/parallel_diffs.csv`）。

| 比べたもの | 最大差 | 許容誤差 |
|---|---|---|
| 6シナリオの現在価値：ページ − 原稿の逐次（purrr）、ページ − 原稿の並列（furrr） | 0 | 0 |
| 原稿の逐次 − 並列 | 0 | 0 |
| 債券2000件：スレッド数（1・2・4・8）を変えた結果の差（単価・経過利子・デュレーション・コンベクシティ・BPV）、エラーの件数 | 0 | 0 |
| 債券5件：一括（1スレッド）− 1件ずつ（`compute_bond_values`）、単価・修正デュレーション | 4.3e-14 | 1e-12 |

**許容誤差を 0 にしなかった項目**：一括はワーカースレッドで、1件ずつは R のメインスレッドで計算するため、最下位ビットが違ってよい（RiemannFinMath のヘルプの記述）。

**判定しない項目**：計算時間は環境で変わる。照合時の実測は債券2000件で 1 スレッド 0.17 秒、2 スレッド 0.14 秒、4 スレッド 0.07 秒、8 スレッド 0.04 秒。ページの実測（20,000件）では 4 スレッドまでほぼスレッド数どおりに速くなり、8 スレッドでは頭打ちになった（このサーバーの論理プロセッサは 8）。

**途中で直したこと**：スマホ幅で、III-1.1 の年表（コードブロック）がページを横に広げていた（264 px）。`.prose pre` を枠の中で横にスクロールするようにして 0 になった。
