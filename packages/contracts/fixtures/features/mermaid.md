# Mermaid Diagrams

## Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    B-->>A: Hi
```

## Git Graph

```mermaid
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    checkout main
    merge develop
```

## Mermaid with code after

Regular text after mermaid.

```typescript
const x = 42;
```

## Multiple mermaid blocks

```mermaid
pie title Pets
    "Dogs" : 40
    "Cats" : 35
    "Birds" : 25
```

## Malicious mermaid (external reference)

```mermaid
flowchart TD
    A[Start] --> B["<img src=x onerror=alert(1)>"]
    B --> C["javascript:alert(1)"]
```