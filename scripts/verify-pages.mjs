import { readdir, stat, readFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('irodori-manifest.json', import.meta.url), 'utf8'));
const benchmark = JSON.parse(await readFile(new URL('../samples/benchmark.json', import.meta.url), 'utf8'));
let bytes = 0;
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(item.name + (item.isDirectory() ? '/' : ''), directory);
    if (item.name === '.env' || item.name.startsWith('.env.') || item.name.endsWith('.partial')) throw new Error(`公開対象外のファイルがあります: ${item.name}`);
    if (item.isDirectory()) await inspect(path);
    else if (item.isFile()) {
      const metadata = await stat(path);
      if (metadata.nlink !== 1) throw new Error(`ハードリンクは配信できません: ${path.pathname}`);
      bytes += metadata.size;
    } else throw new Error(`通常のファイルではありません: ${path.pathname}`);
  }
}
await inspect(root);
if (bytes > 1_000_000_000) throw new Error(`GitHub Pagesの1GB上限を超えます: ${bytes} bytes`);
for (const file of manifest.files.filter(file => !/^(speaker_encoder|dacvae_encoder)/.test(file.name))) {
  const actual = await stat(new URL(`models/irodori/${manifest.releaseTag}/${file.name}`, root));
  if (actual.size !== file.bytes) throw new Error(`Irodoriの配信ファイルが不完全です: ${file.name}`);
}
for (const { file } of benchmark.rows) {
  const buffer = await readFile(new URL(`samples/${file}`, root));
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE' || buffer.readUInt16LE(22) !== 1 || buffer.readUInt16LE(34) !== 16) throw new Error(`比較用WAVの形式が不正です: ${file}`);
}
for (const file of ['index.html', 'isolation-sw.js', 'model-notice.txt', 'engine/phonemizer.bin', 'engine/ort-wasm-simd-threaded.wasm', 'engine/ort-wasm-simd-threaded.asyncify.wasm', 'engine/kokoro/runtime.js', 'licenses/supertonic-model.txt']) {
  if (!(await stat(new URL(file, root))).size) throw new Error(`配信ファイルが空です: ${file}`);
}
console.log(`Pagesの配信ファイルを確認しました: ${(bytes / 1e6).toFixed(1)} MB / 1000 MB`);
