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
            { key: 'usagePunchline', text: error.usagePunchline, lang: 'en-US', gender: 'FEMALE' },
            { key: 'usagePunchlineTranslation', text: error.usagePunchlineTranslation, lang: 'ja-JP', gender: 'FEMALE' },
        ];

        const audioPaths: Record<string, string> = {};
        const audioDurations: Record<string, number> = {};

        for (const task of audioTasks) {
            const fileName = `${task.key}.mp3`;
            const filePath = path.join(wordAudioDir, fileName);

            try {
                await generateAudio(task.text, filePath);
                // Path for staticFile (relative to public)
                audioPaths[task.key] = `/audio/${error.targetWord}/${fileName}`;

                // Get duration
                const metadata = await parseFile(filePath);
                audioDurations[task.key] = metadata.format.duration || 0;

            } catch (e) {
                console.error(`Failed to generate audio for ${task.key}. Continuing without audio.`);
            }
        }

        // Calculate scene durations
        const fps = 30;
        const paddingFrames = 15; // 0.5s
        const getFrames = (key: string) => Math.ceil((audioDurations[key] || 0) * fps);

        const panicAudio = getFrames('errorMessage');
        const panicDuration = Math.max(120, 45 + panicAudio + 60);

        const wordAudio = [
            getFrames('targetWord'),
            getFrames('generalMeaning'),
            getFrames('generalExample'),
            getFrames('messageTranslation')
        ].reduce((a, b) => a + b + paddingFrames, 0);
        const wordDuration = Math.max(300, wordAudio + 60);

        const contextAudio = [
            getFrames('techMeaning'),
            getFrames('explanation')
        ].reduce((a, b) => a + b + 5, 0); // Reduced padding between clips
        const contextDuration = Math.max(150, contextAudio + 60); // Min 5s, buffer for Naruhodo

        const usageAudio = [
            getFrames('usageContext'),
            getFrames('usageExample'),
            getFrames('usageExampleTranslation'),
            getFrames('usagePunchline'),
            getFrames('usagePunchlineTranslation')
        ].reduce((a, b) => a + b + paddingFrames, 0);
        const usageDuration = Math.max(300, usageAudio + 60);

        const outroDuration = 150;

        const sceneDurations = {
            panic: panicDuration,
            word: wordDuration,
            context: contextDuration,
            usage: usageDuration,
            outro: outroDuration
        };

        const totalDuration = panicDuration + wordDuration + contextDuration + usageDuration + outroDuration;

        const props = {
            ...error,
            audioPaths,
            audioDurations,
            sceneDurations
        };

        const propsFile = path.join(__dirname, `../temp-props-${error.targetWord}.json`);
        fs.writeFileSync(propsFile, JSON.stringify(props));

        console.log(`Rendering video for word ${error.targetWord} (Duration: ${totalDuration} frames)...`);
        try {
            execSync(`npx remotion render src/index.ts ErrorEnglishVideo out/video-${error.targetWord}.mp4 --props=${propsFile} --durationInFrames=${totalDuration} --timeout=240000 --concurrency=1`, {
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
