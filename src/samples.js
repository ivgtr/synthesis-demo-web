import benchmark from '../samples/benchmark.json';

export function renderSamples() {
  document.querySelector('#sample-text').textContent = `全音声共通の文章：「${benchmark.text}」`;
  document.querySelector('#sample-environment').textContent = `${benchmark.date} · ${benchmark.environment}。Piperは1スレッド、ほかは4スレッド。準備後の単発計測です。4回反復は8回反復の後に測っています。`;
  for (const item of benchmark.rows) {
    const row = document.createElement('tr');
    for (const value of [item.name, `${item.firstSeconds.toFixed(2)}秒`, `${item.generationSeconds.toFixed(2)}秒`, item.rtf.toFixed(2)]) row.insertCell().textContent = value;
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = `${import.meta.env.BASE_URL}samples/${item.file}`;
    audio.setAttribute('aria-label', `${item.name}の比較音声`);
    audio.onplay = () => document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
    row.insertCell().append(audio);
    document.querySelector('#sample-results').append(row);
  }
}
