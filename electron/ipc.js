const { app, ipcMain, systemPreferences } = require('electron');
const fs = require('fs');
const path = require('path');
const audioRecorder = require('./audio');
const stt = require('./stt');
const llm = require('./llm');
const tts = require('./tts');

let mainWindow;
let currentQuestionAbort = null;
let autoEnrich = false;
let deepgramStreaming = false;
const historyPath = path.join(app.getPath('userData'), 'everlast-history.json');

function safeSend(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  try {
    mainWindow.webContents.send(channel, payload);
  } catch (error) {
    console.warn(`Failed to send ${channel}:`, error.message);
  }
}

function setupIpcHandlers(window) {
  mainWindow = window;

  // Recording controls
  ipcMain.handle('start-recording', async () => {
    try {
      if (!mainWindow) {
        throw new Error('Main window not ready');
      }
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        if (status !== 'granted') {
          const granted = await systemPreferences.askForMediaAccess('microphone');
          if (!granted) {
            throw new Error('Microphone access denied. Enable it in System Settings.');
          }
        }
      }
      if (stt.activeProvider === 'deepgram') {
        if (!stt.deepgramKey) {
          throw new Error('Deepgram API key not configured.');
        }
        deepgramStreaming = true;
        await stt.startStreaming((text) => {
          safeSend('transcription-live', { text });
        });
        await audioRecorder.startRecording({
          audioType: 'raw',
          silence: '0',
          onData: (chunk) => stt.sendStreamingAudio(chunk)
        });
      } else {
        await audioRecorder.startRecording();
      }
      safeSend('recording-status', { isRecording: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-recording', async () => {
    try {
      if (!mainWindow) {
        throw new Error('Main window not ready');
      }
      const audioBuffer = await audioRecorder.stopRecording();
      safeSend('recording-status', { isRecording: false });
      if (stt.activeProvider === 'deepgram' && deepgramStreaming) {
        deepgramStreaming = false;
        const transcript = await stt.stopStreaming();
        safeSend('transcription-raw', { text: transcript, final: !autoEnrich });
        if (autoEnrich) {
          safeSend('processing-status', {
            stage: 'enriching',
            message: 'Enriching content...'
          });
          const enriched = await llm.enrich(transcript);
          safeSend('transcription-result', {
            original: transcript,
            enriched: enriched
          });
        }
      } else if (audioBuffer) {
        // Process audio in background
        processAudio(audioBuffer);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-recording', async () => {
    try {
      if (!mainWindow) {
        throw new Error('Main window not ready');
      }
      await audioRecorder.stopRecording();
      if (stt.activeProvider === 'deepgram' && deepgramStreaming) {
        deepgramStreaming = false;
        await stt.stopStreaming();
      }
      safeSend('recording-status', { isRecording: false, cancelled: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get available models and presets
  ipcMain.handle('get-available-models', async () => {
    try {
      const sttInitialized = await stt.initialize();
      const llmInitialized = await llm.initialize();
      const providerModels = await llm.getProviderModels();
      if (providerModels.length > 0 && !providerModels.includes(llm.activeModel)) {
        llm.setActiveModel(providerModels[0]);
      }
      const presets = llm.getAvailablePresets();
      const voices = tts.resolveVoices();
      
      return {
        stt: {
          available: sttInitialized,
          provider: stt.activeProvider,
          whisper: stt.whisperPath !== null,
          deepgramConfigured: Boolean(stt.deepgramKey)
        },
        tts: {
          voices: voices.map((voice) => ({
            voice_id: voice.voice_id,
            name: voice.name,
            language: voice.language
          })),
          selected: {
            en: tts.getVoiceForLanguage('en'),
            de: tts.getVoiceForLanguage('de')
          }
        },
        llm: {
          available: llmInitialized,
          provider: llm.activeProvider,
          models: providerModels,
          activeModel: llm.activeModel,
          ollamaUrl: llm.ollamaUrl,
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
          geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
          opencodeConfigured: Boolean(process.env.OPENCODE_API_KEY)
        },
        presets: presets,
        activePreset: llm.activePreset
      };
    } catch (error) {
      return { error: error.message };
    }
  });

  // Set active preset
  ipcMain.handle('set-active-preset', async (event, presetName) => {
    try {
      const success = llm.setActivePreset(presetName);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('enrich-text', async (event, payload) => {
    try {
      const text = typeof payload === 'string' ? payload : payload?.text;
      const outputLanguage = typeof payload === 'object' ? payload?.outputLanguage : null;
      if (!text || typeof text !== 'string') {
        throw new Error('Text is required for enrichment');
      }
      const result = await llm.enrich(text, null, { outputLanguage });
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-ui-language', async (event, language) => {
    try {
      const success = llm.setOutputLanguage(language);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ask-question', async (event, payload) => {
    try {
      const transcript = payload?.transcript || '';
      const question = payload?.question || '';
      if (currentQuestionAbort) {
        currentQuestionAbort.abort();
      }
      const controller = new AbortController();
      currentQuestionAbort = controller;
      const answer = await llm.askQuestion(transcript, question, { signal: controller.signal });
      currentQuestionAbort = null;
      return { success: true, answer };
    } catch (error) {
      if (error?.name === 'AbortError' || error?.type === 'aborted') {
        return { success: false, error: 'Request cancelled' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-ask-question', async () => {
    try {
      if (currentQuestionAbort) {
        currentQuestionAbort.abort();
        currentQuestionAbort = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-ollama-model', async (event, modelName) => {
    try {
      const success = llm.setActiveModel(modelName);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-ollama-url', async (event, url) => {
    try {
      const success = llm.setOllamaUrl(url);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-openai-key', async (event, apiKey) => {
    try {
      const success = llm.setOpenAIKey(apiKey);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-gemini-key', async (event, apiKey) => {
    try {
      const success = llm.setGeminiKey(apiKey);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-opencode-key', async (event, apiKey) => {
    try {
      const success = llm.setOpenCodeKey(apiKey);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-llm-provider', async (event, providerName) => {
    try {
      const success = llm.setActiveProvider(providerName);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts-speak', async (event, payload) => {
    try {
      const text = payload?.text;
      const language = payload?.language || 'en';
      const includeData = Boolean(payload?.includeData);
      if (!text || typeof text !== 'string') {
        return { success: false, error: 'Text is required for TTS.' };
      }
      const audioPath = await tts.synthesize(text, { language });
      let data = null;
      if (includeData) {
        data = fs.readFileSync(audioPath).toString('base64');
      }
      return { success: true, path: audioPath, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-tts-voice', async (event, payload) => {
    try {
      const language = payload?.language;
      const voiceId = payload?.voiceId;
      const success = tts.setVoiceForLanguage(language, voiceId);
      if (!success) {
        return { success: false, error: 'Failed to set TTS voice.' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-auto-enrich', async (event, enabled) => {
    try {
      autoEnrich = Boolean(enabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-stt-provider', async (event, providerName) => {
    try {
      if (!providerName) {
        return { success: false, error: 'STT provider is required' };
      }
      const success = stt.setActiveProvider(String(providerName).toLowerCase());
      if (!success) {
        return { success: false, error: `Unsupported STT provider: ${providerName}` };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-deepgram-key', async (event, apiKey) => {
    try {
      const success = stt.setDeepgramKey(apiKey);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-history', async () => {
    try {
      if (!fs.existsSync(historyPath)) {
        return { success: true, history: [] };
      }
      const raw = fs.readFileSync(historyPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { success: true, history: Array.isArray(parsed) ? parsed : [] };
    } catch (error) {
      return { success: false, error: error.message, history: [] };
    }
  });

  ipcMain.handle('save-history', async (event, history) => {
    try {
      const data = Array.isArray(history) ? history : [];
      fs.mkdirSync(path.dirname(historyPath), { recursive: true });
      fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test transcription
  ipcMain.handle('test-transcription', async () => {
    try {
      // Create a test audio buffer (silence)
      const testBuffer = Buffer.alloc(16000 * 2); // 1 second of silence at 16kHz
      const transcription = await stt.transcribe(testBuffer);
      return { success: true, transcription };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test LLM
  ipcMain.handle('test-llm', async () => {
    try {
      const testText = "This is a test text for enrichment.";
      const result = await llm.enrich(testText);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// Process audio in background
async function processAudio(audioBuffer) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window not ready');
    }
    // Send processing status
    safeSend('processing-status', { 
      stage: 'transcribing', 
      message: 'Transcribing audio...' 
    });
    
    // Transcribe audio
    const transcription = await stt.transcribe(audioBuffer);
    safeSend('transcription-raw', { text: transcription, final: !autoEnrich });
    
    if (!autoEnrich) {
      return;
    }

    // Send transcription status
    safeSend('processing-status', { 
      stage: 'enriching', 
      message: 'Enriching content...' 
    });
    
    // Enrich with LLM
    const enriched = await llm.enrich(transcription);
    
    // Send final result
    safeSend('transcription-result', {
      original: transcription,
      enriched: enriched
    });
    
  } catch (error) {
    console.error('Error processing audio:', error);
    safeSend('processing-error', { error: error.message });
  }
}

const getAutoEnrich = () => autoEnrich;

module.exports = { setupIpcHandlers, getAutoEnrich };
