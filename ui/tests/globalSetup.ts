import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { TestProject } from "vitest/node";

// Starts the R API (server/server.R) on a test port for the regression tests, and stops it afterwards.
// Set LFL_TEST_API_URL to test an API that is already running instead.

declare module "vitest" {
  export interface ProvidedContext {
    apiBaseUrl: string;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // repository root (this file is ui/tests/)
const rscript = process.env.RSCRIPT ?? "C:/Program Files/R/R-4.6.0/bin/Rscript.exe";
const port = Number(process.env.LFL_TEST_PORT ?? 8788);

async function waitForHealth(url: string, child: ChildProcess | null, log: () => string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`R API exited (${child.exitCode}):\n${log()}`);
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`R API did not answer ${url}/api/health within 90 s:\n${log()}`);
}

export default async function setup(project: TestProject) {
  const external = process.env.LFL_TEST_API_URL;
  if (external) {
    await waitForHealth(external, null, () => "");
    project.provide("apiBaseUrl", external);
    return;
  }
  // Refuse to start if something already answers on the test port (it would be tested instead of a fresh server).
  if (await fetch(`http://127.0.0.1:${port}/api/health`).then(() => true, () => false)) {
    throw new Error(`Port ${port} is already in use. Stop that process or set LFL_TEST_PORT.`);
  }
  let output = "";
  const child = spawn(rscript, [path.join(root, "server", "server.R"), "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));
  const url = `http://127.0.0.1:${port}`;
  await waitForHealth(url, child, () => output);
  project.provide("apiBaseUrl", url);
  return () => {
    // Rscript.exe starts R as a child process on Windows; stop the whole tree.
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill();
  };
}
