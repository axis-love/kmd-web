# Styling and Theming

kmd-web's visual design is built entirely on CSS custom properties (variables). There are no `@font-face` declarations and no inline stylesheets generated at runtime — all reader styles live in `@axis-love/styles` and are scoped to specific class selectors.

## Import

```css
/* Direct from the styles package */
@import "@axis-love/styles/styles.css";
```

```js
// Or via JS import (bundler will include the CSS)
import "@axis-love/styles/styles.css";
```

```js
// Or via the kmd-web convenience package
import "@axis-love/kmd-web/styles.css";
```

The `@axis-love/react` package imports `@axis-love/styles/styles.css` automatically, so React consumers do not need a separate CSS import.

## Package exports

`@axis-love/styles` exports the following entry points (defined in `package.json`):

| Export path | Contents |
|---|---|
| `@axis-love/styles/styles.css` | Full scoped reader CSS (imports `tokens.css`) — the main entry point |
| `@axis-love/styles/tokens.css` | Re-exports `generated/tokens.css` |
| `@axis-love/styles/generated/tokens.css` | Generated design tokens (all `--kmd-*` custom properties) |
| `@axis-love/styles/generated/unity-tokens.json` | Unity-compatible token JSON (for native consumers) |
| `@axis-love/styles` (JS) | `TOKENS_VERSION`, `STYLES_VERSION`, `TOKEN_THEMES`, `DEFAULT_THEME` |

## CSS custom properties

All design tokens are CSS custom properties prefixed with `--kmd-`. The color tokens are the primary theming surface.

### Color tokens

These tokens are defined per-theme and can be overridden:

| Token | Description |
|---|---|
| `--kmd-color-primary` | Primary text/headings color |
| `--kmd-color-secondary` | Secondary/muted text color |
| `--kmd-color-tertiary` | Accent/highlight color |
| `--kmd-color-neutral` | Background/neutral color |
| `--kmd-color-surface` | Card/surface background |
| `--kmd-color-surface-muted` | Muted surface (code blocks, hover) |
| `--kmd-color-on-primary` | Text color on primary-colored surfaces |
| `--kmd-color-on-surface` | Text color on surface-colored backgrounds |
| `--kmd-color-border` | Border color |
| `--kmd-color-info` | Info alert color (blue) |
| `--kmd-color-success` | Success alert color (green) |
| `--kmd-color-warning` | Warning alert color (yellow) |
| `--kmd-color-danger` | Danger/error alert color (red) |
| `--kmd-color-code-bg` | Code block background |
| `--kmd-color-code-text` | Code block text color |
| `--kmd-color-blockquote-border` | Blockquote left border |
| `--kmd-color-blockquote-text` | Blockquote text color |
| `--kmd-color-table-border` | Table border color |
| `--kmd-color-table-header-bg` | Table header background |
| `--kmd-color-link` | Link color |
| `--kmd-color-link-hover` | Link hover color |
| `--kmd-color-selection-bg` | Text selection background |
| `--kmd-color-scrollbar-thumb` | Scrollbar thumb color |
| `--kmd-color-scrollbar-track` | Scrollbar track color |
| `--kmd-color-outline-depth-0` | Outline item at depth 0 (h1) |
| `--kmd-color-outline-depth-1` | Outline item at depth 1 (h2) |
| `--kmd-color-outline-depth-2` | Outline item at depth 2 (h3) |
| `--kmd-color-outline-depth-3` | Outline item at depth 3 (h4+) |
| `--kmd-color-outline-active-bg` | Active outline item background |
| `--kmd-color-outline-active-border` | Active outline item border |

### Semantic aliases

These reference other tokens and are defined per-theme:

| Token | Maps to |
|---|---|
| `--kmd-color-heading` | `var(--kmd-color-primary)` |
| `--kmd-color-body` | `var(--kmd-color-on-surface)` |
| `--kmd-color-muted` | `var(--kmd-color-secondary)` |
| `--kmd-color-accent` | `var(--kmd-color-tertiary)` |
| `--kmd-color-background` | `var(--kmd-color-neutral)` |
| `--kmd-color-card` | `var(--kmd-color-surface)` |

### Non-color tokens

Defined in `generated/tokens.css` (not theme-dependent):

| Token | Example value | Description |
|---|---|---|
| `--kmd-font-body` | `"Inter", system-ui, -apple-system, sans-serif` | Body font stack |
| `--kmd-font-mono` | `"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", monospace` | Mono font stack |
| `--kmd-font-size-headline-lg` | `34px` | H1 font size |
| `--kmd-font-size-headline-md` | `24px` | H2 font size |
| `--kmd-font-size-h3` | `20px` | H3 font size |
| `--kmd-font-size-body-md` | `17px` | Body font size |
| `--kmd-font-size-body-sm` | `14px` | Small body font size |
| `--kmd-font-size-code-md` | `14px` | Code font size |
| `--kmd-font-size-label-caps` | `12px` | Label/caps font size |
| `--kmd-radius-sm` | `6px` | Small border radius |
| `--kmd-radius-md` | `8px` | Medium border radius |
| `--kmd-radius-lg` | `12px` | Large border radius |
| `--kmd-radius-xl` | `16px` | Extra-large border radius |
| `--kmd-space-xs` | `4px` | Extra-small spacing |
| `--kmd-space-sm` | `8px` | Small spacing |
| `--kmd-space-md` | `16px` | Medium spacing |
| `--kmd-space-lg` | `24px` | Large spacing |
| `--kmd-space-xl` | `36px` | Extra-large spacing |
| `--kmd-space-xxl` | `56px` | Double-extra-large spacing |
| `--kmd-width-content-max` | `800px` | Max content width |
| `--kmd-width-sidebar-width` | `240px` | Outline sidebar width |
| `--kmd-duration-fast` | `150ms` | Fast transition duration |
| `--kmd-duration-normal` | `250ms` | Normal transition duration |
| `--kmd-focus-outline-width` | `2px` | Focus ring width |
| `--kmd-focus-outline-color` | `var(--kmd-color-tertiary)` | Focus ring color |

## Themes

### Theme list

| Theme | Description | Where defined |
|---|---|---|
| `dark` | Default theme — dark background, light text | `:root` in `styles.css` and `generated/tokens.css` |
| `light` | Light background, dark text | `[data-theme="light"]`, `[data-kmd-theme="light"]`, `.kmd-theme-light` in `generated/tokens.css` |
| `sepia` | Warm filter on light — kmd-web-only variant | `[data-kmd-theme="sepia"]`, `.kmd-theme-sepia` in `styles.css` directly |

**Note**: `dark` and `light` are defined in `generated/tokens.css` (the generated file). `sepia` is a kmd-web-only theme defined directly in `styles.css` — it is not part of the generated token schema. The `TOKEN_THEMES` export from `@axis-love/styles` lists `["dark", "light"]` (the canonical schema themes); `sepia` is an additional kmd-web variant.

### Theme activation (3 equivalent methods)

All three methods are equivalent — use whichever fits your application:

```html
<!-- Method 1: data-theme attribute (original kmd attribute) -->
<div data-theme="dark">
  <div class="kmd-reader">...</div>
</div>

<!-- Method 2: data-kmd-theme attribute (kmd-web scoped) -->
<div data-kmd-theme="dark">
  <div class="kmd-reader">...</div>
</div>

<!-- Method 3: class-based -->
<div class="kmd-theme-dark">
  <div class="kmd-reader">...</div>
</div>
```

For `light`:

```html
<div data-theme="light">...</div>
<div data-kmd-theme="light">...</div>
<div class="kmd-theme-light">...</div>
```

For `sepia` (kmd-web-only — uses `data-kmd-theme` or class, not `data-theme`):

```html
<div data-kmd-theme="sepia">...</div>
<div class="kmd-theme-sepia">...</div>
```

The theme selectors cascade down — set the theme on a parent element and all `.kmd-reader` descendants inherit it.

### System preference fallback

When **no explicit theme** is set (no `data-theme`, `data-kmd-theme`, or `.kmd-theme-*` class), the `@media (prefers-color-scheme: light)` media query applies the light theme tokens:

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme]):not([data-kmd-theme]):not(.kmd-theme-light):not(.kmd-theme-dark):not(.kmd-theme-sepia) {
    /* Light theme tokens */
  }
}
```

This means: if the user's OS is set to light mode and you haven't explicitly set a theme, kmd-web uses the light theme automatically.

## Font fallback policy

kmd-web uses **no `@font-face` declarations**. Fonts are expected to be distributed separately by the host (KWEB-026). The CSS uses font-family stacks with system fallbacks.

### Body font

```css
--kmd-font-body: "Inter", system-ui, -apple-system, sans-serif;
```

Fallback chain: `Inter` → `system-ui` → `-apple-system` → `sans-serif`

### Mono font

```css
--kmd-font-mono: "SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
```

Fallback chain: `SF Mono` → `Fira Code` → `Cascadia Code` → `JetBrains Mono` → `monospace`

## CSS scope

All reader styles are scoped under `.kmd-reader`. Document layout styles are scoped under `.kmd-document-shell`.

| Scope class | Purpose |
|---|---|
| `.kmd-reader` | Root scope for all reader body styles — headings, paragraphs, code, tables, blockquotes, lists, alerts, Mermaid, KaTeX, copy buttons, scrollbar, selection |
| `.kmd-document-shell` | Document layout — outline sidebar + content area, outline toggle button |
| `.kmd-reader-content` | Content container (managed by `BrowserReader`) |

This scoping means kmd-web styles will not leak into your application's CSS, and your application's styles will not accidentally affect the reader content (as long as you don't override `.kmd-reader` tokens globally).

## Override guide

### Override individual tokens

Override any `--kmd-*` custom property by setting it on `.kmd-reader` or a parent element:

```css
/* Override the primary color for a specific reader instance */
.my-app .kmd-reader {
  --kmd-color-primary: #ff6b00;
  --kmd-color-heading: #ff6b00;
}

/* Override the link color globally */
:root {
  --kmd-color-link: #0066cc;
  --kmd-color-link-hover: #0052a3;
}

/* Override the code block background */
.kmd-reader {
  --kmd-color-code-bg: #1e1e2e;
  --kmd-color-code-text: #cdd6f4;
}
```

### Add a custom theme

Define a new theme by setting color tokens under a custom selector:

```css
/* Custom "midnight" theme */
[data-kmd-theme="midnight"],
.kmd-theme-midnight {
  --kmd-color-primary: #e0e0e0;
  --kmd-color-secondary: #888888;
  --kmd-color-tertiary: #bb86fc;
  --kmd-color-neutral: #121212;
  --kmd-color-surface: #1e1e1e;
  --kmd-color-surface-muted: #2d2d2d;
  --kmd-color-on-primary: #121212;
  --kmd-color-on-surface: #e0e0e0;
  --kmd-color-border: #333333;
  --kmd-color-info: #82b1ff;
  --kmd-color-success: #69f0ae;
  --kmd-color-warning: #ffd740;
  --kmd-color-danger: #ff5252;
  --kmd-color-code-bg: #1e1e1e;
  --kmd-color-code-text: #e0e0e0;
  --kmd-color-link: #bb86fc;
  --kmd-color-link-hover: #d0a3ff;

  /* Semantic aliases */
  --kmd-color-heading: var(--kmd-color-primary);
  --kmd-color-body: var(--kmd-color-on-surface);
  --kmd-color-muted: var(--kmd-color-secondary);
  --kmd-color-accent: var(--kmd-color-tertiary);
  --kmd-color-background: var(--kmd-color-neutral);
  --kmd-color-card: var(--kmd-color-surface);
}
```

Then activate it:

```html
<div data-kmd-theme="midnight">
  <div class="kmd-reader">...</div>
</div>
```

### Complete token list for a custom theme

When creating a custom theme, you should define at minimum these tokens:

```
--kmd-color-primary
--kmd-color-secondary
--kmd-color-tertiary
--kmd-color-neutral
--kmd-color-surface
--kmd-color-surface-muted
--kmd-color-on-primary
--kmd-color-on-surface
--kmd-color-border
--kmd-color-info
--kmd-color-success
--kmd-color-warning
--kmd-color-danger
--kmd-color-code-bg
--kmd-color-code-text
--kmd-color-blockquote-border
--kmd-color-blockquote-text
--kmd-color-table-border
--kmd-color-table-header-bg
--kmd-color-link
--kmd-color-link-hover
--kmd-color-selection-bg
--kmd-color-scrollbar-thumb
--kmd-color-scrollbar-track
--kmd-color-outline-depth-0
--kmd-color-outline-depth-1
--kmd-color-outline-depth-2
--kmd-color-outline-depth-3
--kmd-color-outline-active-bg
--kmd-color-outline-active-border
```

Plus the semantic aliases:
```
--kmd-color-heading
--kmd-color-body
--kmd-color-muted
--kmd-color-accent
--kmd-color-background
--kmd-color-card
```

## Sepia theme values

The sepia theme (kmd-web-only, defined in `styles.css`):

| Token | Value |
|---|---|
| `--kmd-color-primary` | `#3b2f1f` |
| `--kmd-color-secondary` | `#7a6a55` |
| `--kmd-color-tertiary` | `#8b6914` |
| `--kmd-color-neutral` | `#f4ecd8` |
| `--kmd-color-surface` | `#faf3e0` |
| `--kmd-color-surface-muted` | `#efe6cf` |
| `--kmd-color-on-primary` | `#faf3e0` |
| `--kmd-color-on-surface` | `#3b2f1f` |
| `--kmd-color-border` | `#d4c4a8` |
| `--kmd-color-code-bg` | `#efe6cf` |
| `--kmd-color-code-text` | `#3b2f1f` |
| `--kmd-color-link` | `#8b6914` |
| `--kmd-color-link-hover` | `#a47d1a` |

## Media queries

`styles.css` includes several media queries. These use `!important` **intentionally** — the values override normal cascading to ensure accessibility and print behavior:

### Print (`@media print`)

Hides interactive elements (outline sidebar, toggle button, copy buttons), sets black-on-white text, prevents page breaks inside headings/code/tables:

```css
@media print {
  .kmd-document-shell .kmd-outline-sidebar,
  .kmd-document-shell .kmd-outline-toggle,
  .kmd-reader .code-copy-button {
    display: none !important;
  }
  .kmd-reader {
    background-color: #ffffff;
    color: #000000;
  }
  /* ... break-after: avoid, break-inside: avoid ... */
}
```

### High contrast (`@media prefers-contrast: high`)

Increases border widths and adjusts colors for users who need higher contrast:

```css
@media (prefers-contrast: high) {
  .kmd-reader {
    --kmd-color-border: var(--kmd-color-on-surface);
  }
  .kmd-reader blockquote { border-left-width: 4px; }
  .kmd-reader .markdown-alert { border-left-width: 5px; }
  .kmd-reader .code-copy-button { border-width: 2px; opacity: 1; }
  .kmd-reader .kmd-outline-item.active { border-left-width: 3px; }
}
```

### Reduced motion (`@media prefers-reduced-motion: reduce`)

Disables all transitions and animations. Defined in both `styles.css` (scoped) and `generated/tokens.css` (global reset):

```css
@media (prefers-reduced-motion: reduce) {
  .kmd-reader *,
  .kmd-reader *::before,
  .kmd-reader *::after,
  .kmd-document-shell *,
  .kmd-document-shell *::before,
  .kmd-document-shell *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Examples

### Example: override primary color

```css
:root {
  --kmd-color-primary: #0066ff;
  --kmd-color-heading: #0066ff;
}
```

### Example: create custom theme

```css
/* Define the theme */
[data-kmd-theme="forest"],
.kmd-theme-forest {
  --kmd-color-primary: #e8f5e9;
  --kmd-color-secondary: #81c784;
  --kmd-color-tertiary: #4caf50;
  --kmd-color-neutral: #1b2e1b;
  --kmd-color-surface: #2e4a2e;
  --kmd-color-surface-muted: #3d5c3d;
  --kmd-color-on-primary: #1b2e1b;
  --kmd-color-on-surface: #e8f5e9;
  --kmd-color-border: #4a6a4a;
  --kmd-color-info: #66bb6a;
  --kmd-color-success: #4caf50;
  --kmd-color-warning: #ff9800;
  --kmd-color-danger: #f44336;
  --kmd-color-code-bg: #2e4a2e;
  --kmd-color-code-text: #e8f5e9;
  --kmd-color-link: #66bb6a;
  --kmd-color-link-hover: #81c784;

  --kmd-color-heading: var(--kmd-color-primary);
  --kmd-color-body: var(--kmd-color-on-surface);
  --kmd-color-muted: var(--kmd-color-secondary);
  --kmd-color-accent: var(--kmd-color-tertiary);
  --kmd-color-background: var(--kmd-color-neutral);
  --kmd-color-card: var(--kmd-color-surface);
}

/* Use it */
```

```html
<div data-kmd-theme="forest">
  <div class="kmd-reader">...</div>
</div>
```