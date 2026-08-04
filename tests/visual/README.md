# Visual Baseline Tests

Deterministic screenshot comparisons across browser engines, viewport widths,
and theme modes using Playwright.

## Quick Start

```sh
# 1. Build dist artifacts (required — tests consume built packages)
npm run build

# 2. Install Playwright browsers (first time only)
npx playwright install

# 3. Run visual tests
npx playwright test --config=playwright.config.ts
```

## How It Works

The test harness (`harness.ts`) renders Markdown source via the built
`@axis-love/core` `render()` function in the test process (Node.js). The
rendered HTML is combined with inlined `@axis-love/styles` CSS into a
self-contained HTML page. Playwright loads this page, emulates
`prefers-reduced-motion: reduce`, and captures a full-page screenshot for
baseline comparison via `expect(page).toHaveScreenshot()`.

Screenshots are stored under `tests/visual/visual-baselines.test.ts-snapshots/`
with names encoding the fixture, theme, browser, and viewport:

```
{fixture}-{theme}-{browser}-{viewport}.png
```

For example: `headings-dark-chromium-desktop.png`

## Browser Matrix

| Browser | Engine | Project Names |
|---------|--------|---------------|
| Chromium | Blink | `chromium-desktop`, `chromium-narrow` |
| Firefox | Gecko | `firefox-desktop`, `firefox-narrow` |
| WebKit | WebKit | `webkit-desktop`, `webkit-narrow` |

## Viewport Matrix

| Label | Width | Height | Purpose |
|-------|-------|--------|---------|
| Desktop | 1280px | 720px | Standard desktop reading |
| Narrow | 375px | 667px | Mobile / narrow column |

## Theme Matrix

| Theme | Activation | Description |
|-------|------------|-------------|
| Light | `data-kmd-theme="light"` | Light tokens applied |
| Dark | `data-kmd-theme="dark"` | Dark tokens (default) |

## Fixture Matrix

| Fixture | Document Type |
|---------|---------------|
| `headings` | H1–H6 heading hierarchy |
| `tables` | GFM table with alignment |
| `code` | TypeScript code block |
| `alerts` | GitHub-style alerts (NOTE, WARNING, IMPORTANT) |
| `mixed` | Combined document: headings, text, code, table, alert, link |
| `math` | Inline + display math expressions |
| `mermaid` | Mermaid flowchart diagram |

## Reduced Motion

All tests run with `prefers-reduced-motion: reduce` emulated by the Playwright
context (configured in `playwright.config.ts` via `reducedMotion: "reduce"`).
This prevents CSS animations and transitions from destabilizing screenshot
baselines. The `animations: "disabled"` option is also set on
`toHaveScreenshot()` as a secondary guard.

## Baseline Update Rules

**Baseline changes must be reviewed, not blindly accepted.**

### When to update baselines

1. **Intentional visual changes** — a CSS token change, layout refactor, or
   typography adjustment that changes the rendered output. Update the
   baseline only after confirming the new appearance is correct.

2. **Package dependency upgrades** — Playwright browser version upgrades can
   produce slightly different rendering. Review the diff carefully before
   accepting.

3. **Fixture content changes** — when a test fixture's Markdown source is
   modified, baselines for that fixture must be regenerated.

### How to update baselines

```sh
# Update all baselines
npx playwright test --config=playwright.config.ts --update-snapshots

# Update a specific fixture/theme/browser/viewport
npx playwright test --config=playwright.config.ts --update-snapshots \
  -g "headings.*light"
```

### Review checklist before committing updated baselines

- [ ] The visual diff is intentional (not a regression)
- [ ] The diff is reviewed by a team member or the author can justify the change
- [ ] The change is documented in the commit message
- [ ] All browser/viewport/theme combinations for the affected fixture are
      updated together (not just one browser)
- [ ] CI passes with the new baselines

### When NOT to update baselines

- Flaky test failures — investigate the root cause (timing, font loading,
  animation) before updating. If the issue is timing-related, add a
  `waitFor` or increase the settle delay in `harness.ts`.
- Environmental differences — local OS font rendering may differ from CI.
  Only update baselines from CI or a controlled environment.

## CI Integration

The `.github/workflows/ci.yml` workflow includes a `visual-tests` job that:

1. Checks out the repo
2. Installs Node.js and dependencies
3. Builds the dist artifacts (`npm run build`)
4. Installs Playwright browsers
5. Runs `npx playwright test`
6. Uploads visual diff artifacts on failure (screenshots + HTML report)

The visual tests job runs in parallel with the main verify job but is not a
blocking gate — visual regressions are reported as artifacts for review.

## File Structure

```
playwright.config.ts                          — Playwright config (browsers, viewports, reduced motion)
tests/visual/
  README.md                                   — This file
  harness.ts                                  — Test harness (renders Markdown, inlines CSS, builds HTML page)
  visual-baselines.test.ts                    — Playwright test specs (fixture × theme × browser × viewport)
  visual-baselines.test.ts-snapshots/         — Baseline screenshots (committed to repo)
```

## Adding New Visual Tests

1. Add a fixture source to `VISUAL_FIXTURES` in `harness.ts`
2. Run `npx playwright test --config=playwright.config.ts --update-snapshots`
   to generate baselines for the new fixture
3. Review the generated screenshots before committing

## Troubleshooting

- **`Module not found: @axis-love/core`** — Run `npm run build` first. The
  visual tests import from built dist, not source.
- **`Executable doesn't exist`** — Run `npx playwright install` to download
  browser binaries.
- **Font rendering differences** — Baselines are captured with system fonts
  (no `@font-face` per kmd-web policy). CI uses Linux container fonts; local
  baselines may differ slightly. Always verify in CI.
- **Timeout on `waitForFunction`** — The font-ready check has a 5-second
  timeout with a graceful fallback. If tests still timeout, increase the
  settle delay in `createPage()`.