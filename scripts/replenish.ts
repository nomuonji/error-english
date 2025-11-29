import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const errorsPath = path.join(__dirname, '../data/errors.json');
const THRESHOLD = 10;

async function main() {
    if (!fs.existsSync(errorsPath)) {
        console.log('errors.json not found, generating new data...');
        execSync('npx tsx scripts/generate-new-errors.ts', { stdio: 'inherit' });
        return;
    }

    const errors = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
    const pendingCount = errors.length;

    console.log(`Current pending stock: ${pendingCount}`);

    if (pendingCount < THRESHOLD) {
        console.log(`Stock is low (< ${THRESHOLD}). Replenishing...`);
        execSync('npx tsx scripts/generate-new-errors.ts', { stdio: 'inherit' });
    } else {
        console.log('Stock is sufficient.');
    }
}

main();
