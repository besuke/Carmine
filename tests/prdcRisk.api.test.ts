import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, inject, it } from "vitest";
import { fetchPrdcRisk, runPrdcJob } from "../src/api/prdcRisk";

// Part III's page: the PRDC of III-7 against an independent closed form in R and its central differences
// (tests/golden/prdc_risk_golden.json, written by reconciliation/prdc_risk/reconcile_prdc_risk.R), against bump and
// revalue, on several threads and in jobs.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "prdc_risk_golden.json"), "utf8")) as {
  npv_closed: number; per_year_jpy: number[]; per_year_foreign: number[];
  torch: { npv: number; fx_delta: number; fx_vega: number };
};
const baseUrl = inject("apiBaseUrl");
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

describe("Part III: PRDC risk by automatic differentiation, in parallel and distributed", () => {
  it("values the note, and every sensitivity by automatic differentiation agrees with bump and revalue", async () => {
    const d = await fetchPrdcRisk({}, { baseUrl });
    expect(Math.abs(d.ad.npv - golden.npv_closed)).toBeLessThan(1e-6);
    expect(d.ad.table).toHaveLength(12);
    for (const r of d.ad.table) expect(rel(r.automatic_differentiation, r.bump_and_revalue)).toBeLessThan(1e-5);
    d.ad.per_year.forEach((r, i) => {
      expect(rel(r.jpy_rate_per_bp, golden.per_year_jpy[i])).toBeLessThan(1e-5);
      expect(rel(r.foreign_rate_per_bp, golden.per_year_foreign[i])).toBeLessThan(1e-5);
    });
    expect(d.ad.evaluations).toEqual({ automatic_differentiation: 1, bump_and_revalue: 24 });
    // the manuscript's torch Monte Carlo lies within a few standard errors of the closed form
    expect(Math.abs(golden.torch.npv - d.ad.npv)).toBeLessThan(5 * d.mc.standard_error);
  });

  it("gives the same Monte Carlo on every number of threads", async () => {
    const d = await fetchPrdcRisk({ threads: { paths: 100000 } }, { baseUrl });
    expect(d.threads.table.map((r) => r.threads)).toEqual([1, 2, 4, 8]);
    for (const r of d.threads.table) expect(r.difference_from_one_thread).toBe(0);
  });

  it("values a job of scenarios as the single valuation does, and rejects bad input", async () => {
    const d = await fetchPrdcRisk({}, { baseUrl });
    const job = await runPrdcJob([{ id: 7, spot: 150, volPct: 12 }, { id: 8, spot: 165, volPct: 14 }], { baseUrl });
    expect(job.results.map((r) => r.id)).toEqual([7, 8]);
    expect(job.results[0].npv).toBe(d.ad.npv);
    expect(job.results[1].npv).toBeGreaterThan(job.results[0].npv);
    await expect(runPrdcJob([{ id: 1, spot: 10, volPct: 12 }], { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchPrdcRisk({ market: { volPct: 0 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
