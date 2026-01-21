const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');

const resolveBundledPiperRoot = () => {
  const resourcesPath = process.resourcesPath || '';
  const packagedRoot = resourcesPath ? path.join(resourcesPath, 'piper') : null;
  if (packagedRoot && fs.existsSync(packagedRoot)) {
    return packagedRoot;
  }
  return path.join(__dirname, '..', 'assets', 'piper');
};

const bundledPiperRoot = resolveBundledPiperRoot();
const voicesPath = process.env.PIPER_VOICES_PATH || path.join(bundledPiperRoot, 'voices.json');
const defaultLangMap = {
  de: 'de',
  en: 'en'
};
const preferredVoiceByLang = {
  de: 'de_DE-thorsten-medium',
  en: 'en_US-ryan-medium'
};
const selectedVoiceByLang = {};

const resolveVoices = () => {
  if (!fs.existsSync(voicesPath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(voicesPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.voices) ? data.voices : [];
  } catch (error) {
    return [];
  }
};

const resolveVoiceForLanguage = (language = 'en') => {
  const voices = resolveVoices();
  if (!voices.length) {
    return null;
  }
  const normalized = String(language || 'en').toLowerCase();
  if (selectedVoiceByLang[normalized]) {
    const selected = voices.find((voice) => voice.voice_id === selectedVoiceByLang[normalized]);
    if (selected) {
      return selected;
    }
  }
  const preferred = preferredVoiceByLang[normalized];
  if (preferred) {
    const matchedPreferred = voices.find((voice) => voice.voice_id === preferred);
    if (matchedPreferred) {
      return matchedPreferred;
    }
  }
  const matchPrefix = defaultLangMap[normalized] || normalized;
  const matched = voices.find((voice) => {
    const lang = String(voice.language || '').toLowerCase();
    return lang.startsWith(matchPrefix);
  });
  return matched || voices[0];
};

const resolvePiperCmd = () => {
  if (process.env.PIPER_PATH && fs.existsSync(process.env.PIPER_PATH)) {
    return process.env.PIPER_PATH;
  }
  const candidates = process.platform === 'win32'
    ? [
        path.join(bundledPiperRoot, 'piper.exe'),
        path.join(bundledPiperRoot, 'bin', 'piper.exe')
      ]
    : [
        path.join(bundledPiperRoot, 'piper'),
        path.join(bundledPiperRoot, 'bin', 'piper')
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'piper';
};

const resolvePiperLibDir = (piperCmd) => {
  const cmdPath = path.resolve(piperCmd);
  const candidates = [
    path.join(bundledPiperRoot, 'lib'),
    path.join(path.dirname(cmdPath), 'lib'),
    path.join(path.dirname(path.dirname(cmdPath)), 'lib')
  ];
  const libName = process.platform === 'darwin' ? 'libespeak-ng.1.dylib' : null;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    if (libName && !fs.existsSync(path.join(candidate, libName))) {
      continue;
    }
    return candidate;
  }
  return null;
};

const buildPiperEnv = (piperCmd) => {
  const env = { ...process.env };
  const libDir = resolvePiperLibDir(piperCmd);
  if (!libDir) {
    return env;
  }
  if (process.platform === 'win32') {
    env.PATH = `${libDir}${path.delimiter}${env.PATH || ''}`;
  } else if (process.platform === 'darwin') {
    env.DYLD_LIBRARY_PATH = `${libDir}${path.delimiter}${env.DYLD_LIBRARY_PATH || ''}`;
  } else {
    env.LD_LIBRARY_PATH = `${libDir}${path.delimiter}${env.LD_LIBRARY_PATH || ''}`;
  }
  return env;
};

const synthesize = async (text, options = {}) => {
  if (!text || typeof text !== 'string') {
    throw new Error('No text provided for TTS.');
  }
  const voice = resolveVoiceForLanguage(options.language);
  if (!voice) {
    throw new Error('No Piper voices found. Check voices.json.');
  }
  const voicesDir = path.dirname(voicesPath);
  const modelPath = path.resolve(voicesDir, voice.model_path);
  const configPath = voice.config_path ? path.resolve(voicesDir, voice.config_path) : null;
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Piper model not found: ${modelPath}`);
  }
  if (configPath && !fs.existsSync(configPath)) {
    throw new Error(`Piper config not found: ${configPath}`);
  }

  const outputDir = path.join(os.tmpdir(), 'voice-intelligence', 'tts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `tts_${Date.now()}.wav`);
  const args = ['--model', modelPath, '--output_file', outputPath];
  if (configPath) {
    args.push('--config', configPath);
  }

  return new Promise((resolve, reject) => {
    const cmd = resolvePiperCmd();
    const env = buildPiperEnv(cmd);
    const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'], env });
    let errorOutput = '';

    proc.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    proc.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('Piper not found. Bundle it in assets/piper or set PIPER_PATH.'));
        return;
      }
      reject(new Error(`Failed to run Piper: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput.trim() || 'Piper failed to synthesize audio.'));
        return;
      }
      if (!fs.existsSync(outputPath)) {
        reject(new Error('Piper completed but audio file was not created.'));
        return;
      }
      resolve(outputPath);
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
};

module.exports = {
  synthesize,
  resolveVoices,
  resolveVoiceForLanguage,
  setVoiceForLanguage: (language, voiceId) => {
    if (!language || !voiceId) {
      return false;
    }
    selectedVoiceByLang[String(language).toLowerCase()] = voiceId;
    return true;
  },
  getVoiceForLanguage: (language) => {
    const normalized = String(language || 'en').toLowerCase();
    return selectedVoiceByLang[normalized] || preferredVoiceByLang[normalized] || null;
  }
};
