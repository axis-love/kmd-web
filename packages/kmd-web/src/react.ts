// kmd-web convenience entry point — React subpath
// Re-exports the full @axis-love/react surface for consumers who
// install the convenience package.

// Re-export types that React consumers commonly need
export type { HostCapabilities } from "@axis-love/browser";
export type { OutlineEntry, RenderOptions } from "@axis-love/contracts";
export type {
  DocumentShellProps,
  MarkdownReaderProps,
  UseMarkdownReaderResult,
} from "@axis-love/react";
export {
  DocumentShell,
  MarkdownReader,
  REACT_PACKAGE_VERSION,
  useMarkdownReader,
  useOutline,
  useScrollTracking,
} from "@axis-love/react";
