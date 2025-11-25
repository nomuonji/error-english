import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const errorsPath = path.join(__dirname, '../data/errors.json');
const errors = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));

const outputDir = path.join(__dirname, '../out');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

errors.forEach((error: any) => {
    console.log(`Rendering video for word ${error.targetWord}...`);
    const props = JSON.stringify(error);

    const propsFile = path.join(__dirname, `../temp-props-${error.targetWord}.json`);
    fs.writeFileSync(propsFile, props);

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
    }
});

console.log("All videos rendered!");
