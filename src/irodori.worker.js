import { assets, cachedFetch, installWorker, loadOrt, progress } from './worker-common.js';
import { IrodoriV4TTS } from './vendor/irodori/v4-pipeline.mjs';
import manifest from '../scripts/irodori-manifest.json';

let tts;
const base = new URL(`${import.meta.env.BASE_URL}models/irodori/${manifest.releaseTag}/`, self.location.origin);
async function initialize(voice, device, id) {
  if (tts) return;
  if (device === 'webgpu') {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter?.features.has('shader-f16')) throw new Error('IrodoriのWebGPU推論にはFP16対応が必要です。この端末のGPUでは使用できません。実行先からCPUを選べます。');
  }
  const ort = await loadOrt(device, id);
  const runtime = await import(/* @vite-ignore */ new URL('kokoro/runtime.js', assets).href);
  const tokenizer = new runtime.PreTrainedTokenizer(
    await (await cachedFetch(new URL('tokenizer.json', base), id, '日本語トークナイザー')).json(),
    await (await cachedFetch(new URL('tokenizer_config.json', base), id, 'トークナイザー設定')).json(),
  );
  const sessions = {};
  for (const [key, name] of Object.entries({ backbone: 'text_backbone', text: 'text_projector', caption: 'caption_projector', duration: 'duration', dit: 'dit_v4', dac: 'dacvae_decoder' })) {
    const model = await (await cachedFetch(new URL(`${name}.onnx`, base), id, name)).arrayBuffer();
    const data = await (await cachedFetch(new URL(`${name}.onnx.data`, base), id, `${name}の重み`)).arrayBuffer();
    progress(id, `${name}を${device === 'webgpu' ? 'WebGPU' : 'CPU'}で準備中…`);
    sessions[key] = await ort.InferenceSession.create(model, { executionProviders: [device], graphOptimizationLevel: 'all', externalData: [{ path: `${name}.onnx.data`, data: new Uint8Array(data) }] });
  }
  tts = new IrodoriV4TTS({ ort, sessions, tokenizer });
}
installWorker('irodori', initialize, async (text, voice, rate, steps, id) => {
  const output = await tts.synthesize(text, voice.caption, {
    numSteps: steps, seed: 0, durationScale: 1 / rate,
    cfgExecution: 'batched', trimTrailingUtterance: false,
    onStage: ({ stage, status }) => { if (status === 'start') progress(id, `Irodoriで生成中… ${stage}`); },
    onStep: ({ step, numSteps }) => progress(id, `Irodoriで生成中… ${step}/${numSteps}回`),
  });
  return { samples: Float32Array.from(output.audio), sampleRate: output.sampleRate };
});
