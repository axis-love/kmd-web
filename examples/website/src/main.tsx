import { MarkdownReader } from "@axis-love/kmd-web/react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
// Loaded as a raw string at build time via Vite's ?raw suffix so the demo
// showcases kmd-web rendering a real .md file (not a hardcoded string).
import demoDoc from "./sample-doc-showcase.md?raw";

function App() {
  return <MarkdownReader source={demoDoc} />;
}

const root = createRoot(document.getElementById("root")!);
root.render((<App />) as ReactNode);
