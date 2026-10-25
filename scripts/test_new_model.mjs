import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY; // run with: node --env-file=server/.env scripts/test_new_model.mjs
const genAI = new GoogleGenerativeAI(API_KEY);

async function testModel() {
    const modelName = "gemini-2.0-flash";
    console.log(`Testing ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you there?");
        const response = await result.response;
        console.log(`✅ SUCCESS: ${modelName} responded:`, response.text());
    } catch (error) {
        console.log(`❌ FAILED: ${modelName}`, error);
    }
}

testModel();
