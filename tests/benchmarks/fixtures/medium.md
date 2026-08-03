# kmd-web Documentation

Comprehensive guide to the canonical JavaScript rendering engine.

## Architecture Overview

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

```ts
// Example from Architecture Overview
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

Key points:

- Item 1: Security is a first-class concern. All Markdown is treated a...
- Item 2: The rendering pipeline uses a unified processor with remark ...
- Item 3: The browser runtime orchestrates DOM morphing, anchor naviga...
- Item 4: Security is a first-class concern. All Markdown is treated a...

> The kmd-web monorepo contains eleven packages organized in a layered architectur

## Package Boundaries

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

## Core Renderer Pipeline

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

Key points:

- Item 1: The rendering pipeline uses a unified processor with remark ...
- Item 2: Each package has explicit import boundaries enforced by the ...
- Item 3: Security is a first-class concern. All Markdown is treated a...
- Item 4: The browser runtime orchestrates DOM morphing, anchor naviga...

## Browser Runtime

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

```ts
// Example from Browser Runtime
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

## React Integration

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Key points:

- Item 1: The rendering pipeline uses a unified processor with remark ...
- Item 2: Each package has explicit import boundaries enforced by the ...
- Item 3: The browser runtime orchestrates DOM morphing, anchor naviga...
- Item 4: Security is a first-class concern. All Markdown is treated a...

> Each package has explicit import boundaries enforced by the import graph tests. 

## Web Component

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

## Design Tokens

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

```ts
// Example from Design Tokens
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

Key points:

- Item 1: The kmd-web monorepo contains eleven packages organized in a...
- Item 2: The rendering pipeline uses a unified processor with remark ...
- Item 3: Security is a first-class concern. All Markdown is treated a...
- Item 4: Security is a first-class concern. All Markdown is treated a...

## Security Model

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

## Conformance Testing

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

Key points:

- Item 1: The kmd-web monorepo contains eleven packages organized in a...
- Item 2: The rendering pipeline uses a unified processor with remark ...
- Item 3: The browser runtime orchestrates DOM morphing, anchor naviga...
- Item 4: The kmd-web monorepo contains eleven packages organized in a...

> The rendering pipeline uses a unified processor with remark and rehype plugins. 

## Release Process

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

```ts
// Example from Release Process
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

## CI/CD Pipeline

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

Key points:

- Item 1: The kmd-web monorepo contains eleven packages organized in a...
- Item 2: Each package has explicit import boundaries enforced by the ...
- Item 3: The kmd-web monorepo contains eleven packages organized in a...
- Item 4: The kmd-web monorepo contains eleven packages organized in a...

## Bundle Budgets

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

## Performance Benchmarks

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

```ts
// Example from Performance Benchmarks
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

Key points:

- Item 1: Security is a first-class concern. All Markdown is treated a...
- Item 2: The rendering pipeline uses a unified processor with remark ...
- Item 3: The kmd-web monorepo contains eleven packages organized in a...
- Item 4: The kmd-web monorepo contains eleven packages organized in a...

> The browser runtime orchestrates DOM morphing, anchor navigation, scroll trackin

## Import Graph Rules

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

## Worker Bridge Pattern

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Key points:

- Item 1: The rendering pipeline uses a unified processor with remark ...
- Item 2: The browser runtime orchestrates DOM morphing, anchor naviga...
- Item 3: Each package has explicit import boundaries enforced by the ...
- Item 4: The rendering pipeline uses a unified processor with remark ...

## DOM Morphing Strategy

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

```ts
// Example from DOM Morphing Strategy
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

## Asset Lifecycle

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

Key points:

- Item 1: The kmd-web monorepo contains eleven packages organized in a...
- Item 2: The kmd-web monorepo contains eleven packages organized in a...
- Item 3: The rendering pipeline uses a unified processor with remark ...
- Item 4: The rendering pipeline uses a unified processor with remark ...

> Each package has explicit import boundaries enforced by the import graph tests. 

## Link Policy

The rendering pipeline uses a unified processor with remark and rehype plugins. Source text is parsed into mdast, transformed to hast, sanitized, and stringified to HTML. Feature detection runs on the raw source before the pipeline to determine which optional enhancements to apply lazily.

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

## Feature Coordination

Security is a first-class concern. All Markdown is treated as untrusted. The sanitize step strips dangerous elements and attributes. A URL policy blocks javascript, vbscript, and other unsafe schemes. Raw HTML is limited to a small allowlist of inline elements.

The kmd-web monorepo contains eleven packages organized in a layered architecture. Contracts define the shared types and schemas, core provides the DOM-free rendering engine, browser adds DOM enhancement, and the remaining packages provide React bindings, a web component, scoped styles, and optional feature integrations.

```ts
// Example from Feature Coordination
import { render } from "@axis-love/core";

const result = await render(source);
console.log(result.html);
```

Key points:

- Item 1: Security is a first-class concern. All Markdown is treated a...
- Item 2: Each package has explicit import boundaries enforced by the ...
- Item 3: Each package has explicit import boundaries enforced by the ...
- Item 4: Security is a first-class concern. All Markdown is treated a...

## Scroll Tracking

The browser runtime orchestrates DOM morphing, anchor navigation, scroll tracking, code copy enhancement, link policy, asset lifecycle, and feature coordination into a single BrowserReader lifecycle. Hosts create a reader, call update when the document changes, and dispose on unmount.

Each package has explicit import boundaries enforced by the import graph tests. Core may only import contracts. Browser may import contracts and core. Feature packages may import contracts and core but never browser or react. This separation ensures that the baseline bundle never includes heavy optional dependencies.

