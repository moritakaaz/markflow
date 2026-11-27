# CLI

This folder holds the Markflow command line tool. Read it when you work on the init command.

Init reads a repo, then copies the base templates into it. It is non-interactive by default. It does not init a framework. It does not install app dependencies.

Use --agent to pick the agent file. The default is generic and creates AGENTS.md only. Use --agent claude to also create CLAUDE.md. Use --agent cursor to also create .cursorrules.

Init also writes markflow/.markflow.json. That file holds the cli, methodology, and template versions used at init time.

Doctor checks a repo for missing Markflow files. Run it with doctor. It reports missing files and placeholders that were not replaced. It exits with 1 when it finds issues.

See docs/PROJECT_DISCOVERY.md for how discovery works.
