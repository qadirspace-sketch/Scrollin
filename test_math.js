const sortedPosts = [
    { dateObj: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), likes: 1630 }, // 5 days ago (Current 30)
    { dateObj: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), likes: 45 },    // 45 days ago (Prev 30)
];

const now = new Date();
const getFilterDate = (range) => {
    const d = new Date(now.getTime());
    if (range === 'Last 7 Days') d.setDate(now.getDate() - 7);
    else if (range === 'Last 15 Days') d.setDate(now.getDate() - 15);
    else if (range === 'Last 30 Days') d.setDate(now.getDate() - 30);
    else if (range === 'Last 90 Days') d.setDate(now.getDate() - 90);
    else d.setFullYear(now.getFullYear() - 1); // 1 year fallback
    return d;
};

const filterDate = getFilterDate('Last 30 Days');
const currentPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= filterDate);

const prevPeriodFilterDate = new Date(filterDate);
const diff = now.getTime() - filterDate.getTime();
prevPeriodFilterDate.setTime(filterDate.getTime() - diff);
const prevPeriodPosts = sortedPosts.filter(p => p.dateObj && p.dateObj >= prevPeriodFilterDate && p.dateObj < filterDate);

console.log("Current Posts Volume:", currentPeriodPosts.length, "| Prev Posts Volume:", prevPeriodPosts.length);

const currentTotalMetric = currentPeriodPosts.reduce((acc, p) => acc + p.likes, 0);
const prevTotalMetricFromList = prevPeriodPosts.reduce((acc, p) => acc + p.likes, 0);

let totalGrowth = ((currentTotalMetric - prevTotalMetricFromList) / prevTotalMetricFromList) * 100;

let displayAvg = currentTotalMetric / currentPeriodPosts.length;
let prevDisplayAvg = prevTotalMetricFromList / prevPeriodPosts.length;

let avgGrowth = ((displayAvg - prevDisplayAvg) / prevDisplayAvg) * 100;

console.log("Total Growth:", totalGrowth.toFixed(1) + "%");
console.log("Avg Growth:", avgGrowth.toFixed(1) + "%");

// Scenario 2: Different post volumes
const sortedPosts2 = [
    { dateObj: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), likes: 1000 }, 
    { dateObj: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), likes: 630 }, 
    { dateObj: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), likes: 45 },    
];
const currentPeriodPosts2 = sortedPosts2.filter(p => p.dateObj && p.dateObj >= filterDate);
const prevPeriodPosts2 = sortedPosts2.filter(p => p.dateObj && p.dateObj >= prevPeriodFilterDate && p.dateObj < filterDate);
console.log("\nCurrent Posts Volume (2):", currentPeriodPosts2.length, "| Prev Posts Volume (2):", prevPeriodPosts2.length);

const currentTotalMetric2 = currentPeriodPosts2.reduce((acc, p) => acc + p.likes, 0);
const prevTotalMetricFromList2 = prevPeriodPosts2.reduce((acc, p) => acc + p.likes, 0);

let totalGrowth2 = ((currentTotalMetric2 - prevTotalMetricFromList2) / prevTotalMetricFromList2) * 100;
let displayAvg2 = currentTotalMetric2 / currentPeriodPosts2.length;
let prevDisplayAvg2 = prevTotalMetricFromList2 / prevPeriodPosts2.length;
let avgGrowth2 = ((displayAvg2 - prevDisplayAvg2) / prevDisplayAvg2) * 100;

console.log("Total Growth 2:", totalGrowth2.toFixed(1) + "%");
console.log("Avg Growth 2:", avgGrowth2.toFixed(1) + "%");
