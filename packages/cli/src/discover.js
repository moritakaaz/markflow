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

// Discovery records dependency names as written.
// It does not map them to framework names.

function parsePackageDeps(text) {
  try {
    const pkg = JSON.parse(text);
    return [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ];
  } catch {
    return [];
  }
}

function parseRequirements(text) {
  const names = [];
  for (const raw of text.split("\n")) {
    let line = raw.split("#")[0].trim();
    if (!line || line.startsWith("-")) {
      continue;
    }
    line = line.split(";")[0].trim();
    const name = line.split(/[\s=<>~!\[]/)[0].trim();
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function parseGoMod(text) {
  const names = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line === ")" || line.startsWith("//")) {
      continue;
    }
    const parts = line.split(/\s+/);
    let mod = null;
    if (parts[0] === "require") {
      mod = parts[1];
    } else if (
      !["module", "go", "require", "replace", "exclude", "retract"].includes(
        parts[0]
      ) &&
      parts.length >= 2
    ) {
      mod = parts[0];
    }
    if (!mod || mod.startsWith("(")) {
      continue;
    }
    const segments = mod.split("/");
    let last = segments[segments.length - 1];
    if (/^v\d+$/.test(last)) {
      last = segments[segments.length - 2] || "";
    }
    if (last) {
      names.push(last);
    }
  }
  return names;
}

function parseComposerDeps(text) {
  try {
    const pkg = JSON.parse(text);
    const names = [
      ...Object.keys(pkg.require || {}),
      ...Object.keys(pkg["require-dev"] || {}),
    ];
    return names.filter(
      (n) => n !== "php" && !n.startsWith("ext-") && !n.startsWith("lib-")
    );
  } catch {
    return [];
  }
}

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
  ".venv",
  "venv",
  "target",
  ".next",
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
  const dependencies = [];
  const seen = new Set();
  const seenDeps = new Set();
  function addStack(name, evidence, confidence) {
    manifests.push(evidence);
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    stacks.push({ name, evidence, confidence });
  }
  function addDependency(name, evidence) {
    const key = name + "@" + evidence;
    if (seenDeps.has(key)) {
      return;
    }
    seenDeps.add(key);
    dependencies.push({ name, evidence, confidence: "detected" });
  }
  async function collectDeps(fileName, fullPath, evidence) {
    let text;
    try {
      text = await readFile(fullPath, "utf8");
    } catch {
      return;
    }
    let names = [];
    if (fileName === "package.json") {
      names = parsePackageDeps(text);
    } else if (fileName === "requirements.txt") {
      names = parseRequirements(text);
    } else if (fileName === "go.mod") {
      names = parseGoMod(text);
    } else if (fileName === "composer.json") {
      names = parseComposerDeps(text);
    } else {
      return;
    }
    for (const dep of names) {
      addDependency(dep, evidence);
    }
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
        await collectDeps(entry.name, join(dir, entry.name), childRel);
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
    dependencies,
    workspace: {
      detected: workspaceEvidence.length > 0,
      evidence: workspaceEvidence,
    },
    monorepo,
    mode,
    projectName,
  };
}
