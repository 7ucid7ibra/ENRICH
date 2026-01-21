const { app, BrowserWindow, globalShortcut, systemPreferences } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;
let isRecording = false;

// Import modules
const audioRecorder = require('./audio');
const stt = require('./stt');
const llm = require('./llm');
const ipc = require('./ipc');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app
  const devPort = process.env.DEV_PORT || '3000';
  const startUrl = isDev 
    ? `http://localhost:${devPort}` 
    : `file://${path.join(__dirname, '../frontend/out/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Global hotkey registration
function registerGlobalHotkey() {
  const ret = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    console.log('Global hotkey triggered');
    toggleRecording();
  });

  if (!ret) {
    console.error('Global hotkey registration failed');
  }
}

// Toggle recording state
async function toggleRecording() {
  if (isRecording) {
    console.log('Stopping recording...');
    const audioBuffer = await audioRecorder.stopRecording();
    isRecording = false;
    
    // Send status to renderer
    mainWindow.webContents.send('recording-status', { isRecording: false });
    
    // Process the audio
    if (stt.activeProvider === 'deepgram') {
      const transcript = await stt.stopStreaming();
      const autoEnrichEnabled = !ipc.getAutoEnrich || ipc.getAutoEnrich();
      mainWindow.webContents.send('transcription-raw', { text: transcript, final: !autoEnrichEnabled });
      if (autoEnrichEnabled) {
        mainWindow.webContents.send('processing-status', { stage: 'enriching', message: 'Enriching content...' });
        const enriched = await llm.enrich(transcript);
        mainWindow.webContents.send('transcription-result', {
          original: transcript,
          enriched: enriched
        });
      }
    } else if (audioBuffer) {
      await processAudio(audioBuffer);
    }
  } else {
    console.log('Starting recording...');
    if (stt.activeProvider === 'deepgram') {
      await stt.startStreaming((text) => {
        mainWindow.webContents.send('transcription-live', { text });
      });
      await audioRecorder.startRecording({
        audioType: 'raw',
        silence: '0',
        onData: (chunk) => stt.sendStreamingAudio(chunk)
      });
    } else {
      await audioRecorder.startRecording();
    }
    isRecording = true;
    
    // Send status to renderer
    mainWindow.webContents.send('recording-status', { isRecording: true });
  }
}

// Process audio through transcription and enrichment
async function processAudio(audioBuffer) {
  try {
    // Send processing status
    mainWindow.webContents.send('processing-status', { stage: 'transcribing', message: 'Transcribing audio...' });
    
    // Transcribe audio
    const transcription = await stt.transcribe(audioBuffer);
    mainWindow.webContents.send('transcription-raw', { text: transcription, final: !(ipc.getAutoEnrich && ipc.getAutoEnrich()) });
    
    if (ipc.getAutoEnrich && !ipc.getAutoEnrich()) {
      return;
    }

    // Send transcription status
    mainWindow.webContents.send('processing-status', { stage: 'enriching', message: 'Enriching content...' });
    
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

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  ipc.setupIpcHandlers(mainWindow);
  registerGlobalHotkey();

  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch((error) => {
      console.warn('Microphone permission request failed:', error);
    });
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
