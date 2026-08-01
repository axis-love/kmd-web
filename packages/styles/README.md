# @axis-love/styles

Scoped reader CSS and generated design tokens for the kmd-web ecosystem.

## Architecture

```
packages/styles/
  src/
    index.ts          — exports (token metadata constants)
    tokens.css         — re-exports generated tokens for CSS consumers
    styles.css         — reader styles using the generated tokens
  tokens/
    schema.json        — JSON Schema for the canonical token data
    tokens.json        — canonical token data (the source of truth)
    generate.ts        — generator script (reads schema + data, outputs CSS + JSON)
  generated/
    tokens.css         — generated CSS custom properties (do not edit)
    unity-tokens.json  — generated Unity-consumable token data (do not edit)
  src/tokens.test.ts   — schema validation, coverage, and idempotence tests
  src/index.test.ts    — package export tests
```

## Token pipeline

1. **Canonical source**: `tokens/tokens.json` is the single source of truth for all cross-platform design tokens. Every token — colors, typography, spacing, radii, widths, motion, accessibility — is defined here with metadata and per-theme values.

2. **Schema validation**: `tokens/schema.json` is a JSON Schema (draft 2020-12) that constrains the token data structure. The generator validates the data against this schema before generating any output. The test suite independently verifies schema compliance.

3. **Generator**: `tokens/generate.ts` reads the canonical token data, validates it, and produces two deterministic outputs:
   - `generated/tokens.css` — CSS custom properties with `--kmd-` prefix, organized as `:root` (theme-independent tokens) and `[data-theme="dark"]` / `[data-theme="light"]` (color tokens).
   - `generated/unity-tokens.json` — Unity-consumable data with all `var()` references resolved to concrete values and platform exceptions applied.

4. **Idempotence**: Running the generator twice produces byte-identical output. The test suite verifies this by running the generator in-process and comparing outputs.

## Token versioning

The token schema is versioned with a `version` field in `tokens/tokens.json` (currently `1.0.0`). This version follows semantic versioning:

- **Major**: token names removed, renamed, or semantics changed in a breaking way.
- **Minor**: new tokens added, new theme variants added, or new token categories added.
- **Patch**: token values adjusted without structural changes.

The version is exported as `TOKENS_VERSION` from the package entry point and embedded in the generated file headers.

## Generated file ownership

Files under `generated/` are **machine-generated**. Do not edit them directly. To change a token value:

1. Edit `tokens/tokens.json`.
2. Run `npx tsx packages/styles/tokens/generate.ts` from the repository root.
3. Commit both the changed `tokens/tokens.json` and the regenerated `generated/` files.

CI can detect manually edited generated output by running the generator and checking for a diff.

## CSS custom properties

All CSS custom properties use the `--kmd-` prefix to avoid collisions with host application styles. Consumers can override any supported CSS variable:

```css
/* Override the accent color */
[data-theme="dark"] {
  --kmd-color-tertiary: #ff6b6b;
}

/* Override the body font */
:root {
  --kmd-font-body: "My Font", sans-serif;
}
```

### Naming convention

| Category | Prefix | Example |
|---|---|---|
| Colors | `--kmd-color-` | `--kmd-color-primary`, `--kmd-color-surface` |
| Semantic colors | `--kmd-color-` | `--kmd-color-heading`, `--kmd-color-body` |
| Font families | `--kmd-font-` | `--kmd-font-body`, `--kmd-font-mono` |
| Font sizes | `--kmd-font-size-` | `--kmd-font-size-body-md` |
| Font weights | `--kmd-font-weight-` | `--kmd-font-weight-headline-lg` |
| Line heights | `--kmd-line-height-` | `--kmd-line-height-body-md` |
| Letter spacing | `--kmd-letter-spacing-` | `--kmd-letter-spacing-label-caps` |
| Spacing | `--kmd-space-` | `--kmd-space-md` |
| Radii | `--kmd-radius-` | `--kmd-radius-lg` |
| Widths | `--kmd-width-` | `--kmd-width-content-max` |
| Motion durations | `--kmd-duration-` | `--kmd-duration-normal` |
| Motion easings | `--kmd-easing-` | `--kmd-easing-ease` |
| Focus outline | `--kmd-focus-outline-` | `--kmd-focus-outline-width` |

## Font fallbacks

The kmd-web reader uses system font stacks, not bundled font binaries. The canonical token data specifies CSS font-family stacks for web and single-font-name fallbacks for Unity:

| Token | Web (CSS) | Unity |
|---|---|---|
| `font-body` | `"Inter", system-ui, -apple-system, sans-serif` | `Inter` |
| `font-mono` | `"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", monospace` | `Roboto Mono` |

**No font binaries are bundled.** The web stack relies on system-installed Inter (or falls back to system-ui). Unity consumers must provide the font asset themselves.

### Font license metadata

- **Inter**: SIL Open Font License 1.1. See https://github.com/rsms/inter
- **SF Mono**: Apple proprietary. Available on macOS/iOS. Not redistributable.
- **Fira Code**: SIL Open Font License 1.1. See https://github.com/tonsky/FiraCode
- **Cascadia Code**: SIL Open Font License 1.1. See https://github.com/microsoft/cascadia-code
- **JetBrains Mono**: SIL Open Font License 1.1. See https://www.jetbrains.com/lp/mono/
- **Roboto Mono**: Apache License 2.0. See https://github.com/googlefonts/roboto

Optional font distribution is planned in KWEB-026.

## Platform exceptions

Some web CSS values cannot map faithfully to Unity UIToolkit. These are documented as explicit platform exceptions in `tokens/tokens.json` under `platformExceptions`:

| Token | Web value | Unity value | Reason |
|---|---|---|---|
| `selection-bg` | `rgba(155,109,255,0.3)` | `#9b6dff` | UIToolkit does not support rgba() alpha in USS |
| `outline-active-bg` | `rgba(155,109,255,0.12)` | `#2c2f35` | UIToolkit does not support rgba() alpha in USS |
| `scrollbar-track` | `transparent` | `#222428` | UIToolkit scrollbars use ScrollView USS, not custom properties |
| `font-body` | `"Inter", system-ui, ...` | `Inter` | Unity uses font assets, not CSS font-family stacks |
| `font-mono` | `"SF Mono", "Fira Code", ...` | `Roboto Mono` | Unity uses font assets, not CSS font-family stacks |

Each exception includes the token name, affected platform, the reason, the web value, and the platform-specific alternative. The generator applies these substitutions when producing `unity-tokens.json`.

## Usage

### Web (CSS)

```css
@import "@axis-love/styles/tokens.css";

:root {
  /* Override any token */
  --kmd-color-tertiary: #ff6b6b;
}
```

### Web (React)

```tsx
import "@axis-love/styles/styles.css";
import { TOKENS_VERSION, DEFAULT_THEME } from "@axis-love/styles";
```

### Unity

Unity consumes `generated/unity-tokens.json` to generate USS custom properties or load token values at runtime. The JSON provides:

- Per-theme color maps with all references resolved to concrete values
- Font family names (not CSS stacks)
- All spacing, radii, widths, motion, and accessibility tokens
- Platform exception metadata for documentation