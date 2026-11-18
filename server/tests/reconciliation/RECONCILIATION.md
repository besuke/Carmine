# 円 TONA OIS の照合：GaussQuant（QuantLib）と rmql

- 照合日：2026-11-14（実行ログ `results/session_info.txt` の `run_at: 2026-11-14 12:15:03 JST`）
- 目的：GaussQuant の QuantLib 計算を参照値とし、rmql を LagrangeFinLab（ブラウザー版）の照合先に使えるかを確かめる。
- 範囲：既存の 2 エンジンの照合と報告まで。LagrangeFinLab の実装、GaussQuant・rmql の変更はしていない。

## 1. 再実行コマンド

```sh
"C:/Program Files/R/R-4.6.0/bin/Rscript.exe" C:/AnalyticFin/Projects/LagrangeFinLab/reconciliation/reconcile_tona_ois.R
"C:/Program Files/R/R-4.6.0/bin/Rscript.exe" C:/AnalyticFin/Projects/LagrangeFinLab/reconciliation/check_flat_forward_vs_log_linear.R
```

丸める前の結果は `results/*.csv` に書き出す。

| ファイル | 内容 |
|---|---|
| `quotes.csv` | 入力の気配（2 つの気配セット） |
| `instruments.csv` | 各気配の開始日・満期・ピラー・最終関連日、再現した気配 |
| `discount_forward.csv` | 割引係数と 1 暦日の単利フォワード（ピラー、主要年限、スワップの日付、月次グリッド） |
| `cashflows.csv` | 7 年 OIS の全クーポン（支払日、額） |
| `swap_7y.csv` / `swap_7y_change.csv` | 7 年 OIS のパーレート・PV・両レグ、ケース間の変化 |
| `summary.csv` | 項目ごとの件数、最大差、許容誤差を超えた件数 |
| `flat_forward_vs_log_linear.csv` | 補足：GaussQuant の flat_forward と log_linear_discount の差 |
| `session_info.txt` | R、QuantLib、GaussQuant、rmql の版 |

## 2. 使ったもの

| 項目 | 内容 |
|---|---|
| R | 4.6.0 (2026-04-24 ucrt) |
| 参照値 | GaussQuant 2026.6.18.1（git `c08fdb1`、導入版のビルド 2026-10-29）＋ QuantLib R パッケージ 1.42 |
| 照合先 | rmql 0.3.0（導入版のビルド 2026-11-07 17:58 JST、Rtools/GNU）。rmql の HEAD は `5717627`（2026-11-07 18:06 JST）。**導入版がどのコミットからビルドされたかは未確認**（ビルド時刻からは HEAD 直前の作業ツリーと推定） |
| GaussQuant の API | `bluegamma_tonar_quotes_GQL()`、`build_tonar_curve_from_market_GQL()`、`build_ois_GQL()`、`swap_fixed_leg_table_GQL()`、`ois_overnight_leg_table_GQL()` |
| rmql の API | `create_ois_instruments()`、`bootstrap_ois_curve()`、`with_extrapolation()`、`get_quote_repricing()`、`compute_discount()`、`compute_forward_rate()`、`create_ois_swap()`、`compute_ois_swap_value()`、`compute_ois_swap_cashflows()`、`compute_adjusted_date()`、`compute_advanced_date()`、`compute_end_of_month()` |

## 3. 入力

### 3.1 気配

GaussQuant の `bluegamma_tonar_quotes_GQL()`（評価日 2026-09-10 の BlueGamma TONAR OIS、単位は %）。値は GaussQuant のソースにあるものをそのまま使い、変えていない。

| 気配 | 1M | 3M | 6M | 1Y | 2Y | 3Y | 4Y | 5Y | 7Y | 8Y | 10Y | 15Y | 20Y | 30Y |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| レート（%） | 1.14 | 1.22 | 1.35 | 1.55 | 1.81 | 1.98 | 2.12 | 2.24 | 2.46 | 2.57 | 2.77 | 3.13 | 3.37 | 3.54 |

| 気配セット | 内容 | 位置づけ |
|---|---|---|
| `with_7y` | 上の 14 本（7 年を含む） | 今回の依頼どおりの共通サンプル |
| `without_7y` | 7 年を除く 13 本 | LagrangeFinLab の画面で使う予定のセット（前の依頼で合意）。7 年 OIS がピラーの間（5 年と 8 年の間）になる |

ケースは **base**（初期）と **bump_5y**（`TONAR-5Y` だけ +1bp = +0.0001）の 2 つ。

### 3.2 計算条件（両エンジンでそろえたもの）

| 項目 | GaussQuant（QuantLib） | rmql | 一致の確認 |
|---|---|---|---|
| 評価日 | `set_eval_date_GQL("2026-09-10")`（グローバル） | 引数 `evaluation_date = "2026-09-10"` | － |
| カーブの基準日 | 受渡日数 0 の `Piecewise*`（= 評価日） | `reference_date = "2026-09-10"` | － |
| カレンダー | `Japan()`（`Tonar` の指標カレンダー） | `"japan"`（`tonar` の指標） | 全商品の日付が一致 |
| カーブの日数計算 | Actual/365 Fixed | `"actual_365_fixed"` | － |
| OIS の受渡日数 | 2（`fixing_days`） | `settlement_days = 2` | 開始日 2026-09-14 が一致 |
| 支払頻度 | Annual（`OISRateHelper`・`MakeOIS` の既定） | `payment_frequency = 1` | 支払日が一致 |
| 支払ラグ | 0（既定） | `payment_lag = 0` | 同上 |
| スケジュール | Backward、ModifiedFollowing、月末なし（開始日が月末営業日でない） | 同じ（`MakeOIS` の規則を実装） | 同上 |
| 固定レグの日数計算 | 指標の日数計算（Act/365F） | `fixed_day_count = NULL`（指標の日数計算） | 固定クーポン額が一致 |
| ピラー | `LastRelevantDate` | 同じ | ピラーと最終関連日が一致 |
| 補間 | `log_linear_discount` と `log_cubic_discount` | `"log_linear"` と `"monotonic_log_cubic"` | 下の注 |
| 精度 | `accuracy` 1e-12（既定） | `accuracy = 1e-12` | － |
| 外挿 | 有効 | `with_extrapolation()` | 30 年までのグリッドは範囲内 |

注：GaussQuant の `log_cubic_discount` は SWIG の `PiecewiseLogCubicDiscount` で、既定の引数は C++ の `MonotonicLogCubic` と同じ設定である（rmql `docs/spec_ois.md` 2.7 節のソース確認）。

**7 年 OIS**：固定払い・TONA 受け（payer）、想定元本 100 億円（1e10 円）、2026-09-14 開始、2033-09-14 満期。固定レートは**補間ごとに GaussQuant の初期カーブから求めた丸め前の 7 年パーレート**で、同じ補間の両エンジン・両ケースに同じ値を渡した。

| 気配セット | 補間 | 固定レート（丸め前） |
|---|---|---|
| with_7y | log_linear | 0.0246000000000000 |
| with_7y | monotonic_log_cubic | 0.0246000000000118 |
| without_7y | log_linear | 0.0249165751690511 |
| without_7y | monotonic_log_cubic | 0.0246296312091305 |

## 4. 許容誤差と根拠

判定は丸める前の値で行う。基準は rmql の既存の QuantLib 照合で使っている値を流用し、今回のために緩めていない。

| 対象 | 許容誤差 | 根拠 |
|---|---|---|
| 日付（開始日、満期、ピラー、最終関連日、支払日） | 完全一致 | 日付は離散値。rmql P3 の基準 |
| 割引係数（対数線形） | 相対 1e-12 | rmql `spec_ois.md` 8.3 節。ブートストラップの `accuracy` 1e-12 と同じ桁 |
| 割引係数（対数 3 次） | 絶対 2e-12 | 同 10.4 節。反復の停止判定が最下位ビットで分かれうるため、両者がそれぞれ `accuracy` 以内で止まる上限 |
| 金利（再現した気配、7 年パーレート、1 暦日フォワード） | 絶対 1e-10（1e-6bp） | rmql 仕様書 5.1 節の金利の基準 |
| 入力の気配の再現 `\|implied − quote\|` | 絶対 1e-9 | 同 8.3 節 |
| PV・クーポン額（円） | 絶対 0.1 円（= 想定元本 × 1e-11） | rmql `spec_ois_swap.md` 4 章（想定元本あたり相対 1e-11）を 100 億円に当てはめた |
| PV 差（変更後 − 初期） | 絶対 0.2 円 | 上の値 2 つの差なので 2 倍 |
| 初期 PV がゼロであること | 各エンジンで \|PV\| ≤ 0.1 円 | パーレートを丸めずに渡すので、PV は浮動小数の誤差だけになるはず。上と同じ基準 |

## 5. 結果【実行照合済み】

### 5.1 総括（`results/summary.csv`）

4 つの組み合わせ（気配セット 2 × 補間 2）の全項目で、**許容誤差を超えた件数は 0**。

| 項目 | 件数（1 組あたり、2 ケース合計） | 最大差（4 組の最大） | 判定 |
|---|---|---|---|
| 商品の日付と再現した気配の両エンジン差 | 28 / 26 | 日付は完全一致、気配の差 0 | PASS |
| 入力の気配の再現（両エンジンの最大） | 28 / 26 | 3.0e-12（対数 3 次）、1.1e-13（対数線形）。両エンジンで同じ値 | PASS |
| 割引係数（ピラー、主要年限、スワップの日付） | 62 / 60 | **0（全件ビット単位で一致）** | PASS |
| 割引係数（月次グリッド、30 年まで） | 720 | **0（全件一致）** | PASS |
| 1 暦日の単利フォワード（上の全日付） | 782 / 780 | **0（全件一致）** | PASS |
| 7 年 OIS のクーポン（支払日、額） | 28 | 日付は完全一致、額は最大 6.0e-8 円 | PASS |
| 7 年パーレート | 2 | 6.6e-17 | PASS |
| 7 年 OIS の PV | 2 | 3.6e-7 円 | PASS |
| 7 年 OIS の PV 差 | 1 | 3.4e-7 円 | PASS |

割引係数・フォワードの差がちょうど 0 なのは、rmql `spec_ois.md` 10.6 節の記録（Rtools でビルドした R パッケージは QuantLib R パッケージと差 0）と矛盾しない。

### 5.2 主要年限の割引係数（`without_7y`、対数線形）

両エンジンの値は全件一致したので、1 列で示す（日付は評価日から n 年の暦日）。

| 年限 | 日付 | 初期 | 5 年 +1bp 後 |
|---|---|---|---|
| 1Y | 2027-09-10 | 0.984800279943713 | 0.984800279943713 |
| 2Y | 2028-09-10 | 0.964764564145862 | 0.964764564145862 |
| 3Y | 2029-09-10 | 0.942804753292858 | 0.942804753292858 |
| 5Y | 2031-09-10 | 0.894711095292085 | 0.894257565023815 |
| 7Y | 2033-09-10 | 0.840273662297138 | 0.840142619443063 |
| 10Y | 2036-09-10 | 0.757150925342484 | 0.757173402707449 |
| 30Y | 2056-09-10 | 0.331605801869773 | 0.331620823412342 |

4 年のピラー（2030-09-17）までは変わらない。5 年のピラーで割引係数が下がり、8 年以降のピラーではわずかに上がる。8 年以降の気配は据え置きなので、それぞれのパーを保つために、5 年から 8 年の間のフォワードが下がるからである。他の組み合わせの値は `results/discount_forward.csv` にある。

### 5.3 7 年パーレートと 7 年 OIS の PV（円）

PV は固定払い・TONA 受け、想定元本 100 億円。

| 気配セット | 補間 | 7 年パーの変化（bp）GQ / RFM | 初期 PV GQ / RFM | 変更後 PV GQ / RFM | PV 差 GQ / RFM | 両エンジンの PV 差の差 |
|---|---|---|---|---|---|---|
| with_7y | log_linear | −1.0e-13 / −3.5e-14 | −2.8e-7 / −2.4e-7 | −8.3e-7 / −4.8e-7 | −5.6e-7 / −2.4e-7 | 3.2e-7 |
| with_7y | monotonic_log_cubic | −2.2e-12 / −2.2e-12 | 5.6e-7 / 4.8e-7 | −1.3e-5 / −1.3e-5 | −1.39e-5 / −1.38e-5 | 5.0e-8 |
| without_7y | log_linear | +0.2356885150 / +0.2356885150 | 3.9e-6 / 4.1e-6 | 1,512,212.81990105 / 1,512,212.81990123 | +1,512,212.820 / +1,512,212.820 | 1.2e-8 |
| without_7y | monotonic_log_cubic | +0.4394699027 / +0.4394699027 | −8.3e-7 / −9.5e-7 | 2,821,127.01366188 / 2,821,127.01366210 | +2,821,127.014 / +2,821,127.014 | 3.4e-7 |

- **初期 PV**：両エンジンとも \|PV\| は最大 4.1e-6 円で、数値誤差の範囲でゼロである。
- **with_7y**：7 年の気配がカーブに入っていると、5 年を +1bp しても 7 年パーは変わらない（変化は 1e-12bp 以下）。ブートストラップが 7 年の気配を引き続き正確に再現するからである。したがって、固定レートを据え置いた 7 年 OIS の PV もほぼ 0 のまま（最大 1.4e-5 円）。
- **without_7y**：7 年はピラーの間にあり、その割引係数は 5 年と 8 年のピラーから補間される。5 年を上げると 7 年パーが上がり、固定払いの PV が増える（対数線形で +151 万円、対数 3 次で +282 万円）。どちらの補間でも、両エンジンの差は 1e-6 円未満である。補間によって約 1.9 倍違うのは、エンジンの差ではなく、補間方法の差である。

**PV に残る 1e-7 円程度の差の原因【実行確認】**：rmql を想定元本 1 で評価して 1e10 倍した値は、GaussQuant（想定元本 1 で評価して 1e10 倍）と**全 8 件で差 0** だった。固定レグと TONA レグの PV も、全 8 件で両エンジンが一致した。差は、約 16 億円の両レグを 100 億円の想定元本のまま差し引くときの丸め（倍精度で約 2.4e-7 円の刻み）だけから生じている（`swap_7y.csv` の `pv_unit_scaled_vs_direct_jpy`）。

### 5.4 補足：flat_forward と log_linear_discount（`check_flat_forward_vs_log_linear.R`）

rmql にはフラットフォワードのブートストラップがない。GaussQuant の 2 つの方式を比べると、割引係数の差は最大で絶対 6.3e-13、相対 1.0e-12、7 年パーの差は最大 1.0e-14 だった。Act/365F の時間軸では数式の上で同じカーブで、差はブートストラップの `accuracy`（1e-12）の範囲にとどまる。ビット単位では一致しない。

## 6. 既存 API でそろえられなかった条件と、追加実装が必要な箇所

| # | 条件 | 状況と影響 | 必要なこと |
|---|---|---|---|
| 1 | 7 年 OIS を期間（`7Y`）で作る | rmql の `create_ois_swap()` は開始日と満期日しか受け取らない（`spec_ois_swap.md` 6 章「未対応」）。今回は、rmql のカレンダー関数で `MakeOIS` の規則（`adjust` → 2 営業日先 → +7 年、開始日が月末営業日なら月末）をスクリプト側で再現した。+7 年の暦日の計算だけは R の `seq()` を使った。日付は QuantLib と一致したが、2 月 29 日や月末開始の場合は試していない | 期間と受渡日数から日付を作る関数（`MakeOIS` 相当）を rmql に追加するか、LagrangeFinLab 側で同じ規則を実装して照合する |
| 2 | 想定元本 | GaussQuant の `build_ois_GQL()` は想定元本を受け取らず、1 で作る。円の PV は 1e10 倍で求めた。影響は 5.3 節のとおり 1e-7 円程度 | 必須ではない。円で直接比べたければ、`QuantLib::MakeOIS` の想定元本を直接指定する |
| 3 | 補間方式 | GaussQuant の既定 `log_cubic_discount` と `log_linear_discount` は rmql と共通にできた。`flat_forward` は rmql にない | 画面でフラットフォワードを使うなら、rmql の `log_linear` を照合先にできる（5.4 節。許容誤差は相対 1e-12 程度とする） |
| 4 | 市場の規約 | 両エンジンとも QuantLib の既定（支払ラグ 0、年 1 回払い）にそろえた。rmql の調査（`spec_ois.md` 2.10 節）では、TONA OIS の支払ラグは二次資料で 2 営業日とされ、既定と異なる。今回の値は「QuantLib 既定の規約での照合」であり、市場の標準の規約によるものではない | 画面にそう書く。規約を変える場合は、両エンジンに同じ値（rmql は `payment_lag`、GaussQuant は `OISRateHelper` の引数）を渡して照合し直す |
| 5 | 版の特定 | 導入されている rmql 0.3.0 のビルド元コミットは未確認 | 照合を固定するなら、rmql のコミットを決めて `R CMD INSTALL` し直し、その SHA を記録する |
| 6 | ブラウザー版 | rmql の TypeScript・WebAssembly 版は未着手（rmql README・CLAUDE.md の L1〜L3）。今回の照合は R のネイティブ版（Rtools/GNU）だけ。WebAssembly 版の値は確かめていない | ブラウザーで rmql を直接動かすなら、wasm-bindgen の版を作り、ネイティブ版と別に照合する（rmql の方針「ネイティブと WebAssembly は分けて扱う」） |

## 7. 判断

**この条件（評価日 2026-09-10、Japan カレンダー、Act/365F、受渡 2 営業日、年 1 回払い、支払ラグ 0、対数線形または MonotonicLogCubic）では、rmql は LagrangeFinLab の照合先に使える。**

- 根拠：2 つの気配セット × 2 つの補間 × 2 ケースのすべてで、日付は完全一致し、割引係数と 1 日フォワードは差 0、7 年パーレートの差は最大 6.6e-17 だった。PV は 3.6e-7 円以内で、その原因（想定元本 1e10 で差し引くときの丸め）も確かめた。5 年 +1bp による 7 年パーの変化と PV 差も、両エンジンで 1e-6 円未満で一致した。
- 使い方の条件：
  1. 照合先として使うのは **R のネイティブ版**である。LagrangeFinLab の TypeScript の計算は、rmql（または GaussQuant）で前もって作った値と照合する。ブラウザーの中で rmql を照合先として直接動かすことは、現時点ではできない（6 章 #6）。
  2. 7 年 OIS の日付は、照合スクリプトで `MakeOIS` の規則から作る必要がある（6 章 #1）。
  3. 画面の補間をフラットフォワードにするなら、rmql の `log_linear` と相対 1e-12 程度で照合する（5.4 節）。
- 画面の設計への含意：依頼にある「5 年の気配を変えると、固定レートを据え置いた 7 年スワップの時価がなぜ変わるか」は、7 年の気配をカーブに入れない場合（`without_7y`）にだけ成り立つ。7 年の気配を入れると、PV の変化は数値誤差（1e-5 円以下）にとどまる。
