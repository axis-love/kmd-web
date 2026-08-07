import { MarkdownReader } from "@axis-love/kmd-web/react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

// A representative kmd document exercising the full feature set:
// headings, code+Shiki, KaTeX math, alerts, tables, outline nav, assets.
const demoDoc = `# kmd-web Demo Page

This page renders a representative kmd document using the packed
release-candidate tarballs of \`@axis-love/kmd-web\`.

## Headings and Outline

### Subsection A

Content under subsection A.

### Subsection B

Content under subsection B.

## Code Blocks

\`\`\`typescript
interface ReaderOptions {
  source: string;
  className?: string;
}

function createReader(opts: ReaderOptions) {
  return { ...opts, timestamp: Date.now() };
}
\`\`\`

\`\`\`rust
fn main() {
    let names = vec!["alpha", "beta", "gamma"];
    for name in &names {
        println!("Hello, {}!", name);
    }
}
\`\`\`

## Tables

| Package | Description | Status |
|---------|-------------|--------|
| contracts | Versioned schemas, fixtures | Stable |
| core | DOM-free rendering engine | Stable |
| browser | DOM enhancement | Stable |
| react | React wrapper | Stable |
| styles | Scoped CSS + tokens | Stable |

## Alerts

> [!NOTE]
> This is a note alert. It renders with a distinct visual treatment.

> [!WARNING]
> This is a warning alert. Use it to highlight potential issues.

> [!IMPORTANT]
> This alert marks critical information that must not be overlooked.

## Math

Inline math: $E = mc^2$ is Einstein's mass-energy equivalence.

Display math:

$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## Links

- [kmd on GitHub](https://github.com/axis-love/kmd-web)
- [Security Specification](https://github.com/axis-love/kmd/blob/main/docs/planning/09-security-privacy.md)

## Security

The following script tag should NOT render:

<script>alert('xss')</script>

[javascript:alert(1)](javascript:alert(1))
`;

function App() {
  return <MarkdownReader source={demoDoc} />;
}

const root = createRoot(document.getElementById("root")!);
root.render((<App />) as ReactNode);
