import fs from 'fs';
import path from 'path';
import { generateVideo, ErrorItem } from './video-generator';
import { uploadVideo } from './upload-youtube';
import { postThreads } from './threads-api';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

const errorsPath = path.join(__dirname, '../data/errors.json');
const outputDir = path.join(__dirname, '../out');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

async function uploadToTmpFiles(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);
    const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
    // Command: curl -F "file=@<file>" https://tmpfiles.org/api/v1/upload
    const command = `${curlCommand} -F "file=@${filePath}" https://tmpfiles.org/api/v1/upload`;

    console.log(`Uploading ${fileName} to tmpfiles.org using ${curlCommand}...`);
    const { stdout, stderr } = await execAsync(command);

    if (!stdout || stdout.trim().length === 0) {
        throw new Error(`Upload failed or returned empty response. Stderr: ${stderr}`);
    }

    try {
        const json = JSON.parse(stdout);
        if (json.status !== 'success') {
            throw new Error(`tmpfiles.org upload failed: ${JSON.stringify(json)}`);
        }

        const originalUrl = json.data.url;
        // Convert to direct download URL: https://tmpfiles.org/dl/[id]/[filename]
        const directUrl = originalUrl.replace('//tmpfiles.org/', '//tmpfiles.org/dl/');
        return directUrl;
    } catch (e) {
        throw new Error(`Failed to parse tmpfiles.org response: ${stdout}`);
    }
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
        const youtubeUrl = `https://youtube.com/shorts/${uploadResult.id}`;

        // 5. Post to Threads
        try {
            console.log('Uploading video to tmpfiles.org for Threads...');
            const videoUrl = await uploadToTmpFiles(videoPath);
            console.log(`Video uploaded to: ${videoUrl}`);

            const threadsText = `${title}\n\n#プログラミング #英語`;
            await postThreads(threadsText, videoUrl);
        } catch (threadsError) {
            console.error('Failed to post to Threads:', threadsError);
            // Don't fail the whole process if Threads fails, but log it.
        }

        // 6. Remove from errors.json (Queue) and add to history.json
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
