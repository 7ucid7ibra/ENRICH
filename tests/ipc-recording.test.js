const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

function loadIpcWithMocks({ provider = 'whisper' } = {}) {
  const handlers = new Map();
  const sentEvents = [];
  const state = {
    rec: false,
    stream: false,
    provider
  };

  const fakeElectron = {
    app: { getPath: () => '/tmp/enrich-test' },
    systemPreferences: {
      getMediaAccessStatus: () => 'granted',
      askForMediaAccess: async () => true
    },
    ipcMain: {
      handle: (name, fn) => handlers.set(name, fn)
    }
  };

  const fakeAudio = {
    startRecording: async () => {
      if (state.rec) return false;
      state.rec = true;
      return true;
    },
    stopRecording: async () => {
      if (!state.rec) throw new Error('No recording in progress');
      state.rec = false;
      return Buffer.from('audio');
    }
  };

  const fakeStt = {
    activeProvider: provider,
    deepgramKey: 'dg_key',
    whisperPath: '/fake/whisper',
    initialize: async () => true,
    startStreaming: async () => { state.stream = true; },
    stopStreaming: async () => {
      state.stream = false;
      return 'deepgram transcript';
    },
    sendStreamingAudio: () => {},
    transcribe: async () => 'hello world'
  };

  const fakeLlm = {
    initialize: async () => true,
    getProviderModels: async () => ['big-pickle'],
    getAvailablePresets: () => ['quick_notes'],
    enrich: async (text) => ({ structured: { summary: `S:${text}` } })
  };

  const fakeTts = {
    resolveVoices: () => []
  };

  const ipcPath = path.resolve('electron/ipc.js');
  delete require.cache[ipcPath];

  const realLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return fakeElectron;
    if (parent && parent.filename.endsWith(path.join('electron', 'ipc.js'))) {
      if (request === './audio') return fakeAudio;
      if (request === './stt') return fakeStt;
      if (request === './llm') return fakeLlm;
      if (request === './tts') return fakeTts;
    }
    return realLoad.apply(this, arguments);
  };

  const ipc = require(ipcPath);
  Module._load = realLoad;

  const mainWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (channel, payload) => sentEvents.push({ channel, payload })
    }
  };
  ipc.setupIpcHandlers(mainWindow);

  const call = async (name, ...args) => {
    const fn = handlers.get(name);
    assert.ok(fn, `Missing handler: ${name}`);
    return fn({}, ...args);
  };

  return { ipc, call, sentEvents, state };
}

test('hotkey uses IPC main flow and can stop UI-started recording', async () => {
  const { ipc, call, state } = loadIpcWithMocks({ provider: 'whisper' });
  const started = await call('start-recording');
  assert.equal(started.success, true);
  assert.equal(state.rec, true);

  const stopped = await ipc.handleGlobalMainRecordingToggle();
  assert.equal(stopped.success, true);
  assert.equal(state.rec, false);
});

test('hotkey is blocked while chat recording is active', async () => {
  const { ipc, call, state } = loadIpcWithMocks({ provider: 'whisper' });
  const chatStart = await call('start-chat-recording');
  assert.equal(chatStart.success, true);
  assert.equal(state.rec, true);

  const blocked = await ipc.handleGlobalMainRecordingToggle();
  assert.equal(blocked.success, false);
  assert.match(blocked.error || '', /Chat recording in progress/);
});

