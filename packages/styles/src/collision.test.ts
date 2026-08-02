// @vitest-environment happy-dom
//
// Collision isolation test for @axis-love/styles
//
// Proves that:
// 1. kmd styles do NOT leak out to host elements outside .kmd-reader
// 2. Host styles do NOT leak into .kmd-reader content
//    (except through documented custom properties)
//
// The fixture creates adversarial generic elements (h1-h6, table, button,
// code, pre, blockquote, ul, ol) with conflicting class names (.container,
// .content, .header, .sidebar) and aggressive global body styles, then
// verifies computed styles remain isolated.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(__dirname, "..");

function readStyles(): string {
  return readFileSync(join(stylesDir, "src", "styles.css"), "utf-8");
}

function readGeneratedTokens(): string {
  return readFileSync(join(stylesDir, "generated", "tokens.css"), "utf-8");
}

/**
 * Inject a <style> tag with the full CSS (generated tokens + styles.css)
 * into the happy-dom document so computed styles reflect the real cascade.
 */
function injectStyles(doc: Document): void {
  const tokens = readGeneratedTokens();
  const styles = readStyles();
  // Strip @import lines — we inline the tokens directly
  const inlined = styles.replace(/@import\s+"\.\/tokens\.css";?/, tokens);
  const styleEl = doc.createElement("style");
  styleEl.textContent = inlined;
  doc.head.appendChild(styleEl);
}

/**
 * Create a host page with adversarial global styles that conflict with
 * kmd-reader conventions, plus generic elements outside the reader root.
 */
function createHostPage(doc: Document): { reader: HTMLElement; host: HTMLElement } {
  // Adversarial host styles — designed to collide if kmd styles leak
  const hostStyle = doc.createElement("style");
  hostStyle.textContent = `
    /* Host sets aggressive global styles */
    body {
      font-family: "Comic Sans MS", cursive;
      color: rgb(255, 0, 0);
      background-color: rgb(0, 255, 0);
      font-size: 99px;
      line-height: 9.9;
    }

    /* Host styles generic elements aggressively */
    h1, h2, h3, h4, h5, h6 {
      color: rgb(255, 0, 255);
      font-size: 88px;
      font-weight: 100;
      font-family: "Comic Sans MS", cursive;
      border: 5px dashed rgb(255, 0, 0);
    }

    p { color: rgb(0, 255, 255); font-size: 77px; }
    a { color: rgb(128, 0, 128); text-decoration: underline wavy; }
    code { color: rgb(255, 20, 147); font-family: "Comic Sans MS"; }
    pre { background-color: rgb(255, 255, 0); color: rgb(255, 0, 0); }
    table { border: 10px solid rgb(255, 0, 0); }
    blockquote { border-left: 20px solid rgb(0, 0, 255); }
    ul, ol { list-style: square; padding-left: 99px; }

    /* Host uses generic class names that might conflict */
    .container { max-width: 1234px; }
    .content { font-size: 55px; }
    .header { background-color: rgb(255, 0, 0); }
    .sidebar { width: 999px; }
  `;
  doc.head.appendChild(hostStyle);

  // Host elements outside .kmd-reader
  const host = doc.createElement("div");
  host.innerHTML = `
    <h1 id="host-h1">Host H1</h1>
    <h2 id="host-h2">Host H2</h2>
    <h3 id="host-h3">Host H3</h3>
    <h4 id="host-h4">Host H4</h4>
    <h5 id="host-h5">Host H5</h5>
    <h6 id="host-h6">Host H6</h6>
    <p id="host-p">Host paragraph</p>
    <a id="host-link" href="#">Host link</a>
    <code id="host-code">Host code</code>
    <pre id="host-pre"><code>Host pre</code></pre>
    <table id="host-table"><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>
    <blockquote id="host-blockquote">Host quote</blockquote>
    <ul id="host-ul"><li>Host item</li></ul>
    <ol id="host-ol"><li>Host item</li></ol>
    <button id="host-button">Host button</button>
    <div class="container" id="host-container">Container</div>
    <div class="content" id="host-content">Content</div>
    <div class="header" id="host-header">Header</div>
    <div class="sidebar" id="host-sidebar">Sidebar</div>
  `;
  doc.body.appendChild(host);

  // kmd-reader content inside the host page
  const reader = doc.createElement("div");
  reader.className = "kmd-reader";
  reader.innerHTML = `
    <h1 id="kmd-h1">KMD H1</h1>
    <h2 id="kmd-h2">KMD H2</h2>
    <h3 id="kmd-h3">KMD H3</h3>
    <h4 id="kmd-h4">KMD H4</h4>
    <h5 id="kmd-h5">KMD H5</h5>
    <h6 id="kmd-h6">KMD H6</h6>
    <p id="kmd-p">KMD paragraph</p>
    <a id="kmd-link" href="#">KMD link</a>
    <code id="kmd-code">KMD code</code>
    <pre id="kmd-pre"><code>KMD pre</code></pre>
    <table id="kmd-table"><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>
    <blockquote id="kmd-blockquote">KMD quote</blockquote>
    <ul id="kmd-ul"><li>KMD item</li></ul>
    <ol id="kmd-ol"><li>KMD item</li></ol>
    <div class="table-wrapper" id="kmd-table-wrapper"><table><tr><td>Wrapped</td></tr></table></div>
    <div class="markdown-alert markdown-alert-note" id="kmd-alert"><p class="markdown-alert-title">NOTE</p><p>Body</p></div>
    <div class="shiki-code-block" id="kmd-shiki"><code>code</code></div>
    <div class="code-copy-button" id="kmd-copy-btn"><svg></svg></div>
    <div class="footnotes" id="kmd-footnotes"><ol><li>Footnote</li></ol></div>
    <div class="mermaid-placeholder" id="kmd-mermaid">Diagram</div>
  `;
  doc.body.appendChild(reader);

  return { reader, host };
}

describe("collision isolation", () => {
  beforeEach(() => {
    // Reset the document
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  describe("host styles do not leak into .kmd-reader", () => {
    it("should not inherit host font-family on reader root", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const fontFamily = getComputedStyle(reader).fontFamily;
      // kmd-reader should use --kmd-font-body (Inter/system-ui), NOT Comic Sans
      expect(fontFamily).not.toContain("Comic Sans");
      expect(fontFamily.toLowerCase()).toContain("inter");
    });

    it("should not inherit host color on reader root", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const color = getComputedStyle(reader).color;
      // Should be the dark theme body color, not host's red
      // Dark theme --kmd-color-body = --kmd-color-on-surface = #e8eaed → rgb(232, 234, 237)
      expect(color).not.toBe("rgb(255, 0, 0)");
    });

    it("should not inherit host background-color on reader root", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const bg = getComputedStyle(reader).backgroundColor;
      // Should be dark theme background, not host's green
      expect(bg).not.toBe("rgb(0, 255, 0)");
    });

    it("should not inherit host font-size on reader root", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const fontSize = getComputedStyle(reader).fontSize;
      // Should be 17px (--kmd-font-size-body-md), not 99px
      expect(fontSize).not.toBe("99px");
    });

    it("should not inherit host line-height on reader root", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const lineHeight = getComputedStyle(reader).lineHeight;
      // Should be ~1.62, not 9.9
      expect(lineHeight).not.toBe("9.9");
    });

    it("should style reader headings with kmd tokens, not host values", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const h1 = reader.querySelector("#kmd-h1") as HTMLElement;
      const style = getComputedStyle(h1);
      // kmd-reader h1 should use --kmd-color-heading (dark: #e8eaed → rgb(232, 234, 237))
      // NOT host's magenta rgb(255, 0, 255)
      expect(style.color).not.toBe("rgb(255, 0, 255)");
      // Font size should be 34px, not 88px
      expect(style.fontSize).toBe("34px");
      // Font weight should be 700, not 100
      expect(style.fontWeight).toBe("700");
    });

    it("should style reader links with kmd tokens, not host values", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const link = reader.querySelector("#kmd-link") as HTMLElement;
      const style = getComputedStyle(link);
      // Should use --kmd-color-link (dark: #9b6dff → rgb(155, 109, 255))
      // NOT host's purple rgb(128, 0, 128)
      expect(style.color).not.toBe("rgb(128, 0, 128)");
    });

    it("should style reader code with kmd tokens, not host values", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const code = reader.querySelector("#kmd-code") as HTMLElement;
      const style = getComputedStyle(code);
      // Should use mono font, not Comic Sans
      expect(style.fontFamily).not.toContain("Comic Sans");
    });

    it("should style reader pre with kmd tokens, not host values", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const pre = reader.querySelector("#kmd-pre") as HTMLElement;
      const style = getComputedStyle(pre);
      // Should use dark code-bg, not host's yellow
      expect(style.backgroundColor).not.toBe("rgb(255, 255, 0)");
    });

    it("should style reader blockquote with kmd tokens, not host values", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const bq = reader.querySelector("#kmd-blockquote") as HTMLElement;
      const style = getComputedStyle(bq);
      // Border color should be kmd blockquote-border, not host's blue
      // Border width should be 3px, not 20px
      expect(style.borderLeftWidth).not.toBe("20px");
    });

    it("should not inherit host list styles", () => {
      injectStyles(document);
      const { reader } = createHostPage(document);

      const ul = reader.querySelector("#kmd-ul") as HTMLElement;
      const style = getComputedStyle(ul);
      // Padding should be --kmd-space-lg (24px), not 99px
      expect(style.paddingLeft).not.toBe("99px");
    });
  });

  describe("kmd styles do not leak out to host elements", () => {
    it("should not style host headings outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const h1 = document.getElementById("host-h1") as HTMLElement;
      const style = getComputedStyle(h1);
      // Host h1 should keep its own magenta color, not kmd heading color
      expect(style.color).toBe("rgb(255, 0, 255)");
      // Host h1 font-size should be 88px, not kmd's 34px
      expect(style.fontSize).toBe("88px");
      // Host h1 font-weight should be 100, not kmd's 700
      expect(style.fontWeight).toBe("100");
    });

    it("should not style host paragraphs outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const p = document.getElementById("host-p") as HTMLElement;
      const style = getComputedStyle(p);
      // Host p should be cyan, not kmd body color
      expect(style.color).toBe("rgb(0, 255, 255)");
    });

    it("should not style host links outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const link = document.getElementById("host-link") as HTMLElement;
      const style = getComputedStyle(link);
      // Host link should be purple rgb(128, 0, 128), not kmd link color
      expect(style.color).toBe("rgb(128, 0, 128)");
    });

    it("should not style host code outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const code = document.getElementById("host-code") as HTMLElement;
      const style = getComputedStyle(code);
      // Host code should be DeepPink, not kmd code color
      expect(style.color).toBe("rgb(255, 20, 147)");
    });

    it("should not style host pre outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const pre = document.getElementById("host-pre") as HTMLElement;
      const style = getComputedStyle(pre);
      // Host pre should have yellow bg, not kmd code-bg
      expect(style.backgroundColor).toBe("rgb(255, 255, 0)");
    });

    it("should not style host tables outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const table = document.getElementById("host-table") as HTMLElement;
      const style = getComputedStyle(table);
      // Host table should have 10px border, not kmd's collapse
      expect(style.borderWidth).toBe("10px");
    });

    it("should not style host blockquotes outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const bq = document.getElementById("host-blockquote") as HTMLElement;
      const style = getComputedStyle(bq);
      // Host blockquote should have 20px left border (blue), not kmd's 3px
      expect(style.borderLeftWidth).toBe("20px");
    });

    it("should not style host buttons outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const btn = document.getElementById("host-button") as HTMLElement;
      // .code-copy-button styles should not affect host button
      const style = getComputedStyle(btn);
      expect(style.opacity).not.toBe("0");
    });

    it("should not affect host .container class outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const container = document.getElementById("host-container") as HTMLElement;
      const style = getComputedStyle(container);
      // Host .container should have max-width 1234px, not kmd's content-max
      expect(style.maxWidth).toBe("1234px");
    });

    it("should not affect host .content class outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const content = document.getElementById("host-content") as HTMLElement;
      const style = getComputedStyle(content);
      // Host .content font-size should be 55px (from host style)
      expect(style.fontSize).toBe("55px");
    });

    it("should not affect host .sidebar class outside .kmd-reader", () => {
      injectStyles(document);
      createHostPage(document);

      const sidebar = document.getElementById("host-sidebar") as HTMLElement;
      const style = getComputedStyle(sidebar);
      // Host .sidebar width should be 999px, not kmd's sidebar width
      expect(style.width).toBe("999px");
    });
  });

  describe("consumer overrides work through documented custom properties", () => {
    it("should allow overriding --kmd-color-link via a parent selector", () => {
      injectStyles(document);

      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-kmd-theme", "dark");
      // Override the link color through the documented custom property
      const overrideStyle = document.createElement("style");
      overrideStyle.textContent = `
        [data-kmd-theme="dark"] {
          --kmd-color-link: #ff6b6b;
        }
      `;
      document.head.appendChild(overrideStyle);

      const reader = document.createElement("div");
      reader.className = "kmd-reader";
      reader.innerHTML = `<a id="override-link" href="#">Link</a>`;
      wrapper.appendChild(reader);
      document.body.appendChild(wrapper);

      const link = reader.querySelector("#override-link") as HTMLElement;
      const style = getComputedStyle(link);
      // Should pick up the override #ff6b6b — happy-dom may return either
      // the hex string or the rgb() form, so check for the color value
      expect(style.color.toLowerCase()).toBe("#ff6b6b");
    });

    it("should allow overriding --kmd-font-body via a parent selector", () => {
      injectStyles(document);

      const overrideStyle = document.createElement("style");
      overrideStyle.textContent = `
        :root {
          --kmd-font-body: "My Custom Font", serif;
        }
      `;
      document.head.appendChild(overrideStyle);

      const reader = document.createElement("div");
      reader.className = "kmd-reader";
      reader.innerHTML = `<p id="override-p">Text</p>`;
      document.body.appendChild(reader);

      const p = reader.querySelector("#override-p") as HTMLElement;
      const style = getComputedStyle(p);
      expect(style.fontFamily).toContain("My Custom Font");
    });
  });
});
