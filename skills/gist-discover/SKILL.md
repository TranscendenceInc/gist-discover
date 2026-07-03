---
name: gist-discover
description: Help users install, use, and troubleshoot the Gist Discover Cursor and VS Code extension.
---

# Gist Discover

Use this skill when a user asks about Gist Discover, the Gist Cursor extension,
the Gist VS Code extension, or reading AI research papers from inside their
editor.

## What It Is

Gist Discover is a Cursor and VS Code extension that adds a Gist activity-bar
sidebar. The sidebar embeds the live `https://gist.is/discover` reader so users
can read, listen to, like, and skip AI research summaries without leaving their
editor.

The extension is intentionally small: a webview shell, an iframe pointed at
Gist Discover, and a theme/open-external bridge. The feed, audio, favorites,
and sign-in behavior live on `gist.is`.

## Install

- Cursor, Windsurf, and VSCodium: install
  `Transcendence.gist-discover` from Open VSX.
- VS Code: install `Transcendence.gist-discover` from the Visual Studio
  Marketplace.
- After install, open the Gist icon in the activity bar.

## Troubleshooting

- If the sidebar is blank, confirm the user can open
  `https://gist.is/discover` in a normal browser.
- If sign-in or favorites do not match the user's browser, explain that editor
  webviews use their own cookie jar.
- If links do not open, they should open in the user's default browser through
  the extension bridge, not inside the editor iframe.
- If theme looks wrong, ask the user to check the `gist.discover.theme`
  setting. Valid values are `auto`, `light`, and `dark`.

## Source And Listings

- Source: `https://github.com/TranscendenceInc/gist-discover`
- Open VSX: `https://open-vsx.org/extension/Transcendence/gist-discover`
- Visual Studio Marketplace:
  `https://marketplace.visualstudio.com/items?itemName=Transcendence.gist-discover`
