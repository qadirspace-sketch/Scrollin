/**
 * Cloudflare Worker for LinkedIn Post Tagging (Embeddings)
 * Uses Cloudflare Workers AI with the @cf/baai/bge-small-en-v1.5 model.
 * Supports:
 * - Single Mode: { "text": "..." }
 * - Batch Mode: { "batch": [ { "id": "1", "text": "..." }, ... ] }
 */

const TAGS = [
    "Career Advice",
    "Personal Story",
    "Opinion / Take",
    "LinkedIn Platform",
    "Leadership",
    "Marketing",
    "Hiring",
    "Productivity",
    "Startup",
    "AI / Tech",
    "Software Engineering",
    "Web Development",
    "Design / UX",
    "Mental Health",
    "Work Culture",
    "Motivation",
    "Content Creation",
    "Finance / Investing",
    "Sales",
    "Freelancing",
    "Cybersecurity",
    "Travel",
    "Personal Branding",
    "Life Story",
    "Health & Wellness",
    "General"
];

// Cache Tag Embeddings (In-memory for the lifetime of the worker instance)
// This avoids re-computing tag embeddings on every request if the worker is kept warm.
let CACHED_TAG_VECTORS = null;

export default {
    async fetch(request, env) {
        // 1. CORS Headers
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return new Response("Expected POST", { status: 405, headers: corsHeaders });
        }

        try {
            const body = await request.json();

            // --- BATCH MODE ---
            if (body.batch && Array.isArray(body.batch)) {
                const results = {};

                // For 'bge-small', we can process items reasonably fast.
                // We process them sequentially to ensure we don't hit rate limits or memory issues with Promise.all on the worker side,
                // although strict parallel is possible if volume is low.
                for (const item of body.batch) {
                    if (item.text) {
                        const result = await classifyText(item.text, env);
                        results[item.id] = result;
                    }
                }

                return new Response(JSON.stringify(results), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // --- SINGLE MODE (Backwards Compatibility) ---
            if (body.text) {
                const result = await classifyText(body.text, env);
                return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            return new Response("Missing text or batch field", { status: 400, headers: corsHeaders });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
        }
    }
};

/**
 * Core Logic: Classify a single text string
 */
async function classifyText(text, env) {
    // 1. Generate embedding for the input text
    const textEmbeddingResponse = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
        text: [text],
    });
    const textVector = textEmbeddingResponse.data[0];

    // 2. Get Tag Embeddings (Cached if possible)
    if (!CACHED_TAG_VECTORS) {
        // console.log("Computing Tag Embeddings...");
        const tagsEmbeddingResponse = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
            text: TAGS
        });
        CACHED_TAG_VECTORS = tagsEmbeddingResponse.data;
    }
    const tagVectors = CACHED_TAG_VECTORS;

    // 3. Calculate Cosine Similarity
    const scores = TAGS.map((tag, index) => {
        return {
            tag: tag,
            score: cosineSimilarity(textVector, tagVectors[index])
        };
    });

    // 4. Sort by score
    scores.sort((a, b) => b.score - a.score);

    // 5. Return top matches
    const bestMatch = scores[0];
    const secondMatch = scores[1];

    return {
        primaryTag: bestMatch.tag,
        secondaryTag: secondMatch.tag,
        confidence: bestMatch.score,
        // allScores: scores.slice(0, 3) // Optional: Reduce payload size by omitting full list
    };
}

function cosineSimilarity(A, B) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < A.length; i++) {
        dotProduct += A[i] * B[i];
        normA += A[i] * A[i];
        normB += B[i] * B[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
