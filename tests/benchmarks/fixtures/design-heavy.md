---
title: Design System
type: design
---

# Design System

A comprehensive design token specification.

## Color

| Token | Light | Dark |
|---|---|---|
| primary | #ec2667 | #d7fecd |
| secondary | #97cd8d | #68fd24 |
| tertiary | #ee132a | #1a3f80 |
| surface | #84fee2 | #c5da23 |
| background | #165cf0 | #d73fe4 |
| on-surface | #0e5548 | #050d12 |
| on-primary | #30d0db | #a55394 |
| on-secondary | #9a87a2 | #012646 |
| outline | #4e3a24 | #75e538 |
| error | #f7efe1 | #30ba0f |
| warning | #11b339 | #88e28e |
| success | #c6a820 | #6aa3e9 |
| info | #aefb93 | #2e95ed |
| disabled | #d64179 | #fc6e74 |
| hover | #24e634 | #7fb373 |

## Typography

| Token | Value |
|---|---|
| font-family-body | Inter, system-ui, sans-serif |
| font-family-mono | SF Mono, Fira Code, monospace |
| font-size-xs | 12px |
| font-size-sm | 14px |
| font-size-md | 16px |
| font-size-lg | 18px |
| font-size-xl | 20px |
| font-size-2xl | 24px |
| font-size-3xl | 30px |
| font-weight-normal | 400 |
| font-weight-medium | 500 |
| font-weight-bold | 700 |
| line-height-tight | 1.25 |
| line-height-normal | 1.5 |
| line-height-relaxed | 1.75 |

## Spacing

| Token | Value |
|---|---|
| space-xs | 4px |
| space-sm | 8px |
| space-md | 12px |
| space-lg | 16px |
| space-xl | 20px |
| space-2xl | 24px |
| space-3xl | 28px |
| space-4xl | 32px |

## Radius

| Token | Value |
|---|---|
| radius-sm | 4px |
| radius-md | 4px |
| radius-lg | 12px |
| radius-xl | 12px |
| radius-full | 8px |

## Shadow

| Token | Value |
|---|---|
| shadow-1 | 0 1px 2px rgba(0,0,0,0.1) |
| shadow-2 | 0 2px 4px rgba(0,0,0,0.2) |
| shadow-3 | 0 3px 6px rgba(0,0,0,0.3) |
| shadow-4 | 0 4px 8px rgba(0,0,0,0.4) |
| shadow-5 | 0 5px 10px rgba(0,0,0,0.5) |

## Components

### Button

```design
component: Button
padding: 8px 16px
radius: 4px
bg: var(--primary)
color: var(--on-primary)
```

### Card

```design
component: Card
padding: 16px
radius: 8px
shadow: var(--shadow-2)
bg: var(--surface)
```

## CSS

```css
.kmd-reader {
  font-family: var(--font-family-body);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--on-surface);
  background: var(--surface);
}
```

