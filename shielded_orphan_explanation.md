# Issue Analysis: The "Shielded Orphan" Problem

## Symptoms
- The extension shows "Update Complete" (or stops fetching).
- The total post count remains low (e.g., 99 posts).
- The `background.js` logs show: `[Fetch Check] Initial post ... exists in DB. Stopping fetch.`
- The user is seeing only the *newly fetched* posts, while thousands of older posts are missing from the view.

## Root Cause
1.  **Orphan Posts**: In previous versions of the extension (or due to bugs), posts were saved to the IndexedDB *without* a `profileUrn`. These are "orphans".
2.  **Fetch Logic**: When the extension fetches posts, it checks if the *first* post of the batch already exists in the DB. If it does, it stops fetching to save resources.
3.  **The Shield**: If you recently ran the extension (after the fix), the *topmost* posts (e.g., the first 100) were saved correctly WITH the `profileUrn`.
4.  **The Defect**:
    - The fetcher sees the top post is already in the DB (the valid one).
    - It decides "I'm done, no need to go further".
    - It stops fetching.
    - **CRITICALLY**: It previously skipped the "Migration" step because the existing post matched the current profile.
    - Result: The fetch stops, but the 2500+ older posts (buried deeper) remain orphans and are never adopted to the current profile.

## The Fix (Applied)
I have updated `background.js` to trigger an **aggressive orphan adoption** even when the fetch stops normally.

### New Logic:
- **IF** fetch stops because data exists:
    - **CHECK D.B.** for any posts that have `null`/`undefined` as their `profileUrn`.
    - **ADOPT** them into the current active `profileUrn`.
    - **THEN** notify the tab update is complete.

## Verification
1. Refresh the extension.
2. Go to the LinkedIn profile.
3. Scroll/Fetch.
4. Watch the logs (or the UI).
5. You should see a log: `[Migration] Adopted X orphan posts.` (where X is ~2500).
6. The UI counter should jump to the correct total.
