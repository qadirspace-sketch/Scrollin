
import { getTagsForPost } from './taggingService';
import React from 'react';
import ReactDOM from 'react-dom/client';
import PostTagOverlay from '../components/PostTagOverlay';

/**
 * Initializes the Post Observer to watch for LinkedIn posts in the feed.
 */
export function initPostObserver() {
    console.log("Post Observer Initialized");

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // 1 is Element Node
                    // Check if node itself is a post or contains posts
                    if (node.matches && node.matches('.feed-shared-update-v2')) {
                        processPost(node);
                    }
                    // Also check children for initial load or batched updates
                    const posts = node.querySelectorAll ? node.querySelectorAll('.feed-shared-update-v2') : [];
                    posts.forEach(processPost);
                }
            }
        }
    });

    // Start observing the main feed container
    // We try to find a stable ancestor. 'body' is safest but expensive.
    // 'scaffold-layout__main' or '.core-rail' is better if available.
    const targetNode = document.body;
    observer.observe(targetNode, { childList: true, subtree: true });

    // Initial scan
    document.querySelectorAll('.feed-shared-update-v2').forEach(processPost);
}

/**
 * Processes a single post element.
 * @param {Element} postElement 
 */
async function processPost(postElement) {
    if (postElement.dataset.kleoTagged) return;
    postElement.dataset.kleoTagged = "true"; // Mark as processed

    // Extract Text
    const textElement = postElement.querySelector('.update-components-text span.break-words');
    const text = textElement ? textElement.innerText : "";
    const postId = postElement.getAttribute('data-urn') || "";

    // Generate Tags (Async)
    const result = await getTagsForPost(text, postId);

    // Render Overlay
    // injectTagOverlay(postElement, result); // User requested to hide tags on the main feed
}

/**
 * Injects the tag overlay into the post.
 * @param {Element} postElement 
 * @param {Object} tagResult 
 */
function injectTagOverlay(postElement, tagResult) {
    if (!tagResult.primaryTag && tagResult.primaryTag !== 'General') return;

    // Create a container for our react root
    const container = document.createElement('div');
    container.className = 'kleo-tag-container';

    // Position it: Ideally top right or bottom left of the post.
    // LinkedIn structure changes, so precise targeting is needed.
    // Try to append to specific metadata areas or just prepend to the whole card.

    // Let's try prepending to the first child for visibility, or find the header.
    // .feed-shared-control-menu is the "three dots" menu top right.
    const menu = postElement.querySelector('.feed-shared-control-menu');

    if (menu) {
        // Insert before the menu (top right corner area)
        menu.parentNode.insertBefore(container, menu);
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginRight = '8px';
    } else {
        // Fallback: Prepend to post
        postElement.style.position = 'relative';
        postElement.prepend(container);
        container.style.position = 'absolute';
        container.style.top = '12px';
        container.style.right = '48px'; // Avoid 3-dots
    }

    const root = ReactDOM.createRoot(container);
    root.render(
        <PostTagOverlay
            primaryTag={tagResult.primaryTag}
            secondaryTag={tagResult.secondaryTag}
            confidence={tagResult.confidence}
        />
    );
}
