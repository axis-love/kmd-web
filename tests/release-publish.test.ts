import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUGS_URL,
  discoverPackages,
  distTagFor,
  expectedTarballName,
  HOMEPAGE_PREFIX,
  npmPublishArgs,
  parseDryRunReport,
  REPOSITORY_URL,
  verifyDryRunReport,
  verifyProvenanceMetadata,
} from "../scripts/publish-packages.mjs";

const ROOT = process.cwd();

/** Workflows are checked out with CRLF on Windows and LF on CI. */
function readWorkflow(name: string): string {
  return readFileSync(join(ROOT, ".github/workflows", name), "utf-8").replace(/\r\n/g, "\n");
}

const releaseWorkflow = readWorkflow("release.yml");
const ciWorkflow = readWorkflow("ci.yml");

/** A package whose publish would ship its own contents. */
const CORE = {
  dir: join(ROOT, "packages/core"),
  name: "@axis-love/core",
  version: "0.1.0-rc.0",
  private: false,
  files: ["dist"],
  repository: { type: "git", url: REPOSITORY_URL, directory: "packages/core" },
  bugs: { url: BUGS_URL },
  homepage: `${HOMEPAGE_PREFIX}core#readme`,
};

describe("publish package discovery", () => {
  it("finds all 11 workspace packages", () => {
    const packages = discoverPackages();
    expect(packages).toHaveLength(11);
    expect(packages.map((p) => p.name)).toContain("@axis-love/core");
  });

  it("reports every package's own directory, name and version", () => {
    for (const pkg of discoverPackages()) {
      const manifest = JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf-8"));
      expect(pkg.name).toBe(manifest.name);
      expect(pkg.version).toBe(manifest.version);
      expect(pkg.private).toBe(manifest.private === true);
    }
  });
});

describe("dist-tag selection", () => {
  it("publishes prereleases under their prerelease identifier", () => {
    expect(distTagFor("0.1.0-rc.0")).toBe("rc");
    expect(distTagFor("1.0.0-beta.12")).toBe("beta");
  });

  it("publishes stable versions under latest", () => {
    expect(distTagFor("0.1.0")).toBe("latest");
    expect(distTagFor("1.2.3")).toBe("latest");
  });
});

describe("npm publish arguments", () => {
  it("uses --provenance for a real publish and never --dry-run", () => {
    const args = npmPublishArgs(false, "latest");
    expect(args).toContain("--provenance");
    expect(args).toContain("--access");
    expect(args).toContain("public");
    expect(args).not.toContain("--dry-run");
  });

  it("uses --dry-run --json and drops --provenance for the verification run", () => {
    const args = npmPublishArgs(true, "rc");
    expect(args).toContain("--dry-run");
    expect(args).toContain("--json");
    // Provenance needs the release job's OIDC token; a dry-run has none.
    expect(args).not.toContain("--provenance");
  });
});

describe("dry-run report parsing", () => {
  it("accepts the name-keyed shape (npm 10/11)", () => {
    const report = parseDryRunReport(
      JSON.stringify({ "@axis-love/core": { name: "@axis-love/core", version: "0.1.0-rc.0" } }),
    );
    expect(report?.name).toBe("@axis-love/core");
  });

  it("accepts a flat report object", () => {
    const report = parseDryRunReport(
      JSON.stringify({ name: "@axis-love/core", version: "0.1.0-rc.0" }),
    );
    expect(report?.name).toBe("@axis-love/core");
  });

  it("ignores npm notice lines printed around the JSON", () => {
    const report = parseDryRunReport(
      `npm notice Publishing to https://registry.npmjs.org/\n${JSON.stringify({
        "@axis-love/core": { name: "@axis-love/core", version: "0.1.0-rc.0" },
      })}\n`,
    );
    expect(report?.name).toBe("@axis-love/core");
  });

  it("returns null for unparsable output", () => {
    expect(parseDryRunReport("npm error something went wrong")).toBeNull();
  });
});

describe("dry-run verification", () => {
  it("passes a report that matches the package it was run for", () => {
    const problems = verifyDryRunReport(CORE, {
      name: "@axis-love/core",
      version: "0.1.0-rc.0",
      filename: expectedTarballName("@axis-love/core", "0.1.0-rc.0"),
      files: [{ path: "package.json" }, { path: "dist/index.js" }],
    });
    expect(problems).toEqual([]);
  });

  it("fails when npm packed the repo root instead of the package (KWEB-041)", () => {
    // What `npm publish` reports when the release loop forgets to cd into the
    // package directory: the private root manifest, not the package.
    const problems = verifyDryRunReport(CORE, {
      name: "kmd-web-monorepo",
      version: "0.1.0-rc.0",
      filename: "kmd-web-monorepo-0.1.0-rc.0.tgz",
      files: [{ path: "package.json" }, { path: "packages/core/dist/index.js" }],
    });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("kmd-web-monorepo");
    expect(problems.join("\n")).toContain("did not run from @axis-love/core's directory");
  });

  it("fails when the tarball omits a declared files entry", () => {
    const problems = verifyDryRunReport(CORE, {
      name: "@axis-love/core",
      version: "0.1.0-rc.0",
      filename: expectedTarballName("@axis-love/core", "0.1.0-rc.0"),
      files: [{ path: "package.json" }],
    });
    expect(problems.join("\n")).toContain('missing "files" entry "dist"');
  });

  it("fails when npm produced no report at all", () => {
    expect(verifyDryRunReport(CORE, null)).toHaveLength(1);
  });
});

describe("provenance metadata", () => {
  it("every publishable package declares repository, bugs and homepage (KWEB-042)", () => {
    const publishable = discoverPackages().filter((p) => !p.private);
    expect(publishable).toHaveLength(11);
    for (const pkg of publishable) {
      expect(verifyProvenanceMetadata(pkg), `${pkg.name} metadata`).toEqual([]);
    }
  });

  it("points every repository field at the kmd-web repo and the package's own directory", () => {
    for (const pkg of discoverPackages().filter((p) => !p.private)) {
      const manifest = JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf-8"));
      expect(manifest.repository).toEqual({
        type: "git",
        url: "git+https://github.com/axis-love/kmd-web.git",
        directory: `packages/${basename(pkg.dir)}`,
      });
      expect(manifest.bugs).toEqual({ url: "https://github.com/axis-love/kmd-web/issues" });
      expect(manifest.homepage).toBe(
        `https://github.com/axis-love/kmd-web/tree/main/packages/${basename(pkg.dir)}#readme`,
      );
    }
  });

  it("accepts a manifest carrying the canonical metadata", () => {
    expect(verifyProvenanceMetadata(CORE)).toEqual([]);
  });

  it("fails when a publishable package has no repository field", () => {
    // The pre-KWEB-042 state of every manifest: npm publish --provenance has
    // nothing to attest the tarball against.
    const problems = verifyProvenanceMetadata({ ...CORE, repository: undefined });
    expect(problems.join("\n")).toContain('no "repository" field');
  });

  it("rejects the string shorthand, which carries no monorepo directory", () => {
    const problems = verifyProvenanceMetadata({
      ...CORE,
      repository: "github:axis-love/kmd-web",
    });
    expect(problems.join("\n")).toContain("must be an object");
  });

  it("fails when the repository points at a different repo", () => {
    const problems = verifyProvenanceMetadata({
      ...CORE,
      repository: {
        type: "git",
        url: "git+https://github.com/axis-love/kmd.git",
        directory: "packages/core",
      },
    });
    expect(problems.join("\n")).toContain('"repository.url"');
  });

  it("fails when the repository directory points at another package", () => {
    const problems = verifyProvenanceMetadata({
      ...CORE,
      repository: { type: "git", url: REPOSITORY_URL, directory: "packages/react" },
    });
    expect(problems.join("\n")).toContain('"repository.directory"');
  });

  it("fails when bugs or homepage are missing", () => {
    const problems = verifyProvenanceMetadata({ ...CORE, bugs: undefined, homepage: undefined });
    expect(problems.join("\n")).toContain('"bugs.url"');
    expect(problems.join("\n")).toContain('"homepage"');
  });
});

describe("release workflow", () => {
  it("publishes through the per-package script, not a root-cwd loop", () => {
    expect(releaseWorkflow).toContain("run: node scripts/publish-packages.mjs\n");
    expect(releaseWorkflow).not.toMatch(/^\s+npm publish/m);
  });

  it("keeps the publish job gated on verify and dry-run", () => {
    expect(releaseWorkflow).toContain("needs: [verify, dry-run]");
  });

  it("runs the publish dry-run before releasing", () => {
    expect(releaseWorkflow).toContain("node scripts/publish-packages.mjs --dry-run");
  });
});

describe("CI workflow", () => {
  it("runs the publish step in dry-run mode", () => {
    expect(ciWorkflow).toContain("node scripts/publish-packages.mjs --dry-run");
  });
});
