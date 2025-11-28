import fs from 'fs';
import path from 'path';
import { generateVideo, ErrorItem } from './video-generator';
import dotenv from 'dotenv';

dotenv.config();

const errorsPath = path.join(__dirname, '../data/errors.json');
const outputDir = path.join(__dirname, '../out');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

async function main() {
    // 1. Read errors
    if (!fs.existsSync(errorsPath)) {
        console.error('errors.json not found');
        process.exit(1);
    }
    const errors: ErrorItem[] = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));

    // 2. Find pending item
    const pendingIndex = errors.findIndex(e => !e.status || e.status === 'pending');

    if (pendingIndex === -1) {
        console.log('No pending items found.');
        return;
    }

    const item = errors[pendingIndex];
    console.log(`Found pending item: ${item.targetWord}`);

    try {
        // 3. Generate Video
        console.log('Generating video...');
        const videoPath = await generateVideo(item, outputDir);
        console.log(`Video generated successfully at: ${videoPath}`);

        // Check for --test flag
        const isTest = process.argv.includes('--test');

        if (!isTest) {
            // 4. Remove from errors.json (Queue) and add to history.json
            // Re-read errors.json to avoid race conditions
            const currentErrors: ErrorItem[] = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
            const indexToRemove = currentErrors.findIndex(e => e.targetWord === item.targetWord);

            if (indexToRemove !== -1) {
                currentErrors.splice(indexToRemove, 1);
                fs.writeFileSync(errorsPath, JSON.stringify(currentErrors, null, 4));
            }

            const historyPath = path.join(__dirname, '../data/history.json');
            let historyWords: string[] = [];
            if (fs.existsSync(historyPath)) {
                historyWords = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            }
            if (!historyWords.includes(item.targetWord)) {
                historyWords.push(item.targetWord);
                fs.writeFileSync(historyPath, JSON.stringify(historyWords, null, 4));
            }
            console.log(`Removed ${item.targetWord} from queue and added to history.`);
        } else {
            console.log('Test mode: Item retained in queue.');
        }

    } catch (error) {
        console.error('Failed to process item:', error);
        process.exit(1);
    }
}

main();
