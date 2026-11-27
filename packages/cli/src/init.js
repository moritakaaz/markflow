// Init copies the base templates into a repo.
// It is non-interactive by default.
// It never overwrites an existing file.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discover } from "./discover.js";
import { hashText } from "./hash.js";
import { AGENTS } from "./agents.js";

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
    return { agent, copied: 0, ok: false };
  }
  const target = process.cwd();
  const context = await discover(target);
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(srcDir, "../../../templates/base");
  const markflowDest = join(target, "markflow");
  await mkdir(markflowDest, { recursive: true });
  async function exists(path) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
  const archPath = join(markflowDest, "docs/ARCHITECTURE.md");
  const stackPath = join(markflowDest, "docs/STACK.md");
  const archExisted = await exists(archPath);
  const stackExisted = await exists(stackPath);
  const created = await copyDir(
    join(templatesDir, "markflow"),
    markflowDest,
    context.projectName
  );
  if (context.stacks.length > 0) {
    const names = context.stacks.map((s) => s.name).join(", ");
    const evidence = context.stacks
      .map((s) => s.evidence + " (" + s.confidence + ")")
      .join(", ");
    if (!archExisted) {
      const arch = await readFile(archPath, "utf8");
      const filled = arch
        .replace("- Language. TBD", "- Language. " + names)
        .replace(
          "- Framework. TBD",
          "- Framework. TBD\n- Evidence. " +
            evidence +
            "\n- Monorepo. " +
            (context.monorepo ? "Yes" : "No")
        );
      await writeFile(archPath, filled);
    }
    if (!stackExisted) {
      const stack = await readFile(stackPath, "utf8");
      const lines = context.stacks.map(
        (s) => "- " + s.name + " from " + s.evidence + ", confidence " + s.confidence
      );
      const filled =
        stack + "\n## Detected stacks\n\nDiscovery found these stacks.\n\n" + lines.join("\n") + "\n";
      await writeFile(stackPath, filled);
    }
  }
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
  for (const file of AGENTS[agent]) {
    const agentDest = join(target, file.path);
    try {
      await stat(agentDest);
      console.log(file.path + " already exists.");
      continue;
    } catch {
      // File does not exist yet, so init can create it.
    }
    const content = file.frontmatter
      ? file.frontmatter + "\n" + agentsText
      : agentsText;
    await mkdir(dirname(agentDest), { recursive: true });
    await writeFile(agentDest, content);
    console.log("Created " + file.path + ".");
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
  marker.discovery = {
    mode: context.mode,
    stacks: context.stacks,
    manifests: context.manifests,
    monorepo: context.monorepo,
  };
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
