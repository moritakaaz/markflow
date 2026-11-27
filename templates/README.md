# Templates

This folder holds the files that Markflow copies into a user project during init. Read it when you change what init creates.

## Layout

The `base` folder is the default template. It works for any stack. It does not assume a framework. It does not create source code.

Placeholders use double braces. Examples are project name and detected stack. The CLI replaces them during init. Do not hardcode a real project name in a template.

## Rules for templates

Keep templates short. Keep sentences short. Use English only. Avoid em dashes. Avoid colons in prose. Avoid formal and cliché words.

Every template starts with a short note on purpose and when to read it. That note helps humans and AI agents pick the right file fast.

Do not add stack specific code here. Stack details come from project discovery, not from a template.
