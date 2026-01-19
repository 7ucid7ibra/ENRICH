const { ipcMain } = require('electron');
const audioRecorder = require('./audio');
const stt = require('./stt');
const llm = require('./llm');

let mainWindow;

function setupIpcHandlers(window) {
  mainWindow = window;

  // Recording controls
  ipcMain.handle('start-recording', async () => {
    try {
      if (!mainWindow) {
        throw new Error('Main window not ready');
      }
      await audioRecorder.startRecording();
      mainWindow.webContents.send('recording-status', { isRecording: true });
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
      mainWindow.webContents.send('recording-status', { isRecording: false });
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
      const presets = llm.getAvailablePresets();
      
      return {
        stt: {
          available: sttInitialized,
          whisper: stt.whisperPath !== null
        },
        llm: {
          available: llmInitialized,
          ollama: llmInitialized
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
    if (!mainWindow) {
      throw new Error('Main window not ready');
    }
    // Send processing status
    mainWindow.webContents.send('processing-status', { 
      stage: 'transcribing', 
      message: 'Transcribing audio...' 
    });
    
    // Transcribe audio
    const transcription = await stt.transcribe(audioBuffer);
    
    // Send transcription status
    mainWindow.webContents.send('processing-status', { 
      stage: 'enriching', 
      message: 'Enriching content...' 
    });
    
    // Enrich with LLM
    const enriched = await llm.enrich(transcription);
    
    // Send final result
    mainWindow.webContents.send('transcription-result', {
      original: transcription,
      enriched: enriched
    });
    
  } catch (error) {
    console.error('Error processing audio:', error);
    mainWindow.webContents.send('processing-error', { error: error.message });
  }
}

module.exports = { setupIpcHandlers };
