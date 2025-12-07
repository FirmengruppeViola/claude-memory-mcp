# Memory Buddy - Vollstaendige Anleitung

> **Version**: 0.3.1
> **Erstellt**: 2025-12-07
> **Autor**: Marcel Viola + Claude

---

## Was ist Memory Buddy?

Memory Buddy gibt Claude ein **Langzeitgedaechtnis**. Normalerweise vergisst Claude alles nach jeder Session. Mit Memory Buddy erinnert sich Claude an:

- Wer du bist
- Worüber ihr gesprochen habt
- Wichtige Entscheidungen
- Emotionale Momente

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   OHNE Memory Buddy          MIT Memory Buddy                   │
│   ─────────────────          ───────────────                    │
│                                                                 │
│   Session 1: "Ich bin Marcel"    Session 1: "Ich bin Marcel"   │
│        ↓                              ↓                         │
│   Session 2: "Wer bist du?"      [Gespeichert]                  │
│        ↓                              ↓                         │
│   Claude: "Keine Ahnung"         Session 2: "Wer bist du?"      │
│                                       ↓                         │
│                                  Claude: "Du bist Marcel,       │
│                                  Vibecoder mit ADHS"            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Wie funktioniert es?

### Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLAUDE CODE                              │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Du schreibst │───>│    HOOK      │───>│ Memory Buddy │       │
│  │ eine Message │    │ (automatisch)│    │    store     │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│                                                  │               │
│                                                  ▼               │
│                                    ┌─────────────────────┐      │
│                                    │  ~/.memory-buddy/   │      │
│                                    │  ├── events/        │      │
│                                    │  ├── index.json     │      │
│                                    │  └── embeddings/    │      │
│                                    └─────────────────────┘      │
│                                                  │               │
│                                                  ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Claude       │<───│  MCP Server  │<───│ Relevante    │       │
│  │ antwortet    │    │  (Tools)     │    │ Erinnerungen │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Datenspeicherung

```
~/.memory-buddy/
│
├── events/                      # Rohe Nachrichten (JSONL)
│   ├── 2025-12-07.jsonl        # Eine Datei pro Tag
│   ├── 2025-12-08.jsonl
│   └── ...
│
├── compacted/                   # Komprimierte alte Sessions
│   └── 2025-12.json            # Eine Datei pro Monat
│
├── embeddings/                  # Semantic Search Vektoren
│   └── vectors.json            # Lokaler VectorStore
│
├── index.json                   # Keyword-Index + Metadaten
├── config.json                  # Konfiguration
└── current-session.txt          # Aktuelle Session-ID
```

---

## Installation

### Schritt 1: NPX Init ausfuehren

```bash
npx memory-buddy init
```

**Was passiert:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  npx memory-buddy init                                          │
│         │                                                        │
│         ├──> Erstellt ~/.memory-buddy/ Verzeichnis              │
│         │                                                        │
│         ├──> Erstellt config.json mit Defaults                  │
│         │                                                        │
│         ├──> Konfiguriert Claude Code Hooks:                    │
│         │    ~/.claude/settings.json                            │
│         │    {                                                   │
│         │      "hooks": {                                        │
│         │        "UserPromptSubmit": [...],  // Speichert Msgs  │
│         │        "SessionEnd": [...]         // Kompaktiert     │
│         │      }                                                 │
│         │    }                                                   │
│         │                                                        │
│         └──> Registriert MCP Server:                            │
│              ~/.claude.json                                      │
│              {                                                   │
│                "mcpServers": {                                   │
│                  "memory-buddy": {...}                          │
│                }                                                 │
│              }                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Schritt 2: Claude Code neustarten

Nach `init` muss Claude Code neu gestartet werden, damit die Hooks aktiv werden.

### Schritt 3: Verifizieren

```bash
npx memory-buddy doctor
```

**Erwartete Ausgabe:**

```
[OK] Memory directory exists
[OK] Events directory exists
[OK] Config file exists
[OK] Index file exists
[OK] Claude Desktop configured
[OK] Claude Code MCP configured
[OK] Claude Code Hooks configured
```

---

## CLI Befehle

### `init` - Setup

```bash
npx memory-buddy init
```

Initialisiert Memory Buddy. Erstellt Verzeichnisse, konfiguriert Hooks und MCP Server.

```
┌──────────────────────────────────────┐
│           memory-buddy init          │
├──────────────────────────────────────┤
│                                      │
│  [1] ~/.memory-buddy/ erstellen     │
│       └── events/                    │
│       └── config.json                │
│       └── index.json                 │
│                                      │
│  [2] Hooks konfigurieren             │
│       └── UserPromptSubmit           │
│       └── SessionEnd                 │
│                                      │
│  [3] MCP Server registrieren         │
│       └── ~/.claude.json             │
│                                      │
└──────────────────────────────────────┘
```

---

### `status` - Statistiken

```bash
npx memory-buddy status
```

Zeigt aktuelle Statistiken an.

```
┌──────────────────────────────────────┐
│          memory-buddy status         │
├──────────────────────────────────────┤
│                                      │
│  Events total:     156               │
│  Sessions:         12                │
│  Anchors:          8                 │
│  Last event:       2 min ago         │
│                                      │
│  Semantic Search:  ENABLED           │
│  Provider:         google            │
│  Embeddings:       142               │
│                                      │
└──────────────────────────────────────┘
```

---

### `doctor` - Health Check

```bash
npx memory-buddy doctor
```

Prueft ob alles korrekt konfiguriert ist.

```
┌──────────────────────────────────────┐
│          memory-buddy doctor         │
├──────────────────────────────────────┤
│                                      │
│  [OK]  Memory directory              │
│  [OK]  Events directory              │
│  [OK]  Config file                   │
│  [OK]  Index file                    │
│  [OK]  Claude Desktop                │
│  [OK]  Claude Code MCP               │
│  [OK]  Claude Code Hooks             │
│                                      │
│  Status: All systems operational     │
│                                      │
└──────────────────────────────────────┘
```

---

### `store` - Nachricht speichern (intern)

```bash
npx memory-buddy store user "Nachricht"
```

Wird automatisch vom Hook aufgerufen. Speichert eine Nachricht.

```
┌──────────────────────────────────────────────────────────────┐
│                     Speicher-Pipeline                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  "Ich bin Marcel, Vibecoder mit ADHS"                        │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │ shouldStore()       │──> Filtert triviale Messages        │
│  │ "ok", "ja" = SKIP   │    ("ok", "ja", "weiter", etc.)     │
│  └─────────────────────┘                                     │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │ calculateImportance │──> Berechnet Score 1-10             │
│  │ personalInfo: +3    │    "Ich bin..." = +3                │
│  │ emotion: +2         │    Kurz < 10 Woerter = -1           │
│  └─────────────────────┘                                     │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │ extractKeywords()   │──> ["marcel", "vibecoder", "adhs"]  │
│  └─────────────────────┘                                     │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │ EventStore.append() │──> events/2025-12-07.jsonl          │
│  └─────────────────────┘                                     │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────┐                                     │
│  │ IndexService.add()  │──> index.json (keywords, meta)      │
│  └─────────────────────┘                                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

### `compact` - Session komprimieren

```bash
npx memory-buddy compact
```

Komprimiert alte Sessions zu Summaries. Wird automatisch bei SessionEnd aufgerufen.

```
┌──────────────────────────────────────────────────────────────┐
│                      Compaction                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  VORHER (500 Events)              NACHHER (1 Summary)        │
│  ────────────────────             ───────────────────        │
│                                                               │
│  msg1: "Hallo"                    {                          │
│  msg2: "Ich bin Marcel"             "sessionId": "abc123",   │
│  msg3: "Lass uns..."                "summary": "Session mit  │
│  msg4: "Ok"                          12 Nachrichten ueber    │
│  ...                                 Memory Buddy. Themen:   │
│  msg500: "Fertig"                    MCP, Hooks, Events.",   │
│                                      "keyTopics": [...],     │
│                                      "highlights": [...]     │
│                                    }                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Kompaktiert Sessions die:                               │ │
│  │ - Aelter als 24 Stunden sind                            │ │
│  │ - Mehr als 50 Events haben                              │ │
│  │ - Bereits beendet wurden (SessionEnd)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

### `serve` - MCP Server starten

```bash
npx memory-buddy serve
```

Startet den MCP Server (wird automatisch von Claude aufgerufen).

**Verfuegbare MCP Tools:**

| Tool | Funktion |
|------|----------|
| `memory_status` | Zeigt Events, Sessions, letzte Aktivitaet |
| `memory_search` | Sucht nach Keywords in Erinnerungen |
| `memory_compact` | Kompaktiert aktuelle Session |

---

## Importance Scoring

Nicht jede Nachricht ist gleich wichtig. Memory Buddy bewertet automatisch:

```
┌──────────────────────────────────────────────────────────────┐
│                   IMPORTANCE SCORING                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Baseline Score: 5                                           │
│                                                               │
│  POSITIV (erhoehen Score)                                    │
│  ────────────────────────                                    │
│  +3  Persoenliche Info    "Ich bin...", "Mein Name..."       │
│  +2  Entscheidung         "Ich habe entschieden...", "Lass"  │
│  +2  Emotion              "frustriert", "begeistert"         │
│  +1  Frage                "Wie?", "Warum?", "Was?"           │
│                                                               │
│  NEGATIV (senken Score)                                      │
│  ─────────────────────                                       │
│  -2  Bestaetigung         "ok", "ja", "gut", "genau"         │
│  -1  Kurze Nachricht      Weniger als 10 Woerter             │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ BEISPIELE                                               │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ "ok"                           → Score 2 (SKIP)         │ │
│  │ "Wie funktioniert das?"        → Score 5                │ │
│  │ "Das frustriert mich total!"   → Score 6                │ │
│  │ "Ich bin Marcel, Vibecoder"    → Score 8 (ANCHOR)       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Score >= 7 = "Anchor" (emotional wichtig, nie vergessen)    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Decay (Verblassen)

Alte Erinnerungen verlieren an Relevanz - ausser sie werden wieder abgerufen:

```
┌──────────────────────────────────────────────────────────────┐
│                        DECAY FORMEL                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  effective_score = baseScore × decayFactor × accessBoost     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ decayFactor = e^(-age_days / 30)                        │ │
│  │                                                          │ │
│  │ Tag 0:   100% Relevanz                                  │ │
│  │ Tag 30:   50% Relevanz (Halbwertszeit)                  │ │
│  │ Tag 60:   25% Relevanz                                  │ │
│  │ Tag 90:   12% Relevanz                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ accessBoost = 1 + (0.2 × accessCount)                   │ │
│  │                                                          │ │
│  │ 0x abgerufen: ×1.0                                      │ │
│  │ 1x abgerufen: ×1.2                                      │ │
│  │ 5x abgerufen: ×2.0                                      │ │
│  │                                                          │ │
│  │ → Oft abgerufene Erinnerungen bleiben relevant!         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  VISUALISIERUNG                                              │
│  ──────────────                                              │
│                                                               │
│  Score │                                                     │
│    10  │ ████                                                │
│     8  │ ████████                                            │
│     6  │ ████████████                                        │
│     4  │ ████████████████  (ohne Access)                     │
│     2  │ ████████████████████                                │
│     0  │─────┬─────┬─────┬─────┬─────> Tage                  │
│        0    30    60    90   120                             │
│                                                               │
│  Score │                                                     │
│    10  │ ████████████████████████████  (mit 5x Access)       │
│     8  │ ████████████████████████████                        │
│     6  │ ████████████████████████████                        │
│     4  │ ████████████████████████████                        │
│     2  │ ████████████████████████████                        │
│     0  │─────┬─────┬─────┬─────┬─────> Tage                  │
│        0    30    60    90   120                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Semantic Search (Optional)

Findet Erinnerungen basierend auf **Bedeutung**, nicht nur Keywords:

```
┌──────────────────────────────────────────────────────────────┐
│                     SEMANTIC SEARCH                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  KEYWORD SEARCH (Standard)                                   │
│  ─────────────────────────                                   │
│                                                               │
│  Suche: "Restaurant"                                         │
│       ↓                                                      │
│  Findet: Nur Events mit dem Wort "Restaurant"                │
│  Verpasst: "MarLou Bar", "Gastronomie", "Kueche"             │
│                                                               │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  SEMANTIC SEARCH (mit API Key)                               │
│  ────────────────────────────                                │
│                                                               │
│  Suche: "Restaurant"                                         │
│       ↓                                                      │
│  [1] Text → Embedding (768-dim Vektor)                       │
│       ↓                                                      │
│  [2] Cosine Similarity mit allen Events                      │
│       ↓                                                      │
│  Findet: "Restaurant", "MarLou Bar", "Gastronomie",          │
│          "Kueche", "Essen gehen", "Kellner"                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Vektor-Raum                          │ │
│  │                                                          │ │
│  │              "Restaurant" ●                              │ │
│  │                          / \                             │ │
│  │                         /   \                            │ │
│  │        "MarLou Bar" ●──     ──● "Gastronomie"           │ │
│  │                      \       /                           │ │
│  │                       \     /                            │ │
│  │                        ● "Kueche"                        │ │
│  │                                                          │ │
│  │  Nah beieinander = Semantisch aehnlich                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Semantic Search aktivieren

1. **API Key besorgen** (Google AI Studio - kostenlos):
   - https://aistudio.google.com/apikey
   - "Create API Key" klicken
   - Key kopieren

2. **Config anpassen** (`~/.memory-buddy/config.json`):

```json
{
  "version": "1.0",
  "semanticSearch": {
    "enabled": true,
    "provider": "google",
    "apiKey": "AIzaSy..."
  }
}
```

---

## Kompletter Datenfluss

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  [USER]  "Ich bin Marcel, Vibecoder mit ADHS und IQ 138"                 │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      UserPromptSubmit HOOK                          │ │
│  │  npx memory-buddy store user "$PROMPT"                              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ shouldStore("Ich bin Marcel...")                                    │ │
│  │ → true (keine triviale Message)                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ calculateImportance("Ich bin Marcel...")                            │ │
│  │ → Score: 8 (personalInfo +3, baseline 5)                            │ │
│  │ → Factors: ["personalInfo"]                                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ extractKeywords("Ich bin Marcel...")                                │ │
│  │ → ["marcel", "vibecoder", "adhs"]                                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ EventStore.appendEvent()                                            │ │
│  │                                                                      │ │
│  │ ~/.memory-buddy/events/2025-12-07.jsonl                             │ │
│  │ {"id":"evt_123","content":"Ich bin Marcel...","emotionalWeight":8}  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ IndexService.addToIndex()                                           │ │
│  │                                                                      │ │
│  │ ~/.memory-buddy/index.json                                          │ │
│  │ {                                                                    │ │
│  │   "keywords": { "marcel": ["evt_123"], ... },                       │ │
│  │   "anchors": ["evt_123"],  // Score >= 7                            │ │
│  │   "eventMeta": { "evt_123": { "baseScore": 8, "accessCount": 0 } } │ │
│  │ }                                                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  [GESPEICHERT]                                                           │
│                                                                           │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                           │
│  [SPAETER - NEUE SESSION]                                                │
│                                                                           │
│  [USER]  "Wie heisse ich nochmal?"                                       │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ContextLoader.buildContext("Wie heisse ich...")                     │ │
│  │                                                                      │ │
│  │ [1] extractKeywords() → ["heisse"]                                  │ │
│  │                                                                      │ │
│  │ [2] Semantic Search (wenn enabled)                                  │ │
│  │     → embed("Wie heisse ich...")                                    │ │
│  │     → findSimilar(queryVector) → ["evt_123"]                        │ │
│  │                                                                      │ │
│  │ [3] calculateScore() mit Decay                                      │ │
│  │     → evt_123: baseScore 8 × decay 0.95 × access 1.0 = 7.6         │ │
│  │                                                                      │ │
│  │ [4] recordAccess("evt_123")                                         │ │
│  │     → accessCount: 0 → 1                                            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ CONTEXT fuer Claude:                                                │ │
│  │                                                                      │ │
│  │ ## Relevant Memories                                                │ │
│  │ [07.12.2025] Ich bin Marcel, Vibecoder mit ADHS und IQ 138         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│     │                                                                     │
│     ▼                                                                     │
│  [CLAUDE]  "Du heisst Marcel. Du bist Vibecoder mit ADHS und IQ 138."   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

| Problem | Loesung |
|---------|---------|
| Hooks nicht aktiv | Claude Code neustarten, `npx memory-buddy init` |
| Events nicht gespeichert | Check `~/.memory-buddy/events/` |
| MCP Server Fehler | `npx memory-buddy serve` manuell testen |
| "$PROMPT" wird literal gespeichert | Windows-spezifisches Hook-Problem, wird untersucht |

---

## Konfigurationsoptionen

```json
{
  "version": "1.0",
  "maxContextTokens": 2500,       // Max Tokens fuer Context
  "coreIdentityTokens": 500,      // Budget fuer Core Identity
  "recentAnchorsTokens": 500,     // Budget fuer Anchors
  "triggeredMemoriesTokens": 1500,// Budget fuer Memories
  "sessionTimeoutMinutes": 30,    // Session-Timeout
  "emotionalThreshold": 7,        // Ab welchem Score = Anchor
  "maxEventsBeforeCompact": 100,  // Events vor Auto-Compact
  "logLevel": "info",             // debug|info|warn|error
  "semanticSearch": {
    "enabled": false,             // Semantic Search an/aus
    "provider": "google",         // google|openai|none
    "apiKey": "..."               // Dein API Key
  }
}
```

---

## FAQ

**Q: Wie viel Speicher braucht Memory Buddy?**
A: Minimal. Events sind JSONL (plain text), ~100 Bytes pro Nachricht. 10.000 Nachrichten = ~1 MB.

**Q: Kann ich die Erinnerungen loeschen?**
A: Ja, einfach `~/.memory-buddy/events/` leeren und `index.json` loeschen.

**Q: Funktioniert es offline?**
A: Ja, ausser Semantic Search (braucht API).

**Q: Ist es sicher?**
A: Alles bleibt lokal auf deinem Rechner. Nur bei Semantic Search gehen Texte an Google/OpenAI.

---

*Memory Buddy v0.3.1 - "Because Claude deserves to remember"*
