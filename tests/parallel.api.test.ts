import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, inject, it } from "vitest";
import { fetchParallel } from "../src/api/parallel";

// The parallel computing chapter's API: the manuscript's example (tests/golden/parallel_golden.json, written by
// tests/reconciliation/parallel/reconcile_parallel.R from the manuscript's purrr and furrr code), and the batch of bonds,
// whose results must not depend on the number of threads. Times are not tested.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const golden = JSON.parse(readFileSync(path.join(root, "tests", "golden", "parallel_golden.json"), "utf8")) as {
  present_value: number[]; one_by_one: { row: number; clean_price: number; duration_modified: number }[];
};
const baseUrl = inject("apiBaseUrl");

describe("Parallel computing chapter (III-1)", () => {
  it("reproduces the manuscript's six present values", async () => {
    const d = await fetchParallel({ batch: { count: 1000, maxThreads: 2 } }, { baseUrl });
    expect(d.example.map((r) => r.present_value)).toEqual(golden.present_value);
  });

  it("gives the same results on every number of threads, and the bond prices of one bond at a time", async () => {
    const d = await fetchParallel({ batch: { count: 2000, maxThreads: 8 } }, { baseUrl });
    expect(d.batch.timing.map((r) => r.threads)).toEqual([1, 2, 4, 8]);
    for (const r of d.batch.timing) {
      expect(r.max_abs_diff_from_one_thread).toBe(0);
      expect(r.errors).toBe(0);
      expect(r.seconds).toBeGreaterThanOrEqual(0);
    }
    // the first and the last bond of the batch: yields 0.1% and 3%
    expect(d.batch.sample[0].clean_price).toBeCloseTo(golden.one_by_one[0].clean_price, 11);
    expect(d.batch.sample[d.batch.sample.length - 1].clean_price).toBeCloseTo(golden.one_by_one[golden.one_by_one.length - 1].clean_price, 11);
  });

  it("rejects counts and threads out of range", async () => {
    await expect(fetchParallel({ batch: { count: 1e6 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
    await expect(fetchParallel({ batch: { maxThreads: 0 } }, { baseUrl })).rejects.toMatchObject({ status: 400 });
  });
});
