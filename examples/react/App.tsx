// React example for @axis-love/kmd-web.
//
// Demonstrates:
// - <MarkdownReader> with theme switching (dark/light/sepia)
// - <DocumentShell> outline sidebar with active heading tracking
// - LinkHandler that opens external links in a new window
// - AssetResolver that resolves relative image paths
// - useScrollTracking hook for active heading
//
// All text rendering uses React JSX (no dangerouslySetInnerHTML outside the library).

import type {
  AssetRequest,
  HostCapabilities,
  OutlineEntry,
  ResolvedAsset,
} from "@axis-love/kmd-web";
import { DocumentShell, MarkdownReader } from "@axis-love/kmd-web/react";
import { useCallback, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Sample Markdown
// ---------------------------------------------------------------------------

const SAMPLE_MARKDOWN = `# kmd-web React Example

This example demonstrates the **React components** from \`@axis-love/kmd-web\`.

## Theme Switching

Use the buttons above to switch between **dark**, **light**, and **sepia** themes.

## Outline Tracking

As you scroll through the document, the outline sidebar highlights the
currently active heading via the \`useScrollTracking\` hook.

## External Links

Links like [example.com](https://example.com) open in a new window via the
\`LinkHandler\` capability — they never navigate the current page.

## Code Blocks

\`\`\`ts
import { MarkdownReader } from "@axis-love/kmd-web/react";

function App() {
  return <MarkdownReader source="# Hello" />;
}
\`\`\`

## Tables

| Feature       | Supported |
| ------------- | --------- |
| GFM Tables    | Yes       |
| Task Lists    | Yes       |
| Math (KaTeX)  | Yes       |
| Mermaid       | Yes       |

## Math

Inline: $E = mc^2$

Block:

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

## Nested Headings

### Sub-heading A

Content under sub-heading A.

### Sub-heading B

Content under sub-heading B.

## Conclusion

This example shows a complete reader experience with outline, theme
switching, and host capabilities.
`;

// ---------------------------------------------------------------------------
// Theme type
// ---------------------------------------------------------------------------

type Theme = "dark" | "light" | "sepia";

// ---------------------------------------------------------------------------
// AssetResolver — resolves relative image paths to absolute URLs.
// In a real app, this might fetch from a Rust backend and return blob: URLs.
// Here we resolve against a base URL using the URL constructor.
// ---------------------------------------------------------------------------

function createAssetResolver(baseUrl: string): HostCapabilities["assetResolver"] {
  return {
    async resolveAsset(request: AssetRequest): Promise<ResolvedAsset> {
      // Resolve relative paths against the base URL.
      try {
        const resolved = new URL(request.url, baseUrl);
        return {
          url: resolved.href,
          originalUrl: request.url,
        };
      } catch {
        // If the URL is invalid, return the original.
        return {
          url: request.url,
          originalUrl: request.url,
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// LinkHandler — opens external links in a new window.
// ---------------------------------------------------------------------------

function createLinkHandler(): HostCapabilities["linkHandler"] {
  return {
    async openExternal(url: URL): Promise<void> {
      window.open(url.href, "_blank", "noopener,noreferrer");
    },
    async openDocument(target): Promise<void> {
      // In a real app, this would load another markdown document.
      // For this example, we log it.
      console.log("openDocument:", target);
    },
  };
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>("dark");
  const [outline, setOutline] = useState<readonly OutlineEntry[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  // Refs for scroll tracking — the content container and scroll container.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Host capabilities — memoized so the MarkdownReader doesn't recreate.
  const capabilities: HostCapabilities = useMemo(
    () => ({
      assetResolver: createAssetResolver("https://example.com/docs/"),
      linkHandler: createLinkHandler(),
    }),
    [],
  );

  // Render options — enable all features.
  const renderOptions = useMemo(
    () => ({
      features: {
        codeHighlighting: true,
        mermaid: true,
        math: true,
        designDoc: true,
      },
      security: {
        allowRemoteImages: false,
      },
    }),
    [],
  );

  // --- Callbacks ---

  const handleOutlineChange = useCallback((newOutline: readonly OutlineEntry[]) => {
    setOutline(newOutline);
  }, []);

  const handleActiveHeadingChange = useCallback((slug: string | undefined) => {
    setActiveId(slug);
  }, []);

  const handleAnchorClick = useCallback((slug: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const target = container.querySelector(`[id="${slug}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error("MarkdownReader error:", error);
  }, []);

  const handleCopy = useCallback((message: string) => {
    console.log("Copied:", message);
  }, []);

  // --- Theme ---

  const themeClass = `kmd-theme-${theme}`;

  return (
    <div className={`app ${themeClass}`} data-kmd-theme={theme}>
      <header className="app-header">
        <h1>kmd-web React Example</h1>
        <div className="theme-switcher">
          <button type="button" onClick={() => setTheme("dark")}>
            Dark
          </button>
          <button type="button" onClick={() => setTheme("light")}>
            Light
          </button>
          <button type="button" onClick={() => setTheme("sepia")}>
            Sepia
          </button>
        </div>
      </header>

      <div className="app-body" ref={scrollContainerRef}>
        <DocumentShell
          outline={outline}
          activeId={activeId}
          onAnchorClick={handleAnchorClick}
          className="app-document-shell"
        >
          <div ref={contentRef}>
            <MarkdownReader
              source={SAMPLE_MARKDOWN}
              renderOptions={renderOptions}
              capabilities={capabilities}
              onOutlineChange={handleOutlineChange}
              onActiveHeadingChange={handleActiveHeadingChange}
              onError={handleError}
              onCopy={handleCopy}
            />
          </div>
        </DocumentShell>
      </div>
    </div>
  );
}
