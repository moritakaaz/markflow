#!/usr/bin/env node
// Entry point for the markflow command.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDoctor } from "./doctor.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const HELP = [
  "Usage",
  "  markflow init [--agent generic|claude|cursor]",
  "  markflow doctor",
  "  markflow update",
  "  markflow --help",
  "  markflow --version",
].join("\n");

function parseAgent(args) {
  const idx = args.indexOf("--agent");
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  const eq = args.find((a) => a.startsWith("--agent="));
  if (eq) {
    return eq.slice("--agent=".length);
  }
  return "generic";
}

async function printVersion() {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(await readFile(join(srcDir, "../package.json"), "utf8"));
  console.log(pkg.version);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(HELP);
  process.exitCode = 1;
} else if (args[0] === "--help" || args[0] === "-h") {
  console.log(HELP);
} else if (args[0] === "--version" || args[0] === "-v") {
  await printVersion();
} else if (args[0] === "doctor") {
  const result = await runDoctor();
  process.exitCode = result.ok ? 0 : 1;
} else if (args[0] === "update") {
  const result = await runUpdate();
  process.exitCode = result.ok ? 0 : 1;
} else if (args[0] === "init") {
  const result = await runInit({ agent: parseAgent(args.slice(1)) });
  process.exitCode = result.ok === false ? 1 : 0;
} else {
  console.log("Unknown command " + args[0] + ".");
  console.log(HELP);
  process.exitCode = 1;
}
