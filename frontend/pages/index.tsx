import { useState, useEffect, useRef } from 'react'
import { Settings, Copy, Check, ChevronRight } from 'lucide-react'
import type { NextPage } from 'next'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import type { TranscriptionResult } from '../types/global'

import Layout from '../components/Layout'
import StepIndicator from '../components/StepIndicator'
import MicrophoneButton from '../components/MicrophoneButton'
import ResultCard from '../components/ResultCard'
import SettingsDrawer from '../components/SettingsDrawer'

interface ProcessingStatus {
  stage: 'transcribing' | 'enriching'
  message: string
}

interface RecordingStatus {
  isRecording: boolean
}

type Step = 'record' | 'transcribe' | 'enrich'
type Language = 'de' | 'en'

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
    errorRecord: 'Fehler bei Aufnahme',
    errorEnrich: 'Fehler beim Anreichern',
    save: 'Speichern',
    saved: 'Gespeichert',
    startRecord: 'Starten',
    stopRecord: 'Aufnahme läuft',
    transcribing: 'Transkribiere Audio...',
    enriching_progress: 'Mit KI anreichern...'
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
    settings: 'Settings',
    provider: 'AI Model Provider',
    model: 'Model',
    apiKey: 'API Key',
    preset: 'Prompt Preset',
    transcriptionPlaceholder: 'Transcription will appear here...',
    errorRecord: 'Failed to record',
    errorEnrich: 'Failed to enrich',
    save: 'Save',
    saved: 'Saved',
    startRecord: 'Start',
    stopRecord: 'Recording',
    transcribing: 'Transcribing audio...',
    enriching_progress: 'Enriching with AI...'
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
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Settings State
  const [availableModels, setAvailableModels] = useState<any>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [activeOllamaModel, setActiveOllamaModel] = useState<string | null>(null)
  const [llmProvider, setLlmProvider] = useState<string>('ollama')
  const [providerModels, setProviderModels] = useState<string[]>([])
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [apiKeys, setApiKeys] = useState({ openai: '', gemini: '', opencode: '' })
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({})

  // Refs for scrolling
  const resultsRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onRecordingStatus((status: RecordingStatus) => {
        setIsRecording(status.isRecording)
        if (status.isRecording) {
          setCurrentStep('record')
          setLastResult(null)
          setRawTranscription('')
        }
      })

      window.electronAPI.onProcessingStatus((status: ProcessingStatus) => {
        let localizedMsg = status.message
        if (status.stage === 'transcribing') localizedMsg = t.transcribing
        if (status.stage === 'enriching') localizedMsg = t.enriching_progress

        setProcessingStatus({ ...status, message: localizedMsg })
        setIsProcessing(true)
        if (status.stage === 'transcribing') {
          setCurrentStep('transcribe')
        } else if (status.stage === 'enriching') {
          setCurrentStep('enrich')
        }
      })

      window.electronAPI.onTranscriptionResult((result: TranscriptionResult) => {
        setLastResult(result)
        setIsProcessing(false)
        setProcessingStatus(null)
        setError(null)
        setCurrentStep('enrich')
        // Auto scroll to results
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })

      window.electronAPI.onTranscriptionRaw((data: { text: string }) => {
        setRawTranscription(data.text || '')
        if (!isProcessing && !lastResult) {
          setCurrentStep('transcribe')
          // Auto scroll to editor
          setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })

      window.electronAPI.onProcessingError((errorData: { error: string }) => {
        setError(errorData.error)
        setIsProcessing(false)
        setProcessingStatus(null)
      })

      loadAvailableModels()
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
        setLastResult({ original: rawTranscription, enriched: response.result })
        setError(null)
        setCurrentStep('enrich')
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code', error)
    }
  }

  // --- Settings Logic ---
  const handleSaveKey = async (provider: string, key: string) => {
    let result
    if (provider === 'openai') result = await window.electronAPI?.setOpenAIKey(key)
    if (provider === 'gemini') result = await window.electronAPI?.setGeminiKey(key)
    if (provider === 'opencode') result = await window.electronAPI?.setOpenCodeKey(key)

    if (result?.success) {
      setSaveStatus(prev => ({ ...prev, [provider]: true }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [provider]: false })), 2000)
      await loadAvailableModels()
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
      {/* Header & Step Indicator */}
      <div className="flex flex-col items-center mb-8 relative z-20">
        <div className="absolute right-0 top-0 flex items-center gap-4">
          <button
            onClick={() => setLanguage(l => l === 'de' ? 'en' : 'de')}
            className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-wider"
          >
            {language}
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

      {/* Main Content Stack */}
      <div className="flex-1 flex flex-col gap-8 w-full max-w-5xl mx-auto relative z-10 pb-20">

        {/* SECTION 1: Recording (Always visible but morphs) */}
        <section className="flex flex-col items-center justify-center min-h-[40vh]">
          <MicrophoneButton
            isRecording={isRecording}
            onClick={toggleRecording}
            disabled={isProcessing}
            label={isRecording ? t.stopRecord : t.startRecord}
          />
          {isProcessing && processingStatus && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-everlast-primary text-sm mt-4 font-medium animate-pulse"
            >
              {processingStatus.message}
            </motion.p>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-lg max-w-sm text-center">
              {error}
            </div>
          )}
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

        {/* SECTION 3: Editor (Visible when transcribing or enriching) */}
        <AnimatePresence>
          {(currentStep === 'transcribe' || currentStep === 'enrich') && (
            <motion.section
              ref={editorRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-xl p-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t.transcribe}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={enrichFromText}
                    disabled={isProcessing}
                    className={clsx(
                      "group px-5 py-1.5 rounded-full text-sm font-bold tracking-wider flex items-center gap-2 transition-all duration-500",
                      "bg-[#FDFD96] text-black border-2 border-transparent shadow-[0_0_20px_rgba(253,253,150,0.2)]",
                      "hover:bg-transparent hover:text-white hover:border-[#FDFD96] hover:shadow-[0_0_25px_rgba(253,253,150,0.4),inset_0_0_15px_rgba(253,253,150,0.4)]",
                      isProcessing && "opacity-50 cursor-wait grayscale"
                    )}
                  >
                    <span>{isProcessing ? t.processing : t.enriching}</span>
                    {!isProcessing && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                  </button>
                </div>
              </div>

              <textarea
                value={rawTranscription}
                onChange={(e) => setRawTranscription(e.target.value)}
                className="w-full h-32 bg-black/20 border border-white/5 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-everlast-primary/50 resize-y"
                placeholder={t.transcriptionPlaceholder}
              />         </motion.section>
          )}
        </AnimatePresence>

      </div>

      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)}>
        <div className="space-y-8">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h3 className="text-lg font-bold text-gray-200">{t.settings}</h3>
          </div>
          {/* LLM Provider */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-500 uppercase">{t.provider}</label>
            <div className="grid grid-cols-2 gap-2">
              {['ollama', 'openai', 'gemini', 'opencode'].map(p => (
                <button
                  key={p}
                  onClick={() => window.electronAPI?.setLLMProvider(p).then(() => { setLlmProvider(p); loadAvailableModels() })}
                  className={clsx(
                    "py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                    llmProvider === p
                      ? "bg-everlast-primary/20 border-everlast-primary text-white"
                      : "bg-surface border-white/10 text-gray-400 hover:bg-white/5"
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

              {['openai', 'gemini', 'opencode'].includes(llmProvider) && (
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

              {/* Preset Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase">{t.preset}</label>
                <select
                  value={activePreset || ''}
                  onChange={(e) => {
                    const newVal = e.target.value
                    setActivePreset(newVal) // Optimistic update
                    window.electronAPI?.setActivePreset(newVal)
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none focus:border-[#FDFD96]"
                >
                  {availableModels.presets?.map((p: string) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-white/10 text-xs text-gray-600">
                Everlast Transcription v2.0
              </div>
            </div>
          )}
        </div>
      </SettingsDrawer>
    </Layout>
  )
}

export default Home
