/* data.jsx — moderate, believable sample data for "Scroll in" */

// avatar helper: deterministic pastel SVG data-uri avatars (no external imgs)
function makeAvatar(initials, bg, fg) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='40' fill='${bg}'/><text x='50%' y='50%' dy='.35em' text-anchor='middle' font-family='Hanken Grotesk,sans-serif' font-size='30' font-weight='700' fill='${fg}'>${initials}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const AV = {
  alex: makeAvatar("A", "#8AB7EE", "#fff"),
  maya: makeAvatar("MR", "#FAE9CF", "#8A6E3E"),
  devon: makeAvatar("DK", "#E2EEE6", "#3F8C4D"),
  priya: makeAvatar("PS", "#CFDEFB", "#3A5C8A"),
  liam: makeAvatar("LT", "#E7E6EB", "#5A5A62"),
  nora: makeAvatar("NW", "#FFE2CB", "#C97A33"),
  sam: makeAvatar("SC", "#F6E0DB", "#C2503D"),
};

const NAV = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "analytics", icon: "analytics", label: "Posting Analytics" },
  { id: "habits", icon: "habits", label: "Posting Habits" },
  { id: "topics", icon: "topics", label: "Topic Intelligence" },
  { id: "hooks", icon: "hooks", label: "Hooks & Patterns" },
  { id: "creators", icon: "creators", label: "Creator Intelligence" },
  { id: "watchlist", icon: "watchlist", label: "Watchlist", dot: true },
  { id: "remix", icon: "remix", label: "Idea Remix Lab" },
  { id: "dna", icon: "dna", label: "Full DNA Report" },
];

// ---- Dashboard ----
const DASH_STATS = [
  { title: "Avg Engagement", sub: "per post · 7D", num: "4.8", unit: "%", fill: "stat-peach", delta: "+0.6", up: true },
  { title: "Top Topic 7D", sub: "by reach", num: "Career", unit: "", fill: "stat-blue", small: true },
  { title: "Viral Posts", sub: "10k+ impressions", num: "3", unit: "", fill: "stat-gray", delta: "+2", up: true },
];

const FEED = [
  {
    id: 1, author: "Maya Rao", av: AV.maya, time: "2h", rank: 1, badge: "High Engagement",
    text: "I stopped writing posts that 'add value' and started writing posts that start arguments (the productive kind). Engagement tripled in 3 weeks. Here's the exact reframe that changed everything for me →",
    likes: "1.2k", comments: 184, shares: 92, topic: "Personal Branding",
    media: ["Carousel · slide 1", "Carousel · slide 2", "Carousel · slide 3"],
  },
  {
    id: 2, author: "Devon Kerr", av: AV.devon, time: "5h", rank: 4, badge: "High Engagement",
    text: "Nobody tells you this about your first leadership role: the skills that got you promoted are the exact ones you now have to unlearn. A short thread on what actually moved the needle for my team last quarter.",
    likes: 842, comments: 121, shares: 47, topic: "Leadership",
    media: ["Carousel · slide 1", "Carousel · slide 2"],
  },
  {
    id: 3, author: "Priya Shah", av: AV.priya, time: "9h", rank: 7,
    text: "Hot take: most 'productivity systems' are just procrastination with extra steps. I deleted 4 apps last month and got more done than I had all year. The one thing I kept was almost embarrassingly simple.",
    likes: 613, comments: 88, shares: 31, topic: "Productivity",
    media: [],
  },
];

const TRENDING = [
  { title: "Contrarian hooks", desc: "Posts opening with a contrarian take are up 38% in saves this month.", ic: "ic-blue", icon: "bolt" },
  { title: "Carousels > text", desc: "Multi-slide carousels outperform plain text by 2.1× on dwell time.", ic: "ic-green", icon: "trendUp" },
  { title: "Friday slump", desc: "Your Friday posts under-index. Shift them to Tuesday AM.", ic: "ic-orange", icon: "clock" },
];

// ---- Analytics ----
const ANALYTICS_TREND = {
  Likes:      [320, 410, 380, 520, 610, 540, 720, 680, 810, 760, 920, 1040],
  Comments:   [42, 58, 51, 73, 88, 70, 102, 95, 118, 110, 134, 152],
  Reposts:    [12, 18, 15, 22, 27, 21, 33, 29, 38, 35, 44, 51],
  Engagement: [2.1, 2.6, 2.4, 3.1, 3.6, 3.2, 4.0, 3.8, 4.4, 4.2, 4.7, 4.8],
};
const TREND_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ANALYTICS_POSTS = [
  { text: "The reframe that tripled my engagement in 3 weeks…", date: "May 28", eng: 1684, pct: 100 },
  { text: "Why your first leadership role breaks the skills that…", date: "May 24", eng: 1010, pct: 60 },
  { text: "Most productivity systems are procrastination with…", date: "May 19", eng: 732, pct: 43 },
  { text: "I audited 200 viral posts. They all share one structure.", date: "May 14", eng: 968, pct: 57 },
  { text: "Stop ending posts with a question. Do this instead.", date: "May 09", eng: 544, pct: 32 },
];

// ---- Habits ----
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = ["6a","9a","12p","3p","6p","9p"];
// heat[day][hour] = 0..4 intensity
const HEAT = [
  [1,3,2,1,2,1],
  [2,4,3,2,3,1],
  [1,3,4,2,2,1],
  [2,3,3,1,2,0],
  [1,2,1,1,1,0],
  [0,1,2,2,3,1],
  [0,1,2,3,2,1],
];
const HABIT_FREQ = [
  { day: "Mon", n: 3 }, { day: "Tue", n: 6 }, { day: "Wed", n: 5 },
  { day: "Thu", n: 4 }, { day: "Fri", n: 2 }, { day: "Sat", n: 1 }, { day: "Sun", n: 2 },
];
const HABIT_RECS = [
  { title: "Tuesday 9am is your peak", desc: "4.7% avg engagement — 1.8× your weekly mean.", fill: "stat-blue" },
  { title: "Cut Friday cadence", desc: "Friday posts under-index by 40%. Reallocate to Tue/Wed.", fill: "stat-peach" },
  { title: "Add one Sunday evening slot", desc: "6pm Sundays show rising reach as people plan their week.", fill: "stat-mint" },
];

// ---- Topics ----
const TOPIC_CLOUD = [
  { w: "Career Growth", s: 42 }, { w: "Leadership", s: 36 }, { w: "Productivity", s: 30 },
  { w: "Personal Branding", s: 34 }, { w: "Hiring", s: 22 }, { w: "Remote Work", s: 26 },
  { w: "AI Tools", s: 38 }, { w: "Startups", s: 28 }, { w: "Negotiation", s: 18 },
  { w: "Networking", s: 20 }, { w: "Burnout", s: 16 }, { w: "Founder Life", s: 24 },
];
const TOPIC_TABLE = [
  { topic: "Career Growth", posts: 18, likes: 842, comments: 96, trend: "up", delta: "+24%" },
  { topic: "AI Tools", posts: 12, likes: 1130, comments: 142, trend: "up", delta: "+41%" },
  { topic: "Leadership", posts: 15, likes: 690, comments: 78, trend: "flat", delta: "+3%" },
  { topic: "Productivity", posts: 11, likes: 520, comments: 61, trend: "down", delta: "−12%" },
  { topic: "Remote Work", posts: 8, likes: 430, comments: 44, trend: "down", delta: "−8%" },
];
const TOPIC_PAIRS = [
  { a: "Career Growth", b: "Negotiation", n: 14 },
  { a: "AI Tools", b: "Productivity", n: 11 },
  { a: "Leadership", b: "Hiring", n: 9 },
  { a: "Personal Branding", b: "Networking", n: 7 },
  { a: "Startups", b: "Founder Life", n: 6 },
];

// ---- Hooks & Patterns ----
const HOOK_CATS = [
  { kind: "Hidden Gem", icon: "gem", ic: "ic-blue", desc: "Rarely used by you, but converts when it appears.", action: "3 templates ready" },
  { kind: "Viral Potential", icon: "flame", ic: "ic-orange", desc: "High ceiling, high variance. Use on big ideas.", action: "Try on your next launch" },
  { kind: "Reliable Staple", icon: "check", ic: "ic-green", desc: "Consistent mid-to-high performer. Safe bet.", action: "Your most-used pattern" },
];
const HOOK_PATTERNS = [
  { rank: 1, name: "The Contrarian Open", freq: 84, kind: "Viral Potential" },
  { rank: 2, name: "Vulnerable Confession", freq: 71, kind: "Reliable Staple" },
  { rank: 3, name: "Numbered Breakdown", freq: 66, kind: "Reliable Staple" },
  { rank: 4, name: "The Pattern Interrupt", freq: 52, kind: "Hidden Gem" },
  { rank: 5, name: "Before / After Story", freq: 47, kind: "Viral Potential" },
  { rank: 6, name: "The Permission Slip", freq: 38, kind: "Hidden Gem" },
];
const HOOK_TEMPLATE = `I stopped {common_behavior} and started {contrarian_action}.

{outcome} in {timeframe}.

Here's the exact reframe that changed everything →

1. {point_one}
2. {point_two}
3. {point_three}

{closing_line}`;

// ---- Creator Intelligence / Watchlist ----
const CREATORS = [
  { name: "Maya Rao", av: AV.maya, role: "Brand strategist", followers: "48.2k", eng: "5.1%", posts: 24, trend: "up", topic: "Personal Branding" },
  { name: "Devon Kerr", av: AV.devon, role: "VP Engineering", followers: "31.7k", eng: "3.8%", posts: 18, trend: "up", topic: "Leadership" },
  { name: "Priya Shah", av: AV.priya, role: "Productivity coach", followers: "62.4k", eng: "4.4%", posts: 31, trend: "flat", topic: "Productivity" },
  { name: "Liam Torres", av: AV.liam, role: "Startup founder", followers: "19.8k", eng: "6.2%", posts: 12, trend: "up", topic: "Founder Life" },
  { name: "Nora West", av: AV.nora, role: "Talent partner", followers: "27.1k", eng: "3.1%", posts: 21, trend: "down", topic: "Hiring" },
];

window.SI_DATA = {
  AV, NAV, DASH_STATS, FEED, TRENDING,
  ANALYTICS_TREND, TREND_LABELS, ANALYTICS_POSTS,
  DAYS, HOURS, HEAT, HABIT_FREQ, HABIT_RECS,
  TOPIC_CLOUD, TOPIC_TABLE, TOPIC_PAIRS,
  HOOK_CATS, HOOK_PATTERNS, HOOK_TEMPLATE,
  CREATORS,
};
