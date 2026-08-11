import type { DesignThemeInfo } from "@axis-love/browser";
import { MarkdownReader } from "@axis-love/kmd-web/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
// Loaded as raw strings at build time via Vite's ?raw suffix so the demo
// showcases kmd-web rendering real .md files (not hardcoded strings).
import emberDesign from "./sample-design.md?raw";
import demoDoc from "./sample-doc-showcase.md?raw";
import thoughtstreamDesign from "./thoughtstream-DESIGN.md?raw";

// ?design=1|thoughtstream|ember pins a designMD theme on for this load —
// pairs with the ?theme=light|dark pin, so all four combinations are
// reviewable by URL alone:
//   ?theme=dark                  kmd default dark
//   ?theme=light                 kmd default light
//   ?design=1&theme=dark         designMD extracted dark
//   ?design=1&theme=light        designMD extracted light
const designParam = new URLSearchParams(location.search).get("design");
const designPinned = designParam !== null && designParam !== "0";
const pinnedDesignDoc = designParam === "ember" ? emberDesign : thoughtstreamDesign;

function App() {
  const [useDesign, setUseDesign] = useState(designPinned);

  const onDesignTheme = (info: DesignThemeInfo) => {
    // Surface the outcome for demo/debugging purposes — a real host would
    // route diagnostics to its own UI.
    console.log("kmd design theme:", info.applied ? "applied" : "not applied", info.diagnostics);
  };

  return (
    <>
      <label className="design-toggle">
        <input
          type="checkbox"
          checked={useDesign}
          onChange={(e) => setUseDesign(e.currentTarget.checked)}
        />
        Custom design.md theme ({designParam === "ember" ? "Ember" : "ThoughtStream"})
      </label>
      <MarkdownReader
        source={demoDoc}
        designSource={useDesign ? pinnedDesignDoc : undefined}
        onDesignTheme={onDesignTheme}
      />
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render((<App />) as ReactNode);
