// Init copies the base templates into a repo.
// It is non-interactive by default.
// It never overwrites an existing file.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discover } from "./discover.js";
import { hashText } from "./hash.js";

const AGENTS = {
  generic: null,
  claude: "CLAUDE.md",
  cursor: ".cursorrules",
};

async function copyDir(src, dest, projectName) {
  let created = 0;
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      created += await copyDir(srcPath, destPath, projectName);
      continue;
    }
    try {
      await stat(destPath);
      continue;
    } catch {
      // File does not exist yet, so init can create it.
    }
    const text = await readFile(srcPath, "utf8");
    const replaced = text.split("{{project_name}}").join(projectName);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, replaced);
    created += 1;
  }
  return created;
}

export async function runInit(options) {
  const agent = options.agent || "generic";
  if (!(agent in AGENTS)) {
    console.log("Unknown agent.");
    return { agent, copied: 0 };
  }
  const target = process.cwd();
  const context = await discover(target);
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(srcDir, "../../../templates/base");
  const markflowDest = join(target, "markflow");
  await mkdir(markflowDest, { recursive: true });
  const created = await copyDir(
    join(templatesDir, "markflow"),
    markflowDest,
    context.projectName
  );
  const agentsSrc = join(templatesDir, "AGENTS.md");
  const agentsDest = join(target, "AGENTS.md");
  let agentsText = "";
  try {
    await stat(agentsDest);
    console.log("AGENTS.md already exists.");
    agentsText = await readFile(agentsDest, "utf8");
  } catch {
    const text = await readFile(agentsSrc, "utf8");
    agentsText = text.split("{{project_name}}").join(context.projectName);
    await writeFile(agentsDest, agentsText);
    console.log("Created AGENTS.md.");
  }
  const agentFile = AGENTS[agent];
  if (agentFile) {
    const agentDest = join(target, agentFile);
    try {
      await stat(agentDest);
      console.log(agentFile + " already exists.");
    } catch {
      await writeFile(agentDest, agentsText);
      console.log("Created " + agentFile + ".");
    }
  }
  const pkg = JSON.parse(
    await readFile(join(srcDir, "../package.json"), "utf8")
  );
  const markerPath = join(markflowDest, ".markflow.json");
  let marker = null;
  try {
    marker = JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    marker = {
      cli: pkg.version,
      methodology: pkg.version,
      template: pkg.version,
      project: context.projectName,
      files: {},
    };
  }
  async function collectHashes(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectHashes(full);
        continue;
      }
      if (entry.name === ".markflow.json") {
        continue;
      }
      const rel = full.slice(markflowDest.length + 1);
      if (!(rel in marker.files)) {
        marker.files[rel] = hashText(await readFile(full, "utf8"));
      }
    }
  }
  await collectHashes(markflowDest);
  await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n");
  if (created > 0) {
    console.log("Created markflow folder.");
  } else {
    console.log("markflow folder already exists.");
  }
  return { ...context, agent, copied: created };
}
