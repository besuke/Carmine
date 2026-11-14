// The common table of contents of LagrangeFinLab: Part II and Part III of LagrangeFinance
// (_quarto.yml, LagrangeFinance commit b9ddc2a; the chapters are unchanged since 05e1932).
//
// For each chapter: what the reader will be able to operate (a plan unless the chapter is implemented),
// what RiemannFinMath 0.3.0 already computes (the function names exist in the installed package; the
// section-by-section judgement is Riemann's docs/lagrangefinance_coverage.md of 2026-11-07), and what
// would have to be added. Calculations always run in R through the HTTP API.

export type Coverage = "対応" | "一部" | "未対応" | "対象外";

export interface SectionRow {
  sections: string;
  topic: string;
  coverage: Coverage;
  riemann: string; // RiemannFinMath functions, or why not
}

export interface Chapter {
  id: string; // e.g. "II-3"
  title: string;
  source: string; // Quarto file
  operations: string[]; // what the reader will operate in the React version
  rows: SectionRow[];
  additions: string[]; // what has to be implemented (Riemann or API) for the operations
  route?: string; // the React chapter, when it exists
  subRoutes?: { route: string; title: string }[]; // further React pages of the same chapter
  routeNote?: string;
}

export interface Part {
  id: string;
  title: string;
  chapters: Chapter[];
}

export const BOOK_TITLE = "エンタープライズ金融モデル構築";

export const TOC: Part[] = [
  {
    id: "II",
    title: "第II部 金融工学　無裁定モデル",
    chapters: [
      {
        id: "II-1",
        title: "確定キャッシュフロー",
        source: "part2_quantive_riemann/ch01_deterministic_cashflow.qmd",
        route: "/part2/deterministic-cashflow",
        routeNote: "II-1.1〜1.8 を実装済み（模式図の水準と傾き、債券の単利利回り・クーポン・Zスプレッドを操作。GaussQuant と原稿の結果に照合）。数値解法（II-1.8）は原稿と同じ R の関数を API が実行する",
        operations: [
          "利回りを動かして、単価・経過利子・デュレーション・コンベクシティ・BPVの変化を見る",
          "クーポンと残存年数を変えて、価格と利回りの関係（凸性）を描く",
          "パーレート・ゼロ金利・フォワードの三つの曲線を重ねて比べる",
        ],
        rows: [
          { sections: "II-1.1〜1.2", topic: "パーレート、割引係数、スポット、フォワード", coverage: "対応", riemann: "bootstrap_ois_curve、compute_discount、compute_zero_rate、compute_forward_rate" },
          { sections: "II-1.3〜1.5", topic: "固定利付債、キャッシュフロー、単利・複利利回りと単価", coverage: "対応", riemann: "create_fixed_rate_bond、get_bond_cashflows、compute_price_from_simple_rate、compute_bond_values" },
          { sections: "II-1.6〜1.7", topic: "カーブ評価、Zスプレッド、ASW、デュレーション、BPV", coverage: "対応", riemann: "compute_bond_value_on_curve、compute_z_spread_from_price、compute_duration、compute_convexity、compute_basis_point_value" },
          { sections: "II-1.8", topic: "複利利回りの数値解法の比較", coverage: "一部", riemann: "利回りは compute_compound_yield_from_price。解法を選んで比べる関数はない" },
        ],
        additions: ["解法（ニュートン、二分法、Brent）の反復過程を返す関数（II-1.8 の比較を見せる場合）"],
      },
      {
        id: "II-2",
        title: "金利カーブ",
        source: "part2_quantive_riemann/ch02_interest_rate_curves.qmd",
        operations: [
          "【実装済み】ゼロ金利ノードを編集して、割引係数・ゼロ金利・フォワードの曲線を描き直す",
          "【実装済み】ゼロ金利補間と割引係数補間を重ね、フォワードの形の違いを見る。平行シフトの幅を変える",
          "【実装済み】国債先物の受渡適格銘柄の Basis・Implied Repo・CTD と先物BPV を見る。全銘柄の利回り水準と Funding Rate を動かし、CTD の入れ替わりを見る（現物価格は架空）",
        ],
        rows: [
          { sections: "II-2.1", topic: "国債利回りのスプライン補間、年限・時間方向の変化", coverage: "対象外", riemann: "R の spline の計算で、RiemannFinMath の対象外。API で R の関数として返すことはできる" },
          { sections: "II-2.2〜2.3", topic: "ゼロカーブ、割引係数カーブ、補間とフォワード、参照日", coverage: "対応", riemann: "create_zero_curve、create_discount_curve、compute_discount、compute_zero_rate、compute_forward_rate" },
          { sections: "II-2.4.1", topic: "預金と債券のブートストラップ", coverage: "一部", riemann: "bootstrap_bond_curve は債券だけ。預金のヘルパーがない" },
          { sections: "II-2.4.2", topic: "預金と IBOR スワップのブートストラップ", coverage: "対象外", riemann: "LIBOR は公表が終わり、市場は OIS に移った。原稿のこの節は LIBOR→OIS の流れを知らない読者向けの説明なので、React 版では作らない。カーブ構築は OIS（TONAR・€STR・SOFR・SONIA）で行う" },
          { sections: "II-2.5.1", topic: "Implied Term Structure", coverage: "未対応", riemann: "なし" },
          { sections: "II-2.5.2〜2.5.3", topic: "平行シフトと検証", coverage: "対応", riemann: "create_zero_spreaded_curve" },
          { sections: "II-2.6〜2.7", topic: "国債先物、Gross・Net Basis、CTD", coverage: "対応", riemann: "compute_future_basket、compute_future_basis" },
        ],
        additions: ["預金のヘルパー（II-2.4.1）", "Implied Term Structure（II-2.5.1）"],
        route: "/part2/yield-curves",
        subRoutes: [{ route: "/part2/jgb-futures", title: "国債先物・CTD・先物BPV（II-2.6〜2.7）" }],
        routeNote: "II-2.2、II-2.3.1、II-2.5.2〜2.5.3 を実装済み（ゼロ金利ノードと平行シフトを操作。GaussQuant と差 0 で照合）。II-2.2〜2.4 の考え方は円OISの章にもある",
      },
      {
        id: "II-3",
        title: "OISスワップとマルチカーブ評価",
        source: "part2_quantive_riemann/ch03_ois_swaps_multicurve.qmd",
        operations: [
          "【実装済み】円TONA OISカーブを構築し、5年クォート＋1 bp とリセットで、割引係数・フォワードと7年OISの時価の変化を見る",
          "日次複利の明細と、Fixing を入れたときの再評価を見る",
          "SOFR で予測カーブと割引カーブを分け、マルチカーブ評価との差を見る",
          "4通貨の OIS カーブとアセットスワップスプレッドを比べる",
        ],
        rows: [
          { sections: "II-3.1〜3.3", topic: "TONA の OIS カーブ、短期 OIS、フェアレート、日次複利、Fixing", coverage: "対応", riemann: "bootstrap_ois_curve、create_ois_swap、compute_ois_swap_value、compute_ois_swap_cashflows、compute_ois_swap_daily_rates" },
          { sections: "II-3.4.1〜3.4.3", topic: "SOFR の OIS カーブ、マルチカーブ評価", coverage: "対応", riemann: "compute_ois_swap_value の discount_curve" },
          { sections: "II-3.4.4", topic: "IBOR バニラスワップとシングルカーブ評価の比較", coverage: "対象外", riemann: "LIBOR は公表が終わり、市場は OIS に移った。原稿のこの節は LIBOR→OIS の流れを知らない読者向けの説明なので、React 版では作らない。マルチカーブ評価は SOFR の OIS で扱う（II-3.4.1〜3.4.3）" },
          { sections: "II-3.5〜3.6", topic: "EONIA カーブとシナリオ別の再評価", coverage: "対象外", riemann: "EONIA は扱わない方針。考え方（市場レート変動と評価損益）は TONA で実装済み" },
          { sections: "II-3.7", topic: "4通貨 OIS カーブ、OIS アセットスワップ、円ベーシス込み ASW", coverage: "対応", riemann: "bootstrap_ois_curve、compute_ois_asset_swap、compute_yen_asset_swap、compute_ctd_time_value" },
        ],
        additions: ["期間（7Y など）と受渡日数から OIS の日付を作る関数（今は API 側で MakeOIS の規則を再現）"],
        route: "/part2/yield-curve-ois",
        routeNote: "II-3.1.3、II-3.2 と、市場レート変動による評価損益（II-3.6 の考え方を TONA で）",
      },
      {
        id: "II-4",
        title: "ブラックモデル",
        source: "part2_quantive_riemann/ch04_black_model.qmd",
        route: "/part2/black-model",
        routeNote: "II-4.1〜4.6 を実装済み（Black 76・BSM の入力、MC の乱数とパス数、LSM のパス数を操作。GaussQuant と原稿の結果に照合。疑似乱数の MC は乱数が別なので判定しない）",
        operations: [
          "原資産・権利行使価格・ボラティリティ・満期を動かして、Black76 と BSM の価格とグリークスを見る",
          "パス数と乱数（疑似乱数・Sobol）を変えて、モンテカルロの収束と標準誤差、パスと満期分布を見る",
          "アメリカン put の早期行使価値（二項・近似式）を比べる",
          "Sobol 列と疑似乱数、Longstaff–Schwartz の価格を比べる",
        ],
        rows: [
          { sections: "II-4.1〜4.3", topic: "Black76、BSM の価格とグリークス、二項ツリー", coverage: "対応", riemann: "compute_forward_option_value、compute_european_option_value、compute_binomial_option_value" },
          { sections: "II-4.4", topic: "モンテカルロ評価とパス", coverage: "対応", riemann: "compute_monte_carlo_european_value、generate_black_scholes_paths" },
          { sections: "II-4.5", topic: "アメリカン put", coverage: "対応", riemann: "compute_binomial_option_value、compute_american_approximation_value" },
          { sections: "II-4.6", topic: "Sobol 列、Longstaff–Schwartz", coverage: "対応", riemann: "generate_sobol_sequence、compute_longstaff_schwartz_value" },
        ],
        additions: ["なし（API の入口とグラフの追加だけ）"],
      },
      {
        id: "II-5",
        title: "信用リスクとCDS",
        source: "part2_quantive_riemann/ch05_credit_risk_cds.qmd",
        route: "/part2/credit-cds",
        routeNote: "II-5.1〜5.6 を実装済み（1年物と標準5年物の Spread・Coupon・Recovery・割引率を操作。GaussQuant と原稿の結果に差 0 で照合）。支払日ごとの表は、RiemannFinMath の割引係数と生存確率から R 側で組み立てている",
        operations: [
          "市場 Spread・契約 Coupon・回収率・割引率を動かして、Premium Leg・Protection Leg・Fair Spread・Fair Upfront を見る",
          "ゼロ NPV のハザードレートを推定し、単純近似 s/(1−R) と比べる。Spread と回収率の感応度表",
          "支払日ごとのキャッシュフロー表から手計算し、エンジンの値と比べる",
          "ISDA エンジンと MidPoint の評価差を見る",
        ],
        rows: [
          { sections: "II-5.1〜5.4", topic: "生存確率、MidPoint、各レグ、ハザードの推定と感応度", coverage: "対応", riemann: "create_hazard_curve、compute_cds_value、bootstrap_hazard_curve、compute_cds_quote_sensitivity" },
          { sections: "II-5.2.5、5.6.4", topic: "CDS の支払日ごとの表と確率表", coverage: "一部", riemann: "値と各レグは返すが、支払日ごとの表は返さない" },
          { sections: "II-5.5〜5.6", topic: "標準 CDS、ISDA エンジン、Fair Upfront", coverage: "対応", riemann: "compute_cds_maturity、compute_cds_value（isda）" },
        ],
        additions: ["CDS の支払日ごとの明細（既存の計算の中間値を返す）"],
      },
      {
        id: "II-6",
        title: "金利デリバティブのキャリブレーション",
        source: "part2_quantive_riemann/ch06_irs_calibration.qmd",
        route: "/part2/irs-calibration",
        routeNote: "II-6.1〜6.6 を実装済み（Normal・Black の比較、SABR の β、Hull–White の基準パラメータ、BGM の相関の減衰を操作。原稿の optim の手順と RiemannFinMath のキャリブレーション関数を並べ、GaussQuant と原稿の結果に照合）",
        operations: [
          "SABR のパラメータを動かして、市場スマイルとの当てはまりを見る。校正ボタンで最適値へ",
          "Black 型と Normal 型のボラティリティを換算して比べる",
          "Hull–White の a と σ を校正し、債券オプション価格の再現を見る",
        ],
        rows: [
          { sections: "II-6.2〜6.4", topic: "Normal ボラ、SABR の校正、Hull–White の校正", coverage: "対応", riemann: "compute_forward_option_value（Bachelier）、calibrate_sabr、compute_hull_white_bond_option_value、calibrate_hull_white" },
          { sections: "II-6.5", topic: "BGM のキャップレットと相関（Rebonato）", coverage: "対応", riemann: "compute_rebonato_swaption_volatility、calibrate_lmm_correlation" },
        ],
        additions: ["なし（API の入口とグラフの追加だけ）"],
      },
      {
        id: "II-7",
        title: "金利モデル",
        source: "part2_quantive_riemann/ch07_irs_rate_models.qmd",
        route: "/part2/rate-models",
        routeNote: "II-7.1〜7.6 を実装済み（Hull–White の a・σ、キャップレット、目標相関、架空の翌日物金利を操作。原稿と同じ R の乱数を使い、原稿のコードと原稿の結果に照合）。II-7.2 の経路は原稿の R の手順で作り、RiemannFinMath の月次の経路を並べる",
        operations: [
          "Hull–White の a と σ を動かして、短期金利の経路を描く",
          "LMM のキャップレット価格と相関ショックを見る",
          "後決め金利（FMM）のキャップレットを前決めと比べる",
        ],
        rows: [
          { sections: "II-7.2", topic: "Hull–White の状態遷移と割引係数の確認", coverage: "一部", riemann: "generate_hull_white_monthly_rates は月次の短期金利だけ。割引係数の検証の表はない" },
          { sections: "II-7.3", topic: "HJM", coverage: "対象外", riemann: "説明だけでコードがない" },
          { sections: "II-7.4〜7.5", topic: "LMM、FMM と後決め金利", coverage: "対応", riemann: "compute_lmm_caplet_value、compute_caplet_from_normals、compute_backward_caplet_value" },
        ],
        additions: ["Hull–White の経路と割引係数の検証（II-7.2.2）"],
      },
      {
        id: "II-8",
        title: "早期償還モデル",
        source: "part2_quantive_riemann/ch08_early_redemption_models.qmd",
        route: "/part2/early-redemption",
        routeNote: "II-8.1〜8.8 を実装済み（Hull–White の a・σ、クーポン、コール日とコール価格、MBS の PSA・借換えの感応度とコストを操作。原稿の結果に照合）",
        operations: [
          "Hull–White のパラメータと金利水準を動かして、コール債の価格とコールオプション価値を見る",
          "コール日ごとの判断（コールする金利の上限）と、ボラティリティによるコール権の価値の変化を見る",
          "PSA を動かして、MBS のキャッシュフロー・加重平均残存年数・OAS を見る",
        ],
        rows: [
          { sections: "II-8.1〜8.7", topic: "コール債、バックワード・インダクション、Bermudan", coverage: "対応", riemann: "compute_hull_white_callable_bond_value、compute_hull_white_bermudan_swaption_value（行使判断の表は返さない）" },
          { sections: "II-8.8", topic: "MBS のプリペイメントと OAS", coverage: "対応", riemann: "compute_mbs_cashflows、compute_mbs_path_values、compute_mbs_oas" },
        ],
        additions: ["行使判断の表（各ノードでコールするか）を返す関数（II-8.3 の図を見せる場合）"],
      },
      {
        id: "II-9",
        title: "金利為替系デリバティブ（PRDC）",
        source: "part2_quantive_riemann/ch09_exotic_derivatives_prdc.qmd",
        route: "/part2/prdc",
        routeNote: "II-9.1〜9.6 を実装済み（FX スポット・ボラ・金利、クーポンの条件、モンテカルロのパス数と seed を操作。原稿の結果に照合）",
        operations: [
          "FX スポット・ボラティリティ・金利とクーポンの条件を動かして、PRDC の現在価値と FX デルタ・ベガを見る。モンテカルロのパス数で標準誤差を見る",
          "クーポンの期間構造と分布、キャップ・フロアへの到達確率を見る",
        ],
        rows: [
          { sections: "II-9.1〜9.3.3", topic: "条件、FX 過程、クーポン、MC の現在価値", coverage: "対応", riemann: "generate_schedule、compute_prdc_value" },
          { sections: "II-9.3.4、9.4", topic: "期待クーポン、期間構造、到達確率、分布", coverage: "一部", riemann: "compute_prdc_value は返さない。各クーポンを compute_forward_option_value（Black）で評価して求める" },
          { sections: "II-9.5", topic: "FX 感応度と MC の標準誤差", coverage: "対応", riemann: "compute_prdc_value の fx_delta、fx_vega、standard_error" },
        ],
        additions: ["PRDC の期待クーポン・到達確率・分布を返す関数（今は API 側で Black の式から組み立てている）"],
      },
    ],
  },
  {
    id: "III",
    title: "第III部　エンタープライゼーション",
    chapters: [
      {
        id: "III-1",
        title: "計算の進化と並列計算",
        source: "part3_enterprise_riemann/ch01_computational_evolution_parallel.qmd",
        operations: ["件数とスレッド数を選んで、債券やカーブの一括計算の時間をサーバーで測る"],
        rows: [
          { sections: "III-1.1〜1.4", topic: "金融と情報工学の歩み、ハードウェアの限界", coverage: "対象外", riemann: "説明の節" },
          { sections: "III-1.5〜1.6", topic: "R による並列計算と効果", coverage: "一部", riemann: "Rust の並列バッチ compute_bond_values_batch、compute_curve_values_batch。R の future・furrr そのものは対象外" },
          { sections: "III-1.7", topic: "自動微分の導入", coverage: "対象外", riemann: "説明の節（計算は III-4 以降）" },
        ],
        additions: ["計算時間を測って返す API（並列数を指定）"],
      },
      {
        id: "III-2",
        title: "分散コンピューティングとジョブ・タスク",
        source: "part3_enterprise_riemann/ch02_distributed_computing_jobtask.qmd",
        operations: ["計算の分割と分配の流れを図で追う（数値計算はしない）"],
        rows: [{ sections: "III-2.1〜2.5", topic: "処理の分割、資源への分配、制御、統合", coverage: "対象外", riemann: "説明の章。Riemann の docs/design_distributed.md が対応する設計" }],
        additions: ["なし（図と説明）"],
      },
      {
        id: "III-3",
        title: "エンタープライズ金融計算",
        source: "part3_enterprise_riemann/ch03_enterprise_financial_computing.qmd",
        operations: ["シナリオの格子を選んで PRDC を一括評価し、リスクを集計する"],
        rows: [
          { sections: "III-3.1〜3.3", topic: "取引・市場データ、プライシング・エンジン、シナリオ", coverage: "対象外", riemann: "説明の節" },
          { sections: "III-3.4〜3.5", topic: "シナリオ格子の並列評価と集計", coverage: "一部", riemann: "一括評価の関数はない（compute_prdc_value を API から呼び直せば可能）" },
        ],
        additions: ["シナリオ格子を一括で評価する API（Rust の並列バッチに載せるなら Riemann 側に関数）"],
      },
      {
        id: "III-4",
        title: "自動微分",
        source: "part3_enterprise_riemann/ch04_automatic_differentiation.qmd",
        operations: ["有限差分の刻み幅を変えて、自動微分との差を見る（Riemann の感応度を題材に）"],
        rows: [
          { sections: "III-4.1〜4.3", topic: "金融計算と微分、有限差分、自動微分の原理", coverage: "一部", riemann: "自動微分はライブラリの計算の内部（例：compute_curve_node_sensitivity）" },
          { sections: "III-4.4", topic: "torch による一般の関数の自動微分", coverage: "対象外", riemann: "方針：torch ではなく自前の自動微分" },
        ],
        additions: ["教材用に、有限差分と自動微分を同じ関数で比べる API"],
      },
      {
        id: "III-5",
        title: "オプションのグリークスと自動微分",
        source: "part3_enterprise_riemann/ch05_option_greeks_autodiff.qmd",
        operations: ["解析解とモンテカルロ＋自動微分のグリークスを並べ、パス数による差を見る"],
        rows: [
          { sections: "III-5.2〜5.3", topic: "解析解と MC のグリークス", coverage: "対応", riemann: "compute_european_option_value、compute_monte_carlo_european_value" },
          { sections: "III-5.4", topic: "微分できないペイオフの平滑化", coverage: "未対応", riemann: "平滑化の仕組みはない" },
        ],
        additions: ["ペイオフの平滑化（III-5.4）"],
      },
      {
        id: "III-6",
        title: "金利リスクと自動微分",
        source: "part3_enterprise_riemann/ch06_interest_rate_risk_autodiff.qmd",
        operations: [
          "円OISの章の7年OISについて、各クォートに対する感応度（自動微分）を棒グラフで見る。5年の値が「＋1 bp で約151万円」と合うことを確かめる",
          "バケット DV01 と GPS を表示する",
        ],
        rows: [
          { sections: "III-6.1〜6.3", topic: "スワップ評価と DV01 の自動微分", coverage: "一部", riemann: "OIS スワップの気配感応度 compute_ois_swap_quote_sensitivity。ゼロカーブの節点に対するスワップの感応度はない" },
          { sections: "III-6.4", topic: "バケット DV01 と GPS", coverage: "一部", riemann: "債券は compute_curve_node_sensitivity、OIS スワップは気配に対して" },
        ],
        additions: ["ゼロカーブの節点に対するスワップの感応度（バケット DV01・GPS）"],
      },
      {
        id: "III-7",
        title: "PRDC と自動微分",
        source: "part3_enterprise_riemann/ch07_prdc_autodiff.qmd",
        operations: ["多因子 MC の PRDC について、FX・ボラティリティ・カーブ節点の感応度を見る"],
        rows: [{ sections: "III-7.1〜7.5", topic: "多因子 MC、感応度、非線形ペイオフ、集計", coverage: "対応", riemann: "compute_prdc_value（curve_sensitivity）、compute_prdc_three_factor_value" }],
        additions: ["なし（API の入口とグラフの追加だけ）"],
      },
    ],
  },
];
