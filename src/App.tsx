import YieldCurveOis from "./content/part2/yield-curve-ois.mdx";
import { TOC } from "./book/toc";
import { TocPage } from "./book/TocPage";
import { href, useRoute } from "./book/router";
import { ScenarioProvider } from "./state/ScenarioContext";
import { AswDetailPage, AswListPage } from "./asw/pages";

const CHAPTERS: Record<string, () => React.ReactNode> = {
  "/part2/yield-curve-ois": () => (
    <ScenarioProvider>
      <article className="prose">
        <YieldCurveOis />
      </article>
    </ScenarioProvider>
  ),
};

function Sidebar({ route }: { route: string }) {
  return (
    <nav className="sidebar" aria-label="章の一覧">
      <a href={href("/")} className={route === "/" ? "active" : undefined}>目次と対応状況</a>
      <div className="sidebar-part">応用サンプル</div>
      <ul>
        <li>
          <a href={href("/asw")} className={route.startsWith("/asw") ? "active" : undefined}>OISアセットスワップ・オファーシート</a>
        </li>
      </ul>
      {TOC.map((part) => (
        <div key={part.id}>
          <div className="sidebar-part">{part.title}</div>
          <ul>
            {part.chapters.map((ch) => (
              <li key={ch.id}>
                {ch.route ? (
                  <a href={href(ch.route)} className={route === ch.route ? "active" : undefined}>
                    {ch.id} {ch.title}
                  </a>
                ) : (
                  <a href={href("/")} className="planned"
                    onClick={() => setTimeout(() => document.getElementById(`toc-${ch.id}`)?.scrollIntoView(), 0)}>
                    {ch.id} {ch.title}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function App() {
  const route = useRoute();
  const chapter = CHAPTERS[route];
  const aswId = /^\/asw\/([A-Za-z0-9_-]+)$/.exec(route)?.[1];
  return (
    <>
      <header className="site-header">
        <a className="brand" href={href("/")}>LagrangeFinLab</a>
        <span className="muted">LagrangeFinance 第II部・第III部を、ブラウザで動かす</span>
      </header>
      <div className="layout">
        <Sidebar route={route} />
        <main className="page">
          {chapter ? chapter() : route === "/" ? <TocPage /> : route === "/asw" ? <AswListPage /> : aswId ? <AswDetailPage offerId={aswId} /> : (
            <p>ページが見つかりません。<a href={href("/")}>目次へ</a></p>
          )}
        </main>
      </div>
    </>
  );
}
