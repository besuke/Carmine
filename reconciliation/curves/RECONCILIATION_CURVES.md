# 金利カーブの章の照合：GaussQuant と RiemannFinMath

- 照合日：2026-11-14（`results/session_info.txt`）
- 対象：LagrangeFinance II-2.2（ゼロカーブ）、II-2.3.1（補間方式）、II-2.5.2（平行シフト）、II-2.5.3（ノードの再現）
- 再実行：`node scripts/run-r.mjs reconciliation/curves/reconcile_yield_curve.R`（参照値 `tests/golden/yield_curve_golden.json` も書き直す）、`npm test`（`tests/curves.api.test.ts`）

## 条件（原稿と同じ）

評価日 2022-08-19、II-2.2.1 のゼロ金利ノード9点（例示値、連続複利）、Actual/365 Fixed。

| カーブ | GaussQuant（原稿） | RiemannFinMath（API） |
|---|---|---|
| ZeroCurve | `build_zero_curve_GQL()`（QuantLib `ZeroCurve`、ゼロ金利の線形補間） | `create_zero_curve(..., "continuous")` |
| DiscountCurve | `build_discount_curve_GQL()`（ノードのゼロ金利を割引係数に直し、`DiscountCurve` の対数線形補間） | `create_discount_curve(..., "log_linear")` |
| 平行シフト +50bp | `make_zero_spreaded_curve_GQL()`（`ZeroSpreadedTermStructure`、既定の単利・年1回） | `create_zero_spreaded_curve(..., "simple", 1)` |

**原稿との違い**：原稿の II-2.5.2 は II-2.4.2 の預金・IBOR スワップカーブをシフトする。RiemannFinMath には IBOR スワップカーブがないため、両方とも II-2.2 のゼロカーブに同じシフトを加えて比べた。

## 結果【実行照合済み】

| 項目 | 件数 | 許容誤差 | 最大差 |
|---|---|---|---|
| ZeroCurve の割引係数（年限表 1D〜10Y） | 11 | 1e-12 | 0 |
| ZeroCurve の割引係数（`curve_grid_tbl_GQL` の240点） | 240 | 1e-12 | 0 |
| ZeroCurve・DiscountCurve の割引係数（II-2.3.1 の300点） | 300＋300 | 1e-12 | 0 |
| +50bp シフト後の割引係数（年限表） | 11 | 1e-12 | 0 |
| ノードの割引係数（両カーブ） | 9＋9 | 1e-12 | 0 |

API テスト（年限の日付は完全一致、割引係数 相対 1e-12、ゼロ金利 1e-10）でも、すべての差が 0 だった。
