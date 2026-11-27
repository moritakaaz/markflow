// Tests for the Markflow CLI.
// Run them with npm test from packages/cli.
// Each test uses its own temp dir, so tests never touch real repos.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discover } from "../src/discover.js";
import { runDoctor } from "../src/doctor.js";
import { fillArchitecture, runInit } from "../src/init.js";
import { runUpdate } from "../src/update.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "../src/index.js");

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "markflow-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function write(dir, rel, text) {
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, text);
}

function runCli(args, cwd) {
  return spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
}

describe("discover", () => {
  it("empty dir is greenfield with TBD stack", async (t) => {
    const dir = await tempDir(t);
    const result = await discover(dir);
    assert.equal(result.mode, "greenfield");
    assert.equal(result.stack, "TBD");
    assert.deepEqual(result.stacks, []);
    assert.equal(result.monorepo, false);
  });

  it("go.mod means Go with high confidence", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "go.mod", "module demo");
    const result = await discover(dir);
    assert.equal(result.mode, "brownfield");
    assert.equal(result.stack, "Go");
    assert.equal(result.stacks[0].evidence, "go.mod");
    assert.equal(result.stacks[0].confidence, "high");
  });

  it("two manifests at root means two stacks, not a monorepo", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await write(dir, "composer.json", "{}");
    const result = await discover(dir);
    assert.equal(result.stacks.length, 2);
    assert.equal(result.monorepo, false);
  });

  it("nested monorepo finds all four manifests", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await write(dir, "apps/web/frontend/package.json", "{}");
    await write(dir, "apps/api/package.json", "{}");
    await write(dir, "packages/shared/package.json", "{}");
    const result = await discover(dir);
    assert.equal(result.manifests.length, 4);
    assert.equal(result.monorepo, true);
  });

  it("workspace evidence marks a monorepo with one member", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", '{"workspaces":["packages/*"]}');
    await write(dir, "pnpm-workspace.yaml", "");
    await write(dir, "packages/one/package.json", "{}");
    const result = await discover(dir);
    assert.equal(result.monorepo, true);
    assert.equal(result.workspace.detected, true);
  });

  it("skips venv, target, and .next dirs", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await write(dir, "venv/requirements.txt", "");
    await write(dir, "target/Cargo.toml", "");
    await write(dir, ".next/package.json", "{}");
    const result = await discover(dir);
    assert.deepEqual(
      result.stacks.map((s) => s.name),
      ["JavaScript"]
    );
    assert.deepEqual(result.manifests, ["package.json"]);
  });

  it("records test and CI configs", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "vitest.config.ts", "");
    await write(dir, ".github/workflows/ci.yml", "");
    const result = await discover(dir);
    assert.ok(result.configs.includes("vitest.config.ts"));
    assert.ok(result.configs.includes(".github/workflows"));
  });
});

describe("init", () => {
  it("creates AGENTS.md and the markflow folder", async (t) => {
    const dir = await tempDir(t);
    const result = await runInit({ target: dir });
    assert.equal(result.ok !== false, true);
    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
    assert.ok(agents.length > 0);
    const marker = JSON.parse(
      await readFile(join(dir, "markflow/.markflow.json"), "utf8")
    );
    assert.equal(marker.project, dir.split("/").pop());
  });

  it("writes discovery into docs on a multi-stack repo", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await write(dir, "composer.json", "{}");
    await runInit({ target: dir });
    const arch = await readFile(
      join(dir, "markflow/docs/ARCHITECTURE.md"),
      "utf8"
    );
    assert.ok(arch.includes("Language. PHP, JavaScript") || arch.includes("Language. JavaScript, PHP"));
    const stack = await readFile(join(dir, "markflow/docs/STACK.md"), "utf8");
    assert.ok(stack.includes("Detected stacks"));
    const marker = JSON.parse(
      await readFile(join(dir, "markflow/.markflow.json"), "utf8")
    );
    assert.equal(marker.discovery.stacks.length, 2);
  });

  it("never overwrites an existing agent file", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "CLAUDE.md", "MY OWN RULES");
    await runInit({ target: dir, agent: "claude" });
    const text = await readFile(join(dir, "CLAUDE.md"), "utf8");
    assert.equal(text, "MY OWN RULES");
  });

  it("rerun restores a deleted file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await rm(join(dir, "markflow/docs/STACK.md"));
    await runInit({ target: dir });
    const text = await readFile(join(dir, "markflow/docs/STACK.md"), "utf8");
    assert.ok(text.includes("STACK.md"));
  });

  it("fillArchitecture fills language and evidence", () => {
    const filled = fillArchitecture("- Language. TBD\n- Framework. TBD\n", {
      stacks: [{ name: "Go", evidence: "go.mod", confidence: "high" }],
      monorepo: false,
    });
    assert.ok(filled.includes("- Language. Go"));
    assert.ok(filled.includes("- Evidence. go.mod (high)"));
    assert.ok(filled.includes("- Monorepo. No"));
  });

  it("fillArchitecture throws when template lines are missing", () => {
    assert.throws(
      () =>
        fillArchitecture("# ARCHITECTURE\n\nNo lines here.\n", {
          stacks: [{ name: "Go", evidence: "go.mod", confidence: "high" }],
          monorepo: false,
        }),
      /template changed/
    );
  });

  it("minimal init creates only the minimal files", async (t) => {
    const dir = await tempDir(t);
    const result = await runInit({ target: dir, minimal: true });
    assert.equal(result.minimal, true);
    for (const file of [
      "AGENTS.md",
      "markflow/README.md",
      "markflow/TASKS.md",
      "markflow/docs/PRD.md",
      "markflow/docs/ARCHITECTURE.md",
      "markflow/specs/index.md",
      "markflow/specs/_template.md",
    ]) {
      await readFile(join(dir, file), "utf8");
    }
    for (const file of [
      "markflow/docs/STACK.md",
      "markflow/docs/CODING_STANDARDS.md",
      "markflow/CHANGELOG.md",
    ]) {
      await assert.rejects(readFile(join(dir, file), "utf8"));
    }
    const marker = JSON.parse(
      await readFile(join(dir, "markflow/.markflow.json"), "utf8")
    );
    assert.equal(marker.minimal, true);
  });

  it("full init upgrades a minimal project", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, minimal: true });
    const result = await runInit({ target: dir });
    assert.equal(result.minimal, false);
    await readFile(join(dir, "markflow/docs/STACK.md"), "utf8");
    const marker = JSON.parse(
      await readFile(join(dir, "markflow/.markflow.json"), "utf8")
    );
    assert.equal(marker.minimal, false);
  });

  it("init suggests onboarding on first run only", async (t) => {
    const dir = await tempDir(t);
    const first = await runInit({ target: dir });
    assert.equal(
      first.nextStep,
      "Open your AI tool and say: start onboarding."
    );
    const second = await runInit({ target: dir });
    assert.equal(second.nextStep, undefined);
  });

  it("unknown agent fails and creates no files", async (t) => {
    const dir = await tempDir(t);
    const result = await runInit({ target: dir, agent: "bogus" });
    assert.equal(result.ok, false);
    await assert.rejects(readFile(join(dir, "AGENTS.md"), "utf8"));
  });
});

describe("doctor", () => {
  it("clean repo passes", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
  });

  it("broken link fails", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, "markflow/docs/PRD.md", "[Missing](docs/NOPE.md)\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, false);
  });

  it("unlisted spec is a warning only", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, "markflow/specs/99-new.md", "# Spec\n\nStatus\n\nDraft\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some((w) => w.includes("99-new.md")));
  });

  it("warns on empty acceptance in a spec", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(
      dir,
      "markflow/specs/01-test.md",
      "# Test spec\n\n## Goal\n\nDo a thing.\n\n## Acceptance\n\nWrite how you will test this feature. List the main cases.\n\n## Status\n\nDraft\n"
    );
    const index = await readFile(
      join(dir, "markflow/specs/index.md"),
      "utf8"
    );
    await write(dir, "markflow/specs/index.md", index + "\n01-test.md\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some((w) => w.includes("01-test.md"))
    );
  });

  it("warns on approved spec with TBD", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(
      dir,
      "markflow/specs/01-test.md",
      "# Test spec\n\n## Goal\n\nDo a thing with TBD parts.\n\n## Acceptance\n\n- The thing works.\n\n## Status\n\nApproved\n"
    );
    const index = await readFile(
      join(dir, "markflow/specs/index.md"),
      "utf8"
    );
    await write(dir, "markflow/specs/index.md", index + "\n01-test.md\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some((w) => w.includes("01-test.md"))
    );
  });

  it("warns when PRD is still the template", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.includes("markflow/docs/PRD.md"));
  });

  it("warns when instruction text is left visible", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(
      dir,
      "markflow/docs/PRD.md",
      "Our product.\n\nWrite one short paragraph. About the problem.\n"
    );
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(result.warnings.includes("markflow/docs/PRD.md"));
  });

  it("hidden instructions do not warn", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(
      result.warnings.filter((w) => w === "markflow/docs/PRD.md").length,
      1
    );
  });

  it("template spec still warns on empty acceptance", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(
      dir,
      "markflow/specs/01-test.md",
      "# Test spec\n\n## Goal\n\n<!-- Write what this feature must do in one or two sentences. -->\n\n- [ ] TBD\n\n## Acceptance\n\n<!-- Write how you will test this feature. List the main cases. -->\n\n## Status\n\nDraft\n"
    );
    const index = await readFile(
      join(dir, "markflow/specs/index.md"),
      "utf8"
    );
    await write(dir, "markflow/specs/index.md", index + "\n01-test.md\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(
      result.warnings.some((w) => w.includes("01-test.md"))
    );
  });

  it("doctor passes on a minimal project", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, minimal: true });
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
  });

  it("no PRD warning when PRD is filled", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, "markflow/docs/PRD.md", "Our own product.\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
    assert.ok(!result.warnings.includes("markflow/docs/PRD.md"));
  });

  it("placeholder in AGENTS.md fails", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, "AGENTS.md", "{{project_name}}\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, false);
  });

  it("placeholder in cursor file fails", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, agent: "cursor" });
    await write(dir, ".cursor/rules/markflow.mdc", "{{project_name}}\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, false);
  });

  it("old cursorrules file is no longer checked", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, ".cursorrules", "{{project_name}}\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, true);
  });
});

describe("update", () => {
  it("keeps a file the user wrote before init", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "markflow/docs/PRD.md", "MY OWN PRD TEXT\n");
    await runInit({ target: dir });
    const before = await readFile(join(dir, "markflow/docs/PRD.md"), "utf8");
    assert.equal(before, "MY OWN PRD TEXT\n");
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.updated, 0);
    assert.equal(result.skipped, 3);
    const after = await readFile(join(dir, "markflow/docs/PRD.md"), "utf8");
    assert.equal(after, "MY OWN PRD TEXT\n");
  });

  it("keeps filled ARCHITECTURE.md and STACK.md on update", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await runInit({ target: dir });
    const archBefore = await readFile(
      join(dir, "markflow/docs/ARCHITECTURE.md"),
      "utf8"
    );
    assert.ok(archBefore.includes("- Language. JavaScript"));
    const stackBefore = await readFile(
      join(dir, "markflow/docs/STACK.md"),
      "utf8"
    );
    assert.ok(stackBefore.includes("Detected stacks"));
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.updated, 0);
    assert.equal(result.skipped, 2);
    const archAfter = await readFile(
      join(dir, "markflow/docs/ARCHITECTURE.md"),
      "utf8"
    );
    assert.ok(archAfter.includes("- Language. JavaScript"));
    const stackAfter = await readFile(
      join(dir, "markflow/docs/STACK.md"),
      "utf8"
    );
    assert.ok(stackAfter.includes("Detected stacks"));
  });

  it("restores ARCHITECTURE.md when missing", async (t) => {
    const dir = await tempDir(t);
    await write(dir, "package.json", "{}");
    await runInit({ target: dir });
    await rm(join(dir, "markflow/docs/ARCHITECTURE.md"));
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.restored, 1);
    const arch = await readFile(
      join(dir, "markflow/docs/ARCHITECTURE.md"),
      "utf8"
    );
    assert.ok(arch.includes("- Language. TBD"));
  });

  it("restores a deleted file and skips a modified file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await rm(join(dir, "markflow/docs/PRD.md"));
    await write(dir, "markflow/TASKS.md", "my own notes\n");
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.restored, 1);
    assert.equal(result.skipped, 3);
    const tasks = await readFile(join(dir, "markflow/TASKS.md"), "utf8");
    assert.equal(tasks, "my own notes\n");
  });

  it("update keeps a minimal project minimal", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, minimal: true });
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    await assert.rejects(
      readFile(join(dir, "markflow/docs/STACK.md"), "utf8")
    );
  });

  it("preview changes nothing", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await rm(join(dir, "markflow/docs/PRD.md"));
    const result = await runUpdate({ target: dir, preview: true });
    assert.equal(result.preview, true);
    await assert.rejects(readFile(join(dir, "markflow/docs/PRD.md"), "utf8"));
  });

  it("keeps a file that left the template", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    const markerPath = join(dir, "markflow/.markflow.json");
    const marker = JSON.parse(await readFile(markerPath, "utf8"));
    marker.files["docs/OLD.md"] = "abc123";
    await writeFile(markerPath, JSON.stringify(marker, null, 2));
    const result = await runUpdate({ target: dir });
    assert.equal(result.kept, 1);
  });

  it("no marker fails", async (t) => {
    const dir = await tempDir(t);
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, false);
  });

  it("restores a deleted agent file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, agent: "claude" });
    await rm(join(dir, "CLAUDE.md"));
    const result = await runUpdate({ target: dir });
    assert.equal(result.restored, 1);
    const text = await readFile(join(dir, "CLAUDE.md"), "utf8");
    assert.ok(text.length > 0);
  });
});

describe("parser", () => {
  it("unknown command exits 1 and creates no files", async (t) => {
    const dir = await tempDir(t);
    const result = runCli(["frobnicate"], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Unknown command/);
    await assert.rejects(readFile(join(dir, "AGENTS.md"), "utf8"));
  });

  it("no args exits 1 and creates no files", async (t) => {
    const dir = await tempDir(t);
    const result = runCli([], dir);
    assert.equal(result.status, 1);
    await assert.rejects(readFile(join(dir, "AGENTS.md"), "utf8"));
  });

  it("--help exits 0", async (t) => {
    const dir = await tempDir(t);
    const result = runCli(["--help"], dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage/);
  });

  it("init --minimal exits 0 and marks the project minimal", async (t) => {
    const dir = await tempDir(t);
    const result = runCli(["init", "--minimal"], dir);
    assert.equal(result.status, 0);
    await assert.rejects(
      readFile(join(dir, "markflow/docs/STACK.md"), "utf8")
    );
    const marker = JSON.parse(
      await readFile(join(dir, "markflow/.markflow.json"), "utf8")
    );
    assert.equal(marker.minimal, true);
  });

  it("--version prints the version", async (t) => {
    const dir = await tempDir(t);
    const result = runCli(["--version"], dir);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "0.1.0");
  });
});

describe("agents", () => {
  it("cursor creates the modern mdc file with frontmatter", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, agent: "cursor" });
    const text = await readFile(
      join(dir, ".cursor/rules/markflow.mdc"),
      "utf8"
    );
    assert.ok(text.startsWith("---"));
    assert.ok(text.includes("alwaysApply: true"));
    await assert.rejects(readFile(join(dir, ".cursorrules"), "utf8"));
  });

  it("copilot creates its instructions file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, agent: "copilot" });
    const text = await readFile(
      join(dir, ".github/copilot-instructions.md"),
      "utf8"
    );
    assert.ok(text.length > 0);
  });

  it("codex creates no extra file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir, agent: "codex" });
    await assert.rejects(readFile(join(dir, "CLAUDE.md"), "utf8"));
    await assert.rejects(
      readFile(join(dir, ".github/copilot-instructions.md"), "utf8")
    );
  });
});
