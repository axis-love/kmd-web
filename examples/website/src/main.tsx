import type { DesignThemeInfo } from "@axis-love/browser";
import { MarkdownReader } from "@axis-love/kmd-web/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
// Loaded as raw strings at build time via Vite's ?raw suffix so the demo
// showcases kmd-web rendering a real .md file (not a hardcoded string).
import designDoc from "./sample-design.md?raw";
import demoDoc from "./sample-doc-showcase.md?raw";

// ?design=1 pins the custom designMD theme on for this load — pairs with the
// ?theme=light|dark pin for reviewing all four combinations.
const designPinned = new URLSearchParams(location.search).get("design") === "1";

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
        Custom design.md theme (Ember)
      </label>
      <MarkdownReader
        source={demoDoc}
        designSource={useDesign ? designDoc : undefined}
        onDesignTheme={onDesignTheme}
      />
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render((<App />) as ReactNode);
