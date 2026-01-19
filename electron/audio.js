const record = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');

let recording = null;
let audioChunks = [];

class AudioRecorder {
  constructor() {
    this.sampleRate = 16000;
    this.channels = 1;
    this.audioFormat = 'S16_LE';
  }

  async startRecording() {
    try {
      console.log('Starting audio recording...');
      audioChunks = [];
      
      recording = record.record({
        sampleRateHertz: this.sampleRate,
        threshold: 0,
        verbose: false,
        recordProgram: 'rec', // or 'sox'
        silence: '1.0',
        channels: this.channels,
        audioType: 'wav'
      });

      recording.stream().on('data', (chunk) => {
        audioChunks.push(chunk);
      });

      recording.stream().on('error', (error) => {
        console.error('Recording error:', error);
        throw error;
      });

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
      
      recording.stop();
      
      // Combine all audio chunks
      const audioBuffer = Buffer.concat(audioChunks);
      
      recording = null;
      audioChunks = [];
      
      console.log(`Recording stopped. Audio size: ${audioBuffer.length} bytes`);
      resolve(audioBuffer);
    });
  }

  // Alternative method using Web Audio API through renderer process
  async saveAudioToFile(audioBuffer, filename) {
    const tempDir = path.join(require('os').tmpdir(), 'voice-intelligence');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, audioBuffer);
    
    return filePath;
  }
}

module.exports = new AudioRecorder();
