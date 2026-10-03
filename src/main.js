import { JapaneseTTS } from './tts.js';
import { AudioPlayer, wavBlob } from './audio.js';
import { VOICES, getVoice } from './voices.js';
import { ENGINES, getEngine } from './engines.js';

const text = document.querySelector('#text');
const speed = document.querySelector('#speed');
const voice = document.querySelector('#voice');
const model = document.querySelector('#model');
const device = document.querySelector('#device');
const steps = document.querySelector('#steps');
const voiceTerms = document.querySelector('#voice-terms');
const speak = document.querySelector('#speak');
const stop = document.querySelector('#stop');
const status = document.querySelector('#status');
const metrics = document.querySelector('#metrics');
const download = document.querySelector('#download');
const player = new AudioPlayer();
const tts = new JapaneseTTS({ onProgress: message => { status.textContent = message; } });
let run = 0;
let objectUrl;
const recordings = [];
for (const [id, item] of Object.entries(ENGINES)) model.add(new Option(item.name, id));
function modelOptions() {
  voice.replaceChildren();
  for (const item of VOICES.filter(item => item.engine === model.value)) voice.add(new Option(item.name, item.id));
  const settings = getEngine(model.value);
  device.replaceChildren(...settings.devices.map(value => new Option(value === 'wasm' ? 'CPU（WASM）' : 'GPU（WebGPU）', value)));
  steps.replaceChildren(...settings.steps.map(value => new Option(`${value}回`, value)));
  if (settings.steps.length) steps.value = settings.steps[1];
  document.querySelector('#steps-label').hidden = !settings.steps.length;
  document.querySelector('#model-hint').textContent = `${settings.size}。${settings.note}`;
  if (model.value !== 'piper') document.querySelector('#model-hint').textContent += ` CPU推論は${crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency) : 1}スレッドです。`;
  document.querySelector('#voice-hint').textContent = model.value === 'irodori' ? '声の説明と固定した乱数から生成します。' : '声を変えて聴き比べられます。選んだモデルを初めて使うときだけ取得します。';
  const license = document.querySelector('#model-license');
  license.replaceChildren();
  if (model.value === 'supertonic') {
    license.append('このモデルの利用にはOpen RAIL-Mの利用制限（第5項・Attachment A）が適用されます。');
    const link = document.createElement('a'); link.href = `${import.meta.env.BASE_URL}licenses/supertonic-model.txt`; link.textContent = 'ライセンス全文'; link.target = '_blank'; link.rel = 'noopener'; license.append(link);
  }
  if (model.value === 'irodori') license.textContent = '公式v4.1 Smallから派生したAnime版の非公式ONNX変換です。音声はAIによる合成です。';
}
model.value = 'supertonic';
modelOptions();
voice.value = 'supertonic-F1';
status.textContent = 'Supertonic 3・8回反復を選択しています。初回取得は重み約398MB＋実行エンジンです。「声を準備する」で開始できます。';
let timer;

function isReady() { return tts.ready && tts.voice === voice.value && tts.device === device.value; }

function clearDownload() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
  download.hidden = true;
  download.removeAttribute('href');
}

function selectionChanged() {
  clearDownload();
  metrics.textContent = '';
  voiceTerms.hidden = voice.value !== 'tsukuyomi';
  const name = getVoice(voice.value).name;
  status.textContent = isReady() ? `${name}で読み上げられます。` : `${name}を選択しました。「声を準備する」で読み込めます。`;
  buttons(false);
}
voice.onchange = selectionChanged;
device.onchange = selectionChanged;
model.onchange = () => { modelOptions(); selectionChanged(); };
steps.onchange = () => { clearDownload(); metrics.textContent = ''; };

speed.oninput = () => { document.querySelector('#speed-value').value = `${Number(speed.value).toFixed(2)}倍`; };

function buttons(busy) {
  speak.disabled = busy;
  stop.disabled = !busy;
  text.disabled = busy;
  speed.disabled = busy;
  voice.disabled = busy;
  model.disabled = busy;
  device.disabled = busy;
  steps.disabled = busy;
  speak.textContent = isReady() ? '読み上げる' : '声を準備する';
}
buttons(false);

speak.onclick = async () => {
  const current = ++run;
  buttons(true);
  metrics.textContent = '';
  try {
    if (!isReady()) {
      const started = performance.now();
      timer = setInterval(() => { metrics.textContent = `準備中: ${((performance.now() - started) / 1000).toFixed(1)}秒`; }, 100);
      await tts.initialize({ voice: voice.value, device: device.value });
      clearInterval(timer);
      if (current !== run) return;
      status.textContent = `${getVoice(voice.value).name}の準備ができました。「読み上げる」で声を試せます。`;
      metrics.textContent = `準備時間: ${((performance.now() - started) / 1000).toFixed(2)}秒`;
      return;
    }
    await player.unlock();
    clearDownload();
    const started = performance.now();
    const chunks = [];
    const playback = [];
    let sampleRate;
    let totalMs = 0;
    let firstMs;
    timer = setInterval(() => { if (firstMs === undefined) metrics.textContent = `最初の音声を待機中: ${((performance.now() - started) / 1000).toFixed(1)}秒`; }, 100);
    status.textContent = '音声を生成中…';
    await tts.synthesize(text.value, {
      rate: Number(speed.value),
      voice: voice.value,
      device: device.value,
      steps: getEngine(model.value).steps.length ? Number(steps.value) : undefined,
      onChunk: chunk => {
        firstMs ??= performance.now() - started;
        clearInterval(timer);
        chunks.push(chunk.samples);
        sampleRate = chunk.sampleRate;
        totalMs += chunk.generationMs;
        playback.push(player.enqueue(chunk.samples, sampleRate));
        status.textContent = `読み上げ中… ${chunk.index + 1}/${chunk.count}文を生成`;
        const duration = chunks.reduce((sum, samples) => sum + samples.length / sampleRate, 0);
        metrics.textContent = `最初の音声: ${(firstMs / 1000).toFixed(2)}秒 · 合成: ${(totalMs / 1000).toFixed(2)}秒 · 音声: ${duration.toFixed(2)}秒 · RTF: ${(totalMs / 1000 / duration).toFixed(2)}`;
      },
    });
    const generationMs = performance.now() - started;
    const duration = chunks.reduce((sum, samples) => sum + samples.length / sampleRate, 0);
    metrics.textContent = `最初の音声: ${(firstMs / 1000).toFixed(2)}秒 · 全文生成: ${(generationMs / 1000).toFixed(2)}秒 · 音声: ${duration.toFixed(2)}秒 · RTF: ${(generationMs / 1000 / duration).toFixed(2)}`;
    objectUrl = URL.createObjectURL(wavBlob(chunks, sampleRate));
    download.href = objectUrl;
    download.download = `speech-${voice.value}.wav`;
    download.hidden = false;
    addComparison({ firstMs, generationMs, duration, blob: wavBlob(chunks, sampleRate) });
    await Promise.all(playback);
    if (current === run) status.textContent = '読み上げが完了しました。';
  } catch (error) {
    if (current === run) {
      player.stop();
      status.textContent = `エラー: ${error.message}`;
    }
  } finally {
    clearInterval(timer);
    if (current === run) buttons(false);
  }
};

stop.onclick = () => {
  ++run;
  player.stop();
  tts.dispose();
  clearInterval(timer);
  status.textContent = '停止しました。再開するときはモデルを再準備します（取得済みデータを使用）。';
  buttons(false);
};

function addComparison({ firstMs, generationMs, duration, blob }) {
  const url = URL.createObjectURL(blob);
  const row = document.createElement('tr');
  row.title = `文章: ${text.value}\n速度: ${speed.value}倍`;
  for (const value of [getEngine(model.value).name.split(' · ')[0] + ' / ' + getVoice(voice.value).name, `${device.value} / ${steps.value || '—'}`, `${(firstMs / 1000).toFixed(2)}秒`, `${(generationMs / 1000).toFixed(2)}秒`, `${duration.toFixed(2)}秒`, (generationMs / 1000 / duration).toFixed(2)]) {
    const cell = row.insertCell(); cell.textContent = value;
  }
  const detail = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = `${speed.value}倍 / 文章を見る`;
  const sentence = document.createElement('p'); sentence.textContent = text.value;
  detail.append(summary, sentence); row.cells[0].append(detail);
  const cell = row.insertCell();
  const audio = document.createElement('audio'); audio.controls = true; audio.src = url;
  audio.preload = 'none';
  const link = document.createElement('a'); link.href = url; link.download = `speech-${voice.value}-${device.value}-${steps.value || 'single'}.wav`; link.textContent = 'WAV';
  cell.append(audio, link);
  document.querySelector('#results').prepend(row);
  recordings.push({ row, url, audio });
  if (recordings.length > 12) { const old = recordings.shift(); old.audio.pause(); old.row.remove(); URL.revokeObjectURL(old.url); }
  document.querySelector('#comparison').hidden = false;
}

window.addEventListener('pagehide', () => {
  player.stop();
  tts.dispose();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  recordings.forEach(recording => { recording.audio.pause(); URL.revokeObjectURL(recording.url); });
});
