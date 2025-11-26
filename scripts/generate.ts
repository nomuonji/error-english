import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { generateAudio } from './generate-audio';
import { parseFile } from 'music-metadata';

const errorsPath = path.join(__dirname, '../data/errors.json');
const errors = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));

const outputDir = path.join(__dirname, '../out');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const audioBaseDir = path.join(__dirname, '../public/audio');

async function main() {
    for (const error of errors) {
        console.log(`Processing word ${error.targetWord}...`);

        const wordAudioDir = path.join(audioBaseDir, error.targetWord);

        // Define audio tasks
        const audioTasks = [
            { key: 'errorMessage', text: error.errorMessage, lang: 'en-US', gender: 'FEMALE' },
            { key: 'messageTranslation', text: error.messageTranslation, lang: 'ja-JP', gender: 'FEMALE' },
            { key: 'targetWord', text: error.targetWord, lang: 'en-US', gender: 'FEMALE' },
            { key: 'generalMeaning', text: error.generalMeaning, lang: 'ja-JP', gender: 'FEMALE' },
            { key: 'generalExample', text: error.generalExample, lang: 'en-US', gender: 'MALE' },
            { key: 'techMeaning', text: error.techMeaning, lang: 'ja-JP', gender: 'MALE' },
            { key: 'explanation', text: error.explanation, lang: 'ja-JP', gender: 'FEMALE' },
            { key: 'usageContext', text: error.usageContext, lang: 'ja-JP', gender: 'FEMALE' },
            { key: 'usageExample', text: error.usageExample, lang: 'en-US', gender: 'MALE' },
            { key: 'usageExampleTranslation', text: error.usageExampleTranslation, lang: 'ja-JP', gender: 'MALE' },
            { key: 'usagePunchline', text: error.usagePunchline, lang: 'en-US', gender: 'FEMALE' }, // Boss is female? or change to MALE
            { key: 'usagePunchlineTranslation', text: error.usagePunchlineTranslation, lang: 'ja-JP', gender: 'FEMALE' },
        ];

        const audioPaths: Record<string, string> = {};
        const audioDurations: Record<string, number> = {};

        for (const task of audioTasks) {
            const fileName = `${task.key}.mp3`;
            const filePath = path.join(wordAudioDir, fileName);
            // Cast gender to expected type
            try {
                await generateAudio(task.text, filePath);
                // Path for staticFile (relative to public)
                audioPaths[task.key] = `/audio/${error.targetWord}/${fileName}`;

                // Get duration
                const metadata = await parseFile(filePath);
                audioDurations[task.key] = metadata.format.duration || 0;

            } catch (e) {
                console.error(`Failed to generate audio for ${task.key}. Continuing without audio.`);
                // throw e; // Allow generation to continue
            }
        }

        const props = {
            ...error,
            audioPaths,
            audioDurations
        };

        const propsFile = path.join(__dirname, `../temp-props-${error.targetWord}.json`);
        fs.writeFileSync(propsFile, JSON.stringify(props));

        console.log(`Rendering video for word ${error.targetWord}...`);
        try {
            execSync(`npx remotion render src/index.ts ErrorEnglishVideo out/video-${error.targetWord}.mp4 --props=${propsFile}`, {
                stdio: 'inherit',
            });
        } catch (e) {
            console.error(`Failed to render video for ${error.targetWord}`);
        } finally {
            if (fs.existsSync(propsFile)) {
                fs.unlinkSync(propsFile);
            }
            // Clean up audio files for this word
            if (fs.existsSync(wordAudioDir)) {
                fs.rmSync(wordAudioDir, { recursive: true, force: true });
                console.log(`Cleaned up audio directory: ${wordAudioDir}`);
            }
        }
    }
    console.log("All videos rendered!");
}

main();
