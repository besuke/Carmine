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
import Parallel from "./content/parallel.mdx";
import PrdcRisk from "./content/prdc-risk.mdx";
// Part III's text, ported from Coral Book (part3_enterprise_riemann/)
import ParallelComputingText from "./content/enterprise/parallel-computing.mdx";
import DistributedJobsText from "./content/enterprise/distributed-jobs.mdx";
import EnterpriseComputingText from "./content/enterprise/enterprise-computing.mdx";
import AutomaticDifferentiationText from "./content/enterprise/automatic-differentiation.mdx";
import OptionGreeksText from "./content/enterprise/option-greeks.mdx";
import InterestRateRiskText from "./content/enterprise/interest-rate-risk.mdx";
import PrdcText from "./content/enterprise/prdc.mdx";
import { CurveProvider } from "./components/curves";
import { TOC } from "./book/toc";
import { TocPage } from "./book/TocPage";
import { href, useRoute } from "./book/router";
import { ScenarioProvider } from "./state/ScenarioContext";
import { AswDetailPage, AswListPage } from "./asw/pages";
import { AswPocPage } from "./asw/poc";
import { ServerConnectionProvider, ServerIndicator, ServerPage } from "./server/connection";

const CHAPTERS: Record<string, () => React.ReactNode> = {
  "/enterprise/parallel-computing": () => (
    <article className="prose ported">
      <ParallelComputingText />
    </article>
  ),
  "/enterprise/distributed-jobs": () => (
    <article className="prose ported">
      <DistributedJobsText />
    </article>
  ),
  "/enterprise/enterprise-computing": () => (
    <article className="prose ported">
      <EnterpriseComputingText />
    </article>
  ),
  "/enterprise/automatic-differentiation": () => (
    <article className="prose ported">
      <AutomaticDifferentiationText />
    </article>
  ),
  "/enterprise/option-greeks": () => (
    <article className="prose ported">
      <OptionGreeksText />
    </article>
  ),
  "/enterprise/interest-rate-risk": () => (
    <article className="prose ported">
      <InterestRateRiskText />
    </article>
  ),
  "/enterprise/prdc": () => (
    <article className="prose ported">
      <PrdcText />
    </article>
  ),
  "/prdc-risk": () => (
    <article className="prose">
      <PrdcRisk />
    </article>
  ),
  "/parallel": () => (
    <article className="prose">
      <Parallel />
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
      <a href={href("/")} className={route === "/" ? "active" : undefined}>目次と対応状況</a>
      <a href={href("/server")} className={route === "/server" ? "active" : undefined}>計算サーバーとの接続</a>
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
          {chapter ? chapter() : route === "/" ? <TocPage /> : route === "/server" ? <ServerPage /> : route === "/asw" ? <AswListPage /> : route === "/asw/poc" ? <AswPocPage /> : aswId ? <AswDetailPage offerId={aswId} /> : (
            <p>ページが見つかりません。<a href={href("/")}>目次へ</a></p>
          )}
        </main>
      </div>
    </ServerConnectionProvider>
  );
}
