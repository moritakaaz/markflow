// Discovery reads manifest files in a repo.
// It returns TBD when it cannot tell the stack.
import { readdir } from "node:fs/promises";

export async function discover(root) {
  const files = await readdir(root);
  if (files.includes("package.json")) {
    return { stack: "TBD", mode: "brownfield" };
  }
  return { stack: "TBD", mode: "greenfield" };
}
