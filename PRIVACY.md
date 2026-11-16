# Privacy Policy

Starcat Browser Plugin is a local companion extension for Starcat. It enhances GitHub repository pages and supported Google Search result pages with context already available in the Starcat app.

## Data Processing

The extension processes only the page and pairing data needed to provide its visible features. It does not sell personal data or transmit browser data to Starcat servers or third parties.

The extension does not:

- Track browsing history.
- Send page content to Starcat servers.
- Call GitHub APIs directly.
- Call OpenSSF, AI providers, or Starcat backend services directly.
- Use analytics, telemetry, or advertising SDKs.

## Local Data Storage

The extension stores connection metadata in trusted-context `chrome.storage.local`:

- The saved loopback address, browser instance ID, device ID, and selected transport.
- A manually entered legacy Local API Key, when that advanced option is used.

Newly paired device tokens are stored separately in extension-origin IndexedDB and are not returned to content scripts. Pending request secrets remain in the background and expire with the request. The app records the browser type, chosen device name, browser instance ID, and pairing/access times for device management. It holds the extension origin temporarily to bind the one-time claim. The instance ID is randomly generated, not a hardware or browsing fingerprint.

Unpairing asks the app to revoke that device token. Clearing only local credentials does not revoke app authorization; revoke it in Starcat when the app is reachable. Legacy shared Keys require rotation in the app.

## Local Communication

The extension communicates with:

```text
http://127.0.0.1:{port}/plugin/v1
```

An optional user-installed Chrome Native Messaging host can proxy the same local traffic through the Starcat CLI. Its manifest permits only the specified extension ID. Native discovery probes the saved address and the single default loopback port `5051`; no LAN scan or cloud discovery is performed.

The Starcat app owns all business data, including repository context, private notes, wiki links, recommendations, health scores, and CodeFlow / Codebase actions.

## Page Access

The extension reads the current GitHub page URL to identify the repository owner and name, and injects Starcat UI into GitHub repository pages.

It also runs on supported Google Search result pages to identify links to GitHub repositories. For up to eight visible GitHub repository results, it uses the repository owner and name to request local Starcat context and may display an `Open in Starcat` action and Health information. It does not store the full Google page or send it to Starcat servers or third parties.

## Private Notes

When you edit a note from GitHub, the extension sends the note content to the local Starcat app. The extension does not persist note content in Chrome storage.

## Changes

Privacy-related changes should be documented in this file before release.
