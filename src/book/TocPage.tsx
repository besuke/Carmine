import { BOOK_TITLE, type Coverage } from "./toc";
import { CHAPTERS_LIST } from "./chapters";
import { ChapterNo } from "./ChapterNo";
import { href } from "./router";
import { Trilogy, coralChapter } from "./Trilogy";

const COVERAGE_CLASS: Record<Coverage, string> = { 対応: "cov-ok", 一部: "cov-part", 未対応: "cov-none", 対象外: "cov-na" };

export function TocPage() {
  return (
    <article className="prose toc">
      <h1>Carmine Studio『エンタープライズ金融モデル』</h1>
      <p>
        Coral Book『{BOOK_TITLE}』の無裁定モデルとエンタープライズ化（並列・分散・自動微分）の計算を、React で条件を操作しながら評価する Web アプリです。章の数式と解説を読みながら、計算例を操作できます。計算はすべて R の HTTP API が
        <strong> RiemannFinMath </strong>
        で行い、ページは返ってきた JSON を表とグラフにします。
      </p>
      <p className="note">
        各章の「操作できること」は、実装済みの章を除いて計画です。「RiemannFinMath」の列は、インストール済みの RiemannFinMath 0.3.0 にある関数で、
        節ごとの判定は Riemann の <code>docs/lagrangefinance_coverage.md</code>（2026-11-07）によります。原稿は Coral Book（旧 LagrangeFinance）の Quarto 版（コミット b9ddc2a）です。
      </p>
      <p>設計の考え方（画面・API・計算エンジンの役割分担、Rust、並列・分散計算、非同期の画面）は<a href={href("/introduction")}>序論</a>にまとめています。</p>
      <Trilogy />
      <h2>目次と対応状況</h2>
      <ul className="legend-cov" aria-label="判定の凡例">
        <li><span className="cov cov-ok">対応</span>同じ計算を RiemannFinMath で行える</li>
        <li><span className="cov cov-part">一部</span>計算の中心はあるが、表や条件の一部がない</li>
        <li><span className="cov cov-none">未対応</span>RiemannFinMath にない</li>
        <li><span className="cov cov-na">対象外</span>説明の節、または方針で外したもの</li>
      </ul>
      <section className="toc-chapter" id="toc-introduction">
        <h3>
          <span className="chapter-no">{"   "}</span>序論
          <a className="toc-badge done" href={href("/introduction")}>読む</a>
        </h3>
        <p className="note">Coral Book で手元の R を使って再現した金融モデルを、複数の利用者がブラウザから使える形にする設計の考え方：画面・API・計算エンジンの役割分担、Rust を使う理由、R による並列計算と Slurm への拡張、非同期の画面と金融業務の GUI。</p>
      </section>
      {CHAPTERS_LIST.map((ch) => (
            <section key={ch.id} className="toc-chapter" id={`toc-${ch.id}`}>
              <h3>
                <ChapterNo n={ch.no} />{ch.menu ?? ch.title}
                <span className="toc-ref">Coral Book {ch.sourceIds.join("・")}</span>
                {ch.route ? (
                  <a className="toc-badge done" href={href(ch.route)}>React 版を読む</a>
                ) : (
                  <span className="toc-badge planned">計画</span>
                )}
              </h3>
              {ch.routeNote && <p className="note">{ch.routeNote}</p>}
              {ch.subRoutes?.map((sr) => <p key={sr.route} className="note"><a href={href(sr.route)}>{sr.title} を読む</a></p>)}
              <h4>操作できること</h4>
              <ul>
                {ch.operations.map((op) => <li key={op}>{op}</li>)}
              </ul>
              <div className="table-wrap">
                <table className="data">
                  <caption>RiemannFinMath の既存機能で対応できる範囲（原稿：{ch.sources.map((s, i) => <span key={s}>{i > 0 && "、"}<a href={coralChapter(s)} target="_blank" rel="noreferrer"><code>{s}</code></a></span>)}）</caption>
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
    </article>
  );
}
