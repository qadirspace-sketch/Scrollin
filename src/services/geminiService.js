/**
 * Secure proxy calls to the Node.js backend server for Gemini AI processing.
 * This keeps the API keys and prompts secure on the server.
 */

export async function generateExecutiveSummary(payloads) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "generate_executive_summary",
            payloads
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || "Failed to generate executive summary"));
            }
        });
    });
}

export async function generatePostingHabitsSummary(payloads) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "generate_posting_habits_summary",
            payloads
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || "Failed to generate posting habits summary"));
            }
        });
    });
}

export async function generatePostingAnalyticsSummary(payloads) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "generate_posting_analytics_summary",
            payloads
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || "Failed to generate posting analytics summary"));
            }
        });
    });
}
