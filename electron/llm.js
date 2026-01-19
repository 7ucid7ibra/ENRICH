const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class LLMProcessor {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.defaultModel = 'mistral';
    this.presetsDir = path.join(__dirname, '../presets');
    this.activePreset = 'quick_notes';
  }

  async initialize() {
    // Check if Ollama is running
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not responding');
      }
      
      const data = await response.json();
      console.log('Available Ollama models:', data.models.map(m => m.name));
      return true;
    } catch (error) {
      console.warn('Ollama not available:', error.message);
      return false;
    }
  }

  async enrich(text, presetName = null) {
    const preset = presetName || this.activePreset;
    const presetConfig = this.loadPreset(preset);
    
    if (!presetConfig) {
      throw new Error(`Preset '${preset}' not found`);
    }

    try {
      // Try local Ollama first
      if (await this.initialize()) {
        return await this.enrichWithOllama(text, presetConfig);
      }
      
      // Fallback to OpenAI API
      return await this.enrichWithOpenAI(text, presetConfig);
    } catch (error) {
      console.error('LLM enrichment error:', error);
      throw error;
    }
  }

  async enrichWithOllama(text, presetConfig) {
    const prompt = presetConfig.prompt.replace('{text}', text);
    
    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.defaultModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const result = await response.json();
    const enrichedText = result.response;
    
    return this.parseEnrichedOutput(enrichedText, presetConfig);
  }

  async enrichWithOpenAI(text, presetConfig) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = presetConfig.prompt.replace('{text}', text);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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
