# Principles

This file holds the permanent rules for Markflow. Read it before you change the methodology or build the CLI. If a new idea breaks one of these rules, the idea is wrong, not the rule.

## Framework independence

Markflow never inits, installs, or changes an app framework. It only adds docs and workflows to a repo that already exists. A project keeps its own framework. Markflow adapts to the project.

## Language agnostic

The core method does not depend on one language. It works for JavaScript, Python, PHP, Go, Rust, Java, and more. Language details live in adapters, not in the core.

## Agent agnostic

The core method does not depend on one AI agent. It works for Codex, Claude, Cursor, Copilot, and generic agents. Agent differences live in adapters, not in the core.

## Repository first

Adapt to the repo you find. Do not force a new structure on it. Read manifest files and configs first. Learn what stack is already there. Do not move source code just to fit Markflow.

## Non-destructive

Never overwrite existing files without explicit approval. Never delete user docs or code by default. An update must show what will change and ask first when a file was edited by the user.

## Progressive adoption

A project can adopt Markflow step by step. It does not need to use every doc or workflow at once. Start small. Add more when it helps.

## Evidence based context

Never invent project architecture or technical decisions. If Markflow cannot tell something from the repo, mark it as TBD. Ask a human to confirm it. A guess in docs becomes a bug later.

## Adaptive complexity

Match the process to the task. A small bug fix does not need a full spec and approval. A large feature does. Risk and scope decide how strict the workflow is, not habit.

## What Markdown holds

Markdown holds intent, requirements, specs, and recorded decisions. Code and tests show what the system actually does. When docs and code disagree, treat it as a signal to check both. Do not assume the docs are always right.
