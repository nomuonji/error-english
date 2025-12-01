import dotenv from 'dotenv';

dotenv.config();

const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

export async function postInstagramReels(caption: string, videoUrl: string, coverUrl?: string) {
    console.log('Posting to Instagram Reels...');

    if (!INSTAGRAM_ACCOUNT_ID || !INSTAGRAM_ACCESS_TOKEN) {
        throw new Error('Instagram credentials not found in environment variables.');
    }

    // 1. Create Container
    const createUrl = `https://graph.facebook.com/v19.0/${INSTAGRAM_ACCOUNT_ID}/media`;
    const body: any = {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption,
        access_token: INSTAGRAM_ACCESS_TOKEN
    };

    if (coverUrl) {
        body.cover_url = coverUrl;
    }

    const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!createRes.ok) {
        const errorText = await createRes.text();
        throw new Error(`Failed to create Instagram container: ${errorText}`);
    }

    const createData = await createRes.json();
    const creationId = createData.id;
    console.log(`Instagram Container ID: ${creationId}`);

    // 2. Wait for container to be ready
    let attempts = 0;
    while (attempts < 20) {
        const statusUrl = `https://graph.facebook.com/v19.0/${creationId}?fields=status_code,status&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
        const statusRes = await fetch(statusUrl);

        if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log(`Instagram Container status: ${statusData.status_code} (${statusData.status})`);

            // Status codes: EXPIRED, ERROR, FILTERED, IN_PROGRESS, PUBLISHED, FINISHED
            if (statusData.status_code === 'FINISHED') {
                break;
            }
            if (statusData.status_code === 'ERROR') {
                throw new Error(`Instagram Container creation failed: ${JSON.stringify(statusData)}`);
            }
        } else {
            console.warn(`Waiting for Instagram container to be available... (Attempt ${attempts + 1})`);
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;
    }

    // 3. Publish
    const publishUrl = `https://graph.facebook.com/v19.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;
    const publishRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: creationId,
            access_token: INSTAGRAM_ACCESS_TOKEN
        })
    });

    if (!publishRes.ok) {
        const errorText = await publishRes.text();
        throw new Error(`Failed to publish to Instagram: ${errorText}`);
    }

    const result = await publishRes.json();
    console.log('Posted to Instagram Reels successfully:', result.id);
    return result;
}
