# Example. Bad doc and good doc

Purpose. This file shows one tiny project twice. The bad version invents details. The good version writes only what is known and marks the rest as TBD.
Read when. You write your first PRD and you are not sure what to write.
Do not read when. You already know the Markflow rules. Skip it.

## The project

A to-do list app for a small shop. The owner asked for it. One person uses it. The stack is unknown. The deadline is unknown.

## Bad PRD

> The app serves 500 daily users across three shops. It uses a modern web stack with a fast database. The owner needs real-time sync and an admin dashboard. Launch is in two weeks.

## Good PRD

> The app serves the shop owner. One user for now. The stack is TBD. The owner needs to add, check, and delete tasks. Launch is TBD.

## What changed

- The bad version claims 500 daily users. Nobody said that. The good version writes the one known user.
- The bad version claims three shops. The owner has one shop. The good version does not invent more shops.
- The bad version names a modern web stack and a fast database. The stack is unknown. The good version writes TBD.
- The bad version adds real-time sync and an admin dashboard. Nobody asked for those. The good version lists only what the owner asked for.
- The bad version claims a launch in two weeks. No date was set. The good version writes TBD.

## Rule

Every claim comes from the user, from the code, or is TBD. If you cannot point to the source, write TBD and ask.
