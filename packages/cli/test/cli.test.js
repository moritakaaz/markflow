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
import { runInit } from "../src/init.js";
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
    assert.equal(result.warnings.length, 1);
  });

  it("placeholder in AGENTS.md fails", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await write(dir, "AGENTS.md", "{{project_name}}\n");
    const result = await runDoctor({ target: dir });
    assert.equal(result.ok, false);
  });
});

describe("update", () => {
  it("restores a deleted file and skips a modified file", async (t) => {
    const dir = await tempDir(t);
    await runInit({ target: dir });
    await rm(join(dir, "markflow/docs/PRD.md"));
    await write(dir, "markflow/TASKS.md", "my own notes\n");
    const result = await runUpdate({ target: dir });
    assert.equal(result.ok, true);
    assert.equal(result.restored, 1);
    assert.equal(result.skipped, 1);
    const tasks = await readFile(join(dir, "markflow/TASKS.md"), "utf8");
    assert.equal(tasks, "my own notes\n");
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
