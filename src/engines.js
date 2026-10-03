export const ENGINES = Object.freeze({
  piper: { name: 'Piper Plus · 速度の基準', devices: ['wasm'], steps: [], size: '約74MB（辞書・実行エンジン込み）', note: '別の声は約40MB追加。CPUで一度の推論で生成します。' },
  kokoro: { name: 'Kokoro · 日本語5声', devices: ['wasm'], steps: [], size: '約145MB（q8・辞書・実行エンジン込み）', note: 'kokoro-js-jpの日本語処理を使用。声の切替では重みを共有します。' },
  supertonic: { name: 'Supertonic 3 · 日本語対応・10声', devices: ['wasm', 'webgpu'], steps: [4, 8, 16], size: '重み約398MB＋実行エンジン', note: '反復回数で速度と品質を比較できます。2026年4月公開。開発元のリポジトリは現在アーカイブされています。' },
  irodori: { name: 'Irodori v4.1 Anime · 声の説明で生成', devices: ['wasm', 'webgpu'], steps: [8, 16, 32], size: '約766MB＋実行エンジン（参照音声用の重みを除く）', note: '日本語向け量子化版。CPUで試せますが生成は重めです。GPUにはFP16対応が必要です。説明から声を作るため、同じ人物の声を保証するプリセットではありません。' },
});
export function getEngine(id) {
  if (!Object.hasOwn(ENGINES, id)) throw new TypeError(`未対応のモデルです: ${String(id)}`);
  return ENGINES[id];
}
