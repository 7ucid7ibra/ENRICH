const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');

let recording = null;
let audioChunks = [];
let stopping = false;

class AudioRecorder {
  constructor() {
    this.sampleRate = 16000;
    this.channels = 1;
    this.audioFormat = 'S16_LE';
  }

  async startRecording(options = {}) {
    try {
      if (recording) {
        console.warn('Recording already in progress');
        return false;
      }
      console.log('Starting audio recording...');
      stopping = false;
      audioChunks = [];
      const onData = options?.onData;
      const audioType = options?.audioType || 'wav';
      const silence = options?.silence;
      
      recording = record.record({
        sampleRateHertz: this.sampleRate,
        threshold: 0,
        verbose: false,
        recordProgram: process.env.RECORD_PROGRAM || 'sox',
        silence: silence !== undefined ? silence : '1.0',
        channels: this.channels,
        audioType: audioType
      });

      const stream = recording.stream();
      stream.on('data', (chunk) => {
        audioChunks.push(chunk);
        if (typeof onData === 'function') {
          onData(chunk);
        }
      });

      const handleError = (error) => {
        if (stopping) {
          console.warn('Recording stopped with error:', error?.message || error);
          return;
        }
        console.error('Recording error:', error);
      };

      stream.on('error', handleError);
      recording.on?.('error', handleError);
      const proc = recording.process || recording.childProcess;
      proc?.on?.('error', handleError);

      console.log('Recording started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!recording) {
        reject(new Error('No recording in progress'));
        return;
      }

      console.log('Stopping recording...');
      stopping = true;

      const stream = recording.stream();
      let resolved = false;
      const finalize = () => {
        if (resolved) return;
        resolved = true;

        const audioBuffer = Buffer.concat(audioChunks);
        recording = null;
        stopping = false;
        audioChunks = [];
        console.log(`Recording stopped. Audio size: ${audioBuffer.length} bytes`);
        resolve(audioBuffer);
      };

      if (stream) {
        stream.once('close', finalize);
        stream.once('end', finalize);
      }

      recording.stop();

      const proc = recording.process || recording.childProcess;
      if (proc && proc.pid) {
        proc.once?.('exit', finalize);
        proc.once?.('close', finalize);
        setTimeout(() => {
          if (!resolved) {
            try {
              proc.kill('SIGKILL');
            } catch (error) {
              console.warn('Failed to kill recording process:', error);
            }
            finalize();
          }
        }, 800);
      } else {
        setTimeout(finalize, 300);
      }

      if (stream) {
        stream.removeAllListeners('data');
        stream.removeAllListeners('error');
        setTimeout(() => {
          try {
            stream.destroy();
          } catch (error) {
            console.warn('Failed to destroy audio stream:', error);
          }
        }, 200);
      }
    });
  }

  // Alternative method using Web Audio API through renderer process
  async saveAudioToFile(audioBuffer, filename) {
    const tempDir = path.join(require('os').tmpdir(), 'enrich');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, audioBuffer);
    
    return filePath;
  }
}

module.exports = new AudioRecorder();
