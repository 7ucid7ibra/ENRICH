const { contextBridge, ipcRenderer } = require('electron');

const listenerMap = new WeakMap();

function addListener(channel, callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  const wrapped = (event, data) => callback(data, event);
  ipcRenderer.on(channel, wrapped);

  let channelMap = listenerMap.get(callback);
  if (!channelMap) {
    channelMap = new Map();
    listenerMap.set(callback, channelMap);
  }
  const wrappedSet = channelMap.get(channel) || new Set();
  wrappedSet.add(wrapped);
  channelMap.set(channel, wrappedSet);

  return () => removeListener(channel, callback);
}

function removeListener(channel, callback) {
  const channelMap = listenerMap.get(callback);
  if (!channelMap) {
    return;
  }
  const wrappedSet = channelMap.get(channel);
  if (!wrappedSet) {
    return;
  }
  wrappedSet.forEach((wrapped) => {
    ipcRenderer.removeListener(channel, wrapped);
  });
  channelMap.delete(channel);
  if (channelMap.size === 0) {
    listenerMap.delete(callback);
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Recording status
  onRecordingStatus: (callback) => {
    return addListener('recording-status', callback);
  },
  
  // Processing status
  onProcessingStatus: (callback) => {
    return addListener('processing-status', callback);
  },
  
  // Transcription results
  onTranscriptionResult: (callback) => {
    return addListener('transcription-result', callback);
  },

  // Raw transcription
  onTranscriptionRaw: (callback) => {
    return addListener('transcription-raw', callback);
  },

  // Live transcription
  onTranscriptionLive: (callback) => {
    return addListener('transcription-live', callback);
  },

  // Chat transcription
  onChatRecordingStatus: (callback) => {
    return addListener('chat-recording-status', callback);
  },
  onChatTranscriptionRaw: (callback) => {
    return addListener('chat-transcription-raw', callback);
  },
  onChatTranscriptionLive: (callback) => {
    return addListener('chat-transcription-live', callback);
  },
  
  // Error handling
  onProcessingError: (callback) => {
    return addListener('processing-error', callback);
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
  removeListener
});
