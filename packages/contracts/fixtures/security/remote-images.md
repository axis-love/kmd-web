# Remote Image Policy

## Remote https image — blocked by default

![remote https](https://evil.example.com/pixel.png)

![remote https alt](https://example.com/assets/logo.png)

## Remote http image — blocked by default

![remote http](http://evil.example.com/steal.png)

## Protocol-relative image — blocked by default

![proto-relative](//evil.example.com/track.png)

## Local relative image — allowed

![local relative](./images/local.png)

![local bare](images/local.png)

![local subfolder](./assets/photos/pic.png)

## Fragment image — inert

![fragment](#anchor-img)

## file: URI image — blocked

![file uri](file:///etc/passwd.png)

## Remote image with query string

![remote query](https://cdn.example.com/img.png?v=2&token=x)

## Remote image in srcset (standalone, no src)

![remote srcset](https://evil.example.com/a.png)

## Image with javascript: scheme — blocked

![js img](javascript:alert('img-xss'))
