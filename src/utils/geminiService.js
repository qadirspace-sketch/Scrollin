/**
 * Secure proxy calls to the Node.js backend server for Groq/Llama structure analysis.
 * This keeps the Groq API key and prompts secure on the server.
 */

export const polishTemplateWithLLM = async (templateObject) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: "polish_template_with_llm",
            templateObject
        }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || "Failed to polish template structure"));
            }
        });
    });
};
