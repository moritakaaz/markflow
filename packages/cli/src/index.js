#!/usr/bin/env node
// Entry point for the markflow command.
import { runDoctor } from "./doctor.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

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

const args = process.argv.slice(2);
if (args[0] === "doctor") {
  const result = await runDoctor();
  process.exitCode = result.ok ? 0 : 1;
} else if (args[0] === "update") {
  const result = await runUpdate();
  process.exitCode = result.ok ? 0 : 1;
} else {
  const rest = args[0] === "init" ? args.slice(1) : args;
  await runInit({ agent: parseAgent(rest) });
}
