// Find the templates folder.
// In the repo it lives at templates/base.
// In the published package it lives at packages/cli/templates.
import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function findTemplatesDir() {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const packaged = resolve(srcDir, "../templates");
  try {
    await access(join(packaged, "AGENTS.md"));
    return packaged;
  } catch {
    return resolve(srcDir, "../../../templates/base");
  }
}
