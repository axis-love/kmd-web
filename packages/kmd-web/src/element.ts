// kmd-web convenience entry point — Web Component subpath
// Re-exports the full @axis-love/element surface for consumers who
// install the convenience package.

export type { DocumentTarget, HostCapabilities } from "@axis-love/browser";
export type { OutlineEntry, RenderOptions, RenderResult } from "@axis-love/contracts";
export type {
  KmdActiveHeadingChangeDetail,
  KmdCopyDetail,
  KmdErrorDetail,
  KmdLinkDocumentDetail,
  KmdLinkExternalDetail,
  KmdOutlineChangeDetail,
  KmdRenderedDetail,
} from "@axis-love/element";
export { ELEMENT_VERSION, KmdReaderElement, registerKmdReader } from "@axis-love/element";
