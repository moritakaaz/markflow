// Discovery reads manifest files in a repo.
// It checks many manifests, not only package.json.
// It reports every stack it finds, with its evidence.
// It scans nested members and reads workspace evidence.
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const MANIFESTS = {
  "package.json": "JavaScript",
  "composer.json": "PHP",
  "go.mod": "Go",
  "Cargo.toml": "Rust",
  "pyproject.toml": "Python",
  "requirements.txt": "Python",
  "pom.xml": "Java",
  "build.gradle": "Java",
  "build.gradle.kts": "Kotlin",
  "pubspec.yaml": "Dart",
  "Gemfile": "Ruby",
};

const WORKSPACE_FILES = ["pnpm-workspace.yaml", "lerna.json"];

const CONFIG_PATTERNS = [
  "vitest.config.js",
  "vitest.config.ts",
  "jest.config.js",
  "jest.config.ts",
  "pytest.ini",
  "phpunit.xml",
  ".gitlab-ci.yml",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "markflow",
  ".markflow",
  "vendor",
]);

function stackFromEntry(name) {
  if (name in MANIFESTS) {
    return MANIFESTS[name];
  }
  if (name.endsWith(".csproj") || name.endsWith(".sln")) {
    return "C#";
  }
  return null;
}

export async function discover(root) {
  const projectName = basename(root);
  const stacks = [];
  const manifests = [];
  const configs = [];
  const workspaceEvidence = [];
  const memberDirs = new Set();
  const seen = new Set();
  function addStack(name, evidence, confidence) {
    manifests.push(evidence);
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    stacks.push({ name, evidence, confidence });
  }
  async function scanDir(dir, rel, confidence, depth) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = rel ? rel + "/" + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        if (
          depth === 0 &&
          (entry.name === "packages" || entry.name === "apps")
        ) {
          continue;
        }
        if (depth < 3) {
          await scanDir(join(dir, entry.name), childRel, confidence, depth + 1);
        }
        continue;
      }
      const name = stackFromEntry(entry.name);
      if (name) {
        addStack(name, childRel, confidence);
        if (rel) {
          memberDirs.add(rel.split("/").slice(0, 2).join("/"));
        }
      }
    }
  }
  await scanDir(root, "", "high", 0);
  let rootEntries = [];
  try {
    rootEntries = await readdir(root, { withFileTypes: true });
  } catch {
    rootEntries = [];
  }
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name !== "packages" && entry.name !== "apps") {
      continue;
    }
    let members = [];
    try {
      members = await readdir(join(root, entry.name), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const member of members) {
      if (!member.isDirectory() || SKIP_DIRS.has(member.name)) {
        continue;
      }
      await scanDir(
        join(root, entry.name, member.name),
        entry.name + "/" + member.name,
        "medium",
        0
      );
    }
  }
  for (const file of WORKSPACE_FILES) {
    try {
      await readFile(join(root, file), "utf8");
      workspaceEvidence.push(file);
    } catch {
      // No workspace file with this name.
    }
  }
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (pkg.workspaces) {
      workspaceEvidence.push("package.json workspaces");
    }
  } catch {
    // No readable package.json at the root.
  }
  for (const pattern of CONFIG_PATTERNS) {
    try {
      await readFile(join(root, pattern), "utf8");
      configs.push(pattern);
    } catch {
      // No config file with this name.
    }
  }
  try {
    await readdir(join(root, ".github/workflows"));
    configs.push(".github/workflows");
  } catch {
    // No workflows folder.
  }
  const hasFiles = rootEntries.some(
    (e) => e.name !== ".git" && e.name !== "markflow"
  );
  const mode = stacks.length > 0 || hasFiles ? "brownfield" : "greenfield";
  const monorepo = workspaceEvidence.length > 0 || memberDirs.size > 1;
  return {
    stack: stacks.length > 0 ? stacks[0].name : "TBD",
    stacks,
    manifests,
    configs,
    workspace: {
      detected: workspaceEvidence.length > 0,
      evidence: workspaceEvidence,
    },
    monorepo,
    mode,
    projectName,
  };
}
