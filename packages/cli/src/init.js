// Init copies the base templates into a repo.
// It is non-interactive by default.
import { discover } from "./discover.js";

export async function runInit(args) {
  const context = await discover(process.cwd());
  console.log("Detected stack is " + context.stack);
  return context;
}
