# CLI

This folder holds the Markflow command line tool. Read it when you work on the init command.

## Tests

Run tests with npm test from this folder. Tests use temp dirs only. They never touch a real repo. They cover discovery, init, doctor, update, the command parser, and agent adapters.

## Usage

Install it with npx @moritakaaz/markflow init. Then run one of these commands. A command you do not know is rejected and creates no files.

- `markflow init` creates the docs layer in the current repo.
- `markflow init --minimal` creates only PRD, ARCHITECTURE, one spec, and TASKS, plus AGENTS.md and the markflow README. Doctor checks only those files in a minimal project. Run plain `markflow init` later to add the rest.
- `markflow init --agent claude` also creates CLAUDE.md. Use `--agent codex` for Codex, which reads AGENTS.md. Use `--agent cursor` for .cursor/rules/markflow.mdc. Use `--agent copilot` for .github/copilot-instructions.md.
- `markflow doctor` checks the docs layer for missing files, leftover placeholders, broken internal links, and specs missing from the index. It reports errors, warnings, and info. Only errors make it exit with 1.
- `markflow update` restores missing files and updates files the user did not change. It also protects AGENTS.md and agent files with the same hash check. ARCHITECTURE.md and STACK.md belong to the user after init, so update restores them when missing but never changes their content. Use `markflow update --preview` to see what would change without changing any file. The CLI, methodology, and template each have their own version. See src/versions.js for the methodology and template versions.
- `markflow --help` shows the commands.
- `markflow --version` shows the CLI version.

Init reads a repo, then copies the base templates into it. It is non-interactive by default. It does not init a framework. It does not install app dependencies.

Use --agent to pick the agent file. The default is generic and creates AGENTS.md only. Use --agent claude to also create CLAUDE.md. Use --agent cursor to also create .cursor/rules/markflow.mdc.

Init also writes markflow/.markflow.json. That file holds the cli, methodology, and template versions used at init time.

Doctor checks a repo for missing Markflow files. Run it with doctor. It reports missing files and placeholders that were not replaced. It exits with 1 when it finds issues.

Update restores missing files and updates files the user did not change. Run it with update. It never overwrites a file the user changed. It reports skipped files instead. It updates the version marker after it runs.

Init detects stacks from manifest files at the root and in packages and apps members. It scans nested members up to three levels deep. It reports each stack with its evidence file and confidence, and it marks a repo as a monorepo when workspace evidence exists or when it finds manifests in more than one member. It also records test and CI configs it finds at the root. Init writes what it found into markflow/docs/ARCHITECTURE.md and markflow/docs/STACK.md, and it stores the full discovery result in markflow/.markflow.json. It only fills docs that it just created. It never changes docs the user already edited.

See docs/PROJECT_DISCOVERY.md for how discovery works.
