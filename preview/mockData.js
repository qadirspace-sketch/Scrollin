// Sample posts shaped like the backend parser's output (server/server.js parsePost).

const DAY = 24 * 60 * 60 * 1000;

// LinkedIn activity IDs are snowflakes: the post time in ms is the ID shifted right by 22 bits.
const urnFor = (time, seq) =>
    `urn:li:activity:${(BigInt(time) << 22n) + BigInt(seq)}`;

const HOOKS = [
    'I got rejected from 47 jobs before landing my first PM role.',
    'Stop writing cold emails like this.',
    '3 lessons from scaling a team from 5 to 50 engineers:',
    'Unpopular opinion: most standups are a waste of time.',
    'What would you do if you knew you couldn\'t fail?',
    'My manager told me something in 2019 that changed my career.',
    'The best hire I ever made had no degree.',
    'Here\'s the exact framework I use to prioritize a roadmap.',
    'Nobody talks about the loneliness of being a founder.',
    '7 tools I use every single day as a product manager:',
    'I quit my $200k job. Here\'s what happened next.',
    'Hot take: "culture fit" is killing your diversity.',
    'How do you know when it\'s time to pivot?',
    'Last week a junior designer taught me more than any course.',
    '5 mistakes I made in my first year of management.',
    'We shipped a feature nobody used. Here\'s why I\'m glad we did.',
];

const BODIES = [
    'Here is what I learned along the way, and what I would do differently if I started again today.',
    'It took me years to understand this. I hope it saves you some time.',
    'The short version: talk to your users, write things down, and protect your team\'s focus.',
    'Curious to hear how others think about this. Drop your take in the comments.',
];

const pseudoRandom = (seed) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
};

export function makePosts(creatorId, creatorName, count = 48, spanDays = 120) {
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => {
        const r = pseudoRandom(i + creatorId.length);
        const time = now - Math.floor((i / count) * spanDays * DAY) - Math.floor(r * DAY * 0.8) - 3 * 60 * 60 * 1000;
        const breakout = r > 0.88;
        const likes = Math.floor((breakout ? 1500 : 80) + r * (breakout ? 3000 : 420));
        const isRepost = i % 9 === 4;
        const media = i % 4 === 0
            ? [{ type: 'image', url: `https://picsum.photos/seed/${creatorId}${i}/800/450` }]
            : [];
        return {
            urn: urnFor(time, i),
            text: `${HOOKS[i % HOOKS.length]}\n\n${BODIES[i % BODIES.length]}`,
            media,
            stats: {
                likes,
                comments: Math.floor(likes * (0.04 + r * 0.08)),
                reposts: Math.floor(likes * (0.01 + r * 0.03)),
                views: likes * Math.floor(25 + r * 40),
            },
            date: `${Math.max(1, Math.round((now - time) / DAY))}d •`,
            creatorId,
            creatorName,
            creatorImage: `https://i.pravatar.cc/100?u=${creatorId}`,
            socialDetailUrn: null,
            isRepost,
            repostType: isRepost ? 'repost' : null,
            postUrl: `https://www.linkedin.com/feed/update/${urnFor(time, i)}/`,
            profileUrn: `urn:li:fsd_profile:${creatorId}`,
        };
    });
}

export const PROFILES = [
    { creatorId: 'alexrivera', name: 'Alex Rivera' },
    { creatorId: 'priyanair', name: 'Priya Nair' },
    { creatorId: 'samokafor', name: 'Sam Okafor' },
];

export const POSTS_BY_CREATOR = Object.fromEntries(
    PROFILES.map((p, i) => [p.creatorId, makePosts(p.creatorId, p.name, 48 - i * 10)])
);

export const WATCHLIST = PROFILES.map(p => ({
    creatorId: p.creatorId,
    profileUrn: `urn:li:fsd_profile:${p.creatorId}`,
    profileUrl: `https://www.linkedin.com/in/${p.creatorId}/`,
    inWatchlist: true,
    lastUpdated: Date.now() - 2 * 60 * 60 * 1000,
    name: p.name,
    creatorName: p.name,
    creatorImage: `https://i.pravatar.cc/100?u=${p.creatorId}`,
    postCount: POSTS_BY_CREATOR[p.creatorId].length,
}));
