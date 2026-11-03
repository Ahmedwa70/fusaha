import { createHash } from "node:crypto";

import { canonicalizeManifest } from "./manifest";
import type { RuntimePackage } from "./types";

export function getRuntimeIdentity(runtime: RuntimePackage): `sha256-${string}` {
  const hash = createHash("sha256");
  hash.update(canonicalizeManifest(runtime.manifest));
  hash.update("\0");

  for (const path of Object.keys(runtime.files).sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(runtime.files[path]);
    hash.update("\0");
  }

  return `sha256-${hash.digest("hex")}`;
}
