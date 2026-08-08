# Conformance Suite

The conformance suite is the security gate for the kmd rendering pipeline. It
verifies that the core renderer produces safe, spec-compliant output across a
matrix of Markdown, security, and feature fixtures.

## Assertion Doctrine

Security assertions **MUST** be structural — they check for the presence or
absence of elements, attributes, and URL schemes in the parsed HTML, never
for substrings in the raw HTML string.

### Why structural, not substring

Substring-absence assertions (`mustNotContain`) couple the assertion to
rendering cosmetics. A fixture's legitimate prose may mention dangerous
strings (e.g. a heading that says "javascript: links are blocked"), and
substring assertions either false-fail on that prose or — worse — get
"fixed" by cosmetically mutating the output rather than removing the
dangerous structure.

Structural assertions parse the rendered HTML into elements and attributes
and assert on structure: which elements exist, which attribute names exist,
which attribute values contain dangerous payloads, and which URL schemes
appear in URL-bearing attributes. A document that legitimately mentions
`javascript:` in prose still passes, while an actual `href="javascript:..."`
attribute fails.

### Assertion types

| Assertion | Level | What it checks |
|---|---|---|
| `mustContain` | Substring presence | A marker string must appear in the rendered HTML. Use for inert text that proves rendering happened. |
| `mustNotContain` | Substring absence | A marker string must NOT appear. Use **only** for markers with no legitimate textual form (e.g. `<script` which is always escaped to `&lt;script` in text nodes). **Never use to assert that a payload was neutralized.** |
| `requiredElements` | Structural presence | An element tag (case-insensitive) must appear at least once. Use instead of `mustContain: "<h1"` to assert that a heading survived rendering. |
| `forbiddenElements` | Structural absence | An element tag must not appear anywhere. Use for dangerous elements (script, iframe, object, embed, form, meta, style, base, link, svg, etc.). |
| `forbiddenAttributes` | Structural absence | An attribute name must not appear on any element. Use for dangerous attributes (srcset, xlink:href, etc.). |
| `forbiddenAttributeValues` | Structural absence | No element may have an attribute whose value contains a given substring. Use to assert that CSS payloads were neutralized (e.g. no `style` attribute contains `position:fixed`). Operates on parsed attributes — will not match text content, comments, or tag names. |
| `forbiddenAttributeExactValues` | Structural absence | No element may have an attribute whose value exactly matches (case-insensitive). Use when the sanitizer transforms values (e.g. clobber-prefixing) so a substring check would false-fail on the prefixed form. |
| `forbidEventHandlerAttributes` | Structural absence | No attribute whose name starts with `on` may appear on any element. |
| `forbiddenUrlSchemes` | Structural absence | No URL-bearing attribute (`href`, `src`, `data`, `poster`, `action`, `formaction`, `xlink:href`, each `srcset` candidate) may carry a given scheme. Schemes are compared after stripping control characters and decoding HTML entities and percent-encoding (two rounds), matching how browsers resolve schemes. |

### Rule: zero substring-absence assertions for payload neutralization

Every security observation that asserts a dangerous payload was neutralized
**MUST** use structural assertions (`forbiddenElements`,
`forbiddenAttributes`, `forbiddenAttributeValues`,
`forbiddenAttributeExactValues`, `forbiddenUrlSchemes`). The only acceptable
use of `mustNotContain` is for markers that have no legitimate textual form
and cannot appear in inert prose (e.g. `<script` which is always escaped).

## Fixture categories

| Category | Fixtures | Purpose |
|---|---|---|
| `markdown` | commonmark, gfm-extensions, alerts, footnotes, headings-outline, raw-html-allowed, wikilinks, code-blocks | CommonMark/GFM rendering correctness |
| `security` | xss, bypass-attempts, dom-clobbering, encoded-urls, path-traversal, protocol-relative, protocol-tricks, style-injection, svg-attacks, pathological, remote-images, external-links, srcset-candidates | Security policy enforcement |
| `features` | math, highlighting, mermaid, design-md-valid, design-md-invalid, front-matter | Feature detection and rendering |

## Conformance matrix

The security conformance matrix covers these controls (from
`kmd/docs/planning/09-security-privacy.md`):

| Control | Fixture | Key assertions |
|---|---|---|
| Scheme policy | `protocol-tricks.md` | `forbiddenUrlSchemes`: javascript, vbscript, data, file, custom |
| Protocol-relative | `protocol-relative.md` | links classified external, images blocked, `forbiddenUrlSchemes` |
| Remote-image block | `remote-images.md` (block) | `assets.mustNotIncludeUrls`: all remote URLs |
| Remote-image allow | `remote-images.md` (allow) | `assets.mustIncludeUrls`: remote URLs appear |
| Style injection | `style-injection.md` | `forbiddenAttributeValues`: position, background:url, expression, etc. |
| rel/target | `external-links.md` | `mustContain`: noopener, noreferrer, target=_blank |
| Path traversal | `path-traversal.md` | `forbiddenUrlSchemes`: file; `assets.mustNotIncludeUrls` |
| Srcset candidates | `srcset-candidates.md` | `forbiddenUrlSchemes`; `assets.mustNotIncludeUrls` |
| XSS | `xss.md` | `forbiddenElements`, `forbiddenUrlSchemes`, `forbidEventHandlerAttributes` |
| Bypass attempts | `bypass-attempts.md` | `forbiddenElements`, `forbiddenAttributes`, `forbiddenUrlSchemes` |
| DOM clobbering | `dom-clobbering.md` | `forbiddenAttributeExactValues`: name/id = location/domain/cookie |
| Encoded URLs | `encoded-urls.md` | `forbiddenUrlSchemes`: javascript, vbscript, data, file |
| SVG attacks | `svg-attacks.md` | `forbiddenElements`: svg, script, animate, set, foreignobject |
| Pathological | `pathological.md` | `forbiddenElements`: script, iframe, style, object, embed, form |

## CI guard

The conformance fixture guard (`scripts/check-conformance-fixtures.mjs`)
runs in CI and fails if:

1. An observation references a fixture file that does not exist
2. A fixture file has no observation (orphaned or silently removed)
3. No observations exist at all (suite broken)

This ensures the suite cannot silently lose coverage — deleting a fixture or
skipping an observation is a CI failure, not a silent pass.
