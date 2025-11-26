import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.AIVIS_API_KEY;
const MODEL_UUID = process.env.AIVIS_MODEL_UUID;

if (!API_KEY || !MODEL_UUID) {
    console.error("Missing API_KEY or MODEL_UUID in .env");
    process.exit(1);
}

export async function generateAudio(text: string, outputFile: string) {
    // Ensure directory exists
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Check if file exists to avoid re-generating
    if (fs.existsSync(outputFile)) {
        // console.log(`Audio already exists: ${outputFile}`);
        return;
    }

    const url = 'https://api.aivis-project.com/v1/tts/synthesize';
    const data = JSON.stringify({
        model_uuid: MODEL_UUID,
        text: text,
        style_id: 0, // Default style
        speed: 1.0,
        pitch: 0.0,
        intonation: 1.0
    });

    return new Promise<void>((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${API_KEY}`
            },
        }, (res) => {
            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', (chunk) => errorBody += chunk);
                res.on('end', () => {
                    console.error(`API Error: ${errorBody}`);
                    reject(new Error(`API Request failed with status ${res.statusCode}: ${errorBody}`));
                });
                return;
            }

            // Aivis API likely returns the audio file directly (audio/wav or similar)
            // We'll write it directly to the file.
            const file = fs.createWriteStream(outputFile);
            res.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`Generated audio: ${outputFile}`);
                resolve();
            });

            file.on('error', (err) => {
                fs.unlink(outputFile, () => { }); // Delete failed file
                reject(err);
            });
        });

        req.on('error', (e) => {
            console.error('Request error', e);
            reject(e);
        });
        req.write(data);
        req.end();
    });
}
