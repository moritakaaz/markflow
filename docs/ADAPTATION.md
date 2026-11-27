# Adaptation

This file explains how one method works across many kinds of projects. Read it when you add a new stack or a new agent.

## One method, many projects

Markflow does not change its core when the stack changes. The core stays the same. It is docs first, spec driven, and evidence based.

What changes is context. Each framework needs different context. Adapters supply that context. The core does not hardcode it.

## Adapters

There are two kinds of adapters.

Agent adapters handle differences between AI agents. One agent reads `AGENTS.md`. Another reads `CLAUDE.md`. Another reads Cursor rules. The method is the same. The file format changes. Current adapters are generic and Codex with `AGENTS.md`, Claude with `CLAUDE.md`, Cursor with `.cursor/rules/markflow.mdc`, and Copilot with `.github/copilot-instructions.md`. To add an agent, add one entry in `packages/cli/src/agents.js`. Do not change the init flow to fit one agent.

Project context adapters handle differences between stacks. They know which manifest files to read and which docs matter most for that stack. They do not install or configure the stack. They only help Markflow understand it.

If a new stack appears, add a new adapter. Do not change the core to fit one stack.

## Adaptive workflow

Not every task needs the same process. Markflow matches the process to the task.

Level 1 is for a small fix. The change is tiny and low risk. It needs a short note, a code change, and a test run. It does not need a full spec.

Level 2 is for a normal feature. It needs a spec, a code change, and tests. It needs a short review.

Level 3 is for a large or risky feature. It needs a full spec, a review before coding, tests, and evidence of verification. It may need an ADR when it changes architecture.

The level is set by scope and risk, not by who does the work. A human and an AI agent follow the same levels.

## Monorepo and multi language projects

A monorepo can hold more than one app and more than one language. Markflow handles it by scoping docs per area. Each area can have its own specs and tasks. Shared decisions go in the top level docs.

Do not force one stack on the whole monorepo. Let each area keep its own context.

## What adaptation is not

Adaptation is not scaffolding. Markflow does not create a framework app. The user or an AI agent creates the app from a spec when needed. Markflow only makes sure the spec and the docs are clear first.
