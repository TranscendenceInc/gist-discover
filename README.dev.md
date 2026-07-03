# Gist Discover extension — developer notes

`README.md` in this package is the **public marketplace listing** (it ships
inside the VSIX and renders on the Visual Studio Marketplace and Open VSX
listing pages). Developer documentation lives here; `.vscodeignore` excludes
this file from the package.

## Local install

From the repo root:

```sh
npm install
npm run package
code --install-extension gist-vscode-extension.vsix
```

In Cursor or Windsurf, use their equivalent `--install-extension` flag (or the
IDE's "Install from VSIX..." command-palette entry).

## How it works

`DiscoverViewProvider` (`src/discover-view-provider.ts`) serves a single-page
HTML shell with a full-bleed `<iframe>` pointed at `https://gist.is/discover`.
That's the whole extension. No host RPC, no payload cache, no native renderer
— the live website already runs the entire reader (`createUnifiedReaderApp`)
with its own data fetches, audio synth, favorites API, and share controls.

While the iframe loads, the shell shows a brand splash (pulsing bolt +
wordmark + tagline, mirroring the static OG share card from
the Gist web app), then cross-fades to the
reader on the iframe `load` event after a 500 ms minimum hold. A quiet
"Still reaching gist.is…" hint appears if `load` hasn't fired after 12 s.

## Server prerequisite

gist.is's `/discover` response is intentionally **open-embed**: no
`X-Frame-Options`, no `Content-Security-Policy: frame-ancestors`. Any
context — VS Code, Cursor, third-party blog, a partner reader — can
iframe the page. The page is read-only public content and embedding it
is a growth surface, not an abuse surface. Clickjacking protection lives
only on auth-bearing pages (`/`, `/try`, `/join`, `/admin`).

See `packages/backend/src/lib/security.ts` (`isDiscoverPath`,
`isPublicSharePath`) in the private Gist web app repository.

## Sign-in and favorites

The webview iframe has its own cookie jar, separate from the user's main
browser. Sign-in happens once per VS Code instance and persists in the
extension's webview storage. Anonymous Like/feed-exclusion uses whatever
client identity the website already keeps (cookie + localStorage), so
there is nothing to coordinate on the host side.

## Engine floor

`engines.vscode: ^1.100.0`. The extension uses the standard
`WebviewViewProvider` API and the `acquireVsCodeApi()` bridge that have
been stable since 1.46, but the README/Plan history was authored against
1.100 (the era where the `host-bridge.js` pivot landed) and the floor
hasn't been lowered. Cursor 3.6+ is based on a recent enough VS Code
release to satisfy this.

## Distribution — publishing runbook

The extension ID is `Transcendence.gist-discover` (publisher
`Transcendence`, name `gist-discover`). Both `vsce publish` and
`ovsx publish` read the publisher straight out of `package.json` — there is
no per-registry override — so a single `publisher` value drives both
listings. Cursor's publisher verification also requires the ID to match
across registries, so pick one identity and use it everywhere rather than
letting the two stores drift.

**ID history:** the bare `gist` publisher is taken on the Visual Studio
Marketplace (a third party ships "Gist Color Theme" under it). `gist-is` was
free on both registries on 2026-07-02 and got as far as an Open VSX publish
(`gist-is.gist-discover@0.2.0`) before the same ID turned out taken on the
Marketplace by the time of the actual publish attempt — publisher IDs are
first-come, so a second check can lose a race the first one won. The repo
already had a Marketplace publisher, `Transcendence`, so the extension moved
to `Transcendence.gist-discover` on both stores instead of hunting for a
third free string. The `gist-is.gist-discover` Open VSX listing is now
orphaned — see the Open VSX section below for what to do about it.

Two registries, because Cursor and VS Code do not share a store: Cursor,
Windsurf, and VSCodium pull from **Open VSX**; VS Code proper pulls from the
**Visual Studio Marketplace**.

### Cut the release build

```sh
npm install
npm run package   # typechecks, builds, emits gist-vscode-extension.vsix
```

### Publish to Open VSX (reaches Cursor — do this first)

1. Create an Eclipse Foundation account at <https://accounts.eclipse.org>,
   then log in to <https://open-vsx.org> with it (GitHub OAuth is also
   offered; either way the account must sign the **Open VSX Publisher
   Agreement** in the profile settings).
2. Generate an access token at <https://open-vsx.org/user-settings/tokens>.
3. Claim the namespace (one-time, free as of 2026-07-02):

   ```sh
   npx ovsx create-namespace Transcendence -p <token>
   ```

4. Publish:

   ```sh
   npx ovsx publish gist-vscode-extension.vsix -p <token>
   ```

5. Optional but recommended: file a namespace-ownership claim (an issue on
   <https://github.com/EclipseFdn/open-vsx.org>) so the `Transcendence`
   namespace shows a verified owner instead of the "unrelated publisher"
   warning.
6. Clean up the orphaned `gist-is.gist-discover` listing: either unpublish it
   (`npx ovsx unpublish gist-is.gist-discover -p <token>`, same Eclipse
   account since it created the namespace) or leave it — it never got a
   Marketplace counterpart or any install traffic, so it's inert either way.
   Unpublishing is the tidier choice if the `gist-is` token is still handy.

### Publish to the Visual Studio Marketplace (reaches VS Code)

1. Create (or reuse) an Azure DevOps organization at <https://dev.azure.com>,
   then create a Personal Access Token: scope **Marketplace → Manage**,
   organization **All accessible organizations**.
2. Reuse the existing `Transcendence` publisher at
   <https://marketplace.visualstudio.com/manage> — no need to create a new
   one.
3. Publish:

   ```sh
   npx vsce login Transcendence   # paste the PAT
   npx vsce publish --packagePath gist-vscode-extension.vsix
   ```

   **Always pass `--packagePath` here.** Bare `npx vsce publish` re-packages
   from scratch and, without `--no-dependencies`, walks `node_modules` to
   bundle production deps — since this is an npm workspace, that resolves
   into the hoisted monorepo root and vsce tries to scan and README-validate
   the entire Gist repo (hit this on 2026-07-02: 414k files, crashed
   validating an unrelated markdown note). This standalone repo removes that
   monorepo failure mode; `--packagePath` still uploads the exact `.vsix`
   `npm run package` already built and you
   already smoke-tested — also the only way to guarantee what ships is
   byte-for-byte what you verified.

4. Optional: verify the `gist.is` domain in the publisher settings for the
   blue verified checkmark.

### Cursor publisher verification (after Open VSX is live)

Cursor layers its own verification on top of Open VSX
(<https://cursor.com/help/customization/extensions>):

1. Add a link to the Open VSX listing
   (`https://open-vsx.org/extension/Transcendence/gist-discover`) somewhere
   public on gist.is — e.g. an install section on `/discover` or a
   `/vscode` page. It must be a real domain, not a GitHub README.
2. The `homepage` field in `package.json` must point at that page (currently
   `https://gist.is/discover`).
3. Post in the **Extension Verification** category on
   <https://forum.cursor.com> with the extension name and the gist.is URL.

### Releasing an update

Bump `version` in `package.json`, re-run the package script, then
`npx ovsx publish <vsix> -p <token>` and
`npx vsce publish --packagePath <vsix>`. Both registries auto-update
installed copies.

### Before publishing anything: check the ID first

Publisher IDs are global and first-come on both registries independently —
availability on one says nothing about the other, and a check can lose a
race to another publish between the check and the actual `publish` call (see
ID history above). Verify on both before committing to a name:

```sh
# 404-shaped JSON body ("Namespace not found") means the id is free.
curl -s "https://open-vsx.org/api/<id>"

# Marketplace always returns 200; grep the body instead of the status.
# Empty output means the id is free.
curl -sL "https://marketplace.visualstudio.com/publishers/<id>" \
  | grep -o '"publisherName":"[^"]*"'
```
