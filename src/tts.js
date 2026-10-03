import { DEFAULT_VOICE, getVoice } from './voices.js';
import { getEngine } from './engines.js';

function optionsObject(options, keys) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some(key => !keys.includes(key))) throw new TypeError('不正な設定項目があります。');
}

export class JapaneseTTS {
  #worker;
  #request;
  #nextId = 0;
  #ready = false;
  #voice = DEFAULT_VOICE;
  #device = 'wasm';
  #workerKey;
  onProgress;

  constructor(options = {}) {
    optionsObject(options, ['onProgress']);
    const { onProgress } = options;
    if (onProgress !== undefined && typeof onProgress !== 'function') throw new TypeError('onProgressは関数で指定してください。');
    this.onProgress = onProgress;
  }

  get ready() { return this.#ready; }
  get voice() { return this.#voice; }
  get device() { return this.#device; }

  async initialize(options = {}) {
    optionsObject(options, ['voice', 'device']);
    const { voice = this.#voice, device = voice === this.#voice ? this.#device : getEngine(getVoice(voice).engine).devices[0] } = options;
    const engine = getVoice(voice).engine;
    if (!getEngine(engine).devices.includes(device)) throw new TypeError('このモデルでは指定した実行先を使えません。');
    if (this.#request) throw new Error('処理が実行中です。');
    if (this.#ready && voice === this.#voice && device === this.#device) return;
    this.#ready = false;
    const key = `${engine}:${device}`;
    if (this.#workerKey !== key) {
      this.#worker?.terminate();
      this.#worker = undefined;
      this.#workerKey = key;
    }
    await this.#send({ type: 'init', voice, device });
    this.#voice = voice;
    this.#device = device;
    this.#ready = true;
  }

  async synthesize(text, options = {}) {
    optionsObject(options, ['rate', 'onChunk', 'voice', 'device', 'steps']);
    const { rate = 1, onChunk, voice = this.#voice, device = voice === this.#voice ? this.#device : getEngine(getVoice(voice).engine).devices[0], steps = getEngine(getVoice(voice).engine).steps[1] } = options;
    const settings = getEngine(getVoice(voice).engine);
    if (settings.steps.length ? !settings.steps.includes(steps) : steps !== undefined) throw new TypeError('反復回数の設定が不正です。');
    if (onChunk !== undefined && typeof onChunk !== 'function') throw new TypeError('onChunkは関数で指定してください。');
    if (typeof text !== 'string' || !text.trim() || text.length > 1000 || !Number.isFinite(rate) || rate < 0.8 || rate > 1.3) throw new TypeError('文章は1〜1000文字、速度は0.8〜1.3倍で指定してください。');
    await this.initialize({ voice, device });
    return this.#send({ type: 'synthesize', text, rate, voice, device, steps }, onChunk);
  }

  #send(message, onChunk) {
    if (this.#request) return Promise.reject(new Error('処理が実行中です。'));
    if (!this.#worker) {
      const engine = getVoice(message.voice).engine;
      if (engine === 'piper') this.#worker = new Worker(new URL('./tts.worker.js', import.meta.url), { type: 'module' });
      else if (engine === 'kokoro') this.#worker = new Worker(new URL('./kokoro.worker.js', import.meta.url), { type: 'module' });
      else if (engine === 'supertonic') this.#worker = new Worker(new URL('./supertonic.worker.js', import.meta.url), { type: 'module' });
      else this.#worker = new Worker(new URL('./irodori.worker.js', import.meta.url), { type: 'module' });
      this.#worker.onmessage = ({ data }) => {
        if (data.id !== this.#request?.id) return;
        try {
          if (data.type === 'progress') this.onProgress?.(data.message);
          else if (data.type === 'chunk') this.#request.onChunk?.(data);
          else if (data.type === 'done') {
            const { resolve } = this.#request;
            this.#request = undefined;
            resolve();
          } else if (data.type === 'error') this.#fail(new Error(data.message));
          else this.#fail(new Error('不正なWorker応答です。'));
        } catch (error) {
          this.#fail(error);
        }
      };
      this.#worker.onerror = event => {
        event.preventDefault();
        this.#fail(new Error(event.message || 'Workerを起動できませんでした。'));
      };
      this.#worker.onmessageerror = () => this.#fail(new Error('音声データを受信できませんでした。'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.#nextId;
      this.#request = { id, resolve, reject, onChunk };
      this.#worker.postMessage({ ...message, id });
    });
  }

  #fail(error) {
    this.#request?.reject(error);
    this.#request = undefined;
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#ready = false;
  }

  // Termination also cancels a currently running WASM inference immediately.
  dispose() { this.#fail(new DOMException('停止しました。', 'AbortError')); }
}
