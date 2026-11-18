# 国債先物・CTD・先物BPV の照合：GaussQuant・原稿と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-2.6（受渡適格銘柄、複利利回りと Duration、Gross Basis・Carry・Net Basis・Implied Repo・CTD）、II-2.7（8%・9% のストレスシナリオ）、先物BPV（GaussQuant `futures_bpv_GQL()`：CTD の DV01 ÷ CF）
- 再実行：`node scripts/run-r.mjs tests/reconciliation/futures/reconcile_futures.R`（参照値 `tests/golden/futures_golden.json` も書き直す）、`npm test`（`tests/futures.api.test.ts`）

## 入力

原稿の現物価格は計算確認用に置いた BB 価格（最終稿で日本相互証券の確認値に差し替える予定）である。リポジトリは公開なので複製せず、**架空の価格**に置き換えた（`scripts/futures/make_demo_inputs.R` → `server/data/futures_demo/inputs.json`）。

| 項目 | 値 |
|---|---|
| 受渡適格銘柄・CF・日付・Funding Rate | 原稿と同じ（373〜383回債、評価日 2026-09-10、受渡日 2026-12-20、1.23%） |
| 現物価格（架空） | 原稿 II-2.7.2 の例示的な「Current market」曲線（0.25年 1.23%〜10年 2.90%）を償還までの年数で線形補間した複利利回りで評価し、小数第3位に丸めた |
| 先物価格（架空） | (価格 − Carry) / CF の最小値 − 0.10 を小数第2位に丸めた 125.14 |
| ストレス | 原稿と同じ：全銘柄 8% 複利、Funding 9%、先物価格は 6%・10年の標準物を 8% で評価した価格 |

## 結果【実行照合済み】

| 比べたもの | 項目 | 最大差 |
|---|---|---|
| RiemannFinMath − GaussQuant（同じ架空の入力） | 経過利子（評価日・受渡日）、保有期間のクーポン、複利利回り、修正デュレーション、DV01、Gross Basis、Carry、Net Basis、Implied Repo、CTD、先物BPV | すべて 0 |
| 同上（ストレス） | 先物価格、現物価格、Net Basis、Implied Repo、修正デュレーション、先物BPV | すべて 0 |
| RiemannFinMath − 原稿の計算結果（Riemann `comparison/baseline/lagrange_values.csv`） | 経過利子・保有期間のクーポン（価格に依存しない）、ストレスの先物価格・現物価格・Gross Basis・Net Basis・Implied Repo・CTD | すべて 0 |

CTD は、架空の価格の現在の市場で 373回債、ストレスで 383回債（原稿と同じ）。全銘柄を同じ利回りで評価すると、Funding 9% では利回り 6.25% 以上で 373回債から 383回債に入れ替わる。

**利回りの逆算の精度**：GaussQuant の `bond_yield_from_price_GQL()` は QuantLib の `Bond_yield` を既定の精度 1e-8 で呼ぶ。RiemannFinMath の既定は 1e-10 なので、そのままでは利回りに最大 8.8e-9 の差が出た。API と照合は `accuracy = 1e-8` を指定して原稿と同じにしている。
