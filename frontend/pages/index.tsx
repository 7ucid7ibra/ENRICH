import { useState, useEffect, useRef } from 'react'
import { Settings, Copy, Check, ChevronRight, Info, X, Loader2, History } from 'lucide-react'
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
    shortcuts: 'Shortcuts',
    close: 'Schließen',
    howToUse: 'Anleitung',
    step1: 'Klicken Sie auf den Mikrofon-Button, um die Aufnahme zu starten.',
    step2: 'Sprechen Sie deutlich. Die Transkription erscheint nach Ende der Aufnahme.',
    step3: 'Klicken Sie auf "Anreichern", um Zusammenfassungen und Action Items zu erstellen.',
    shortcutRecord: 'Aufnahme starten/stoppen',
    qaTitle: 'Q&A',
    qaEmpty: 'Stelle Fragen zur Transkription.',
    qaPlaceholder: 'Frage zur Transkription stellen...',
    qaClear: 'Leeren',
    qaAsk: 'Fragen',
    qaAsking: 'Frage läuft...',
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
    shortcuts: 'Shortcuts',
    close: 'Close',
    howToUse: 'Guide',
    step1: 'Click the microphone button to start recording.',
    step2: 'Speak clearly. The transcription appears after you stop recording.',
    step3: 'Click "Enrich" to generate summaries and action items.',
    shortcutRecord: 'Start/Stop Recording',
    qaTitle: 'Q&A',
    qaEmpty: 'Ask questions about the transcription.',
    qaPlaceholder: 'Ask a question about the transcript...',
    qaClear: 'Clear',
    qaAsk: 'Ask',
    qaAsking: 'Asking...',
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
  const [showInfo, setShowInfo] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [skipOnboarding, setSkipOnboarding] = useState(false)
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
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [apiKeys, setApiKeys] = useState({ openai: '', gemini: '', deepgram: '' })
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({})

  // Refs for scrolling
  const resultsRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const tRef = useRef(t)
  const isProcessingRef = useRef(isProcessing)
  const lastResultRef = useRef(lastResult)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return
    }
    window.electronAPI.setUILanguage(language)
  }, [language])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const shouldHide = window.localStorage.getItem('everlast_onboarding_hide') === '1'
    setShowOnboarding(!shouldHide)
    setSkipOnboarding(shouldHide)
  }, [])

  useEffect(() => {
    isProcessingRef.current = isProcessing
    lastResultRef.current = lastResult
  }, [isProcessing, lastResult])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages.length, chatBusy])

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
      // Auto scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }

    const onTranscriptionRaw = (data: { text: string }) => {
      setRawTranscription(data.text || '')
      if (!isProcessingRef.current && !lastResultRef.current) {
        setCurrentStep('transcribe')
        // Auto scroll to editor
        setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
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
    try {
      const stored = window.localStorage.getItem('everlast-history')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setHistoryItems(parsed)
          if (parsed[0]?.id) {
            setActiveHistoryId(parsed[0].id)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load history:', error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      window.localStorage.setItem('everlast-history', JSON.stringify(historyItems))
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
        setError(response?.error || 'Failed to answer question')
      }
    } catch (error) {
      setError('Failed to answer question')
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
            { icon: Info, onClick: () => setShowInfo(true) },
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
              className="w-full h-48 bg-transparent text-gray-200 text-base leading-relaxed placeholder:text-gray-700 focus:outline-none resize-none custom-scrollbar"
              placeholder={t.transcriptionPlaceholder}
            />

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-6">
              <MicrophoneButton
                isRecording={isRecording}
                onClick={toggleRecording}
                disabled={isProcessing}
                label={isRecording ? t.stopRecord : t.startRecord}
              />

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
            <section className="glass-panel rounded-2xl p-6 border border-white/5 bg-white/[0.01]">
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

              <div className="space-y-4 max-h-[300px] overflow-y-auto mb-6 pr-2 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-gray-600 italic">{t.qaEmpty}</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={clsx(
                        'p-4 rounded-xl text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-white/[0.03] text-gray-400 border border-white/5'
                          : 'bg-everlast-gold/[0.03] text-gray-200 border border-everlast-gold/10'
                      )}
                    >
                      {msg.content}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="relative group">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                  placeholder={t.qaPlaceholder}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 focus:outline-none focus:border-everlast-gold/40 transition-all"
                />
                <button
                  onClick={askQuestion}
                  disabled={chatBusy || !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-everlast-gold hover:text-everlast-gold-light disabled:opacity-30 transition-all"
                >
                  {chatBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
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
                    <ResultCard title={t.summary} delay={0.1}>
                      <p className="text-lg text-gray-200 font-serif leading-relaxed italic">
                        "{lastResult.enriched.structured.summary}"
                      </p>
                    </ResultCard>
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
      </div>

      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} title={t.settings}>
        <div className="space-y-8">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-gray-200">{t.settings}</h3>
          </div>
          {/* STT Provider */}
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
                  className="px-3 py-1 bg-[#FDFD96] text-black hover:bg-transparent hover:text-white border border-[#FDFD96] rounded-lg text-xs transition-all"
                >
                  {saveStatus.deepgram ? t.saved : t.save}
                </button>
              </div>
            </div>
          )}
          {/* LLM Provider */}
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

          {/* Dynamic Settings based on Provider */}
          {availableModels && (
            <div className="space-y-6">
              {/* Model Selection Dropdown for all providers that have models */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.model} ({llmProvider})</label>
                {providerModels.length > 0 ? (
                  <select
                    value={activeOllamaModel || ''}
                    onChange={(e) => {
                      const newVal = e.target.value
                      setActiveOllamaModel(newVal) // Optimistic update
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
                  {/* API Key Input */}
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
                        className="px-3 py-1 bg-[#FDFD96] text-black hover:bg-transparent hover:text-white border border-[#FDFD96] rounded-lg text-xs transition-all"
                      >
                        {saveStatus[llmProvider] ? t.saved : t.save}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preset Selection with enhanced design */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-everlast-secondary rounded-full" />
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.preset}</label>
                </div>
                <div className="relative group">
                  <select
                    value={activePreset || ''}
                    onChange={(e) => {
                      const newVal = e.target.value
                      setActivePreset(newVal) // Optimistic update
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
          )}
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
              className="relative w-full max-w-lg bg-everlast-surface border border-white/10 rounded-2xl p-8 shadow-2xl z-[111]"
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

              <div className="space-y-8">
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
                  <h3 className="text-sm font-bold text-everlast-secondary uppercase tracking-widest">{t.onboardingFeaturesTitle}</h3>
                  <ul className="space-y-3 text-sm text-gray-300">
                    {[t.onboardingFeatureQa, t.onboardingFeatureHistory, t.onboardingFeaturePresets].map((feature, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="mt-1 h-2 w-2 rounded-full bg-everlast-secondary/60" />
                        <p className="leading-relaxed">{feature}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <h3 className="text-sm font-bold text-everlast-secondary uppercase tracking-widest">{t.shortcuts}</h3>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-sm text-gray-300">{t.shortcutRecord}</span>
                    <kbd className="px-3 py-1 bg-black rounded-md border border-white/20 text-xs font-mono text-everlast-secondary shadow-sm tracking-tighter">⌘ + Shift + Space</kbd>
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
      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfo(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 1 }}
              className="relative w-full max-w-lg bg-everlast-surface border border-white/10 rounded-2xl p-8 shadow-2xl z-[101]"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-everlast-secondary/10 rounded-lg">
                    <Info className="w-6 h-6 text-everlast-secondary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">{t.info}</h2>
                </div>
                <button onClick={() => setShowInfo(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-8">
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
                  <h3 className="text-sm font-bold text-everlast-secondary uppercase tracking-widest">{t.shortcuts}</h3>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-sm text-gray-300">{t.shortcutRecord}</span>
                    <kbd className="px-3 py-1 bg-black rounded-md border border-white/20 text-xs font-mono text-everlast-secondary shadow-sm tracking-tighter">⌘ + Shift + Space</kbd>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowInfo(false)}
                className="w-full mt-10 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all text-white"
              >
                {t.close}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  )
}

export default Home
