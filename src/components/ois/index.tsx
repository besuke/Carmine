import { useMemo, useState, type ReactNode } from "react";
import type { CaseResult, CurvePoint, ScenarioResponse } from "../../api/types";
import { bp, df, full, pct, tenorJa, yen } from "../../format";
import { BUMP_BP, BUMP_TENOR, hasScenario, useScenario } from "../../state/ScenarioContext";
import { LineChart, type Series, type SeriesPoint } from "../LineChart";

// Components of the chapter "II-2・II-3 イールドカーブと円OIS". They only display the R API's response.
// Figures follow the Quarto chapter's ggplot2 figures: date on the x-axis, rates in percent, the discount
// factor as a plain number, a legend when more than one series is drawn.

const BASE_COLOR = "var(--series-1)";
const SCENARIO_COLOR = "var(--series-2)";
const BASE_LABEL = "初期";
const SCENARIO_LABEL = `変更後（${tenorJa(BUMP_TENOR)} ${BUMP_BP > 0 ? "+" : ""}${BUMP_BP} bp）`;

function Need({ children }: { children: (data: ScenarioResponse) => ReactNode }) {
  const { data, error } = useScenario();
  if (data) return <>{children(data)}</>;
  if (error) return <p className="muted">（R APIの応答がないため表示できません）</p>;
  return <p className="muted">計算中…</p>;
}

const pointAt = (points: CurvePoint[], date: string) => points.find((p) => p.date === date);

/** The response the figure or table was drawn from; the same tag appears on every part that changes. */
export function ResponseTag({ data }: { data: ScenarioResponse }) {
  const bump = data.request.bumpBp;
  return (
    <span className="response-tag" data-request-id={data.response.request_id}>
      API応答 <code>{data.response.request_id}</code>（{bump === 0 ? "初期のみ" : `${tenorJa(data.request.bumpTenor)} ${bump > 0 ? "+" : ""}${bump} bp`}）
    </span>
  );
}

export function ApiStatus() {
  const { error, loading, retry, data } = useScenario();
  if (error) {
    return (
      <div className="banner error" role="alert">
        <strong>R APIに接続できませんでした。</strong> {error}
        <div className="banner-cmd">起動コマンド：<code>npm run api</code>（画面は <code>npm run dev</code>）</div>
        <button type="button" onClick={retry}>再試行</button>
      </div>
    );
  }
  return (
    <p className="status" aria-live="polite">
      {loading ? "R APIで計算中…" : data ? `計算エンジン：${data.engine.name} ${data.engine.version}（R、ローカルHTTP API）` : ""}
    </p>
  );
}

export function ConditionsTable() {
  return (
    <Need>
      {(d) => {
        const c = d.conventions;
        const rows: [string, string][] = [
          ["評価日（カーブの参照日）", d.evaluation_date],
          ["指標・カレンダー", "TONA・日本の営業日（QuantLib 互換）"],
          ["カーブの時間軸", "Actual/365 Fixed"],
          ["OISの受渡日数", `${c.settlement_days}営業日（スポット日 ${d.swap_terms.effective_date}）`],
          ["支払頻度・支払ラグ", `年${c.payment_frequency}回・${c.payment_lag}営業日（QuantLib の既定。市場慣行とされる2営業日とは異なる）`],
          ["日程", "後ろ向き（Backward）、修正後続（Modified Following）"],
          ["固定レグの日数計算", "Actual/365 Fixed"],
          ["ピラー", "各OISの最終関連日（満期日）"],
          ["補間", "割引係数の対数線形（log D を時間について線形補間）"],
          ["ブートストラップの精度", `割引係数で ${c.accuracy}`],
          ["計算エンジン", `${d.engine.name} ${d.engine.version}（R、HTTP API）`],
        ];
        return (
          <table className="kv">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        );
      }}
    </Need>
  );
}

export function QuoteTable() {
  const { data } = useScenario();
  return (
    <Need>
      {(d) => {
        const show = hasScenario(data);
        return (
          <div className="table-wrap">
            <table className="data">
              <caption>
                円TONA OISクォートと再現（評価日 {d.evaluation_date}、レートは %、<strong>サンプルデータ</strong>）
              </caption>
              <thead>
                <tr>
                  <th scope="col">年限</th>
                  <th scope="col" className="num">クォート</th>
                  {show && <th scope="col" className="num">変更後</th>}
                  <th scope="col">開始日</th>
                  <th scope="col">満期日（ピラー）</th>
                  <th scope="col" className="num">カーブが再現したレート</th>
                  <th scope="col" className="num">再現誤差</th>
                </tr>
              </thead>
              <tbody>
                {d.quotes.map((q, i) => {
                  const inst = d.cases.base.instruments[i];
                  const changed = q.rate_scenario !== q.rate_base;
                  return (
                    <tr key={q.quote_id} className={show && changed ? "changed" : undefined}>
                      <th scope="row">{tenorJa(q.tenor)}</th>
                      <td className="num">{pct(q.rate_base, 2)}</td>
                      {show && <td className="num">{pct(q.rate_scenario, 2)}{changed ? " ◀" : ""}</td>}
                      <td>{inst.start_date}</td>
                      <td>{inst.pillar_date}</td>
                      <td className="num">{pct(inst.implied_rate, 8)}</td>
                      <td className="num">{inst.reproduction_error.toExponential(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note">
              出典：GaussQuant の <code>bluegamma_tonar_quotes_GQL()</code>（14本）から7年を除いた13本。教材用のサンプルで、取引に使う市場データではありません。
              「再現誤差」は |カーブが再現したレート − クォート|（小数の金利）で、初期カーブのものです。
            </p>
          </div>
        );
      }}
    </Need>
  );
}

function RangeToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="range" role="group" aria-label="表示する期間">
      {[10, 30].map((y) => (
        <button key={y} type="button" aria-pressed={value === y} onClick={() => onChange(y)}>
          {y}年先まで
        </button>
      ))}
    </div>
  );
}

const toPoints = (pts: CurvePoint[], pick: (p: CurvePoint) => number | null): SeriesPoint[] =>
  pts.flatMap((p) => {
    const y = pick(p);
    return y === null ? [] : [{ x: p.time, y, date: p.date }];
  });

function pillarMarkers(d: ScenarioResponse) {
  const want = ["4Y", "5Y", "8Y"];
  const m = d.cases.base.instruments
    .filter((i) => want.includes(i.tenor))
    .map((i) => ({ x: d.cases.base.nodes.find((n) => n.date === i.pillar_date)!.time, label: `${tenorJa(i.tenor)}ピラー` }));
  m.push({ x: pointAt(d.cases.base.curve_points, d.swap_terms.termination_date)!.time, label: "7年OIS満期" });
  return m;
}

const pickDf = (p: CurvePoint) => p.discount;
const pickZeroPct = (p: CurvePoint) => (p.zero_continuous === null ? null : p.zero_continuous * 100);
const pickFwdPct = (p: CurvePoint) => p.forward_1d_simple * 100;

/** II-2.2.3 「カーブの表現」に対応する3つの図。初期カーブだけを描く。 */
export function BaseCurveCharts() {
  const [range, setRange] = useState(30);
  return (
    <Need>
      {(d) => {
        const b = d.cases.base;
        const one = (key: string, pick: (p: CurvePoint) => number | null, dots?: SeriesPoint[]): Series[] => [
          { key, label: BASE_LABEL, color: BASE_COLOR, points: toPoints(b.curve_points, pick), dots },
        ];
        const nodeDots = b.nodes.flatMap((n) => (n.zero_continuous === null ? [] : [{ x: n.time, y: n.zero_continuous * 100, date: n.date }]));
        return (
          <>
            <RangeToggle value={range} onChange={setRange} />
            <LineChart title="割引係数カーブ" series={one("df", pickDf)} origin={d.evaluation_date} xMax={range}
              yLabel="割引係数" formatY={(y) => df(y, 10)} formatTick={(y) => y.toFixed(2)} />
            <LineChart title="連続複利ゼロ金利カーブ（点はピラー）" series={one("zero", pickZeroPct, nodeDots)} origin={d.evaluation_date}
              xMax={range} yLabel="ゼロ金利（%）" formatY={(y) => `${y.toFixed(4)}%`} formatTick={(y) => y.toFixed(1)} />
            <LineChart title="フォワード金利カーブ（1暦日の単利）" series={one("fwd", pickFwdPct)} origin={d.evaluation_date}
              xMax={range} yLabel="フォワード金利（%）" formatY={(y) => `${y.toFixed(4)}%`} formatTick={(y) => y.toFixed(1)} />
          </>
        );
      }}
    </Need>
  );
}

export function ScenarioControls() {
  const { bumpBp, setBumpBp, loading, data } = useScenario();
  const active = bumpBp !== 0;
  return (
    <div className="controls" role="group" aria-label="クォートの操作">
      <button type="button" className="primary" onClick={() => setBumpBp(BUMP_BP)} disabled={loading || active}>
        {tenorJa(BUMP_TENOR)}クォート＋{BUMP_BP} bp
      </button>
      <button type="button" onClick={() => setBumpBp(0)} disabled={loading || !active}>
        リセット
      </button>
      <span className="controls-state" aria-live="polite">
        {loading ? "R APIで再計算中…" : data ? <ResponseTag data={data} /> : null}
      </span>
    </div>
  );
}

function overlay(d: ScenarioResponse, pick: (p: CurvePoint) => number | null): Series[] {
  const s: Series[] = [{ key: "base", label: BASE_LABEL, color: BASE_COLOR, points: toPoints(d.cases.base.curve_points, pick) }];
  if (hasScenario(d)) {
    s.push({ key: "scenario", label: SCENARIO_LABEL, color: SCENARIO_COLOR, points: toPoints(d.cases.scenario.curve_points, pick), dashed: true });
  }
  return s;
}

/** Display transform only: the difference of the two curves in the same response. */
function difference(d: ScenarioResponse, pick: (p: CurvePoint) => number, scale: number): Series[] {
  const b = d.cases.base.curve_points;
  return [{
    key: "diff", label: "変更後 − 初期", color: SCENARIO_COLOR,
    points: d.cases.scenario.curve_points.map((p, i) => ({ x: p.time, y: (pick(p) - pick(b[i])) * scale, date: p.date })),
  }];
}

/** 初期と変更後の割引係数・フォワードを重ねた図と、その差。 */
export function ScenarioCharts() {
  const [range, setRange] = useState(10);
  const { data } = useScenario();
  const series = useMemo(() => (data ? { df: overlay(data, pickDf), fwd: overlay(data, pickFwdPct) } : null), [data]);
  return (
    <Need>
      {(d) => {
        const show = hasScenario(d);
        const footer = <ResponseTag data={d} />;
        const markers = pillarMarkers(d);
        return (
          <>
            <RangeToggle value={range} onChange={setRange} />
            <LineChart title="割引係数カーブ：初期と変更後" series={series!.df} origin={d.evaluation_date} xMax={range}
              yLabel="割引係数" formatY={(y) => df(y, 10)} formatTick={(y) => y.toFixed(2)} markers={markers} footer={footer} />
            {show && (
              <LineChart title="割引係数の差（変更後 − 初期、×10⁻⁴）" series={difference(d, pickDf, 1e4)} origin={d.evaluation_date}
                xMax={range} yLabel="割引係数の差（×10⁻⁴）" height={190} formatY={(y) => y.toFixed(4)} formatTick={(y) => y.toFixed(1)}
                markers={markers} zeroLine footer={footer} />
            )}
            <LineChart title="フォワード金利カーブ：初期と変更後（1暦日の単利）" series={series!.fwd} origin={d.evaluation_date} xMax={range}
              yLabel="フォワード金利（%）" formatY={(y) => `${y.toFixed(4)}%`} formatTick={(y) => y.toFixed(1)} markers={markers} footer={footer} />
            {show && (
              <LineChart title="フォワード金利の差（変更後 − 初期）" series={difference(d, pickFwdPct, 100)} origin={d.evaluation_date}
                xMax={range} yLabel="フォワード金利の差（bp）" height={190} formatY={(y) => `${y.toFixed(3)} bp`} formatTick={(y) => y.toFixed(0)}
                markers={markers} zeroLine footer={footer} />
            )}
          </>
        );
      }}
    </Need>
  );
}

export function SegmentTable() {
  return (
    <Need>
      {(d) => {
        const show = hasScenario(d);
        const b = d.cases.base.segments;
        const s = d.cases.scenario.segments;
        return (
          <div className="table-wrap">
            <table className="data">
              <caption>ピラー間のフォワード金利（連続複利、Actual/365 Fixed、区間内で一定）　<ResponseTag data={d} /></caption>
              <thead>
                <tr>
                  <th scope="col">区間</th>
                  <th scope="col" className="num">初期</th>
                  {show && <th scope="col" className="num">変更後</th>}
                  {show && <th scope="col" className="num">差</th>}
                </tr>
              </thead>
              <tbody>
                {b.map((seg, i) => {
                  const diff = (s[i].forward_continuous - seg.forward_continuous) * 1e4;
                  return (
                    <tr key={seg.start_date} className={show && Math.abs(diff) > 1e-6 ? "changed" : undefined}>
                      <th scope="row">{seg.start_date} 〜 {seg.end_date}</th>
                      <td className="num">{pct(seg.forward_continuous)}</td>
                      {show && <td className="num">{pct(s[i].forward_continuous)}</td>}
                      {show && <td className="num">{bp(diff, 3)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }}
    </Need>
  );
}

export function SevenYearMechanism() {
  return (
    <Need>
      {(d) => {
        const show = hasScenario(d);
        const pillar = (tenor: string) => d.cases.base.instruments.find((i) => i.tenor === tenor)!.pillar_date;
        const rows: [string, string][] = [
          ["4年のピラー", pillar("4Y")],
          ["5年のピラー", pillar("5Y")],
          ["7年OISの満期（ピラーではない）", d.swap_terms.termination_date],
          ["8年のピラー", pillar("8Y")],
        ];
        return (
          <div className="table-wrap">
            <table className="data">
              <caption>7年の割引係数を決める節点　<ResponseTag data={d} /></caption>
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col" className="num">初期</th>
                  {show && <th scope="col" className="num">変更後</th>}
                  {show && <th scope="col" className="num">差（×10⁻⁴）</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, date]) => {
                  const pb = pointAt(d.cases.base.curve_points, date)!;
                  const ps = pointAt(d.cases.scenario.curve_points, date)!;
                  return (
                    <tr key={label}>
                      <th scope="row">{label}<br /><span className="muted">{date}</span></th>
                      <td className="num">{df(pb.discount)}</td>
                      {show && <td className="num">{df(ps.discount)}</td>}
                      {show && <td className="num">{((ps.discount - pb.discount) * 1e4).toFixed(4)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }}
    </Need>
  );
}

export function SwapPanel() {
  return (
    <Need>
      {(d) => {
        const show = hasScenario(d);
        const t = d.swap_terms;
        const b = d.cases.base.swap;
        const s = d.cases.scenario.swap;
        const legs = [["TONAレグ（受け）", "overnight_leg_npv"], ["固定レグ（払い）", "fixed_leg_npv"], ["合計（PV）", "npv"]] as const;
        return (
          <div className="swap">
            <table className="kv">
              <tbody>
                <tr><th scope="row">取引</th><td>固定払い・TONA受けの7年OIS（{t.effective_date} 開始、{t.termination_date} 満期）</td></tr>
                <tr><th scope="row">想定元本</th><td>{yen(t.notional)}（100億円）</td></tr>
                <tr><th scope="row">固定レート</th><td>{pct(t.fixed_rate, 6)}（丸め前 <code>{full(t.fixed_rate)}</code>。初期カーブの7年パーレート。変更後も据え置き）</td></tr>
              </tbody>
            </table>
            <div className="tiles">
              <div className="tile">
                <div className="tile-label">初期PV</div>
                <div className="tile-value" data-testid="pv-base">{yen(b.npv)}</div>
                <div className="tile-note">丸め前のパーレートを使うので、数値誤差の範囲でゼロ</div>
              </div>
              <div className="tile">
                <div className="tile-label">変更後PV</div>
                <div className="tile-value" data-testid="pv-scenario">{show ? yen(s.npv) : "—"}</div>
                <div className="tile-note">{show ? `7年パーレート ${pct(s.par_rate, 6)}` : "「5年クォート＋1 bp」で計算"}</div>
              </div>
              <div className="tile emphasis">
                <div className="tile-label">PV差（変更後 − 初期）</div>
                <div className="tile-value" data-testid="pv-change">{show ? yen(d.pv_change, true) : "—"}</div>
                <div className="tile-note">
                  {show ? <>丸め前 <code data-testid="pv-change-full">{d.pv_change.toFixed(4)}</code> 円、7年パーレートの変化 {bp(d.par_change_bp)}</> : ""}
                </div>
              </div>
            </div>
            <p className="note"><ResponseTag data={d} /></p>
            <div className="table-wrap">
              <table className="data">
                <caption>レグ別の現在価値（円。固定レグは支払なので負）</caption>
                <thead>
                  <tr>
                    <th scope="col">レグ</th>
                    <th scope="col" className="num">初期</th>
                    {show && <th scope="col" className="num">変更後</th>}
                    {show && <th scope="col" className="num">差</th>}
                  </tr>
                </thead>
                <tbody>
                  {legs.map(([label, k]) => (
                    <tr key={k}>
                      <th scope="row">{label}</th>
                      <td className="num">{yen(b[k])}</td>
                      {show && <td className="num">{yen(s[k])}</td>}
                      {show && <td className="num">{yen(s[k] - b[k], true)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Need>
  );
}

function legFlows(c: CaseResult, leg: "fixed" | "overnight") {
  return c.swap.cashflows.filter((f) => f.leg === leg);
}

export function CashflowTable() {
  return (
    <Need>
      {(d) => {
        const show = hasScenario(d);
        const fixedB = legFlows(d.cases.base, "fixed");
        const onB = legFlows(d.cases.base, "overnight");
        const fixedS = legFlows(d.cases.scenario, "fixed");
        const onS = legFlows(d.cases.scenario, "overnight");
        return (
          <div className="table-wrap">
            <table className="data">
              <caption>7年OISの支払日程と割引係数（金額は円、符号なし）　<ResponseTag data={d} /></caption>
              <thead>
                <tr>
                  <th scope="col">計算期間</th>
                  <th scope="col">支払日</th>
                  <th scope="col" className="num">固定額</th>
                  <th scope="col" className="num">TONA額（初期）</th>
                  {show && <th scope="col" className="num">TONA額（変更後）</th>}
                  <th scope="col" className="num">割引係数（初期）</th>
                  {show && <th scope="col" className="num">割引係数（変更後）</th>}
                </tr>
              </thead>
              <tbody>
                {fixedB.map((f, i) => (
                  <tr key={f.payment_date}>
                    <td>{f.accrual_start} 〜 {f.accrual_end}</td>
                    <td>{f.payment_date}</td>
                    <td className="num">{yen(f.amount)}</td>
                    <td className="num">{yen(onB[i].amount)}</td>
                    {show && <td className="num">{yen(onS[i].amount)}</td>}
                    <td className="num">{df(f.discount)}</td>
                    {show && <td className="num">{df(fixedS[i].discount)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </Need>
  );
}
