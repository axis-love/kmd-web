// @vitest-environment happy-dom
//
// Theme-aware initialization and the re-render path (KWEB-055).
//
// Mermaid bakes colors into the SVG, so these tests pin down the two things
// that keep a live page from showing stale-colored diagrams: mermaid is
// re-initialized when the palette changes, and placeholders already drawn
// under the old palette are drawn again.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMock = vi.hoisted(() => ({
  initializeCalls: [] as Record<string, unknown>[],
  renderCalls: [] as string[],
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: (config: Record<string, unknown>) => {
      mermaidMock.initializeCalls.push(config);
    },
    render: async (_id: string, text: string) => {
      mermaidMock.renderCalls.push(text);
      return { svg: "<svg>rendered</svg>" };
    },
  },
}));

import {
  renderMermaidPlaceholders,
  resetMermaidState,
  resolveMermaidTheme,
  stopMermaidThemeWatch,
  watchMermaidTheme,
} from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIAGRAM = "flowchart TD\n  A --> B";

const DARK_TOKENS: Record<string, string> = {
  "--kmd-color-background": "#1a1c1f",
  "--kmd-color-surface": "#222428",
  "--kmd-color-surface-muted": "#2c2f35",
  "--kmd-color-on-surface": "#e8eaed",
  "--kmd-color-secondary": "#9aa0ab",
  "--kmd-color-border": "#3a3f48",
};

const LIGHT_TOKENS: Record<string, string> = {
  "--kmd-color-background": "#f5f7f8",
  "--kmd-color-surface": "#ffffff",
  "--kmd-color-surface-muted": "#eceff3",
  "--kmd-color-on-surface": "#15171a",
  "--kmd-color-secondary": "#626872",
  "--kmd-color-border": "#d8dee6",
};

function applyTokens(element: HTMLElement, tokens: Record<string, string>): void {
  for (const [name, value] of Object.entries(tokens)) {
    element.style.setProperty(name, value);
  }
}

function mountContainer(diagrams = 1): HTMLElement {
  const container = document.createElement("div");
  const encoded = Buffer.from(DIAGRAM, "utf-8").toString("base64");
  for (let i = 0; i < diagrams; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "mermaid-placeholder";
    placeholder.dataset.mermaidSource = encoded;
    const target = document.createElement("div");
    target.className = "mermaid-render-target";
    placeholder.appendChild(target);
    container.appendChild(placeholder);
  }
  document.body.appendChild(container);
  return container;
}

function placeholders(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".mermaid-placeholder")];
}

/** Let MutationObserver callbacks and the async renders they start settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function lastInitialize(): Record<string, unknown> | undefined {
  return mermaidMock.initializeCalls.at(-1);
}

beforeEach(() => {
  resetMermaidState();
  mermaidMock.initializeCalls.length = 0;
  mermaidMock.renderCalls.length = 0;
});

afterEach(() => {
  resetMermaidState();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-kmd-theme");
});

// ---------------------------------------------------------------------------
// Theme-aware initialization
// ---------------------------------------------------------------------------

describe("theme-aware initialization", () => {
  it("initializes mermaid with the token-derived palette, not the hardcoded default", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);

    await renderMermaidPlaceholders(container);

    const config = lastInitialize();
    expect(config?.theme).toBe("base");
    expect(config?.theme).not.toBe("default");
    expect(config?.securityLevel).toBe("strict");
    expect(config?.startOnLoad).toBe(false);

    const variables = config?.themeVariables as Record<string, string>;
    expect(variables.lineColor).toBe("#e8eaed");
    expect(variables.clusterBorder).toBe("#9aa0ab");
    expect(variables.mainBkg).toBe("#2c2f35");
    expect(variables.textColor).toBe("#e8eaed");
    expect(variables.darkMode).toBe("true");
  });

  it("initializes with a built-in theme, and no variables, when tokens are absent", async () => {
    const container = mountContainer();
    container.setAttribute("data-kmd-theme", "dark");

    await renderMermaidPlaceholders(container);

    const config = lastInitialize();
    expect(config?.theme).toBe("dark");
    expect(config?.themeVariables).toBeUndefined();
  });

  it("stamps each placeholder with the palette it was drawn under", async () => {
    const container = mountContainer(2);
    applyTokens(container, DARK_TOKENS);

    await renderMermaidPlaceholders(container);

    const expected = resolveMermaidTheme(container).id;
    for (const placeholder of placeholders(container)) {
      expect(placeholder.dataset.mermaidRendered).toBe("true");
      expect(placeholder.dataset.mermaidTheme).toBe(expected);
    }
  });

  it("does not re-initialize mermaid while the palette is unchanged", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);

    await renderMermaidPlaceholders(container);
    const afterFirst = mermaidMock.initializeCalls.length;

    const second = mountContainer();
    applyTokens(second, DARK_TOKENS);
    await renderMermaidPlaceholders(second);

    expect(afterFirst).toBe(1);
    expect(mermaidMock.initializeCalls.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Re-render path
// ---------------------------------------------------------------------------

describe("re-render on theme change", () => {
  it("skips placeholders already drawn under the current palette", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);

    await renderMermaidPlaceholders(container);
    expect(mermaidMock.renderCalls.length).toBe(1);

    await renderMermaidPlaceholders(container);
    expect(mermaidMock.renderCalls.length).toBe(1);
  });

  it("re-renders placeholders drawn under a different palette", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);
    await renderMermaidPlaceholders(container);
    const darkId = placeholders(container)[0]?.dataset.mermaidTheme;

    applyTokens(container, LIGHT_TOKENS);
    await renderMermaidPlaceholders(container);

    expect(mermaidMock.renderCalls.length).toBe(2);
    const lightId = placeholders(container)[0]?.dataset.mermaidTheme;
    expect(lightId).toBeDefined();
    expect(lightId).not.toBe(darkId);
  });

  it("re-initializes mermaid with the new palette before redrawing", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);
    await renderMermaidPlaceholders(container);

    applyTokens(container, LIGHT_TOKENS);
    await renderMermaidPlaceholders(container);

    expect(mermaidMock.initializeCalls.length).toBe(2);
    const variables = lastInitialize()?.themeVariables as Record<string, string>;
    expect(variables.lineColor).toBe("#15171a");
    expect(variables.clusterBorder).toBe("#626872");
    expect(variables.textColor).toBe("#15171a");
    expect(variables.darkMode).toBe("false");
  });

  it("redraws automatically when the host toggles the theme on a live page", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");

    await renderMermaidPlaceholders(container);
    expect(mermaidMock.renderCalls.length).toBe(1);
    const before = placeholders(container)[0]?.dataset.mermaidTheme;

    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(2);
    expect(lastInitialize()?.theme).toBe("default");
    const after = placeholders(container)[0]?.dataset.mermaidTheme;
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });

  it("settles on the newest palette when the theme is toggled twice in a row", async () => {
    const container = mountContainer();
    applyTokens(container, DARK_TOKENS);
    await renderMermaidPlaceholders(container);

    applyTokens(container, LIGHT_TOKENS);
    applyTokens(container, { ...DARK_TOKENS, "--kmd-color-on-surface": "#c0c6d0" });
    await settle();

    const expected = resolveMermaidTheme(container).id;
    for (const placeholder of placeholders(container)) {
      expect(placeholder.dataset.mermaidTheme).toBe(expected);
    }
    const variables = lastInitialize()?.themeVariables as Record<string, string>;
    expect(variables.lineColor).toBe("#c0c6d0");
  });

  it("leaves diagrams alone when an unrelated attribute changes", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");
    await renderMermaidPlaceholders(container);

    document.documentElement.classList.add("some-host-class");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(1);
    document.documentElement.classList.remove("some-host-class");
  });

  it("does not watch when watchTheme is false", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");

    await renderMermaidPlaceholders(container, { watchTheme: false });
    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(1);
  });

  it("does not watch when the caller pins a palette", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");
    const pinned = resolveMermaidTheme(container);

    await renderMermaidPlaceholders(container, { theme: pinned });
    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(1);
    expect(lastInitialize()?.theme).toBe(pinned.theme);
  });
});

// ---------------------------------------------------------------------------
// Watcher lifecycle
// ---------------------------------------------------------------------------

describe("watchMermaidTheme", () => {
  it("returns the same disposer for a container watched twice", () => {
    const container = mountContainer();
    expect(watchMermaidTheme(container)).toBe(watchMermaidTheme(container));
  });

  it("stops re-rendering once disposed", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");
    await renderMermaidPlaceholders(container);

    stopMermaidThemeWatch(container);
    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(1);
  });

  it("disposes itself once the container leaves the document", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");
    await renderMermaidPlaceholders(container);
    const original = watchMermaidTheme(container);

    container.remove();
    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(1);
    // The watcher let go of the detached container, so it is no longer
    // registered — re-watching hands back a fresh disposer.
    expect(watchMermaidTheme(container)).not.toBe(original);
  });

  it("is a no-op in an environment without MutationObserver", () => {
    const bare = { ownerDocument: { defaultView: {} } } as unknown as HTMLElement;
    expect(() => watchMermaidTheme(bare)()).not.toThrow();
  });

  it("is torn down by resetMermaidState", async () => {
    const container = mountContainer();
    document.documentElement.setAttribute("data-kmd-theme", "dark");
    await renderMermaidPlaceholders(container);

    resetMermaidState();
    mermaidMock.renderCalls.length = 0;

    document.documentElement.setAttribute("data-kmd-theme", "light");
    await settle();

    expect(mermaidMock.renderCalls.length).toBe(0);
  });
});
