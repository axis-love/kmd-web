# @axis-love/contracts

Versioned schemas, shared types, fixtures, expected results, and the feature
matrix for the kmd ecosystem. Every other `@axis-love/*` package builds on the
types defined here — `RenderOptions`, `RenderResult`, `OutlineEntry`,
`Diagnostic`, error classes, and the conformance manifest that renderer
implementations are tested against. It has no runtime dependencies.

```bash
npm install @axis-love/contracts
```

## Example

```ts
import {
  CONTRACTS_VERSION,
  defaultRenderOptions,
  RenderError,
  type RenderOptions,
  type RenderResult,
} from "@axis-love/contracts";

const options: RenderOptions = {
  ...defaultRenderOptions,
  features: { mermaid: false },
};
```

Conformance fixtures and the manifest ship in the package:

```ts
import manifest from "@axis-love/contracts/manifest.json" with { type: "json" };
```

The contract runner used by renderer test suites is exported from the
`@axis-love/contracts/runner` subpath.

## Part of kmd-web

This package is part of the [kmd-web](https://github.com/axis-love/kmd-web)
family. Full documentation lives in the repo's
[docs/](https://github.com/axis-love/kmd-web/tree/main/docs) directory — see
the [API support matrix](https://github.com/axis-love/kmd-web/blob/main/docs/api-support-matrix.md).

## License

MIT
