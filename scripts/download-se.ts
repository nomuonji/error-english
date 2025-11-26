import fs from 'fs';
import path from 'path';

const files = [
    { url: 'https://github.com/mayfrost/guides/raw/master/notification_sound/alert.mp3', dest: 'public/se/alert.mp3' },
    { url: 'https://github.com/wesbos/key-sound/raw/master/sounds/01.mp3', dest: 'public/se/pop.mp3' },
    { url: 'https://github.com/wesbos/key-sound/raw/master/sounds/02.mp3', dest: 'public/se/type.mp3' }
];

async function downloadFile(url: string, dest: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(__dirname, '../', dest), Buffer.from(buffer));
    console.log(`Downloaded ${dest}`);
}

async function main() {
    const seDir = path.join(__dirname, '../public/se');
    if (!fs.existsSync(seDir)) {
        fs.mkdirSync(seDir, { recursive: true });
    }

    for (const file of files) {
        try {
            await downloadFile(file.url, file.dest);
        } catch (e) {
            console.error(e);
        }
    }
}

main();
