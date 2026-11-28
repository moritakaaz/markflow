// Doctor checks a repo for missing Markflow files.
// It reports errors, warnings, and info.
// Errors fail the check. Warnings and info do not.
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { findTemplatesDir } from "./templates.js";
import { MINIMAL_REQUIRED } from "./minimal.js";

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

const AGENT_FILES = ["CLAUDE.md", ".cursor/rules/markflow.mdc"];

// TBD in these files blocks the start. TBD in other docs can wait.
const TBD_NOW = [
  "markflow/docs/PRD.md",
  "markflow/docs/ARCHITECTURE.md",
  "markflow/docs/STACK.md",
  "markflow/TASKS.md",
];

function isTbdNow(rel) {
  if (TBD_NOW.includes(rel)) {
    return true;
  }
  return (
    rel.startsWith("markflow/specs/") &&
    !rel.endsWith("/index.md") &&
    !rel.endsWith("/_template.md")
  );
}

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

// First sentence of each fill-in instruction in the templates.
// The full lines live inside HTML comments in the templates.
// A doc that still shows one of these as visible text was not filled in.
const INSTRUCTIONS = [
  "Write one short paragraph.",
  "List the main users.",
  "List the core features.",
  "List what this project will not do.",
  "Write how you will know this project works.",
  "Write what discovery found.",
  "Write where code lives.",
  "Write how a request or a job moves through the system.",
  "Add one row per library.",
  "Add one entry per term.",
  "Write what you test at each level.",
  "Write the exact command to run tests.",
  "List the edge cases that often break.",
  "Write your naming pattern here.",
  "Write your function format here.",
  "Write the order of parts in a file here.",
  "List the main entities.",
  "Write how entities link to each other.",
  "Write the rules for data.",
  "Write how schema changes are made and tested.",
  "Write how auth works.",
  "List each endpoint with method, path, request, and response.",
  "Write the shared rules.",
  "Write the steps from main branch to production.",
  "List the env vars that are required.",
  "Write how to roll back a bad release.",
  "Add one entry per server.",
  "Write how the master config in `.agents/mcp.json` is copied to your AI tool.",
  "Write what this feature must do in one or two sentences.",
  "Write who uses this feature.",
  "List what must be true when this feature is done.",
  "List what this feature will not do.",
  "Write how you will test this feature.",
  "Write the decision in one sentence.",
  "Write why this decision was needed.",
  "List the options you considered.",
  "Write what you picked and why.",
  "Write Draft or Approved.",
  "Write the picked stack and the main reason.",
];

// Remove HTML comments, so hidden instructions do not count as visible text.
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

// Lines of one ## section, or null when the section is missing.
function sectionLines(text, heading) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## " + heading);
  if (start === -1) {
    return null;
  }
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      break;
    }
    out.push(lines[i]);
  }
  return out;
}

// A language line is unanswered when it still says TBD or when the
// value after the label is empty.
function languageUnanswered(line) {
  if (line.includes("TBD")) {
    return true;
  }
  const dot = line.indexOf(".");
  if (dot === -1) {
    return false;
  }
  return line.slice(dot + 1).trim() === "";
}

// A spec counts as listed only when its exact file name appears.
// A substring match would also match old-login.md for login.md.
// A path form such as specs/login.md also counts.
function indexLists(indexText, name) {
  if (indexText.split(/[\s|,()]+/).includes(name)) {
    return true;
  }
  return indexText.includes("/" + name);
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

export async function runDoctor(options) {
  const root = (options && options.target) || process.cwd();
  const errors = [];
  const warnings = [];
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
    // Missing marker is already reported below.
  }
  const required =
    marker && marker.minimal === true ? MINIMAL_REQUIRED : REQUIRED;
  for (const file of required) {
    try {
      await stat(join(root, file));
      console.log("OK " + file);
    } catch {
      console.log("Error Missing " + file);
      errors.push(file);
    }
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
  let tbdNow = 0;
  let tbdLater = 0;
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
    const visible = stripComments(text);
    for (const phrase of INSTRUCTIONS) {
      if (visible.includes(phrase)) {
        console.log("Warning Instruction text left in " + rel);
        warnings.push(rel);
        break;
      }
    }
    const count = visible.split("TBD").length - 1;
    if (isTbdNow(rel)) {
      tbdNow += count;
    } else {
      tbdLater += count;
    }
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
  const stillTemplate = [];
  try {
    const templatesDir = await findTemplatesDir();
    const projectName = (marker && marker.project) || basename(root);
    for (const [rel, label] of [
      ["markflow/docs/PRD.md", "PRD"],
      ["markflow/docs/ARCHITECTURE.md", "ARCHITECTURE"],
      ["markflow/TASKS.md", "TASKS"],
    ]) {
      const templateText = (
        await readFile(join(templatesDir, rel), "utf8")
      )
        .split("{{project_name}}")
        .join(projectName);
      const text = await readFile(join(root, rel), "utf8");
      if (text === templateText) {
        console.log("Warning " + label + " is still the template " + rel);
        warnings.push(rel);
        stillTemplate.push(rel);
      }
    }
  } catch {
    // Template or doc is missing, so skip this check.
  }
  if (stillTemplate.length > 0) {
    console.log("Next. Fill " + stillTemplate[0] + ".");
  }
  if (!stillTemplate.includes("markflow/docs/PRD.md")) {
    try {
      const prdText = await readFile(
        join(root, "markflow/docs/PRD.md"),
        "utf8"
      );
      const language = sectionLines(prdText, "Language");
      if (language !== null && language.some(languageUnanswered)) {
        console.log("Warning Language not answered in markflow/docs/PRD.md");
        warnings.push("markflow/docs/PRD.md");
      }
    } catch {
      // Missing PRD is already reported above.
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
      const rel = file.slice(root.length + 1);
      const status = sectionLines(text, "Status");
      if (
        status !== null &&
        status.some((line) => line.trim() === "Draft")
      ) {
        specDraft += 1;
      }
      if (!indexLists(indexText, name)) {
        console.log("Warning Spec not listed in index " + rel);
        warnings.push(rel);
      }
      const acceptance = sectionLines(text, "Acceptance");
      if (acceptance !== null) {
        const cases = stripComments(acceptance.join("\n"))
          .split("\n")
          .filter((line) => line.trim() !== "");
        if (cases.length === 0) {
          console.log("Warning Empty acceptance in " + rel);
          warnings.push(rel);
        }
      }
      if (
        status !== null &&
        status.some((line) => line.trim() === "Approved") &&
        stripComments(text).includes("TBD")
      ) {
        console.log("Warning Approved spec still has TBD in " + rel);
        warnings.push(rel);
      }
      if (status !== null) {
        const statusLines = stripComments(status.join("\n"))
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");
        if (
          statusLines.length > 0 &&
          !statusLines.includes("Draft") &&
          !statusLines.includes("Approved")
        ) {
          console.log("Warning Unknown status in " + rel);
          warnings.push(rel);
        }
      }
    }
  } catch {
    // Missing specs folder is already reported above.
  }
  console.log("Info " + tbdNow + " TBD left to decide now.");
  console.log("Info " + tbdLater + " TBD left for later.");
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
