const { ipcMain, systemPreferences } = require('electron');
const audioRecorder = require('./audio');
const stt = require('./stt');
const llm = require('./llm');

let mainWindow;

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
      await audioRecorder.startRecording();
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
      if (audioBuffer) {
        // Process audio in background
        processAudio(audioBuffer);
      }
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
      
      return {
        stt: {
          available: sttInitialized,
          whisper: stt.whisperPath !== null
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
      const answer = await llm.askQuestion(transcript, question);
      return { success: true, answer };
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
    safeSend('transcription-raw', { text: transcription });
    
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

module.exports = { setupIpcHandlers };
