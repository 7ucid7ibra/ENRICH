# ENRICH (Desktop App)

Eine Desktop‑App, die Sprache aufnimmt, transkribiert und mit KI zu strukturierten Notizen anreichert. Entwickelt mit Electron + Next.js für einen schnellen, fokussierten Workflow.

## Funktionen

- Aufnahme per globalem Hotkey
- Lokale Whisper‑Transkription (offline) oder Deepgram Live‑STT (cloud)
- Anreicherungs‑Presets (Zusammenfassung, Kernthemen, Action Items)
- Q&A zum Transkript
- TTS‑Wiedergabe für Zusammenfassungen und Antworten (Piper)
- Sprachumschaltung (DE/EN) + Ausgabe‑Sprache
- Verlauf von Transkripten + Chat
- Auto‑Anreichern (manuell oder automatisch)

## Architektur

- **Electron**: App‑Lifecycle, Hotkeys, Audio‑Capture, IPC
- **Next.js UI**: React + Tailwind Frontend
- **STT**: Whisper.cpp (lokal) oder Deepgram (cloud)
- **LLM**: Ollama (lokal) oder OpenAI / Gemini / OpenCode (cloud)
- **TTS**: Piper (lokal)

## Schnellstart (Dev)

### 1) Abhaengigkeiten installieren

```bash
npm install
cd frontend && npm install
```

### 2) Whisper (lokales STT)

Whisper wird fuer `npm run bootstrap` benoetigt:

```bash
npm run setup:whisper
```

Wenn du nur Cloud‑STT nutzen willst, starte dev manuell (siehe unten) und stelle in den Settings auf Deepgram um.

### 3) App starten

```bash
npm run bootstrap
```

Oder manuell:

```bash
npm run dev
```

## Build (DMG)

```bash
npm run build
```

Artefakte liegen in `dist/`. Das DMG ist unsigniert.

### macOS Gatekeeper (unsigniert)

Rechtsklick auf die App → Oeffnen → Oeffnen, oder:

```bash
xattr -dr com.apple.quarantine /Applications/YourApp.app
```

## Konfiguration (in der App)

- **STT Provider**: Whisper (lokal) oder Deepgram (cloud)
- **LLM Provider**: Ollama / OpenAI / Gemini / OpenCode
- **API Keys**: in den Settings setzen
- **TTS Stimme**: pro Sprache waehlen

## Hotkeys

- **Aufnahme Start/Stop**: Cmd/Ctrl + Shift + Space
- **Anreichern**: Cmd/Ctrl + Enter
- **Aufnahme abbrechen**: Esc

## Persistenz

Der Verlauf wird gespeichert unter:

- macOS: `~/Library/Application Support/ENRICH/everlast-history.json`

## Troubleshooting

**Whisper fehlt beim Bootstrap**
```
npm run setup:whisper
```

**Deepgram funktioniert nicht**
- API Key in den Settings eintragen
- STT Provider auf Deepgram stellen

**TTS spielt nicht**
- `assets/piper/` muss existieren (voices.json + Modelle)

## Projektstruktur

```
frontend/      # Next.js UI
electron/      # Electron Main Process + IPC
presets/       # Anreicherungs‑Presets
assets/        # Assets (piper, icons)
whisper.cpp/   # Whisper.cpp + Modelle (lokal dev)
```

## Demo‑Ablauf

1) App starten
2) Hotkey druecken, sprechen, Aufnahme stoppen
3) Transkription erscheint
4) Anreichern (Button oder Cmd/Ctrl+Enter)
5) Zusammenfassung + Kernthemen + Action Items ansehen
6) Q&A stellen, optional TTS abspielen

---

Wenn du Fragen zum Build oder zur Nutzung hast, erstelle ein Issue oder kontaktiere den Autor.
