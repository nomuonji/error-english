import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const errorsPath = path.join(__dirname, '../data/errors.json');
const historyPath = path.join(__dirname, '../data/history.json');
const promptPath = path.join(__dirname, '../prompts/generate-error-data.md');

async function main() {
    // 1. Read history for exclusion
    let historyWords: string[] = [];
    if (fs.existsSync(historyPath)) {
        historyWords = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
    console.log(`Existing words in history: ${historyWords.join(', ')}`);

    // 2. Read prompt template
    let promptTemplate = fs.readFileSync(promptPath, 'utf-8');

    // 3. Add exclusion list to prompt
    const exclusionInstruction = `
\n\n## 除外リスト
以下の単語は既に生成済みのため、**絶対に**生成しないでください：
${historyWords.join(', ')}

JSON形式で出力してください。Markdownのコードブロックは不要です。
`;

    const finalPrompt = promptTemplate + exclusionInstruction;

    console.log('Generating new error data with Gemini...');

    try {
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        let content = response.text();

        if (!content) {
            console.error('No content received from Gemini');
            return;
        }

        // Clean up markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        // Parse the response
        let newErrors: any[] = [];
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                newErrors = parsed;
            } else if (parsed.errors && Array.isArray(parsed.errors)) {
                newErrors = parsed.errors;
            } else {
                // Try to find an array in the object values
                const values = Object.values(parsed);
                const arrayValue = values.find(v => Array.isArray(v));
                if (arrayValue) {
                    newErrors = arrayValue as any[];
                } else {
                    console.error('Could not find an array in the response:', content);
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            console.log('Raw content:', content);
            return;
        }

        // Filter out any duplicates that might have slipped through (sanity check)
        const currentErrors = fs.existsSync(errorsPath) ? JSON.parse(fs.readFileSync(errorsPath, 'utf-8')) : [];
        const currentErrorWords = currentErrors.map((e: any) => e.targetWord);
        const allExistingWords = [...new Set([...historyWords, ...currentErrorWords])];

        const uniqueNewErrors = newErrors.filter((e: any) => !allExistingWords.includes(e.targetWord));

        if (uniqueNewErrors.length === 0) {
            console.log('No new unique errors generated.');
            return;
        }

        console.log(`Generated ${uniqueNewErrors.length} new errors: ${uniqueNewErrors.map((e: any) => e.targetWord).join(', ')}`);

        // 4. Append to errors.json (Queue)
        const updatedErrors = [...currentErrors, ...uniqueNewErrors];
        fs.writeFileSync(errorsPath, JSON.stringify(updatedErrors, null, 4));
        console.log(`Updated ${errorsPath}`);

        // Note: We do NOT update history.json here. 
        // It will be updated when the video is successfully generated/published.

    } catch (error) {
        console.error('Error generating data:', error);
    }
}

main();
