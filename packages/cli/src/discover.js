// Discovery reads manifest files in a repo.
// It returns TBD when it cannot tell the stack.
import { readdir } from "node:fs/promises";
import { basename } from "node:path";

export async function discover(root) {
  const files = await readdir(root);
  const projectName = basename(root);
  if (files.includes("package.json")) {
    return { stack: "TBD", mode: "brownfield", projectName };
  }
  return { stack: "TBD", mode: "greenfield", projectName };
}
