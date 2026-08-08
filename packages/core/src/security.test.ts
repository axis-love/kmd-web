// Security regression tests for @axis-love/core.
//
// These tests directly exercise the security boundary: isSafeUrl,
// classifyLink, sanitize schema, and render() with malicious inputs.
// They complement the conformance suite by testing specific bypass
// vectors at the unit level.

import { describe, expect, it } from "vitest";
import { classifyLink } from "./links.js";
import { sanitizeStyleValue } from "./rehype-sanitize-css.js";
import { render } from "./render.js";
import { isExternalUrl, isProtocolRelative, isSafeUrl, sanitizeSchema } from "./sanitize.js";

const DEFAULT_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

// ---------------------------------------------------------------------------
// isSafeUrl — scheme allow-list enforcement
// ---------------------------------------------------------------------------

describe("isSafeUrl — scheme enforcement", () => {
  it("allows http and https", () => {
    expect(isSafeUrl("https://example.com", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("http://example.com", DEFAULT_SCHEMES)).toBe(true);
  });

  it("allows mailto and tel", () => {
    expect(isSafeUrl("mailto:user@example.com", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("tel:+1234567890", DEFAULT_SCHEMES)).toBe(true);
  });

  it("blocks javascript:", () => {
    expect(isSafeUrl("javascript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks vbscript:", () => {
    expect(isSafeUrl("vbscript:MsgBox(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks data:", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks file:", () => {
    expect(isSafeUrl("file:///etc/passwd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks unknown custom schemes", () => {
    expect(isSafeUrl("myapp://deep-link", DEFAULT_SCHEMES)).toBe(false);
    expect(isSafeUrl("chrome://settings", DEFAULT_SCHEMES)).toBe(false);
    expect(isSafeUrl("intent://package=com.evil", DEFAULT_SCHEMES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl — mixed-case scheme bypass
// ---------------------------------------------------------------------------

describe("isSafeUrl — mixed-case schemes", () => {
  it("blocks JaVaScRiPt:", () => {
    expect(isSafeUrl("JaVaScRiPt:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks JAVASCRIPT:", () => {
    expect(isSafeUrl("JAVASCRIPT:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks VBScript:", () => {
    expect(isSafeUrl("VBScript:MsgBox(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks DATA:", () => {
    expect(isSafeUrl("DATA:text/html,alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks FILE:", () => {
    expect(isSafeUrl("FILE:///etc/passwd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("allows HTTPS: (uppercase scheme in allow-list)", () => {
    expect(isSafeUrl("HTTPS://example.com", DEFAULT_SCHEMES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl — percent-encoded colon bypass
// ---------------------------------------------------------------------------

describe("isSafeUrl — encoded colon bypass", () => {
  it("blocks javascript%3A (single-encoded colon)", () => {
    expect(isSafeUrl("javascript%3Aalert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks javascript%253A (double-encoded colon)", () => {
    expect(isSafeUrl("javascript%253Aalert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks %6a%61%76%61%73%63%72%69%70%74: (encoded scheme name)", () => {
    expect(isSafeUrl("%6a%61%76%61%73%63%72%69%70%74:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks JaVaScRiPt%3A (mixed case + encoded colon)", () => {
    expect(isSafeUrl("JaVaScRiPt%3Aalert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks vbscript%3A (encoded colon)", () => {
    expect(isSafeUrl("vbscript%3AMsgBox(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks data%3A (encoded colon)", () => {
    expect(isSafeUrl("data%3Atext/html,alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks file%3A (encoded colon)", () => {
    expect(isSafeUrl("file%3A/etc/passwd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks myapp%3A (encoded colon, unknown scheme)", () => {
    expect(isSafeUrl("myapp%3Adeep-link", DEFAULT_SCHEMES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl — control character bypass
// ---------------------------------------------------------------------------

describe("isSafeUrl — control character bypass", () => {
  it("blocks java\\tscript: (tab in scheme)", () => {
    expect(isSafeUrl("java\tscript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks java\\nscript: (newline in scheme)", () => {
    expect(isSafeUrl("java\nscript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks java\\rscript: (carriage return in scheme)", () => {
    expect(isSafeUrl("java\rscript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks \\x00javascript: (null byte prefix)", () => {
    expect(isSafeUrl("\x00javascript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks javascript\\x00: (null byte before colon)", () => {
    expect(isSafeUrl("javascript\x00:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks leading whitespace before javascript:", () => {
    expect(isSafeUrl("   javascript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
    expect(isSafeUrl(" javascript:alert(1)", DEFAULT_SCHEMES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl — path traversal
// ---------------------------------------------------------------------------

describe("isSafeUrl — path traversal", () => {
  it("blocks ../../../etc/passwd", () => {
    expect(isSafeUrl("../../../etc/passwd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks ..\\..\\..\\etc\\passwd (backslash)", () => {
    expect(isSafeUrl("..\\..\\..\\etc\\passwd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks %2e%2e%2f (URL-encoded traversal)", () => {
    expect(isSafeUrl("%2e%2e%2f%2e%2e%2fetc%2fpasswd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks %252e%252e%252f (double-encoded traversal)", () => {
    expect(isSafeUrl("%252e%252e%252fetc%252fpasswd", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks null byte in path", () => {
    expect(isSafeUrl("../../../etc/passwd%00.txt", DEFAULT_SCHEMES)).toBe(false);
  });

  it("blocks UNC path (Windows)", () => {
    expect(isSafeUrl("\\\\evil.example.com\\share\\malware", DEFAULT_SCHEMES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl — safe URLs
// ---------------------------------------------------------------------------

describe("isSafeUrl — safe URLs", () => {
  it("allows empty string", () => {
    expect(isSafeUrl("", DEFAULT_SCHEMES)).toBe(true);
  });

  it("allows fragment-only (#section)", () => {
    expect(isSafeUrl("#section", DEFAULT_SCHEMES)).toBe(true);
  });

  it("allows relative paths", () => {
    expect(isSafeUrl("./doc.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("doc.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("path/to/file.md", DEFAULT_SCHEMES)).toBe(true);
  });

  it("allows absolute paths", () => {
    expect(isSafeUrl("/docs/file.md", DEFAULT_SCHEMES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// classifyLink — link classification
// ---------------------------------------------------------------------------

describe("classifyLink — classification", () => {
  it("classifies https as external", () => {
    const result = classifyLink("https://example.com", DEFAULT_SCHEMES);
    expect(result.kind).toBe("external");
  });

  it("classifies http as external", () => {
    const result = classifyLink("http://example.com", DEFAULT_SCHEMES);
    expect(result.kind).toBe("external");
  });

  it("classifies mailto as mailto", () => {
    const result = classifyLink("mailto:user@example.com", DEFAULT_SCHEMES);
    expect(result.kind).toBe("mailto");
  });

  it("classifies tel as tel", () => {
    const result = classifyLink("tel:+1234567890", DEFAULT_SCHEMES);
    expect(result.kind).toBe("tel");
  });

  it("classifies #fragment as internal", () => {
    const result = classifyLink("#section", DEFAULT_SCHEMES);
    expect(result.kind).toBe("internal");
  });

  it("classifies relative path as document", () => {
    const result = classifyLink("doc.md", DEFAULT_SCHEMES);
    expect(result.kind).toBe("document");
  });

  it("classifies javascript: as blocked", () => {
    const result = classifyLink("javascript:alert(1)", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
    expect(result.reason).toBe("unsafe-url");
  });

  it("classifies vbscript: as blocked", () => {
    const result = classifyLink("vbscript:MsgBox(1)", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });

  it("classifies data: as blocked", () => {
    const result = classifyLink("data:text/html,alert(1)", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });

  it("classifies file: as blocked", () => {
    const result = classifyLink("file:///etc/passwd", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });

  it("classifies unknown scheme as blocked", () => {
    const result = classifyLink("myapp://deep-link", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });

  it("classifies encoded javascript%3A as blocked", () => {
    const result = classifyLink("javascript%3Aalert(1)", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });

  it("classifies path traversal as blocked", () => {
    const result = classifyLink("../../../etc/passwd", DEFAULT_SCHEMES);
    expect(result.kind).toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// Sanitize schema — DOM clobbering protection
// ---------------------------------------------------------------------------

describe("sanitizeSchema — DOM clobbering", () => {
  it("preserves id in * wildcard attributes for heading anchors", () => {
    const starAttrs = sanitizeSchema.attributes?.["*"] as readonly string[];
    expect(starAttrs).toContain("id");
  });

  it("preserves name in * wildcard attributes for anchor targets", () => {
    const starAttrs = sanitizeSchema.attributes?.["*"] as readonly string[];
    expect(starAttrs).toContain("name");
  });

  it("does not include SVG tags in allowed tagNames", () => {
    const tags = sanitizeSchema.tagNames as readonly string[];
    expect(tags).not.toContain("svg");
    expect(tags).not.toContain("path");
    expect(tags).not.toContain("foreignObject");
  });

  it("does not include script/iframe/object/embed/form in allowed tagNames", () => {
    const tags = sanitizeSchema.tagNames as readonly string[];
    expect(tags).not.toContain("script");
    expect(tags).not.toContain("iframe");
    expect(tags).not.toContain("object");
    expect(tags).not.toContain("embed");
    expect(tags).not.toContain("form");
    expect(tags).not.toContain("meta");
    expect(tags).not.toContain("style");
    expect(tags).not.toContain("base");
  });

  it("sets clobberPrefix to user-content- for DOM clobber protection", () => {
    expect(sanitizeSchema.clobberPrefix).toBe("user-content-");
  });
});

// ---------------------------------------------------------------------------
// isExternalUrl
// ---------------------------------------------------------------------------

describe("isExternalUrl", () => {
  it("returns true for https URLs", () => {
    expect(isExternalUrl("https://example.com", DEFAULT_SCHEMES)).toBe(true);
  });

  it("returns true for http URLs", () => {
    expect(isExternalUrl("http://example.com", DEFAULT_SCHEMES)).toBe(true);
  });

  it("returns false for mailto", () => {
    expect(isExternalUrl("mailto:user@example.com", DEFAULT_SCHEMES)).toBe(false);
  });

  it("returns false for tel", () => {
    expect(isExternalUrl("tel:+1234567890", DEFAULT_SCHEMES)).toBe(false);
  });

  it("returns false for fragment", () => {
    expect(isExternalUrl("#section", DEFAULT_SCHEMES)).toBe(false);
  });

  it("returns false for relative paths", () => {
    expect(isExternalUrl("./doc.md", DEFAULT_SCHEMES)).toBe(false);
    expect(isExternalUrl("doc.md", DEFAULT_SCHEMES)).toBe(false);
  });

  it("returns false for absolute paths", () => {
    expect(isExternalUrl("/docs/file.md", DEFAULT_SCHEMES)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// KWEB-035 — no cosmetic output mutation (zero-width space regression)
// ---------------------------------------------------------------------------

describe("render — legitimate content is not corrupted", () => {
  it("preserves prose mentioning dangerous strings byte-for-byte (no ZWSP)", async () => {
    // A document that legitimately discusses XSS vectors. The rendered text
    // must be preserved exactly — no zero-width spaces, no mutation.
    const source = [
      "# Security notes",
      "",
      "We block javascript: and vbscript: URLs.",
      "The alert( function and onload / onerror handlers are dangerous.",
      "foreignObject, @import, and evil.example.com appear in SVG attacks.",
    ].join("\n");

    const result = await render(source);

    // No zero-width space anywhere in the output.
    expect(result.html).not.toContain("\u200B");

    // The exact dangerous substrings survive intact in prose.
    expect(result.html).toContain("javascript:");
    expect(result.html).toContain("vbscript:");
    expect(result.html).toContain("alert(");
    expect(result.html).toContain("onload");
    expect(result.html).toContain("onerror");
    expect(result.html).toContain("foreignObject");
    expect(result.html).toContain("@import");
    expect(result.html).toContain("evil.example.com");
  });

  it("still removes actual javascript: link elements entirely", async () => {
    const source = "[click](javascript:alert(1))";
    const result = await render(source);

    // The element is removed entirely — no href carrying the scheme.
    expect(result.html).not.toContain("href=\"javascript:");
    expect(result.html).not.toContain("<a ");
    // And an unsafe-url diagnostic was recorded.
    expect(result.diagnostics.some((d) => d.code === "unsafe-url")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KWEB-036 — CSS style attribute sanitization (HIGH-1)
// ---------------------------------------------------------------------------

describe("sanitizeStyleValue — CSS injection defense", () => {
  it("keeps safe layout properties KaTeX needs", () => {
    expect(sanitizeStyleValue("height:0.6833em")).toBe("height:0.6833em");
    expect(sanitizeStyleValue("margin-right:0.0576em")).toBe("margin-right:0.0576em");
    expect(sanitizeStyleValue("vertical-align:-0.2587em")).toBe("vertical-align:-0.2587em");
    expect(sanitizeStyleValue("top:-3.063em")).toBe("top:-3.063em");
    expect(sanitizeStyleValue("color:#cc0000")).toBe("color:#cc0000");
  });

  it("strips positioning that enables clickjacking overlays", () => {
    // position/left/z-index are stripped; `top` is allow-listed (KaTeX uses
    // it) but is inert without `position`, so no overlay can result.
    expect(sanitizeStyleValue("position:fixed;left:0;z-index:9999")).toBe("");
    expect(sanitizeStyleValue("position:fixed;top:0;left:0;z-index:9999")).toBe("top:0");
    expect(sanitizeStyleValue("position:absolute")).toBe("");
    expect(sanitizeStyleValue("float:right")).toBe("");
    expect(sanitizeStyleValue("display:block")).toBe("");
  });

  it("strips background properties that enable network exfiltration", () => {
    expect(sanitizeStyleValue("background:url(https://evil.example.com/x)")).toBe("");
    expect(sanitizeStyleValue("background-image:url('https://evil.example.com/p.png')")).toBe("");
    expect(sanitizeStyleValue("background-color:red")).toBe("");
  });

  it("strips script-execution vectors", () => {
    expect(sanitizeStyleValue("width:expression(alert(1))")).toBe("");
    expect(sanitizeStyleValue("behavior:url(xss.htc)")).toBe("");
    expect(sanitizeStyleValue("-moz-binding:url('xss.xml')")).toBe("");
    expect(sanitizeStyleValue("background:url(javascript:alert(1))")).toBe("");
  });

  it("keeps safe declarations while dropping dangerous ones in a mixed list", () => {
    const mixed = "color:#123456;position:fixed;height:1em;background:url(https://e.com)";
    expect(sanitizeStyleValue(mixed)).toBe("color:#123456;height:1em");
  });

  it("strips CSS comments that can hide payloads", () => {
    expect(sanitizeStyleValue("/*harmless*/position:fixed;top:0")).toBe("top:0");
  });

  it("rejects dangerous values even on allow-listed properties", () => {
    expect(sanitizeStyleValue("height:url(https://evil.example.com)")).toBe("");
    expect(sanitizeStyleValue("color:expression(alert(1))")).toBe("");
  });

  it("drops custom properties and vendor prefixes", () => {
    expect(sanitizeStyleValue("--shiki-dark:#fff")).toBe("");
    expect(sanitizeStyleValue("-webkit-transform:rotate(0)")).toBe("");
  });

  it("normalizes property names case-insensitively", () => {
    expect(sanitizeStyleValue("HEIGHT:1em")).toBe("height:1em");
    expect(sanitizeStyleValue("Position:fixed")).toBe("");
  });

  it("returns empty string for empty or garbage input", () => {
    expect(sanitizeStyleValue("")).toBe("");
    expect(sanitizeStyleValue(";;;")).toBe("");
    expect(sanitizeStyleValue("not-a-declaration")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// KWEB-036 — end-to-end: style injection neutralized, KaTeX styles survive
// ---------------------------------------------------------------------------

describe("render — CSS injection via raw HTML style attributes", () => {
  it("neutralizes position/background injection on span", async () => {
    const source =
      '<span style="position:fixed;top:0;width:100vw;height:100vh;background:url(https://evil.example.com);z-index:9">x</span>';
    const result = await render(source);
    expect(result.html).not.toContain("position:");
    expect(result.html).not.toContain("background");
    expect(result.html).not.toContain("z-index");
    expect(result.html).not.toContain("evil.example.com");
    // The text content still renders.
    expect(result.html).toContain("x");
  });

  it("strips dangerous style from pre entirely", async () => {
    const source = '<pre style="position:absolute;background:url(https://evil.example.com)">c</pre>';
    const result = await render(source);
    expect(result.html).not.toContain("style=");
    expect(result.html).toContain("c");
  });

  it("preserves safe inline styles", async () => {
    const source = '<span style="color:#cc0000;vertical-align:super">s</span>';
    const result = await render(source);
    expect(result.html).toContain("color:#cc0000");
    expect(result.html).toContain("vertical-align:super");
  });
});

// ---------------------------------------------------------------------------
// KWEB-037 — protocol-relative URL bypass (HIGH-2)
// ---------------------------------------------------------------------------

describe("isProtocolRelative", () => {
  it("detects protocol-relative URLs", () => {
    expect(isProtocolRelative("//evil.com/x.png")).toBe(true);
    expect(isProtocolRelative("//evil.com")).toBe(true);
    expect(isProtocolRelative("  //evil.com")).toBe(true);
  });

  it("does not match genuine relative paths", () => {
    expect(isProtocolRelative("./x.png")).toBe(false);
    expect(isProtocolRelative("../x.png")).toBe(false);
    expect(isProtocolRelative("/abs/path.png")).toBe(false);
    expect(isProtocolRelative("x.png")).toBe(false);
    expect(isProtocolRelative("#frag")).toBe(false);
  });
});

describe("protocol-relative — isSafeUrl", () => {
  it("treats protocol-relative as remote (safe only if network scheme allowed)", () => {
    expect(isSafeUrl("//evil.com/x.png", DEFAULT_SCHEMES)).toBe(true);
    // Without http/https in the allow-list, it is blocked.
    expect(isSafeUrl("//evil.com/x.png", new Set(["mailto"]))).toBe(false);
  });

  it("still allows genuine relative paths", () => {
    expect(isSafeUrl("./doc.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("doc.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("path/to/file.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("/abs/doc.md", DEFAULT_SCHEMES)).toBe(true);
    expect(isSafeUrl("#frag", DEFAULT_SCHEMES)).toBe(true);
  });

  it("still blocks parent-relative traversal (existing policy)", () => {
    expect(isSafeUrl("../doc.md", DEFAULT_SCHEMES)).toBe(false);
  });
});

describe("protocol-relative — isExternalUrl / classifyLink", () => {
  it("classifies protocol-relative as external", () => {
    expect(isExternalUrl("//evil.com/page", DEFAULT_SCHEMES)).toBe(true);
    const classified = classifyLink("//evil.com/page", DEFAULT_SCHEMES);
    expect(classified.kind).toBe("external");
  });

  it("does not classify genuine relative as external", () => {
    expect(isExternalUrl("./doc.md", DEFAULT_SCHEMES)).toBe(false);
    expect(isExternalUrl("/abs/doc.md", DEFAULT_SCHEMES)).toBe(false);
    expect(classifyLink("./doc.md", DEFAULT_SCHEMES).kind).toBe("document");
  });
});

describe("protocol-relative — remote image blocking (filterAssets via render)", () => {
  it("blocks protocol-relative image when allowRemoteImages is false", async () => {
    const result = await render("![img](//evil.example.com/x.png)", {
      security: { allowRemoteImages: false },
    });
    expect(result.assets.some((a) => a.url === "//evil.example.com/x.png")).toBe(false);
  });

  it("allows protocol-relative image when allowRemoteImages is true", async () => {
    const result = await render("![img](//evil.example.com/x.png)", {
      security: { allowRemoteImages: true },
    });
    expect(result.assets.some((a) => a.url === "//evil.example.com/x.png")).toBe(true);
  });

  it("still allows genuine relative image when remote disabled", async () => {
    const result = await render("![img](./local.png)", {
      security: { allowRemoteImages: false },
    });
    expect(result.assets.some((a) => a.url === "./local.png")).toBe(true);
  });
});

describe("protocol-relative — link hardening in rendered HTML", () => {
  it("adds rel=noopener and target=_blank to protocol-relative links", async () => {
    const result = await render("[link](//evil.example.com/page)");
    const anchor = result.html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(anchor).toContain("noopener");
    expect(anchor).toContain("noreferrer");
    expect(anchor).toContain('target="_blank"');
  });

  it("leaves genuine relative links un-hardened", async () => {
    const result = await render("[link](./other.md)");
    const anchor = result.html.match(/<a [^>]*>/)?.[0] ?? "";
    expect(anchor).not.toContain("noopener");
    expect(anchor).not.toContain('target="_blank"');
  });
});
