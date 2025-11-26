import { generateAudio } from './generate-audio';
import path from 'path';

async function main() {
    // 1. Shorter type sound
    // Using a short, sharp sound text and high speed
    await generateAudio('Tap', path.join(__dirname, '../public/se/type.mp3'));

    // 2. "What does this mean?" for PanicScene
    await generateAudio('どういう意味？', path.join(__dirname, '../public/se/what_mean.mp3'));

    // 3. "Naruhodo!" for ContextScene end
    await generateAudio('なるほど！', path.join(__dirname, '../public/se/context_end.mp3'));
}

main().catch(console.error);
