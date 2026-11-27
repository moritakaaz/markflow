// Doctor checks a repo for missing Markflow files.
// It reports issues and returns ok false when any are found.
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

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

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
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

export async function runDoctor() {
  const root = process.cwd();
  const issues = [];
  for (const file of REQUIRED) {
    try {
      await stat(join(root, file));
      console.log("OK " + file);
    } catch {
      console.log("Missing " + file);
      issues.push(file);
    }
  }
  try {
    const marker = JSON.parse(
      await readFile(join(root, "markflow/.markflow.json"), "utf8")
    );
    if (!marker.cli || !marker.template || !marker.methodology) {
      console.log("Missing version in .markflow.json");
      issues.push("markflow/.markflow.json");
    }
  } catch {
    // Missing marker is already reported above.
  }
  try {
    const files = [];
    await walk(join(root, "markflow"), files);
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (text.includes("{{project_name}}")) {
        const rel = file.slice(root.length + 1);
        console.log("Placeholder left in " + rel);
        issues.push(rel);
      }
    }
  } catch {
    // Missing markflow folder is already reported above.
  }
  if (issues.length === 0) {
    console.log("Doctor found no issues.");
  } else {
    console.log("Doctor found " + issues.length + " issues.");
  }
  return { ok: issues.length === 0, issues };
}
