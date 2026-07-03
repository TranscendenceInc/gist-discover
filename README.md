# Gist — Discover AI Research

**The newest AI papers from arXiv, summarized so you can read one in 30
seconds. In your sidebar.**

Hundreds of AI papers hit arXiv every day. You ship code instead of reading
them. Gist Discover puts the newest ones a click away — each distilled to a
30-second gist, with deeper layers when a paper earns your attention and
audio for when your eyes are busy.

## What you get

- **New AI research, summarized.** Fresh papers from arXiv, each cut to a
  gist you can read in 30 seconds.
- **Layers, not walls of text.** Start with the gist. Go deeper — the story,
  the logic, the original paper — only when it's worth it.
- **Listen while you code.** Press play, keep typing.
- **Like and Next.** One click to keep what's good and skip what isn't.
- **Matches your editor.** The sidebar follows your light or dark theme
  automatically.

## Install

- **Cursor / Windsurf:** search **Gist** in the Extensions panel, or install
  from [Open VSX](https://open-vsx.org/extension/Transcendence/gist-discover).
- **VS Code:** search **Gist** in Extensions, or install from the
  [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Transcendence.gist-discover).

Then click the Gist icon in the activity bar.

## How it works

The sidebar embeds the live [gist.is/discover](https://gist.is/discover)
reader — the same feed, layers, audio, and favorites as the website. The
extension itself is under 200 lines of code: a webview, an iframe, and a
theme bridge. New features ship on the website the moment they go live; the
extension never needs an update to get them.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `gist.discover.theme` | `auto` | Follow the editor, or force light/dark. |

## Privacy

The sidebar loads `https://gist.is/discover` in a standard editor webview —
the same as visiting the page in your browser, with the same cookies kept in
the webview's own jar. The extension adds no tracking of its own. External
links always open in your default browser, never inside the editor.

Sign-in is optional. Favorites sync when you do.

---

Made by [Gist](https://gist.is) — hyperfocused reading for ADHD brains.
