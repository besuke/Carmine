// Runs an R script with Rscript, without going through cmd.exe quoting (the default R path contains a space).
//   node scripts/run-r.mjs <script.R> [args...]
// Set RSCRIPT to use another Rscript.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const rscript = process.env.RSCRIPT ?? "C:/Program Files/R/R-4.6.0/bin/Rscript.exe";
if (!existsSync(rscript)) {
  console.error(`Rscript not found: ${rscript}\nSet the RSCRIPT environment variable to its path.`);
  process.exit(1);
}
const child = spawn(rscript, process.argv.slice(2), { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
