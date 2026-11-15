import { TOC, type Chapter } from "./toc";

// The chapters as the reader sees them: the introduction (no number), then one numbered list, 1 to 11.
// Chapters 1 to 8 are Coral Book's II-1 to II-8. Coral Book's Part III is gathered into three chapters: 9 parallel
// computing (III-1), 10 distributed computing (III-2, III-3) and 11 automatic differentiation (III-1.7, III-4 to
// III-7). The PRDC page (Coral Book II-9) is a page of chapter 11, next to III-7's PRDC with automatic
// differentiation. Coral Book's numbers stay as the sources (ids, the contents page's references, each page's note).

export interface NumberedChapter extends Chapter {
  no: number;
  /** Coral Book's chapters the text comes from, e.g. ["III-4", "III-5"]. */
  sourceIds: string[];
  sources: string[];
}

const all = new Map(TOC.flatMap((p) => p.chapters).map((c) => [c.id, c]));

function merge(no: number, title: string, route: string, ids: string[], routeNote: string, subRoutes?: Chapter["subRoutes"]): NumberedChapter {
  const parts = ids.map((id) => all.get(id)!);
  return {
    no,
    id: ids.length === 1 ? ids[0] : `${ids[0]}〜${ids[ids.length - 1]}`,
    title,
    menu: title,
    route,
    subRoutes,
    routeNote,
    source: parts[0].source,
    sources: parts.map((c) => c.source),
    sourceIds: ids,
    operations: parts.flatMap((c) => c.operations),
    rows: parts.flatMap((c) => c.rows.map((r) => ({ ...r, sections: r.sections }))),
    additions: [...new Set(parts.flatMap((c) => c.additions))],
  };
}

export const CHAPTERS_LIST: NumberedChapter[] = [
  ...TOC[0].chapters.filter((c) => c.id !== "II-9").map((c, i) => ({ ...c, no: i + 1, sourceIds: [c.id], sources: [c.source] })),
  merge(9, "並列計算", "/enterprise/parallel-computing", ["III-1"],
    "Coral Book III-1 の本文に、債券の一括評価の測定と、PRDC のモンテカルロのスレッド比較を組み込んだ章。銘柄やシナリオごとの評価を、R のワーカー（furrr）や Rust のスレッドに分ける"),
  merge(10, "分散計算", "/enterprise/distributed-jobs", ["III-2", "III-3"],
    "Coral Book III-2・III-3 の本文に、シナリオの格子をジョブに分けて R サーバーへ送り、集約する画面を組み込んだ章。複数ノードへの分配とジョブ管理、Slurm への拡張は構想"),
  merge(11, "自動微分", "/enterprise/automatic-differentiation", ["III-4", "III-5", "III-6", "III-7", "II-9"],
    "Coral Book III-4〜III-7 の本文（III-1.7 を導入に）に、PRDC の感応度を自動微分で一度に求めて Bump & Revalue と比べる画面と、パスごとの自動微分のモンテカルロを組み込んだ章。PRDC の評価（Coral Book II-9）はこの章の下のページ",
    [{ route: "/prdc", title: "金利為替系デリバティブ（PRDC）の評価（Coral Book II-9）", menu: "PRDC" }]),
];

/** Old URLs of the gathered pages, and where they lead now: the chapter's route and a section id. */
export const ROUTE_ALIASES: Record<string, { route: string; anchor: string }> = {
  "/parallel": { route: "/enterprise/parallel-computing", anchor: "measure" },
  "/enterprise/enterprise-computing": { route: "/enterprise/distributed-jobs", anchor: "enterprise-computing" },
  "/enterprise/option-greeks": { route: "/enterprise/automatic-differentiation", anchor: "option-greeks" },
  "/enterprise/interest-rate-risk": { route: "/enterprise/automatic-differentiation", anchor: "interest-rate-risk" },
  "/enterprise/prdc": { route: "/enterprise/automatic-differentiation", anchor: "prdc" },
  "/prdc-risk": { route: "/enterprise/automatic-differentiation", anchor: "prdc" },
};
