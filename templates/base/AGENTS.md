# AGENTS.md

This file is the router for AI agents in this project. Read it first.

## Start here

All project context lives in the `markflow` folder. Do not create new Markdown files in the root.

If the PRD is still the template, start with the onboarding workflow in `markflow/.agents/workflows/onboarding.md`. It interviews the user one question at a time and fills the first docs.

Start with these files in order.

1. Read `markflow/docs/PRD.md` to learn what this project is.
2. Read `markflow/docs/ARCHITECTURE.md` to learn the stack and the layout of source code.
3. Read `markflow/specs/index.md` to learn which spec is active.
4. Read `markflow/docs/CODING_STANDARDS.md` before you write or review code.

## Rules you must not break

- Code is in English. Docs are in English for this template. Change the doc language in `markflow/docs/PRD.md` when the project needs another language. The Markflow repo itself is English only. Your project is not.
- Keep these words in English in every doc. Status, Acceptance, Approved, Draft, and TBD. Doctor reads them. Write the rest in any language.
- All code lives in the source folder found during discovery. Tests live in the test folder found during discovery. Do not create new top level folders for code.
- Specs in `markflow/specs` are the source for intent and requirements. If code differs from a spec, stop and check both. Do not assume the spec is always right.
- Every claim in a doc comes from one of three places. What the user said. What the code shows. Or TBD. Never invent a decision or an architecture detail.
- All links inside `markflow` must be relative to that folder. Do not use absolute paths from the root.

## If you are human and you do not use AI

Ignore the `markflow/.agents` folder. Read `README.md` and `CONTRIBUTING.md` in this project instead.
