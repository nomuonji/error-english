import { uploadVideo } from './upload-youtube';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const videoPath = process.argv[2];

if (!videoPath) {
    console.error('Please provide a video file path.');
    console.error('Usage: npx tsx scripts/upload-single.ts <path-to-video>');
    process.exit(1);
}

const absolutePath = path.resolve(videoPath);

if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

// Default metadata for manual upload
const fileName = path.basename(absolutePath, path.extname(absolutePath));
const title = `${fileName} #shorts`;
const description = `
Uploaded via manual script.

#shorts
`.trim();
const tags = ['manual', 'upload'];

async function main() {
    try {
        await uploadVideo(absolutePath, title, description, tags);
        console.log('Upload complete.');
    } catch (error) {
        console.error('Upload failed:', error);
        process.exit(1);
    }
}

main();
