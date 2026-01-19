const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Recording status
  onRecordingStatus: (callback) => {
    ipcRenderer.on('recording-status', (event, data) => callback(data));
  },
  
  // Processing status
  onProcessingStatus: (callback) => {
    ipcRenderer.on('processing-status', (event, data) => callback(data));
  },
  
  // Transcription results
  onTranscriptionResult: (callback) => {
    ipcRenderer.on('transcription-result', (event, data) => callback(data));
  },
  
  // Error handling
  onProcessingError: (callback) => {
    ipcRenderer.on('processing-error', (event, data) => callback(data));
  },
  
  // Manual recording control
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  
  // Get available models
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  
  // Set active preset
  setActivePreset: (preset) => ipcRenderer.invoke('set-active-preset', preset)
});
