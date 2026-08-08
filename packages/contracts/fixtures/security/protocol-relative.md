# Protocol-Relative URL Vectors

## Protocol-relative link (must be external + hardened)

[proto link](//evil.example.com/page)

## Protocol-relative image (remote — blocked by default)

![proto img](//evil.example.com/x.png)

## Protocol-relative in srcset

<img src="safe.png" srcset="//evil.example.com/a.png 1x, safe.png 2x">

## Genuine relative links must be unaffected

[relative doc](./other.md)

[bare doc](doc.md)

[fragment](#section)

## Genuine relative image unaffected

![local](./local.png)
