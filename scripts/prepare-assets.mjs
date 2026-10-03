import { mkdir, readFile, writeFile, copyFile, cp } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { dirname } from 'node:path';

const target = new URL('../public/engine/', import.meta.url);
const packages = new URL('../node_modules/', import.meta.url);
const benchmark = JSON.parse(await readFile(new URL('../samples/benchmark.json', import.meta.url), 'utf8'));
const samplesTarget = new URL('../public/samples/', import.meta.url);
await mkdir(samplesTarget, { recursive: true });
for (const { file } of benchmark.rows) {
  await copyFile(new URL(`../samples/${file}`, import.meta.url), new URL(file, samplesTarget));
}
await mkdir(target, { recursive: true });
const dictionary = await readFile(new URL('piper-plus/dist/rust-wasm/piper_plus_wasm_bg.wasm', packages));
// .bin keeps static hosts from treating this application-level gzip as Content-Encoding.
await writeFile(new URL('phonemizer.bin', target), gzipSync(dictionary, { level: 9 }));
await copyFile(new URL('piper-plus/dist/rust-wasm/piper_plus_wasm.js', packages), new URL('phonemizer.js', target));
for (const name of ['ort.wasm.bundle.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort.webgpu.bundle.min.mjs', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  await copyFile(new URL(`onnxruntime-web/dist/${name}`, packages), new URL(name, target));
}
const kokoroTarget = new URL('kokoro/', target);
await mkdir(kokoroTarget, { recursive: true });
const kokoroSource = new URL('kokoro-js-jp/dist/', packages);
for (const name of ['browser', 'openjtalk-wasm-wrapper-D6E3BSJO.js', 'openjtalk-wasm.wasm', 'openjtalk-voice.htsvoice']) await cp(new URL(name, kokoroSource), new URL(name, kokoroTarget), { recursive: true });
await copyFile(new URL('open_jtalk_dic_utf_8-1.11.tar.gz', kokoroSource), new URL('dictionary.bin', kokoroTarget));
for (const name of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) await copyFile(new URL(`@huggingface/transformers/dist/${name}`, packages), new URL(name, kokoroTarget));
const { revision } = JSON.parse(await readFile(new URL('../src/kokoro-config.json', import.meta.url), 'utf8'));
await build({ entryPoints: ['src/kokoro-runtime.js'], outfile: new URL('runtime.js', kokoroTarget).pathname, bundle: true, platform: 'browser', format: 'esm', minify: true, logLevel: 'warning', plugins: [{
  name: 'pin-kokoro-voice-revision',
  setup(builder) {
    builder.onLoad({ filter: /kokoro-js\/dist\/kokoro\.js$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      const marker = '/resolve/main/voices/';
      if (!source.includes(marker)) throw new Error('Kokoroの声取得処理が想定と異なります。');
      return { contents: source.replaceAll(marker, `/resolve/${revision}/voices/`), loader: 'js', resolveDir: dirname(path) };
    });
  },
}] });
for (const name of ['LICENSE.md', 'THIRD-PARTY-LICENSES.md']) {
  await copyFile(new URL(`piper-plus/${name}`, packages), new URL(`piper-plus-${name}`, target));
}
console.log(`辞書付きWASM: ${(dictionary.length / 1e6).toFixed(1)} MB → ${((await readFile(new URL('phonemizer.bin', target))).length / 1e6).toFixed(1)} MB gzip`);
