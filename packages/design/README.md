# @axis-love/design

The optional DESIGN.md extraction pipeline for kmd-web. It detects
design-system documents (designMD), runs a staged extraction pipeline over
them — colors, typography, spacing, surfaces, shadows, gradients, layout,
components, tables, YAML front matter — and produces a merged, resolved
`DesignDocument` spec. Hosts provide the presentation; this package only
extracts and normalizes the data.

```bash
npm install @axis-love/design
```

## Example

```ts
import { detectDesignDocument, runDesignPipeline } from "@axis-love/design";

const detection = detectDesignDocument(source, "DESIGN.md");

if (detection.score >= detection.threshold) {
  const doc = runDesignPipeline(source);
  console.log(doc.spec.colors, doc.spec.typography);
  console.log(doc.diagnostics); // stage errors surface here, never thrown
}
```

Each stage runs in order; a stage that throws is captured as a diagnostic and
the pipeline continues. `runDesignPipelineCached` adds memoization, and the
intermediate representation types are exported from the
`@axis-love/design/ir` subpath.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
[features.md](https://github.com/axis-love/kmd-web/blob/main/docs/features.md).

## License

MIT
