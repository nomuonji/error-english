import { refreshAccessToken } from './threads-api';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    try {
        await refreshAccessToken();
    } catch (error) {
        console.error('Error refreshing token:', error);
        process.exit(1);
    }
}

main();
