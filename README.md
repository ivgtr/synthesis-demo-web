# ブラウザ内の日本語音声合成・比較

[比較デモを開く](https://ivgtr.github.io/synthesis-demo-web/)

Piper Plus、Kokoro、Supertonic 3、Irodori v4.1 Animeを、同じ文章で試せる日本語音声合成の比較デモです。GitHub Pagesに静的サイトとして公開できます。音声合成と日本語の前処理はWeb Workerで実行し、PCMをWeb Audioで再生します。OSの音声合成APIと推論サーバーは使いません。入力した文章を外部へ送信しません。

モデルを取得する前に、5種類の比較音声と計測結果を聴けます。生成機能の初期設定はSupertonic 3・F1・CPU・8回反復です。ページを開いただけではモデルも音声ファイルも取得しません。音声は再生操作時、モデルは「声を準備する」で取得します。

```sh
npm ci --ignore-scripts
npm run prepare:irodori # Irodoriも試す場合。約766MBを取得しSHA-256を検証
npm run dev
```

Node.js 24を公開用CIで使用します。`--ignore-scripts`で、このブラウザ用ビルドに不要なネイティブ推論・画像処理パッケージのインストールスクリプトを実行しません。

表示されたURLを開き、モデル・声・実行先を選んで「声を準備する」→「読み上げる」で試せます。声、話す速さ、Supertonic / Irodoriの反復回数を変更できます。生成中も停止できます。比較欄には最大12件の時間・設定・文章・音声を残し、聴き比べとWAV保存ができます。履歴はそのページを閉じるまでのものです。

HTTPSまたはlocalhost、Cache Storage、WASM SIMD、DecompressionStream、module Workerに対応するブラウザが必要です。Chromium 153で確認しています。CPU推論はすべてのモデルで使えます。WebGPUはSupertonic / Irodoriで選べます。IrodoriのWebGPUには`shader-f16`対応が必要です。対応しないGPUではエラーを表示し、別の実行先へ自動では切り替えません。

## 比較できるモデル

| モデル | 声の選択 | 重みの取得量 | 実行先 |
| --- | --- | ---: | --- |
| Piper Plus | CSS10、つくよみちゃん | 1声39.65MB | CPU・1スレッド |
| Kokoro 82M / kokoro-js-jp | 日本語5声（女性4・男性1） | q8約92MB | CPU・最大4スレッド |
| Supertonic 3 | 女性5・男性5 | 約398MB、声で共有 | CPU・最大4スレッド / WebGPU |
| Irodori v4.1 Anime | 落ち着いた女性・男性・明るい女性の説明 | 約765MB、声の説明で共有 | CPU・最大4スレッド / WebGPU |

重みの容量は初回取得量の一部です。Piperは日本語辞書21.48MB、CPUエンジン12.36MBを含めて約74MBです。Kokoroは別の日本語辞書約24MB、実行エンジンとJSも必要で、合計約140〜145MBです。SupertonicはCPUエンジン約12MBまたはWebGPUエンジン約27MBが別途必要です。Irodoriの約766MBにはトークナイザーを含め、参照音声用のエンコーダーは含めません。推論の作業メモリは取得量とは別に必要です。

モデルが大きいほど取得・初期化・メモリの負担は増えやすい一方、生成速度は演算、量子化、反復回数、CPU/GPUにも左右されます。容量だけで速度は決まりません。Supertonicは4/8/16回、Irodoriは8/16/32回の反復を選べます。少ない回数での声の自然さや読みの正確さは、実際の音声で確認してください。

PiperはVITS系統で速度の基準です。Supertonic 3は2026年4月公開の候補ですが、開発元は2026年9月にリポジトリをアーカイブし開発・サポートを終了しています。Irodoriは公式v4.1 Smallから派生したAnime版の非公式W4A16 ONNX変換です。公式の素のモデルとの品質一致は保証しません。Irodoriの声は文章で指定するスタイルであり、固定された話者の声ではありません。音声クローンの入力は実装していません。

## この環境での結果

2026-10-03、AMD Ryzen 7 3800X / Linux（WSL）/ Chromium 153 headless。文章はすべて「こんにちは。今日は良い天気ですね。」、話速1倍。PiperはCPU 1スレッド、ほかはCPU 4スレッドです。準備後の計測で、最初のチャンク生成までと全文生成までの経過時間を測りました。

| モデル・設定 | 最初の音声 | 全文生成 | 出力音声長 | RTF | 音声 |
| --- | ---: | ---: | ---: | ---: | --- |
| Piper CSS10 | 0.21秒 | 0.37秒 | 2.45秒 | 0.15 | [WAV](samples/piper-wasm.wav) |
| Kokoro jf_alpha・q8 | 3.21秒 | 6.82秒 | 4.13秒 | 1.65 | [WAV](samples/kokoro-wasm.wav) |
| Supertonic F1・8回 | 1.44秒 | 3.01秒 | 3.60秒 | 0.84 | [WAV](samples/supertonic-wasm-8.wav) |
| Supertonic F1・4回 | 0.65秒 | 1.45秒 | 3.60秒 | 0.40 | [WAV](samples/supertonic-wasm-4.wav) |
| Irodori・落ち着いた女性・8回 | 10.45秒 | 25.89秒 | 3.36秒 | 7.71 | [WAV](samples/irodori-wasm-8.wav) |

RTFは全文生成時間÷出力音声長です。文間に挿入する150msの無音は音声長に含めません。最初の音声はPCMを受信するまでの時間で、Web Audioの約20msの予約と出力機器の遅延は含めません。単発計測で、ウォームアップ状態や乱数による揺れもあります。Supertonicの4回は8回の後、同じモデルを保持して測っています。端末での再測定と聴き比べのための結果であり、自然さ・読みの正確さの順位ではありません。モバイルと実GPUでの速度は未検証です。

この環境のWebGPUはGoogle SwiftShaderというソフトウェア実装です。Supertonicでは音声生成まで確認しましたが、最初の音声190秒、全文317秒と遅く、実GPUの速度を示す結果ではありません。IrodoriのGPU経路は、このアダプターが`shader-f16`に対応しないため実行できませんでした。対応GPUのブラウザで確認が必要です。IrodoriのブラウザCPU経路は生成・再生・WAV保存まで確認済みです。

本番ビルドで4モデルの生成、比較履歴、男性声への切替、WAV保存、生成中の停止、停止後のIrodori再準備を確認しました。Hugging Faceへの通信を遮断して、取得済みのPiper・Kokoro・Supertonicを再初期化できること、未取得の声はエラーになること、未対応のGPUは自動でCPUへ切り替えないことを確認しています。不正なAPI設定の拒否、`npm run build`、`npm audit`も確認済みです。つくよみちゃんの生成・切替・停止・キャッシュ利用は先行検証で確認済みです。[つくよみちゃんのWAV](samples/tsukuyomi.wav)もあります。

## スクリプトとして使う

Viteなど`new Worker(new URL(..., import.meta.url))`に対応するバンドラで使います。`public/engine/`の静的配信も必要です。Irodoriを使う場合は`prepare:irodori`で生成する`public/models/irodori/`も配信します。ViteのWorker出力形式は`es`です。

```js
import { JapaneseTTS } from './src/tts.js';

const tts = new JapaneseTTS({ onProgress: console.log });
await tts.initialize({ voice: 'supertonic-F1', device: 'wasm' });
await tts.synthesize('今日は良い天気ですね。', {
  voice: 'supertonic-F1',
  device: 'wasm', // 対応モデルでは 'webgpu' も選択可
  rate: 1,
  steps: 4, // Supertonic: 4/8/16、Irodori: 8/16/32
  onChunk: ({ samples, sampleRate, generationMs }) => {
    // samples: Float32Array。再生例はsrc/audio.jsとsrc/main.js。
  },
});
tts.dispose(); // 生成中もWorkerを破棄して停止
```

声IDは`src/voices.js`にあります。Piperは`css10` / `tsukuyomi`、Kokoroは`kokoro-jf_alpha`など、Supertonicは`supertonic-F1`など、Irodoriは`irodori-female` / `irodori-male` / `irodori-bright`です。Piper / Kokoroに`steps`は指定しません。反復を省略するとSupertonicは8回、Irodoriは16回です。

`voice`を省略すると最後に準備した声を使用します。最初の既定値は`css10`です。`device`を省略すると同じ声では前の実行先、別の声ではCPUを使用します。`tts.voice`、`tts.device`、`tts.ready`で準備状態を確認できます。未対応の声・実行先・反復回数と未知の設定項目はエラーにします。

同時に1件まで、文章1〜1000文字、話速0.8〜1.3倍です。文単位でPCMを転送し、Piperは140文字、ほかは100文字を超える文を分割します。文をまたぐ抑揚は全文を連続生成した場合と異なります。Irodoriの話速は予測した音声長に適用します。つくよみちゃんの基準話速はモデル推奨の`length_scale=1.5`です。

声を切り替えると同じモデルの重みは共有します（Piperの2声は別の重み）。モデル・実行先を切り替えると前のWorkerを終了し、推論モデルを1つだけ保持します。Kokoroの日本語前処理にはそのWorkerの子Workerを使用します。停止後は取得済みデータから再初期化します。

## GitHub Pagesで公開する

1. このソースをGitHubの公開リポジトリの`main`ブランチへ配置します。生成物・重み・ローカル設定は`.gitignore`で除外しています。Git LFSは不要です。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
3. **Actions → Publish comparison demo → Run workflow** を実行します。以後は`main`へのpushで更新されます。URLはデプロイ後のActions結果とSettings → Pagesで確認できます。

[Pagesワークフロー](.github/workflows/pages.yml)は依存パッケージのインストール、Irodoriの固定重み取得・SHA-256検証、ビルド、配信ファイル検査、デプロイまで行います。重みはGitへ入れず、Actionsのキャッシュに保存します。キャッシュを使った場合もハッシュを検証します。リポジトリ名付きURLと独自ドメインの両方に、Pagesが返す`base_path`から配信パスを合わせます。

公開ビルドは約902MBです。GitHub Pagesの[公開サイト上限は1GB、帯域の目安は月100GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)です。Irodoriの初回取得約766MBはPagesから配信するため、多人数が使う場合は帯域に注意してください。Piper・Kokoro・Supertonicの重みはHugging Faceから取得します。別のモデルを追加する場合も、`verify:pages`が1GB超過や不足ファイルを検出してデプロイを止めます。

Pagesでは任意のHTTPヘッダーを設定できないため、同じサイト内のService WorkerでCPU並列実行に必要なヘッダーを付けます。初回だけ自動で1回再読込します。Service Workerの範囲はこのデモの配信パス内です。準備できない場合は生成機能に起動エラーを表示し、比較音声は引き続き聴けます。モデル・辞書の保存は各TTS Workerが担当し、このService Workerはキャッシュしません。

検証では、ヘッダーなしの静的サーバーで`/onlypersonalities/`配下を配信し、初回だけの再読込、cross-origin isolation、比較音声の再生、4モデルすべてのCPU生成、再訪時に再読込が増えないことを確認しました。初期表示でモデル・実行エンジン・WAVを取得しないこと、390px幅でページ全体がはみ出さないことも確認済みです。別名の`/comparison-demo/`向けに新規インストールからのビルド・配信ファイル検査も通しています。公開ビルドの結果はリポジトリのActionsで確認できます。

## ビルドと配信

```sh
npm run build
npm run preview
```

公開前のローカル確認は次のように行います。`YOUR_REPOSITORY`を公開先リポジトリ名に置き換えてください。

```sh
npm run prepare:irodori
npm run build -- --base /YOUR_REPOSITORY/
npm run verify:pages
```

`dist/`を静的ホストで配信できます。`prepare:assets`はdev/buildの前に自動実行し、インストール済みパッケージの実行ファイル・日本語辞書を`public/engine/`、比較音声を`public/samples/`に用意します。比較音声の元ファイルと計測条件は`samples/`と[`samples/benchmark.json`](samples/benchmark.json)にあります。Irodoriの重みはGitHub ReleaseのCORS制限を避けるため`prepare:irodori`で固定タグから取得し、各ファイルのサイズとSHA-256を照合して`public/models/irodori/<release-tag>/`から同じ配信元で提供します。この処理はdev/buildでは自動実行しません。Irodoriを取得せずに使おうとすると取得エラーになります。

ほかのモデルは固定revisionのHugging Faceから初回使用時に取得します。重み・声データ・辞書のCache Storage保存に失敗した場合はエラーにします。別の声や保存先への自動切替はありません。保存失敗時にはブラウザの空き領域とサイトデータの制限を確認してください。

CPU最大4スレッドにはcross-origin isolationが必要です。Viteのdev/previewは次のHTTPヘッダーを付けます。ヘッダーを設定できる静的ホストでも同じ設定を使用してください。デモの本番起動はこの状態を確認し、未設定なら前述のService Workerで準備します。APIを別のページへ組み込んでこの準備をしない場合は1スレッドです。Piperは常に1スレッドです。

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

辞書の`phonemizer.bin` / `kokoro/dictionary.bin`はgzipデータです。配信時に`Content-Encoding: gzip`を付けず、スクリプトが展開できるようにしてください。`.wasm`はWASMのMIMEタイプで配信します。Kokoroの前処理も準備ボタンで初期化し、初回の辞書展開を生成時間から分けます。GPUの初回カーネルコンパイルは初回生成に含まれる場合があります。

## 出典とライセンス

- [Piper Plus CSS10](https://huggingface.co/ayousanz/piper-plus-css10-ja-6lang)：CSS10 public domain。固定revision `bd0d812d4db9182ecdb907ef074becf9e230c17f`。
- [Piper Plus つくよみちゃん](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan)：固定revision `36b59c825c36bd386b8960cf3f604382f52f2a87`。[コーパス利用条件](https://tyc.rei-yumesaki.net/material/corpus/#terms3)に従い、声選択時にクレジットと音声の用途条件を表示します。
- [Kokoro ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)：Apache-2.0、固定revision `1939ad2a8e416c0acfeecc08a694d14ef25f2231`。[kokoro-js-jp](https://github.com/nerosui/kokoro-js-jp) 0.2.0で日本語処理を行います。
- [Supertonic 3](https://huggingface.co/supertone-oss-archive/supertonic-3)：Open RAIL-M（第5項・Attachment Aの用途制限を含む）。固定revision `aafc6e32416a594460b32413efc49d7fe4ce6d46`。[開発終了の告知](https://github.com/supertone-oss-archive/supertonic)。文字前処理コードはMITです。
- [Irodori v4.1 Anime](https://huggingface.co/phasefield-audio/Irodori-TTS-v4.1-Anime)：MIT。[非公式ONNX変換](https://github.com/ochisamu/irodori-tts-v4-webgpu-models/releases/tag/v4.1-anime-6b259f5-webgpu-int4-r1)。ModernBERTとSemantic-DACVAEのMITライセンスも同梱します。公式モデルの音声透かしは、このブラウザ変換には含まれません。説明による声生成のみを使用しています。

Piper Plus、ONNX RuntimeはMIT、Kokoro関連ライブラリとTransformers.jsはApache-2.0です。ONNX Runtime Webは1.24.3、Kokoro内のORTはTransformers.js 3.8.1が配布する1.21.0を使います。ライセンス・第三者ライセンスを`public/licenses/`と`public/engine/`、モデルの出典を`public/model-notice.txt`、組込コードの来歴と変更点を`src/vendor/NOTICE.md`に残しています。
