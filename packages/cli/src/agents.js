// Agent adapters map an agent name to its instruction files.
// AGENTS.md is created for every agent, so it is not listed here.
// Each entry lists the extra files the agent needs.
// A file entry can add frontmatter for formats that need it.
export const AGENTS = {
  generic: [],
  codex: [],
  claude: [{ path: "CLAUDE.md" }],
  cursor: [
    {
      path: ".cursor/rules/markflow.mdc",
      frontmatter:
        "---\ndescription: Markflow project instructions\nglobs:\nalwaysApply: true\n---\n",
    },
  ],
  copilot: [{ path: ".github/copilot-instructions.md" }],
};
