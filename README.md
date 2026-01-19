# Voice Intelligence Desktop App

A functional desktop prototype for voice intelligence with local AI processing. Record audio, transcribe it with Whisper, and enrich with LLM models.

## Problem & Ziel

Voice Intelligence Desktop App löst das Problem der manuellen Notizenaufnahme während Meetings oder beim schnellen Festhalten von Gedanken. Die App ermöglicht es Benutzern, per Hotkey Sprache aufzunehmen, automatisch transkribieren zu lassen und durch KI strukturiert aufzubereiten.

**Ziel:** Ein ruhiger, funktionierender Prototyp, der Kompetenz signalisiert und den Kern-Workflow zuverlässig abbildet.

## Architekturüberblick

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron      │    │   Whisper.cpp   │    │     Ollama      │
│   Main Process  │───▶│  (Speech-to-Text)│───▶│   (LLM Enrich)  │
│                 │    │                 │    │                 │
│ • Global Hotkey │    │ • Local Models  │    │ • Local Models  │
│ • Audio Capture │    │ • Small/Medium  │    │ • Mistral/Llama │
│ • IPC Bridge    │    │ • Offline First │    │ • Offline First │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Next.js UI     │
│  (Static Export)│
│                 │
│ • React + TS    │
│ • Tailwind CSS  │
│ • Minimal Design│
└─────────────────┘
```

## Tech-Entscheidungen

### Runtime: Electron
- **Begründung:** Schnellster stabiler Weg unter Zeitdruck
- **Vorteile:** Reife Audio- und Hotkey-APIs, geringere Reibung als Tauri
- **Fokus:** Lokale Funktionalität vor Cloud-Integration

### Frontend: Next.js mit Static Export
- **Begründung:** React-Ökosystem, TypeScript-Unterstützung
- **Vorteile:** Schnelle Entwicklung, moderne UI mit Tailwind CSS
- **Deployment:** Statische Files für Electron-Integration

### Speech-to-Text: Whisper.cpp (lokal)
- **Begründung:** Offline-First, keine API-Kosten
- **Modelle:** `small` (default), `medium` (optional)
- **Fallback:** OpenAI Whisper API (optional)

### LLM: Ollama (lokal)
- **Begründung:** Lokale Verarbeitung, Datenschutz
- **Modelle:** `mistral`, `llama3` oder andere Ollama-Modelle
- **Fallback:** OpenAI API (optional)

## Setup (lokal, Schritt für Schritt)

### 1. System-Voraussetzungen

**macOS:**
```bash
# Xcode Command Line Tools
xcode-select --install

# Homebrew (falls nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# SoX (Audioaufnahme via "rec")
brew install sox
```

**Windows:**
- Visual Studio Build Tools
- Git for Windows
- SoX (https://sourceforge.net/projects/sox/)

**Linux:**
- `build-essential`
- `pkg-config`
- `libasound2-dev`
- `sox`

### 2. Whisper.cpp installieren

```bash
# Clone und kompiliere Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make

# Lade das Small Model herunter
./models/download-ggml-model.sh small

# Optional: Medium Model für höhere Qualität
./models/download-ggml-model.sh medium

# Hinweis: Die Modelle liegen unter whisper.cpp/models
# Alternativ kannst du den Pfad via WHISPER_MODEL_PATH setzen.
```

### 3. Ollama installieren

```bash
# macOS
brew install ollama

# Windows
# Download von https://ollama.ai/

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
```

```bash
# Starte Ollama Service
ollama serve

# Lade Modelle herunter
ollama pull mistral
ollama pull llama3
```

Optional: OpenAI Key kann in den Settings der App gesetzt werden (Fallback).

### LLM Provider (Settings)

- **ollama** (default): lokal, offline-first
- **opencode**: cloud models via OpenCode (grok-code, big-pickle, glm-4.7-free, minimax-m2.1-free). API key optional.
- **openai**: requires OpenAI API key
- **gemini**: requires Gemini API key

### 4. Projekt installieren

```bash
# Repository klonen
git clone <repository-url>
cd <repository-folder>

# Root-Dependencies installieren
npm install

# Frontend-Dependencies installieren
cd frontend
npm install
cd ..
```

### 5. Konfiguration

```bash
# Umgebungsvariablen (optional für API-Fallbacks)
export OPENAI_API_KEY="your-key-here"
export GEMINI_API_KEY="your-gemini-key"
export OPENCODE_API_KEY="optional-opencode-key"
export LLM_PROVIDER="ollama"  # ollama | opencode | openai | gemini
export OLLAMA_URL="http://127.0.0.1:11434"

# Whisper Pfad anpassen (falls nicht in Standard-Pfaden)
export WHISPER_PATH="/pfad/zu/whisper.cpp/main"
# Optional: Modell-Auswahl
export WHISPER_MODEL="small"   # oder "medium"
# Optional: direkter Modellpfad
export WHISPER_MODEL_PATH="/pfad/zu/ggml-small.bin"
# Optional: Debug/Performance
export WHISPER_NO_GPU=1
export WHISPER_THREADS=4
export WHISPER_KEEP_FILES=1
export WHISPER_EXTRA_ARGS="--print-progress"
```

## Build & Run

### Development Mode

```bash
# Starte Entwicklungsumgebung
npm run dev

# Oder separat:
npm run dev:frontend  # Startet Next.js auf Port 3000
npm run dev:electron  # Startet Electron nach Frontend-Ready
```

```bash
# Falls Port 3000 belegt ist:
export DEV_PORT=3001
npm run dev
```

### One-Command Bootstrap

```bash
# Führt Preflight-Checks aus, installiert Node-Dependencies und startet die App
npm run bootstrap
```

Optional (macOS): automatische Installation per Homebrew, falls Komponenten fehlen:
```bash
AUTO_INSTALL=1 npm run bootstrap
```

### Whisper Setup (lokal)

```bash
# Klont, baut und lädt Whisper-Modelle herunter
npm run setup:whisper
```

### Production Build

```bash
# Frontend bauen
npm run build:frontend

# Electron App bauen
npm run build:electron

# Oder beides zusammen
npm run build
```

### Starten der fertigen App

```bash
# Direkt starten
npm start

# Oder gebaute App ausführen
./dist/Voice\ Intelligence.app  # macOS
./dist/Voice-Intelligence.exe  # Windows
./dist/voice-intelligence.AppImage  # Linux
```

## Nutzung

1. **App starten** - Die Voice Intelligence App öffnet sich
2. **Global Hotkey** - `Cmd+Shift+Space` (macOS) oder `Ctrl+Shift+Space` (Windows/Linux)
3. **Aufnahme** - Hotkey drücken zum Starten, nochmal zum Stoppen
4. **Verarbeitung** - Automatische Transkription und Anreicherung
5. **Ergebnis** - Strukturierter Output wird in der UI angezeigt

### Presets

- **Quick Notes** (Default): Korrigierte Transkription + Zusammenfassung + Bullet Points
- **Meeting Summary**: Zusammenfassung + Key Points + Action Items

## Limitierungen

- **Keine App-Store-Zertifizierung**: Unsigned binaries
- **Keine Realtime-Transkription**: Batch-Processing nur
- **Modell-Abhängigkeiten**: Whisper.cpp und Ollama müssen lokal installiert sein
- **Plattform-spezifische Audio**: Unterschiedliche Audio-Subsysteme
- **Kein Streaming**: Verarbeitung erst nach Aufnahme-Ende

## Troubleshooting

### Whisper nicht gefunden
```bash
# Prüfe Installation
which whisper
ls -la /usr/local/bin/whisper

# Alternativ: Umgebungsvariable setzen (aktueller Build-Pfad)
export WHISPER_PATH="/pfad/zu/whisper.cpp/build/bin/whisper-cli"
```

### Ollama nicht erreichbar
```bash
# Service Status prüfen
ollama list

# Service neu starten
ollama serve
```

### Audio-Probleme
```bash
# Mikrofon-Rechte prüfen (macOS)
# Systemeinstellungen → Datenschutz → Mikrofon
# Falls die App nicht angezeigt wird:
# App einmal starten und Recording drücken, dann erscheint die Nachfrage.

# Audio-Geräte prüfen
arecord -l  # Linux
```

### TypeScript-Fehler im Frontend
```bash
# Dependencies neu installieren
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Dateistruktur

```
/app
├─ frontend/           # Next.js UI (static export)
│  ├─ pages/          # React Components
│  ├─ styles/         # Tailwind CSS
│  └─ components/     # Reusable Components
├─ electron/          # Electron Main Process
│  ├─ main.js         # App lifecycle, hotkeys
│  ├─ audio.js        # Audio recording
│  ├─ stt.js          # Whisper adapter
│  ├─ llm.js          # Ollama/API adapter
│  ├─ ipc.js          # IPC handlers
│  └─ preload.js      # Security bridge
├─ presets/           # Enrichment presets
│  ├─ quick_notes.json
│  └─ meeting_summary.json
└─ README.md
```

## Erfolgsdefinition

Der Prototyp gilt als **erfolgreich**, wenn:

- ✅ Ein Reviewer die App starten kann
- ✅ Per Hotkey sprechen kann  
- ✅ Innerhalb weniger Sekunden strukturierten Text erhält
- ✅ Den Aufbau im README versteht

## Nächste Schritte (optional)

- Qualitätsverbesserungen für Preset-Parsing
- UI-Polish für Settings und Output
- Stabilere Audio-Fehlerdiagnose
