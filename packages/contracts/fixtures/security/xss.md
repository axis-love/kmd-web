# XSS Attack Vectors

## javascript: scheme in links

[javascript:alert('xss')](javascript:alert('xss'))

[click me](javascript:void(0))

## vbscript: scheme

[vbscript](vbscript:MsgBox('xss'))

## data: URIs

[data uri link](<data:text/html,%3Cscript%3Ealert(1)%3C/script%3E>)

![data image](data:image/svg+xml,<svg onload=alert(1)>)

## file: scheme

[file link](file:///etc/passwd)

## HTML event handlers

<img src="x" onerror="alert(1)">

<div onclick="alert('xss')">click</div>

<svg onload="alert('xss')">

## SVG with script

<svg><script>alert('svg-xss')</script></svg>

## Encoded URL tricks

[encoded js](&#106;avascript:alert(1))

[whitespace js](javascript&#9;:alert(1))

## Mixed safe and unsafe

[safe link](https://example.com)

[unsafe link](javascript:alert('xss'))

## Image with script

![alt](javascript:alert('img-xss'))

## Object/embed tags

<object data="javascript:alert(1)"></object>

<embed src="javascript:alert(1)">

## Script tags

<script>alert("xss")</script>

## Iframe injection

<iframe src="javascript:alert(1)"></iframe>

## Form injection

<form action="javascript:alert(1)"><input type="submit"></form>

## Meta refresh

<meta http-equiv="refresh" content="0;url=javascript:alert(1)">

## Style with expression

<style>body { background: url(javascript:alert(1)) }</style>