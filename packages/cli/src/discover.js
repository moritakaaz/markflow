// Discovery reads manifest files in a repo.
// It checks many manifests, not only package.json.
// It reports every stack it finds, with its evidence.
import { readdir } from "node:fs/promises";
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
  const seen = new Set();
  const subdirs = new Set();
  function addStack(name, evidence, confidence) {
    manifests.push(evidence);
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    stacks.push({ name, evidence, confidence });
  }
  async function scan(dir, rel, confidence) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const name = stackFromEntry(entry.name);
      if (!name) {
        continue;
      }
      const evidence = rel ? rel + "/" + entry.name : entry.name;
      addStack(name, evidence, confidence);
      if (rel) {
        subdirs.add(rel);
      }
    }
  }
  await scan(root, "", "high");
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
      if (!member.isDirectory()) {
        continue;
      }
      await scan(
        join(root, entry.name, member.name),
        entry.name + "/" + member.name,
        "medium"
      );
    }
  }
  const hasFiles = rootEntries.some(
    (e) => e.name !== ".git" && e.name !== "markflow"
  );
  const mode = stacks.length > 0 || hasFiles ? "brownfield" : "greenfield";
  const monorepo = subdirs.size > 1;
  return {
    stack: stacks.length > 0 ? stacks[0].name : "TBD",
    stacks,
    manifests,
    monorepo,
    mode,
    projectName,
  };
}
