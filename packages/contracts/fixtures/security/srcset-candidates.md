# Srcset URL Candidates

## Safe srcset — local relative URLs

<img src="./default.png" srcset="./small.png 480w, ./medium.png 800w, ./large.png 1200w" alt="safe srcset">

## Mixed safe and unsafe srcset — remote candidate must block element

<img src="./safe.png" srcset="https://evil.example.com/track.png 1x, ./safe.png 2x" alt="mixed srcset">

## Protocol-relative in srcset — must block element

<img src="./safe.png" srcset="//evil.example.com/a.png 1x, ./safe.png 2x" alt="proto-rel srcset">

## javascript: in srcset — must block element

<img src="./safe.png" srcset="javascript:alert(1) 1x, ./safe.png 2x" alt="js srcset">

## data: in srcset — must block element

<img src="./safe.png" srcset="data:image/svg+xml,<svg onload=alert(1)> 1x, ./safe.png 2x" alt="data srcset">

## file: in srcset — must block element

<img src="./safe.png" srcset="file:///etc/passwd 1x, ./safe.png 2x" alt="file srcset">

## All-local srcset with descriptors — survives

<img src="./base.png" srcset="./1x.png 1x, ./2x.png 2x, ./3x.png 3x" alt="local srcset">

## srcset with path traversal — must block element

<img src="./safe.png" srcset="../../../etc/passwd 1x, ./safe.png 2x" alt="traversal srcset">

## Genuine relative image unaffected (no srcset)

![plain image](./plain.png)

## Heading to prove document renders

# Srcset Document
