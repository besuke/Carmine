import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { fetchJgbCurves, type JgbCurvesResponse } from "../../api/jgbCurves";
import { LineChart, type SeriesPoint } from "../LineChart";

// The month-end JGB yield curves with a YYYYMM slider and play/pause. The curves are built by RiemannFinMath on the R
// server; the page fetches every month once, then only switches between them. The axes stay fixed (the whole period's
// range), so that the curve's change from month to month can be compared.

const PLAY_MS = 120;
const TICKS = [1, 2, 5, 10, 20, 30, 40];
const ym = (m: string) => `${m.slice(0, 4)}年${m.slice(4)}月`;

export function JgbCurveExplorer() {
  const [data, setData] = useState<JgbCurvesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const c = new AbortController();
    fetchJgbCurves({ signal: c.signal })
      .then((d) => {
        setData(d);
        setIndex(d.months.length - 1);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => c.abort();
  }, []);

  // play: one month per tick from the current month; stop at the last month
  useEffect(() => {
    if (!playing || !data) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= data.months.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_MS);
    return () => window.clearInterval(timer.current);
  }, [playing, data]);

  const month = data?.months[index];
  const series = useMemo(() => {
    if (!data || !month) return [];
    const curve: SeriesPoint[] = month.curve_yield_pct.map((y, k) => {
      const t = data.curve_step * (k + 1);
      return { x: t, y, date: `${t}年` };
    });
    const nodes: SeriesPoint[] = month.node_tenor.map((t, k) => ({ x: t, y: month.node_yield_pct[k], date: `${t}年` }));
    return [
      { key: "curve", label: "カーブ（RiemannFinMath）", color: "var(--series-1)", points: curve },
      { key: "nodes", label: "観測した複利利回り", color: "var(--series-2)", points: [], dots: nodes },
    ];
  }, [data, month]);

  if (error) return <div className="banner error" role="alert"><strong>R APIの応答を受け取れませんでした。</strong> {error}<div className="banner-cmd">起動コマンド：<code>npm run api</code></div></div>;
  if (!data || !month) return <p className="muted">R APIで月別のカーブを計算中…</p>;

  const togglePlay = () => {
    if (!playing && index >= data.months.length - 1) setIndex(0);
    setPlaying((p) => !p);
  };
  return (
    <div className="jgb-explorer">
      <LineChart
        title={`日本国債の利回りカーブ（${ym(month.month)}末、観測日 ${month.date}）`}
        origin="2026-01-01" xMin={0} xMax={data.axis.x_max} xTicks={TICKS.map((x) => ({ x, label: `${x}` }))} xLabel="残存年数"
        yLabel="複利利回り（%）" yRange={[data.axis.y_min, data.axis.y_max]} zeroLine series={series}
        formatY={(y) => `${y.toFixed(3)}%`} formatTick={(y) => y.toFixed(1)}
        footer={<span className="response-tag" data-request-id={data.response.request_id}>API応答 <code>{data.response.request_id}</code></span>}
      />
      <div className="controls month-player" role="group" aria-label="表示する年月">
        <button type="button" className="primary" onClick={togglePlay} aria-pressed={playing} data-testid="jgb-play">
          {playing ? "一時停止" : "再生"}
        </button>
        <input type="range" min={0} max={data.months.length - 1} step={1} value={index} aria-label="年月"
          aria-valuetext={ym(month.month)} data-testid="jgb-slider"
          onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} />
        <output className="month-label" data-testid="jgb-month" aria-live={playing ? "off" : "polite"}>{month.month}</output>
      </div>
      <p className="note">
        {ym(data.months[0].month)}〜{ym(data.months[data.months.length - 1].month)}の {data.months.length} か月。軸の範囲は全期間で固定している。
        出典：{data.conventions.source}。カーブ：{data.conventions.curve}（{data.conventions.engine}）。
      </p>
    </div>
  );
}
