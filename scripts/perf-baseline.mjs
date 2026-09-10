import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at !== -1 && args[at + 1] ? args[at + 1] : fallback;
};
const command = flag("--command", "npm run build");
const out = flag("--out", "perf-baseline.json");
const sourceRoots = ["app", "lib", "tests"];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function countSourceLines() {
  let lines = 0;
  for (const root of sourceRoots)
    for (const file of walk(join(fileURLToPath(new URL("..", import.meta.url)), root)))
      if (/\.(ts|tsx|mjs|js)$/.test(file)) lines += readFileSync(file, "utf8").split("\n").length;
  return lines;
}

function dirBytes(dir) {
  return walk(dir).reduce((sum, file) => sum + statSync(file).size, 0);
}

function peakRssKb(file) {
  if (!existsSync(file)) return 0;
  const values = readFileSync(file, "utf8").split("\n").filter(Boolean).map(Number);
  return Math.max(0, ...values);
}

const rssFile = join(tmpdir(), `perf-rss-${process.pid}.txt`);
const preload = join(tmpdir(), `perf-rss-preload-${process.pid}.cjs`);
rmSync(rssFile, { force: true });
writeFileSync(
  preload,
  "const fs = require('node:fs');\nprocess.on('exit', () => {\n  try {\n    fs.appendFileSync(process.env.PERF_RSS_FILE, String(process.resourceUsage().maxRSS) + '\\n');\n  } catch {}\n});\n",
);

const started = Date.now();
await new Promise((resolve) => {
  const child = spawn(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      PERF_RSS_FILE: rssFile,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${preload.replaceAll("\\", "/")}`]
        .filter(Boolean)
        .join(" "),
    },
  });
  child.on("exit", (code) => {
    if (code) process.exitCode = code;
    resolve();
  });
});

const report = {
  generatedAt: new Date().toISOString(),
  command,
  buildMs: Date.now() - started,
  staticClientBytes: dirBytes(join(root, ".next", "static")),
  serverOutputBytes: dirBytes(join(root, ".next", "server")),
  sourceLines: countSourceLines(),
  peakRssKb: peakRssKb(rssFile),
};
writeFileSync(join(root, out), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
rmSync(preload, { force: true });
rmSync(rssFile, { force: true });
