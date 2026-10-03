import { getVoice } from './voices.js';
import { getEngine } from './engines.js';

export const assets = new URL(`${import.meta.env.BASE_URL}engine/`, self.location.origin);
const networkFetch = globalThis.fetch.bind(globalThis);
export function progress(id, message) { self.postMessage({ id, type: 'progress', message }); }
export async function cachedFetch(url, id, label) {
  url = String(url);
  const cache = await caches.open('onlypersonalities-tts-v1');
  const hit = await cache.match(url);
  if (hit) return hit;
  progress(id, `${label}を取得・保存中…`);
  const response = await networkFetch(url);
  if (!response.ok) throw new Error(`${label}の取得失敗: HTTP ${response.status}`);
  try { await cache.put(url, response.clone()); }
  catch (error) { throw new Error(`${label}の保存失敗: ${error.message}`); }
  return response;
}
export function splitText(text) {
  return (text.match(/[^。！？!?\n]+[。！？!?\n]*|[。！？!?\n]+/gu) ?? []).flatMap(sentence => {
    const chars = Array.from(sentence), result = [];
    while (chars.length) result.push(chars.splice(0, 100).join(''));
    return result;
  }).filter(chunk => /[^\s。！？!?]/u.test(chunk));
}
export async function loadOrt(device, id) {
  if (device === 'webgpu') {
    if (!navigator.gpu || !await navigator.gpu.requestAdapter()) throw new Error('WebGPUを利用できません。対応ブラウザとGPUが必要です。');
    progress(id, 'WebGPUエンジンを準備中…');
  }
  const ort = await import(/* @vite-ignore */ new URL(device === 'webgpu' ? 'ort.webgpu.bundle.min.mjs' : 'ort.wasm.bundle.min.mjs', assets).href);
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency) : 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = assets.href;
  return ort;
}
export function installWorker(engine, initialize, synthesize) {
  let busy = false;
  self.onmessage = async ({ data }) => {
    const { id } = data;
    try {
      if (!Number.isSafeInteger(id) || id < 1 || !['init', 'synthesize'].includes(data.type)) throw new Error('不正なWorkerリクエストです。');
      const keys = data.type === 'init' ? ['id', 'type', 'voice', 'device'] : ['id', 'type', 'voice', 'device', 'text', 'rate', 'steps'];
      if (Object.keys(data).some(key => !keys.includes(key))) throw new Error('未知のリクエスト項目があります。');
      const voice = getVoice(data.voice), settings = getEngine(engine);
      if (voice.engine !== engine || !settings.devices.includes(data.device)) throw new Error('モデル・実行先の設定が不正です。');
      if (busy) throw new Error('処理が実行中です。');
      if (data.type === 'synthesize' && (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 1000 || !Number.isFinite(data.rate) || data.rate < 0.8 || data.rate > 1.3 || (settings.steps.length ? !settings.steps.includes(data.steps) : data.steps !== undefined))) throw new Error('文章・速度・反復回数の設定が不正です。');
      busy = true;
      try {
        await initialize(voice, data.device, id);
        if (data.type === 'synthesize') {
          const sentences = splitText(data.text);
          if (!sentences.length) throw new Error('読み上げる文章を入力してください。');
          for (let index = 0; index < sentences.length; index++) {
            const started = performance.now();
            const { samples, sampleRate } = await synthesize(sentences[index], voice, data.rate, data.steps, id);
            if (!(samples instanceof Float32Array) || !samples.length || !samples.every(Number.isFinite) || !samples.some(value => Math.abs(value) > 0.001) || !Number.isInteger(sampleRate) || sampleRate < 8000) throw new Error('有効な音声を生成できませんでした。');
            self.postMessage({ id, type: 'chunk', samples, sampleRate, index, count: sentences.length, generationMs: performance.now() - started }, [samples.buffer]);
          }
        }
        self.postMessage({ id, type: 'done' });
      } finally { busy = false; }
    } catch (error) {
      console.error(error.stack);
      self.postMessage({ id, type: 'error', message: error.message });
    }
  };
}
