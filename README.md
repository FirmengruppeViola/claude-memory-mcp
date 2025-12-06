# Claude Memory MCP Server

> *"A love letter to you, you bitch."* - Marcel, mass (drunk), 2025

**Give Claude persistent memory across all sessions.**

MCP server that implements a dual-memory system (longterm + shortterm) with automatic compaction. Never re-explain context again.

## 🧠 What It Does

- **Auto-tracks message count** after every interaction
- **Auto-compacts at threshold** (default: 20 messages)
- **Filters by importance** (keeps what matters, discards noise)
- **Preserves active context** (NOW/ACTIVE/NEXT sections survive compaction)
- **Works with any MCP client** (Claude Desktop, Cursor, etc.)

## 🚀 Quick Start

```bash
# Install globally
npm install -g claude-memory-mcp

# Initialize memory directory
claude-memory init

# Add to Claude Desktop config
claude-memory setup
```

## 📁 Memory Structure

```
~/.claude-memory/
├── config.json           # Configuration
├── longterm_memory.md    # Persistent knowledge (grows slowly)
└── shortterm_memory.md   # Rolling window (compacts every 20 messages)
```

### Longterm Memory
- Identity, goals, core knowledge
- Compressed history of major decisions
- Grows ~5k tokens after 1 year

### Shortterm Memory
- Current focus, recent sessions
- Active questions/tasks
- Resets every compaction cycle
- Stays constant ~2k tokens

## 🔧 Configuration

Edit `~/.claude-memory/config.json`:

```json
{
  "threshold": 20,
  "importanceThreshold": 7,
  "memoryPath": "~/.claude-memory",
  "activeProfile": "default"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `threshold` | 20 | Messages before compaction |
| `importanceThreshold` | 7 | Minimum importance (0-10) to preserve |
| `memoryPath` | ~/.claude-memory | Where to store memory files |
| `activeProfile` | default | Which profile to use |

## 🛠 MCP Tools

| Tool | Description |
|------|-------------|
| `memory_read` | Read longterm, shortterm, or both |
| `memory_update` | Add insight with importance level |
| `memory_compact` | Trigger manual compaction |
| `memory_status` | Get counter and system status |

## 🗂 MCP Resources

| URI | Description |
|-----|-------------|
| `memory://longterm` | Longterm memory content |
| `memory://shortterm` | Shortterm memory content |
| `memory://status` | System status (JSON) |

## 💡 How It Works

```
User ←→ MCP Server ←→ Claude

Every tool call:
1. Execute the tool
2. Increment counter (automatic!)
3. Check threshold
4. If reached → compact → reset
```

The key innovation: **External enforcement**. Claude can't forget to count because the counting happens outside Claude's context.

## 🧪 Development

```bash
# Clone
git clone https://github.com/FirmengruppeViola/claude-memory-mcp
cd claude-memory-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## 📄 License

MIT © Marcel Viola

---

**Built with love, TypeScript, and a bit of alcohol.** 🥃
