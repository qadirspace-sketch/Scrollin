# Proposal

## Why

Scrollin no longer collects any posts. LinkedIn's new web UI (`/flagship-web/`, React Server Components) renders profile activity server-side and never sends the `voyagerFeedDashProfileUpdates` GraphQL request that the background script waits for. Without that request the extension never learns the profile URN, query ID, or headers, so no fetch is ever started. Verified on 2026-10-25: the activity page made no feed GraphQL call. Calling `voyagerFeedDashProfileUpdates` directly still returns HTTP 200 with posts, pagination token, and the same JSON shape the backend parser expects.

## What Changes

- When a LinkedIn tab lands on a profile page (`/in/<vanity>/...`), including SPA navigations, the background script starts post capture itself instead of waiting for LinkedIn to send the feed request.
- The content script gains a way to resolve a vanity name to its `fsd_profile` URN (via LinkedIn's identity API, using the page's own session) and return the CSRF token.
- The background script builds the session (URN, default feed query ID, CSRF/accept headers) from that and runs the existing normal or watchlist fetch path.
- The original network-interception trigger stays in place; whichever trigger fires first wins, and the other is skipped for that profile.
- No change to the backend parser, data model, or UI.

## Capabilities

### New Capabilities
- `profile-post-capture`: how the extension detects a LinkedIn profile visit and collects that profile's posts.

### Modified Capabilities

(none — no existing specs)

## Impact

- `src/background.js`: new proactive bootstrap on tab navigation; the capture-start logic is factored out of the debugger listener so both triggers share it.
- `src/main.jsx`: new `resolve_profile` message handler in the content script.
- Requires the existing local backend (`server/`, port 5001) to be running and the user to be logged in to Scrollin, which is unchanged but worth noting since parsing fails without it.
- Rebuild (`npm run build`) and reload the unpacked extension.
