# synthesis-demo-web

日本語音声合成をブラウザ内で生成して、声と速度を比較するデモです。Piper Plus、Kokoro、Supertonic 3、Irodori v4.1 Animeに対応しています。

**[比較デモを開く](https://ivgtr.github.io/synthesis-demo-web/)**

音声合成と日本語の前処理はWeb Workerで実行します。入力した文章を外部へ送信せず、OSの読み上げAPIや推論サーバーも使いません。

## デモの使い方

1. 「モデルを取得せずに、比較音声を聴く」で、生成済みの5種類の音声を聴けます。
2. 自分の文章で試す場合は、モデル・声・実行先を選び「声を準備する」を押します。
3. 準備後に「読み上げる」を押すと、文ごとに生成して再生します。生成中も停止できます。
4. 比較欄で生成時間を比べ、音声を再生・WAV保存できます。履歴は最大12件で、ページを閉じると消えます。

初期設定は **Supertonic 3・F1・CPU・8回反復** です。ページを開くだけではモデルを取得しません。比較音声も再生操作時に取得します。

HTTPSまたはlocalhostで、Cache Storage、WASM SIMD、DecompressionStream、module Workerに対応するブラウザが必要です。Chromium 153で検証しています。全モデルでCPUを使えます。SupertonicとIrodoriはWebGPUも選べますが、Irodoriには`shader-f16`対応GPUが必要です。未対応の場合はエラーを表示します。

## モデルと取得量

| モデル | 声の選択 | 重みの取得量 | 実行先 |
| --- | --- | ---: | --- |
| Piper Plus | CSS10、つくよみちゃん | 1声39.65MB | CPU・1スレッド |
| Kokoro 82M / kokoro-js-jp | 日本語5声（女性4・男性1） | q8約92MB | CPU・最大4スレッド |
| Supertonic 3 | 女性5・男性5 | 約398MB、声で共有 | CPU・最大4スレッド / WebGPU |
| Irodori v4.1 Anime | 落ち着いた女性・男性・明るい女性の説明 | 約765MB、声の説明で共有 | CPU・最大4スレッド / WebGPU |

辞書・実行エンジンも含めた初回取得は、Piperで約74MB、Kokoroで約140〜145MBです。Supertonicは表の重みに加えてCPUエンジン約12MB、またはGPUエンジン約27MBが必要です。Irodoriの約765MBにはトークナイザーを含み、参照音声用エンコーダーは含みません。推論用のメモリは取得量とは別に必要です。

Supertonicは4 / 8 / 16回、Irodoriは8 / 16 / 32回の反復を選べます。生成速度は容量だけでなく、演算・量子化・反復回数・端末にも左右されます。自然さや読みの正確さは、実際の音声で比較してください。

- **Supertonic 3**：2026年4月公開。開発元は2026年9月にリポジトリをアーカイブし、開発・サポートを終了しています。
- **Irodori**：公式v4.1 Smallから派生したAnime版の非公式W4A16 ONNX変換です。公式モデルとの品質一致は保証しません。声の説明からスタイルを生成するため固定話者ではなく、音声クローンの入力には対応していません。

## 生成速度と比較音声

文章はすべて「こんにちは。今日は良い天気ですね。」、話速1倍です。2026-10-03、AMD Ryzen 7 3800X / Linux（WSL）/ Chromium 153 headlessで、準備後に計測しました。PiperはCPU 1スレッド、ほかはCPU 4スレッドです。

| モデル・設定 | 最初の音声 | 全文生成 | 出力音声長 | RTF | 音声 |
| --- | ---: | ---: | ---: | ---: | --- |
| Piper CSS10 | 0.21秒 | 0.37秒 | 2.45秒 | 0.15 | [WAV](samples/piper-wasm.wav) |
| Kokoro jf_alpha・q8 | 3.21秒 | 6.82秒 | 4.13秒 | 1.65 | [WAV](samples/kokoro-wasm.wav) |
| Supertonic F1・8回 | 1.44秒 | 3.01秒 | 3.60秒 | 0.84 | [WAV](samples/supertonic-wasm-8.wav) |
| Supertonic F1・4回 | 0.65秒 | 1.45秒 | 3.60秒 | 0.40 | [WAV](samples/supertonic-wasm-4.wav) |
| Irodori・落ち着いた女性・8回 | 10.45秒 | 25.89秒 | 3.36秒 | 7.71 | [WAV](samples/irodori-wasm-8.wav) |

- **最初の音声**：最初のPCMを受信するまでの時間。再生予約の約20msと出力機器の遅延は含みません。
- **RTF**：全文生成時間 ÷ 出力音声長。1未満なら音声の長さより短い時間で生成しています。音声長に文間の150msの無音は含みません。
- 単発計測です。Supertonicの4回は8回の後、同じモデルを保持して測っています。ウォームアップや乱数で結果は変わり、品質の順位を示すものではありません。

音声の元ファイルと計測条件は[`samples/`](samples/)と[`benchmark.json`](samples/benchmark.json)にあります。モバイルと実GPUでの速度は未検証です。

<details>
<summary>検証範囲とWebGPUの制約</summary>

本番ビルドで4モデルのCPU生成・再生・WAV保存、比較履歴、声の切替、生成中の停止、停止後の再準備を確認しています。取得済みのPiper・Kokoro・Supertonicは、Hugging Faceへの通信を遮断しても再初期化できました。未取得の声、未対応GPU、不正なAPI設定はエラーになり、自動で別の声やCPUへ切り替えません。

検証環境のWebGPUはソフトウェア実装のGoogle SwiftShaderです。Supertonicは生成できましたが、最初の音声190秒、全文317秒で、実GPUの速度を示す結果ではありません。Irodoriは`shader-f16`非対応のためGPU生成を確認できていません。

Pages相当のヘッダーなし静的配信で、CPU並列実行、初回だけの再読込、比較音声の再生、4モデルの生成を確認しました。公開URLでも5種類の比較音声とSupertonic 3・8回反復の生成・WAV保存を確認しています。公開ビルドの結果は[Actions](https://github.com/ivgtr/synthesis-demo-web/actions)で確認できます。

</details>

## ローカルで動かす

Node.js 24を公開用CIで使用しています。

```sh
git clone git@github.com:ivgtr/synthesis-demo-web.git
cd synthesis-demo-web
npm ci --ignore-scripts
npm run dev
```

`--ignore-scripts`は、ブラウザ用ビルドに不要なネイティブ推論・画像処理パッケージのインストール処理を省きます。Irodoriも使う場合は、起動前に重み約765MBを取得してください。

```sh
npm run prepare:irodori
```

重みは固定リリースから取得し、サイズとSHA-256を検証します。dev / buildでは自動取得しないため、未取得のIrodoriを選ぶとエラーになります。

## ビルドと公開

通常の静的ホストには`dist/`を配信します。

```sh
npm run build
npm run preview
```

GitHub Pagesでは、リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定します。[公開ワークフロー](.github/workflows/pages.yml)が`main`へのpushで更新し、**Actions → Publish comparison demo → Run workflow** からも実行できます。リポジトリ名や独自ドメインに応じて配信パスを設定します。

Actionsは依存パッケージのインストール、Irodoriの取得・ハッシュ検証、ビルド、配信ファイル検査、デプロイを行います。大きな重みはGitに入れず、Actionsのキャッシュに保存します。キャッシュ使用時もハッシュを検証します。

公開先のパスを指定してローカル検査する場合は、次のように実行します。

```sh
npm run prepare:irodori
npm run build -- --base /synthesis-demo-web/
npm run verify:pages
```

公開ビルドは約902MBです。GitHub Pagesの[上限は1GB、帯域の目安は月100GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)です。Irodoriの初回取得はPagesの帯域を使います。ほかのモデルの重みはHugging Faceから取得します。`verify:pages`は容量超過や不足ファイルを検出します。

<details>
<summary>静的配信とブラウザの保存について</summary>

`prepare:assets`はdev / buildの前に自動実行し、実行エンジン・辞書を`public/engine/`、比較音声を`public/samples/`に用意します。IrodoriはGitHub ReleaseのCORS制限を避けるため、`public/models/irodori/<release-tag>/`から同じ配信元で提供します。

CPU最大4スレッドにはcross-origin isolationが必要です。Viteのdev / previewは次のヘッダーを付けます。設定可能な静的ホストでも同じヘッダーを付けてください。

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pagesでは、デモの配信パス内のService Workerでヘッダーを付け、初回だけ1回再読込します。準備に失敗すると起動エラーを表示しますが、比較音声は聴けます。このService Workerはキャッシュしません。別のページへAPIを組み込み、isolationを準備しない場合はCPU 1スレッドです。Piperは常に1スレッドです。

重み・声データ・辞書はTTS WorkerがCache Storageへ保存します。保存に失敗した場合はエラーになるため、ブラウザの空き領域とサイトデータの制限を確認してください。

辞書の`phonemizer.bin` / `kokoro/dictionary.bin`はスクリプトが展開するgzipデータです。配信時に`Content-Encoding: gzip`を付けないでください。`.wasm`はWASMのMIMEタイプで配信します。日本語前処理の初期化は準備時間に、GPUの初回カーネルコンパイルは初回生成時間に含まれる場合があります。

</details>

## スクリプトとして使う

Viteなどmodule Workerのバンドルに対応した環境で使います。`public/engine/`と、Irodoriを使う場合は`public/models/irodori/`の静的配信も必要です。ViteのWorker出力形式は`es`にしてください。

```js
import { JapaneseTTS } from './src/tts.js';

const tts = new JapaneseTTS({ onProgress: console.log });
await tts.initialize({ voice: 'supertonic-F1', device: 'wasm' });
await tts.synthesize('今日は良い天気ですね。', {
  rate: 1,
  steps: 8,
  onChunk: ({ samples, sampleRate }) => {
    // samplesはFloat32Array。再生例はsrc/audio.jsとsrc/main.js。
  },
});
tts.dispose(); // 生成中もWorkerを破棄して停止できます。
```

声IDは[`src/voices.js`](src/voices.js)にあります。`device`は`wasm`、対応モデルでは`webgpu`も指定できます。反復を省略するとSupertonicは8回、Irodoriは16回です。Piper / Kokoroに`steps`は指定しません。

<details>
<summary>APIの既定値と制約</summary>

- `voice`省略時は最後に準備した声を使います。APIの最初の既定値は`css10`です。
- `device`省略時は、同じ声なら前の実行先、別の声ならCPUを使います。`tts.voice`、`tts.device`、`tts.ready`で状態を確認できます。
- 同時に1件、文章1〜1000文字、話速0.8〜1.3倍です。未知の設定項目や未対応の値はエラーになります。
- PCMは文単位で転送します。Piperは140文字、ほかは100文字を超える文を分割するため、文をまたぐ抑揚は全文を連続生成した場合と異なります。
- Irodoriの話速は予測音声長に適用します。つくよみちゃんはモデル推奨の`length_scale=1.5`を基準とします。
- 同じモデルの声は重みを共有します。Piperの2声は別の重みです。モデル・実行先の切替時に前のWorkerを終了し、推論モデルを1つだけ保持します。Kokoroの日本語前処理には子Workerを使用します。停止後は取得済みデータから再初期化します。

</details>

## 出典とライセンス

| モデル | 出典・利用条件 |
| --- | --- |
| Piper CSS10 | [モデル](https://huggingface.co/ayousanz/piper-plus-css10-ja-6lang) · CSS10 public domain |
| Piper つくよみちゃん | [モデル](https://huggingface.co/ayousanz/piper-plus-tsukuyomi-chan) · [コーパス利用条件](https://tyc.rei-yumesaki.net/material/corpus/#terms3)。声選択時にクレジットと音声の用途条件を表示します。 |
| Kokoro | [ONNXモデル](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) · Apache-2.0。日本語処理は[kokoro-js-jp](https://github.com/nerosui/kokoro-js-jp) 0.2.0です。 |
| Supertonic 3 | [モデル](https://huggingface.co/supertone-oss-archive/supertonic-3) · [Open RAIL-M全文](public/licenses/supertonic-model.txt)（第5項・Attachment Aの用途制限を含む）。文字前処理コードはMIT。[開発終了の告知](https://github.com/supertone-oss-archive/supertonic)。 |
| Irodori | [Animeモデル](https://huggingface.co/phasefield-audio/Irodori-TTS-v4.1-Anime) · MIT。[非公式ONNX変換](https://github.com/ochisamu/irodori-tts-v4-webgpu-models/releases/tag/v4.1-anime-6b259f5-webgpu-int4-r1)。ModernBERTとSemantic-DACVAEのMITライセンスも同梱します。 |

Irodoriのブラウザ変換には、公式モデルの音声透かしは含まれません。つくよみちゃんの音声データは「つくよみちゃんコーパス（CV.夢前黎 / © Rei Yumesaki）」です。

Piper Plus・ONNX RuntimeはMIT、Kokoro関連ライブラリ・Transformers.jsはApache-2.0です。ONNX Runtime Webは1.24.3、Kokoro内はTransformers.js 3.8.1が配布する1.21.0を使います。

固定revisionなどの取得元は[`public/model-notice.txt`](public/model-notice.txt)、ライセンス本文は[`public/licenses/`](public/licenses/)と生成される`public/engine/`、組込コードの来歴と変更点は[`src/vendor/NOTICE.md`](src/vendor/NOTICE.md)に記載しています。
