// Append to db.js

// Delete a specific profile and all its associated posts
function deleteProfileData(creatorId, profileUrn) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            let deletedPostsCount = 0;

            // 1. Delete the profile from PROFILES_STORE
            if (creatorId) {
                const profileTx = db.transaction(PROFILES_STORE, 'readwrite');
                const profileStore = profileTx.objectStore(PROFILES_STORE);
                profileStore.delete(creatorId);

                await new Promise((res, rej) => {
                    profileTx.oncomplete = res;
                    profileTx.onerror = rej;
                });
            }

            // 2. Delete all posts for this profile from POSTS_STORE
            if (profileUrn) {
                const postsTx = db.transaction(POSTS_STORE, 'readwrite');
                const postsStore = postsTx.objectStore(POSTS_STORE);
                const index = postsStore.index('profileUrn');

                const request = index.openCursor(IDBKeyRange.only(profileUrn));

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        deletedPostsCount++;
                        cursor.continue();
                    }
                };

                await new Promise((res, rej) => {
                    postsTx.oncomplete = res;
                    postsTx.onerror = rej;
                });
            }

            console.log(`[DB] Deleted profile ${creatorId} and ${deletedPostsCount} associated posts.`);
            resolve({ success: true, deletedPostsCount });
        } catch (e) {
            console.error("[DB] Error deleting profile data:", e);
            resolve({ success: false, error: e.message });
        }
    });
}
