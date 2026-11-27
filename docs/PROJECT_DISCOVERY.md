# Project Discovery

This file explains how Markflow learns about a repo before it creates any docs. Read it before you build the init command.

## Goal

Markflow must understand a repo without changing it. Discovery is read only. It never installs a framework. It never edits source code. It never changes a build config.

## What discovery reads

Discovery looks for files that already exist in the repo. These files tell Markflow what stack the project uses.

- `package.json` points to a JavaScript or TypeScript project
- `composer.json` points to a PHP project
- `go.mod` points to a Go project
- `requirements.txt` or `pyproject.toml` points to a Python project
- `Cargo.toml` points to a Rust project
- `pom.xml` or `build.gradle` points to a Java project
- `pubspec.yaml` points to a Flutter project

It also reads configs that are already there. Examples are framework configs, test configs, and CI configs. It reads them to learn, not to change them.

## What discovery does not do

Discovery does not guess architecture from folder names alone. A folder named `services` does not prove a service layer exists. A folder named `api` does not prove a REST API exists.

If Markflow cannot tell something from evidence, it marks it as TBD. It writes the question in the generated docs so a human can confirm it later.

Discovery does not invent decisions. It does not write an ADR for a choice no one made. It only records decisions that have evidence in the repo or in a human answer.

## Greenfield and brownfield

Greenfield means a new or empty repo. There is little to discover. Markflow creates a clean docs skeleton and leaves stack details as TBD until the project picks a stack.

Brownfield means a repo that already has code and configs. Discovery matters most here. Markflow scans the repo, lists what it found, and builds a first draft of the architecture notes from that evidence. A human then reviews the draft and fixes what is wrong.

Both modes use the same method. The only difference is how much context exists at the start.

## Output of discovery

Discovery should produce a short summary. The summary lists the detected stack, the main folders, the test setup when it exists, and the open questions marked as TBD.

That summary goes into the generated docs. It does not go into source code. The user can edit it after init.
