// Doctor checks a repo for missing Markflow files.
// It reports errors, warnings, and info.
// Errors fail the check. Warnings and info do not.
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const REQUIRED = [
  "AGENTS.md",
  "markflow/README.md",
  "markflow/TASKS.md",
  "markflow/CHANGELOG.md",
  "markflow/docs/PRD.md",
  "markflow/docs/ARCHITECTURE.md",
  "markflow/docs/CODING_STANDARDS.md",
  "markflow/docs/STACK.md",
  "markflow/docs/TESTING.md",
  "markflow/specs/index.md",
  "markflow/.markflow.json",
];

const AGENT_FILES = ["CLAUDE.md", ".cursorrules"];

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
      continue;
    }
    if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
}

function findLinks(text) {
  const links = [];
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    links.push(match[1]);
  }
  return links;
}

export async function runDoctor() {
  const root = process.cwd();
  const errors = [];
  const warnings = [];
  for (const file of REQUIRED) {
    try {
      await stat(join(root, file));
      console.log("OK " + file);
    } catch {
      console.log("Error Missing " + file);
      errors.push(file);
    }
  }
  let marker = null;
  try {
    marker = JSON.parse(
      await readFile(join(root, "markflow/.markflow.json"), "utf8")
    );
    if (!marker.cli || !marker.template || !marker.methodology) {
      console.log("Error Missing version in .markflow.json");
      errors.push("markflow/.markflow.json");
    }
  } catch {
    // Missing marker is already reported above.
  }
  if (marker && marker.files) {
    for (const rel of Object.keys(marker.files)) {
      try {
        await stat(join(root, "markflow", rel));
      } catch {
        console.log("Warning Tracked file missing " + rel);
        warnings.push(rel);
      }
    }
  }
  const mdFiles = [];
  await walk(join(root, "markflow"), mdFiles);
  mdFiles.push(join(root, "AGENTS.md"));
  for (const file of AGENT_FILES) {
    mdFiles.push(join(root, file));
  }
  let tbd = 0;
  for (const file of mdFiles) {
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const rel = file.slice(root.length + 1);
    if (text.includes("{{project_name}}")) {
      console.log("Error Placeholder left in " + rel);
      errors.push(rel);
    }
    tbd += text.split("TBD").length - 1;
    for (const link of findLinks(text)) {
      if (
        link.startsWith("http") ||
        link.startsWith("#") ||
        link.startsWith("mailto:")
      ) {
        continue;
      }
      const target = link.split("#")[0];
      if (!target) {
        continue;
      }
      const dest = resolve(dirname(file), target);
      try {
        await stat(dest);
      } catch {
        console.log("Error Broken link in " + rel + " to " + target);
        errors.push(rel);
      }
    }
  }
  let specTotal = 0;
  let specDraft = 0;
  try {
    const specFiles = [];
    await walk(join(root, "markflow/specs"), specFiles);
    const indexText = await readFile(
      join(root, "markflow/specs/index.md"),
      "utf8"
    );
    for (const file of specFiles) {
      const name = file.split("/").pop();
      if (name === "index.md" || name === "_template.md") {
        continue;
      }
      specTotal += 1;
      const text = await readFile(file, "utf8");
      if (text.includes("Status") && text.includes("Draft")) {
        specDraft += 1;
      }
      if (!indexText.includes(name)) {
        const rel = file.slice(root.length + 1);
        console.log("Warning Spec not listed in index " + rel);
        warnings.push(rel);
      }
    }
  } catch {
    // Missing specs folder is already reported above.
  }
  console.log("Info " + tbd + " TBD left in docs.");
  console.log("Info " + specTotal + " specs, " + specDraft + " draft.");
  if (errors.length === 0 && warnings.length === 0) {
    console.log("Doctor found no issues.");
  } else {
    console.log(
      "Doctor found " + errors.length + " errors, " + warnings.length + " warnings."
    );
  }
  return { ok: errors.length === 0, errors, warnings, issues: errors };
}
