# Design

## Context

Today capture is driven entirely by `chrome.debugger` network interception in `src/background.js`. A `voyager/api/graphql` request containing `profileUrn:` gives the background the URN, `queryId` and request headers, and that kicks off `fetchNextBatch` (normal profiles) or `runWatchlistSync` (watchlist profiles). The new LinkedIn UI never sends that request (see proposal.md - Why).

Constraints found while investigating:
- The Scrollin sidebar mounts lazily on first toggle click, so the sidebar's `url_changed` message cannot be the trigger. Capture previously worked with the panel closed.
- `JSESSIONID` is readable from `document.cookie` in the content script and doubles as the CSRF token. The content script already relies on this in `fetch_url`.
- `GET /voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=<vanity>` (normalized JSON accept header) returns the `fsd_profile` URN as `data['*elements'][0]`.
- The hardcoded fallback `voyagerFeedDashProfileUpdates.4af00b28d60ed0f1488018948daad822` still returns HTTP 200 with posts.

## Goals / Non-Goals

**Goals:**
- Capture works with the new UI, panel open or closed, on full loads and SPA navigations.
- Reuse the existing fetch, parse and storage pipeline unchanged.

**Non-Goals:**
- Parsing LinkedIn's RSC/SDUI stream payloads.
- Changing the backend, the DB schema, or UI components.
- Discovering fresh `queryId`s automatically. If LinkedIn retires the hardcoded one, that is a separate change.

## Decisions

1. **Trigger from `chrome.tabs.onUpdated` in the background.** It fires for full loads (`status: complete`) and history navigations (`changeInfo.url`), and it doesn't depend on the panel. A per-tab timer (about 2.5 s) debounces repeated events and gives the legacy interception path a chance to win first.
   *Alternative:* sidebar `url_changed`. Rejected because the panel is often closed.

2. **Resolve the URN in the content script (`resolve_profile` message).** The request then runs in the page origin with first-party cookies, and the CSRF token comes back with it. The background caches the result in `vanityToUrn` and the profile store.
   *Alternative:* fetch from the service worker with `chrome.cookies`. Rejected because it needs a new `cookies` permission.

3. **Factor the post-capture start into `startProfileCapture(tabId, vanity, profileUrn)`.** The debugger listener and the new bootstrap both call it, so the watchlist/normal branching lives in one place. A `session.captureVanity` marker records which profile already started capture, so a second trigger becomes a no-op.

4. **Synthesize headers when none were intercepted:** `csrf-token`, `accept: application/vnd.linkedin.normalized+json+2.1`, `x-restli-protocol-version: 2.0.0`. This matches what LinkedIn's own client sends and what `watchlistFetch` needs.

5. **Interception only trusts feed queries.** In the new UI, nav and messaging GraphQL calls carry the logged-in user's own `profileUrn`. The old "any request with `profileUrn:`" rule captured that ID, fetched the user's own (often empty) feed, and blocked the bootstrap. Found in the first Chrome test: the stored URN matched `/voyager/api/me`. Interception now ignores everything except `voyagerFeedDashProfile*` queries.

## Risks / Trade-offs

- [LinkedIn retires the hardcoded feed `queryId`] → The fetch fails with a 4xx and a logged error. Mitigation: a captured `queryId` still overrides it whenever LinkedIn does send one, and `lastKnownSession` persists it.
- [Identity endpoint changes] → The `[Capture]` error makes the failure obvious. Cached URNs in `vanityToUrn` keep known profiles working.
- [Extra request per profile visit] → One small identity call, skipped when the URN is already cached.
