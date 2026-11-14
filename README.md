# LagrangeFinLab

『LagrangeFinance（エンタープライズ金融モデル構築）』第II部・第III部の React 版です。数式と解説を読みながら、ブラウザで金融モデルを動かせます。

| 画面 | 内容 | URL（開発時） |
|---|---|---|
| 目次と対応状況 | 第II部・第III部の全16章について、操作できること、RiemannFinMath で計算できる範囲、追加実装が必要な箇所（`src/book/toc.ts`） | http://127.0.0.1:8080/#/ |
| II-1 確定キャッシュフロー | TONAR のパー・スポット・フォワード、順・逆イールドの模式図、40年債のキャッシュフロー、単利→単価→複利利回り、フラットイールド、Zスプレッド、BPV・デュレーション・コンベクシティ、利回りの数値解法（II-1.1〜1.8。GaussQuant・原稿の結果に照合） | `#/part2/deterministic-cashflow` |
| II-2 金利カーブ | ゼロ金利ノードと平行シフトを操作して、ZeroCurve・DiscountCurve・シフト後のカーブを描く（II-2.2、2.3.1、2.5.2〜2.5.3。GaussQuant と差 0） | `#/part2/yield-curves` |
| II-2 国債先物・CTD・先物BPV | 受渡適格銘柄の Basis・Implied Repo・CTD と先物BPV（CTD の DV01 ÷ CF）。全銘柄の利回り水準と Funding Rate を動かして CTD の入れ替わりを見る（II-2.6〜2.7。現物価格は架空。GaussQuant・原稿のストレス結果と差 0） | `#/part2/jgb-futures` |
| II-4 ブラックモデル | Black 76 の価格と Greeks（公式と Black process）、モンテカルロの収束・パス・満期分布、European／American put の解析解・CRR・近似式、Sobol パスと Longstaff–Schwartz。入力・乱数・パス数を動かす（II-4.1〜4.6。GaussQuant・原稿の結果に照合。疑似乱数の MC は乱数が別） | `#/part2/black-model` |
| II-5 信用リスクとCDS | 1年物（MidPoint）と標準5年物（CDS2015、ISDA）の各レグ・NPV・Fair Spread・Fair Upfront・Accrual Rebate、ゼロ NPV の Hazard Rate、支払日ごとの表と手計算。市場 Spread・契約 Coupon・Recovery・割引率を動かす（II-5.1〜5.6。GaussQuant・原稿の結果と差 0） | `#/part2/credit-cds` |
| II-6 金利デリバティブのキャリブレーション | Normal・Black ボラの比較、SABR のスマイル（原稿の optim と calibrate_sabr）、Hull–White の債券オプションへの適合と未使用商品の検証、BGM の相関の減衰（II-6.1〜6.6。GaussQuant・原稿の結果に照合） | `#/part2/irs-calibration` |
| II-7 金利モデル | Hull–White の短期金利の経路と割引の検証、HJM のフォワードの変動係数、キャップレットの公式とモンテカルロ・満期のフォワードの分布、相関ショック、後決め金利の複利（II-7.1〜7.6。原稿のコードと原稿の結果に照合） | `#/part2/rate-models` |
| II-8 早期償還モデル | Hull–White のコール債（Bullet・Callable・コール権の価値、コール日ごとの判断、ボラティリティと格子の検証）、MBS のプリペイメント（シナリオ別の CPR と加重平均残存年数、金利経路、PSA 別の静的 OAS）（II-8.1〜8.8。原稿の結果に照合） | `#/part2/early-redemption` |
| II-9 金利為替系デリバティブ（PRDC） | クーポンのペイオフ、FX のサンプルパス、現在価値（閉じた式とモンテカルロ）、期待クーポンの期間構造とフロア・キャップの確率、クーポンの分布、FX スポット・ボラ感応度（II-9.1〜9.6。原稿の結果に照合） | `#/part2/prdc` |
| III-1 計算の進化と並列計算 | 6シナリオの逐次・並列の例、債券の件数とスレッド数を選んで一括評価の時間を測る（結果はスレッド数によらず同じ）（III-1.1〜1.7。原稿の例と照合） | `#/part3/parallel` |
| II-2・II-3 イールドカーブと円OIS | 数式の説明から、5年クォート＋1 bp で7年OISの時価が動くところまで | `#/part2/yield-curve-ois` |
| 応用：A1 オファーシート作成 POC | Curie の `docs/A1_offer_sheet_POC.qmd` の章立てと表を React にしたもの。各表の下に Curie の旧デモとの照合 | `#/asw/poc` |
| 応用：OISアセットスワップ・オファーシート | Curie のデモのオファー一覧と、銘柄ごとの ASW・JGBスプレッド・円換算 ASW の計算 | `#/asw` |

## 構成

| 役割 | 担当 | 場所 |
|---|---|---|
| 計算（カーブ構築、割引係数、フォワード、7年OISのパーレートとPV） | R の **RiemannFinMath**（ローカルHTTP API） | `server/` |
| 画面（MDXの本文と数式、表、グラフ、操作） | React＋TypeScript（Vite） | `src/` |
| APIの回帰テスト | Vitest。照合済みJSONと比べる | `tests/` |
| 照合済みJSONの生成 | R の RiemannFinMath | `golden/` |
| GaussQuant（QuantLib）との照合記録 | R | `reconciliation/` |

TypeScript は金融計算をしません。APIへの送信と、返ってきた値の表示だけを担当します。表示のために、2本のカーブの差（変更後 − 初期）を引き算することはあります。

```
ブラウザ (React)  --POST /api/scenario {"bumpTenor":"5Y","bumpBp":1}-->  Vite (8080, /api を転送)  -->  R API (127.0.0.1:8787)
                  <--------- 初期・変更後の割引係数、フォワード、7年パーレート、PV、PV差（JSON） ---------
```

13本のクォート、評価日、計算規約、7年OISの契約条件は、すべてR側（`server/R/tona_ois_model.R`）で管理します。ASW のオファー・銘柄属性・OIS 気配は `server/data/asw_demo/`、計算は `server/R/asw_model.R` です。

## 起動（Windows）

前提：R 4.6.0（`C:/Program Files/R/R-4.6.0`）に RiemannFinMath 0.3.0、GaussQuant（サンプルのクォートだけに使う）、httpuv、jsonlite が入っていること。Node.js 26（npm 11）で確認しています。

```powershell
cd C:\AnalyticFin\Projects\LagrangeFinLab
npm install          # 初回のみ

# ターミナル1：R API（127.0.0.1:8787）
npm run api

# ターミナル2：画面（http://127.0.0.1:8080/）
npm run dev
```

ビルドした版を見る場合は、`npm run build` の後に `npm run preview`（同じく http://127.0.0.1:8080/、`/api` はR APIへ転送。`npm run dev` とは同時に使えない）を使います。R API が動いていないと、画面に起動コマンドと再試行ボタンが表示されます。

### ポート

| 用途 | ポート |
|---|---|
| 画面（`npm run dev`・`npm run preview`）、社内LAN（`npm run lan`、画面とAPIを1つのポートで） | **8080** |
| 開発用の R API（`npm run api`。画面の `/api` の転送先） | 8787 |
| テスト（`npm test`）が起動する R API | 8788 |

8080 は1つのプロセスしか使えないので、`npm run dev`・`npm run preview`・`npm run lan` は同時に起動しません。

**8080 が使用中のとき**：3つのコマンドはどれも、起動前に `scripts/check-port.mjs` でポートを確かめ、使用中なら別のポートに切り替えずに、次のように理由を表示して止まります（終了コード 1）。Vite も `strictPort: true` なので、自分で別のポートに移ることはありません。

```
ポート 8080（127.0.0.1）は使用中のため起動しません（EADDRINUSE）。別のポートには切り替えません。
使っているプロセスを止めてから、もう一度実行してください。確認：netstat -ano | findstr :8080
```

`netstat -ano | findstr :8080` の最後の列がプロセス番号です。`tasklist /FI "PID eq <番号>"` で何かを確かめ、不要なら止めてから実行し直してください。

## 社内LANで使う

このPCをサーバーにして、同じ社内LANの他のPCやスマートフォンのブラウザから使います。ログインはありません。LANに届く人なら誰でも使えます。

```powershell
cd C:\AnalyticFin\Projects\LagrangeFinLab
npm run lan
```

`npm run lan` は画面をビルドしてから、R のサーバーを起動します。サーバーは全てのネットワークインターフェース（`0.0.0.0`）の 8080 番で待ち受け、画面（`dist/`）とAPIを同じポートで返します。起動時に、他のPCから開くURL（例：`http://192.168.1.254:8080/`）が表示されます。このPCからは `http://127.0.0.1:8080/` で開けます。止めるときは Ctrl+C です。

`npm run api` と `npm run dev` は、これまでどおり `127.0.0.1` だけで待ち受けます。LANに出るのは `npm run lan` のときだけです。

### Windows ファイアウォール（初回のみ、管理者のPowerShell）

社内LANでは、Windows はふつう「ドメイン」ネットワークとして扱います。その場合、8080番への受信を許可する規則が必要です。

```powershell
New-NetFirewallRule -DisplayName "LagrangeFinLab (TCP 8080)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private
```

- 規則を作らないと、他のPCからは接続できません（このPCからは開けます）。
- 社内のセキュリティポリシーで規則が無効になる場合や、作れない場合は、情報システム部門に相談してください。
- 公衆Wi-Fiなど「パブリック」のネットワークでは `npm run lan` を使わないでください。このPCには以前から R に対する「パブリック」の受信許可（`R for Windows front-end`）があり、`npm run lan` 中はそのネットワークからも接続できてしまいます。不要なら「Windows Defender ファイアウォール」の受信の規則から無効にできます。
- 規則を消すとき：`Remove-NetFirewallRule -DisplayName "LagrangeFinLab (TCP 8080)"`

### 確認したこと（2026-11-14）

このPCの LAN のアドレス（当時のポート 8787：`http://192.168.1.254:8787/`。2026-11-14 に 8080 に変更）経由で、画面、API（5年＋1 bp で PV差 1,512,212.8199円）、ブラウザでの操作を確認しました。存在しないパスと、`dist` の外のファイルを指すパス（`/../server/server.R` など）は 404 になります。**別のPCからの接続は、まだ確認していません。** 確認したときのネットワークは「パブリック」の Wi-Fi で、社内LANではなかったためです。

### 制約

- R のサーバーは1本の処理で順に計算します。1回の計算は約0.2秒なので、数人で同時に使う程度を想定しています。
- 通信は暗号化されていない HTTP です。社内LANの中だけで使ってください。
- このPCがスリープしたり、`npm run lan` を止めたりすると使えなくなります。

## 計算条件

照合（`reconciliation/RECONCILIATION.md`）の気配セット `without_7y`、補間 `log_linear` と同じ条件です。画面の「1. 計算条件」にも表示しています。

| 項目 | 値 |
|---|---|
| クォート | 円TONA OIS 13本（1M, 3M, 6M, 1Y, 2Y, 3Y, 4Y, 5Y, 8Y, 10Y, 15Y, 20Y, 30Y）。GaussQuant `bluegamma_tonar_quotes_GQL()` の14本から7年を除いたもの。**サンプルデータ** |
| クォートの単位 | 小数の金利（0.0224 = 2.24%）。画面では % で表示 |
| 評価日・カーブの基準日 | 2026-09-10 |
| カレンダー | 日本（RiemannFinMath の QuantLib 互換カレンダー） |
| カーブの日数計算 | Actual/365 Fixed |
| OISの受渡日数 | 2営業日（スポット日 2026-09-14） |
| 支払頻度・支払ラグ | 年1回・0営業日（QuantLib の既定。市場慣行とされる2営業日とは異なる） |
| 日程 | Backward、Modified Following（月末の扱いなし） |
| 固定レグの日数計算 | Actual/365 Fixed |
| ピラー | 最終関連日 |
| 補間 | 割引係数の対数線形 |
| ブートストラップの精度 | 割引係数で 1e-12 |
| フォワード | 1暦日の単利、Actual/365 Fixed：F(d) = (P(d)/P(d+1) − 1) ÷ (1/365)。ピラー間の連続複利フォワードも表で表示 |
| 7年OIS | 固定払い・TONA受け、想定元本 100億円、2026-09-14 開始、2033-09-14 満期 |
| 固定レート | 初期カーブの7年パーレート（丸め前）0.024916575169051068。変更後も据え置き |
| 操作 | 5年クォートだけを ＋1 bp、または初期値に戻す |

## API

`POST /api/scenario`

```json
{ "bumpTenor": "5Y", "bumpBp": 1 }
```

- `bumpTenor`：13本の年限のどれか。`bumpBp`：有限の数で、絶対値は100以下。それ以外は HTTP 400 を返します。
- 応答（`src/api/types.ts`）：`conventions`、`quotes`（初期と変更後）、`swap_terms`（固定レート、日程）、`cases.base` と `cases.scenario`（`instruments`、`nodes`、`segments`、`curve_points` の日付・年数・割引係数・1日フォワード、`swap` のPV・両レグ・パーレート・キャッシュフロー）、`pv_change`、`par_change_bp`。数値は丸めていない倍精度です（17桁）。
- `curve_points` は、30年までの週次と月次の日付、主要年限の応当日、ピラーとその前後の日、7年OISの開始日と満期日を含みます。最後のピラーより先へは外挿しません。

`GET /api/health` は状態と固定レートを返します。APIは `127.0.0.1` だけで待ち受けます。

すべての応答は `response.request_id` を持ちます。ページは要求ごとに `X-Request-Id` ヘッダーで ID を送り、サーバーはそれをそのまま返します（サーバーは状態を持ちません）。ページは、図・表・PV に同じ ID を表示し、送った ID と違う応答は受け付けません。

`GET /api/asw/report` は A1 POC の表のデータ（旧デモの値 `reference` 付き）、`POST /api/asw/offers/<id>/jgb-spread`（`{"spreadBp": 11.5}`）は円建て債券の JGB対比スプレッドを単価に換算する（参考機能）。`GET /api/asw/offers` はオファー一覧（計算できない行も理由付きで含む）、`GET /api/asw/offers/<id>`（例：`JPY-02`）は1件の詳細（カーブ、価格の換算、債券と翌日物レグのキャッシュフロー、ASW の内訳と確かめ）を返します。

## OISアセットスワップ・オファーシート

LagrangeFinance の `docs/asw_offer_sheet_spec.qmd` の発行通貨建て ASW を、Curie の A1 オファーシートのデモデータ（**架空**、評価日 2026-10-06、12件）で計算します。

- **ASW**：$s^* = (B - L - R - U,D(t,S)) / A$。債券CFを支払い、翌日物（日次複利）＋スプレッドと満期の元本を受け取り、受渡日に $U = N(P_d/100 - 1)$ を授受します。計算は RiemannFinMath の `compute_ois_asset_swap`。詳細画面のキャッシュフローは `get_bond_cashflows` と `create_ois_swap`・`compute_ois_swap_cashflows` から組み立て、エンジンの値と一致することを確かめています。
- **規約**（Curie の旧デモと同じ）：OIS カーブは MonotonicLogCubic・年1回払い・支払ラグ0・外挿なし（JPY は TONA、USD は SOFR、EUR は €STR、受渡2営業日）。ASW の翌日物レグは年2回・支払ラグ0（Curie のデモの仮定）。銘柄属性は ISIN とオファー日で結合（exact）。
- **計算しない行**：変動利付債、期限前償還条項付き債、償還額が100でない債券、カーブの最後のピラーより後に満期がある債券、受渡日が合わないオファーなど。理由を表示し、行は残します。
- **データの更新**：`npm run snapshot:asw`（`scripts/asw/snapshot_curie_demo.R`）が Curie から `server/data/asw_demo/`（入力データ、オファーExcelの列の対応 `offer_columns.csv`、旧デモの結果 `curie_reference.json`）を作ります。出所は `server/data/asw_demo/PROVENANCE.md`。
- **照合**：`npm run reconcile:asw` と `reconciliation/asw/RECONCILIATION_ASW.md`。テスト円債B（JPTEST000022）の ASW は旧デモ 10.484125871669359 bp との差 5.3e-15 bp（全10件で最大 2.8e-14 bp）。TEST USD BOND F（USTEST000016）の円換算 ASW は旧デモ 86.349380112377887 bp との差 7.3e-11 bp（全5件で最大 1.1e-9 bp）。
- **円換算 ASW**（外貨建て債券）：円担保・元本一定の通貨スワップ（外貨翌日物フラット支払、円TONAR＋ベーシス受取）で円にヘッジしたときの、円TONAR に対するフェア・スプレッド $s_j^* = (B_j - Q_j - U_j)/A_j$。満期のベーシス1点で外貨割引の一定スプレッド $z$ を $Q_f(z) - Q_j - bA_j = 0$ から校正する（CCS の期間構造の校正ではない）。計算は RiemannFinMath の `compute_yen_asset_swap`。ベーシスは、元本一定・円担保の気配だけを同じ満期で平均し、評価日からの年数で自然3次スプライン補間（外挿なし、R の `stats::splinefun`）。FX スポットの受渡日が ASW の開始日と違う行は計算しない。データは `server/data/asw_demo/fx.txt`・`basis.txt`。
- **JGBスプレッド**（円建て債券）：（複利利回り − 同じ償還日に補間したJGB複利利回り）× 100 bp。複利利回りは日本式（利払・複利とも年2回、残存年数は満年数＋端数ACT/365、小数第7位で切り捨て）で RiemannFinMath の `compute_compound_yield_from_price`。JGB 時価は `server/data/asw_demo/jgb.txt`。同じ受渡日の JGB を償還日ごとに平均し、受渡日からの年数で自然3次スプライン補間（外挿なし）。
- **入力項目と入力検証**：オファーExcelの見出しと共通形式の列の対応（`offer_columns.csv`、Curie の `convert_offer_sheet_Curie()` で作成）を詳細画面と POC に表示。入力検証は Curie と同じ問題コード（`unsupported_product` など）。
- **JGB対比スプレッドで提示された気配**：Curie は扱わない（単価 `offer_price` が必須）。POC の 3.3 で、Curie の定義を逆に解いて単価に換算できる（参考機能。特定のベンチマーク銘柄対比や単利利回りでの提示には対応しない）。
- **未対応**：元本リセット型 CCS、FX スワップによる受渡日の調整、CCS の期間構造の校正。

## 照合済みJSON（回帰テストの期待値）

`tests/golden/tona_ois_golden.json` は、`golden/generate_golden.R` が RiemannFinMath で作ります。このスクリプトは API のコード（`server/R/tona_ois_model.R`）とは別に書いてあり、同じ条件を独立に組み立てます。記録している内容は次のとおりです。

- クォート（初期・5年＋1 bp）、評価日、計算規約、5年＋1 bp の指定
- 7年OISの条件：想定元本、丸め前の固定レート、開始日・満期日、両レグの支払日程（計算期間、支払日、金額）
- 両ケースの各商品の日付と再現レート、カーブの節点、割引係数と1日フォワード（800点）、7年パーレート、PV、両レグのPV
- PV差（変更後 − 初期）

再生成の手順：

```powershell
npm run golden
# = Rscript golden/generate_golden.R（scripts/run-r.mjs が C:/Program Files/R/R-4.6.0/bin/Rscript.exe を呼ぶ。別の場所なら環境変数 RSCRIPT で指定）
```

スクリプトは17桁で書き出し、読み戻した値が元の倍精度と同じであることを確かめます。RiemannFinMath を入れ替えたり、条件を変えたりした場合は、先に `npm run reconcile`（GaussQuant との照合、`reconciliation/reconcile_tona_ois.R`）で照合し直し、その結果を確かめてから再生成してください。

## テスト

```powershell
npm test
```

テストは R API を `127.0.0.1:8788` で起動し（`tests/globalSetup.ts`）、`{"bumpTenor":"5Y","bumpBp":1}` と `{"bumpTenor":"5Y","bumpBp":0}` を送って、照合済みJSONと比べます。ASW は `tests/asw.api.test.ts` と `tests/asw.poc.test.ts` が全オファーを Curie の旧デモの結果（`server/data/asw_demo/curie_reference.json`）と比べます（ASW・円換算 ASW・JGBスプレッド・ベーシス 1e-6 bp、利回り 1e-10 %、価格 1e-10、CCS 校正の残差 1e-6 円。結果は `test-results/asw-report.json`・`asw-poc-report.json`）。終わるとAPIを止めます。動いているAPIを使う場合は `LFL_TEST_API_URL=http://127.0.0.1:8787` を指定します。各項目の最大差は `test-results/regression-report.json` に書き出します。

### 許容誤差と実測差（2026-11-14）

| 項目 | 件数 | 許容誤差 | 実測の最大差 |
|---|---|---|---|
| 商品の日付（開始日、満期日、ピラー）、キャッシュフローの日付 | 26＋28 | 完全一致 | 一致 |
| 再現レート | 26 | 絶対 1e-10 | 0 |
| 割引係数（節点） | 28 | 相対 1e-12 | 0 |
| 割引係数（800点） | 800 | 相対 1e-12 | 0 |
| 1日フォワード | 800 | 絶対 1e-10 | 0 |
| 固定レート | 1 | 絶対 1e-10 | 0 |
| 7年パーレート（両ケース） | 2 | 絶対 1e-10 | 0 |
| 7年OISのPV、両レグのPV（両ケース） | 6 | 絶対 0.1円 | 0 |
| キャッシュフローの金額 | 28 | 絶対 0.1円 | 0 |
| 初期PVがゼロであること | 1 | \|PV\| ≤ 0.1円 | 4.05e-6円 |
| PV差 | 1 | 絶対 0.2円 | 0（PV差 1,512,212.8199円、丸めると +1,512,213円） |
| 初期カーブでの7年パーと固定レートの差 | 1 | 絶対 1e-10 | 6.2e-17 |

許容誤差は GaussQuant と RiemannFinMath の照合（`reconciliation/RECONCILIATION.md` 4章）と同じです。根拠も同じで、割引係数はブートストラップの精度 1e-12、金利は 1e-6 bp、PVは想定元本あたり 1e-11（100億円で0.1円）です。今回は、APIと照合済みJSONが同じ RiemannFinMath のビルドで計算されているため、差はすべて0でした。許容誤差は、RiemannFinMath のビルドや実行環境が変わったときの最下位ビットの差を許すためのものです。

最後の行の 6.2e-17 は誤差ではありません。固定レートは「固定レート0のスワップのパーレート」として求め、テストでは「固定レートKのスワップのパーレート（K − NPV／年金現価）」と比べるため、最下位の桁が違います。

## ファイル

```
server/server.R              R API（httpuv）
server/R/tona_ois_model.R    円OIS：入力・規約と RiemannFinMath の呼び出し
server/R/asw_model.R         ASW：オファーと属性の結合、検証、RiemannFinMath の呼び出し
server/data/asw_demo/        ASW のデモデータ（Curie から複製、架空）
src/book/                    共通目次（toc.ts）、目次画面、ルーター
src/api/                     APIの型とクライアント
src/state/ScenarioContext.tsx  円OIS章の操作の状態とAPI呼び出し
src/components/              グラフ（LineChart、FlowChart）と円OIS章の部品（表示のみ）
src/content/part2/           章の本文と数式（MDX）
src/asw/                     オファー一覧と詳細の画面
scripts/asw/                 Curie のデモデータの複製
golden/generate_golden.R     照合済みJSONの生成
tests/                       APIの回帰テスト、照合済みJSON
reconciliation/              GaussQuant と RiemannFinMath の照合（asw/ は Curie の旧デモとの照合）
```

## 制約

- 照合と期待値は「QuantLib の既定の規約（支払ラグ0、年1回払い）」によるもので、市場で標準とされる規約ではありません。
- 7年OISの日付は、QuantLib の `MakeOIS` と同じ規則でR側で作ります（RiemannFinMath には期間からスワップを作る関数がないため）。開始日が月末営業日の場合には対応していません。
- RiemannFinMath 0.3.0 の導入版のビルド元コミットは未確認です（`reconciliation/RECONCILIATION.md` 6章）。
- 計算にはR APIが必要です。ブラウザだけでは動きません。
