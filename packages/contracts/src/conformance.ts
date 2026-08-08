// @axis-love/contracts — conformance observation types
//
// These types define the expected observations that a conformant renderer
// must produce for each fixture. They are the basis of cross-platform
// conformance testing: the JavaScript contract runner and native (Unity)
// consumers implement the same observations without requiring byte-identical
// HTML.

import type { LinkTargetKind } from "./links.js";
import type { RenderOptions } from "./options.js";
import type { AssetType, DiagnosticSeverity, RenderResult } from "./render.js";

// ---------------------------------------------------------------------------

/**
 * The category of a fixture file.
 *
 * - `markdown`  — CommonMark, GFM, alerts, footnotes, wikilinks, raw HTML, code
 * - `security`  — XSS, DOM clobbering, protocol tricks, encoded URLs, SVG, etc.
 * - `features`  — Mermaid, math, DESIGN.md, front matter, highlighting
 */
export type FixtureCategory = "markdown" | "security" | "features";

/**
 * The applicability of an assertion across platforms.
 *
 * - `required`           — all conformant renderers must pass this assertion.
 * - `optional`           — the assertion may be relaxed for platforms that
 *   lack a specific feature (e.g. syntax highlighting on Unity).
 * - `not-applicable`     — the assertion does not apply to certain platforms
 *   (e.g. DOM-specific checks on Unity which has no DOM).
 */
export type AssertionApplicability = "required" | "optional" | "not-applicable";

/**
 * The normalized HTML semantics expected from rendering.
 *
 * Instead of byte-identical HTML, observations check for the presence
 * (or absence) of semantic elements, attributes, and text content.
 * This allows native renderers to produce different HTML structures
 * while still conforming to the contract.
 *
 * Two kinds of absence checks exist, and security fixtures MUST use the
 * structural ones:
 *
 * - Substring checks (`mustNotContain`) operate on the raw HTML string.
 *   They are fine for markers that cannot appear in legitimate serialized
 *   output (e.g. `<script`, which is always escaped to `&lt;script` in
 *   text nodes), but they produce false failures when a fixture's OWN
 *   legitimate text contains the marker (e.g. a heading that discusses
 *   `javascript:` links). Never use substrings to assert that a payload
 *   was neutralized — that couples the assertion to rendering cosmetics.
 * - Structural checks (`forbiddenElements`, `forbiddenAttributes`,
 *   `forbidEventHandlerAttributes`, `forbiddenUrlSchemes`) parse the HTML
 *   into elements and attributes and assert on structure: which elements
 *   exist, which attribute names exist, and which schemes appear in
 *   URL-bearing attributes. A document that legitimately mentions
 *   `javascript:` in prose still passes, while an actual
 *   `href="javascript:..."` attribute fails.
 *
 * @property mustContain — substrings that must appear in the rendered HTML.
 * @property mustNotContain — substrings that must NOT appear in the rendered
 *   HTML. Use only for markers with no legitimate textual form.
 * @property shouldContain — substrings that should appear; a warning (not
 *   failure) is emitted if absent.
 * @property requiredElements — element tag names (case-insensitive) that
 *   must appear at least once in the rendered HTML. Structural presence
 *   check: use instead of `mustContain` when asserting that an element
 *   exists (e.g. `<h1>` survived rendering).
 * @property forbiddenElements — element tag names (case-insensitive) that
 *   must not appear anywhere in the rendered HTML.
 * @property forbiddenAttributes — attribute names (case-insensitive) that
 *   must not appear on any element.
 * @property forbiddenAttributeValues — attribute name + substring pairs
 *   that must not appear on any element. Structural: parses HTML into
 *   elements/attributes, then checks attribute values. Use instead of
 *   `mustNotContain` when asserting that a payload was neutralized in an
 *   attribute (e.g. no `style` attribute contains `position:fixed`).
 * @property forbiddenAttributeExactValues — attribute name + exact value
 *   pairs (case-insensitive) that must not appear on any element. Use when
 *   the sanitizer transforms values (e.g. clobber-prefixing) so a substring
 *   check would false-fail on the prefixed form.
 * @property forbidEventHandlerAttributes — when true, no attribute whose
 *   name starts with `on` (case-insensitive) may appear on any element.
 * @property forbiddenUrlSchemes — schemes (case-insensitive, e.g.
 *   `javascript`, `data`, `file`) that must not appear in URL-bearing
 *   attributes (`href`, `src`, `data`, `poster`, `action`, `formaction`,
 *   `xlink:href`, and each candidate in `srcset`). Values are compared
 *   after stripping control characters and decoding HTML entities and
 *   percent-encoding (two rounds), matching how browsers resolve schemes.
 */
export interface HtmlObservation {
  readonly mustContain: readonly string[];
  readonly mustNotContain: readonly string[];
  readonly shouldContain?: readonly string[];
  readonly requiredElements?: readonly string[];
  readonly forbiddenElements?: readonly string[];
  readonly forbiddenAttributes?: readonly string[];
  readonly forbiddenAttributeValues?: readonly AttributeValueCheck[];
  readonly forbiddenAttributeExactValues?: readonly AttributeValueCheck[];
  readonly forbidEventHandlerAttributes?: boolean;
  readonly forbiddenUrlSchemes?: readonly string[];
}

/**
 * A structural check on an attribute value: no element in the rendered HTML
 * may have an attribute named `attr` (case-insensitive) whose value
 * contains `contains` (case-sensitive). Unlike `mustNotContain`, this
 * operates on parsed attributes — it will not match text content, comments,
 * or tag names.
 */
export interface AttributeValueCheck {
  readonly attr: string;
  readonly contains: string;
}

/**
 * Expected outline entry in the document.
 *
 * Matches the `OutlineEntry` shape from render.ts but without the
 * `rendererVersion` — observations are renderer-agnostic.
 */
export interface ExpectedOutlineEntry {
  readonly level: number;
  readonly text: string;
  readonly slug: string;
}

/**
 * Expected outline observation.
 *
 * @property entries — the expected heading outline in document order.
 *   An empty array means the document has no headings.
 */
export interface OutlineObservation {
  readonly entries: readonly ExpectedOutlineEntry[];
}

/**
 * Expected diagnostic observation.
 *
 * Instead of exact diagnostic matching (which is fragile), observations
 * check that certain diagnostic codes or severities are present or absent.
 *
 * @property mustIncludeCodes — diagnostic codes that must appear.
 * @property mustNotIncludeCodes — diagnostic codes that must not appear.
 * @property minSeverity — if set, at least one diagnostic must have this
 *   severity or higher. Severity order: info < warning < error.
 */
export interface DiagnosticObservation {
  readonly mustIncludeCodes?: readonly string[];
  readonly mustNotIncludeCodes?: readonly string[];
  readonly minSeverity?: DiagnosticSeverity;
}

/**
 * Expected asset reference observation.
 *
 * @property count — the expected number of asset references.
 * @property mustIncludeUrls — URLs that must appear in the assets list.
 * @property mustNotIncludeUrls — URLs that must not appear (blocked assets).
 * @property mustIncludeTypes — asset types that must be present.
 */
export interface AssetObservation {
  readonly count?: number;
  readonly mustIncludeUrls?: readonly string[];
  readonly mustNotIncludeUrls?: readonly string[];
  readonly mustIncludeTypes?: readonly AssetType[];
}

/**
 * Expected metadata observation.
 *
 * @property title — expected title, or null if no title expected.
 * @property description — expected description, or null if none.
 * @property lang — expected language tag, or null if none.
 */
export interface MetadataObservation {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly lang?: string | null;
}

/**
 * Expected detected features observation.
 *
 * Each field is optional — when absent, the feature detection for that
 * flag is not asserted. When present (true/false), the renderer must
 * detect exactly that.
 */
export interface FeaturesObservation {
  readonly hasMath?: boolean;
  readonly hasMermaid?: boolean;
  readonly hasDesignDoc?: boolean;
  readonly hasCodeHighlighting?: boolean;
  readonly hasTables?: boolean;
  readonly hasTaskLists?: boolean;
  readonly hasFootnotes?: boolean;
  readonly hasAlerts?: boolean;
}

/**
 * Expected link classification observation.
 *
 * @property url — the raw URL from the Markdown source.
 * @property kind — the expected `LinkTargetKind` classification.
 * @property resolvedUrl — the expected resolved URL (optional).
 */
export interface LinkClassificationObservation {
  readonly url: string;
  readonly kind: LinkTargetKind;
  readonly resolvedUrl?: string;
}

/**
 * Expected link observations for a fixture.
 */
export interface LinkObservation {
  readonly classifications: readonly LinkClassificationObservation[];
}

/**
 * The complete expected observation for a single fixture.
 *
 * Each field is optional — a fixture may only assert a subset of
 * observations. The contract runner checks only the fields that are present.
 *
 * @property fixture — the fixture file path relative to the fixtures/ dir.
 * @property category — the fixture category.
 * @property description — human-readable description of what this fixture tests.
 * @property renderOptions — optional RenderOptions to pass to the renderer for
 *   this fixture. When absent, the renderer uses its default options. This
 *   allows security fixtures to test option-dependent behavior (e.g. remote
 *   image allow/block modes, feature flags).
 * @property html — expected HTML semantics.
 * @property outline — expected document outline.
 * @property diagnostics — expected diagnostics.
 * @property assets — expected asset references.
 * @property metadata — expected document metadata.
 * @property detectedFeatures — expected feature detection flags.
 * @property links — expected link classifications.
 * @property fallback — description of a deliberate fallback behavior
 *   (e.g. "Mermaid block renders as code block fallback when mermaid is disabled").
 * @property applicability — per-platform applicability of this fixture's
 *   assertions. Defaults to "required" for all platforms.
 */
export interface FixtureObservation {
  readonly fixture: string;
  readonly category: FixtureCategory;
  readonly description: string;
  readonly renderOptions?: RenderOptions;
  readonly html?: HtmlObservation;
  readonly outline?: OutlineObservation;
  readonly diagnostics?: DiagnosticObservation;
  readonly assets?: AssetObservation;
  readonly metadata?: MetadataObservation;
  readonly detectedFeatures?: FeaturesObservation;
  readonly links?: LinkObservation;
  readonly fallback?: string;
  readonly applicability?: AssertionApplicability;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * The schema version of the conformance manifest.
 *
 * Incremented when the manifest schema changes in a breaking way.
 */
export const MANIFEST_SCHEMA_VERSION = "1.0.0" as const;

/**
 * A single fixture entry in the conformance manifest.
 */
export interface ManifestFixtureEntry {
  readonly fixture: string;
  readonly category: FixtureCategory;
  readonly description: string;
  readonly applicability: AssertionApplicability;
  /** Platforms that must pass this fixture. */
  readonly platforms: readonly string[];
  /** Feature groups this fixture exercises. */
  readonly features: readonly string[];
  /** Whether this is a security (negative/malicious) fixture. */
  readonly security: boolean;
}

/**
 * The versioned conformance manifest.
 *
 * This is the top-level schema that identifies all fixtures, their
 * applicability across platforms, and the assertion groups they belong to.
 *
 * @property schemaVersion — the manifest schema version.
 * @property contractsVersion — the @axis-love/contracts version.
 * @property fixtures — list of all fixture entries.
 * @property platforms — all platforms that participate in conformance.
 * @property assertionGroups — logical groups of assertions.
 */
export interface ConformanceManifest {
  readonly schemaVersion: string;
  readonly contractsVersion: string;
  readonly fixtures: readonly ManifestFixtureEntry[];
  readonly platforms: readonly string[];
  readonly assertionGroups: readonly AssertionGroup[];
}

/**
 * A logical group of assertions in the manifest.
 *
 * @property name — the group name (e.g. "commonmark", "security-xss").
 * @property description — human-readable description.
 * @property fixtures — fixture paths in this group.
 * @property applicability — the default applicability for this group.
 */
export interface AssertionGroup {
  readonly name: string;
  readonly description: string;
  readonly fixtures: readonly string[];
  readonly applicability: AssertionApplicability;
}

// ---------------------------------------------------------------------------
// Contract runner types
// ---------------------------------------------------------------------------

/**
 * The result of running a single fixture through the contract runner.
 *
 * @property fixture — the fixture path.
 * @property passed — whether all assertions passed.
 * @property assertions — individual assertion results.
 * @property durationMs — time taken to run assertions (excluding render).
 */
export interface FixtureAssertionResult {
  readonly fixture: string;
  readonly passed: boolean;
  readonly assertions: readonly AssertionResult[];
  readonly durationMs: number;
}

/**
 * A single assertion check result.
 *
 * @property name — the assertion name (e.g. "html.mustContain[0]").
 * @property passed — whether this assertion passed.
 * @property message — failure message when the assertion fails.
 * @property severity — "error" for required assertions, "warning" for optional.
 */
export interface AssertionResult {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/**
 * The complete contract runner result for all fixtures.
 *
 * @property totalFixtures — total number of fixtures tested.
 * @property passed — number of fixtures that passed all assertions.
 * @property failed — number of fixtures with at least one failure.
 * @property skipped — number of fixtures skipped (not-applicable).
 * @property results — per-fixture results.
 * @property durationMs — total duration.
 * @property schemaVersion — manifest schema version used.
 */
export interface ContractRunResult {
  readonly totalFixtures: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly results: readonly FixtureAssertionResult[];
  readonly durationMs: number;
  readonly schemaVersion: string;
}

/**
 * A renderer adapter for the contract runner.
 *
 * Implementations (JavaScript, native bridge) provide this interface
 * to the contract runner. The runner calls `render` with each fixture's
 * source and checks the `RenderResult` against the expected observations.
 *
 * This abstraction allows the same contract runner to test both the
 * JavaScript core renderer and a native (Unity) renderer through a bridge.
 */
export interface ContractRenderer {
  /** Render a Markdown source string into a RenderResult. */
  render(source: string, options?: RenderOptions): Promise<RenderResult>;
}
