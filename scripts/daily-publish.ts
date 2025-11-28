import fs from 'fs';
import path from 'path';
import { generateVideo, ErrorItem } from './video-generator';
import { uploadVideo } from './upload-youtube';
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
        const videoPath = await generateVideo(item, outputDir);

        // 4. Upload to YouTube
        let title = `【エンジニア英語】${item.targetWord}: ${item.errorMessage}`;
        const suffix = ' #shorts';
        const maxLength = 100;

        if (title.length + suffix.length > maxLength) {
            title = title.substring(0, maxLength - suffix.length - 3) + '...';
        }
        title += suffix;
        const description = `
${item.targetWord}
意味: ${item.generalMeaning}

エラーメッセージ:
${item.errorMessage}
訳: ${item.messageTranslation}

解説:
${item.explanation}

#プログラミング #英語 #エンジニア #エラー #English
        `.trim();

        const tags = ['programming', 'english', 'error', 'engineer', 'learning', item.targetWord];

        const uploadResult = await uploadVideo(videoPath, title, description, tags);

        // 5. Remove from errors.json (Queue) and add to history.json
        // Re-read errors.json to avoid race conditions with replenish script
        const currentErrors: ErrorItem[] = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
        const indexToRemove = currentErrors.findIndex(e => e.targetWord === item.targetWord);

        if (indexToRemove !== -1) {
            currentErrors.splice(indexToRemove, 1);
            fs.writeFileSync(errorsPath, JSON.stringify(currentErrors, null, 4));
        } else {
            console.warn(`Item ${item.targetWord} was already removed from errors.json`);
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

        console.log(`Successfully processed and uploaded ${item.targetWord}. Removed from queue and added to history.`);

        // Cleanup video file
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }

    } catch (error) {
        console.error('Failed to process item:', error);
        process.exit(1);
    }
}

main();
