import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(__dirname, '../data/threads-token.json');

export async function getAccessToken(): Promise<string> {
    if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        return data.access_token;
    }
    if (process.env.THREADS_ACCESS_TOKEN) {
        return process.env.THREADS_ACCESS_TOKEN;
    }
    throw new Error('No Threads access token found');
}

export async function saveAccessToken(token: string) {
    const data = { access_token: token, updated_at: new Date().toISOString() };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

export async function refreshAccessToken() {
    console.log('Refreshing Threads access token...');
    const token = await getAccessToken();
    const url = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`;

    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to refresh token: ${text}`);
        // If refresh fails, we might want to keep the old one or throw.
        // For now, throw.
        throw new Error(`Failed to refresh token: ${text}`);
    }

    const data = await response.json();
    // data.access_token is the new token
    console.log('Token refreshed successfully.');
    await saveAccessToken(data.access_token);
    return data.access_token;
}

export async function postThreads(text: string) {
    console.log('Posting to Threads...');
    const token = await getAccessToken();

    // 1. Get User ID
    const userRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id&access_token=${token}`);
    if (!userRes.ok) throw new Error(`Failed to get user ID: ${await userRes.text()}`);
    const userData = await userRes.json();
    const userId = userData.id;

    // 2. Create Container
    const createUrl = `https://graph.threads.net/v1.0/${userId}/threads`;
    const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            media_type: 'TEXT',
            text: text,
            access_token: token
        })
    });
    if (!createRes.ok) throw new Error(`Failed to create container: ${await createRes.text()}`);
    const createData = await createRes.json();
    const creationId = createData.id;

    // 3. Publish
    const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`;
    const publishRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: creationId,
            access_token: token
        })
    });
    if (!publishRes.ok) throw new Error(`Failed to publish: ${await publishRes.text()}`);

    const result = await publishRes.json();
    console.log('Posted to Threads successfully:', result.id);
    return result;
}
