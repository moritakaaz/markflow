#!/usr/bin/env node
// Entry point for the markflow command.
import { runInit } from "./init.js";

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

runInit({ agent: parseAgent(process.argv.slice(2)) });
