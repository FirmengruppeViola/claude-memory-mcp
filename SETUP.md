# Memory Buddy Setup

## Quick Start

```bash
npx memory-buddy init
```

Dann Claude Code neu starten.

## Was passiert bei `init`

1. Erstellt `~/.memory-buddy/` mit:
   - `events/` - JSONL Dateien mit allen Messages
   - `config.json` - Einstellungen
   - `index.json` - Keyword-Index

2. Konfiguriert Claude Desktop (falls vorhanden):
   - `%APPDATA%/Claude/claude_desktop_config.json`

3. Konfiguriert Claude Code:
   - `~/.claude.json` - MCP Server
   - `~/.claude/settings.json` - Hooks

## Hooks (das Wichtige)

Die Hooks in `~/.claude/settings.json` machen die Magie:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "npx -y memory-buddy store user \"$PROMPT\""
      }]
    }],
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "npx -y memory-buddy compact"
      }]
    }]
  }
}
```

## Verifizieren

```bash
npx memory-buddy doctor
```

Sollte zeigen:
```
[OK] Memory directory
[OK] Events directory
[OK] Config file
[OK] Index file
[OK] Claude Desktop
[OK] Claude Code MCP
[OK] Claude Code Hooks
```

## Gedaechtnis abfragen

### Via MCP Tools (in Claude)
```
memory_status    - Zeigt Events, Sessions, letzte Aktivitaet
memory_search    - Sucht nach Keywords in Erinnerungen
memory_compact   - Kompaktiert aktuelle Session
```

### Via CLI
```bash
# Statistiken
npx memory-buddy status

# Raw Events anschauen (JSONL)
cat ~/.memory-buddy/events/2025-12-07.jsonl

# Index anschauen (Keywords -> Events)
cat ~/.memory-buddy/index.json
```

### Direkt in Dateien
- `~/.memory-buddy/events/YYYY-MM-DD.jsonl` - Alle Messages als JSON Lines
- `~/.memory-buddy/index.json` - Keyword-Index, Sessions, Anchors

## Commands

| Command | Beschreibung |
|---------|--------------|
| `init` | Setup + Konfiguration |
| `status` | Zeigt Statistiken |
| `doctor` | Health Check |
| `store` | Speichert Message (intern) |
| `compact` | Session beenden |
| `serve` | MCP Server starten |

## Troubleshooting

**Hooks nicht aktiv?**
- Claude Code neu starten
- `npx memory-buddy init` erneut ausführen

**Events werden nicht gespeichert?**
- Check: `~/.memory-buddy/events/` sollte JSONL Dateien haben
- Check: `npx memory-buddy status` zeigt Event-Count

**MCP Server Fehler?**
- Check: `npx memory-buddy serve` manuell starten
- Logs prüfen
