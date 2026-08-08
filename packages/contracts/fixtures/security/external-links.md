# External Link Hardening

## External https link — must have rel=noopener noreferrer + target=_blank

[external https](https://example.com/page)

## External http link — must have rel=noopener noreferrer + target=_blank

[external http](http://example.com/other)

## External link with existing rel — must still get noopener noreferrer

[existing rel](https://example.com){rel="external"}

## Mailto link — not external, no rel/target hardening

[email](mailto:user@example.com)

## Tel link — not external, no rel/target hardening

[phone](tel:+15551234567)

## Internal fragment — not external

[fragment](#section)

## Relative document link — not external

[doc](./other.md)

## Bare document link — not external

[bare doc](document.md)

## Protocol-relative link — external, must be hardened

[proto-relative](//example.com/page)

## External link with title attribute

[titled](https://example.com "Example")

## Multiple external links — each must be hardened

[first](https://a.example.com)

[second](https://b.example.com)

[third](http://c.example.com)
