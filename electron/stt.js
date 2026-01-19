const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SpeechToText {
  constructor() {
    this.whisperPath = null; // Path to whisper.cpp executable
    this.modelPath = null;   // Path to model file
    this.modelName = (process.env.WHISPER_MODEL || 'small').toLowerCase();
    this.tempDir = path.join(require('os').tmpdir(), 'voice-intelligence');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async initialize() {
    // Try to find whisper.cpp installation
    const envWhisperPath = process.env.WHISPER_PATH;
    const possiblePaths = [
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper',
      path.join(process.env.HOME || '', '.local/bin/whisper'),
      './whisper.cpp/main',
      './whisper.cpp/whisper',
      './whisper.cpp/build/bin/whisper-cli',
      './whisper.cpp/build/bin/main'
    ];

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
      if (!this.whisperPath || !this.modelPath) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Whisper is not initialized. Check installation and model path.');
        }
      }

      // Save audio buffer to temporary file
      const audioFile = path.join(this.tempDir, `recording_${Date.now()}.wav`);
      const outputBase = audioFile.replace(/\.wav$/, '');
      const outputTextFile = `${outputBase}.txt`;
      const normalizedBuffer = this.ensureWavHeader(audioBuffer);
      fs.writeFileSync(audioFile, normalizedBuffer);

      // Prepare whisper command
      const args = [
        '-m', this.modelPath,
        '-f', audioFile,
        '-of', outputBase,
        '-l', 'auto',        // Auto-detect language
        '-otxt',             // Output text only
        '--no-timestamps'    // Don't include timestamps
      ];
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
      
      const timeoutMs = Number(process.env.WHISPER_TIMEOUT_MS || 120000);
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
