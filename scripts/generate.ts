import fs from 'fs';
import path from 'path';
import { generateVideo, ErrorItem } from './video-generator';

const errorsPath = path.join(__dirname, '../data/errors.json');
const historyPath = path.join(__dirname, '../data/history.json');
const outputDir = path.join(__dirname, '../out');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

async function main() {
    if (!fs.existsSync(errorsPath)) {
        console.error('errors.json not found');
        return;
    }

    // Read errors
    let errors: ErrorItem[] = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));

    // Read history
    let historyWords: string[] = [];
    if (fs.existsSync(historyPath)) {
        historyWords = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }

    // Process all items in errors.json
    // We iterate through a copy or handle index carefully since we'll be modifying the array
    const initialCount = errors.length;
    console.log(`Found ${initialCount} items to process.`);

    // Loop until errors is empty
    while (errors.length > 0) {
        const error = errors[0]; // Always take the first one

        try {
            await generateVideo(error, outputDir);

            // Success!
            // 1. Remove from errors.json (Queue)
            errors.shift(); // Remove first element
            fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 4));

            // 2. Add to history.json if not present
            if (!historyWords.includes(error.targetWord)) {
                historyWords.push(error.targetWord);
                fs.writeFileSync(historyPath, JSON.stringify(historyWords, null, 4));
                console.log(`Added ${error.targetWord} to history.`);
            }

            console.log(`Successfully processed ${error.targetWord}. Remaining: ${errors.length}`);

        } catch (e) {
            console.error(`Failed to process ${error.targetWord}. Skipping removal to allow retry.`);
            // If failed, maybe we should break or skip? 
            // For now, let's break to avoid infinite loop if it's a persistent error
            // Or we could move it to the end?
            // Let's break for safety.
            break;
        }
    }

    console.log("All processing complete.");
}

main();
