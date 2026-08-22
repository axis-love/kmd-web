import type { DesignThemeInfo } from "@axis-love/browser";
import { MarkdownReader } from "@axis-love/kmd-web/react";
import type { ChangeEvent, ReactNode } from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
// Loaded as raw strings at build time via Vite's ?raw suffix so the demo
// showcases kmd-web rendering real .md files (not hardcoded strings).
import appleDesign from "./apple-DESIGN.md?raw";
import dylanDesign from "./dylanbrouwer-DESIGN.md?raw";
// The kmd desktop app's reference samples (D:/Projects/kmd/samples), verbatim.
import kmdApple from "./kmd-samples/apple-DESIGN.md?raw";
import kmdDylan from "./kmd-samples/dylanbrouwer-DESIGN.md?raw";
import kmdNyx from "./kmd-samples/nyx-DESIGN.md?raw";
import kmdShopvibe from "./kmd-samples/shopvibe-DESIGN.md?raw";
import kmdThoughtstream from "./kmd-samples/thoughtstream-DESIGN.md?raw";
import emberDesign from "./sample-design.md?raw";
import demoDoc from "./sample-doc-showcase.md?raw";
import thoughtstreamDesign from "./thoughtstream-DESIGN.md?raw";

// Built-in design systems for the ?design= picker. "1" stays an alias for
// thoughtstream so older review URLs keep working.
const DESIGN_SYSTEMS: Record<string, { label: string; source: string }> = {
  thoughtstream: { label: "ThoughtStream (zen serif)", source: thoughtstreamDesign },
  ember: { label: "Ember (warm paper)", source: emberDesign },
  apple: { label: "Apple HIG (SF Pro)", source: appleDesign },
  dylan: { label: "Dylan Brouwer (terracotta)", source: dylanDesign },
  "kmd-apple": { label: "kmd sample: Apple", source: kmdApple },
  "kmd-dylan": { label: "kmd sample: Dylan Brouwer", source: kmdDylan },
  "kmd-nyx": { label: "kmd sample: Nyx (dark)", source: kmdNyx },
  "kmd-shopvibe": { label: "kmd sample: ShopVibe", source: kmdShopvibe },
  "kmd-thoughtstream": { label: "kmd sample: ThoughtStream", source: kmdThoughtstream },
};

// URL pins for reviewing combinations without touching the UI:
//   ?theme=light|dark              pins the kmd theme (index.html boot script)
//   ?design=<name>|1|off           pins a design system ("1" = thoughtstream)
const param = new URLSearchParams(location.search).get("design");
const initialKey =
  param === null || param === "off" || param === "0"
    ? "off"
    : param === "1" || DESIGN_SYSTEMS[param] === undefined
      ? "thoughtstream"
      : param;

function App() {
  const [designKey, setDesignKey] = useState(initialKey);
  const [customSource, setCustomSource] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const designSource =
    designKey === "custom" ? (customSource ?? undefined) : DESIGN_SYSTEMS[designKey]?.source;

  const onDesignTheme = (info: DesignThemeInfo) => {
    const issues = info.diagnostics.map((d) => d.message).join(" | ");
    setStatus(
      designSource === undefined
        ? ""
        : info.applied
          ? `applied (${designKey === "custom" ? customName : designKey})${issues ? ` — ${issues}` : ""}`
          : `NOT applied — ${issues || "no themeable tokens found"}`,
    );
    console.log("kmd design theme:", info);
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomSource(String(reader.result ?? ""));
      setCustomName(file.name);
      setDesignKey("custom");
    };
    reader.readAsText(file);
    // Allow re-selecting the same file after edits.
    e.currentTarget.value = "";
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    html.style.backgroundColor = next === "dark" ? "#222428" : "#ffffff";
  };

  return (
    <>
      <div className="design-toggle">
        <label>
          design.md:{" "}
          <select value={designKey} onChange={(e) => setDesignKey(e.currentTarget.value)}>
            <option value="off">kmd default (off)</option>
            {Object.entries(DESIGN_SYSTEMS).map(([key, d]) => (
              <option key={key} value={key}>
                {d.label}
              </option>
            ))}
            {customSource !== null && <option value="custom">Custom: {customName}</option>}
          </select>
        </label>
        <label className="design-file">
          Open design.md…
          <input type="file" accept=".md,.markdown,text/markdown" onChange={onPickFile} hidden />
        </label>
        <button type="button" onClick={toggleTheme}>
          light/dark
        </button>
        {status && <span className="design-status">{status}</span>}
      </div>
      <MarkdownReader source={demoDoc} designSource={designSource} onDesignTheme={onDesignTheme} />
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render((<App />) as ReactNode);
