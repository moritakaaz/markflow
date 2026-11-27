# markflow

Purpose. This folder holds all project context for {{project_name}}. It is the single place for intent, decisions, specs, and tasks.
Read when. You start work on this project or you need to know why something was built this way.
Do not read when. You only need one specific spec. Open that spec directly instead.

## Map

- `docs/PRD.md`. Vision, users, and features. Read it when you start a new feature or check if a feature still fits the vision.
- `docs/ARCHITECTURE.md`. Stack, layout, and flow. Read it when you pick a stack or decide where code goes.
- `docs/DATA_MODEL.md`. Schema and relations. Read it when you change data.
- `docs/API.md`. Endpoints and payloads. Read it when you work on an API.
- `docs/TESTING.md`. Test strategy. Read it before you write tests.
- `docs/DEPLOY.md`. Release flow and env setup. Read it before you deploy.
- `docs/GLOSSARY.md`. Domain terms. Read it when a term is unclear.
- `docs/CODING_STANDARDS.md`. Code rules. Read it before you write or review code.
- `docs/STACK.md`. Libraries and their MCP servers. Read it when you add or replace a library.
- `docs/MCP.md`. MCP servers and setup. Read it when you set up an AI tool.
- `specs/index.md`. List of all specs plus status. Read it first before you open one spec.
- `specs/_template.md`. Template for a new spec. Use it when you create a spec.
- `.agents/MEMORY.md`. Dynamic context, lessons, and odd bugs.
- `.agents/PROMPTS.md`. Standard prompts.
- `.agents/RULES.md`. One line pointer to CODING_STANDARDS.md. It holds no duplicate rules.
- `.agents/mcp.json`. Master MCP config. Copy it to your AI tool location during sync. Do not put API keys here. Use env vars.
- `.agents/workflows`. Step by step SOPs, from review spec to pre deploy check.

## Tasks and changes

- `TASKS.md`. Active work and progress.
- `CHANGELOG.md`. Release history.
