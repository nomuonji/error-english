import fs from 'fs';
import path from 'path';
import { generateAudio } from './generate-audio';

const errorsPath = path.join(__dirname, '../data/errors.json');
const errors = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));

const audioBaseDir = path.join(__dirname, '../public/audio');

async function main() {
    console.log("Updating audio files...");

    for (const error of errors) {
        console.log(`Processing word ${error.targetWord}...`);

        const wordAudioDir = path.join(audioBaseDir, error.targetWord);
        if (!fs.existsSync(wordAudioDir)) {
            fs.mkdirSync(wordAudioDir, { recursive: true });
        }

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

        for (const task of audioTasks) {
            const fileName = `${task.key}.mp3`;
            const filePath = path.join(wordAudioDir, fileName);

            // Force regeneration if it's generalMeaning, otherwise skip if exists
            if (task.key === 'generalMeaning' && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            try {
                await generateAudio(task.text, filePath);
            } catch (e) {
                console.error(`Failed to generate audio for ${task.key}:`, e);
            }
        }
    }
    console.log("All audio files updated!");
}

main();
