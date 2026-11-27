// Init copies the base templates into a repo.
// It is non-interactive by default.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discover } from "./discover.js";

async function copyDir(src, dest, projectName) {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath, projectName);
      continue;
    }
    const text = await readFile(srcPath, "utf8");
    const replaced = text.split("{{project_name}}").join(projectName);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, replaced);
  }
}

export async function runInit(args) {
  const target = process.cwd();
  const context = await discover(target);
  const templatesDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../templates/base"
  );
  const markflowDest = join(target, "markflow");
  try {
    await stat(markflowDest);
    console.log("markflow folder already exists.");
    return { ...context, copied: 0 };
  } catch {
    // Folder does not exist yet, so init can continue.
  }
  await copyDir(join(templatesDir, "markflow"), markflowDest, context.projectName);
  const agentsSrc = join(templatesDir, "AGENTS.md");
  const agentsDest = join(target, "AGENTS.md");
  try {
    await stat(agentsDest);
    console.log("AGENTS.md already exists.");
  } catch {
    const text = await readFile(agentsSrc, "utf8");
    const replaced = text.split("{{project_name}}").join(context.projectName);
    await writeFile(agentsDest, replaced);
    console.log("Created AGENTS.md.");
  }
  console.log("Created markflow folder.");
  return { ...context, copied: 1 };
}
