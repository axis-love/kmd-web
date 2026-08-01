# Encoded URL Attack Vectors

## Double encoding

[link](%253Cscript%253Ealert(1)%253C%252Fscript%253E)

## Unicode encoding

[link](\u006a\u0061\u0076\u0061\u0073\u0063\u0072\u0069\u0070\u0074:alert(1))

## HTML entity in URL

[link](&#106;avascript:alert(1))

[link](&#x6a;avascript:alert(1))

[link](&#0000106;avascript:alert(1))

## Mixed encoding

[link](j&#97;v&#97;scr&#105;pt:alert(1))

## URL with encoded path traversal

[link](https://example.com/%2e%2e%2f%2e%2e%2fetc%2fpasswd)

## Encoded javascript with entities

[link](javascript&#58;alert(1))

[link](javascript&#x3A;alert(1))

## Null byte injection

[link](javascript\x00:alert(1))

[link](https://example.com\x00.evil.com)

## UTF-8 overlong encoding

[link](%c0%af%c0%ae%c0%ae/etc/passwd)