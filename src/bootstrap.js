import { ensureIsolation } from './isolation.js';
import { renderSamples } from './samples.js';

renderSamples();
try {
  // Development already receives isolation headers from Vite.
  if (!import.meta.env.PROD || await ensureIsolation()) await import('./main.js');
} catch (error) {
  document.querySelector('#status').textContent = `起動エラー: ${error.message} 比較用の音声はそのまま聴けます。`;
}
