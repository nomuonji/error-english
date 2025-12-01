import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { generateAudio } from './generate-audio';
import { parseFile } from 'music-metadata';

export interface ErrorItem {
    targetWord: string;
    errorMessage: string;
    messageTranslation: string;
    generalMeaning: string;
    generalExample: string;
    techMeaning: string;
    explanation: string;
    usageContext: string;
    usageExample: string;
    usageExampleTranslation: string;
    usagePunchline: string;
    usagePunchlineTranslation: string;
    status?: string;
    youtubeId?: string;
    publishedAt?: string;
}

export async function generateVideo(error: ErrorItem, outputDir: string) {
    console.log(`Processing word ${error.targetWord}...`);

    const audioBaseDir = path.join(__dirname, '../public/audio');
    const wordAudioDir = path.join(audioBaseDir, error.targetWord);

    // Define audio tasks
    const audioTasks = [
        { key: 'errorMessage', text: error.errorMessage, lang: 'en-US', gender: 'FEMALE' },
        { key: 'messageTranslation', text: error.messageTranslation, lang: 'ja-JP', gender: 'FEMALE' },
        { key: 'targetWord', text: error.targetWord, lang: 'en-US', gender: 'FEMALE' },
        { key: 'generalMeaning', text: error.generalMeaning.replace(/【.*?】/g, ''), lang: 'ja-JP', gender: 'FEMALE' },
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
    const getFrames = (key: string) => Math.ceil((audioDurations[key] || 0) * fps);

    // 1. Panic Scene
    const panicAudio = getFrames('errorMessage');
    const panicDuration = Math.max(120, 45 + panicAudio + 60);

    // 2. Error Meaning Scene
    const errorMeaningAudio = getFrames('messageTranslation');
    const errorMeaningDuration = Math.max(150, 10 + errorMeaningAudio + 60);

    // 3. Word Scene
    // Composition: start 30, 3 clips, 2 gaps of 15
    const wordAudioSum = getFrames('targetWord') + getFrames('generalMeaning') + getFrames('generalExample');
    const wordContentEnd = 30 + wordAudioSum + 30; // 30 start + audio + 2*15 gaps
    const wordDuration = wordContentEnd + 30; // +1s buffer

    // 4. Context Scene
    // Composition: start 20, 2 clips, 1 gap of 20
    const contextAudioSum = getFrames('techMeaning') + getFrames('explanation');
    const contextContentEnd = 20 + contextAudioSum + 20;
    const contextDuration = Math.max(150, contextContentEnd + 100); // Buffer for Naruhodo

    // 5. Usage Scene
    // Composition: start 100, 5 clips, 4 gaps of 15
    const usageAudioSum =
        getFrames('usageContext') +
        getFrames('usageExample') +
        getFrames('usageExampleTranslation') +
        getFrames('usagePunchline') +
        getFrames('usagePunchlineTranslation');
    const usageContentEnd = 100 + usageAudioSum + 60; // 100 start + audio + 4*15 gaps
    const usageDuration = usageContentEnd + 150; // +5s for CTA/Outro

    // 6. Outro Scene
    // Composition: start 20, follow_me audio
    let followMeFrames = 0;
    try {
        const followMePath = path.join(__dirname, '../public/se/follow_me.mp3');
        if (fs.existsSync(followMePath)) {
            const metadata = await parseFile(followMePath);
            followMeFrames = Math.ceil((metadata.format.duration || 0) * fps);
        }
    } catch (e) {
        console.error("Failed to get follow_me.mp3 duration");
    }
    const outroDuration = 20 + followMeFrames + 90; // 20 start + audio + 3s buffer

    const sceneDurations = {
        panic: panicDuration,
        errorMeaning: errorMeaningDuration,
        word: wordDuration,
        context: contextDuration,
        usage: usageDuration,
        outro: outroDuration
    };

    const totalDuration = panicDuration + errorMeaningDuration + wordDuration + contextDuration + usageDuration + outroDuration;

    const props = {
        ...error,
        audioPaths,
        audioDurations,
        sceneDurations
    };

    const propsFile = path.join(__dirname, `../temp-props-${error.targetWord}.json`);
    fs.writeFileSync(propsFile, JSON.stringify(props));

    const outputPath = path.join(outputDir, `video-${error.targetWord}.mp4`);
    const thumbnailPath = path.join(outputDir, `thumbnail-${error.targetWord}.png`);

    // Calculate thumbnail frame: panic scene start + error frame (45) + audio + buffer (10) + settle time (20)
    // This targets the "What does this mean??" text
    const thumbnailFrame = 45 + panicAudio + 30;

    console.log(`Rendering video for word ${error.targetWord} (Duration: ${totalDuration} frames)...`);
    try {
        // Generate Video
        execSync(`npx remotion render src/index.ts ErrorEnglishVideo "${outputPath}" --props="${propsFile}" --duration-in-frames=${totalDuration} --timeout=240000 --concurrency=1`, {
            stdio: 'inherit',
        });

        // Generate Thumbnail
        console.log(`Generating thumbnail at frame ${thumbnailFrame}...`);
        execSync(`npx remotion still src/index.ts ErrorEnglishVideo "${thumbnailPath}" --props="${propsFile}" --frame=${thumbnailFrame}`, {
            stdio: 'inherit',
        });

        return { videoPath: outputPath, thumbnailPath };
    } catch (e) {
        console.error(`Failed to render video for ${error.targetWord}`);
        throw e;
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
