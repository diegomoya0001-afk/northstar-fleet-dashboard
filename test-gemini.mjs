import fs from 'fs';

async function listModels() {
    let apiKey = '';
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const match = env.match(/GEMINI_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
    } catch (e) {
        console.error("Error reading .env.local", e);
    }

    if (!apiKey) {
        console.error("No API key found in .env.local");
        return;
    }

    try {
        console.log("Fetching available models...");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        
        if (data.models) {
            console.log("Supported Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("Error fetching models:", data);
        }
    } catch (e) {
        console.error("Network error:", e);
    }
}

listModels();
