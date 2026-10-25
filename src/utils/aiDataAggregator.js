/**
 * Prepares topic data for AI generation by aggregating metrics and reducing token usage.
 * 
 * @param {Array} tags - List of tag objects with metrics (volume, engagement, trend, etc.)
 * @param {Array} coOccurrences - List of co-occurring topic pairs
 * @param {number} totalPosts - Total number of posts in the current period
 * @param {string} timeRange - The selected time range (e.g., '30d')
 * @returns {string} - JSON stringified data ready for the AI prompt
 */
export function prepareTopicDataForAI(tags, coOccurrences, totalPosts, timeRange, insights) {
    if (!tags || tags.length === 0) return null;

    // 1. Top Performing Topics (Top 5 by Engagement)
    const topTopics = tags
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 5)
        .map(t => ({
            name: t.name,
            vol: t.volume,
            eng: t.avgEngagement,
            trend: t.trend ? `${t.trend > 0 ? '+' : ''}${t.trend}%` : '0%'
        }));

    // 2. High Volume Topics (Top 3 by Volume - if different from top performers)
    const loudestTopics = tags
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 3)
        .map(t => t.name);

    // 3. Use PRE-CALCULATED insights from the UI logic (Single Source of Truth)
    const rising = insights?.growing;
    const declining = insights?.declining;
    const opportunity = insights?.opportunity;

    // 4. Co-occurrences (Top 3)
    const topCoOccurrences = coOccurrences
        .slice(0, 3)
        .map(c => c.pair);

    // Construct the payload
    const payload = {
        period: timeRange,
        post_count: totalPosts,
        top_topics: topTopics,
        most_discussed: loudestTopics,
        rising_star: rising ? { name: rising.name, trend: `+${rising.trend}%` } : null,
        declining: declining ? { name: declining.name, trend: `${declining.trend}%` } : null,
        opportunity: opportunity ? { name: opportunity.name, note: "High eng, low vol" } : null,
        related_themes: topCoOccurrences
    };

    return payload;
}
