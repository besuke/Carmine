import YieldCurveOis from "./content/part2/yield-curve-ois.mdx";
import YieldCurves from "./content/part2/yield-curves.mdx";
import JgbFutures from "./content/part2/jgb-futures.mdx";
import CreditCds from "./content/part2/credit-cds.mdx";
import BlackModel from "./content/part2/black-model.mdx";
import DeterministicCashflow from "./content/part2/deterministic-cashflow.mdx";
import IrsCalibration from "./content/part2/irs-calibration.mdx";
import RateModels from "./content/part2/rate-models.mdx";
import EarlyRedemption from "./content/part2/early-redemption.mdx";
import Prdc from "./content/part2/prdc.mdx";
import { CurveProvider } from "./components/curves";
import { TOC } from "./book/toc";
import { TocPage } from "./book/TocPage";
import { href, useRoute } from "./book/router";
import { ScenarioProvider } from "./state/ScenarioContext";
import { AswDetailPage, AswListPage } from "./asw/pages";
import { AswPocPage } from "./asw/poc";

const CHAPTERS: Record<string, () => React.ReactNode> = {
  "/part2/prdc": () => (
    <article className="prose">
      <Prdc />
    </article>
  ),
  "/part2/early-redemption": () => (
    <article className="prose">
      <EarlyRedemption />
    </article>
  ),
  "/part2/rate-models": () => (
    <article className="prose">
      <RateModels />
    </article>
  ),
  "/part2/irs-calibration": () => (
    <article className="prose">
      <IrsCalibration />
    </article>
  ),
  "/part2/deterministic-cashflow": () => (
    <article className="prose">
      <DeterministicCashflow />
    </article>
  ),
  "/part2/black-model": () => (
    <article className="prose">
      <BlackModel />
    </article>
  ),
  "/part2/credit-cds": () => (
    <article className="prose">
      <CreditCds />
    </article>
  ),
  "/part2/jgb-futures": () => (
    <article className="prose">
      <JgbFutures />
    </article>
  ),
  "/part2/yield-curves": () => (
    <CurveProvider>
      <article className="prose">
        <YieldCurves />
      </article>
    </CurveProvider>
  ),
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
          <a href={href("/asw/poc")} className={route === "/asw/poc" ? "active" : undefined}>A1 オファーシート作成 POC</a>
        </li>
        <li>
          <a href={href("/asw")} className={route.startsWith("/asw") && route !== "/asw/poc" ? "active" : undefined}>OISアセットスワップ・オファーシート</a>
        </li>
      </ul>
      {TOC.map((part) => (
        <div key={part.id}>
          <div className="sidebar-part">{part.title}</div>
          <ul>
            {part.chapters.map((ch) => (
              <li key={ch.id}>
                {ch.route ? (
                  <>
                    <a href={href(ch.route)} className={route === ch.route ? "active" : undefined}>
                      {ch.id} {ch.title}
                    </a>
                    {ch.subRoutes?.map((sr) => (
                      <a key={sr.route} href={href(sr.route)} className={route === sr.route ? "sub active" : "sub"}>{sr.title}</a>
                    ))}
                  </>
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
          {chapter ? chapter() : route === "/" ? <TocPage /> : route === "/asw" ? <AswListPage /> : route === "/asw/poc" ? <AswPocPage /> : aswId ? <AswDetailPage offerId={aswId} /> : (
            <p>ページが見つかりません。<a href={href("/")}>目次へ</a></p>
          )}
        </main>
      </div>
    </>
  );
}
