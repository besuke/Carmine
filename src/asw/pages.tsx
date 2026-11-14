import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { fetchAswDetail, fetchAswList, type AswConditions, type AswDetailResponse, type AswListResponse, type ResponseStamp } from "../api/asw";
import { href } from "../book/router";
import { df, pct } from "../format";
import { FlowChart, type FlowBar } from "../components/FlowChart";
import { LineChart } from "../components/LineChart";

// OIS asset swap offer sheet: the list of offers and the detail of one offer.
// Every number is computed by the R API with RiemannFinMath; the page only lays it out.

function useApi<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    load(c.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({ data: null, error: e instanceof ApiError ? e.message : String(e), loading: false });
      });
    return () => c.abort();
  }, [key, attempt]); // load is rebuilt on each render; key identifies what it loads
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function ApiProblem({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="banner error" role="alert">
      <strong>R APIの応答を受け取れませんでした。</strong> {error}
      <div className="banner-cmd">起動コマンド：<code>npm run api</code></div>
      <button type="button" onClick={retry}>再試行</button>
    </div>
  );
}

const Stamp = ({ r }: { r: ResponseStamp }) => (
  <span className="response-tag" data-request-id={r.request_id}>API応答 <code>{r.request_id}</code></span>
);

const bpText = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)} bp`;
const per100 = (v: number, digits = 6) => v.toFixed(digits);

function ConditionsBlock({ c }: { c: AswConditions }) {
  const rows: [string, ReactNode][] = [
    ["評価日（オファー日・市場日）", c.valuation_date],
    ["ASW の定義", c.asw_definition],
    ["ASW の翌日物レグ", `年${c.asw_overnight_leg.payment_frequency}回払い・支払ラグ${c.asw_overnight_leg.payment_lag}（${c.asw_overnight_leg.note}）`],
    ["OISカーブ", `${c.curve.interpolation === "monotonic_log_cubic" ? "割引係数の単調対数3次補間（MonotonicLogCubic）" : c.curve.interpolation}、OIS 年${c.curve.payment_frequency}回払い・支払ラグ${c.curve.payment_lag}、外挿${c.curve.extrapolation ? "あり" : "なし"}`],
    ["銘柄属性の結合", `ISIN で結合。${c.attribute_policy}`],
    ["データ", c.data_note],
    ["計算エンジン", `${c.engine}（R、HTTP API）`],
  ];
  return (
    <table className="kv">
      <tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

const STATUS_LABEL = { computed: "計算済み", unsupported: "対象外", failed: "計算できない" } as const;

export function AswListPage() {
  const { data, error, loading, retry } = useApi<AswListResponse>((signal) => fetchAswList({ signal }), "list");
  return (
    <article className="prose wide">
      <h1>OISアセットスワップ・オファーシート</h1>
      <p>
        債券のオファー（クリーン価格）から、発行通貨の OIS に対するアセットスワップ・スプレッド（ASW）を計算します。行を選ぶと、使ったカーブ、価格の換算、
        債券とスワップのキャッシュフロー、ASW の計算条件を確かめられます。仕様は LagrangeFinance の <code>docs/asw_offer_sheet_spec.qmd</code>、
        データと規約は Curie の A1 オファーシートのデモ（<strong>架空のデータ</strong>）です。
      </p>
      {error && <ApiProblem error={error} retry={retry} />}
      {loading && !data && <p className="muted">R APIで計算中…</p>}
      {data && (
        <>
          <h2>計算条件</h2>
          <ConditionsBlock c={data.conditions} />
          <h2>オファー一覧</h2>
          <div className="table-wrap">
            <table className="data offers">
              <caption>
                {data.offers.length}件（計算済み {data.offers.filter((o) => o.status === "computed").length}件）。単価は額面100あたりのクリーン価格。　<Stamp r={data.response} />
              </caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">銘柄</th>
                  <th scope="col">通貨</th>
                  <th scope="col">満期</th>
                  <th scope="col" className="num">クーポン</th>
                  <th scope="col">業者</th>
                  <th scope="col" className="num">単価</th>
                  <th scope="col" className="num">数量（額面）</th>
                  <th scope="col">受渡日</th>
                  <th scope="col" className="num">ASW</th>
                </tr>
              </thead>
              <tbody>
                {data.offers.map((o) => [
                  <tr key={o.offer_id} className={o.status === "computed" ? undefined : "not-computed"}>
                    <th scope="row"><a href={href(`/asw/${o.offer_id}`)}>{o.offer_id}</a></th>
                    <td className="wrap"><a href={href(`/asw/${o.offer_id}`)}>{o.security_name}</a><br /><span className="muted">{o.ISIN}</span></td>
                    <td>{o.currency}</td>
                    <td>{o.maturity_date ?? "—"}</td>
                    <td className="num">{o.coupon_rate === null ? "—" : pct(o.coupon_rate, 2)}</td>
                    <td>{o.broker}</td>
                    <td className="num">{o.offer_price.toFixed(2)}</td>
                    <td className="num">{new Intl.NumberFormat("ja-JP").format(o.offer_size)}</td>
                    <td>{o.settlement_date}</td>
                    <td className="num" data-testid={`asw-${o.offer_id}`}>
                      {o.fair_spread_bp === null ? <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span> : bpText(o.fair_spread_bp)}
                    </td>
                  </tr>,
                  o.reason ? (
                    <tr key={`${o.offer_id}-reason`} className="not-computed reason-row">
                      <td colSpan={10}><span className="reason">理由：{o.reason}</span></td>
                    </tr>
                  ) : null,
                ])}
              </tbody>
            </table>
          </div>
          <p className="note">
            ASW は発行通貨の OIS（JPY は TONA、USD は SOFR、EUR は €STR）に対するスプレッドで、正の値は翌日物レグに上乗せして受け取る金利です。
            通貨ベーシスを反映した円換算 ASW はまだ表示していません。数量は額面金額（各通貨の単位）です。
          </p>
        </>
      )}
    </article>
  );
}

export function AswDetailPage({ offerId }: { offerId: string }) {
  const { data, error, loading, retry } = useApi<AswDetailResponse>((signal) => fetchAswDetail(offerId, { signal }), offerId);
  return (
    <article className="prose wide">
      <p><a href={href("/asw")}>← オファー一覧</a></p>
      {error && <ApiProblem error={error} retry={retry} />}
      {loading && !data && <p className="muted">R APIで計算中…</p>}
      {data && <Detail d={data} />}
    </article>
  );
}

function Detail({ d }: { d: AswDetailResponse }) {
  const o = d.offer;
  const a = d.attributes;
  const title = (a?.security_name as string) ?? (o.offer_security_name as string);
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">{o.ISIN}　{o.offer_id}　<Stamp r={d.response} /></p>
      {d.status !== "computed" ? (
        <div className="banner" role="status"><strong>{STATUS_LABEL[d.status]}</strong>　{d.reason}</div>
      ) : (
        <div className="tiles">
          <div className="tile emphasis">
            <div className="tile-label">ASWスプレッド（{d.detail!.curve.index} に対して）</div>
            <div className="tile-value" data-testid="asw-detail">{bpText(d.summary!.fair_spread_bp, 4)}</div>
            <div className="tile-note">丸め前 <code>{d.summary!.fair_spread_bp}</code> bp</div>
          </div>
          <div className="tile">
            <div className="tile-label">ダーティ価格（額面100）</div>
            <div className="tile-value">{d.summary!.dirty_price.toFixed(6)}</div>
            <div className="tile-note">クリーン {Number(o.offer_price).toFixed(2)} ＋ 経過利子 {d.summary!.accrued.toFixed(6)}</div>
          </div>
          <div className="tile">
            <div className="tile-label">スワップの期間</div>
            <div className="tile-value tile-small">{d.summary!.effective_date} 〜 {d.summary!.maturity_date}</div>
            <div className="tile-note">開始日 = 債券の受渡日</div>
          </div>
        </div>
      )}

      <h2>1. オファーと銘柄属性</h2>
      <OfferAndAttributes d={d} />
      <h2>計算条件</h2>
      <ConditionsBlock c={d.conditions} />
      {d.detail && <Computed d={d} />}
    </>
  );
}

function OfferAndAttributes({ d }: { d: AswDetailResponse }) {
  const o = d.offer;
  const a = d.attributes;
  const offerRows: [string, ReactNode][] = [
    ["オファー日", o.offer_date], ["業者", o.broker_names], ["単価（クリーン、額面100）", Number(o.offer_price).toFixed(2)],
    ["数量（額面）", `${new Intl.NumberFormat("ja-JP").format(Number(o.offer_size))}（表示単位：${o.offer_size_unit}）`],
    ["受渡日", o.offer_settlementdate], ["元のファイル", `${o.offer_source_file}（シート ${o.offer_source_sheet}、${o.offer_source_row}行目）`],
  ];
  const attrKeys: [string, string][] = [
    ["currency", "通貨"], ["coupon_type", "利率の種類"], ["coupon_rate", "クーポン"], ["coupon_frequency", "利払回数（年）"],
    ["issue_date", "発行日"], ["maturity_date", "満期日"], ["day_count", "経過利子の日数計算"], ["calendar", "カレンダー"],
    ["settlement_days", "受渡日数"], ["payment_convention", "支払日の調整"], ["first_call_date", "First Call日"],
    ["redemption", "償還額（額面100）"], ["attribute_date", "属性の日付"], ["attribute_source", "属性の出所"],
  ];
  return (
    <div className="two-col">
      <table className="kv"><caption>オファー</caption><tbody>{offerRows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
      <table className="kv">
        <caption>銘柄属性（ISIN とオファー日で結合）</caption>
        <tbody>
          {a ? attrKeys.map(([k, label]) => (
            <tr key={k}><th scope="row">{label}</th><td>{k === "coupon_rate" && typeof a[k] === "number" ? pct(a[k] as number, 3) : String(a[k] ?? "—")}</td></tr>
          )) : <tr><td>属性が見つかりません</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Computed({ d }: { d: AswDetailResponse }) {
  const x = d.detail!;
  const c = x.components;
  const origin = d.conditions.valuation_date;
  const maturityT = x.curve.points.find((p) => p.date >= d.summary!.maturity_date)?.time ?? x.curve.points[x.curve.points.length - 1].time;
  const xMax = Math.ceil(maturityT + 0.25);
  const pts = x.curve.points;
  const pillarDots = x.curve.quotes.flatMap((q) => {
    const p = pts.find((pt) => pt.date === q.pillar_date);
    return p && p.zero_continuous !== null ? [{ x: p.time, y: p.zero_continuous * 100, date: p.date }] : [];
  });
  const markers = [{ x: maturityT, label: "債券満期" }];
  const footer = <Stamp r={d.response} />;
  const [withPrincipal, setWithPrincipal] = useState(false); // the principal and redemption dwarf the coupons
  const yearsOf = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${origin}T00:00:00Z`)) / 86_400_000 / 365;
  const bars: FlowBar[] = [
    ...x.bond_cashflows.filter((f) => withPrincipal || f.kind !== "redemption").map((f) => ({
      date: f.payment_date, x: yearsOf(f.payment_date), value: -f.pv, series: "bond",
      label: f.kind === "redemption" ? "債券の償還（支払）" : "債券のクーポン（支払）",
    })),
    ...x.overnight_cashflows.map((f) => ({ date: f.payment_date, x: yearsOf(f.payment_date), value: f.pv, series: "on", label: "翌日物レグ（受取）" })),
    ...(withPrincipal ? [{ date: x.principal.payment_date, x: yearsOf(x.principal.payment_date), value: x.principal.amount * x.principal.discount, series: "on", label: "元本（受取）" }] : []),
  ];
  const sumRows: [string, string, number][] = [
    ["B", "債券キャッシュフローの現在価値（支払）", c.bond_pv],
    ["L", "翌日物レグの現在価値（スプレッド0、受取）", c.overnight_pv],
    ["R", "満期の元本100の現在価値（受取）", c.principal_pv],
    ["U·D(t,S)", "受渡日の価格調整の現在価値", c.upfront_pv],
    ["A", "スプレッドのアニュイティ（額面100 × 年数 × 割引係数の和）", c.annuity],
  ];
  return (
    <>
      <h2>2. 適用したカーブ</h2>
      <p>
        {x.curve.currency} の {x.curve.index} OIS カーブ。市場日 {x.curve.marketdate}（取得時刻 {x.curve.quote_time}）、受渡日数 {x.curve.settlement_days}、
        OIS 年{x.curve.payment_frequency}回払い・支払ラグ{x.curve.payment_lag}、カーブの時間軸 {x.curve.day_count}、割引係数の単調対数3次補間、外挿なし。
        翌日物レグの予測と、すべてのキャッシュフローの割引に同じカーブを使います。出所：{x.curve.source}
      </p>
      <div className="table-wrap">
        <table className="data">
          <caption>OISクォートと再現（レートは %）</caption>
          <thead><tr><th scope="col">年限</th><th scope="col" className="num">クォート</th><th scope="col">開始日</th><th scope="col">ピラー</th><th scope="col" className="num">再現したレート</th><th scope="col" className="num">再現誤差</th></tr></thead>
          <tbody>
            {x.curve.quotes.map((q) => (
              <tr key={q.tenor}><th scope="row">{q.tenor}</th><td className="num">{pct(q.rate, 2)}</td><td>{q.start_date}</td><td>{q.pillar_date}</td>
                <td className="num">{pct(q.implied_rate, 8)}</td><td className="num">{q.reproduction_error.toExponential(1)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <LineChart title={`${x.curve.index} OIS 割引係数カーブ`} origin={origin} xMax={xMax} yLabel="割引係数"
        series={[{ key: "df", label: "割引係数", color: "var(--series-1)", points: pts.map((p) => ({ x: p.time, y: p.discount, date: p.date })) }]}
        formatY={(y) => df(y, 10)} formatTick={(y) => y.toFixed(3)} markers={markers} footer={footer} />
      <LineChart title={`${x.curve.index} OIS 連続複利ゼロ金利（Actual/365 Fixed、点はピラー）`} origin={origin} xMax={xMax} yLabel="ゼロ金利（%）"
        series={[{ key: "zero", label: "ゼロ金利", color: "var(--series-1)",
          points: pts.flatMap((p) => (p.zero_continuous === null ? [] : [{ x: p.time, y: p.zero_continuous * 100, date: p.date }])), dots: pillarDots }]}
        formatY={(y) => `${y.toFixed(4)}%`} formatTick={(y) => y.toFixed(2)} markers={markers} footer={footer} />

      <h2>3. 価格の入力と換算</h2>
      <table className="kv">
        <tbody>
          <tr><th scope="row">クリーン価格 P（オファー単価）</th><td className="num-cell">{per100(x.price.clean_price, 2)}</td></tr>
          <tr><th scope="row">経過利子 AI（受渡日 {x.price.settlement_date}、{x.price.accrual_day_count}）</th><td className="num-cell">{per100(x.price.accrued, 10)}</td></tr>
          <tr><th scope="row">ダーティ価格 P_d = P + AI</th><td className="num-cell">{per100(x.price.dirty_price, 10)}</td></tr>
          <tr><th scope="row">受渡日の価格調整 U = N (P_d/100 − 1)（N = 100）</th><td className="num-cell">{per100(x.price.upfront, 10)}</td></tr>
          <tr><th scope="row">受渡日の割引係数 D(t,S)</th><td className="num-cell">{df(x.price.upfront_discount, 12)}</td></tr>
          <tr><th scope="row">価格調整の現在価値 U·D(t,S)</th><td className="num-cell">{per100(x.price.upfront_pv, 10)}</td></tr>
        </tbody>
      </table>
      <p className="note">オファーは価格で提示されています（スプレッド提示ではない）ので、価格からスプレッドへの換算だけを行います。他の条件を固定すると、価格が1上がるごとに ASW は {x.checks.price_sensitivity_bp_per_price.toFixed(4)} bp 動きます。</p>

      <h2>4. 債券とスワップのキャッシュフロー</h2>
      <div className="range" role="group" aria-label="表示する金額">
        <button type="button" aria-pressed={!withPrincipal} onClick={() => setWithPrincipal(false)}>利息だけ</button>
        <button type="button" aria-pressed={withPrincipal} onClick={() => setWithPrincipal(true)}>元本・償還を含む</button>
      </div>
      <FlowChart title="支払日ごとの現在価値（額面100あたり。受取は上、支払は下）" origin={origin} xMax={xMax} bars={bars}
        series={[{ key: "on", label: "翌日物レグ・元本（受取）", color: "var(--series-1)" }, { key: "bond", label: "債券のクーポン・償還（支払）", color: "var(--series-2)" }]}
        yLabel="現在価値（額面100）" formatY={(y) => y.toFixed(Math.abs(y) < 5 ? 4 : 2)} footer={footer} />
      <div className="table-wrap">
        <table className="data">
          <caption>債券のキャッシュフロー（受渡日より後、額面100あたり）</caption>
          <thead><tr><th scope="col">支払日</th><th scope="col">種類</th><th scope="col">計算期間</th><th scope="col" className="num">金額</th><th scope="col" className="num">割引係数</th><th scope="col" className="num">現在価値</th></tr></thead>
          <tbody>
            {x.bond_cashflows.map((f) => (
              <tr key={`${f.payment_date}-${f.kind}`}><td>{f.payment_date}</td><td>{f.kind === "redemption" ? "償還" : "クーポン"}</td>
                <td>{f.accrual_start ? `${f.accrual_start} 〜 ${f.accrual_end}` : "—"}</td><td className="num">{per100(f.amount, 6)}</td>
                <td className="num">{df(f.discount)}</td><td className="num">{per100(f.pv, 6)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="data">
          <caption>スワップの翌日物レグ（日次複利、スプレッド0、額面100あたり）とスプレッドの単位額</caption>
          <thead><tr><th scope="col">計算期間</th><th scope="col">支払日</th><th scope="col" className="num">翌日物の額</th><th scope="col" className="num">スプレッド1あたりの額（年数×100）</th><th scope="col" className="num">割引係数</th><th scope="col" className="num">翌日物の現在価値</th></tr></thead>
          <tbody>
            {x.overnight_cashflows.map((f) => (
              <tr key={f.payment_date}><td>{f.accrual_start} 〜 {f.accrual_end}</td><td>{f.payment_date}</td><td className="num">{per100(f.amount, 6)}</td>
                <td className="num">{per100(f.spread_unit, 6)}</td><td className="num">{df(f.discount)}</td><td className="num">{per100(f.pv, 6)}</td></tr>
            ))}
            <tr><td>元本</td><td>{x.principal.payment_date}</td><td className="num">{per100(x.principal.amount, 2)}</td><td className="num">—</td>
              <td className="num">{df(x.principal.discount)}</td><td className="num">{per100(x.principal.amount * x.principal.discount, 6)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>5. ASWスプレッドの計算</h2>
      <p>
        債券のキャッシュフローを支払い、翌日物レグ＋スプレッド s と満期の元本を受け取り、受渡日にダーティ価格と100の差を授受します。NPV がゼロになるスプレッドが ASW です。
      </p>
      <p className="formula">s* = ( B − L − R − U·D(t,S) ) / A</p>
      <div className="table-wrap">
        <table className="data">
          <caption>計算の内訳（額面100あたり）　<Stamp r={d.response} /></caption>
          <thead><tr><th scope="col">記号</th><th scope="col">内容</th><th scope="col" className="num">値</th></tr></thead>
          <tbody>
            {sumRows.map(([sym, label, v]) => <tr key={sym}><th scope="row">{sym}</th><td>{label}</td><td className="num">{per100(v, 10)}</td></tr>)}
            <tr className="changed"><th scope="row">s*</th><td>(B − L − R − U·D) / A × 10⁴</td><td className="num">{bpText(c.fair_spread_bp, 10)}</td></tr>
          </tbody>
        </table>
      </div>
      <table className="kv">
        <caption>確かめ</caption>
        <tbody>
          <tr><th scope="row">キャッシュフローから組み立てた s* と、RiemannFinMath の compute_ois_asset_swap の差</th><td>{x.checks.rebuilt_minus_engine_bp.toExponential(2)} bp</td></tr>
          <tr><th scope="row">s* を戻したときの NPV（額面100）</th><td>{x.checks.npv_at_fair_spread.toExponential(2)}</td></tr>
        </tbody>
      </table>
    </>
  );
}
