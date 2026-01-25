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

  // Live transcription
  onTranscriptionLive: (callback) => {
    ipcRenderer.on('transcription-live', (event, data) => callback(data));
  },

  // Chat transcription
  onChatRecordingStatus: (callback) => {
    ipcRenderer.on('chat-recording-status', (event, data) => callback(data));
  },
  onChatTranscriptionRaw: (callback) => {
    ipcRenderer.on('chat-transcription-raw', (event, data) => callback(data));
  },
  onChatTranscriptionLive: (callback) => {
    ipcRenderer.on('chat-transcription-live', (event, data) => callback(data));
  },
  
  // Error handling
  onProcessingError: (callback) => {
    ipcRenderer.on('processing-error', (event, data) => callback(data));
  },
  
  // Manual recording control
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  startChatRecording: () => ipcRenderer.invoke('start-chat-recording'),
  stopChatRecording: () => ipcRenderer.invoke('stop-chat-recording'),
  
  // Get available models
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),
  
  // Set active preset
  setActivePreset: (preset) => ipcRenderer.invoke('set-active-preset', preset),
  setOllamaModel: (model) => ipcRenderer.invoke('set-ollama-model', model),
  setOllamaUrl: (url) => ipcRenderer.invoke('set-ollama-url', url),
  setOpenAIKey: (apiKey) => ipcRenderer.invoke('set-openai-key', apiKey),
  setGeminiKey: (apiKey) => ipcRenderer.invoke('set-gemini-key', apiKey),
  setOpenCodeKey: (apiKey) => ipcRenderer.invoke('set-opencode-key', apiKey),
  setLLMProvider: (provider) => ipcRenderer.invoke('set-llm-provider', provider),
  setSTTProvider: (provider) => ipcRenderer.invoke('set-stt-provider', provider),
  setDeepgramKey: (apiKey) => ipcRenderer.invoke('set-deepgram-key', apiKey),
  setTtsProvider: (provider) => ipcRenderer.invoke('set-tts-provider', provider),
  setElevenLabsKey: (apiKey) => ipcRenderer.invoke('set-elevenlabs-key', apiKey),
  setElevenLabsVoiceId: (voiceId) => ipcRenderer.invoke('set-elevenlabs-voice-id', voiceId),
  setAutoEnrich: (enabled) => ipcRenderer.invoke('set-auto-enrich', enabled),
  ttsSpeak: (payload) => ipcRenderer.invoke('tts-speak', payload),
  setTtsVoice: (payload) => ipcRenderer.invoke('set-tts-voice', payload),
  cancelRecording: () => ipcRenderer.invoke('cancel-recording'),
  cancelAskQuestion: () => ipcRenderer.invoke('cancel-ask-question'),
  enrichText: (text, outputLanguage) => ipcRenderer.invoke('enrich-text', { text, outputLanguage }),
  setUILanguage: (language) => ipcRenderer.invoke('set-ui-language', language),
  askQuestion: (payload) => ipcRenderer.invoke('ask-question', payload),
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
