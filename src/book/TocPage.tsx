import { BOOK_TITLE, TOC, type Coverage } from "./toc";
import { href } from "./router";

const COVERAGE_CLASS: Record<Coverage, string> = { 対応: "cov-ok", 一部: "cov-part", 未対応: "cov-none", 対象外: "cov-na" };

export function TocPage() {
  return (
    <article className="prose toc">
      <h1>LagrangeFinLab 目次</h1>
      <p>
        『{BOOK_TITLE}』第II部・第III部の React 版です。章の数式と解説を読みながら、計算例を操作できます。計算はすべて R の HTTP API が
        <strong> RiemannFinMath </strong>
        で行い、ページは返ってきた JSON を表とグラフにします。
      </p>
      <p className="note">
        各章の「操作できること」は、実装済みの章を除いて計画です。「RiemannFinMath」の列は、インストール済みの RiemannFinMath 0.3.0 にある関数で、
        節ごとの判定は Riemann の <code>docs/lagrangefinance_coverage.md</code>（2026-11-07）によります。原稿は LagrangeFinance の Quarto 版（コミット b9ddc2a）です。
      </p>
      <ul className="legend-cov" aria-label="判定の凡例">
        <li><span className="cov cov-ok">対応</span>同じ計算を RiemannFinMath で行える</li>
        <li><span className="cov cov-part">一部</span>計算の中心はあるが、表や条件の一部がない</li>
        <li><span className="cov cov-none">未対応</span>RiemannFinMath にない</li>
        <li><span className="cov cov-na">対象外</span>説明の節、または方針で外したもの</li>
      </ul>
      {TOC.map((part) => (
        <section key={part.id}>
          <h2>{part.title}</h2>
          {part.chapters.map((ch) => (
            <section key={ch.id} className="toc-chapter" id={`toc-${ch.id}`}>
              <h3>
                {ch.id} {ch.title}
                {ch.route ? (
                  <a className="toc-badge done" href={href(ch.route)}>React 版を読む</a>
                ) : (
                  <span className="toc-badge planned">計画</span>
                )}
              </h3>
              {ch.routeNote && <p className="note">{ch.routeNote}</p>}
              <h4>操作できること</h4>
              <ul>
                {ch.operations.map((op) => <li key={op}>{op}</li>)}
              </ul>
              <div className="table-wrap">
                <table className="data">
                  <caption>RiemannFinMath の既存機能で対応できる範囲（原稿：<code>{ch.source}</code>）</caption>
                  <thead>
                    <tr>
                      <th scope="col">節</th>
                      <th scope="col">計算</th>
                      <th scope="col">判定</th>
                      <th scope="col">RiemannFinMath</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ch.rows.map((r) => (
                      <tr key={r.sections}>
                        <th scope="row">{r.sections}</th>
                        <td className="wrap">{r.topic}</td>
                        <td><span className={`cov ${COVERAGE_CLASS[r.coverage]}`}>{r.coverage}</span></td>
                        <td className="wrap">{r.riemann}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4>追加実装が必要な箇所</h4>
              <ul>
                {ch.additions.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </section>
          ))}
        </section>
      ))}
    </article>
  );
}
