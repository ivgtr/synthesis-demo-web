import { assets, cachedFetch, installWorker, progress } from './worker-common.js';

let tts;
let requestId;
let revision;
// The package fetches model/tokenizer/voice assets internally. Keep those
// requests pinned and require persistent storage before returning them.
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, self.location.href);
  if (url.origin === 'https://huggingface.co' && url.pathname.startsWith('/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/')) url.pathname = url.pathname.replace('/resolve/main/', `/resolve/${revision}/`);
  if (!['https://huggingface.co', assets.origin].includes(url.origin)) throw new Error(`未設定の取得先です: ${url.origin}`);
  return cachedFetch(url.href, requestId, 'Kokoroのデータ');
};

async function initialize(voice, device, id) {
  requestId = id;
  if (!tts) {
    progress(id, 'Kokoroのq8モデル・日本語辞書を準備中…');
    const runtime = await import(/* @vite-ignore */ new URL('kokoro/runtime.js', assets).href);
    revision = (await import('./kokoro-config.json')).default.revision;
    runtime.env.backends.onnx.wasm.wasmPaths = new URL('kokoro/', assets).href;
    runtime.env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency) : 1;
    runtime.env.backends.onnx.wasm.proxy = false;
    runtime.env.allowLocalModels = false;
    runtime.env.useBrowserCache = false; // cachedFetch above owns persistence.
    tts = await runtime.KokoroJP.load({ dtype: 'q8', device, japanese: { assetsUrl: new URL('kokoro/', assets).href, dicArchiveUrl: new URL('kokoro/dictionary.bin', assets).href } });
    // 0.2.0 exposes this runtime method; prepare G2P here so its setup is
    // excluded from the measured first-audio latency.
    await tts.loadJapaneseG2POnce();
  }
  await cachedFetch(`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${revision}/voices/${voice.preset}.bin`, id, '声のパターン');
}
installWorker('kokoro', initialize, async (text, voice, rate, steps, id) => {
  requestId = id;
  const audio = await tts.speak(text, voice.preset, rate);
  return { samples: Float32Array.from(audio.audio), sampleRate: audio.sampling_rate };
});
