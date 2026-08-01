# Syntax Highlighting Fixtures

## TypeScript

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

function greet(user: User): string {
  return `Hello, ${user.name}!`;
}

const user: User = { id: 1, name: "Alice" };
console.log(greet(user));
```

## Python

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

def greet(user: User) -> str:
    return f"Hello, {user.name}!"

user = User(id=1, name="Alice")
print(greet(user))
```

## Rust

```rust
struct User {
    id: u32,
    name: String,
    email: Option<String>,
}

fn greet(user: &User) -> String {
    format!("Hello, {}!", user.name)
}

fn main() {
    let user = User { id: 1, name: "Alice".into(), email: None };
    println!("{}", greet(&user));
}
```

## Diff

```diff
- removed old line
+ added new line
  unchanged context line
- another removed line
+ another added line
```

## JSON

```json
{
  "id": 1,
  "name": "Alice",
  "active": true,
  "tags": ["admin", "user"]
}
```

## Plain (no language)

```
Plain text code block
No syntax highlighting expected
```

## Shell

```bash
#!/bin/bash
echo "Hello, World!"
for i in $(seq 1 5); do
  echo "Iteration $i"
done
```

## SQL

```sql
SELECT u.id, u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.active = true
GROUP BY u.id, u.name
ORDER BY order_count DESC;
```