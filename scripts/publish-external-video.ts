import fs from 'node:fs';
import path from 'node:path';
import { uploadVideo } from './upload-youtube';

type PublishRequest = {
  sourceRepo: string;
  sourceSha: string;
  assetName: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  sha256?: string;
};

const requestPath = process.argv[2];
const videoPath = process.argv[3];

if (!requestPath || !videoPath) {
  console.error('usage: tsx scripts/publish-external-video.ts <request.json> <video.mp4>');
  process.exit(2);
}

const request = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as PublishRequest;

if (!/^[0-9a-f]{40}$/.test(request.sourceSha)) throw new Error('Invalid sourceSha');
if (!/^[A-Za-z0-9._-]+\.mp4$/.test(request.assetName)) throw new Error('Invalid assetName');
if (!request.title || request.title.length > 100) throw new Error('YouTube title must be 1-100 characters');
if (!request.description || request.description.length > 5000) throw new Error('YouTube description must be 1-5000 characters');
if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`);
if (request.categoryId && !/^\d{1,2}$/.test(request.categoryId)) throw new Error('Invalid categoryId');
if (request.sha256) {
  const { createHash } = await import('node:crypto');
  const digest = createHash('sha256').update(fs.readFileSync(videoPath)).digest('hex');
  if (digest !== request.sha256) throw new Error(`sha256 mismatch: ${digest}`);
}

const result = await uploadVideo(videoPath, request.title, request.description, request.tags ?? [], request.categoryId ?? '28');
const output = {
  sourceRepo: request.sourceRepo,
  sourceSha: request.sourceSha,
  assetName: request.assetName,
  youtubeVideoId: result.id,
  publishedAt: new Date().toISOString(),
};

const resultPath = path.resolve('publish-result.json');
fs.writeFileSync(resultPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output));
