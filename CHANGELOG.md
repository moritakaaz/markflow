# Changelog

All notable changes to Markflow will be noted here. The format is simple. Newest version goes on top.

## Unreleased

## 0.4.1 - 2026-11-28

- Ask language first in onboarding, before the problem

## 0.4.0 - 2026-11-28

- Add usage section, quick start, and repo layout to README
- Ask language in onboarding and record it in PRD
- Fill TASKS with five steps and name the user as approver
- Split TBD count into now and later in doctor
- Grow the CLI test suite to 62 tests

## 0.3.0 - 2026-11-27

- Add CI workflow running CLI tests on Node 18 and 22
- Link onboarding workflow in template AGENTS.md
- Warn when PRD, ARCHITECTURE, and TASKS are still templates, with a Next line
- Detect dependencies without framework names and list them in STACK.md
- Add File column to specs/index.md so doctor can find specs by file name
- Grow the CLI test suite to 58 tests

## 0.2.0 - 2026-11-27

- Fix update overwriting files the user wrote before init
- Fix update reverting filled ARCHITECTURE.md and STACK.md to the blank template
- Fix doctor and doc drift, including the cursor file check
- Skip build and venv dirs in discovery
- Fail loudly when the ARCHITECTURE.md template fill cannot run
- Fill glossary definitions
- Require sources for doc claims
- Add doctor quality checks for empty acceptance, Approved specs with TBD, and a PRD still the template
- Add onboarding workflow and prompt
- Print the next step after init
- Hide template instructions in HTML comments and warn when they are left visible
- Add minimal init mode
- Add a bad and good doc example
- Grow the CLI test suite to 48 tests

## 0.1.0 - 2026-11-27

- Add README, LICENSE, and CONTRIBUTING docs
- Add Code of Conduct and Security Policy
- Add core principles, project discovery, and adaptation docs
- Add base templates for the markflow folder and AGENTS.md
- Add CLI with init, doctor, and update commands
- Add project discovery for many manifests, multi-stack, and monorepo
- Write discovery results into ARCHITECTURE.md, STACK.md, and the version marker
- Make init non-destructive and safe to run again
- Add agent flag with generic, claude, codex, cursor, and copilot
- Add version marker with file hashes for safe updates
- Fix command parser with help and version
- Add CLI test suite with 27 tests
- Publish the CLI as @moritakaaz/markflow on npm
- Bundle templates in the published package
