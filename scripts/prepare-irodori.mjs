import { readFile, mkdir, rename, unlink, stat } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile(new URL('irodori-manifest.json', import.meta.url), 'utf8'));
const target = new URL(`../public/models/irodori/${manifest.releaseTag}/`, import.meta.url);
await mkdir(target, { recursive: true });
const base = `https://github.com/ochisamu/irodori-tts-v4-webgpu-models/releases/download/${manifest.releaseTag}/`;
const hash = async path => {
  const result = createHash('sha256');
  for await (const chunk of createReadStream(path)) result.update(chunk);
  return result.digest('hex');
};
// This demo uses voice descriptions, so reference encoder weights are omitted.
for (const file of manifest.files.filter(file => !/^(speaker_encoder|dacvae_encoder)/.test(file.name))) {
  const path = new URL(file.name, target);
  let exists = false;
  try { exists = (await stat(path)).size === file.bytes; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists && await hash(path) === file.sha256) { console.log(`${file.name}: 検証済み`); continue; }
  console.log(`${file.name}: ${(file.bytes / 1e6).toFixed(1)} MBを取得`);
  const response = await fetch(`${base}${file.name}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${file.name}`);
  const temporary = new URL(`${file.name}.partial`, target);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if ((await stat(temporary)).size !== file.bytes || await hash(temporary) !== file.sha256) throw new Error(`${file.name}: サイズまたはSHA-256が一致しません。`);
    await rename(temporary, path);
  } catch (error) { await unlink(temporary).catch(cleanup => { if (cleanup.code !== 'ENOENT') throw cleanup; }); throw error; }
}
await mkdir(new URL('../public/licenses/', import.meta.url), { recursive: true });
for (const name of ['Irodori-TTS-v4-Small-LICENSE', 'ModernBERT-ja-LICENSE', 'Semantic-DACVAE-LICENSE']) {
  const response = await fetch(`${base}${name}`);
  if (!response.ok) throw new Error(`ライセンス取得失敗: ${name}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(new URL(`../public/licenses/${name}`, import.meta.url)));
}
console.log('Irodori v4.1 Anime INT4の準備ができました。');
