import type { ReactNode } from "react";
import { href } from "./router";

// The trilogy: the same financial models, computed by hand (Coral Book), run on a server (Carmine Studio) and
// proved from their assumptions (Crimson Proof). The table on the contents page links the three entrances.

export const CORAL_BOOK_REPO = "https://github.com/besuke/coral-book";
export const CRIMSON_PROOF_REPO = "https://github.com/besuke/crimson-proof";
export const CARMINE_STUDIO_REPO = "https://github.com/besuke/carmine-studio";

/** A chapter of Coral Book on GitHub (the Quarto source, which also renders there). */
export const coralChapter = (source: string) => `${CORAL_BOOK_REPO}/blob/main/${source}`;
const crimsonChapter = (file: string) => `${CRIMSON_PROOF_REPO}/blob/main/${file}`;

const Ext = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={to} target="_blank" rel="noreferrer">{children}</a>
);
const Page = ({ route, children }: { route: string; children: ReactNode }) => <a href={href(route)}>{children}</a>;

interface Theme {
  theme: string;
  coral: ReactNode;
  carmine: ReactNode;
  crimson: ReactNode;
}

const P2 = "part2_quantive_riemann";
const THEMES: Theme[] = [
  {
    theme: "割引と無裁定",
    coral: <><Ext to={coralChapter(`${P2}/ch01_deterministic_cashflow.qmd`)}>II-1 確定キャッシュフロー</Ext>、<Ext to={coralChapter(`${P2}/ch03_ois_swaps_multicurve.qmd`)}>II-3 OISスワップ</Ext>で割引と複製を手で計算する</>,
    carmine: <><Page route="/yield-curve-ois">イールドカーブと円OIS</Page>で OIS の気配を動かしてスワップの時価を確かめる。<Page route="/asw">OISアセットスワップ</Page></>,
    crimson: <><Ext to={crimsonChapter("ch10_finite_market.qmd")}>第10章 有限市場の無裁定</Ext>、<Ext to={crimsonChapter("ch11_numeraire.qmd")}>第11章 ニューメレール</Ext>、<Ext to={crimsonChapter("ch12_ftap.qmd")}>第12章 資産価格の基本定理</Ext>で、無裁定に必要な市場の仮定を定義して証明する</>,
  },
  {
    theme: "金利カーブ",
    coral: <Ext to={coralChapter(`${P2}/ch02_interest_rate_curves.qmd`)}>II-2 金利カーブ</Ext>,
    carmine: <><Page route="/yield-curves">金利カーブ</Page>、<Page route="/jgb-futures">国債先物・CTD</Page></>,
    crimson: <Ext to={crimsonChapter("ch11_numeraire.qmd")}>第11章 ニューメレール</Ext>,
  },
  {
    theme: "オプション",
    coral: <Ext to={coralChapter(`${P2}/ch04_black_model.qmd`)}>II-4 ブラックモデル</Ext>,
    carmine: <Page route="/black-model">ブラックモデル</Page>,
    crimson: "—",
  },
  {
    theme: "信用リスク",
    coral: <Ext to={coralChapter(`${P2}/ch05_credit_risk_cds.qmd`)}>II-5 信用リスクとCDS</Ext>,
    carmine: <Page route="/credit-cds">信用リスクとCDS</Page>,
    crimson: "—",
  },
  {
    theme: "PRDC",
    coral: <><Ext to={coralChapter(`${P2}/ch09_exotic_derivatives_prdc.qmd`)}>II-9</Ext>（III-7 の本文はこのアプリへ移した）</>,
    carmine: <><Page route="/prdc">PRDC</Page>、<Page route="/prdc-risk">PRDC のリスク計算</Page></>,
    crimson: <Ext to={crimsonChapter("lean/LagrangeAcademy/PrdcCoupon.lean")}>クーポンの分解（Lean）</Ext>,
  },
  {
    theme: "並列・分散・自動微分",
    coral: <>第III部の本文はこのアプリへ移した（<Ext to={`${CORAL_BOOK_REPO}/tree/main/part3_enterprise_riemann`}>原稿</Ext>は Coral Book に残す）</>,
    carmine: <><Page route="/parallel">並列計算</Page>、<Page route="/prdc-risk">PRDC のリスク計算</Page></>,
    crimson: "—",
  },
  {
    theme: "計算の保証",
    coral: "各章の計算例",
    carmine: <Ext to={`${CARMINE_STUDIO_REPO}/tree/main/reconciliation`}>照合の記録</Ext>,
    crimson: <><Ext to={crimsonChapter("ch01_computation_and_proof.qmd")}>第1章 計算と証明</Ext>、<Ext to={crimsonChapter("ch07_reals_and_floats.qmd")}>第7章 実数と数値計算</Ext></>,
  },
];

export function Trilogy() {
  return (
    <section aria-labelledby="trilogy-h" className="trilogy">
      <h2 id="trilogy-h">三部作の中の Carmine Studio</h2>
      <p>
        金融モデルを「手元で計算する」「サーバーで動かす」「仮定から何が導けるかを証明する」の三つの入口から学ぶ三部作です。
        Carmine Studio はサーバーで動かす入口を受け持ちます。
      </p>
      <div className="table-wrap">
        <table className="data">
          <caption>三つの入口</caption>
          <thead>
            <tr><th scope="col"></th><th scope="col">Coral Book『金融工学の応用基礎』</th><th scope="col">Carmine Studio『エンタープライズ金融モデル』</th><th scope="col">Crimson Proof『Leanから見た金融数学』</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">学び方</th>
              <td className="wrap"><strong>手元で計算する</strong>：理論を読み、手元の R で計算を再現する Quarto の本</td>
              <td className="wrap"><strong>サーバーで動かす</strong>：React で条件を操作し、R サーバー上の RiemannFinMath でモデルを評価する（このアプリ）</td>
              <td className="wrap"><strong>証明する</strong>：金融モデルの仮定を Lean で定義し、どの仮定のもとで何が成り立つかを証明する本</td>
            </tr>
            <tr>
              <th scope="row">リポジトリ</th>
              <td><Ext to={CORAL_BOOK_REPO}>besuke/coral-book</Ext></td>
              <td><Ext to={CARMINE_STUDIO_REPO}>besuke/carmine-studio</Ext></td>
              <td><Ext to={CRIMSON_PROOF_REPO}>besuke/crimson-proof</Ext></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="data">
          <caption>同じテーマを三つの入口で（例：無裁定と割引なら、Coral Book で割引や複製を計算し、ここで OIS の気配を変えてスワップの時価を確かめ、Crimson Proof で無裁定の仮定から定理を証明する）</caption>
          <thead>
            <tr><th scope="col">テーマ</th><th scope="col">Coral Book（手元で計算）</th><th scope="col">Carmine Studio（サーバーで動かす）</th><th scope="col">Crimson Proof（証明する）</th></tr>
          </thead>
          <tbody>
            {THEMES.map((t) => (
              <tr key={t.theme}>
                <th scope="row">{t.theme}</th>
                <td className="wrap">{t.coral}</td>
                <td className="wrap">{t.carmine}</td>
                <td className="wrap">{t.crimson}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
