// Hash helper for change detection.
// It returns a short hash of text.
import { createHash } from "node:crypto";

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
