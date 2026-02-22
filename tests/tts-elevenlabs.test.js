const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

test('ElevenLabs synthesis requests explicit output_format and writes matching extension', async () => {
  const requests = [];
  const realLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'node-fetch' || request === 'node-fetch/lib/index.js') {
      return async (url, options) => {
        requests.push({ url: String(url), options });
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from('ID3FAKE_MP3').buffer
        };
      };
    }
    return realLoad.apply(this, arguments);
  };

  const ttsPath = path.resolve('electron/tts.js');
  delete require.cache[ttsPath];
  const tts = require(ttsPath);
  Module._load = realLoad;

  const prev = process.env.ELEVENLABS_OUTPUT_FORMAT;
  process.env.ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
  tts.setActiveProvider('elevenlabs');
  tts.setElevenLabsKey('test-key');
  tts.setElevenLabsVoiceId('voice-id');

  const outPath = await tts.synthesize('hello from test');
  try {
    assert.match(outPath, /\.mp3$/);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /output_format=mp3_44100_128/);
    assert.equal(requests[0].options.headers.Accept, 'audio/mpeg');
    assert.ok(fs.existsSync(outPath));
  } finally {
    if (prev == null) {
      delete process.env.ELEVENLABS_OUTPUT_FORMAT;
    } else {
      process.env.ELEVENLABS_OUTPUT_FORMAT = prev;
    }
    if (fs.existsSync(outPath)) {
      fs.unlinkSync(outPath);
    }
  }
});

