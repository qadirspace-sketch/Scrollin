
const API_KEY = process.env.GEMINI_API_KEY; // run with: node --env-file=server/.env scripts/fetch_models.mjs
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function fetchModels() {
    try {
        console.log("Fetching models from:", URL.replace(API_KEY, "KEY_HIDDEN"));
        const response = await fetch(URL);

        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            const text = await response.text();
            console.error("Body:", text);
            return;
        }

        const data = await response.json();
        console.log("Available Flash Models:");
        data.models.filter(m => m.name.includes("flash")).forEach(m => console.log(m.name));
        // console.log("Models:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

fetchModels();
