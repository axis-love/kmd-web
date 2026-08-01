---
title: Front Matter Test
description: Document with YAML front matter
lang: en
author: Test Author
date: 2026-01-01
tags:
  - markdown
  - test
  - fixture
nested:
  key1: value1
  key2:
    - item1
    - item2
number: 42
boolean: true
---

# Document Title

The front matter above should be parsed as metadata, not rendered as content.

This paragraph should render normally.

## Section

Content after the front matter.