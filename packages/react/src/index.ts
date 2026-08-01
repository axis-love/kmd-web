// @axis-love/react
// React components: <MarkdownReader>, <DocumentShell>, and hooks.
// React and ReactDOM are peer dependencies — never bundled.

import type { FC, ReactNode } from "react";

export const REACT_PACKAGE_VERSION = "0.1.0";

/**
 * Placeholder MarkdownReader component.
 * Production implementation arrives in KWEB-013.
 */
export const MarkdownReader: FC<{ source: string }> = () => {
  return null;
};

/**
 * Placeholder DocumentShell component.
 * Production implementation arrives in KWEB-013.
 */
export const DocumentShell: FC<{ children: ReactNode }> = () => {
  return null;
};
