// Update restores missing files and updates unmodified files.
// It never overwrites a file the user changed.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashText } from "./hash.js";

async function listFiles(dir, base, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await listFiles(full, base, out);
      continue;
    }
    out.push(full.slice(base.length + 1));
  }
}

export async function runUpdate() {
  const target = process.cwd();
  const markerPath = join(target, "markflow/.markflow.json");
  let marker;
  try {
    marker = JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    console.log("No version marker found.");
    return { ok: false };
  }
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(srcDir, "../../../templates/base");
  const pkg = JSON.parse(await readFile(join(srcDir, "../package.json"), "utf8"));
  const projectName = marker.project || target.split("/").pop();
  const stored = marker.files || {};
  const rels = [];
  await listFiles(join(templatesDir, "markflow"), join(templatesDir, "markflow"), rels);
  let updated = 0;
  let restored = 0;
  let skipped = 0;
  const files = { ...stored };
  for (const rel of rels) {
    const templateText = (await readFile(join(templatesDir, "markflow", rel), "utf8"))
      .split("{{project_name}}")
      .join(projectName);
    const templateHash = hashText(templateText);
    const dest = join(target, "markflow", rel);
    let current = null;
    try {
      current = await readFile(dest, "utf8");
    } catch {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, templateText);
      console.log("Restored " + rel);
      files[rel] = templateHash;
      restored += 1;
      continue;
    }
    if (stored[rel] && hashText(current) === stored[rel]) {
      if (templateHash !== stored[rel]) {
        await writeFile(dest, templateText);
        console.log("Updated " + rel);
        files[rel] = templateHash;
        updated += 1;
      }
      continue;
    }
    console.log("Skipped " + rel + ", modified.");
    skipped += 1;
  }
  const agentsDest = join(target, "AGENTS.md");
  try {
    await stat(agentsDest);
  } catch {
    const text = (await readFile(join(templatesDir, "AGENTS.md"), "utf8"))
      .split("{{project_name}}")
      .join(projectName);
    await writeFile(agentsDest, text);
    console.log("Restored AGENTS.md");
    restored += 1;
  }
  marker.cli = pkg.version;
  marker.methodology = pkg.version;
  marker.template = pkg.version;
  marker.project = projectName;
  marker.files = files;
  await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n");
  if (updated === 0 && restored === 0 && skipped === 0) {
    console.log("Already up to date.");
  } else {
    console.log("Updated " + updated + " files. Restored " + restored + " files. Skipped " + skipped + " files.");
  }
  return { ok: true, updated, restored, skipped };
}
