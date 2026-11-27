# CLI

This folder holds the Markflow command line tool. Read it when you work on the init command.

Init reads a repo, then copies the base templates into it. It is non-interactive by default. It does not init a framework. It does not install app dependencies.

Use --agent to pick the agent file. The default is generic and creates AGENTS.md only. Use --agent claude to also create CLAUDE.md. Use --agent cursor to also create .cursorrules.

Init also writes markflow/.markflow.json. That file holds the cli, methodology, and template versions used at init time.

See docs/PROJECT_DISCOVERY.md for how discovery works.
