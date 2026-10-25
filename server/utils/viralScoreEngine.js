function calculateViralPosts(posts, days = 30) {
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return [];
    }

    const now = Date.now();
    const ONE_DAY_MS = 1000 * 60 * 60 * 24;

    // Step 1: Filter Last X Days
    const recentPosts = posts.filter(post => {
        const createdTime = new Date(post.createdAt).getTime();
        if (isNaN(createdTime)) return false; // Skip invalid dates

        const ageDays = (now - createdTime) / ONE_DAY_MS;
        return ageDays <= days;
    });

    if (recentPosts.length === 0) return [];

    // Step 2: Calculate Weighted Engagement
    const processedPosts = recentPosts.map(post => {
        const likes = Number(post.likes) || 0;
        const comments = Number(post.comments) || 0;
        const reposts = Number(post.reposts) || 0;

        const weightedEngagement = likes + (comments * 3) + (reposts * 5);

        return {
            ...post,
            likes,
            comments,
            reposts,
            weightedEngagement
        };
    });

    // Handle Small Data (N < 5) for 7-Day Window
    if (days === 7 && processedPosts.length < 5) {
        processedPosts.sort((a, b) => b.weightedEngagement - a.weightedEngagement);
        return processedPosts.map(p => ({
            ...p,
            performanceRatio: 0,
            viralLabel: "Normal",
            viralScore7d: 0
        }));
    }

    // Step 3: Calculate Account Average
    const totalEngagement = processedPosts.reduce((sum, p) => sum + p.weightedEngagement, 0);
    const averageEngagement = totalEngagement / processedPosts.length;

    // Step 4 & 5 & 6: Performance Ratio & Labels
    const labeledPosts = processedPosts.map(post => {
        let performanceRatio = 0;

        if (averageEngagement > 0) {
            performanceRatio = post.weightedEngagement / averageEngagement;
        }

        const ratioDisplay = Number(performanceRatio.toFixed(2));
        let viralLabel = "Normal";

        if (days === 7) {
            if (performanceRatio >= 2.5) {
                viralLabel = "Highly Viral";
            } else if (performanceRatio >= 1.5) {
                viralLabel = "Viral";
            }
        } else {
            if (performanceRatio >= 3.0) {
                viralLabel = "Highly Viral";
            } else if (performanceRatio >= 1.8) {
                viralLabel = "Viral";
            }
        }

        const viralScore7d = days === 7 ? (performanceRatio * post.weightedEngagement) : undefined;

        return {
            ...post,
            performanceRatio: ratioDisplay,
            viralLabel,
            viralScore7d
        };
    });

    labeledPosts.sort((a, b) => b.weightedEngagement - a.weightedEngagement);

    return labeledPosts;
}

module.exports = { calculateViralPosts };
