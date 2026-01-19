export interface ElectronAPI {
  onRecordingStatus: (callback: (status: { isRecording: boolean }) => void) => void
  onProcessingStatus: (callback: (status: { stage: 'transcribing' | 'enriching', message: string }) => void) => void
  onTranscriptionResult: (callback: (result: TranscriptionResult) => void) => void
  onProcessingError: (callback: (error: { error: string }) => void) => void
  startRecording: () => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; error?: string }>
  getAvailableModels: () => Promise<any>
  setActivePreset: (preset: string) => Promise<{ success: boolean; error?: string }>
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
