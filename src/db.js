// src/db.js
export const DB_NAME = 'KleoExtensionDB';
export const DB_VERSION = 2; // Bump version to add profiles store
export const POSTS_STORE = 'posts';
export const PROFILES_STORE = 'profiles';

let db = null;

export function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(POSTS_STORE)) {
                const store = db.createObjectStore(POSTS_STORE, { keyPath: 'urn' });
                store.createIndex('profileUrn', 'profileUrn', { unique: false });
                store.createIndex('date', 'date', { unique: false }); // Store as timestamp
                store.createIndex('timestamp', 'timestamp', { unique: false }); // Fetch timestamp
                store.createIndex('creatorId', 'creatorId', { unique: false }); // New index for vanity name
            } else {
                // If store exists, check for new indexes (for existing users upgrading)
                const store = request.transaction.objectStore(POSTS_STORE);
                if (!store.indexNames.contains('creatorId')) {
                    store.createIndex('creatorId', 'creatorId', { unique: false });
                }
            }

            if (!db.objectStoreNames.contains(PROFILES_STORE)) {
                const profileStore = db.createObjectStore(PROFILES_STORE, { keyPath: 'creatorId' }); // Use vanity name as key
                profileStore.createIndex('profileUrn', 'profileUrn', { unique: true });
                profileStore.createIndex('inWatchlist', 'inWatchlist', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

export function savePostsToDB(posts) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction(POSTS_STORE, 'readwrite');
            const store = tx.objectStore(POSTS_STORE);
            let newCount = 0;

            const promises = posts.map(post => {
                return new Promise((res, rej) => {
                    const getReq = store.get(post.urn);

                    getReq.onsuccess = (e) => {
                        const existing = e.target.result;
                        if (!existing) {
                            newCount++; // It's new
                            store.put(post);
                        } else {
                            // Update existing so we get new fields like profileUrn or creatorId
                            // Check if profileUrn is missing or different, then update
                            let updated = false;
                            if (!existing.profileUrn || existing.profileUrn !== post.profileUrn) {
                                updated = true;
                            }
                            if (!existing.creatorId && post.creatorId) {
                                updated = true;
                            }

                            if (updated) {
                                store.put(post);
                            } else {
                                store.put(post);
                            }
                        }
                        res();
                    };

                    getReq.onerror = () => {
                        console.error("Error getting post", post.urn);
                        res();
                    };
                });
            });

            await Promise.all(promises);

            tx.oncomplete = () => {
                resolve(newCount);
            };

            tx.onerror = () => {
                resolve(newCount);
            };
        } catch (error) {
            console.error("Error saving posts to DB:", error);
            resolve(0); // Fail gracefully
        }
    });
}

export function saveProfileToDB(profile) {
    return new Promise(async (resolve, reject) => {
        try {
            if (profile && profile.creatorId) {
                profile.creatorId = profile.creatorId.toLowerCase();
            }
            const db = await openDB();
            const tx = db.transaction(PROFILES_STORE, 'readwrite');
            const store = tx.objectStore(PROFILES_STORE);
            store.put(profile); // Upsert
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => {
                console.error("Error saving profile:", e);
                resolve(false);
            };
        } catch (e) {
            console.error("Error saving profile:", e);
            resolve(false);
        }
    });
}

export function getProfile(creatorId) {
    return new Promise(async (resolve, reject) => {
        if (!creatorId) return resolve(null);
        const lowerId = creatorId.toLowerCase();
        try {
            const db = await openDB();
            const tx = db.transaction(PROFILES_STORE, 'readonly');
            const store = tx.objectStore(PROFILES_STORE);
            const request = store.get(lowerId);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    // Fallback case-insensitive scan of all profiles
                    const allRequest = store.getAll();
                    allRequest.onsuccess = () => {
                        const profiles = allRequest.result || [];
                        const match = profiles.find(p => p.creatorId && p.creatorId.toLowerCase() === lowerId);
                        resolve(match || null);
                    };
                    allRequest.onerror = () => resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}


export function getAllProfiles() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction(PROFILES_STORE, 'readonly');
            const store = tx.objectStore(PROFILES_STORE);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        } catch (e) {
            resolve([]);
        }
    });
}

export function getWatchlistProfiles() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction(PROFILES_STORE, 'readonly');
            const store = tx.objectStore(PROFILES_STORE);
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result || [];
                const watchlist = all.filter(p => p.inWatchlist === true);
                resolve(watchlist);
            };
            request.onerror = () => resolve([]);
        } catch (e) {
            resolve([]);
        }
    });
}

export function checkPostExists(urn) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const tx = db.transaction(POSTS_STORE, 'readonly');
            const store = tx.objectStore(POSTS_STORE);
            const request = store.get(urn);

            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

export function migrateProfileUrn(oldUrn, newUrn) {
    return new Promise(async (resolve, reject) => {
        if (!newUrn || oldUrn === newUrn) return resolve(0);

        try {
            console.log(`Migrating posts from ${oldUrn || 'ORPHANS'} to ${newUrn}...`);
            const db = await openDB();
            const tx = db.transaction(POSTS_STORE, 'readwrite');
            const store = tx.objectStore(POSTS_STORE);
            let request;

            if (!oldUrn) {
                request = store.openCursor();
            } else {
                const index = store.index('profileUrn');
                request = index.openCursor(IDBKeyRange.only(oldUrn));
            }

            let count = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const post = cursor.value;
                    const matchesTarget = !oldUrn ? !post.profileUrn : post.profileUrn === oldUrn;

                    if (matchesTarget) {
                        post.profileUrn = newUrn;
                        cursor.update(post);
                        count++;
                    }
                    cursor.continue();
                }
            };

            tx.oncomplete = () => {
                console.log(`Migration complete. Updated ${count} posts.`);
                resolve(count);
            };

            tx.onerror = (e) => {
                console.error("Migration failed:", e);
                resolve(0);
            };
        } catch (e) {
            console.error("Migration error:", e);
            resolve(0);
        }
    });
}

export function getPostsByProfile(identifier, isUrn = true) {
    return new Promise(async (resolve, reject) => {
        if (!identifier) return resolve([]);
        try {
            const db = await openDB();
            const tx = db.transaction(POSTS_STORE, 'readonly');
            const store = tx.objectStore(POSTS_STORE);
            let request;

            if (isUrn) {
                const index = store.index('profileUrn');
                request = index.getAll(IDBKeyRange.only(identifier));
            } else {
                if (store.indexNames.contains('creatorId')) {
                    const index = store.index('creatorId');
                    request = index.getAll(IDBKeyRange.only(identifier.toLowerCase()));
                } else {
                    resolve([]);
                    return;
                }
            }

            request.onsuccess = () => {
                const posts = request.result || [];
                if (posts.length === 0 && !isUrn) {
                    // Fallback to case-insensitive scan of all posts for creatorId
                    const allRequest = store.getAll();
                    allRequest.onsuccess = () => {
                        const allPosts = allRequest.result || [];
                        const matchedPosts = allPosts.filter(p => p.creatorId && p.creatorId.toLowerCase() === identifier.toLowerCase());
                        matchedPosts.sort((a, b) => {
                            const timeA = extractTimestampFromUrn(a.urn) || 0;
                            const timeB = extractTimestampFromUrn(b.urn) || 0;
                            return timeB - timeA;
                        });
                        resolve(matchedPosts);
                    };
                    allRequest.onerror = () => resolve([]);
                } else {
                    posts.sort((a, b) => {
                        const timeA = extractTimestampFromUrn(a.urn) || 0;
                        const timeB = extractTimestampFromUrn(b.urn) || 0;
                        return timeB - timeA;
                    });
                    resolve(posts);
                }
            };
            request.onerror = () => resolve([]);
        } catch (e) {
            console.error(e);
            resolve([]);
        }
    });
}


export function getLatestPostTimestamp(profileUrn) {
    return new Promise(async (resolve, reject) => {
        try {
            const posts = await getPostsByProfile(profileUrn, true);
            if (posts.length > 0) {
                const latest = posts[0];
                const timestamp = extractTimestampFromUrn(latest.urn);
                resolve({ urn: latest.urn, timestamp: timestamp });
            } else {
                resolve(null);
            }
        } catch (e) {
            resolve(null);
        }
    });
}

export function getLatestPostForProfile(profileUrn) {
    return new Promise(async (resolve) => {
        try {
            const posts = await getPostsByProfile(profileUrn, true);
            resolve(posts.length > 0 ? posts[0] : null);
        } catch (e) {
            resolve(null);
        }
    });
}

export function checkMultiplePostsExist(urns) {
    return new Promise(async (resolve) => {
        try {
            const db = await openDB();
            const tx = db.transaction(POSTS_STORE, 'readonly');
            const store = tx.objectStore(POSTS_STORE);
            const existingUrns = new Set();

            const promises = urns.map(urn => {
                return new Promise((res) => {
                    const req = store.get(urn);
                    req.onsuccess = () => {
                        if (req.result) existingUrns.add(urn);
                        res();
                    };
                    req.onerror = () => res();
                });
            });

            await Promise.all(promises);
            resolve(existingUrns);
        } catch (e) {
            resolve(new Set());
        }
    });
}

export function extractTimestampFromUrn(urn) {
    if (!urn) return 0;
    const match = urn.match(/(\d+)/);
    if (!match) return 0;
    const id = BigInt(match[1]);
    return Number(id >> 22n);
}

export function clearAllPosts() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();

            const tx = db.transaction([POSTS_STORE, PROFILES_STORE], 'readwrite');
            const postsStore = tx.objectStore(POSTS_STORE);
            const profilesStore = tx.objectStore(PROFILES_STORE);

            postsStore.clear();
            profilesStore.clear();

            tx.oncomplete = () => {
                console.log("Database cleared successfully.");
                resolve(true);
            };

            tx.onerror = (e) => {
                console.error("Failed to clear database:", e);
                resolve(false);
            };
        } catch (e) {
            console.error("Error clearing database:", e);
            resolve(false);
        }
    });
}

export function deleteProfileData(creatorId, profileUrn) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            let deletedPostsCount = 0;

            if (creatorId) {
                const profileTx = db.transaction(PROFILES_STORE, 'readwrite');
                const profileStore = profileTx.objectStore(PROFILES_STORE);
                profileStore.delete(creatorId);

                await new Promise((res, rej) => {
                    profileTx.oncomplete = res;
                    profileTx.onerror = rej;
                });
            }

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
