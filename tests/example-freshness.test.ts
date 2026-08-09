import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPackages } from "../scripts/publish-packages.mjs";
import {
  findStaleInstalls,
  integrityFor,
  TARBALL_EXAMPLES,
  tarballNameFor,
} from "../scripts/refresh-examples.mjs";

const ROOT = process.cwd();

const STYLES_TGZ = "axis-love-styles-0.1.0-rc.1.tgz";

function lockfileWith(entries: Record<string, { resolved?: string; integrity?: string }>) {
  return { lockfileVersion: 3, packages: entries };
}

describe("tarballNameFor", () => {
  it("derives npm's tarball filename from a scoped name", () => {
    expect(tarballNameFor("@axis-love/styles", "0.1.0-rc.1")).toBe(STYLES_TGZ);
  });
});

describe("integrityFor", () => {
  it("produces npm's sha512 lockfile integrity format", () => {
    const contents = Buffer.from("tarball bytes");
    const expected = `sha512-${createHash("sha512").update(contents).digest("base64")}`;
    expect(integrityFor(contents)).toBe(expected);
  });
});

describe("findStaleInstalls", () => {
  const current = new Map([[STYLES_TGZ, "sha512-CURRENT"]]);

  it("passes when the lockfile integrity matches the current tarball", () => {
    const lockfile = lockfileWith({
      "node_modules/@axis-love/styles": {
        resolved: `file:../../.tarballs/${STYLES_TGZ}`,
        integrity: "sha512-CURRENT",
      },
    });
    expect(findStaleInstalls(lockfile, current)).toEqual([]);
  });

  it("flags an install whose integrity no longer matches the tarball", () => {
    const lockfile = lockfileWith({
      "node_modules/@axis-love/styles": {
        resolved: `file:../../.tarballs/${STYLES_TGZ}`,
        integrity: "sha512-OLD",
      },
    });
    const problems = findStaleInstalls(lockfile, current);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("older");
  });

  it("flags a lockfile entry pointing at a tarball that no longer exists", () => {
    const lockfile = lockfileWith({
      "node_modules/@axis-love/styles": {
        resolved: "file:../../.tarballs/axis-love-styles-0.0.9.tgz",
        integrity: "sha512-OLD",
      },
    });
    const problems = findStaleInstalls(lockfile, current);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not in .tarballs/");
  });

  it("fails when the lockfile has no tarball dependencies at all", () => {
    const lockfile = lockfileWith({
      "node_modules/react": { resolved: "https://registry.npmjs.org/react/-/react-19.0.0.tgz" },
    });
    const problems = findStaleInstalls(lockfile, current);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("nothing to verify");
  });

  it("ignores registry-resolved dependencies", () => {
    const lockfile = lockfileWith({
      "node_modules/@axis-love/styles": {
        resolved: `file:../../.tarballs/${STYLES_TGZ}`,
        integrity: "sha512-CURRENT",
      },
      "node_modules/react": { resolved: "https://registry.npmjs.org/react/-/react-19.0.0.tgz" },
    });
    expect(findStaleInstalls(lockfile, current)).toEqual([]);
  });
});

describe("the real example installs", () => {
  it("every tarball example directory exists and pins file: tarball deps", () => {
    for (const example of TARBALL_EXAMPLES) {
      const manifestPath = join(ROOT, example, "package.json");
      expect(existsSync(manifestPath), `${example}/package.json`).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const fileDeps = Object.values(manifest.dependencies ?? {}).filter(
        (v) => typeof v === "string" && v.startsWith("file:"),
      );
      expect(fileDeps.length, `${example} should pin file: tarballs`).toBeGreaterThan(0);
    }
  });

  it("installed examples match the current tarballs (run refresh:examples if this fails)", () => {
    const tarballIntegrity = new Map<string, string>();
    for (const pkg of discoverPackages().filter((p: { private: boolean }) => !p.private)) {
      const filename = tarballNameFor(pkg.name, pkg.version);
      const tarballPath = join(ROOT, ".tarballs", filename);
      if (existsSync(tarballPath)) {
        tarballIntegrity.set(filename, integrityFor(readFileSync(tarballPath)));
      }
    }

    for (const example of TARBALL_EXAMPLES) {
      const lockPath = join(ROOT, example, "package-lock.json");
      const modulesPath = join(ROOT, example, "node_modules");
      // Not installed (e.g. fresh CI checkout) — nothing to go stale.
      if (!existsSync(lockPath) || !existsSync(modulesPath)) continue;
      const lockfile = JSON.parse(readFileSync(lockPath, "utf-8"));
      expect(findStaleInstalls(lockfile, tarballIntegrity)).toEqual([]);
    }
  });
});
