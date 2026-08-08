// Guards on the shape of every workspace package's `exports` map.
//
// Node's exports resolver requires every target to be a "./"-relative path.
// A bare specifier (e.g. "@axis-love/styles/styles.css") throws
// ERR_INVALID_PACKAGE_TARGET the moment a consumer resolves the subpath —
// which never surfaces in-workspace because nothing in the monorepo resolves
// the published subpaths. KWEB-040 shipped exactly that bug on
// @axis-love/kmd-web/styles.css, so both halves are asserted here: the static
// manifest shape, and real Node resolution of every subpath.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "packages");

interface PackageManifest {
  name: string;
  files?: string[];
  dependencies?: Record<string, string>;
  sideEffects?: boolean | string[];
  exports?: Record<string, string | Record<string, string>>;
}

function readManifests(): PackageManifest[] {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES_DIR, entry.name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf-8")) as PackageManifest);
}

/** Flatten an exports map into { subpath, condition, target } triples. */
function exportTargets(pkg: PackageManifest): { subpath: string; target: string }[] {
  const out: { subpath: string; target: string }[] = [];
  for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
    if (typeof value === "string") {
      out.push({ subpath, target: value });
      continue;
    }
    for (const [condition, target] of Object.entries(value)) {
      out.push({ subpath: `${subpath} (${condition})`, target });
    }
  }
  return out;
}

const manifests = readManifests();

describe("package exports maps", () => {
  it("finds every workspace package manifest", () => {
    expect(manifests.length).toBeGreaterThanOrEqual(11);
  });

  it.each(manifests.map((pkg) => [pkg.name, pkg] as const))(
    "%s declares only './'-relative export targets",
    (_name, pkg) => {
      const bare = exportTargets(pkg).filter(({ target }) => !target.startsWith("./"));
      expect(bare).toEqual([]);
    },
  );

  it.each(manifests.map((pkg) => [pkg.name, pkg] as const))(
    "%s export targets all exist on disk",
    (_name, pkg) => {
      const pkgDir = resolve(PACKAGES_DIR, pkg.name.replace("@axis-love/", ""));
      const missing = exportTargets(pkg)
        .map(({ subpath, target }) => ({
          subpath,
          // Wildcard targets ("./fixtures/*") — check the parent directory.
          path: target.includes("*") ? target.replace(/\/\*$/, "") : target,
        }))
        .filter(({ path }) => !existsSync(join(pkgDir, path)));
      expect(missing).toEqual([]);
    },
  );
});

describe("@axis-love/kmd-web/styles.css", () => {
  // createRequire runs Node's real resolver, including PACKAGE_TARGET_RESOLVE.
  // A bare-specifier target throws ERR_INVALID_PACKAGE_TARGET here.
  const require = createRequire(join(ROOT, "package.json"));
  const kmdWeb = manifests.find((pkg) => pkg.name === "@axis-love/kmd-web");

  it("resolves through Node's exports resolver", () => {
    const resolved = require.resolve("@axis-love/kmd-web/styles.css");
    expect(resolved.replace(/\\/g, "/")).toMatch(/packages\/kmd-web\/styles\.css$/);
    expect(readFileSync(resolved, "utf-8").length).toBeGreaterThan(0);
  });

  it("re-exports the stylesheet from @axis-love/styles", () => {
    const css = readFileSync(require.resolve("@axis-love/kmd-web/styles.css"), "utf-8");
    expect(css).toContain('@import "@axis-love/styles/styles.css";');
  });

  it("declares @axis-love/styles as a runtime dependency so the @import resolves", () => {
    expect(kmdWeb?.dependencies?.["@axis-love/styles"]).toBeDefined();
  });

  it("ships styles.css in the published files list", () => {
    expect(kmdWeb?.files).toContain("styles.css");
  });

  it("marks CSS as side-effectful so bundlers do not drop the import", () => {
    expect(kmdWeb?.sideEffects).toEqual(["**/*.css"]);
  });

  it("resolves the @import target through Node's exports resolver too", () => {
    const resolved = require.resolve("@axis-love/styles/styles.css");
    expect(readFileSync(resolved, "utf-8").length).toBeGreaterThan(0);
  });
});
