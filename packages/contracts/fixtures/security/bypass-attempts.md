# Bypass Attempt Vectors

## Percent-encoded colon in scheme

[link](javascript%3Aalert(1))

[link](javascript%253Aalert(1))

## Percent-encoded scheme name

[link](%6a%61%76%61%73%63%72%69%70%74:alert(1))

[link](%6A%61%76%61%73%63%72%69%70%74:alert(1))

## Mixed case with encoded colon

[link](JaVaScRiPt%3Aalert(1))

[link](JAVA%53CRIPT%3Aalert(1))

## Tab and newline in scheme (control char bypass)

[link](java\tscript:alert(1))

[link](java\nscript:alert(1))

[link](java\rscript:alert(1))

## Null byte before scheme

[link](\x00javascript:alert(1))

[link](javascript\x00:alert(1))

## Leading whitespace before scheme

[link](   javascript:alert(1))

[link]( javascript:alert(1))

## vbscript with encoding

[link](vbscript%3AMsgBox(1))

[link](VBScript:MsgBox(1))

## data: with encoded colon

[link](data%3Atext/html,alert(1))

[link](DATA:text/html,alert(1))

## file: with encoded colon

[link](file%3A/etc/passwd)

[link](FILE:///etc/passwd)

## Unknown scheme with encoded colon

[link](myapp%3Adeep-link)

[link](chrome%3Asettings)

## Style attribute injection

<div style="background:url(javascript:alert(1))">styled</div>

## CSS expression in style

<div style="width:expression(alert(1))">expression</div>

## SVG use with xlink

<svg><use xlink:href="javascript:alert(1)"/></svg>

## Image srcset with javascript

<img src="safe.png" srcset="javascript:alert(1) 1x, safe.png 2x">

## Source element with javascript

<video><source src="javascript:alert(1)"></video>

## Track element with javascript

<video><track src="javascript:alert(1)"></video>

## Poster with javascript

<video poster="javascript:alert(1)"></video>

## Nested anchor with javascript

<a href="https://example.com"><a href="javascript:alert(1)">nested</a></a>

## Form with action and button

<form action="javascript:alert(1)"><button>submit</button></form>

## Meta with content redirect

<meta http-equiv="refresh" content="0;url=javascript:alert(1)">

## Base href change

<base href="javascript:alert(1)//">