# PROMPTS.md

Purpose. This file holds standard prompts for {{project_name}}.
Read when. You need a prompt for onboarding, review, refactor, or a new feature.
Do not read when. You already have a prompt that works. Use it.

## Onboarding

Interview me one question at a time. Start with the problem and the users. Then write PRD.md and ARCHITECTURE.md from my answers and from the code. Mark what you do not know as TBD and list the open questions at the end.

## Code review

Review the change against the spec and CODING_STANDARDS.md. List what breaks the spec. List what breaks the standards. Do not praise without reason.

## Refactor

Refactor only the code in scope. Keep behavior the same. Run tests after the change. Show the test result.

## New feature

Read the spec first. Read ARCHITECTURE.md next. Then write code and tests. Do not skip tests.
