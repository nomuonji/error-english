import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
});

const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
});

export async function uploadVideo(
    filePath: string,
    title: string,
    description: string,
    tags: string[]
) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    console.log(`Uploading ${filePath} to YouTube...`);

    try {
        const res = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title,
                    description,
                    tags,
                    categoryId: '28', // Science & Technology
                },
                status: {
                    privacyStatus: 'public', // Change to 'private' or 'unlisted' if needed
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: fs.createReadStream(filePath),
            },
        });

        console.log(`Upload successful! Video ID: ${res.data.id}`);
        return res.data;
    } catch (error) {
        console.error('Error uploading to YouTube:', error);
        throw error;
    }
}
