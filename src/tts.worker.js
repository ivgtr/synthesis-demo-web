import css10Config from './model-config.json';
import tsukuyomiConfig from './tsukuyomi-config.json';
import { getVoice } from './voices.js';

const configurations = { css10: css10Config, tsukuyomi: tsukuyomiConfig };
const assets = new URL(`${import.meta.env.BASE_URL}engine/`, self.location.origin);
const cacheName = 'onlypersonalities-tts-v1';
let ort;
let session;
let phonemizer;
let config;
let activeVoice;
let phonemizerModule;
let busy = false;
let stage = '起動';

async function cachedFetch(url, id, label) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(url);
  if (hit) return hit;
  self.postMessage({ id, type: 'progress', message: `${label}を取得中…` });
  let response;
  try { response = await fetch(url); }
  catch (error) { throw new Error(`${label}の取得失敗: ${error.message}`); }
  if (!response.ok) throw new Error(`${label}の取得失敗: HTTP ${response.status}`);
  try { await cache.put(url, response.clone()); }
  catch (error) { throw new Error(`${label}の保存失敗: ${error.message}`); }
  return response;
}

async function loadPhonemizer(id) {
  if (phonemizerModule) return phonemizerModule;
  const [{ default: init, WasmPhonemizer }, response] = await Promise.all([
    import(/* @vite-ignore */ new URL('phonemizer.js', assets).href),
    cachedFetch(new URL('phonemizer.bin', assets).href, id, '日本語辞書'),
  ]);
  const dictionary = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  await init({ module_or_path: dictionary });
  phonemizerModule = { WasmPhonemizer };
  return phonemizerModule;
}

async function initialize(id, voiceId) {
  const voice = getVoice(voiceId);
  if (session && activeVoice === voiceId) return;
  if (session) {
    await session.release();
    session = undefined;
  }
  phonemizer?.free();
  phonemizer = undefined;
  activeVoice = undefined;
  config = configurations[voiceId];
  stage = '実行エンジンの読み込み';
  ort = await import(/* @vite-ignore */ new URL('ort.wasm.bundle.min.mjs', assets).href);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = assets.href;
  stage = 'モデル・辞書の取得';
  const [{ WasmPhonemizer }, model] = await Promise.all([
    loadPhonemizer(id),
    cachedFetch(voice.modelUrl, id, `${voice.name}のモデル`),
  ]);
  self.postMessage({ id, type: 'progress', message: `${voice.name}の音声モデルを準備中…` });
  stage = '日本語の前処理の初期化';
  phonemizer = new WasmPhonemizer(JSON.stringify(config));
  if (!phonemizer.getSupportedLanguages().includes('ja')) throw new Error('日本語辞書が利用できません。');
  stage = 'モデルの読み込み';
  const modelBytes = await model.arrayBuffer();
  stage = '音声エンジンの初期化';
  session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  const expected = {
    input: ['int64', ['batch_size', 'phonemes']],
    input_lengths: ['int64', ['batch_size']],
    scales: ['float32', [3]],
    lid: ['int64', ['batch_size']],
    prosody_features: ['int64', ['batch_size', 'phonemes', 3]],
    speaker_embedding: ['float32', ['batch_size', 256]],
    speaker_embedding_mask: ['int64', ['batch_size', 1]],
  };
  if (session.inputNames.length !== Object.keys(expected).length || session.inputMetadata.some(({ name, type, shape }) => !expected[name] || type !== expected[name][0] || JSON.stringify(shape) !== JSON.stringify(expected[name][1])) || !session.outputNames.includes('output') || !session.outputNames.includes('durations')) {
    throw new Error(`対応していないモデル形式です: ${session.inputNames.join(', ')}`);
  }
  activeVoice = voiceId;
}

function splitText(text) {
  const sentences = text.match(/[^。！？!?\n]+[。！？!?\n]*|[。！？!?\n]+/gu) ?? [];
  return sentences.flatMap(sentence => {
    const characters = Array.from(sentence);
    const chunks = [];
    while (characters.length) {
      chunks.push(characters.splice(0, 140).join(''));
    }
    return chunks;
  }).filter(chunk => /[^\s。！？!?]/u.test(chunk));
}

async function generate(text, rate, id) {
  stage = '音声生成';
  const sentences = splitText(text);
  if (!sentences.length) throw new Error('読み上げる文章を入力してください。');
  for (let index = 0; index < sentences.length; index++) {
    const started = performance.now();
    const result = phonemizer.phonemize(sentences[index], 'ja');
    let ids, prosody;
    try {
      ids = BigInt64Array.from(result.phonemeIds, BigInt);
      prosody = BigInt64Array.from(result.prosodyFeatures, BigInt);
    } finally {
      result.free();
    }
    if (ids.length < 3 || prosody.length !== ids.length * 3) throw new Error('日本語の音素・アクセントを生成できませんでした。');
    const feeds = {
      input: new ort.Tensor('int64', ids, [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(ids.length)), [1]),
      scales: new ort.Tensor('float32', Float32Array.of(config.inference.noise_scale, getVoice(activeVoice).lengthScale / rate, config.inference.noise_w), [3]),
      lid: new ort.Tensor('int64', BigInt64Array.of(BigInt(config.language_id_map.ja)), [1]),
      prosody_features: new ort.Tensor('int64', prosody, [1, ids.length, 3]),
      // This model's mask=0 selects its trained voice; voice cloning is disabled.
      speaker_embedding: new ort.Tensor('float32', new Float32Array(256), [1, 256]),
      speaker_embedding_mask: new ort.Tensor('int64', BigInt64Array.of(0n), [1, 1]),
    };
    let outputs;
    try {
      outputs = await session.run(feeds);
      const durations = outputs.durations.data;
      if (durations.length !== ids.length || !durations.every(value => Number.isFinite(value) && value >= 0)) throw new Error('モデルの音素長出力が不正です。');
      // This fixed VITS model uses a 256-sample hop. Drop the EOS region to
      // avoid a repeated final syllable (Piper Plus issue #499).
      const end = outputs.output.data.length - Math.ceil(durations[durations.length - 1]) * 256;
      if (end <= 0) throw new Error('モデルの音声長出力が不正です。');
      const samples = new Float32Array(outputs.output.data.subarray(0, end));
      if (!samples.length || !samples.every(Number.isFinite) || !samples.some(value => Math.abs(value) > 0.001)) throw new Error('有効な音声を生成できませんでした。');
      self.postMessage({ id, type: 'chunk', samples, sampleRate: config.audio.sample_rate, index, count: sentences.length, generationMs: performance.now() - started }, [samples.buffer]);
    } finally {
      Object.values(feeds).forEach(tensor => tensor.dispose());
      if (outputs) Object.values(outputs).forEach(tensor => tensor.dispose());
    }
  }
}

self.onmessage = async ({ data }) => {
  const { id } = data;
  try {
    if (!Number.isSafeInteger(id) || id < 1 || !['init', 'synthesize'].includes(data.type)) throw new Error('不正なWorkerリクエストです。');
    const allowed = data.type === 'init' ? ['id', 'type', 'voice', 'device'] : ['id', 'type', 'text', 'rate', 'voice', 'device', 'steps'];
    if (Object.keys(data).some(key => !allowed.includes(key))) throw new Error('未知のリクエスト項目があります。');
    if (getVoice(data.voice).engine !== 'piper' || data.device !== 'wasm' || data.steps !== undefined) throw new Error('Piperの設定が不正です。');
    if (busy) throw new Error('音声合成はすでに実行中です。');
    if (data.type === 'synthesize' && (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 1000 || !Number.isFinite(data.rate) || data.rate < 0.8 || data.rate > 1.3)) throw new Error('文章は1〜1000文字、速度は0.8〜1.3倍で指定してください。');
    busy = true;
    try {
      await initialize(id, data.voice);
      if (data.type === 'synthesize') await generate(data.text, data.rate, id);
      self.postMessage({ id, type: 'done' });
    } finally {
      busy = false;
    }
  } catch (error) {
    console.error(error.stack);
    self.postMessage({ id, type: 'error', message: `${stage}: ${error.message}` });
  }
};
