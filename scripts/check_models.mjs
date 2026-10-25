import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY; // run with: node --env-file=server/.env scripts/check_models.mjs
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        // There isn't a direct "listModels" on the client instance in some versions of the SDK,
        // but usually it's there or we can try to inspect.
        // Actually, checking docs (or knowing the SDK), usually implies we might need the ModelServiceClient but the high level SDK often hides it.

        // Let's try to just run a generation with a few likely candidates and print which one works.
        const candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-001",
            "gemini-1.0-pro",
            "gemini-pro"
        ];

        console.log("Testing model availability...");

        for (const modelName of candidates) {
            try {
                console.log(`Testing ${modelName}...`);
                const m = genAI.getGenerativeModel({ model: modelName });
                const result = await m.generateContent("Hello");
                const response = await result.response;
                console.log(`✅ SUCCESS: ${modelName} responded:`, response.text());
                return; // Found one!
            } catch (error) {
                console.log(`❌ FAILED: ${modelName}`, error);
            }
        }

        console.log("No working model found in candidates.");

    } catch (error) {
        console.error("Fatal error:", error);
    }
}

listModels();
