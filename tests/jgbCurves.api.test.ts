import { describe, expect, inject, it } from "vitest";
import { fetchJgbCurves } from "../src/api/jgbCurves";

// The yield-curve slider: every month-end JGB curve, built by RiemannFinMath on the server.

const baseUrl = inject("apiBaseUrl");

describe("month-end JGB yield curves", () => {
  it("covers every month from 1990, and each curve goes through its observed yields", async () => {
    const d = await fetchJgbCurves({ baseUrl });
    expect(d.months[0].month).toBe("199001");
    expect(d.months.length).toBeGreaterThan(400);
    const months = d.months.map((m) => m.month);
    expect([...months].sort()).toEqual(months);
    for (const m of d.months) {
      m.node_tenor.forEach((t, k) => {
        const j = Math.round(t / d.curve_step) - 1;
        if (Math.abs((j + 1) * d.curve_step - t) < 1e-12) expect(Math.abs(m.curve_yield_pct[j] - m.node_yield_pct[k])).toBeLessThan(1e-4);
      });
      for (const y of m.curve_yield_pct) {
        expect(y).toBeGreaterThanOrEqual(d.axis.y_min);
        expect(y).toBeLessThanOrEqual(d.axis.y_max);
      }
    }
    expect(d.ust).toBeDefined();
    expect(d.ust!.months.length).toBe(d.months.length);
    expect(d.ust!.months[0].month).toBe("199001");
    expect(d.ust!.conventions.source_url).toContain("fred.stlouisfed.org");
  });
});
