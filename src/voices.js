export const DEFAULT_VOICE = 'css10';

export const VOICES = Object.freeze([
  Object.freeze({
    id: 'css10',
    engine: 'piper',
    name: 'CSS10（これまでの声）',
    modelUrl: 'https://huggingface.co/ayousanz/piper-plus-css10-ja-6lang/resolve/bd0d812d4db9182ecdb907ef074becf9e230c17f/css10-ja-6lang-fp16.onnx',
    lengthScale: 1,
  }),
  Object.freeze({
    id: 'tsukuyomi',
    engine: 'piper',
    name: 'つくよみちゃん',
    modelUrl: 'https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan/resolve/36b59c825c36bd386b8960cf3f604382f52f2a87/tsukuyomi-chan-6lang-fp16.onnx',
    // The model card recommends 1.5 for this voice's natural speaking speed.
    lengthScale: 1.5,
  }),
  ...['jf_alpha', 'jf_gongitsune', 'jf_nezumi', 'jf_tebukuro', 'jm_kumo'].map(voice => Object.freeze({ id: `kokoro-${voice}`, engine: 'kokoro', name: `${voice.startsWith('jm') ? '男性' : '女性'} · ${voice}`, preset: voice })),
  ...['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'].map(voice => Object.freeze({ id: `supertonic-${voice}`, engine: 'supertonic', name: `${voice.startsWith('M') ? '男性' : '女性'} · ${voice}`, preset: voice })),
  ...[
    ['female', '落ち着いた女性', '落ち着いた、柔らかい声の女性。自然な会話の調子。'],
    ['male', '落ち着いた男性', '落ち着いた、低めの声の男性。自然な会話の調子。'],
    ['bright', '明るい女性', '明るく元気な、若い女性の声。親しみやすい会話の調子。'],
  ].map(([id, name, caption]) => Object.freeze({ id: `irodori-${id}`, engine: 'irodori', name, caption })),
]);

export function getVoice(id) {
  const voice = VOICES.find(voice => voice.id === id);
  if (!voice) throw new TypeError(`未対応の声です: ${String(id)}`);
  return voice;
}
