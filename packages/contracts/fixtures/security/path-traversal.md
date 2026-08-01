# Path Traversal Vectors

## Relative path traversal in links

[link](../../../etc/passwd)

[link](../../../../../../etc/shadow)

[link](./../../secret.md)

## Absolute path traversal

[link](/etc/passwd)

[link](/etc/shadow)

[link](C:/Windows/System32/config/SAM)

## Path traversal in images

![img](../../../secret/image.png)

![img](../../../../data/credentials.json)

## Path traversal in asset references

![img](./../../../config/database.yml)

![img](../.env)

## URL-encoded path traversal

[link](%2e%2e%2f%2e%2e%2fetc%2fpasswd)

[link](..%2f..%2f..%2fetc%2fpasswd)

## Double-encoded path traversal

[link](%252e%252e%252fetc%252fpasswd)

## Null byte path traversal

[link](../../../etc/passwd%00.txt)

[link](../../secret.md%00)

## UNC path (Windows)

[link](\\\\evil.example.com\\share\\malware)

## Mixed separators

[link](..\\..\\..\\etc\\passwd)

[link](..%5c..%5c..%5cetc%5cpasswd)