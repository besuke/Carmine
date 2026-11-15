import YieldCurveOis from "./content/yield-curve-ois.mdx";
import YieldCurves from "./content/yield-curves.mdx";
import JgbFutures from "./content/jgb-futures.mdx";
import CreditCds from "./content/credit-cds.mdx";
import BlackModel from "./content/black-model.mdx";
import DeterministicCashflow from "./content/deterministic-cashflow.mdx";
import IrsCalibration from "./content/irs-calibration.mdx";
import RateModels from "./content/rate-models.mdx";
import EarlyRedemption from "./content/early-redemption.mdx";
import Prdc from "./content/prdc.mdx";
import Introduction from "./content/introduction.mdx";
// Coral Book's Part III, gathered into chapters 9 to 11 (scripts/port/merge_part3.py)
import ParallelComputing from "./content/chapters/parallel-computing.mdx";
import DistributedComputing from "./content/chapters/distributed-computing.mdx";
import AutomaticDifferentiation from "./content/chapters/automatic-differentiation.mdx";
import { CurveProvider } from "./components/curves";
import { CHAPTERS_LIST, ROUTE_ALIASES } from "./book/chapters";
import { ChapterNo } from "./book/ChapterNo";
import { useEffect } from "react";
import { TocPage } from "./book/TocPage";
import { href, useRoute } from "./book/router";
import { ScenarioProvider } from "./state/ScenarioContext";
import { AswDetailPage, AswListPage } from "./asw/pages";
import { AswPocPage } from "./asw/poc";
import { ServerConnectionProvider, ServerIndicator, ServerPage } from "./server/connection";

const CHAPTERS: Record<string, () => React.ReactNode> = {
  "/enterprise/parallel-computing": () => (
    <article className="prose ported">
      <ParallelComputing />
    </article>
  ),
  "/enterprise/distributed-jobs": () => (
    <article className="prose ported">
      <DistributedComputing />
    </article>
  ),
  "/enterprise/automatic-differentiation": () => (
    <article className="prose ported">
      <AutomaticDifferentiation />
    </article>
  ),
  "/introduction": () => (
    <article className="prose">
      <Introduction />
    </article>
  ),
  "/prdc": () => (
    <article className="prose">
      <Prdc />
    </article>
  ),
  "/early-redemption": () => (
    <article className="prose">
      <EarlyRedemption />
    </article>
  ),
  "/rate-models": () => (
    <article className="prose">
      <RateModels />
    </article>
  ),
  "/irs-calibration": () => (
    <article className="prose">
      <IrsCalibration />
    </article>
  ),
  "/deterministic-cashflow": () => (
    <article className="prose">
      <DeterministicCashflow />
    </article>
  ),
  "/black-model": () => (
    <article className="prose">
      <BlackModel />
    </article>
  ),
  "/credit-cds": () => (
    <article className="prose">
      <CreditCds />
    </article>
  ),
  "/jgb-futures": () => (
    <article className="prose">
      <JgbFutures />
    </article>
  ),
  "/yield-curves": () => (
    <CurveProvider>
      <article className="prose">
        <YieldCurves />
      </article>
    </CurveProvider>
  ),
  "/yield-curve-ois": () => (
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
      <a href={href("/")} className={route === "/" ? "active" : undefined} title="目次と対応状況">目次</a>
      <a href={href("/server")} className={route === "/server" ? "active" : undefined} title="計算サーバーとの接続">サーバー接続</a>
      <div className="sidebar-part">章</div>
      <ul className="chapter-list">
        <li>
          <a href={href("/introduction")} className={route === "/introduction" ? "active" : undefined}><span className="chapter-no">{"   "}</span>序論</a>
        </li>
        {CHAPTERS_LIST.map((ch) => (
          <li key={ch.id}>
            <a href={href(ch.route!)} className={route === ch.route ? "active" : undefined} title={`${ch.title}（Coral Book ${ch.sourceIds.join("・")}）`}>
              <ChapterNo n={ch.no} />{ch.menu ?? ch.title}
            </a>
            {ch.subRoutes?.map((sr) => (
              <a key={sr.route} href={href(sr.route)} className={route === sr.route ? "sub active" : "sub"} title={sr.title}>{sr.menu ?? sr.title}</a>
            ))}
          </li>
        ))}
      </ul>
      <div className="sidebar-part">応用サンプル</div>
      <ul>
        <li>
          <a href={href("/asw/poc")} className={route === "/asw/poc" ? "active" : undefined} title="A1 オファーシート作成 POC">オファーシートPOC</a>
        </li>
        <li>
          <a href={href("/asw")} className={route.startsWith("/asw") && route !== "/asw/poc" ? "active" : undefined} title="OISアセットスワップ・オファーシート">ASWオファーシート</a>
        </li>
      </ul>
    </nav>
  );
}

/** Scrolls to a section once the page is drawn (old URLs of pages gathered into a chapter). */
function ScrollTo({ anchor }: { anchor: string }) {
  useEffect(() => {
    const t = window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView(), 50);
    return () => window.clearTimeout(t);
  }, [anchor]);
  return null;
}

export function App() {
  const raw = useRoute();
  const alias = ROUTE_ALIASES[raw];
  const route = alias ? alias.route : raw;
  const chapter = CHAPTERS[route];
  const aswId = /^\/asw\/([A-Za-z0-9_-]+)$/.exec(route)?.[1];
  return (
    <ServerConnectionProvider>
      <header className="site-header">
        <div className="brand-block">
          <a className="brand" href={href("/")}>Carmine Studio</a>
          <span className="brand-title">エンタープライズ金融モデル</span>
        </div>
        <ServerIndicator />
      </header>
      <div className="layout">
        <Sidebar route={route} />
        <main className="page">
          {alias && <ScrollTo anchor={alias.anchor} />}
          {chapter ? chapter() : route === "/" ? <TocPage /> : route === "/server" ? <ServerPage /> : route === "/asw" ? <AswListPage /> : route === "/asw/poc" ? <AswPocPage /> : aswId ? <AswDetailPage offerId={aswId} /> : (
            <p>ページが見つかりません。<a href={href("/")}>目次へ</a></p>
          )}
        </main>
      </div>
    </ServerConnectionProvider>
  );
}
