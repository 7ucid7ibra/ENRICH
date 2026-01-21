import { useState, useEffect, useRef } from 'react'
import { Settings, Copy, Check, ChevronRight, Info, X, Loader2, History, Volume2 } from 'lucide-react'
import type { NextPage } from 'next'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import type { TranscriptionResult } from '../types/global'

import Layout from '../components/Layout'
import StepIndicator from '../components/StepIndicator'
import MicrophoneButton from '../components/MicrophoneButton'
import ResultCard from '../components/ResultCard'
import SettingsDrawer from '../components/SettingsDrawer'
import HistoryDrawer from '../components/HistoryDrawer'

interface ProcessingStatus {
  stage: 'transcribing' | 'enriching'
  message: string
}

interface RecordingStatus {
  isRecording: boolean
  cancelled?: boolean
}

type Step = 'record' | 'transcribe' | 'enrich'
type Language = 'de' | 'en'
type HistoryItem = {
  id: string
  createdAt: number
  transcription: string
  enriched: TranscriptionResult['enriched']
  chat: { role: 'user' | 'assistant'; content: string }[]
}

const translations = {
  de: {
    record: 'Aufnehmen',
    transcribe: 'Transkribieren',
    enrich: 'Anreichern',
    recording: 'Aufnahme läuft',
    start: 'Starten',
    processing: 'Verarbeite...',
    enriching: 'Anreichern',
    summary: 'ZUSAMMENFASSUNG',
    keyPoints: 'KERNTHEMEN',
    actionItems: 'ACTION ITEMS',
    copyAll: 'Alles kopieren',
    copied: 'Kopiert',
    settings: 'Einstellungen',
    provider: 'KI-Modell Provider',
    model: 'Modell',
    apiKey: 'API Key',
    preset: 'Prompt Preset',
    transcriptionPlaceholder: 'Transkription erscheint hier...',
    history: 'Verlauf',
    noHistory: 'Keine Einträge',
    errorRecord: 'Fehler bei Aufnahme',
    errorEnrich: 'Fehler beim Anreichern',
    save: 'Speichern',
    saved: 'Gespeichert',
    startRecord: 'Starten',
    stopRecord: 'Aufnahme läuft',
    transcribing: 'Transkribiere Audio...',
    enriching_progress: 'Mit KI anreichern...',
    info: 'Information',
    onboardingTitle: 'Willkommen',
    onboardingDontShow: 'Nicht wieder anzeigen',
    onboardingStart: 'Los geht’s',
    onboardingFeaturesTitle: 'Funktionen',
    onboardingFeatureQa: 'Q&A: Fragen zur Transkription stellen und Antworten erhalten.',
    onboardingFeatureHistory: 'Verlauf: Frühere Transkriptionen und Ergebnisse wieder öffnen.',
    onboardingFeaturePresets: 'Presets: Unterschiedliche Anreicherungs-Profile wählen.',
    onboardingFeatureAutoEnrich: 'Auto-Anreichern: Automatisch nach der Transkription anreichern oder manuell starten.',
    onboardingFeatureSttProvider: 'STT-Provider: Whisper lokal oder Deepgram (Cloud) für schnelleres Transkribieren.',
    onboardingFeatureLive: 'Live-Transkription: Echtzeit-Transkription mit Deepgram.',
    onboardingFeatureLanguage: 'Sprache: UI zwischen Deutsch und Englisch umschalten.',
    onboardingFeatureTts: 'Sprachausgabe: Zusammenfassung und Antworten vorlesen lassen.',
    shortcuts: 'Shortcuts',
    close: 'Schließen',
    howToUse: 'Anleitung',
    step1: 'Klicken Sie auf den Mikrofon-Button, um die Aufnahme zu starten.',
    step2: 'Sprechen Sie deutlich. Die Transkription erscheint nach Ende der Aufnahme.',
    step3: 'Klicken Sie auf "Anreichern", um Zusammenfassungen und Action Items zu erstellen.',
    shortcutRecord: 'Aufnahme starten/stoppen',
    shortcutEnrich: 'Anreichern auslösen',
    shortcutCancel: 'Aufnahme abbrechen',
    qaTitle: 'Q&A',
    qaEmpty: 'Stelle Fragen zur Transkription.',
    qaPlaceholder: 'Frage zur Transkription stellen...',
    qaClear: 'Leeren',
    qaAsk: 'Fragen',
    qaAsking: 'Frage läuft...',
    cancelRecording: 'Abbrechen',
    autoEnrichLabel: 'Auto-Anreichern',
    autoEnrichManual: 'Manuell',
    autoEnrichAuto: 'Auto',
    ttsVoice: 'TTS Stimme',
    settingsStt: 'STT & TTS',
    settingsBehavior: 'Verhalten',
    settingsLlm: 'KI Provider',
    settingsPresets: 'Presets',
    sttProvider: 'Sprache-zu-Text',
    sttWhisper: 'whisper',
    sttDeepgram: 'deepgram',
    sttApiKey: 'Deepgram API Key'
  },
  en: {
    record: 'Record',
    transcribe: 'Transcribe',
    enrich: 'Enrich',
    recording: 'Recording',
    start: 'Start',
    processing: 'Processing...',
    enriching: 'Enrich',
    summary: 'SUMMARY',
    keyPoints: 'KEY POINTS',
    actionItems: 'ACTION ITEMS',
    copyAll: 'Copy All',
    copied: 'Copied',
    provider: 'AI Model Provider',
    model: 'Model',
    apiKey: 'API Key',
    preset: 'Prompt Preset',
    transcriptionPlaceholder: 'Transcription will appear here...',
    history: 'History',
    noHistory: 'No entries yet',
    errorRecord: 'Failed to record',
    errorEnrich: 'Failed to enrich',
    save: 'Save',
    saved: 'Saved',
    startRecord: 'Start',
    stopRecord: 'Recording',
    transcribing: 'Transcribing audio...',
    enriching_progress: 'Enriching with AI...',
    transcription: 'Transcription',
    settings: 'Settings',
    info: 'Information',
    onboardingTitle: 'Welcome',
    onboardingDontShow: "Don't show again",
    onboardingStart: 'Get started',
    onboardingFeaturesTitle: 'Features',
    onboardingFeatureQa: 'Q&A: Ask questions about the transcript and get answers.',
    onboardingFeatureHistory: 'History: Reopen earlier transcriptions and results.',
    onboardingFeaturePresets: 'Presets: Choose different enrichment profiles.',
    onboardingFeatureAutoEnrich: 'Auto Enrich: Run enrichment automatically after transcription or start manually.',
    onboardingFeatureSttProvider: 'STT Provider: Whisper local or Deepgram (cloud) for faster transcription.',
    onboardingFeatureLive: 'Live Transcription: Real-time transcription with Deepgram.',
    onboardingFeatureLanguage: 'Language: Toggle the UI between German and English.',
    onboardingFeatureTts: 'Text-to-speech: Listen to summaries and answers.',
    ttsVoice: 'TTS Stimme',
    shortcuts: 'Shortcuts',
    close: 'Close',
    howToUse: 'Guide',
    step1: 'Click the microphone button to start recording.',
    step2: 'Speak clearly. The transcription appears after you stop recording.',
    step3: 'Click "Enrich" to generate summaries and action items.',
    shortcutRecord: 'Start/Stop Recording',
    shortcutEnrich: 'Trigger Enrich',
    shortcutCancel: 'Cancel Recording',
    qaTitle: 'Q&A',
    qaEmpty: 'Ask questions about the transcription.',
    qaPlaceholder: 'Ask a question about the transcript...',
    qaClear: 'Clear',
    qaAsk: 'Ask',
    qaAsking: 'Asking...',
    cancelRecording: 'Cancel',
    autoEnrichLabel: 'Auto Enrich',
    autoEnrichManual: 'Manual',
    autoEnrichAuto: 'Auto',
    ttsVoice: 'TTS Stimme',
    settingsStt: 'STT & TTS',
    settingsBehavior: 'Behavior',
    settingsLlm: 'AI Provider',
    settingsPresets: 'Presets',
    sttProvider: 'Speech-to-Text',
    sttWhisper: 'whisper',
    sttDeepgram: 'deepgram',
    sttApiKey: 'Deepgram API Key'
  }
}

const Home: NextPage = () => {
  // State
  const [language, setLanguage] = useState<Language>('de')
  const t = translations[language]
  const [currentStep, setCurrentStep] = useState<Step>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null)
  const [rawTranscription, setRawTranscription] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [skipOnboarding, setSkipOnboarding] = useState(false)
  const [onboardingFeaturesOpen, setOnboardingFeaturesOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)

  // Settings State
  const [availableModels, setAvailableModels] = useState<any>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [activeOllamaModel, setActiveOllamaModel] = useState<string | null>(null)
  const [llmProvider, setLlmProvider] = useState<string>('opencode')
  const [sttProvider, setSttProvider] = useState<string>('whisper')
  const [autoEnrich, setAutoEnrich] = useState(false)
  const [ttsVoices, setTtsVoices] = useState<{ voice_id: string; name: string; language?: string }[]>([])
  const [ttsVoiceId, setTtsVoiceId] = useState<string>('')
  const [ttsBusyKey, setTtsBusyKey] = useState<string | null>(null)
  const [ttsPlayingKey, setTtsPlayingKey] = useState<string | null>(null)
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [apiKeys, setApiKeys] = useState({ openai: '', gemini: '', deepgram: '' })
  const [savedApiKeys, setSavedApiKeys] = useState({ openai: '', gemini: '', deepgram: '' })
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({})
  const [settingsSections, setSettingsSections] = useState({
    stt: false,
    behavior: false,
    llm: false,
    presets: false
  })

  // Refs for scrolling
  const resultsRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollMobileRef = useRef<HTMLDivElement>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const hadLiveUpdateRef = useRef(false)
  const qaSectionRef = useRef<HTMLDivElement>(null)
  const qaSectionMobileRef = useRef<HTMLDivElement>(null)
  const qaInputRef = useRef<HTMLDivElement>(null)
  const qaInputMobileRef = useRef<HTMLDivElement>(null)
  const lastAssistantIndexRef = useRef(-1)
  const tRef = useRef(t)
  const isProcessingRef = useRef(isProcessing)
  const lastResultRef = useRef(lastResult)
  const rawTranscriptionRef = useRef(rawTranscription)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return
    }
    window.electronAPI.setUILanguage(language)
    loadAvailableModels()
  }, [language])

  const lastAssistantIndex = (() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i]?.role === 'assistant') {
        return i
      }
    }
    return -1
  })()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const shouldHide = window.localStorage.getItem('everlast_onboarding_hide') === '1'
    setShowOnboarding(!shouldHide)
    setSkipOnboarding(shouldHide)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const stored = window.localStorage.getItem('everlast_auto_enrich') === '1'
    setAutoEnrich(stored)
    window.electronAPI?.setAutoEnrich(stored)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem('everlast_auto_enrich', autoEnrich ? '1' : '0')
    window.electronAPI?.setAutoEnrich(autoEnrich)
  }, [autoEnrich])

  useEffect(() => {
    isProcessingRef.current = isProcessing
    lastResultRef.current = lastResult
  }, [isProcessing, lastResult])

  useEffect(() => {
    rawTranscriptionRef.current = rawTranscription
  }, [rawTranscription])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const isStacked = window.innerWidth < 1024
    const container = isStacked ? chatScrollMobileRef.current : chatScrollRef.current
    if (!container) {
      return
    }
    const bottom = container.scrollHeight - container.clientHeight
    if (bottom >= 0) {
      container.scrollTo({ top: bottom, behavior: 'smooth' })
    }
    const input = isStacked ? qaInputMobileRef.current : qaInputRef.current
    if (!input) {
      return
    }
    requestAnimationFrame(() => {
      const rect = input.getBoundingClientRect()
      const padding = 16
      if (rect.bottom > window.innerHeight - padding) {
        window.scrollBy({
          top: rect.bottom - window.innerHeight + padding,
          behavior: 'smooth'
        })
      }
    })
  }, [chatMessages.length, chatBusy])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (lastAssistantIndex < 0 || lastAssistantIndex === lastAssistantIndexRef.current) {
      return
    }
    const lastMsg = chatMessages[lastAssistantIndex]
    if (!lastMsg || lastMsg.role !== 'assistant') {
      return
    }
    lastAssistantIndexRef.current = lastAssistantIndex
  }, [lastAssistantIndex, chatMessages])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const isStacked = window.innerWidth < 1024
    if (!isStacked) {
      return
    }
    if (currentStep === 'enrich' && lastResult?.enriched?.structured?.summary) {
      setTimeout(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    }
  }, [currentStep, lastResult])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isRecording) {
        event.preventDefault()
        cancelRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRecording])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return
    }

    const onRecordingStatus = (status: RecordingStatus) => {
      setIsRecording(status.isRecording)
      if (status.isRecording) {
        setCurrentStep('record')
        setLastResult(null)
        setRawTranscription('')
        setChatMessages([])
        setActiveHistoryId(null)
        hadLiveUpdateRef.current = false
      } else if (status.cancelled) {
        setCurrentStep('record')
        setLastResult(null)
        setRawTranscription('')
        setChatMessages([])
        setError(null)
        setIsProcessing(false)
        setProcessingStatus(null)
        hadLiveUpdateRef.current = false
      }
    }

    const onProcessingStatus = (status: ProcessingStatus) => {
      const currentT = tRef.current
      let localizedMsg = status.message
      if (status.stage === 'transcribing') localizedMsg = currentT.transcribing
      if (status.stage === 'enriching') localizedMsg = currentT.enriching_progress

      setProcessingStatus({ ...status, message: localizedMsg })
      setIsProcessing(true)
      if (status.stage === 'transcribing') {
        setCurrentStep('transcribe')
      } else if (status.stage === 'enriching') {
        setCurrentStep('enrich')
      }
    }

    const onTranscriptionResult = (result: TranscriptionResult) => {
      setLastResult(result)
      setRawTranscription(result.original || '')
      setIsProcessing(false)
      setProcessingStatus(null)
      setError(null)
      setCurrentStep('enrich')
      setChatMessages([])
      const historyItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        transcription: result.original,
        enriched: result.enriched,
        chat: []
      }
      addHistoryItem(historyItem)
    }

    const onTranscriptionRaw = (data: { text: string; final?: boolean }) => {
      const nextText = data.text || (data.final && hadLiveUpdateRef.current ? rawTranscriptionRef.current : '')
      setRawTranscription(nextText)
      if (data.final) {
        setIsProcessing(false)
        setProcessingStatus(null)
      }
      if (!isProcessingRef.current && !lastResultRef.current && !hadLiveUpdateRef.current) {
        setCurrentStep('transcribe')
      }
      if (hadLiveUpdateRef.current) {
        hadLiveUpdateRef.current = false
      }
    }

    const onTranscriptionLive = (data: { text: string }) => {
      setRawTranscription(data.text || '')
      if (!isProcessingRef.current) {
        setCurrentStep('transcribe')
      }
      hadLiveUpdateRef.current = true
    }

    const onProcessingError = (errorData: { error: string }) => {
      setError(errorData.error)
      setIsProcessing(false)
      setProcessingStatus(null)
    }

    window.electronAPI.onRecordingStatus(onRecordingStatus)
    window.electronAPI.onProcessingStatus(onProcessingStatus)
    window.electronAPI.onTranscriptionResult(onTranscriptionResult)
    window.electronAPI.onTranscriptionRaw(onTranscriptionRaw)
    window.electronAPI.onTranscriptionLive(onTranscriptionLive)
    window.electronAPI.onProcessingError(onProcessingError)

    loadAvailableModels()

    return () => {
      if (!window.electronAPI) {
        return
      }
      window.electronAPI.removeListener?.('recording-status', onRecordingStatus)
      window.electronAPI.removeListener?.('processing-status', onProcessingStatus)
      window.electronAPI.removeListener?.('transcription-result', onTranscriptionResult)
      window.electronAPI.removeListener?.('transcription-raw', onTranscriptionRaw)
      window.electronAPI.removeListener?.('processing-error', onProcessingError)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const loadHistory = async () => {
      try {
        if (window.electronAPI?.getHistory) {
          const response = await window.electronAPI.getHistory()
          const parsed = Array.isArray(response?.history) ? response.history : []
          if (parsed.length > 0) {
            setHistoryItems(parsed)
            if (parsed[0]?.id) {
              setActiveHistoryId(parsed[0].id)
            }
            return
          }
        }
        const stored = window.localStorage.getItem('everlast-history')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            setHistoryItems(parsed)
            if (parsed[0]?.id) {
              setActiveHistoryId(parsed[0].id)
            }
            if (window.electronAPI?.saveHistory) {
              window.electronAPI.saveHistory(parsed)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load history:', error)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('everlast-history', JSON.stringify(historyItems))
      window.electronAPI?.saveHistory?.(historyItems)
    } catch (error) {
      console.warn('Failed to save history:', error)
    }
  }, [historyItems])

  // --- Logic Helpers ---

  const loadAvailableModels = async () => {
    try {
      if (window.electronAPI) {
        const models = await window.electronAPI.getAvailableModels()
        setAvailableModels(models)
        setActivePreset(models?.activePreset || null)
        setActiveOllamaModel(models?.llm?.activeModel || null)
        setLlmProvider(models?.llm?.provider || 'ollama')
        setSttProvider(models?.stt?.provider || 'whisper')
        setProviderModels(models?.llm?.models || [])
        setOllamaUrl(models?.llm?.ollamaUrl || '')
        setTtsVoices(models?.tts?.voices || [])
        const selected = models?.tts?.selected?.[language] || ''
        setTtsVoiceId(selected)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await window.electronAPI?.stopRecording()
      } else {
        await window.electronAPI?.startRecording()
      }
    } catch (error) {
      setError('Failed to toggle recording')
    }
  }

  const cancelRecording = async () => {
    try {
      await window.electronAPI?.cancelRecording()
    } catch (error) {
      setError('Failed to cancel recording')
    }
  }

  const enrichFromText = async () => {
    if (!rawTranscription.trim()) {
      setError('No transcription text to enrich')
      return
    }
    try {
      setIsProcessing(true)
      setProcessingStatus({ stage: 'enriching', message: t.enriching_progress })
      const response = await window.electronAPI?.enrichText(rawTranscription, language)
      if (response?.success && response.result) {
        const manualResult = { original: rawTranscription, enriched: response.result }
        setLastResult(manualResult)
        setError(null)
        setCurrentStep('enrich')
        setChatMessages([])
        const historyItem = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: Date.now(),
          transcription: rawTranscription,
          enriched: response.result,
          chat: []
        }
        addHistoryItem(historyItem)
      } else {
        setError(response?.error || 'Failed to enrich text')
      }
    } catch (error) {
      setError('Failed to enrich text')
    } finally {
      setIsProcessing(false)
      setProcessingStatus(null)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') {
        return
      }
      event.preventDefault()
      if (isRecording || isProcessing || !rawTranscription.trim()) {
        return
      }
      enrichFromText()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRecording, isProcessing, rawTranscription])

  const askQuestion = async () => {
    if (!chatInput.trim()) {
      return
    }
    if (!rawTranscription.trim()) {
      setError('No transcription available for Q&A')
      return
    }
    const question = chatInput.trim()
    setChatInput('')
    setChatBusy(true)
    setChatMessages((prev) => {
      const next = [...prev, { role: 'user', content: question }]
      updateHistoryChat(next)
      return next
    })
    try {
      const response = await window.electronAPI?.askQuestion({
        transcript: rawTranscription,
        question
      })
      if (response?.success && response.answer) {
        setChatMessages((prev) => {
          const next = [...prev, { role: 'assistant', content: response.answer }]
          updateHistoryChat(next)
          return next
        })
      } else {
        if (response?.error !== 'Request cancelled') {
          setError(response?.error || 'Failed to answer question')
        }
      }
    } catch (error) {
      setError('Failed to answer question')
    } finally {
      setChatBusy(false)
    }
  }

  const cancelAskQuestion = async () => {
    try {
      await window.electronAPI?.cancelAskQuestion()
    } catch (error) {
      setError('Failed to cancel request')
    } finally {
      setChatBusy(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code', error)
    }
  }

  const closeOnboarding = () => {
    if (typeof window !== 'undefined') {
      if (skipOnboarding) {
        window.localStorage.setItem('everlast_onboarding_hide', '1')
      } else {
        window.localStorage.removeItem('everlast_onboarding_hide')
      }
    }
    setShowOnboarding(false)
  }

  const buildHistoryKey = (item: { transcription: string; enriched: TranscriptionResult['enriched'] }) => {
    const summary = item.enriched?.structured?.summary || ''
    return `${item.transcription}::${summary}`
  }

  const addHistoryItem = (item: HistoryItem) => {
    const newKey = buildHistoryKey(item)
    let activeId = item.id
    setHistoryItems((prev) => {
      if (prev[0]) {
        const sameKey = buildHistoryKey(prev[0]) === newKey
        const sameTranscript = prev[0].transcription === item.transcription
        const withinWindow = Math.abs(item.createdAt - prev[0].createdAt) < 5000
        if (sameKey || (sameTranscript && withinWindow)) {
          activeId = prev[0].id
          return prev
        }
      }
      return [item, ...prev].slice(0, 20)
    })
    setActiveHistoryId(activeId)
  }

  const selectHistoryItem = (item: HistoryItem) => {
    setLastResult({ original: item.transcription, enriched: item.enriched })
    setRawTranscription(item.transcription)
    setCurrentStep('enrich')
    setActiveHistoryId(item.id)
    setChatMessages(item.chat || [])
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const updateHistoryChat = (nextChat: { role: 'user' | 'assistant'; content: string }[]) => {
    if (!activeHistoryId) {
      return
    }
    setHistoryItems((prev) =>
      prev.map((item) =>
        item.id === activeHistoryId ? { ...item, chat: nextChat } : item
      )
    )
  }

  // --- Settings Logic ---
  const handleSaveKey = async (provider: string, key: string) => {
    let result
    if (provider === 'openai') result = await window.electronAPI?.setOpenAIKey(key)
    if (provider === 'gemini') result = await window.electronAPI?.setGeminiKey(key)
    if (provider === 'deepgram') result = await window.electronAPI?.setDeepgramKey(key)

    if (result?.success) {
      setSavedApiKeys((prev) => ({ ...prev, [provider]: key }))
      setSaveStatus(prev => ({ ...prev, [provider]: true }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [provider]: false })), 2000)
      await loadAvailableModels()
    }
  }

  const handleProviderChange = async (provider: string) => {
    try {
      const result = await window.electronAPI?.setLLMProvider(provider)
      if (result?.success) {
        setLlmProvider(provider)
        await loadAvailableModels()
      } else {
        setError(result?.error || 'Failed to change provider')
      }
    } catch (error) {
      setError('Failed to change provider')
    }
  }

  const handleSttProviderChange = async (provider: string) => {
    try {
      setSttProvider(provider)
      if (!window.electronAPI?.setSTTProvider) {
        setError('STT provider control not available')
        return
      }
      const result = await window.electronAPI.setSTTProvider(provider)
      if (result?.success) {
        await loadAvailableModels()
      } else {
        setError(result?.error || 'Failed to change STT provider')
      }
    } catch (error) {
      setError('Failed to change STT provider')
    }
  }

  const handleTtsVoiceChange = async (voiceId: string) => {
    setTtsVoiceId(voiceId)
    try {
      const result = await window.electronAPI?.setTtsVoice({ language, voiceId })
      if (!result?.success) {
        setError(result?.error || 'Failed to set TTS voice')
      }
    } catch (error) {
      setError('Failed to set TTS voice')
    }
  }

  const playTts = async (text: string, key: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    try {
      if (ttsPlayingKey === key) {
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause()
          ttsAudioRef.current.src = ''
          ttsAudioRef.current = null
        }
        setTtsPlayingKey(null)
        setTtsBusyKey(null)
        return
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current.src = ''
        ttsAudioRef.current = null
      }
      setTtsPlayingKey(null)
      setTtsBusyKey(key)
      const response = await window.electronAPI?.ttsSpeak({ text: trimmed, language, includeData: true })
      if (!response?.success || !response.path) {
        setTtsBusyKey(null)
        setError(response?.error || 'Failed to synthesize speech')
        return
      }
      const audioSrc = response.data
        ? `data:audio/wav;base64,${response.data}`
        : new URL(`file://${response.path}`).toString()
      const audio = new Audio(audioSrc)
      ttsAudioRef.current = audio
      audio.addEventListener('canplaythrough', () => {
        setTtsBusyKey(null)
        setTtsPlayingKey(key)
      }, { once: true })
      audio.addEventListener('ended', () => {
        setTtsPlayingKey(null)
      }, { once: true })
      audio.addEventListener('error', () => {
        setTtsBusyKey(null)
        setTtsPlayingKey(null)
        setError('Failed to play audio')
      }, { once: true })
      audio.load()
      audio.play().catch(() => setError('Failed to play audio'))
    } catch (error) {
      setTtsBusyKey(null)
      setTtsPlayingKey(null)
      setError('Failed to synthesize speech')
    }
  }

  // Format helper
  const formatFullResult = (result: TranscriptionResult) => {
    if (!result?.enriched?.structured) return result?.original || ''
    const s = result.enriched.structured
    return [
      s.corrected_text ? `Corrected: ${s.corrected_text}` : '',
      s.summary ? `Summary: ${s.summary}` : '',
      ...(s.bullet_points || []).map(p => `• ${p}`),
      ...(s.action_items || []).map(i => `[ ] ${i}`)
    ].filter(Boolean).join('\n\n')
  }

  const ttsVoiceOptions = ttsVoices.filter((voice) => {
    const lang = String(voice.language || '').toLowerCase()
    return language === 'de' ? lang.startsWith('de') : lang.startsWith('en')
  })

  const isKeyDirty = (provider: keyof typeof apiKeys) => {
    const value = (apiKeys[provider] || '').trim()
    if (!value) {
      return false
    }
    return value !== (savedApiKeys[provider] || '')
  }

  const toggleSettingsSection = (key: keyof typeof settingsSections) => {
    setSettingsSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }


  return (
    <Layout>
      {/* Refined Top Bar */}
      <div className="w-full flex justify-between items-center py-4 px-2 mb-8 border-b border-white/5">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-serif tracking-[0.2em] text-white/90">
            ENRICH
          </h1>
          <div className="h-4 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:block">
            <StepIndicator
              currentStep={currentStep}
              labels={{
                record: t.record,
                transcribe: t.transcribe,
                enrich: t.enrich
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(l => l === 'de' ? 'en' : 'de')}
            className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-all"
          >
            {language}
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          {[
            { icon: History, onClick: () => setShowHistory(true) },
            { icon: Settings, onClick: () => setShowSettings(true) },
            { icon: Info, onClick: () => setShowOnboarding(true) },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className="p-2 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-everlast-gold"
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Grid */}
      <div className={clsx(
        "flex-1 w-full grid gap-8 transition-all duration-700 ease-in-out",
        (currentStep === 'enrich' && lastResult) ? "grid-cols-1 lg:grid-cols-[450px_1fr]" : "grid-cols-1 max-w-3xl mx-auto"
      )}>



        {/* LEFT COLUMN: Input & Control */}
        <div className="flex flex-col gap-6">
          <section ref={editorRef} className="glass-panel rounded-2xl p-6 border border-white/5 bg-white/[0.02] shadow-2xl relative overflow-hidden group">
            {/* Ambient edge glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-everlast-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                {t.transcribe}
              </h3>
              {isRecording && (
                <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Live</span>
                </div>
              )}
            </div>

            <textarea
              value={rawTranscription}
              onChange={(e) => setRawTranscription(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  if (!isProcessing && rawTranscription.trim()) {
                    enrichFromText()
                  }
                }
              }}
              className="w-full h-48 bg-transparent text-gray-200 text-base leading-relaxed placeholder:text-gray-700 focus:outline-none resize-none custom-scrollbar"
              placeholder={t.transcriptionPlaceholder}
            />

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-6">
              <div className="flex items-center gap-3">
                <MicrophoneButton
                  isRecording={isRecording}
                  onClick={toggleRecording}
                  disabled={isProcessing}
                  label={isRecording ? t.stopRecord : t.startRecord}
                />
                {isRecording && (
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="flex items-center gap-1 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border border-red-500/30 text-red-400 hover:text-red-200 hover:border-red-400 transition-all"
                  >
                    <X className="w-3 h-3" />
                    {t.cancelRecording}
                  </button>
                )}
              </div>

              <button
                onClick={enrichFromText}
                disabled={isProcessing || !rawTranscription.trim()}
                className={clsx(
                  "group relative overflow-hidden px-8 py-3 rounded-xl font-bold tracking-widest text-xs uppercase transition-all duration-300",
                  "bg-everlast-gold text-black hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] active:scale-95",
                  (isProcessing || !rawTranscription.trim()) && "opacity-30 cursor-not-allowed grayscale"
                )}
              >
                <div className="relative z-10 flex items-center gap-2">
                  <span>{isProcessing ? t.processing : t.enriching}</span>
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  )}
                </div>
                {/* Metallic shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl flex items-center gap-2 uppercase font-bold tracking-wider">
                <X className="w-3 h-3" />
                {error}
              </div>
            )}
          </section>

          {/* Q&A Integrated into Left Column when enriched */}
          {currentStep === 'enrich' && (
            <section ref={qaSectionRef} className="hidden lg:flex flex-col glass-panel rounded-2xl p-6 border border-white/5 bg-white/[0.01] max-h-[70vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                  {t.qaTitle}
                </h3>
                <button
                  onClick={() => { setChatMessages([]); updateHistoryChat([]); }}
                  className="text-[10px] font-bold text-gray-600 hover:text-white transition-colors uppercase"
                >
                  {t.qaClear}
                </button>
              </div>

              <div ref={chatScrollRef} className="space-y-4 flex-1 min-h-[180px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-gray-600 italic">{t.qaEmpty}</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      data-chat-last={index === lastAssistantIndex ? 'true' : undefined}
                      className={clsx(
                        'relative p-4 rounded-xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-white/[0.03] text-gray-400 border border-white/5'
                          : 'bg-everlast-gold/[0.03] text-gray-200 border border-everlast-gold/10'
                      )}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => playTts(msg.content, `chat-${index}`)}
                          className={clsx(
                            "absolute bottom-2 right-2 p-1 rounded-full border transition-all group",
                            ttsPlayingKey === `chat-${index}`
                              ? "bg-everlast-gold/10 border-everlast-gold/50 text-everlast-gold"
                              : "bg-black/30 text-gray-300 hover:text-everlast-gold border-white/10 hover:border-everlast-gold/40"
                          )}
                          aria-label="Play answer"
                          title="Play answer"
                        >
                          {ttsBusyKey === `chat-${index}` ? (
                            <Loader2 className="w-3 h-3 animate-spin text-everlast-gold" />
                          ) : ttsPlayingKey === `chat-${index}` ? (
                            <div className="relative w-3 h-3">
                              <Volume2 className="absolute inset-0 w-3 h-3 tts-pulse group-hover:opacity-0 transition-opacity" />
                              <X className="absolute inset-0 w-3 h-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
                
              </div>

              <div ref={qaInputRef} className="relative group mt-auto">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                  placeholder={t.qaPlaceholder}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 focus:outline-none focus:border-everlast-gold/40 transition-all"
                />
                <button
                  onClick={() => (chatBusy ? cancelAskQuestion() : askQuestion())}
                  disabled={!chatBusy && !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-everlast-gold hover:text-everlast-gold-light disabled:opacity-30 transition-all group"
                >
                  {chatBusy ? (
                    <div className="relative w-5 h-5">
                      <Loader2 className="absolute inset-0 w-5 h-5 animate-spin opacity-100 group-hover:opacity-0 transition-opacity" />
                      <X className="absolute inset-0 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: Enrichment Results */}
        <div className="flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {currentStep === 'enrich' && lastResult ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">Enriched Results</h3>
                  <button
                    onClick={() => copyToClipboard(formatFullResult(lastResult))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-everlast-gold hover:border-everlast-gold/30 hover:bg-everlast-gold/[0.02] transition-all"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? t.copied : t.copyAll}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {lastResult.enriched?.structured?.summary && (
                    <div ref={summaryRef} style={{ scrollMarginTop: '24px' }}>
                      <ResultCard title={t.summary} delay={0.1}>
                        <div className="relative">
                        <p className="text-lg text-gray-200 font-serif leading-relaxed italic">
                          "{lastResult.enriched.structured.summary}"
                        </p>
                        <button
                          type="button"
                          onClick={() => playTts(lastResult.enriched.structured.summary || '', 'summary')}
                          className={clsx(
                            "absolute bottom-0 right-0 p-1.5 rounded-full border transition-all group",
                            ttsPlayingKey === 'summary'
                              ? "bg-everlast-gold/10 border-everlast-gold/50 text-everlast-gold"
                              : "bg-black/40 text-gray-300 hover:text-everlast-gold border-white/10 hover:border-everlast-gold/40"
                          )}
                          aria-label="Play summary"
                          title="Play summary"
                        >
                          {ttsBusyKey === 'summary' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-everlast-gold" />
                          ) : ttsPlayingKey === 'summary' ? (
                            <div className="relative w-3.5 h-3.5">
                              <Volume2 className="absolute inset-0 w-3.5 h-3.5 tts-pulse group-hover:opacity-0 transition-opacity" />
                              <X className="absolute inset-0 w-3.5 h-3.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        </div>
                      </ResultCard>
                    </div>
                  )}

                  <div className={clsx(
                    "grid gap-6",
                    (lastResult.enriched?.structured?.bullet_points?.length && lastResult.enriched?.structured?.action_items?.length)
                      ? "grid-cols-1 xl:grid-cols-2"
                      : "grid-cols-1"
                  )}>
                    {(lastResult.enriched?.structured?.bullet_points?.length || 0) > 0 && (
                      <ResultCard title={t.keyPoints} delay={0.2}>
                        <ul className="space-y-3">
                          {lastResult.enriched.structured.bullet_points.map((p: string, i: number) => (
                            <li key={i} className="flex gap-3 text-sm text-gray-400">
                              <span className="text-everlast-gold mt-1">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </ResultCard>
                    )}

                    {(lastResult.enriched?.structured?.action_items?.length || 0) > 0 && (
                      <ResultCard title={t.actionItems} delay={0.3} className="border-l-2 border-everlast-gold/30 bg-everlast-gold/[0.02]">
                        <ul className="space-y-3">
                          {lastResult.enriched.structured.action_items.map((item: string, i: number) => (
                            <li key={i} className="flex gap-3 items-start group">
                              <div className="mt-1 w-4 h-4 rounded border border-everlast-gold/30 flex-shrink-0 flex items-center justify-center group-hover:border-everlast-gold/60 transition-colors">
                                <Check className="w-2.5 h-2.5 text-everlast-gold opacity-0 group-hover:opacity-100" />
                              </div>
                              <span className="text-sm text-gray-300 leading-tight">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </ResultCard>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20">
                <div className="w-32 h-32 border border-white/10 rounded-full flex items-center justify-center mb-6">
                  <div className="w-24 h-24 border border-white/5 rounded-full flex items-center justify-center animate-pulse-slow">
                    <h1 className="font-serif italic text-4xl">E</h1>
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Awaiting Enrichment</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {currentStep === 'enrich' && (
          <div className="lg:hidden">
            <section ref={qaSectionMobileRef} className="glass-panel rounded-2xl p-6 border border-white/5 bg-white/[0.01] flex flex-col max-h-[70vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                  {t.qaTitle}
                </h3>
                <button
                  onClick={() => { setChatMessages([]); updateHistoryChat([]); }}
                  className="text-[10px] font-bold text-gray-600 hover:text-white transition-colors uppercase"
                >
                  {t.qaClear}
                </button>
              </div>

              <div ref={chatScrollMobileRef} className="space-y-4 flex-1 min-h-[180px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-gray-600 italic">{t.qaEmpty}</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      data-chat-last={index === lastAssistantIndex ? 'true' : undefined}
                      className={clsx(
                        'relative p-4 rounded-xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-white/[0.03] text-gray-400 border border-white/5'
                          : 'bg-everlast-gold/[0.03] text-gray-200 border border-everlast-gold/10'
                      )}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => playTts(msg.content, `chat-${index}`)}
                          className={clsx(
                            "absolute bottom-2 right-2 p-1 rounded-full border transition-all group",
                            ttsPlayingKey === `chat-${index}`
                              ? "bg-everlast-gold/10 border-everlast-gold/50 text-everlast-gold"
                              : "bg-black/30 text-gray-300 hover:text-everlast-gold border-white/10 hover:border-everlast-gold/40"
                          )}
                          aria-label="Play answer"
                          title="Play answer"
                        >
                          {ttsBusyKey === `chat-${index}` ? (
                            <Loader2 className="w-3 h-3 animate-spin text-everlast-gold" />
                          ) : ttsPlayingKey === `chat-${index}` ? (
                            <div className="relative w-3 h-3">
                              <Volume2 className="absolute inset-0 w-3 h-3 tts-pulse group-hover:opacity-0 transition-opacity" />
                              <X className="absolute inset-0 w-3 h-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
                
              </div>

              <div ref={qaInputMobileRef} className="relative group mt-auto">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                  placeholder={t.qaPlaceholder}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 focus:outline-none focus:border-everlast-gold/40 transition-all"
                />
                <button
                  onClick={() => (chatBusy ? cancelAskQuestion() : askQuestion())}
                  disabled={!chatBusy && !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-everlast-gold hover:text-everlast-gold-light disabled:opacity-30 transition-all group"
                >
                  {chatBusy ? (
                    <div className="relative w-5 h-5">
                      <Loader2 className="absolute inset-0 w-5 h-5 animate-spin opacity-100 group-hover:opacity-0 transition-opacity" />
                      <X className="absolute inset-0 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} title={t.settings}>
        <div className="space-y-8">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-gray-200">{t.settings}</h3>
          </div>
          {/* STT Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleSettingsSection('stt')}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
            >
              <span>{t.settingsStt}</span>
              <ChevronRight className={clsx("w-4 h-4 transition-transform", settingsSections.stt && "rotate-90")} />
            </button>
            <AnimatePresence initial={false}>
              {settingsSections.stt && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 pt-2">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.sttProvider}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['whisper', 'deepgram'].map(p => (
                      <button
                        key={p}
                        onClick={() => handleSttProviderChange(p)}
                        className={clsx(
                          "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                          sttProvider === p
                            ? "bg-everlast-primary/20 border-everlast-primary text-white"
                            : "bg-everlast-surface border-white/10 text-gray-400 hover:bg-white/5"
                        )}
                      >
                        {p === 'whisper' ? t.sttWhisper : t.sttDeepgram}
                      </button>
                    ))}
                  </div>
                </div>

                {sttProvider === 'deepgram' && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">{t.sttApiKey}</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="dg-..."
                        value={apiKeys.deepgram || ''}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                        onChange={(e) => setApiKeys(p => ({ ...p, deepgram: e.target.value }))}
                      />
                      <button
                        onClick={() => handleSaveKey('deepgram', apiKeys.deepgram)}
                        disabled={!isKeyDirty('deepgram')}
                        className={clsx(
                          "px-3 py-1 border rounded-lg text-xs transition-all",
                          isKeyDirty('deepgram')
                            ? "bg-[#FDFD96] text-black hover:bg-transparent hover:text-white border-[#FDFD96]"
                            : "bg-white/5 text-gray-500 border-white/10 cursor-not-allowed"
                        )}
                      >
                        {isKeyDirty('deepgram') ? t.save : t.saved}
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.ttsVoice}</label>
                  <select
                    value={ttsVoiceId || ''}
                    onChange={(e) => handleTtsVoiceChange(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                  >
                    {ttsVoiceOptions.length === 0 ? (
                      <option value="">No voices found</option>
                    ) : (
                      ttsVoiceOptions.map((voice) => (
                        <option key={voice.voice_id} value={voice.voice_id}>
                          {voice.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* LLM Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleSettingsSection('llm')}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
            >
              <span>{t.settingsLlm}</span>
              <ChevronRight className={clsx("w-4 h-4 transition-transform", settingsSections.llm && "rotate-90")} />
            </button>
            <AnimatePresence initial={false}>
              {settingsSections.llm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 pt-2">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">{t.provider}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['opencode', 'ollama', 'openai', 'gemini'].map(p => (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={clsx(
                          "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                          llmProvider === p
                            ? "bg-everlast-primary/20 border-everlast-primary text-white"
                            : "bg-everlast-surface border-white/10 text-gray-400 hover:bg-white/5"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {availableModels && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.model} ({llmProvider})</label>
                      {providerModels.length > 0 ? (
                        <select
                          value={activeOllamaModel || ''}
                          onChange={(e) => {
                            const newVal = e.target.value
                            setActiveOllamaModel(newVal)
                            window.electronAPI?.setOllamaModel(newVal)
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                        >
                          {providerModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="e.g. gpt-4, gemini-pro"
                          defaultValue={availableModels?.llm?.activeModel || ''}
                          onBlur={(e) => window.electronAPI?.setOllamaModel(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                        />
                      )}
                    </div>

                    {['openai', 'gemini'].includes(llmProvider) && (
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase">{t.apiKey}</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              placeholder="sk-..."
                              value={apiKeys[llmProvider as keyof typeof apiKeys] || ''}
                              className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                              onChange={(e) => setApiKeys(p => ({ ...p, [llmProvider]: e.target.value }))}
                            />
                            <button
                              onClick={() => handleSaveKey(llmProvider, apiKeys[llmProvider as keyof typeof apiKeys])}
                              disabled={!isKeyDirty(llmProvider as keyof typeof apiKeys)}
                              className={clsx(
                                "px-3 py-1 border rounded-lg text-xs transition-all",
                                isKeyDirty(llmProvider as keyof typeof apiKeys)
                                  ? "bg-[#FDFD96] text-black hover:bg-transparent hover:text-white border-[#FDFD96]"
                                  : "bg-white/5 text-gray-500 border-white/10 cursor-not-allowed"
                              )}
                            >
                              {isKeyDirty(llmProvider as keyof typeof apiKeys) ? t.save : t.saved}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Presets Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleSettingsSection('presets')}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
            >
              <span>{t.settingsPresets}</span>
              <ChevronRight className={clsx("w-4 h-4 transition-transform", settingsSections.presets && "rotate-90")} />
            </button>
            <AnimatePresence initial={false}>
              {settingsSections.presets && availableModels && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 pt-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-everlast-secondary rounded-full" />
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.preset}</label>
                  </div>
                  <div className="relative group">
                    <select
                      value={activePreset || ''}
                      onChange={(e) => {
                        const newVal = e.target.value
                        setActivePreset(newVal)
                        window.electronAPI?.setActivePreset(newVal)
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-gray-200 outline-none transition-all hover:border-everlast-secondary/50 focus:border-everlast-secondary focus:ring-1 focus:ring-everlast-secondary/20 appearance-none"
                    >
                      {availableModels.presets?.map((p: string) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 text-xs text-gray-600">
                  Everlast Transcription v2.0
                </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Behavior Section */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleSettingsSection('behavior')}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all"
            >
              <span>{t.settingsBehavior}</span>
              <ChevronRight className={clsx("w-4 h-4 transition-transform", settingsSections.behavior && "rotate-90")} />
            </button>
            <AnimatePresence initial={false}>
              {settingsSections.behavior && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 pt-2">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">{t.autoEnrichLabel}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setAutoEnrich(false)}
                          className={clsx(
                            "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                            !autoEnrich
                              ? "bg-everlast-primary/20 border-everlast-primary text-white"
                              : "bg-everlast-surface border-white/10 text-gray-400 hover:bg-white/5"
                          )}
                        >
                          {t.autoEnrichManual}
                        </button>
                        <button
                          onClick={() => setAutoEnrich(true)}
                          className={clsx(
                            "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                            autoEnrich
                              ? "bg-everlast-primary/20 border-everlast-primary text-white"
                              : "bg-everlast-surface border-white/10 text-gray-400 hover:bg-white/5"
                          )}
                        >
                          {t.autoEnrichAuto}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SettingsDrawer>

      <HistoryDrawer isOpen={showHistory} onClose={() => setShowHistory(false)} title={t.history}>
        {historyItems.length === 0 ? (
          <div className="text-sm text-gray-400">{t.noHistory}</div>
        ) : (
          <div className="space-y-3">
            {historyItems.map((item) => {
              const summary = item.enriched?.structured?.summary || ''
              const preview = summary || item.transcription || ''
              return (
                <button
                  key={item.id}
                  onClick={() => selectHistoryItem(item)}
                  className={clsx(
                    'w-full text-left p-3 rounded-lg border transition-all',
                    activeHistoryId === item.id
                      ? 'border-everlast-secondary/60 bg-white/5'
                      : 'border-white/10 bg-black/30 hover:bg-white/5'
                  )}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-200 max-h-16 overflow-hidden">
                    {preview || t.noHistory}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </HistoryDrawer>
      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOnboarding}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 1 }}
              className="relative w-full max-w-lg bg-everlast-surface border border-white/10 rounded-2xl p-8 shadow-2xl z-[111] max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-everlast-secondary/10 rounded-lg">
                    <Info className="w-6 h-6 text-everlast-secondary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">{t.onboardingTitle}</h2>
                </div>
                <button onClick={closeOnboarding} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-everlast-secondary uppercase tracking-widest">{t.howToUse}</h3>
                  <ul className="space-y-3">
                    {[t.step1, t.step2, t.step3].map((step, i) => (
                      <li key={i} className="flex gap-4 items-start text-gray-300">
                        <span className="flex-shrink-0 w-6 h-6 bg-white/5 border border-white/10 rounded-md flex items-center justify-center text-xs font-bold text-everlast-secondary">{i + 1}</span>
                        <p className="text-sm leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setOnboardingFeaturesOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between text-sm font-bold text-everlast-secondary uppercase tracking-widest"
                  >
                    <span>{t.onboardingFeaturesTitle}</span>
                    <ChevronRight className={clsx("w-4 h-4 transition-transform", onboardingFeaturesOpen && "rotate-90")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {onboardingFeaturesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <ul className="space-y-3 text-sm text-gray-300 pt-2">
                          {[
                            t.onboardingFeatureQa,
                            t.onboardingFeatureHistory,
                            t.onboardingFeaturePresets,
                            t.onboardingFeatureAutoEnrich,
                            t.onboardingFeatureSttProvider,
                            t.onboardingFeatureLive,
                            t.onboardingFeatureLanguage,
                            t.onboardingFeatureTts
                          ].map((feature, i) => (
                            <li key={i} className="flex gap-3 items-start">
                              <span className="mt-1 h-2 w-2 rounded-full bg-everlast-secondary/60" />
                              <p className="leading-relaxed">{feature}</p>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <h3 className="text-sm font-bold text-everlast-secondary uppercase tracking-widest">{t.shortcuts}</h3>
                  <div className="space-y-3">
                    {[
                      { label: t.shortcutRecord, keys: '⌘ + Shift + Space' },
                      { label: t.shortcutEnrich, keys: '⌘ + Enter' },
                      { label: t.shortcutCancel, keys: 'Esc' }
                    ].map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5"
                      >
                        <span className="text-sm text-gray-300">{shortcut.label}</span>
                        <kbd className="px-3 py-1 bg-black rounded-md border border-white/20 text-xs font-mono text-everlast-secondary shadow-sm tracking-tighter">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-xs uppercase tracking-widest text-gray-400">
                  <input
                    type="checkbox"
                    checked={skipOnboarding}
                    onChange={(e) => setSkipOnboarding(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/50 text-everlast-gold focus:ring-0"
                  />
                  {t.onboardingDontShow}
                </label>
                <button
                  onClick={closeOnboarding}
                  className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-widest text-white transition-all"
                >
                  {t.onboardingStart}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  )
}

export default Home
