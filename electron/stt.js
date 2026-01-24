const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const WebSocket = require('ws');

class SpeechToText {
  constructor() {
    this.whisperPath = null; // Path to whisper.cpp executable
    this.modelPath = null;   // Path to model file
    this.modelName = (process.env.WHISPER_MODEL || 'small').toLowerCase();
    this.activeProvider = (process.env.STT_PROVIDER || 'whisper').toLowerCase();
    this.whisperEngine = (process.env.WHISPER_ENGINE || 'faster-whisper').toLowerCase();
    this.deepgramKey = process.env.DEEPGRAM_API_KEY || null;
    this.tempDir = path.join(require('os').tmpdir(), 'enrich');
    this.streamState = null;
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize() {
    if (this.activeProvider === 'deepgram') {
      return Boolean(this.deepgramKey);
    }
    if (this.whisperEngine === 'faster-whisper') {
      return Boolean(this.resolveFasterWhisperPython());
    }
    const resourcesPath = process.resourcesPath || '';
    const bundledWhisperRoot = resourcesPath ? path.join(resourcesPath, 'whisper') : null;
    // Try to find whisper.cpp installation
    const envWhisperPath = process.env.WHISPER_PATH;
    const possiblePaths = [
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper',
      path.join(process.env.HOME || '', '.local/bin/whisper'),
      bundledWhisperRoot ? path.join(bundledWhisperRoot, 'whisper-cli') : null,
      './whisper.cpp/main',
      './whisper.cpp/whisper',
      './whisper.cpp/build/bin/whisper-cli',
      './whisper.cpp/build/bin/main'
    ].filter(Boolean);

    if (envWhisperPath && fs.existsSync(envWhisperPath)) {
      this.whisperPath = envWhisperPath;
    }

    for (const whisperPath of possiblePaths) {
      if (this.whisperPath) {
        break;
      }
      if (fs.existsSync(whisperPath)) {
        this.whisperPath = whisperPath;
        break;
      }
    }

    if (!this.whisperPath) {
      console.warn('Whisper.cpp not found. Please install whisper.cpp');
      return false;
    }

    // Set default model path
    const modelFile = `ggml-${this.modelName}.bin`;
    const envModelPath = process.env.WHISPER_MODEL_PATH;
    const possibleModelPaths = [
      envModelPath,
      bundledWhisperRoot ? path.join(bundledWhisperRoot, 'models', modelFile) : null,
      path.join(process.env.HOME || '', '.whisper', modelFile),
      path.join(process.env.HOME || '', 'whisper.cpp', 'models', modelFile),
      path.join(process.cwd(), 'whisper.cpp', 'models', modelFile)
    ].filter(Boolean);

    for (const modelPath of possibleModelPaths) {
      if (fs.existsSync(modelPath)) {
        this.modelPath = modelPath;
        break;
      }
    }
    
    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      console.warn(`Whisper model not found for '${this.modelName}'. Please download the model`);
      return false;
    }

    return true;
  }

  async transcribe(audioBuffer) {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        if (this.activeProvider === 'deepgram') {
          throw new Error('Deepgram API key not configured.');
        }
        if (this.whisperEngine === 'faster-whisper') {
          throw new Error('Faster-Whisper is not available. Run scripts/setup-faster-whisper.sh or set WHISPER_ENGINE=whisper.cpp.');
        }
        throw new Error('Whisper is not initialized. Check installation and model path.');
      }

      // Save audio buffer to temporary file
      const audioFile = path.join(this.tempDir, `recording_${Date.now()}.wav`);
      const outputBase = audioFile.replace(/\.wav$/, '');
      const outputTextFile = `${outputBase}.txt`;
      const normalizedBuffer = this.ensureWavHeader(audioBuffer);
      this.logWavHeader(normalizedBuffer);
      const tunedBuffer = this.normalizeAudio(normalizedBuffer);
      fs.writeFileSync(audioFile, tunedBuffer);
      const sampleBytes = normalizedBuffer.length > 44 ? (normalizedBuffer.length - 44) : normalizedBuffer.length;
      const durationSec = Math.max(0, sampleBytes / (16000 * 2));
      if (this.activeProvider === 'deepgram') {
        const transcript = await this.transcribeWithDeepgram(normalizedBuffer, durationSec);
        if (process.env.WHISPER_KEEP_FILES !== '1') {
          try {
            fs.unlinkSync(audioFile);
          } catch (error) {
            console.warn('Failed to clean up temp file:', error);
          }
        }
        return transcript;
      }

      if (this.whisperEngine === 'faster-whisper') {
        const transcript = await this.transcribeWithFasterWhisper(audioFile);
        if (process.env.WHISPER_KEEP_FILES !== '1') {
          try {
            fs.unlinkSync(audioFile);
          } catch (error) {
            console.warn('Failed to clean up temp file:', error);
          }
        }
        return transcript;
      }

      // Prepare whisper.cpp command
      const args = [
        '-m', this.modelPath,
        '-f', audioFile,
        '-of', outputBase,
        '-l', 'auto',        // Auto-detect language
        '-otxt',             // Output text only
        '--no-timestamps'    // Don't include timestamps
      ];
      const defaultWhisperArgs = ['--beam-size', '5', '--best-of', '5', '--temperature', '0.0'];
      args.push(...defaultWhisperArgs);
      if (process.env.WHISPER_NO_GPU === '1') {
        args.push('--no-gpu');
      }
      if (process.env.WHISPER_THREADS) {
        args.push('-t', process.env.WHISPER_THREADS);
      }
      if (process.env.WHISPER_EXTRA_ARGS) {
        const extraArgs = process.env.WHISPER_EXTRA_ARGS.split(' ').filter(Boolean);
        args.push(...extraArgs);
      }

      console.log('Running Whisper transcription:', this.whisperPath, args.join(' '));
      console.log(`Audio size: ${normalizedBuffer.length} bytes`);
      
      const realtimeFactor = Number(process.env.WHISPER_RT_FACTOR || 3);
      const dynamicTimeoutMs = Math.ceil(durationSec * 1000 * realtimeFactor);
      const baseTimeoutMs = Number(process.env.WHISPER_TIMEOUT_MS || 600000);
      const timeoutMs = Math.max(baseTimeoutMs, dynamicTimeoutMs);
      return new Promise((resolve, reject) => {
        const whisper = spawn(this.whisperPath, args);
        let output = '';
        let errorOutput = '';
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          whisper.kill('SIGKILL');
        }, timeoutMs);

        whisper.stdout.on('data', (data) => {
          output += data.toString();
        });

        whisper.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        whisper.on('close', (code) => {
          clearTimeout(timer);
          // Clean up temporary file
          if (process.env.WHISPER_KEEP_FILES !== '1') {
            try {
              fs.unlinkSync(audioFile);
            } catch (error) {
              console.warn('Failed to clean up temp file:', error);
            }
          }

          if (timedOut) {
            const hint = errorOutput ? ` ${errorOutput.trim()}` : '';
            reject(new Error(`Whisper timed out. Check audio input or model setup.${hint}`));
            return;
          }

          if (code === 0) {
            let transcription = '';
            try {
              if (fs.existsSync(outputTextFile)) {
                transcription = fs.readFileSync(outputTextFile, 'utf8').trim();
              }
            } catch (readError) {
              console.warn('Failed to read transcription file:', readError);
            }
            if (!transcription) {
              console.warn('Whisper returned empty transcription');
            }
            console.log('Transcription completed:', transcription);
            resolve(transcription);
          } else {
            console.error('Whisper failed:', errorOutput);
            reject(new Error(`Whisper transcription failed: ${errorOutput}`));
          }

          if (process.env.WHISPER_KEEP_FILES !== '1') {
            try {
              if (fs.existsSync(outputTextFile)) {
                fs.unlinkSync(outputTextFile);
              }
            } catch (cleanupError) {
              console.warn('Failed to clean up output file:', cleanupError);
            }
          }
        });

        whisper.on('error', (error) => {
          clearTimeout(timer);
          if (process.env.WHISPER_KEEP_FILES !== '1') {
            try {
              fs.unlinkSync(audioFile);
            } catch (cleanupError) {
              console.warn('Failed to clean up temp file:', cleanupError);
            }
            try {
              if (fs.existsSync(outputTextFile)) {
                fs.unlinkSync(outputTextFile);
              }
            } catch (cleanupError) {
              console.warn('Failed to clean up output file:', cleanupError);
            }
          }
          reject(new Error(`Failed to run Whisper: ${error.message}`));
        });
      });

    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  resolveFasterWhisperPython() {
    const resourcesPath = process.resourcesPath || '';
    const bundledRoot = resourcesPath ? path.join(resourcesPath, 'faster-whisper') : null;
    const candidates = [
      process.env.FASTER_WHISPER_PYTHON,
      bundledRoot ? path.join(bundledRoot, 'venv', 'bin', 'python') : null,
      path.join(process.cwd(), 'assets', 'faster-whisper', 'venv', 'bin', 'python'),
      path.join(process.cwd(), 'assets', 'faster-whisper', 'venv', 'bin', 'python3'),
      path.join(process.cwd(), 'assets', 'faster-whisper', 'venv', 'bin', 'python3.11')
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  async transcribeWithFasterWhisper(audioFile) {
    const pythonPath = this.resolveFasterWhisperPython();
    if (!pythonPath) {
      throw new Error('Faster-Whisper python not found. Install in assets/faster-whisper/venv or set FASTER_WHISPER_PYTHON.');
    }
    const scriptPath = path.join(__dirname, 'fw_runner.py');
    const resourcesPath = process.resourcesPath || '';
    const bundledRoot = resourcesPath ? path.join(resourcesPath, 'faster-whisper') : null;
    const bundledModelPath = bundledRoot ? path.join(bundledRoot, 'models', 'base') : null;
    const devModelPath = path.join(process.cwd(), 'assets', 'faster-whisper', 'models', 'base');
    const modelPath = process.env.WHISPER_FW_MODEL_PATH
      || (bundledModelPath && fs.existsSync(bundledModelPath) ? bundledModelPath : null)
      || (fs.existsSync(devModelPath) ? devModelPath : null);
    const env = {
      ...process.env,
      WHISPER_FW_LANGUAGE: process.env.WHISPER_LANGUAGE || '',
      WHISPER_FW_MODEL_PATH: modelPath || ''
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, audioFile], { stdio: ['ignore', 'pipe', 'pipe'], env });
      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to run faster-whisper: ${error.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(errorOutput.trim() || 'Faster-Whisper failed to transcribe audio.'));
          return;
        }
        resolve(output.trim());
      });
    });
  }

  ensureWavHeader(buffer) {
    const sampleRate = 16000;
    const channels = 1;
    const bitDepth = 16;
    const blockAlign = (channels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;

    const buildHeader = (dataSize) => {
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + dataSize, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(channels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(byteRate, 28);
      header.writeUInt16LE(blockAlign, 32);
      header.writeUInt16LE(bitDepth, 34);
      header.write('data', 36);
      header.writeUInt32LE(dataSize, 40);
      return header;
    };

    if (buffer.length >= 12) {
      const riff = buffer.toString('ascii', 0, 4);
      const wave = buffer.toString('ascii', 8, 12);
      if (riff === 'RIFF' && wave === 'WAVE') {
        const dataChunkIndex = buffer.indexOf('data');
        if (dataChunkIndex !== -1 && dataChunkIndex + 8 <= buffer.length) {
          const dataSize = buffer.readUInt32LE(dataChunkIndex + 4);
          const dataStart = dataChunkIndex + 8;
          const available = buffer.length - dataStart;
          const sizeLooksInvalid = dataSize === 0 || dataSize === 0xffffffff || dataSize > available;
          if (!sizeLooksInvalid) {
            return buffer;
          }
          const pcmData = buffer.slice(dataStart);
          const header = buildHeader(pcmData.length);
          return Buffer.concat([header, pcmData]);
        }
        const fallbackPcm = buffer.slice(44);
        const header = buildHeader(fallbackPcm.length);
        return Buffer.concat([header, fallbackPcm]);
      }
    }

    const header = buildHeader(buffer.length);
    return Buffer.concat([header, buffer]);
  }

  normalizeAudio(buffer) {
    if (buffer.length < 44) {
      return buffer;
    }
    const riff = buffer.toString('ascii', 0, 4);
    const wave = buffer.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      return buffer;
    }
    const audioFormat = buffer.readUInt16LE(20);
    const bitDepth = buffer.readUInt16LE(34);
    if (audioFormat !== 1 || bitDepth !== 16) {
      return buffer;
    }
    const dataIndex = buffer.indexOf('data');
    if (dataIndex === -1 || dataIndex + 8 > buffer.length) {
      return buffer;
    }
    const dataSize = buffer.readUInt32LE(dataIndex + 4);
    const dataStart = dataIndex + 8;
    const available = buffer.length - dataStart;
    const pcmLength = Math.min(dataSize || available, available);
    if (pcmLength < 2) {
      return buffer;
    }
    let peak = 0;
    const sampleCount = Math.floor(pcmLength / 2);
    for (let i = 0; i < sampleCount; i += 1) {
      const sample = buffer.readInt16LE(dataStart + i * 2) / 32768;
      const abs = Math.abs(sample);
      if (abs > peak) {
        peak = abs;
      }
    }
    if (!peak || peak >= 0.2) {
      return buffer;
    }
    const gain = Math.min(0.8 / peak, 10);
    const tuned = Buffer.from(buffer);
    for (let i = 0; i < sampleCount; i += 1) {
      const offset = dataStart + i * 2;
      const sample = tuned.readInt16LE(offset);
      let next = Math.round(sample * gain);
      if (next > 32767) next = 32767;
      if (next < -32768) next = -32768;
      tuned.writeInt16LE(next, offset);
    }
    console.log(`Applied audio gain: ${gain.toFixed(2)}x`);
    return tuned;
  }

  logWavHeader(buffer) {
    if (buffer.length < 44) {
      console.log(`WAV header: buffer too short (${buffer.length} bytes)`);
      return;
    }
    const riff = buffer.toString('ascii', 0, 4);
    const wave = buffer.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      console.log('WAV header: missing RIFF/WAVE');
      return;
    }
    const audioFormat = buffer.readUInt16LE(20);
    const channels = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const bitDepth = buffer.readUInt16LE(34);
    const dataIndex = buffer.indexOf('data');
    const dataSize = dataIndex !== -1 && dataIndex + 8 <= buffer.length
      ? buffer.readUInt32LE(dataIndex + 4)
      : null;
    console.log(`WAV header: format=${audioFormat} channels=${channels} rate=${sampleRate} depth=${bitDepth} dataSize=${dataSize ?? 'n/a'}`);
  }

  async transcribeWithDeepgram(audioBuffer, durationSec) {
    if (!this.deepgramKey) {
      throw new Error('Deepgram API key not configured.');
    }
    const model = process.env.DEEPGRAM_MODEL || 'nova-2';
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true`;
    const realtimeFactor = Number(process.env.DEEPGRAM_RT_FACTOR || 2);
    const dynamicTimeoutMs = Math.ceil(durationSec * 1000 * realtimeFactor);
    const baseTimeoutMs = Number(process.env.DEEPGRAM_TIMEOUT_MS || 600000);
    const timeoutMs = Math.max(baseTimeoutMs, dynamicTimeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.deepgramKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer,
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Deepgram request failed: ${response.status} ${response.statusText} ${body}`.trim());
      }

      const result = await response.json();
      return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Deepgram timed out. Check audio input or model setup.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async startStreaming(onUpdate) {
    if (!this.deepgramKey) {
      throw new Error('Deepgram API key not configured.');
    }
    if (this.streamState?.ws) {
      return;
    }
    const model = process.env.DEEPGRAM_MODEL || 'nova-2';
    const params = new URLSearchParams({
      model,
      smart_format: 'true',
      punctuate: 'true',
      interim_results: 'true',
      endpointing: '300',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1'
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${this.deepgramKey}`
      }
    });
    this.streamState = {
      ws,
      onUpdate,
      finalTranscript: '',
      interimTranscript: '',
      lastCombined: '',
      queue: [],
      open: false,
      closed: false,
      closeResolver: null,
      closeRejecter: null
    };

    ws.on('open', () => {
      if (!this.streamState) return;
      this.streamState.open = true;
      const queued = this.streamState.queue || [];
      queued.forEach((chunk) => ws.send(chunk));
      this.streamState.queue = [];
    });

    ws.on('message', (data) => {
      if (!this.streamState) return;
      let payload;
      try {
        payload = JSON.parse(data.toString());
      } catch (error) {
        return;
      }
      const alt = payload?.channel?.alternatives?.[0];
      const transcript = alt?.transcript || '';
      if (!transcript) {
        return;
      }
      if (payload.is_final) {
        if (this.streamState.finalTranscript) {
          this.streamState.finalTranscript += ` ${transcript}`;
        } else {
          this.streamState.finalTranscript = transcript;
        }
        this.streamState.interimTranscript = '';
      } else {
        this.streamState.interimTranscript = transcript;
      }
      const combined = [this.streamState.finalTranscript, this.streamState.interimTranscript]
        .filter(Boolean)
        .join(' ')
        .trim();
      this.streamState.lastCombined = combined;
      if (typeof this.streamState.onUpdate === 'function') {
        this.streamState.onUpdate(combined, payload.is_final);
      }
    });

    ws.on('close', () => {
      if (!this.streamState) return;
      this.streamState.closed = true;
      if (typeof this.streamState.closeResolver === 'function') {
        const finalText = (this.streamState.finalTranscript || this.streamState.lastCombined || '').trim();
        this.streamState.closeResolver(finalText);
      }
      this.streamState = null;
    });

    ws.on('error', (error) => {
      if (!this.streamState) return;
      if (typeof this.streamState.closeRejecter === 'function') {
        this.streamState.closeRejecter(error);
      }
      this.streamState = null;
    });
  }

  sendStreamingAudio(chunk) {
    if (!this.streamState?.ws) {
      return;
    }
    if (!this.streamState.open) {
      this.streamState.queue.push(chunk);
      return;
    }
    this.streamState.ws.send(chunk);
  }

  async stopStreaming() {
    if (!this.streamState?.ws) {
      return '';
    }
    const ws = this.streamState.ws;
    return new Promise((resolve, reject) => {
      this.streamState.closeResolver = resolve;
      this.streamState.closeRejecter = reject;
      try {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch (error) {
        reject(error);
        return;
      }
      const safety = setTimeout(() => {
        if (this.streamState && !this.streamState.closed) {
          try {
            ws.close();
          } catch (closeError) {
            // ignore
          }
        }
      }, 5000);
      const finalize = (transcript) => {
        clearTimeout(safety);
        resolve(transcript || (this.streamState?.lastCombined || ''));
      };
      this.streamState.closeResolver = finalize;
    });
  }

  setActiveProvider(providerName) {
    if (!providerName || typeof providerName !== 'string') {
      return false;
    }
    const normalized = providerName.toLowerCase();
    const allowed = new Set(['whisper', 'deepgram']);
    if (!allowed.has(normalized)) {
      return false;
    }
    this.activeProvider = normalized;
    return true;
  }

  setDeepgramKey(apiKey) {
    if (apiKey && typeof apiKey === 'string') {
      this.deepgramKey = apiKey;
      process.env.DEEPGRAM_API_KEY = apiKey;
      return true;
    }
    return false;
  }

  // Fallback method using OpenAI Whisper API if local fails
  async transcribeWithAPI(audioBuffer) {
    try {
      const FormData = require('form-data');
      const fetch = require('node-fetch');
      
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.text;
    } catch (error) {
      console.error('API transcription error:', error);
      throw error;
    }
  }
}

module.exports = new SpeechToText();
