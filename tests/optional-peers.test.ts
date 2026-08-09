// @axis-love/browser's optional feature peers (KWEB-045).
//
// The browser runtime reaches for @axis-love/highlighting, @axis-love/math and
// @axis-love/mermaid through dynamic import only, and shrugs when they are not
// installed. That shrug is the whole problem: before KWEB-045 the three were
// declared as devDependencies and nowhere else, so an external consumer got no
// npm-level signal at all — the features were silently dead unless the consumer
// happened to guess which packages to add.
//
// Optional peerDependencies are the signal. These tests hold both halves in
// place: the manifest advertises the peers, and the code keeps loading them
// lazily so a consumer who skips them still gets a working reader.
//
// The end-to-end consumer proof — install the tarballs with the peers, then
// without them — lives in scripts/dry-run-release.mjs (Step 5), which installs
// from real tarballs instead of workspace links.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();
const BROWSER_DIR = join(ROOT, "packages", "browser");

const FEATURE_PACKAGES = [
  "@axis-love/highlighting",
  "@axis-love/math",
  "@axis-love/mermaid",
] as const;

interface Manifest {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const browser = JSON.parse(readFileSync(join(BROWSER_DIR, "package.json"), "utf-8")) as Manifest;

/** Every non-test source file under packages/browser/src. */
function browserSources(): { file: string; content: string }[] {
  const dir = join(BROWSER_DIR, "src");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({ file: name, content: readFileSync(join(dir, name), "utf-8") }));
}

// ---------------------------------------------------------------------------
// Manifest declaration
// ---------------------------------------------------------------------------

describe("@axis-love/browser declares its lazy features as optional peers", () => {
  it.each(FEATURE_PACKAGES)("declares %s as a peer dependency", (name) => {
    expect(browser.peerDependencies?.[name]).toBeDefined();
  });

  it.each(FEATURE_PACKAGES)("pins %s to the package's own version", (name) => {
    expect(browser.peerDependencies?.[name]).toBe(browser.version);
  });

  it.each(FEATURE_PACKAGES)("marks %s optional so npm never fails an install", (name) => {
    expect(browser.peerDependenciesMeta?.[name]?.optional).toBe(true);
  });

  it("keeps the feature packages out of dependencies — they must stay opt-in", () => {
    for (const name of FEATURE_PACKAGES) {
      expect(browser.dependencies?.[name]).toBeUndefined();
    }
  });

  it("declares no optional peer it does not also list in peerDependencies", () => {
    const meta = Object.keys(browser.peerDependenciesMeta ?? {});
    const peers = Object.keys(browser.peerDependencies ?? {});
    expect(meta.filter((name) => !peers.includes(name))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Every lazy import is declared
// ---------------------------------------------------------------------------

describe("every workspace package the browser lazily imports is declared", () => {
  /** Scoped specifiers reached through `import("...")` anywhere in browser/src. */
  const dynamicallyImported = new Set<string>();
  for (const { content } of browserSources()) {
    for (const match of content.matchAll(/\bimport\(\s*["'](@axis-love\/[^"']+)["']\s*\)/g)) {
      const specifier = match[1];
      if (specifier) dynamicallyImported.add(specifier);
    }
  }

  it("finds all three feature packages in the sources", () => {
    // Other scoped specifiers show up here too — `import("@axis-love/contracts").X`
    // is a type-position import — so this asserts coverage, not equality.
    expect([...dynamicallyImported].sort()).toEqual(expect.arrayContaining([...FEATURE_PACKAGES]));
  });

  it("declares every dynamically imported package as a peer or a dependency", () => {
    const declared = new Set([
      ...Object.keys(browser.peerDependencies ?? {}),
      ...Object.keys(browser.dependencies ?? {}),
    ]);
    const undeclared = [...dynamicallyImported].filter((name) => !declared.has(name));
    expect(undeclared).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lazy, not static
// ---------------------------------------------------------------------------

describe("the browser dist reaches the feature packages lazily only", () => {
  const distDir = join(BROWSER_DIR, "dist");

  it("dist exists", () => {
    expect(existsSync(distDir)).toBe(true);
  });

  it.each(FEATURE_PACKAGES)("never statically imports %s", (name) => {
    const files = readdirSync(distDir).filter((f) => f.endsWith(".js"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(join(distDir, file), "utf-8");
      // A static `from "@axis-love/math"` would make the peer mandatory at
      // module-evaluation time — a missing optional peer would then be a hard
      // load failure instead of a skipped feature.
      expect(content).not.toMatch(new RegExp(`from\\s*["']${name}["']`));
    }
  });

  it.each(FEATURE_PACKAGES)("keeps %s behind a dynamic import in the sources", (name) => {
    for (const { file, content } of browserSources()) {
      if (!content.includes(name)) continue;
      const statik = new RegExp(`^\\s*import[^\\n]*from\\s*["']${name}["']`, "m");
      expect(statik.test(content), `${file} statically imports ${name}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Behavior with the peers installed
// ---------------------------------------------------------------------------

describe("features activate when the optional peers are installed", () => {
  it("injects the KaTeX and Shiki rehype plugins", async () => {
    const { loadFeatureRehypePlugins } = await import("@axis-love/browser");
    const { plugins } = await loadFeatureRehypePlugins();
    expect(plugins).toHaveLength(2);
  });

  it("renders math and highlights code through the injected plugins", async () => {
    const { renderWithFeaturePlugins } = await import("@axis-love/browser");
    const result = await renderWithFeaturePlugins(
      ["$E = mc^2$", "", "```ts", "const x: number = 1;", "```"].join("\n"),
    );
    expect(result.html).toContain("katex");
    expect(result.html).toContain("shiki-code-block");
    expect(result.codeHighlightCss).toBeTruthy();
  });

  it("skips a feature the caller turned off, without touching its package", async () => {
    const { loadFeatureRehypePlugins } = await import("@axis-love/browser");
    const { plugins } = await loadFeatureRehypePlugins({
      features: { math: false, codeHighlighting: false },
    });
    expect(plugins).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Behavior with the peers absent
// ---------------------------------------------------------------------------

describe("the reader degrades gracefully when the optional peers are absent", () => {
  /** What Node throws when a package is simply not installed. */
  function notInstalled(name: string): never {
    const error = new Error(`Cannot find package '${name}'`) as Error & { code: string };
    error.code = "ERR_MODULE_NOT_FOUND";
    throw error;
  }

  afterEach(() => {
    vi.doUnmock("@axis-love/math");
    vi.doUnmock("@axis-love/highlighting");
    vi.resetModules();
  });

  async function withoutPeers() {
    vi.resetModules();
    vi.doMock("@axis-love/math", () => notInstalled("@axis-love/math"));
    vi.doMock("@axis-love/highlighting", () => notInstalled("@axis-love/highlighting"));
    return import("@axis-love/browser");
  }

  it("injects no plugins at all", async () => {
    const { loadFeatureRehypePlugins } = await withoutPeers();
    const { plugins } = await loadFeatureRehypePlugins();
    expect(plugins).toEqual([]);
  });

  it("still renders the document, with math and code left as plain text", async () => {
    const { renderWithFeaturePlugins } = await withoutPeers();
    const result = await renderWithFeaturePlugins(
      ["# Title", "", "$E = mc^2$", "", "```ts", "const x: number = 1;", "```"].join("\n"),
    );
    expect(result.html).toContain("Title");
    expect(result.html).toContain("const x: number = 1;");
    expect(result.html).not.toContain("katex");
    expect(result.html).not.toContain("shiki-code-block");
    expect(result.codeHighlightCss).toBeUndefined();
  });

  it("reports no diagnostics — a missing optional peer is not an error", async () => {
    const { renderWithFeaturePlugins } = await withoutPeers();
    const result = await renderWithFeaturePlugins("$E = mc^2$");
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The real proof runs against tarballs
// ---------------------------------------------------------------------------

describe("the release dry-run installs a consumer without the peers", () => {
  // Everything above runs against workspace links, where the feature packages
  // are always on disk. Only a tarball install can show that npm accepts
  // @axis-love/browser with the peers genuinely absent.
  const script = readFileSync(join(ROOT, "scripts", "dry-run-release.mjs"), "utf-8");

  it("keeps the no-peers consumer step", () => {
    expect(script).toContain("Step 5: Consumer without the optional feature peers");
  });

  it("installs the browser package without any feature package", () => {
    expect(script).toContain("kmd-no-peers-");
    expect(script).toContain("this consumer is supposed to be without it");
  });

  it("checks the root entry is renderable against a real install", () => {
    expect(script).toContain('"render", "renderWithFeaturePlugins", "BrowserReader"');
  });
});
