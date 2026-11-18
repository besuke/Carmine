import { describe, expect, inject, it } from "vitest";
import { fetchServerInfo } from "../src/api/server";

// The connection page: GET /api/server describes the calculation server and times one rmql call.

const baseUrl = inject("apiBaseUrl");

describe("the connection to the calculation server", () => {
  it("describes the server, its routes and one timed rmql call", async () => {
    const a = await fetchServerInfo({ baseUrl });
    expect(a.info.status).toBe("ok");
    expect(a.info.engine.name).toBe("rmql");
    expect(a.info.engine.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(a.info.listen.port).toBe(Number(new URL(baseUrl).port));
    expect(a.info.probe.seconds_each).toBeGreaterThan(0);
    // mean of sin(1..60) / 50, the first column of the probe's returns
    const mean = Array.from({ length: 60 }, (_, k) => Math.sin(k + 1) / 50).reduce((s, x) => s + x, 0) / 60;
    expect(Math.abs(a.info.probe.check_value - mean)).toBeLessThan(1e-15);
    const paths = a.info.routes.map((r) => `${r.method} ${r.path}`);
    for (const p of ["GET /api/health", "GET /api/server", "POST /api/prdc", "POST /api/prdc-risk/job", "GET /api/asw/offers"]) expect(paths).toContain(p);
    expect(a.roundTripMs).toBeGreaterThan(0);
    const b = await fetchServerInfo({ baseUrl });
    expect(b.info.requests_served).toBeGreaterThan(a.info.requests_served);
    expect(b.info.started_at).toBe(a.info.started_at);
  });

  it("answers only GET", async () => {
    const res = await fetch(`${baseUrl}/api/server`, { method: "POST", body: "{}" });
    expect(res.status).toBe(405);
  });
});
