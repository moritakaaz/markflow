# CLI

This folder holds the Markflow command line tool. Read it when you work on the init command.

Init reads a repo, then copies the base templates into it. It is non-interactive by default. It does not init a framework. It does not install app dependencies.

Use --agent to pick the agent file. The default is generic and creates AGENTS.md only. Use --agent claude to also create CLAUDE.md. Use --agent cursor to also create .cursorrules.

Init also writes markflow/.markflow.json. That file holds the cli, methodology, and template versions used at init time.

Doctor checks a repo for missing Markflow files. Run it with doctor. It reports missing files and placeholders that were not replaced. It exits with 1 when it finds issues.

Update restores missing files and updates files the user did not change. Run it with update. It never overwrites a file the user changed. It reports skipped files instead. It updates the version marker after it runs.

Init detects stacks from manifest files at the root and in packages and apps members. It reports each stack with its evidence file and confidence, and it marks a repo as a monorepo when it finds manifests in more than one member. Init writes what it found into markflow/docs/ARCHITECTURE.md and markflow/docs/STACK.md, and it stores the full discovery result in markflow/.markflow.json. It only fills docs that it just created. It never changes docs the user already edited.

See docs/PROJECT_DISCOVERY.md for how discovery works.
