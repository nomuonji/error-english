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

    // 4. Usage Scene Intro: "Let's use it like this"
    await generateAudio('こうやって使おう', path.join(__dirname, '../public/se/usage_intro.mp3'));

    // 5. Usage Scene Outro: "Let's use it from tomorrow"
    await generateAudio('明日から使ってみよう', path.join(__dirname, '../public/se/usage_outro.mp3'));

    // 6. Outro Scene: "Follow me"
    await generateAudio('フォローしてね', path.join(__dirname, '../public/se/follow_me.mp3'));
}

main().catch(console.error);
