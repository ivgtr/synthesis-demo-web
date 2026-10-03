export class AudioPlayer {
  #context;
  #sources = new Set();
  #next = 0;

  async unlock() {
    this.#context ??= new AudioContext();
    await this.#context.resume();
    if (this.#context.state !== 'running') throw new Error('音声出力を開始できませんでした。');
  }

  enqueue(samples, sampleRate) {
    const buffer = this.#context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#context.destination);
    const start = Math.max(this.#context.currentTime + 0.02, this.#next);
    this.#next = start + buffer.duration + 0.15;
    this.#sources.add(source);
    const ended = new Promise(resolve => {
      source.onended = () => {
        this.#sources.delete(source);
        source.disconnect();
        resolve();
      };
    });
    source.start(start);
    return ended;
  }

  stop() {
    this.#sources.forEach(source => source.stop());
    this.#next = 0;
  }
}

export function wavBlob(chunks, sampleRate) {
  const pause = Math.round(sampleRate * 0.15);
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + Math.max(0, chunks.length - 1) * pause;
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const write = (offset, value) => Array.from(value).forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, length * 2, true);
  let offset = 44;
  chunks.forEach((chunk, index) => {
    if (index) offset += pause * 2;
    for (const sample of chunk) {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  });
  return new Blob([bytes], { type: 'audio/wav' });
}
