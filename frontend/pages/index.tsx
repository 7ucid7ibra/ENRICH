import { useState, useEffect } from 'react'
import { Mic, MicOff, Settings, Copy, Check } from 'lucide-react'
import type { NextPage } from 'next'
import type { TranscriptionResult } from '../types/global'

interface ProcessingStatus {
  stage: 'transcribing' | 'enriching'
  message: string
}

interface RecordingStatus {
  isRecording: boolean
}

const Home: NextPage = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null)
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [availableModels, setAvailableModels] = useState<any>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Set up event listeners
      window.electronAPI.onRecordingStatus((status: RecordingStatus) => {
        setIsRecording(status.isRecording)
      })

      window.electronAPI.onProcessingStatus((status: ProcessingStatus) => {
        setProcessingStatus(status)
        setIsProcessing(true)
      })

      window.electronAPI.onTranscriptionResult((result: TranscriptionResult) => {
        setLastResult(result)
        setIsProcessing(false)
        setProcessingStatus(null)
        setError(null)
      })

      window.electronAPI.onProcessingError((errorData: { error: string }) => {
        setError(errorData.error)
        setIsProcessing(false)
        setProcessingStatus(null)
      })

      // Load available models
      loadAvailableModels()
    }
  }, [])

  const loadAvailableModels = async () => {
    try {
      if (window.electronAPI) {
        const models = await window.electronAPI.getAvailableModels()
        setAvailableModels(models)
        setActivePreset(models?.activePreset || null)
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
      console.error(error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const changePreset = async (preset: string) => {
    try {
      const result = await window.electronAPI?.setActivePreset(preset)
      if (result?.success) {
        setActivePreset(preset)
      } else {
        setError(result?.error || 'Failed to change preset')
      }
    } catch (error) {
      setError('Failed to change preset')
      console.error(error)
    }
  }

  const formatResult = (result: TranscriptionResult) => {
    const sections = []
    
    if (result.enriched.structured.corrected_text) {
      sections.push(`**Corrected Text:**\n${result.enriched.structured.corrected_text}`)
    }
    
    if (result.enriched.structured.summary) {
      sections.push(`**Summary:**\n${result.enriched.structured.summary}`)
    }
    
    if (result.enriched.structured.bullet_points?.length) {
      sections.push(`**Key Points:**\n${result.enriched.structured.bullet_points.map(point => `• ${point}`).join('\n')}`)
    }
    
    if (result.enriched.structured.key_points?.length) {
      sections.push(`**Key Points:**\n${result.enriched.structured.key_points.map(point => `• ${point}`).join('\n')}`)
    }
    
    if (result.enriched.structured.action_items?.length) {
      sections.push(`**Action Items:**\n${result.enriched.structured.action_items.map(item => `• ${item}`).join('\n')}`)
    }
    
    return sections.join('\n\n')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Voice Intelligence</h1>
            <p className="text-gray-600 mt-2">Press Cmd+Shift+Space (macOS) or Ctrl+Shift+Space (Win/Linux)</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Main Recording Interface */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex flex-col items-center">
            <button
              onClick={toggleRecording}
              disabled={isProcessing}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
            
            <div className="mt-4 text-center">
              <p className="text-lg font-medium text-gray-900">
                {isRecording ? 'Recording...' : 'Click to start recording'}
              </p>
              {isProcessing && processingStatus && (
                <p className="text-sm text-gray-600 mt-2">
                  {processingStatus.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {lastResult && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Latest Result</h2>
              <button
                onClick={() => copyToClipboard(formatResult(lastResult))}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            
            <div className="space-y-4">
              {lastResult.enriched.structured.corrected_text && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Corrected Text</h3>
                  <p className="text-gray-600">{lastResult.enriched.structured.corrected_text}</p>
                </div>
              )}
              
              {lastResult.enriched.structured.summary && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Summary</h3>
                  <p className="text-gray-600">{lastResult.enriched.structured.summary}</p>
                </div>
              )}
              
              {(lastResult.enriched.structured.bullet_points?.length || lastResult.enriched.structured.key_points?.length) && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Key Points</h3>
                  <ul className="list-disc list-inside text-gray-600">
                    {(lastResult.enriched.structured.bullet_points || lastResult.enriched.structured.key_points || []).map((point: string, index: number) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {lastResult.enriched.structured.action_items?.length && (
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Action Items</h3>
                  <ul className="list-disc list-inside text-gray-600">
                    {lastResult.enriched.structured.action_items.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Settings</h2>
            
            {availableModels && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Model Status</h3>
                  <div className="text-sm text-gray-600">
                    <p>Speech-to-Text: {availableModels.stt?.available ? 'Available' : 'Not Available'}</p>
                    <p>LLM: {availableModels.llm?.available ? 'Available' : 'Not Available'}</p>
                    <p>Active Preset: {activePreset || availableModels.activePreset}</p>
                  </div>
                </div>
                {availableModels.presets?.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Preset</h3>
                    <select
                      value={activePreset || availableModels.activePreset}
                      onChange={(event) => changePreset(event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {availableModels.presets.map((preset: string) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
