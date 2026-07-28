---
name: deploy
description: Package and publish Gist Discover as a VS Code/Cursor extension to Open VSX and Visual Studio Marketplace. Use for versioning, VSIX creation, ovsx/vsce publishing, publisher identity, registry verification, or release troubleshooting.
---

# Release Gist Discover

Read `README.dev.md` and `package.json`.

1. Run the TypeScript/test/package gates documented by the repo.
2. Build one VSIX and inspect its manifest, files, publisher, version, icon,
   license, and bundled extension behavior.
3. Verify Open VSX and VS Marketplace publisher identities and token
   prerequisites without printing tokens.
4. Publish the exact VSIX to Open VSX with `ovsx`.
5. Publish the same VSIX to VS Marketplace with `vsce --packagePath`.
6. Verify both registry listings and downloadable versions.

Do not use Chrome MV3 or Cloudflare deployment procedures.
