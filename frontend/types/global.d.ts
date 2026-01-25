export interface ElectronAPI {
  onRecordingStatus: (callback: (status: { isRecording: boolean; cancelled?: boolean }) => void) => void
  onProcessingStatus: (callback: (status: { stage: 'transcribing' | 'enriching', message: string }) => void) => void
  onTranscriptionResult: (callback: (result: TranscriptionResult) => void) => void
  onTranscriptionRaw: (callback: (data: { text: string; final?: boolean }) => void) => void
  onTranscriptionLive: (callback: (data: { text: string }) => void) => void
  onChatRecordingStatus: (callback: (status: { isRecording: boolean; cancelled?: boolean }) => void) => void
  onChatTranscriptionRaw: (callback: (data: { text: string; final?: boolean }) => void) => void
  onChatTranscriptionLive: (callback: (data: { text: string }) => void) => void
  onProcessingError: (callback: (error: { error: string }) => void) => void
  startRecording: () => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; error?: string }>
  startChatRecording: () => Promise<{ success: boolean; error?: string }>
  stopChatRecording: () => Promise<{ success: boolean; error?: string }>
  getAvailableModels: () => Promise<any>
  getHistory: () => Promise<{ success: boolean; history?: any[]; error?: string }>
  saveHistory: (history: any[]) => Promise<{ success: boolean; error?: string }>
  setActivePreset: (preset: string) => Promise<{ success: boolean; error?: string }>
  setOllamaModel: (model: string) => Promise<{ success: boolean; error?: string }>
  setOllamaUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  setOpenAIKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setGeminiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setOpenCodeKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setLLMProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
  setSTTProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
  setDeepgramKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setTtsProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
  setElevenLabsKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setElevenLabsVoiceId: (voiceId: string) => Promise<{ success: boolean; error?: string }>
  setAutoEnrich: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
  ttsSpeak: (payload: { text: string; language?: string; includeData?: boolean }) => Promise<{ success: boolean; path?: string; data?: string | null; error?: string }>
  setTtsVoice: (payload: { language: string; voiceId: string }) => Promise<{ success: boolean; error?: string }>
  cancelRecording: () => Promise<{ success: boolean; error?: string }>
  cancelAskQuestion: () => Promise<{ success: boolean; error?: string }>
  setUILanguage: (language: string) => Promise<{ success: boolean; error?: string }>
  enrichText: (text: string, outputLanguage?: string) => Promise<{ success: boolean; result?: TranscriptionResult['enriched']; error?: string }>
  askQuestion: (payload: { transcript: string; question: string }) => Promise<{ success: boolean; answer?: string; error?: string }>
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
}

export interface TranscriptionResult {
  original: string
  enriched: {
    structured: {
      corrected_text?: string
      summary?: string
      bullet_points?: string[]
      key_points?: string[]
      action_items?: string[]
    }
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
