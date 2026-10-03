export async function ensureIsolation() {
  const scope = new URL(import.meta.env.BASE_URL, location.origin);
  const key = `tts-isolation-reload:${scope.pathname}`;
  if (crossOriginIsolated) {
    sessionStorage.removeItem(key);
    return true;
  }
  if (!isSecureContext || !navigator.serviceWorker) throw new Error('並列実行にはHTTPSとService Worker対応のブラウザが必要です。');
  if (sessionStorage.getItem(key)) throw new Error('並列実行を準備できませんでした。ブラウザのサイトデータ設定と配信設定を確認してください。');
  const script = new URL('isolation-sw.js', scope).href;
  await navigator.serviceWorker.register(script, { scope: scope.pathname, updateViaCache: 'none' });
  await new Promise((resolve, reject) => {
    const finish = () => {
      if (navigator.serviceWorker.controller?.scriptURL !== script) return;
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    const timeout = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      reject(new Error('並列実行の準備がタイムアウトしました。ページを再読込してください。'));
    }, 10_000);
    navigator.serviceWorker.addEventListener('controllerchange', finish);
    finish();
  });
  // Exactly one reload, before accepting any text or starting inference.
  sessionStorage.setItem(key, 'pending');
  location.reload();
  return false;
}
