// Update restores missing files and updates unmodified files.
// It never overwrites a file the user changed.
// Use preview mode to see what would change without changing files.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashText } from "./hash.js";
import { AGENTS } from "./agents.js";
import { findTemplatesDir } from "./templates.js";
import { METHODOLOGY_VERSION, TEMPLATE_VERSION } from "./versions.js";
import { MINIMAL_FILES } from "./minimal.js";

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

// Files init fills from discovery. After init they belong to the user.
// Update restores them when missing but never changes their content.
const USER_OWNED = new Set(["docs/ARCHITECTURE.md", "docs/STACK.md"]);

export async function runUpdate(options) {
  const preview = options && options.preview;
  const target = (options && options.target) || process.cwd();
  const markerPath = join(target, "markflow/.markflow.json");
  let marker;
  try {
    marker = JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    console.log("No version marker found.");
    return { ok: false };
  }
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = await findTemplatesDir();
  const pkg = JSON.parse(await readFile(join(srcDir, "../package.json"), "utf8"));
  const projectName = marker.project || target.split("/").pop();
  const agent = marker.agent && marker.agent in AGENTS ? marker.agent : "generic";
  const stored = marker.files || {};
  const storedRoot = marker.rootFiles || {};
  const rels = [];
  await listFiles(join(templatesDir, "markflow"), join(templatesDir, "markflow"), rels);
  const templateSet = new Set(rels);
  const syncRels =
    marker.minimal === true
      ? rels.filter((rel) => MINIMAL_FILES.includes("markflow/" + rel))
      : rels;
  let updated = 0;
  let restored = 0;
  let skipped = 0;
  let kept = 0;
  const files = { ...stored };
  const rootFiles = { ...storedRoot };
  async function sync(rel, dest, templateText, storedMap, newMap, userOwned) {
    const templateHash = hashText(templateText);
    let current = null;
    try {
      current = await readFile(dest, "utf8");
    } catch {
      console.log((preview ? "Would restore " : "Restored ") + rel);
      if (!preview) {
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, templateText);
      }
      restored += 1;
      newMap[rel] = templateHash;
      return;
    }
    if (userOwned) {
      if (storedMap[rel] && hashText(current) === storedMap[rel]) {
        console.log("Kept " + rel + ", user owned.");
        kept += 1;
      } else if (storedMap[rel]) {
        console.log("Skipped " + rel + ", modified.");
        skipped += 1;
      } else {
        console.log("Skipped " + rel + ", user owned.");
        skipped += 1;
      }
      return;
    }
    if (storedMap[rel] && hashText(current) === storedMap[rel]) {
      if (templateHash !== storedMap[rel]) {
        console.log((preview ? "Would update " : "Updated ") + rel);
        if (!preview) {
          await writeFile(dest, templateText);
        }
        updated += 1;
        newMap[rel] = templateHash;
      }
      return;
    }
    console.log("Skipped " + rel + ", modified.");
    skipped += 1;
  }
  for (const rel of syncRels) {
    const templateText = (await readFile(join(templatesDir, "markflow", rel), "utf8"))
      .split("{{project_name}}")
      .join(projectName);
    await sync(rel, join(target, "markflow", rel), templateText, stored, files, USER_OWNED.has(rel));
  }
  for (const rel of Object.keys(stored)) {
    if (!templateSet.has(rel)) {
      console.log("Kept " + rel + ", no longer in template.");
      kept += 1;
    }
  }
  const agentsTemplate = (await readFile(join(templatesDir, "AGENTS.md"), "utf8"))
    .split("{{project_name}}")
    .join(projectName);
  await sync("AGENTS.md", join(target, "AGENTS.md"), agentsTemplate, storedRoot, rootFiles);
  let agentsText = agentsTemplate;
  try {
    agentsText = await readFile(join(target, "AGENTS.md"), "utf8");
  } catch {
    // AGENTS.md is missing, so the template text stays in use.
  }
  for (const file of AGENTS[agent]) {
    if (!(file.path in storedRoot)) {
      continue;
    }
    const content = file.frontmatter
      ? file.frontmatter + "\n" + agentsText
      : agentsText;
    await sync(file.path, join(target, file.path), content, storedRoot, rootFiles);
  }
  if (preview) {
    console.log("Preview only, no files changed.");
    console.log(
      "Would update " + updated + " files. Would restore " + restored + " files. Skipped " + skipped + " files. Kept " + kept + " files."
    );
    return { ok: true, updated, restored, skipped, kept, preview: true };
  }
  marker.cli = pkg.version;
  marker.methodology = METHODOLOGY_VERSION;
  marker.template = TEMPLATE_VERSION;
  marker.project = projectName;
  marker.agent = agent;
  marker.files = files;
  marker.rootFiles = rootFiles;
  await writeFile(markerPath, JSON.stringify(marker, null, 2) + "\n");
  if (updated === 0 && restored === 0 && skipped === 0 && kept === 0) {
    console.log("Already up to date.");
  } else {
    console.log("Updated " + updated + " files. Restored " + restored + " files. Skipped " + skipped + " files. Kept " + kept + " files.");
  }
  return { ok: true, updated, restored, skipped, kept };
}
