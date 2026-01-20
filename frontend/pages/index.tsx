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
    enriching: 'Anreichern mit KI',
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
    qaAsking: 'Frage läuft...'
  },
  en: {
    record: 'Record',
    transcribe: 'Transcribe',
    enrich: 'Enrich',
    recording: 'Recording',
    start: 'Start',
    processing: 'Processing...',
    enriching: 'Enrich with AI',
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
    shortcuts: 'Shortcuts',
    close: 'Close',
    howToUse: 'Guide',
    step1: 'Click the microphone button to start recording.',
    step2: 'Speak clearly. The transcription appears after you stop recording.',
    step3: 'Click "Enrich with AI" to generate summaries and action items.',
    shortcutRecord: 'Start/Stop Recording',
    qaTitle: 'Q&A',
    qaEmpty: 'Ask questions about the transcription.',
    qaPlaceholder: 'Ask a question about the transcript...',
    qaClear: 'Clear',
    qaAsk: 'Ask',
    qaAsking: 'Asking...'
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
  const [llmProvider, setLlmProvider] = useState<string>('ollama')
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [apiKeys, setApiKeys] = useState({ openai: '', gemini: '' })
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({})

  // Refs for scrolling
  const resultsRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const tRef = useRef(t)
  const isProcessingRef = useRef(isProcessing)
  const lastResultRef = useRef(lastResult)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    isProcessingRef.current = isProcessing
    lastResultRef.current = lastResult
  }, [isProcessing, lastResult])

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

  // --- Logic Helpers ---

  const loadAvailableModels = async () => {
    try {
      if (window.electronAPI) {
        const models = await window.electronAPI.getAvailableModels()
        setAvailableModels(models)
        setActivePreset(models?.activePreset || null)
        setActiveOllamaModel(models?.llm?.activeModel || null)
        setLlmProvider(models?.llm?.provider || 'ollama')
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
      const response = await window.electronAPI?.enrichText(rawTranscription)
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
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 w-full bg-everlast-bg/90 backdrop-blur-md border-b border-white/5">
        <div className="relative max-w-5xl mx-auto px-6 py-6 flex flex-col items-center">
          <div className="absolute right-0 top-0 flex items-center gap-4">
          <button
            onClick={() => setLanguage(l => l === 'de' ? 'en' : 'de')}
            className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-wider"
          >
            {language}
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <Info className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <Settings className="w-5 h-5" />
          </button>
          </div>
          <h1 className="text-xl font-bold tracking-widest mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">
            EVERLAST ENRICHMENT
          </h1>
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

      {/* Main Content Stack */}
      <div className="flex-1 flex flex-col gap-8 w-full max-w-5xl mx-auto relative z-10 pb-20">

        {/* SECTION 1: Composer (Text + Record) */}
        <section ref={editorRef} className="glass-panel rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.transcribe}
                </h3>
                <button
                  onClick={enrichFromText}
                  disabled={isProcessing || !rawTranscription.trim()}
                  className={clsx(
                    "group px-5 py-1.5 rounded-full text-sm font-bold tracking-wider flex items-center gap-2 transition-all duration-500",
                    "bg-[#FDFD96] text-black border-2 border-transparent shadow-[0_0_20px_rgba(253,253,150,0.2)]",
                    "hover:bg-transparent hover:text-white hover:border-[#FDFD96] hover:shadow-[0_0_25px_rgba(253,253,150,0.4),inset_0_0_15px_rgba(253,253,150,0.4)]",
                    (isProcessing || !rawTranscription.trim()) && "opacity-50 cursor-not-allowed grayscale"
                  )}
                >
                  <span>{isProcessing ? t.processing : t.enriching}</span>
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </div>
              <textarea
                value={rawTranscription}
                onChange={(e) => setRawTranscription(e.target.value)}
                className="w-full h-36 bg-black/20 border border-white/5 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-everlast-primary/50 resize-y"
                placeholder={t.transcriptionPlaceholder}
              />
              {isProcessing && processingStatus && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-everlast-primary text-sm mt-3 font-medium animate-pulse"
                >
                  {processingStatus.message}
                </motion.p>
              )}
              {error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-lg">
                  {error}
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <MicrophoneButton
                isRecording={isRecording}
                onClick={toggleRecording}
                disabled={isProcessing}
                label={isRecording ? t.stopRecord : t.startRecord}
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: Results Area (Conditionally visible) */}
        <AnimatePresence>
          {currentStep === 'enrich' && lastResult && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Corrected Text REMOVED per user request */}

              {lastResult.enriched?.structured?.summary && (
                <ResultCard title={t.summary} className="col-span-1" delay={0.2}>
                  {lastResult.enriched.structured.summary}
                </ResultCard>
              )}

              {(lastResult.enriched?.structured?.bullet_points?.length || 0) > 0 && (
                <ResultCard title={t.keyPoints} className="col-span-1" delay={0.3}>
                  <ul className="list-disc list-outside ml-4 space-y-1 text-gray-300">
                    {(lastResult.enriched.structured.bullet_points || []).map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </ResultCard>
              )}

              {(lastResult.enriched?.structured?.action_items?.length || 0) > 0 && (
                <ResultCard title={t.actionItems} className="col-span-1 border-l-4 border-l-everlast-secondary" delay={0.4}>
                  <ul className="space-y-2">
                    {(lastResult.enriched.structured.action_items || []).map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-everlast-secondary flex-shrink-0" />
                        <span className="text-gray-200">{item}</span>
                      </li>
                    ))}
                  </ul>
                </ResultCard>
              )}

              {/* Copy All Button */}
              <div className="col-span-full flex justify-end">
                <button
                  onClick={() => copyToClipboard(formatFullResult(lastResult))}
                  className="flex items-center gap-2 text-xs text-everlast-text-muted hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? t.copied : t.copyAll}</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 3: Q&A */}
        <AnimatePresence>
          {currentStep === 'enrich' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-xl p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.qaTitle}
                </h3>
                <button
                  onClick={() => {
                    setChatMessages([])
                    updateHistoryChat([])
                  }}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {t.qaClear}
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t.qaEmpty}
                  </p>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={`${msg.role}-${index}`}
                      className={clsx(
                        'p-3 rounded-lg text-sm',
                        msg.role === 'user'
                          ? 'bg-white/5 text-gray-200'
                          : 'bg-everlast-secondary/10 text-gray-100 border border-everlast-secondary/20'
                      )}
                    >
                      {msg.content}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      askQuestion()
                    }
                  }}
                  placeholder={t.qaPlaceholder}
                  className="flex-1 bg-black/20 border border-white/5 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-everlast-primary/50"
                />
                <button
                  onClick={askQuestion}
                  disabled={chatBusy || !chatInput.trim()}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                    'bg-everlast-secondary text-black hover:bg-[#ffd060]',
                    (chatBusy || !chatInput.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {chatBusy ? t.qaAsking : t.qaAsk}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

      </div>

      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} title={t.settings}>
        <div className="space-y-8">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-gray-200">{t.settings}</h3>
          </div>
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
