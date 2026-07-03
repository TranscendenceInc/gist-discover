/**
 * Gist Discover VS Code extension — host entry point.
 *
 * Registers a sidebar `WebviewView` named "Discover" under the "Gist"
 * activity-bar container. The provider serves a tiny HTML shell whose only
 * job is to iframe https://gist.is/discover — the live Discover page already
 * is the full reader experience (feed, layers, Listen, share, favorites),
 * so there is nothing to reimplement on the host.
 */
import * as vscode from 'vscode';
import { DiscoverViewProvider } from './discover-view-provider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DiscoverViewProvider.viewType, new DiscoverViewProvider(), {
      // Destroy the webview when the user hides the sidebar so we are not
      // paying memory + audio playback for an offscreen tab. The website
      // persists feed position in its own storage; users restart at the top
      // of the feed on reopen, which matches the rest of /discover.
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );
}

export function deactivate(): void {
  // Per-subscription cleanup is handled by `context.subscriptions`.
}
