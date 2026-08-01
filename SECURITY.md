# Security Policy

## Reporting a vulnerability

Report security issues privately. Do not open a public issue for security vulnerabilities.

Email: security@axis.love

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security invariants

kmd-web renders Markdown, which is untrusted content — including local Markdown. The following invariants are binding across all hosts and must never be weakened:

### Markdown is untrusted

A `.md` file can contain raw HTML, links, images, SVG, Mermaid source, and text that may be rendered in a WebView. Treat all Markdown as untrusted content.

### Sanitization

- Sanitize after parsing and AST transforms, not before.
- Raw HTML uses a strict allowlist (`br`, `kbd`, `sub`, `sup`, `mark`, `abbr`, `details`, `summary`).
- Always blocked: `script`, `iframe`, `object`, `embed`, `link`, `meta`, `style`, `form`, `input`, `button`, event attributes, `style` attributes (unless strict CSS sanitizer exists), `srcdoc`.

### URL schemes

- Allowed: `https:`, `http:`, `mailto:`, `tel:`, relative links, local file links (after user confirmation).
- Blocked: `javascript:`, `vbscript:`, unknown custom schemes, `file:` from rendered content (unless user confirms).
- External links open through the native OS handler, never inside the reader WebView.
- Rendered links include `rel="noopener noreferrer"`.

### Images

- Local images resolved relative to the Markdown file, through the host backend.
- Remote images blocked by default or loaded only after explicit user action.
- SVG treated as risky: strip scripts and external references, prefer sanitized image rendering.

### Mermaid

- No external network.
- No arbitrary scripts.
- Config locked down.
- Render timeout.
- Error fallback.

### Math (KaTeX)

- Disable unsafe macros.
- No network.
- Render timeout for pathological input.

### WebView bridge isolation

- Never mount Tauri APIs directly into document HTML.
- All links/images/actions go through controlled event handlers.
- Rendered content cannot invoke Tauri or privileged host APIs directly.

### Content Security Policy

Suggested CSP for consumers:

```
default-src 'none';
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
script-src 'self';
connect-src 'none';
```

### Dependencies

- Renderer libraries are security-critical.
- Pin versions.
- Keep parser and sanitizer updates in a release checklist.
- Every security-policy change requires malicious fixtures in `contracts` and tests in each affected implementation.

## Source

This policy is derived from the [Security and Privacy Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md) in the kmd repository.