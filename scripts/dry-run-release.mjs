#!/usr/bin/env node
/**
 * Dry-run release verification:
 * 1. npm pack each publishable package into tarballs
 * 2. Verify tarball file lists match package.json "files" field
 * 3. Create a fresh vanilla consumer project, install tarballs, build
 * 4. Create a fresh React consumer project, install tarballs, build
 * 5. Install @axis-love/browser without its optional feature peers and confirm
 *    the reader still renders (KWEB-045)
 *
 * No workspace resolution — tarballs are installed as real dependencies.
 *
 * Exit code 0 = all checks pass, 1 = one or more failures.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { basename, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = join(root, "packages");

let failures = 0;

/**
 * @param {string} dir
 * @param {Record<string, unknown>} pkg
 * @returns {string[]} tarball expected file list (relative paths inside tarball)
 */
function expectedTarballFiles(pkg) {
  const files = /** @type {string[]} */ (pkg.files ?? []);
  // npm pack always includes package.json, README.md (if exists), LICENSE (if exists)
  const result = ["package.json"];
  if (files.includes("dist")) result.push("dist/");
  if (files.includes("fixtures")) result.push("fixtures/");
  if (files.includes("observations")) result.push("observations/");
  if (files.includes("manifest.json")) result.push("manifest.json");
  // styles has src CSS + generated files
  for (const f of files) {
    if (f === "dist" || f === "fixtures" || f === "observations" || f === "manifest.json") continue;
    result.push(f);
  }
  return result;
}

/**
 * @param {string} pkgDir
 * @returns {Record<string, unknown>}
 */
function readPkg(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
}

// --- Step 1: npm pack each publishable package ---

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(packagesDir, d.name, "package.json")))
  .map((d) => d.name)
  .sort();

console.log("Step 1: npm pack each publishable package\n");

/** @type {{ name: string, dir: string, tarball: string }[]} */
const tarballs = [];

for (const pkgName of packages) {
  const pkgDir = join(packagesDir, pkgName);
  const pkg = readPkg(pkgDir);
  console.log(`  Packing ${pkg.name}...`);

  // npm pack outputs a .tgz file in the tarballs directory
  const tarballDir = join(root, ".tarballs");
  mkdirSync(tarballDir, { recursive: true });
  const output = execSync(`npm pack --pack-destination "${tarballDir}" 2>&1`, {
    cwd: pkgDir,
    encoding: "utf-8",
  });
  const tarballName = output.trim().split("\n").pop()?.trim() ?? "";
  const tarballPath = join(tarballDir, tarballName);
  if (!existsSync(tarballPath)) {
    console.error(`  FAIL  ${pkg.name}: tarball not created at ${tarballPath}`);
    failures++;
    continue;
  }
  tarballs.push({ name: pkg.name, dir: pkgDir, tarball: tarballPath });
}

console.log("");

// --- Step 2: Verify tarball file lists ---

console.log("Step 2: Verify tarball file lists\n");

for (const { name, dir, tarball } of tarballs) {
  const pkg = readPkg(dir);
  const files = /** @type {string[]} */ (pkg.files ?? []);
  const expected = expectedTarballFiles(pkg);

  // List tarball contents. Pass the bare filename from the tarball directory:
  // GNU tar reads a Windows absolute path's drive letter as a remote host
  // ("D:\... " → "Cannot connect to D") and aborts the whole run.
  const listing = execSync(`tar tzf "${basename(tarball)}"`, {
    cwd: join(root, ".tarballs"),
    encoding: "utf-8",
  });
  const tarballFiles = listing.trim().split("\n").map((f) => f.replace(/^package\//, ""));

  // Check that every expected file/dir is in the tarball
  for (const exp of expected) {
    if (exp.endsWith("/")) {
      // Directory — at least one file should start with this prefix
      const prefix = exp;
      const found = tarballFiles.some((f) => f.startsWith(prefix));
      if (!found) {
        console.error(`  FAIL  ${name}: tarball missing directory "${exp}"`);
        failures++;
      }
    } else {
      if (!tarballFiles.includes(exp)) {
        console.error(`  FAIL  ${name}: tarball missing file "${exp}"`);
        failures++;
      }
    }
  }

  console.log(`  ${name}: ${tarballFiles.length} files in tarball`);
}

console.log("");

// --- Step 3: Fresh vanilla consumer ---

console.log("Step 3: Fresh vanilla consumer build\n");

const consumerDir = mkdtempSync(join(tmpdir(), "kmd-consumer-"));
try {
  // Create a consumer package.json that installs all tarballs
  const deps = {};
  for (const { name, tarball } of tarballs) {
    deps[name] = `file:${tarball}`;
  }

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "kmd-vanilla-consumer",
        private: true,
        type: "module",
        dependencies: deps,
      },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(
    join(consumerDir, "consumer.mjs"),
    `// Vanilla consumer — verify each package's tarball installed correctly.
// Checks that dist files and package.json exist in node_modules.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function checkPackage(name, expectedExports) {
  const pkgPath = join("node_modules", name, "package.json");
  if (!existsSync(pkgPath)) throw new Error(name + ": package.json not found");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const exp = pkg.exports?.["."];
  if (!exp) throw new Error(name + ": no '.' export");
  const distIndex = join("node_modules", name, exp.import);
  if (!existsSync(distIndex)) throw new Error(name + ": dist entry not found at " + distIndex);
  const dtsPath = join("node_modules", name, exp.types);
  if (!existsSync(dtsPath)) throw new Error(name + ": types entry not found at " + dtsPath);
  const content = readFileSync(distIndex, "utf-8");
  if (content.length === 0) throw new Error(name + ": dist/index.js is empty");
  console.log(name + ": OK (" + content.length + " bytes, " + expectedExports + ")");
}

checkPackage("@axis-love/contracts", "types + runner + fixtures");
checkPackage("@axis-love/core", "renderMarkdown");
checkPackage("@axis-love/browser", "BrowserReader");
checkPackage("@axis-love/kmd-web", "convenience re-exports");
checkPackage("@axis-love/highlighting", "highlightCode");
checkPackage("@axis-love/mermaid", "renderMermaid");
checkPackage("@axis-love/math", "renderMath");
checkPackage("@axis-love/design", "extractDesignDoc");
checkPackage("@axis-love/element", "KmdReader");
checkPackage("@axis-love/styles", "CSS + tokens");
checkPackage("@axis-love/react", "MarkdownReader");

// Subpath exports must resolve through Node's real resolver. A bare-specifier
// target throws ERR_INVALID_PACKAGE_TARGET here even though the file exists
// somewhere in node_modules (KWEB-040).
function checkSubpath(specifier) {
  let resolved;
  try {
    resolved = import.meta.resolve(specifier);
  } catch (e) {
    throw new Error(specifier + ": resolution failed (" + (e.code ?? e.message) + ")");
  }
  const path = fileURLToPath(resolved);
  if (!existsSync(path)) throw new Error(specifier + ": resolved to missing file " + path);
  if (readFileSync(path, "utf-8").length === 0) throw new Error(specifier + ": resolved file is empty");
  console.log(specifier + ": resolves OK");
}

checkSubpath("@axis-love/kmd-web/styles.css");
checkSubpath("@axis-love/kmd-web/react");
checkSubpath("@axis-love/kmd-web/element");
checkSubpath("@axis-love/styles/styles.css");
checkSubpath("@axis-love/styles/tokens.css");

// The root entry has to be renderable (KWEB-045). examples/vanilla/main.js
// imports a render function straight off the bare specifier; before KWEB-045
// the root exported types and version constants only, so that import resolved
// to undefined against a real install and the example could not run.
const root = await import("@axis-love/kmd-web");
for (const name of ["render", "renderWithFeaturePlugins", "BrowserReader"]) {
  if (typeof root[name] !== "function") {
    throw new Error("@axis-love/kmd-web: root entry does not export " + name);
  }
}
console.log("@axis-love/kmd-web: root entry exports render, renderWithFeaturePlugins, BrowserReader");

// The framework surfaces must stay on their subpaths.
for (const name of ["MarkdownReader", "KmdReaderElement"]) {
  if (root[name] !== undefined) {
    throw new Error("@axis-love/kmd-web: root entry leaked " + name + " — keep it on its subpath");
  }
}

// Every optional peer is installed here, so the features must actually engage.
const withFeatures = await root.renderWithFeaturePlugins(
  "# Title\\n\\n$E = mc^2$\\n\\n\`\`\`ts\\nconst x: number = 1;\\n\`\`\`\\n",
);
if (!withFeatures.html.includes("Title")) throw new Error("root render produced no document");
if (!withFeatures.html.includes("katex")) {
  throw new Error("@axis-love/math is installed but math was not rendered");
}
if (!withFeatures.html.includes("shiki-code-block")) {
  throw new Error("@axis-love/highlighting is installed but code was not highlighted");
}
console.log("@axis-love/kmd-web: optional peers installed → math and highlighting both active");

console.log("All packages resolved successfully");
`,
  );

  console.log(`  Consumer dir: ${consumerDir}`);

  // Install — use --no-save to avoid workspace resolution
  console.log("  Installing tarballs...");
  try {
    const installOut = execSync("npm install --no-audit --no-fund 2>&1", {
      cwd: consumerDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log(`  Install OK`);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  npm install failed`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }

  // Run the consumer
  console.log("  Running consumer...");
  try {
    const out = execSync("node consumer.mjs 2>&1", {
      cwd: consumerDir,
      encoding: "utf-8",
    });
    console.log(`  Output:\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  consumer run failed`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }
} finally {
  rmSync(consumerDir, { recursive: true, force: true });
}

console.log("");

// --- Step 4: Fresh React consumer ---

console.log("Step 4: Fresh React consumer build\n");

const reactDir = mkdtempSync(join(tmpdir(), "kmd-react-consumer-"));
try {
  const deps = {
    react: "^19.0.0",
    "react-dom": "^19.0.0",
  };
  for (const { name, tarball } of tarballs) {
    deps[name] = `file:${tarball}`;
  }

  writeFileSync(
    join(reactDir, "package.json"),
    JSON.stringify(
      {
        name: "kmd-react-consumer",
        private: true,
        type: "module",
        dependencies: deps,
      },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(
    join(reactDir, "consumer.mjs"),
    `// React consumer — verify React components are available in the tarball.
// Checks file existence in node_modules (no runtime imports needed).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readPkg(name) {
  const pkgPath = join("node_modules", name, "package.json");
  if (!existsSync(pkgPath)) throw new Error(name + ": package.json not found");
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

// Verify React peer dep installed correctly
const reactPkgPath = join("node_modules", "react", "package.json");
if (!existsSync(reactPkgPath)) throw new Error("react: not installed");
const reactVer = JSON.parse(readFileSync(reactPkgPath, "utf-8")).version;
console.log("React version:", reactVer);
if (!reactVer.startsWith("19.")) {
  throw new Error("Expected React 19.x, got " + reactVer);
}

// Verify @axis-love/react has MarkdownReader in dist
const reactKmdPkg = readPkg("@axis-love/react");
const distPath = join("node_modules", "@axis-love/react", reactKmdPkg.exports["."].import);
if (!existsSync(distPath)) throw new Error("@axis-love/react: dist not found at " + distPath);
const distContent = readFileSync(distPath, "utf-8");
if (!distContent.includes("MarkdownReader")) {
  throw new Error("@axis-love/react: dist does not export MarkdownReader");
}
console.log("@axis-love/react: MarkdownReader found in dist");

// Verify @axis-love/styles CSS files exist
const stylesPkg = readPkg("@axis-love/styles");
for (const [key, val] of Object.entries(stylesPkg.exports)) {
  if (key.endsWith(".css")) {
    const cssPath = join("node_modules", "@axis-love/styles", val);
    if (!existsSync(cssPath)) {
      throw new Error("@axis-love/styles: " + key + " not found at " + cssPath);
    }
    console.log("@axis-love/styles: " + key + " OK");
  }
}

console.log("React consumer: all checks passed");
`,
  );

  console.log(`  Consumer dir: ${reactDir}`);

  console.log("  Installing tarballs + React...");
  try {
    execSync("npm install --no-audit --no-fund 2>&1", {
      cwd: reactDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log("  Install OK");
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  npm install failed`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }

  console.log("  Running consumer...");
  try {
    const out = execSync("node consumer.mjs 2>&1", {
      cwd: reactDir,
      encoding: "utf-8",
    });
    console.log(`  Output:\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  React consumer run failed`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }
} finally {
  rmSync(reactDir, { recursive: true, force: true });
}

console.log("");

// --- Step 5: Consumer without the optional feature peers (KWEB-045) ---
//
// @axis-love/browser declares highlighting/math/mermaid as optional
// peerDependencies. Two things have to hold for that declaration to be worth
// anything, and neither can be observed in this workspace — npm links every
// workspace package into the root node_modules whether or not anyone depends on
// it, so the feature packages are always present here.
//
//   1. npm installs @axis-love/browser cleanly with the peers absent.
//   2. The reader still renders: code unhighlighted, math left as source.
//
// Step 3 already covers the other half — every peer installed, both features
// active — from the same tarballs.

console.log("Step 5: Consumer without the optional feature peers\n");

const bareDir = mkdtempSync(join(tmpdir(), "kmd-no-peers-"));
try {
  const FEATURE_PACKAGES = ["@axis-love/highlighting", "@axis-love/math", "@axis-love/mermaid"];

  // Only what @axis-love/browser genuinely requires. No feature packages.
  const deps = {};
  for (const { name, tarball } of tarballs) {
    if (FEATURE_PACKAGES.includes(name)) continue;
    if (!["@axis-love/contracts", "@axis-love/core", "@axis-love/browser"].includes(name)) continue;
    deps[name] = `file:${tarball}`;
  }

  writeFileSync(
    join(bareDir, "package.json"),
    JSON.stringify(
      { name: "kmd-no-peers-consumer", private: true, type: "module", dependencies: deps },
      null,
      2,
    ) + "\n",
  );

  writeFileSync(
    join(bareDir, "consumer.mjs"),
    `// No-peers consumer — the optional features must degrade, not explode.
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const name of ["@axis-love/highlighting", "@axis-love/math", "@axis-love/mermaid"]) {
  if (existsSync(join("node_modules", name))) {
    throw new Error(name + " was installed — this consumer is supposed to be without it");
  }
}
console.log("optional peers: none installed (as intended)");

const { loadFeatureRehypePlugins, renderWithFeaturePlugins, BrowserReader } =
  await import("@axis-love/browser");

if (typeof BrowserReader !== "function") throw new Error("BrowserReader did not load");

const { plugins } = await loadFeatureRehypePlugins();
if (plugins.length !== 0) {
  throw new Error("expected no feature plugins, got " + plugins.length);
}
console.log("loadFeatureRehypePlugins: 0 plugins injected");

const result = await renderWithFeaturePlugins(
  "# Title\\n\\n$E = mc^2$\\n\\n\`\`\`ts\\nconst x: number = 1;\\n\`\`\`\\n",
);
if (!result.html.includes("Title")) throw new Error("document did not render");
if (!result.html.includes("const x: number = 1;")) throw new Error("code block was lost");
if (result.html.includes("katex")) throw new Error("math rendered without @axis-love/math");
if (result.html.includes("shiki-code-block")) {
  throw new Error("code highlighted without @axis-love/highlighting");
}
if (result.codeHighlightCss !== undefined) {
  throw new Error("highlight CSS emitted without @axis-love/highlighting");
}
const errors = result.diagnostics.filter((d) => d.severity === "error");
if (errors.length > 0) {
  throw new Error("missing optional peers produced errors: " + JSON.stringify(errors));
}
console.log("render OK: document intact, math as source, code unhighlighted, no error diagnostics");
console.log("No-peers consumer: all checks passed");
`,
  );

  console.log(`  Consumer dir: ${bareDir}`);
  console.log("  Installing @axis-love/browser without the optional peers...");
  try {
    execSync("npm install --no-audit --no-fund 2>&1", {
      cwd: bareDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
    console.log("  Install OK");
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  npm install failed — an optional peer is not optional enough`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }

  console.log("  Running consumer...");
  try {
    const out = execSync("node consumer.mjs 2>&1", { cwd: bareDir, encoding: "utf-8" });
    console.log(`  Output:\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : String(e);
    const stdout = e.stdout ? e.stdout.toString() : "";
    console.error(`  FAIL  no-peers consumer run failed`);
    if (stdout) console.error(`  stdout: ${stdout}`);
    if (stderr) console.error(`  stderr: ${stderr}`);
    failures++;
  }
} finally {
  rmSync(bareDir, { recursive: true, force: true });
}

console.log("");

// --- Summary ---

if (failures > 0) {
  console.error(`Dry-run verification: ${failures} failure(s)`);
  process.exit(1);
}
console.log("Dry-run verification: all checks passed");