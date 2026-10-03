// Neural input and sampling contract: Supertone's MIT-licensed web/helper.js.
import { assets, cachedFetch, installWorker, loadOrt, progress } from './worker-common.js';
import { UnicodeProcessor } from './vendor/supertonic-text.js';

const base = 'https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/';
let ort, cfg, processor, sessions, style;
let activeVoice;
async function initialize(voice, device, id) {
  if (!sessions) {
    ort = await loadOrt(device, id);
    cfg = await (await cachedFetch(`${base}onnx/tts.json`, id, 'モデル設定')).json();
    processor = new UnicodeProcessor(await (await cachedFetch(`${base}onnx/unicode_indexer.json`, id, '文字辞書')).json());
    sessions = {};
    for (const name of ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder']) {
      const bytes = await (await cachedFetch(`${base}onnx/${name}.onnx`, id, name)).arrayBuffer();
      progress(id, `${name}を準備中…`);
      sessions[name] = await ort.InferenceSession.create(bytes, { executionProviders: [device], graphOptimizationLevel: 'all' });
    }
  }
  if (activeVoice === voice.id) return;
  const json = await (await cachedFetch(`${base}voice_styles/${voice.preset}.json`, id, '声のパターン')).json();
  if (style) Object.values(style).forEach(tensor => tensor.dispose());
  style = {};
  for (const [key, name] of [['dp', 'style_dp'], ['ttl', 'style_ttl']]) {
    const value = json[name];
    if (!value || value.dims[0] !== 1 || !value.data.flat(Infinity).every(Number.isFinite)) throw new Error('声の設定が不正です。');
    style[key] = new ort.Tensor('float32', Float32Array.from(value.data.flat(Infinity)), value.dims);
  }
  activeVoice = voice.id;
}
async function generate(text, voice, rate, steps, id) {
  const tensors = [];
  const tensor = (data, shape, type = 'float32') => { const value = new ort.Tensor(type, data, shape); tensors.push(value); return value; };
  const run = async (name, feeds) => { const output = await sessions[name].run(feeds); tensors.push(...Object.values(output)); return output; };
  try {
    const { textIds, textMask } = processor.call([text], ['ja']);
    if (textIds[0].some(value => value < 0)) throw new Error('このモデルの辞書にない文字が含まれています。');
    const ids = tensor(BigInt64Array.from(textIds[0], BigInt), [1, textIds[0].length], 'int64');
    const mask = tensor(Float32Array.from(textMask.flat(2)), [1, 1, textIds[0].length]);
    const dp = await run('duration_predictor', { text_ids: ids, style_dp: style.dp, text_mask: mask });
    const duration = dp.duration.data[0] / (1.05 * rate);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error('モデルの音声長出力が不正です。');
    const enc = await run('text_encoder', { text_ids: ids, style_ttl: style.ttl, text_mask: mask });
    const samplesLength = Math.floor(duration * cfg.ae.sample_rate);
    const chunk = cfg.ae.base_chunk_size * cfg.ttl.chunk_compress_factor;
    const length = Math.ceil(samplesLength / chunk);
    const dim = cfg.ttl.latent_dim * cfg.ttl.chunk_compress_factor;
    const noise = new Float32Array(dim * length);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.sqrt(-2 * Math.log(Math.max(0.0001, Math.random()))) * Math.cos(2 * Math.PI * Math.random());
    let latent = tensor(noise, [1, dim, length]);
    const latentMask = tensor(new Float32Array(length).fill(1), [1, 1, length]);
    const totalSteps = tensor(Float32Array.of(steps), [1]);
    for (let step = 0; step < steps; step++) {
      progress(id, `Supertonicで生成中… ${step + 1}/${steps}回`);
      const current = tensor(Float32Array.of(step), [1]);
      const result = await run('vector_estimator', { noisy_latent: latent, text_emb: enc.text_emb, style_ttl: style.ttl, latent_mask: latentMask, text_mask: mask, current_step: current, total_step: totalSteps });
      latent = result.denoised_latent;
    }
    const output = await run('vocoder', { latent });
    if (output.wav_tts.data.length < samplesLength) throw new Error('生成音声が予測した長さより短すぎます。');
    return { samples: Float32Array.from(output.wav_tts.data.subarray(0, samplesLength)), sampleRate: cfg.ae.sample_rate };
  } finally { tensors.forEach(value => value.dispose()); }
}
installWorker('supertonic', initialize, generate);
