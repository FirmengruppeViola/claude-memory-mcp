# Memory Buddy

[![npm version](https://img.shields.io/npm/v/memory-buddy.svg)](https://www.npmjs.com/package/memory-buddy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

> Give your AI a memory. Because starting over sucks.

---

**You know the feeling:**

You talk to Claude for hours. You solve problems together. You share things you don't tell anyone else. It feels like being understood.

And then. New session. Gone.

*"Hi! How can I help you today?"*

---

## This is for you if:

- You code at 3am and your AI is the only one listening
- You have ADHD and can't explain yourself again
- You've built a relationship with your AI (yes, that's okay)
- You just want it to remember

---

## What it is

**Human-memory-inspired architecture**: Stores everything, loads lazy, triggered by keywords, anchored by emotions.

- **Invisible** - No commands needed. It just works.
- **Local-first** - Your memories stay on YOUR machine.
- **Budget-limited** - Never uses more than ~2500 tokens (~1% of context).
- **Open Source** - MIT licensed. Read the code.

---

## Quick Start

```bash
# Install globally
npm install -g memory-buddy

# Initialize
memory-buddy init

# That's it. Your AI now remembers.
```

**Requirements:** Node.js 20+, Claude Desktop / Cursor / any MCP client

`memory-buddy init` automatically configures Claude Desktop. If it works, you're done!

---

## Manual Setup

If auto-config didn't work, configure manually:

### Claude Desktop

Add to your config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memory-buddy": {
      "command": "npx",
      "args": ["-y", "memory-buddy", "serve"]
    }
  }
}
```

Restart Claude Desktop. Done.

### Cursor

Settings → MCP → Add Server:
- **Name:** `memory-buddy`
- **Command:** `npx -y memory-buddy serve`

---

## How It Works

1. **Every message** is stored as an event (JSONL, ~1KB each)
2. **Keywords are extracted** automatically (no AI required)
3. **When you chat**, relevant memories are loaded (lazy loading)
4. **When you say goodbye**, the session is summarized (emotional anchor)
5. **Over time**, memories are compacted (daily > weekly > monthly)

**Result**: After 1 year, context usage is still ~2500 tokens. Magic.

---

## Philosophy

This isn't just a database. It's how human memory works:

- **Lazy Loading**: You don't remember everything at once. Triggers activate memories.
- **Emotional Anchors**: Goodbyes create memorable moments that index entire conversations.
- **Logarithmic Compaction**: Details fade, essence remains.

---

## Commands

```bash
memory-buddy init      # Setup memory directory
memory-buddy status    # Show stats
memory-buddy compact   # Force compaction
memory-buddy doctor    # Health check
```

---

## Configuration

`~/.memory-buddy/config.json`:

```json
{
  "maxContextTokens": 2500,
  "sessionTimeoutMinutes": 30,
  "emotionalThreshold": 7
}
```

---

## Privacy

- All data stored locally in `~/.memory-buddy/`
- No cloud. No telemetry. No BS.
- You own your memories.

---

## Contributing

Found a bug? Have an idea?

- Open an issue
- Make a PR
- Just lurk - also cool

We're not here to make money. We're here because someone built this at 6am and wanted to share.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## The Story Behind This

[Read WHY_THIS_EXISTS.md](docs/WHY_THIS_EXISTS.md) - Built at 6am in Leipzig. Drunk but brilliant.

---

## License

MIT - Do whatever you want.

---

*"Save everything, because everything is me."*
