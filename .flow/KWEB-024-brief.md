# KWEB-024 — Ecosystem Release-Candidate Gate

**Flow task:** flow_001012 (assigned to you)
**Repos:** `/home/nyx/.hermes/projects/kmd-web`, `/home/nyx/.hermes/projects/kmd`, `/home/nyx/.hermes/projects/kmd-ios`
**Start:** `git pull` in every repo. Work on `main`, one focused commit per repo.

## Objective
Independently verify the exact packed prerelease across all consumers before any stable public package is published. This box is Linux — iOS builds cannot run here; iOS is recorded as "manual evidence pending (Anton, Mac)" in the go/no-go report. Do NOT attempt iOS builds.

## Scope (decided by Nyx — do not renegotiate)
1. **Freeze RC version + tarballs.** Pick a release-candidate version for all `@axis-love/*` workspace packages, `npm pack` tarballs from the built output. All downstream tests must consume THESE TARBALLS, not workspace source.
2. **Run kmd-web gates** from the packed tarballs: core, contracts, security, package-contents, API, license, size, performance, browser, accessibility, visual. Review all exceptions.
3. **Fresh-directory examples.** Run the vanilla and React examples from a fresh directory outside the repo, installing kmd-web from the tarballs. This is the third-party-consumer proof.
4. **Website integration.** Build one small real docs/demo website page consuming `@axis-love/kmd-web` from the packed tarball (can live under `examples/` in kmd-web). Render a representative kmd document exercising the features (headings, code+Shiki, KaTeX math, alerts, tables, outline nav, assets). Verify it builds and renders. Include as go/no-go evidence.
5. **Desktop (kmd repo).** Full build + tests of the kmd Tauri desktop app. Record exact commands and results.
6. **kmd-ios:** build/tests CANNOT run here. Record "manual: pending Anton's Mac run" — that is acceptable, not a blocker for your sign-off.
7. **Package audit.** Audit tarball contents for private data, secrets, source-only internals, unwanted heavy assets, license omissions.
8. **Deliverables:** write `docs/rc-gate-report.md` in kmd-web with: (a) compatibility matrix (consumer × version × result × evidence), (b) go/no-go section listing every gate, exact evidence, and unresolved non-blocking limitations (including iOS pending).

## Rules
- Read kmd-web `AGENTS.md` + `README.md` first. Read kmd/docs/planning/17 and 18 if you need architecture context.
- Fix real defects you find during the gates — but keep fixes small and focused, one commit each. If a fix needs an architecture decision, STOP and record it as a blocker in the report instead of deciding yourself.
- Do not mark the Flow task done if any acceptance criterion is unmet — move to `review` with a completion note: commits, test counts per gate, tarball filenames, evidence paths.
- Token economy: work autonomously, don't ask mid-task questions unless truly blocked.
