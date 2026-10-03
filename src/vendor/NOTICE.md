Irodori runtime: ngc-shj/irodori-tts-webgpu, modified in ochisamu/CharaDock.
Vendored from ochisamu/CharaDock commit c5e8ab2493050dd7602cbe3606eb0a425b5e1a96:
- desktop/irodori/v4-pipeline.mjs
- desktop/irodori/voicedesign-pipeline.mjs
Copyright (c) 2026 NOGUCHI Shoji. MIT; public/licenses/irodori-runtime.txt.
Runtime files are unchanged. The application uses caption conditioning without
reference-voice inputs, and disables the optional trailing-utterance trimming.
The browser conversion does not include SilentCipher watermarking.
Weights: phasefield-audio/Irodori-TTS-v4.1-Anime, revision
6b259f5baa5e236b3d14cbd1f8555ca87d92b530, derived from Aratako/Irodori-TTS-v4.1-Small.
Unofficial W4A16 ONNX conversion: ochisamu/irodori-tts-v4-webgpu-models,
release v4.1-anime-6b259f5-webgpu-int4-r1; scripts/irodori-manifest.json
pins sizes and SHA-256. Reference encoder graphs are omitted.

Supertonic UnicodeProcessor: Supertone supertonic web/helper.js.
Copyright (c) 2025 Supertone Inc. MIT; public/licenses/supertonic-code.txt.
The language table and UnicodeProcessor were extracted without changes.
The neural inference adapter was rewritten for this application's sentence
streaming protocol and tensor disposal; weights are unchanged.

Kokoro: kokoro-js-jp 0.2.0 + kokoro-js 1.2.1 + Transformers.js 3.8.1.
Apache-2.0; public/licenses contains the licenses and third-party notices.
The build pins kokoro-js voice URLs to revision
1939ad2a8e416c0acfeecc08a694d14ef25f2231. The adapter pins model/tokenizer
requests to the same revision and requires Cache Storage writes to succeed.
The Open JTalk gzip dictionary is served as dictionary.bin without HTTP
Content-Encoding so the library performs the decompression itself.
Supertonic source revision: 1e9799e964ea4c0dad7cde993b65c3c813a7b373.
