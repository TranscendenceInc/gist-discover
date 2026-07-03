/**
 * `WebviewViewProvider` for the Gist Discover sidebar.
 *
 * Serves a single-page HTML shell whose body is a full-bleed iframe pointed
 * at https://gist.is/discover?vsc=1&theme=<dark|light>. The live page renders
 * the full reader (feed cards, layer chips, Listen, share modal, Like + Next)
 * — the extension is purely framing plus a tiny postMessage bridge that
 * handles two things: (1) routes external link clicks to the user's default
 * browser, (2) keeps the iframe theme in sync with VS Code's active theme.
 *
 * While the iframe loads, the shell shows a brand splash (pulsing bolt +
 * "Gist" wordmark + tagline, mirroring the static OG share card from the
 * Gist web app. The iframe starts at opacity 0; on its `load` event the
 * bridge waits out a minimum hold
 * (`MIN_SPLASH_MS`, so a fast load doesn't flash) and then adds `.ready` to
 * `<body>`, cross-fading splash → reader. If `load` hasn't fired after
 * `SLOW_HINT_MS`, `.slow` reveals a quiet "Still reaching gist.is…" line —
 * the splash otherwise never times out; the webview is rebuilt on every
 * sidebar reopen (`retainContextWhenHidden: false`), so each open retries.
 *
 * Bridge contract (matches `host-bridge.js` on gist.is):
 * - The iframe URL carries `?vsc=1`. When set, the website posts
 *   `{ type: 'gist:openExternal', url }` to `window.parent` instead of
 *   calling `window.open()` for any external CTA.
 * - The same URL carries `&theme=<dark|light>`. SSR honors it on first paint
 *   (no flash). The extension also posts `{ type: 'gist:setTheme', kind }`
 *   to the webview on theme changes; the inline script forwards it into the
 *   iframe, where discover-shell.js flips `<html data-theme>` without reload.
 * - The inline script in this HTML (gated by a per-load CSP nonce) routes
 *   both directions: iframe→extension for `gist:openExternal`, extension→
 *   iframe for `gist:setTheme`.
 * - `onDidReceiveMessage` validates the URL is http(s) and calls
 *   `vscode.env.openExternal` so links open in the user's default browser.
 *
 * gist.is's `/discover` response carries no `X-Frame-Options` and no
 * `frame-ancestors` CSP — the page is intentionally embeddable from
 * anywhere (homepage previews, VS Code, third-party embeds).
 */
import * as vscode from 'vscode';
import { randomBytes } from 'crypto';

const DISCOVER_BASE_URL = 'https://gist.is/discover';
const DISCOVER_ORIGIN = 'https://gist.is';
const OPEN_EXTERNAL_MESSAGE_TYPE = 'gist:openExternal';
const SET_THEME_MESSAGE_TYPE = 'gist:setTheme';
const THEME_SETTING_KEY = 'gist.discover.theme';

type ThemeKind = 'light' | 'dark';
type ThemeSetting = 'auto' | ThemeKind;

type OpenExternalMessage = {
  type: typeof OPEN_EXTERNAL_MESSAGE_TYPE;
  url: unknown;
};

export class DiscoverViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gist.discover';

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true };
    const initialTheme = resolveTheme();
    webviewView.webview.html = buildDiscoverIframeHtml(generateNonce(), initialTheme);

    webviewView.webview.onDidReceiveMessage((message: OpenExternalMessage) => {
      if (!message || message.type !== OPEN_EXTERNAL_MESSAGE_TYPE) return;
      if (typeof message.url !== 'string') return;
      openExternalSafely(message.url);
    });

    // Live theme sync: when VS Code's active theme or the user's preference
    // changes, push the new kind to the iframe via the bridge. The iframe
    // updates `<html data-theme>` in place — no reload.
    const pushTheme = () => {
      void webviewView.webview.postMessage({
        type: SET_THEME_MESSAGE_TYPE,
        kind: resolveTheme(),
      });
    };

    const subscriptions: vscode.Disposable[] = [
      vscode.window.onDidChangeActiveColorTheme(() => pushTheme()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(THEME_SETTING_KEY)) pushTheme();
      }),
    ];

    webviewView.onDidDispose(() => {
      for (const sub of subscriptions) sub.dispose();
    });
  }
}

/**
 * Resolve the extension's `gist.discover.theme` setting against the active
 * VS Code color theme. `auto` follows VS Code (Dark / HighContrast → dark,
 * everything else → light). `light` / `dark` force the value.
 */
function resolveTheme(): ThemeKind {
  const raw = vscode.workspace
    .getConfiguration()
    .get<string>(THEME_SETTING_KEY, 'auto');
  const setting: ThemeSetting = raw === 'light' || raw === 'dark' ? raw : 'auto';
  if (setting !== 'auto') return setting;
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast
    ? 'dark'
    : 'light';
}

/**
 * Splash palette lifted from the generic OG share card: dark field, cream ink,
 * and the "bolt-sunrise" gradient. Light theme swaps field/ink; the bolt
 * gradient and baseline hairline are identical in both.
 */
const SPLASH_TAGLINE = 'Argument. Counter-Argument. Steelman.';
/** Minimum splash visibility, so a fast iframe load reads as a beat, not a flash. */
const MIN_SPLASH_MS = 500;
/** After this long with no iframe `load`, show the quiet still-connecting hint. */
const SLOW_HINT_MS = 12000;

/** Exported for the splash demo harness and future shell-HTML tests. */
export function buildDiscoverIframeHtml(nonce: string, theme: ThemeKind): string {
  // default-src 'none' is the floor; the bridge script gets in via its
  // nonce. style-src 'unsafe-inline' covers the inline styles (splash CSS
  // included — the bolt is inline SVG, so no img-src needed). The iframe
  // runs gist.is scripts in its own origin context independent of this CSP.
  const csp = [
    "default-src 'none'",
    `frame-src ${DISCOVER_ORIGIN}`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const initialIframeUrl = `${DISCOVER_BASE_URL}?vsc=1&theme=${theme}`;
  const bodyBackground = theme === 'dark' ? '#1C1C24' : '#ffffff';
  const splashInk = theme === 'dark' ? '#FAF6EE' : '#15161C';
  const splashInkSoft =
    theme === 'dark' ? 'rgba(250, 246, 238, 0.68)' : 'rgba(21, 22, 28, 0.62)';

  // The bridge has three jobs:
  //   - iframe → extension: openExternal URLs come from gist.is origin.
  //   - extension → iframe: setTheme messages come from the webview origin
  //     (vscode-webview://...), not gist.is, so we differentiate by checking
  //     event.origin against DISCOVER_ORIGIN. message type acts as the
  //     authorization check on both sides.
  //   - splash reveal: on iframe load, wait out the minimum hold, then add
  //     .ready to <body> to cross-fade splash → reader.
  const bridgeScript = `
    const vscode = acquireVsCodeApi();
    const DISCOVER_ORIGIN = ${JSON.stringify(DISCOVER_ORIGIN)};
    const OPEN_EXTERNAL = ${JSON.stringify(OPEN_EXTERNAL_MESSAGE_TYPE)};
    const SET_THEME = ${JSON.stringify(SET_THEME_MESSAGE_TYPE)};
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (event.origin === DISCOVER_ORIGIN) {
        if (msg.type === OPEN_EXTERNAL && typeof msg.url === 'string') {
          vscode.postMessage({ type: OPEN_EXTERNAL, url: msg.url });
        }
        return;
      }
      if (msg.type === SET_THEME && (msg.kind === 'light' || msg.kind === 'dark')) {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: SET_THEME, kind: msg.kind }, DISCOVER_ORIGIN);
        }
      }
    });

    const splashShownAt = Date.now();
    const slowHintTimer = setTimeout(() => {
      document.body.classList.add('slow');
    }, ${SLOW_HINT_MS});
    document.querySelector('iframe').addEventListener('load', () => {
      const hold = Math.max(0, ${MIN_SPLASH_MS} - (Date.now() - splashShownAt));
      setTimeout(() => {
        clearTimeout(slowHintTimer);
        document.body.classList.add('ready');
      }, hold);
    });
  `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>Gist Discover</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: ${bodyBackground}; }
      iframe {
        width: 100%; height: 100%; border: 0; display: block;
        opacity: 0; transition: opacity 400ms ease;
      }
      body.ready iframe { opacity: 1; }
      #splash {
        position: fixed; inset: 0; z-index: 1;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 14px; padding: 24px;
        background: ${bodyBackground};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        transition: opacity 350ms ease, visibility 0s 350ms;
      }
      body.ready #splash { opacity: 0; visibility: hidden; }
      .lockup { display: flex; align-items: center; gap: 10px; }
      .bolt { width: 26px; height: 51px; animation: pulse 2.2s ease-in-out infinite; }
      .wordmark {
        color: ${splashInk};
        font-size: 42px; font-weight: 700;
        letter-spacing: -0.04em; line-height: 1;
      }
      .tagline {
        margin: 0; max-width: 240px; text-align: center;
        color: ${splashInkSoft};
        font-size: 13px; font-weight: 500;
        letter-spacing: 0.01em; line-height: 1.5;
      }
      .hint {
        margin: 0; position: absolute; bottom: 28px;
        color: ${splashInkSoft};
        font-size: 11px; opacity: 0; transition: opacity 600ms ease;
      }
      body.slow .hint { opacity: 1; }
      .baseline {
        position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, #FF6B6B, #FFD93D, #FF8E53);
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.65; transform: scale(0.96); }
        50% { opacity: 1; transform: scale(1.03); }
      }
      @media (prefers-reduced-motion: reduce) {
        .bolt { animation: none; }
        iframe, #splash, .hint { transition: none; }
      }
    </style>
  </head>
  <body>
    <div id="splash" aria-hidden="true">
      <div class="lockup">
        <svg class="bolt" viewBox="0 0 76 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="bolt-sunrise" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF6B6B"/>
              <stop offset="50%" stop-color="#FFD93D"/>
              <stop offset="100%" stop-color="#FF8E53"/>
            </linearGradient>
          </defs>
          <path d="M48 10L8 75h25l-5 65 40-75h-25z" fill="url(#bolt-sunrise)"/>
        </svg>
        <div class="wordmark">Gist</div>
      </div>
      <p class="tagline">${SPLASH_TAGLINE}</p>
      <p class="hint">Still reaching gist.is…</p>
      <div class="baseline"></div>
    </div>
    <iframe
      src="${initialIframeUrl}"
      title="Gist Discover"
      allow="autoplay; encrypted-media; clipboard-write"
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
    <script nonce="${nonce}">${bridgeScript}</script>
  </body>
</html>`;
}

function generateNonce(): string {
  return randomBytes(16).toString('base64');
}

function openExternalSafely(url: string): void {
  let parsed: vscode.Uri;
  try {
    parsed = vscode.Uri.parse(url, true);
  } catch {
    return;
  }
  // Restrict to http(s) so a compromised iframe cannot ask the host to open
  // arbitrary `file://`, `vscode://`, or `mailto:` URIs.
  if (parsed.scheme !== 'http' && parsed.scheme !== 'https') return;
  void vscode.env.openExternal(parsed);
}
