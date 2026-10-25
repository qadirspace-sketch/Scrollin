# Tasks

## 1. Content script: profile resolution

- [x] 1.1 Add a `resolve_profile` message handler in `src/main.jsx` that calls LinkedIn's identity API for a vanity and responds with `{ profileUrn, csrfToken }` or `{ error }`. Verify by running the same request in a signed-in LinkedIn tab and getting an `urn:li:fsd_profile:` value.

## 2. Background: shared capture start

- [x] 2.1 Extract the watchlist/normal capture-start logic from the debugger listener in `src/background.js` into `startProfileCapture(tabId, vanity, profileUrn)` with a `captureVanity` guard, and call it from the debugger path. Verify that `npm run build` succeeds and the debugger path still calls into it.

- [x] 2.2 Restrict the interception trigger to profile feed queries so requests carrying the logged-in user's own `profileUrn` no longer hijack the session. Verify on a live profile that the URN the bootstrap resolves matches the viewed member, not `/voyager/api/me`.

## 3. Background: proactive bootstrap

- [x] 3.1 Add `bootstrapProfileSession(tabId, vanity)`: skip if capture already started for this vanity, resolve the URN (cache first, then `resolve_profile`), reset the session on profile switch, fill `queryId`/headers, then call `startProfileCapture` and notify `session_captured`. Log `[Capture]` errors on failure. Verify that `npm run build` succeeds.
- [x] 3.2 Schedule the bootstrap from `chrome.tabs.onUpdated` for `/in/<vanity>` URLs on load-complete and URL change, debounced per tab. Verify that `npm run build` succeeds.

## 4. Verification

- [x] 4.1 Run the resolve + feed request sequence the bootstrap uses against a live signed-in LinkedIn profile and confirm it returns a URN and posts with a pagination token.
- [ ] 4.2 Reload the unpacked extension in Chrome, visit a profile's activity page with the backend running, and confirm `[Capture]` logs plus posts in the Scrollin panel. (Manual: needs the user's Chrome.)

## Workflow follow-up

- Archive the change with `/opsx:archive` once verified in Chrome.
