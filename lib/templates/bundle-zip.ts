import "server-only";
import JSZip from "jszip";

export type BundleReport = {
  entryFile: string;
  inlinedStyles: string[];
  inlinedScripts: string[];
  appendedScripts: string[];
  droppedDataFiles: string[];
  ignoredFiles: string[];
};

export type BundleResult =
  | { ok: true; html: string; blueprint: string; validationScript: string; report: BundleReport }
  | { ok: false; error: BundleError };

export type BundleError =
  | "invalidZip"
  | "tooManyFiles"
  | "noHtmlFile"
  | "multipleHtmlFiles"
  | "noBlueprintFile"
  | "noValidationFile";

const MAX_FILES = 500;
const TEXT_EXT = /\.(html?|css|m?js)$/i;

function normalize(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}

function isLocalRef(href: string): boolean {
  return !!href && !/^([a-z]+:)?\/\//i.test(href) && !href.startsWith("data:") && !href.startsWith("#");
}

function looksLikeNodeScript(content: string): boolean {
  return (
    /^\s*#!/.test(content) ||
    /\brequire\(/.test(content) ||
    /\bprocess\.(argv|exit|env)\b/.test(content) ||
    /\bfs\.readFileSync\b/.test(content)
  );
}

// Templates commonly ship a sample data file (e.g. data/lesson.js defining
// `LESSON_DATA`) so the author can preview the player standalone. The app
// injects the real AI-generated content as `window.LESSON_DATA` itself, so
// bundling the sample would silently overwrite it — drop it instead.
function looksLikeSampleLessonData(content: string): boolean {
  return /^\s*(const|var|let)\s+LESSON_DATA\s*=/m.test(content);
}

export async function bundleTemplateZip(buffer: Buffer): Promise<BundleResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { ok: false, error: "invalidZip" };
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_FILES) return { ok: false, error: "tooManyFiles" };

  const rawPaths = entries
    .map((entry) => normalize(entry.name))
    .filter((path) => !path.startsWith("__MACOSX/") && !path.split("/").some((seg) => seg.startsWith(".")));

  // Zip tools (macOS "Compress", GitHub's "Download ZIP", etc.) often wrap every
  // file in a single top-level folder. Strip it so files that are conceptually at
  // the archive root (blueprint.js, index.html, ...) are still found at "root".
  const rootFolders = new Set(rawPaths.filter((p) => p.includes("/")).map((p) => p.slice(0, p.indexOf("/"))));
  const wrapperPrefix = rootFolders.size === 1 && !rawPaths.some((p) => !p.includes("/")) ? `${[...rootFolders][0]}/` : "";

  const allPaths: string[] = [];
  const files = new Map<string, string>();
  for (const entry of entries) {
    let path = normalize(entry.name);
    if (path.startsWith("__MACOSX/") || path.split("/").some((seg) => seg.startsWith("."))) continue;
    if (wrapperPrefix && path.startsWith(wrapperPrefix)) path = path.slice(wrapperPrefix.length);
    allPaths.push(path);
    if (TEXT_EXT.test(path)) {
      files.set(path, await entry.async("string"));
    }
  }

  const htmlEntries = allPaths.filter((p) => /\.html?$/i.test(p));
  if (htmlEntries.length === 0) return { ok: false, error: "noHtmlFile" };
  const entryFile =
    htmlEntries.find((p) => p.toLowerCase().endsWith("index.html")) ??
    (htmlEntries.length === 1 ? htmlEntries[0] : null);
  if (!entryFile) return { ok: false, error: "multipleHtmlFiles" };

  // blueprint.js/validation.js must be exact, top-level filenames — checked
  // in this order (blueprint first) so a zip missing both reports "noBlueprintFile".
  if (!files.has("blueprint.js")) return { ok: false, error: "noBlueprintFile" };
  if (!files.has("validation.js")) return { ok: false, error: "noValidationFile" };
  const blueprint = files.get("blueprint.js")!;
  const validationScript = files.get("validation.js")!;

  let html = files.get(entryFile)!;
  const handled = new Set<string>([entryFile, "blueprint.js", "validation.js"]);
  const report: BundleReport = {
    entryFile,
    inlinedStyles: [],
    inlinedScripts: [],
    appendedScripts: [],
    droppedDataFiles: [],
    ignoredFiles: [],
  };

  const entryDir = entryFile.includes("/") ? entryFile.slice(0, entryFile.lastIndexOf("/") + 1) : "";
  const resolveRef = (ref: string): string | null => {
    const clean = normalize(ref.split("?")[0].split("#")[0]);
    return [normalize(entryDir + clean), clean].find((candidate) => files.has(candidate)) ?? null;
  };

  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || !isLocalRef(href)) return tag;
    const resolved = resolveRef(href);
    if (!resolved) return tag;
    handled.add(resolved);
    report.inlinedStyles.push(resolved);
    return `<style>\n${files.get(resolved)}\n</style>`;
  });

  html = html.replace(/<script\b([^>]*)\ssrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before, src, after) => {
    if (!isLocalRef(src)) return tag;
    const resolved = resolveRef(src);
    if (!resolved) return tag;
    const content = files.get(resolved)!;
    handled.add(resolved);
    if (looksLikeSampleLessonData(content)) {
      report.droppedDataFiles.push(resolved);
      return "";
    }
    report.inlinedScripts.push(resolved);
    return `<script${before}${after}>\n${content}\n</script>`;
  });

  // Files not wired via a <link>/<script> tag — e.g. lazily-loaded activity
  // modules fetched by JS at runtime. Their loaders check whether the global
  // they define already exists before fetching, so appending them upfront is
  // equivalent and avoids serving them as separate files (which this player
  // has no route for).
  const injections: string[] = [];
  for (const path of [...files.keys()].sort()) {
    if (handled.has(path)) continue;
    const content = files.get(path)!;
    if (/\.css$/i.test(path)) {
      injections.push(`<style>\n${content}\n</style>`);
      report.inlinedStyles.push(path);
    } else if (/\.m?js$/i.test(path)) {
      if (looksLikeNodeScript(content)) {
        report.ignoredFiles.push(path);
      } else if (looksLikeSampleLessonData(content)) {
        report.droppedDataFiles.push(path);
      } else {
        injections.push(`<script>\n${content}\n</script>`);
        report.appendedScripts.push(path);
      }
    }
    handled.add(path);
  }

  for (const path of allPaths) {
    if (!handled.has(path) && path !== entryFile) report.ignoredFiles.push(path);
  }

  const injection = injections.join("\n");
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${injection}\n</body>`) : html + injection;

  return { ok: true, html, blueprint, validationScript, report };
}
