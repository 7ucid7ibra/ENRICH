const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 600000);

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_LLM_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { signal, ...rest } = options;
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

class LLMProcessor {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    this.activeProvider = process.env.LLM_PROVIDER || 'opencode';
    this.defaultModel = process.env.OLLAMA_MODEL || 'mistral';
    this.activeModel = this.defaultModel;
    this.presetsDir = path.join(__dirname, '../presets');
    this.activePreset = 'quick_notes';
    this.outputLanguage = (process.env.LLM_OUTPUT_LANGUAGE || 'de').toLowerCase();
    this.opencodeModels = [
      'grok-code',
      'big-pickle',
      'minimax-m2.1-free',
      'glm-4.7-free'
    ];
  }

  async initialize() {
    if (this.activeProvider === 'ollama') {
      return this.ensureOllamaRunning(true);
    }
    if (this.activeProvider === 'openai') {
      return Boolean(process.env.OPENAI_API_KEY);
    }
    if (this.activeProvider === 'gemini') {
      return Boolean(process.env.GEMINI_API_KEY);
    }
    if (this.activeProvider === 'opencode') {
      return true;
    }
    return false;
  }

  async getOllamaModels() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models.map(m => m.name);
    } catch (error) {
      return [];
    }
  }

  async enrich(text, presetName = null, options = {}) {
    const preset = presetName || this.activePreset;
    const presetConfig = this.loadPreset(preset);
    
    if (!presetConfig) {
      throw new Error(`Preset '${preset}' not found`);
    }

    try {
      if (options.outputLanguage) {
        this.setOutputLanguage(options.outputLanguage);
      }
      const maxChars = Number(process.env.LLM_MAX_INPUT_CHARS || 6000);
      const trimmedText = text && text.length > maxChars ? text.slice(0, maxChars) : text;
      if (this.activeProvider === 'ollama') {
        if (!(await this.ensureOllamaRunning(true))) {
          throw new Error('Ollama is not reachable. Start it with "ollama serve".');
        }
        return await this.enrichWithOllama(trimmedText, presetConfig);
      }
      
      if (this.activeProvider === 'openai') {
        return await this.enrichWithOpenAI(trimmedText, presetConfig);
      }

      if (this.activeProvider === 'gemini') {
        return await this.enrichWithGemini(trimmedText, presetConfig);
      }

      if (this.activeProvider === 'opencode') {
        return await this.enrichWithOpenCode(trimmedText, presetConfig);
      }

      throw new Error(`Unsupported provider: ${this.activeProvider}`);
    } catch (error) {
      console.error('LLM enrichment error:', error);
      throw error;
    }
  }

  async askQuestion(transcriptText, question, options = {}) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question is required');
    }

    const outputLanguage = this.resolveOutputLanguage();
    const systemPrompt = `You answer questions about the provided transcript. Be concise and accurate. Answer in ${outputLanguage}.`;
    const userPrompt = `Transcript:\n${transcriptText || '(empty)'}\n\nQuestion:\n${question}\n\nAnswer:`;
    return this.generateText(systemPrompt, userPrompt, options);
  }

  async enrichWithOllama(text, presetConfig) {
    const prompt = this.buildPrompt(presetConfig, text);
    
    const response = await fetchWithTimeout(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.activeModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    const enrichedText = result.response;
    
    return this.parseEnrichedOutput(enrichedText, presetConfig);
  }

  async generateWithOllama(systemPrompt, userPrompt, options = {}) {
    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await fetchWithTimeout(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.activeModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9
        }
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    return result.response || '';
  }

  async enrichWithOpenAI(text, presetConfig) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildPrompt(presetConfig, text);
    
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.activeModel || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: presetConfig.system_prompt || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.statusText}`);
    }

    const result = await response.json();
    const enrichedText = result.choices[0].message.content;
    
    return this.parseEnrichedOutput(enrichedText, presetConfig);
  }

  async generateWithOpenAI(systemPrompt, userPrompt, options = {}) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.activeModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  }

  async enrichWithOpenCode(text, presetConfig) {
    const prompt = this.buildPrompt(presetConfig, text);
    const messages = [
      {
        role: 'system',
        content: presetConfig.system_prompt || 'You are a helpful assistant.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const model = this.activeModel || 'grok-code';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (process.env.OPENCODE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENCODE_API_KEY}`;
    }

    const anthropicModels = new Set([
      'minimax-m2.1-free',
      'claude-sonnet-4',
      'claude-3-5-haiku',
      'claude-haiku-4-5'
    ]);

    let url;
    let payload;
    if (anthropicModels.has(model)) {
      url = 'https://opencode.ai/zen/v1/messages';
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content);
      const conv = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role,
          content: [{ type: 'text', text: m.content }]
        }));
      payload = {
        model,
        messages: conv,
        max_tokens: 512
      };
      if (systemMessages.length > 0) {
        payload.system = systemMessages.join('\n\n');
      }
    } else {
      url = 'https://opencode.ai/zen/v1/chat/completions';
      payload = {
        model,
        messages
      };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenCode request failed: ${response.statusText}`);
    }

    const result = await response.json();
    let enrichedText = '';
    if (anthropicModels.has(model)) {
      const parts = result.content || [];
      enrichedText = parts.map(part => part.text || '').join('');
    } else {
      enrichedText = result.choices?.[0]?.message?.content || '';
    }
    return this.parseEnrichedOutput(enrichedText, presetConfig);
  }

  async generateWithOpenCode(systemPrompt, userPrompt, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    const model = this.activeModel || 'grok-code';
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.OPENCODE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENCODE_API_KEY}`;
    }

    const anthropicModels = new Set([
      'minimax-m2.1-free',
      'claude-sonnet-4',
      'claude-3-5-haiku',
      'claude-haiku-4-5'
    ]);

    let url;
    let payload;
    if (anthropicModels.has(model)) {
      url = 'https://opencode.ai/zen/v1/messages';
      payload = {
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        max_tokens: 512
      };
    } else {
      url = 'https://opencode.ai/zen/v1/chat/completions';
      payload = { model, messages };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenCode request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    if (anthropicModels.has(model)) {
      const parts = result.content || [];
      return parts.map(part => part.text || '').join('');
    }
    return result.choices?.[0]?.message?.content || '';
  }

  async enrichWithGemini(text, presetConfig) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = this.buildPrompt(presetConfig, text);
    const messages = [
      {
        role: 'system',
        content: presetConfig.system_prompt || 'You are a helpful assistant.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const model = this.activeModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
    const payload = { contents };
    const systemPrompt = messages.find(msg => msg.role === 'system')?.content;
    if (systemPrompt) {
      payload.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    const enrichedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!enrichedText) {
      throw new Error('Gemini request succeeded but returned empty content');
    }
    return this.parseEnrichedOutput(enrichedText, presetConfig);
  }

  async generateWithGemini(systemPrompt, userPrompt, options = {}) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.activeModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      system_instruction: { parts: [{ text: systemPrompt }] }
    };

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${response.statusText} ${body}`.trim());
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateText(systemPrompt, userPrompt, options = {}) {
    if (this.activeProvider === 'ollama') {
      if (!(await this.ensureOllamaRunning(true))) {
        throw new Error('Ollama is not reachable. Start it with "ollama serve".');
      }
      return this.generateWithOllama(systemPrompt, userPrompt, options);
    }
    if (this.activeProvider === 'openai') {
      return this.generateWithOpenAI(systemPrompt, userPrompt, options);
    }
    if (this.activeProvider === 'gemini') {
      return this.generateWithGemini(systemPrompt, userPrompt, options);
    }
    if (this.activeProvider === 'opencode') {
      return this.generateWithOpenCode(systemPrompt, userPrompt, options);
    }
    throw new Error(`Unsupported provider: ${this.activeProvider}`);
  }

  loadPreset(presetName) {
    const presetPath = path.join(this.presetsDir, `${presetName}.json`);
    
    if (!fs.existsSync(presetPath)) {
      return null;
    }

    try {
      const presetData = fs.readFileSync(presetPath, 'utf8');
      return JSON.parse(presetData);
    } catch (error) {
      console.error(`Failed to load preset '${presetName}':`, error);
      return null;
    }
  }

  parseEnrichedOutput(output, presetConfig) {
    // Basic parsing - can be enhanced based on preset structure
    const result = {
      original: output,
      structured: {}
    };

    // Try to extract structured data based on preset type
    if (presetConfig.type === 'quick_notes') {
      const sectionNames = {
        corrected: ['corrected text', 'korrigierter text'],
        summary: ['summary', 'zusammenfassung'],
        keyPoints: ['key points', 'bullet points', 'stichpunkte', 'punkte']
      };
      const stopNames = [
        ...sectionNames.corrected,
        ...sectionNames.summary,
        ...sectionNames.keyPoints
      ];

      const correctedText = this.extractSection(output, sectionNames.corrected, stopNames);
      result.structured = {
        corrected_text: correctedText || output,
        summary: this.extractSection(output, sectionNames.summary, stopNames),
        bullet_points: this.extractBulletPoints(
          this.extractSectionLines(output, sectionNames.keyPoints, stopNames)
        )
      };
    } else if (presetConfig.type === 'meeting_summary') {
      const sectionNames = {
        summary: ['summary', 'zusammenfassung'],
        keyPoints: ['key points', 'wichtige punkte'],
        actionItems: ['action items', 'aufgaben', 'aktionen']
      };
      const stopNames = [
        ...sectionNames.summary,
        ...sectionNames.keyPoints,
        ...sectionNames.actionItems
      ];

      result.structured = {
        summary: this.extractSection(output, sectionNames.summary, stopNames),
        key_points: this.extractBulletPoints(
          this.extractSectionLines(output, sectionNames.keyPoints, stopNames)
        ),
        action_items: this.extractBulletPoints(
          this.extractSectionLines(output, sectionNames.actionItems, stopNames)
        )
      };
    }

    return result;
  }

  extractSection(text, sectionNames, stopNames = []) {
    const sectionLines = this.extractSectionLines(text, sectionNames, stopNames);
    return sectionLines.map(line => line.trim()).join(' ').trim();
  }

  extractSectionLines(text, sectionNames, stopNames = []) {
    const lines = text.split('\n');
    let inSection = false;
    let sectionContent = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();
      const isSectionHeader = sectionNames.some(name => lowerLine.includes(name));
      const isStopHeader = stopNames.some(name => lowerLine.includes(name));

      if (isSectionHeader) {
        inSection = true;
        continue;
      }

      if (inSection && isStopHeader && !isSectionHeader) {
        break;
      }

      if (inSection && line.trim() === '') {
        break;
      }

      if (inSection) {
        sectionContent.push(line);
      }
    }

    return sectionContent;
  }

  extractBulletPoints(textOrLines) {
    const lines = Array.isArray(textOrLines) ? textOrLines : textOrLines.split('\n');
    const bulletPoints = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        bulletPoints.push(trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''));
      }
    }

    return bulletPoints;
  }

  setActivePreset(presetName) {
    if (this.loadPreset(presetName)) {
      this.activePreset = presetName;
      return true;
    }
    return false;
  }

  setOutputLanguage(language) {
    if (!language || typeof language !== 'string') {
      return false;
    }
    this.outputLanguage = language.toLowerCase();
    return true;
  }

  resolveOutputLanguage() {
    const language = (this.outputLanguage || 'en').toLowerCase();
    if (language.startsWith('de')) {
      return 'German';
    }
    if (language.startsWith('en')) {
      return 'English';
    }
    return language;
  }

  buildPrompt(presetConfig, text) {
    const outputLanguage = this.resolveOutputLanguage();
    return presetConfig.prompt
      .replace('{output_language}', outputLanguage)
      .replace('{text}', text);
  }

  setActiveModel(modelName) {
    if (modelName && typeof modelName === 'string') {
      this.activeModel = modelName;
      return true;
    }
    return false;
  }

  setActiveProvider(providerName) {
    const allowed = new Set(['ollama', 'openai', 'gemini', 'opencode']);
    if (allowed.has(providerName)) {
      this.activeProvider = providerName;
      if (providerName === 'ollama') {
        this.activeModel = process.env.OLLAMA_MODEL || 'mistral';
      } else if (providerName === 'openai') {
        this.activeModel = 'gpt-4o-mini';
      } else if (providerName === 'gemini') {
        this.activeModel = 'gemini-2.5-flash';
      } else if (providerName === 'opencode') {
        this.activeModel = 'grok-code';
      }
      return true;
    }
    return false;
  }

  setOpenAIKey(apiKey) {
    if (apiKey && typeof apiKey === 'string') {
      process.env.OPENAI_API_KEY = apiKey;
      return true;
    }
    return false;
  }

  setGeminiKey(apiKey) {
    if (apiKey && typeof apiKey === 'string') {
      process.env.GEMINI_API_KEY = apiKey;
      return true;
    }
    return false;
  }

  setOpenCodeKey(apiKey) {
    if (apiKey && typeof apiKey === 'string') {
      process.env.OPENCODE_API_KEY = apiKey;
      return true;
    }
    return false;
  }

  setOllamaUrl(url) {
    if (url && typeof url === 'string') {
      this.ollamaUrl = url.replace(/\/$/, '');
      return true;
    }
    return false;
  }

  async ensureOllamaRunning(forceStart = false) {
    try {
    const response = await fetchWithTimeout(`${this.ollamaUrl}/api/tags`, {}, 3000);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // ignore
    }

    if (forceStart) {
      try {
        const { spawn } = require('child_process');
        spawn('ollama', ['serve'], { stdio: 'ignore', detached: true });
      } catch (error) {
        // ignore
      }
    }

    try {
      const response = await fetchWithTimeout(`${this.ollamaUrl}/api/tags`, {}, 3000);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getProviderModels() {
    if (this.activeProvider === 'ollama') {
      return this.getOllamaModels();
    }
    if (this.activeProvider === 'opencode') {
      return this.opencodeModels;
    }
    if (this.activeProvider === 'openai') {
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
    }
    if (this.activeProvider === 'gemini') {
      return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];
    }
    return [];
  }

  getAvailablePresets() {
    if (!fs.existsSync(this.presetsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.presetsDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }
}

module.exports = new LLMProcessor();
