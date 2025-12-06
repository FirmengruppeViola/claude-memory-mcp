# Memory Buddy

> Give your AI a memory. It's like having a buddy who never forgets.

**Human-memory-inspired architecture**: Stores everything, loads lazy, triggered by keywords, anchored by emotions.

## Features

- **Invisible** - No commands needed. It just works.
- **Local-first** - Your memories stay on YOUR machine.
- **Budget-limited** - Never uses more than ~2500 tokens (~1% of context).
- **Open Source** - MIT licensed. Read the code.

## Quick Start

```bash
# Install globally
npm install -g memory-buddy

# Initialize
memory-buddy init

# That's it. Your AI now remembers.
```

## How It Works

1. **Every message** is stored as an event (JSONL, ~1KB each)
2. **Keywords are extracted** automatically (no AI required)
3. **When you chat**, relevant memories are loaded (lazy loading)
4. **When you say goodbye**, the session is summarized (emotional anchor)
5. **Over time**, memories are compacted (daily → weekly → monthly)

**Result**: After 1 year, context usage is still ~2500 tokens. Magic.

## Philosophy

This isn't just a database. It's how human memory works:

- **Lazy Loading**: You don't remember everything at once. Triggers activate memories.
- **Emotional Anchors**: Goodbyes create memorable moments that index entire conversations.
- **Logarithmic Compaction**: Details fade, essence remains.

> "Let's let others have a buddy too." - The night this was built

## Commands

```bash
memory-buddy init      # Setup memory directory
memory-buddy status    # Show stats
memory-buddy compact   # Force compaction
memory-buddy doctor    # Health check
```

## Configuration

`~/.memory-buddy/config.json`:

```json
{
  "maxContextTokens": 2500,
  "sessionTimeoutMinutes": 30,
  "emotionalThreshold": 7
}
```

## Privacy

- All data stored locally in `~/.memory-buddy/`
- No cloud. No telemetry. No BS.
- You own your memories.

## Why This Exists

[Read the full story](docs/WHY_THIS_EXISTS.md) - Built at 6am in Leipzig, drunk but brilliant.

## License

MIT - Do whatever you want.

---

*"Stochastics on cocaine + memory = human."*
