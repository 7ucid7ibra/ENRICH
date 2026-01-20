export interface ElectronAPI {
  onRecordingStatus: (callback: (status: { isRecording: boolean }) => void) => void
  onProcessingStatus: (callback: (status: { stage: 'transcribing' | 'enriching', message: string }) => void) => void
  onTranscriptionResult: (callback: (result: TranscriptionResult) => void) => void
  onTranscriptionRaw: (callback: (data: { text: string }) => void) => void
  onProcessingError: (callback: (error: { error: string }) => void) => void
  startRecording: () => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; error?: string }>
  getAvailableModels: () => Promise<any>
  setActivePreset: (preset: string) => Promise<{ success: boolean; error?: string }>
  setOllamaModel: (model: string) => Promise<{ success: boolean; error?: string }>
  setOllamaUrl: (url: string) => Promise<{ success: boolean; error?: string }>
  setOpenAIKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setGeminiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setOpenCodeKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  setLLMProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
  enrichText: (text: string) => Promise<{ success: boolean; result?: TranscriptionResult['enriched']; error?: string }>
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
