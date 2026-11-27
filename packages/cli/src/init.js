// Init copies the base templates into a repo.
// It is non-interactive by default.
// It never overwrites an existing file.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discover } from "./discover.js";
import { hashText } from "./hash.js";
import { AGENTS } from "./agents.js";
import { findTemplatesDir } from "./templates.js";
import { METHODOLOGY_VERSION, TEMPLATE_VERSION } from "./versions.js";
import { MINIMAL_FILES } from "./minimal.js";

// True when any minimal file lives under this dir.
function underFilter(filter, dirRel) {
  if (!filter) {
    return true;
  }
  const prefix = "markflow/" + dirRel + "/";
  for (const file of filter) {
    if (file.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

async function copyDir(src, dest, projectName, base, createdPaths, filter) {
  let created = 0;
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      const dirRel = destPath.slice(base.length + 1);
      if (!underFilter(filter, dirRel)) {
        continue;
      }
      await mkdir(destPath, { recursive: true });
      created += await copyDir(
        srcPath,
        destPath,
        projectName,
        base,
        createdPaths,
        filter
      );
      continue;
    }
    const rel = destPath.slice(base.length + 1);
    if (filter && !filter.has("markflow/" + rel)) {
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
    createdPaths.push(rel);
    created += 1;
  }
  return created;
}

// Fill the ARCHITECTURE.md template with discovery results.
// Throws when the template lines are gone, so a template
// change fails loudly instead of silently skipping the fill.
export function fillArchitecture(text, context) {
  if (
    !text.includes("- Language. TBD") ||
    !text.includes("- Framework. TBD")
  ) {
    throw new Error("ARCHITECTURE.md template changed, fill failed.");
  }
  const names = context.stacks.map((s) => s.name).join(", ");
  const evidence = context.stacks
    .map((s) => s.evidence + " (" + s.confidence + ")")
    .join(", ");
  return text
    .replace("- Language. TBD", "- Language. " + names)
    .replace(
      "- Framework. TBD",
      "- Framework. TBD" +
        "\n- Evidence. " +
        evidence +
        "\n- Monorepo. " +
        (context.monorepo ? "Yes" : "No")
    );
}

export async function runInit(options) {
  const agent = options.agent || "generic";
  if (!(agent in AGENTS)) {
    console.log("Unknown agent.");
    return { agent, copied: 0, ok: false };
  }
  const minimal = options.minimal === true;
  const target = options.target || process.cwd();
  const context = await discover(target);
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = await findTemplatesDir();
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
  const createdPaths = [];
  const created = await copyDir(
    join(templatesDir, "markflow"),
    markflowDest,
    context.projectName,
    markflowDest,
    createdPaths,
    minimal ? new Set(MINIMAL_FILES) : null
  );
  if (context.stacks.length > 0) {
    if (!archExisted) {
      const arch = await readFile(archPath, "utf8");
      await writeFile(archPath, fillArchitecture(arch, context));
    }
    if (!stackExisted && (await exists(stackPath))) {
      const stack = await readFile(stackPath, "utf8");
      const lines = context.stacks.map(
        (s) => "- " + s.name + " from " + s.evidence + ", confidence " + s.confidence
      );
      let filled =
        stack + "\n## Detected stacks\n\nDiscovery found these stacks.\n\n" + lines.join("\n") + "\n";
      if (context.dependencies.length > 0) {
        const depLines = context.dependencies.map(
          (d) => "- " + d.name + " from " + d.evidence + ", detected"
        );
        filled +=
          "\n## Detected dependencies\n\nDiscovery found these dependencies.\n\n" +
          depLines.join("\n") +
          "\n";
      }
      await writeFile(stackPath, filled);
    }
  }
  const agentsSrc = join(templatesDir, "AGENTS.md");
  const agentsDest = join(target, "AGENTS.md");
  const rootFiles = {};
  let agentsText = "";
  try {
    await stat(agentsDest);
    console.log("AGENTS.md already exists.");
    agentsText = await readFile(agentsDest, "utf8");
  } catch {
    const text = await readFile(agentsSrc, "utf8");
    agentsText = text.split("{{project_name}}").join(context.projectName);
    await writeFile(agentsDest, agentsText);
    rootFiles["AGENTS.md"] = hashText(agentsText);
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
    rootFiles[file.path] = hashText(content);
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
      methodology: METHODOLOGY_VERSION,
      template: TEMPLATE_VERSION,
      project: context.projectName,
      agent,
      files: {},
      rootFiles: {},
    };
  }
  if (!marker.rootFiles) {
    marker.rootFiles = {};
  }
  for (const [path, hash] of Object.entries(rootFiles)) {
    if (!(path in marker.rootFiles)) {
      marker.rootFiles[path] = hash;
    }
  }
  marker.agent = marker.agent || agent;
  marker.minimal = minimal;
  marker.discovery = {
    mode: context.mode,
    stacks: context.stacks,
    manifests: context.manifests,
    monorepo: context.monorepo,
    dependencies: context.dependencies,
  };
  // Record hashes only for files this run created.
  // A file the user wrote before init stays untracked,
  // so update never treats it as a template file.
  for (const rel of createdPaths) {
    marker.files[rel] = hashText(
      await readFile(join(markflowDest, rel), "utf8")
    );
  }
  await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n");
  let nextStep;
  if (created > 0) {
    console.log("Created markflow folder.");
    nextStep = "Open your AI tool and say: start onboarding.";
    console.log("Next step. " + nextStep);
  } else {
    console.log("markflow folder already exists.");
  }
  return { ...context, agent, copied: created, nextStep, minimal };
}
