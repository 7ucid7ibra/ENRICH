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

  // Raw transcription
  onTranscriptionRaw: (callback) => {
    ipcRenderer.on('transcription-raw', (event, data) => callback(data));
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
  setActivePreset: (preset) => ipcRenderer.invoke('set-active-preset', preset),
  setOllamaModel: (model) => ipcRenderer.invoke('set-ollama-model', model),
  setOllamaUrl: (url) => ipcRenderer.invoke('set-ollama-url', url),
  setOpenAIKey: (apiKey) => ipcRenderer.invoke('set-openai-key', apiKey),
  setGeminiKey: (apiKey) => ipcRenderer.invoke('set-gemini-key', apiKey),
  setOpenCodeKey: (apiKey) => ipcRenderer.invoke('set-opencode-key', apiKey),
  setLLMProvider: (provider) => ipcRenderer.invoke('set-llm-provider', provider),
  enrichText: (text, outputLanguage) => ipcRenderer.invoke('enrich-text', { text, outputLanguage }),
  setUILanguage: (language) => ipcRenderer.invoke('set-ui-language', language),
  askQuestion: (payload) => ipcRenderer.invoke('ask-question', payload),
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
