# Manual setup

This guide shows how to use Markflow without Node. Read it when you want the docs layer but you do not want to install Node or run the CLI.

## Copy the templates

1. Get the templates. Clone the repo or download the latest release zip from GitHub.
2. Copy AGENTS.md from templates/base to your project root. If your project already has AGENTS.md, merge the two files by hand.
3. Copy the markflow folder from templates/base to your project root.
4. Replace every {{project_name}} in AGENTS.md and in the markflow folder with your project name. Use find and replace in your editor.
5. Fill in the docs. Start with PRD.md, then STACK.md and ARCHITECTURE.md. Fill sections 2, 3, and 5 of CODING_STANDARDS.md. Pick your first tasks in TASKS.md.

## Agent files

AGENTS.md is the only file most agents need. For other agents, copy AGENTS.md to the file that agent reads.

- Claude reads CLAUDE.md.
- Copilot reads .github/copilot-instructions.md.
- Cursor reads .cursor/rules/markflow.mdc. Put this frontmatter on top of the copied text.

```text
---
description: Markflow project instructions
globs:
alwaysApply: true
---
```

## What you miss without the CLI

Init does not detect your stack, so fill STACK.md and ARCHITECTURE.md by hand. Doctor does not check your files, so check by hand that all 11 required files exist and no {{project_name}} is left.

- AGENTS.md
- markflow/README.md
- markflow/TASKS.md
- markflow/CHANGELOG.md
- markflow/docs/PRD.md
- markflow/docs/ARCHITECTURE.md
- markflow/docs/CODING_STANDARDS.md
- markflow/docs/STACK.md
- markflow/docs/TESTING.md
- markflow/specs/index.md
- markflow/.markflow.json

Update does not restore files, so copy a missing file from the templates by hand. The version marker markflow/.markflow.json is made by the CLI, so you can skip it.

## Later

If you install Node later, run npx @moritakaaz/markflow init in the same project. Init never overwrites your files. It only adds what is missing.
