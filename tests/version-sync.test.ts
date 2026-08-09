import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_VERSION_CONSTANTS,
  checkVersions,
  constantProblems,
  lockstepProblems,
  PACKAGE_VERSION_CONSTANTS,
  parseVersionConstants,
} from "../scripts/check-versions.mjs";

const ROOT = process.cwd();

/** Workflows are checked out with CRLF on Windows and LF on CI. */
function readWorkflow(name: string): string {
  return readFileSync(join(ROOT, ".github/workflows", name), "utf-8").replace(/\r\n/g, "\n");
}

describe("workspace version coherence (KWEB-043)", () => {
  it("has one version across every manifest and every VERSION constant", () => {
    const { problems } = checkVersions(ROOT);
    expect(problems).toEqual([]);
  });

  it("checks all 11 workspace packages", () => {
    expect(checkVersions(ROOT).packages).toBe(11);
  });

  it("reports the lockstep version the workspace is on", () => {
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(checkVersions(ROOT).version).toBe(root.version);
  });

  it("registers a version constant for every package directory", () => {
    const dirs = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, "packages", d.name, "package.json")))
      .map((d) => d.name)
      .sort();
    expect(Object.keys(PACKAGE_VERSION_CONSTANTS).sort()).toEqual(dirs);
  });
});

describe("version constant parsing", () => {
  it("finds an exported version constant", () => {
    const found = parseVersionConstants(
      'export const CORE_VERSION = "0.1.0-rc.0";',
      "src/render.ts",
    );
    expect(found).toEqual([{ name: "CORE_VERSION", value: "0.1.0-rc.0", file: "src/render.ts" }]);
  });

  it("finds a bare VERSION export and an annotated one", () => {
    const found = parseVersionConstants(
      ['export const VERSION = "1.2.3";', 'export const TOKENS_VERSION: string = "1.0.0";'].join(
        "\n",
      ),
    );
    expect(found.map((c) => c.name)).toEqual(["VERSION", "TOKENS_VERSION"]);
  });

  it("ignores non-version constants and non-exported ones", () => {
    const found = parseVersionConstants(
      ['export const DEFAULT_THEME = "dark";', 'const INTERNAL_VERSION = "9.9.9";'].join("\n"),
    );
    expect(found).toEqual([]);
  });
});

describe("lockstep detection", () => {
  it("passes when every manifest agrees", () => {
    expect(
      lockstepProblems([
        { label: "@axis-love/core", version: "0.1.0-rc.0" },
        { label: "@axis-love/browser", version: "0.1.0-rc.0" },
      ]),
    ).toEqual([]);
  });

  it("names the outlier, not the majority", () => {
    const problems = lockstepProblems([
      { label: "@axis-love/core", version: "0.1.0-rc.0" },
      { label: "@axis-love/browser", version: "0.1.0-rc.0" },
      { label: "@axis-love/react", version: "0.2.0" },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("@axis-love/react");
    expect(problems[0]).toContain('expected "0.1.0-rc.0"');
  });

  it("fails an empty workspace", () => {
    expect(lockstepProblems([])).toHaveLength(1);
  });
});

describe("constant/manifest drift detection", () => {
  const core = {
    dirName: "core",
    name: "@axis-love/core",
    version: "0.1.0-rc.0",
    constants: [{ name: "CORE_VERSION", value: "0.1.0-rc.0", file: "packages/core/src/render.ts" }],
  };

  it("passes a package whose constant matches its manifest", () => {
    expect(constantProblems(core)).toEqual([]);
  });

  it("fails the pre-KWEB-043 state: manifest on the RC, constant left behind", () => {
    const problems = constantProblems({
      ...core,
      constants: [{ name: "CORE_VERSION", value: "0.1.0", file: "packages/core/src/render.ts" }],
    });
    expect(problems.join("\n")).toContain('CORE_VERSION is "0.1.0"');
    expect(problems.join("\n")).toContain('package.json says "0.1.0-rc.0"');
  });

  it("fails when the package exports no version constant at all", () => {
    const problems = constantProblems({ ...core, constants: [] });
    expect(problems.join("\n")).toContain("exports no CORE_VERSION constant");
  });

  it("fails an unregistered version constant so new drift cannot hide", () => {
    const problems = constantProblems({
      ...core,
      constants: [...core.constants, { name: "PIPELINE_VERSION", value: "2.0.0", file: "x.ts" }],
    });
    expect(problems.join("\n")).toContain("unregistered version constant PIPELINE_VERSION");
  });

  it("allows artifact schema versions that version independently", () => {
    expect(ARTIFACT_VERSION_CONSTANTS.styles).toContain("TOKENS_VERSION");
    const problems = constantProblems({
      dirName: "styles",
      name: "@axis-love/styles",
      version: "0.1.0-rc.0",
      constants: [
        { name: "STYLES_VERSION", value: "0.1.0-rc.0", file: "packages/styles/src/index.ts" },
        { name: "TOKENS_VERSION", value: "1.0.0", file: "packages/styles/src/index.ts" },
      ],
    });
    expect(problems).toEqual([]);
  });

  it("fails a package directory that was never registered", () => {
    const problems = constantProblems({
      dirName: "brand-new",
      name: "@axis-love/brand-new",
      version: "0.1.0-rc.0",
      constants: [],
    });
    expect(problems.join("\n")).toContain("no version constant registered");
  });
});

describe("CI wiring", () => {
  it("runs the version check in CI", () => {
    expect(readWorkflow("ci.yml")).toContain("node scripts/check-versions.mjs");
  });

  it("runs the version check before a release is verified", () => {
    expect(readWorkflow("release.yml")).toContain("node scripts/check-versions.mjs");
  });

  it("runs the version check as part of npm run verify", () => {
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(root.scripts.verify).toContain("check:versions");
    expect(root.scripts["check:versions"]).toBe("node scripts/check-versions.mjs");
  });
});
