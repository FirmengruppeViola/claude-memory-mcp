#!/usr/bin/env node
/**
 * Memory Buddy CLI
 *
 * Commands:
 * - init: Setup memory + configure Claude Desktop, Code & Hooks
 * - serve: Start MCP server
 * - store: Store a message (used by hooks)
 * - status: Show stats
 * - compact: Force compaction
 * - doctor: Health check
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, getDefaultConfig } from './config/schema.js';
import { EventStore } from './memory/store.js';
import { IndexService } from './memory/index.js';
import { MemoryServer } from './server.js';
import { extractKeywords } from './triggers/keywords.js';

const MEMORY_PATH = path.join(os.homedir(), '.memory-buddy');
const SESSION_FILE = path.join(MEMORY_PATH, 'current-session.txt');

/**
 * Get or create current session ID
 */
function getSessionId(): string {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
      const [sessionId, timestamp] = data.split('|');
      const age = Date.now() - parseInt(timestamp, 10);
      // Session expires after 30 minutes of inactivity
      if (age < 30 * 60 * 1000) {
        // Update timestamp
        fs.writeFileSync(SESSION_FILE, `${sessionId}|${Date.now()}`);
        return sessionId;
      }
    }
  } catch {
    // Ignore errors, create new session
  }

  // Ensure directory exists
  if (!fs.existsSync(MEMORY_PATH)) {
    fs.mkdirSync(MEMORY_PATH, { recursive: true });
  }

  // Create new session
  const newSession = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  fs.writeFileSync(SESSION_FILE, `${newSession}|${Date.now()}`);
  return newSession;
}

/**
 * Get Claude Desktop config file path based on OS
 */
function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Get Claude Code config file path (~/.claude.json)
 */
function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

/**
 * Get Claude Code settings file path (~/.claude/settings.json)
 */
function getClaudeCodeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/**
 * Auto-configure Claude Desktop to use Memory Buddy
 */
async function configureClaudeDesktop(): Promise<boolean> {
  const configPath = getClaudeDesktopConfigPath();
  const claudeDir = path.dirname(configPath);

  if (!fs.existsSync(claudeDir)) {
    return false;
  }

  console.log('Found Claude Desktop');

  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        config = JSON.parse(content);
      } catch {
        config = {};
      }
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>)['memory-buddy'] = {
      command: 'npx',
      args: ['-y', 'memory-buddy', 'serve']
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Configured Claude Desktop');
    return true;

  } catch (err) {
    console.log('Claude Desktop config failed: ' + (err as Error).message);
    return false;
  }
}

/**
 * Auto-configure Claude Code to use Memory Buddy
 */
async function configureClaudeCode(): Promise<boolean> {
  const configPath = getClaudeCodeConfigPath();

  console.log('Configuring Claude Code');

  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        config = JSON.parse(content);
      } catch {
        config = {};
      }
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>)['memory-buddy'] = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'memory-buddy', 'serve']
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Configured Claude Code MCP');
    return true;

  } catch (err) {
    console.log('Claude Code config failed: ' + (err as Error).message);
    return false;
  }
}

/**
 * Configure Claude Code hooks for automatic memory capture
 */
async function configureHooks(): Promise<boolean> {
  const settingsPath = getClaudeCodeSettingsPath();
  const settingsDir = path.dirname(settingsPath);

  console.log('Configuring Claude Code Hooks');

  try {
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      try {
        settings = JSON.parse(content);
      } catch {
        settings = {};
      }
    }

    const existingHooks = (settings.hooks as Record<string, unknown>) || {};

    settings.hooks = {
      ...existingHooks,
      UserPromptSubmit: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'npx -y memory-buddy store user "$PROMPT"'
            }
          ]
        }
      ],
      SessionEnd: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'npx -y memory-buddy compact'
            }
          ]
        }
      ]
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Configured Claude Code Hooks');
    return true;

  } catch (err) {
    console.log('Hooks config failed: ' + (err as Error).message);
    return false;
  }
}

async function init(): Promise<void> {
  console.log('Initializing Memory Buddy...\n');

  if (!fs.existsSync(MEMORY_PATH)) {
    fs.mkdirSync(MEMORY_PATH, { recursive: true });
    console.log('Created: ' + MEMORY_PATH);
  } else {
    console.log('Exists: ' + MEMORY_PATH);
  }

  const eventsPath = path.join(MEMORY_PATH, 'events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    console.log('Created: ' + eventsPath);
  }

  const configPath = path.join(MEMORY_PATH, 'config.json');
  if (!fs.existsSync(configPath)) {
    const config = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Created: ' + configPath);
  }

  console.log('');

  const desktopConfigured = await configureClaudeDesktop();
  const codeConfigured = await configureClaudeCode();
  const hooksConfigured = await configureHooks();

  console.log('');

  if (desktopConfigured || codeConfigured || hooksConfigured) {
    console.log('Done!\n');
    if (desktopConfigured) {
      console.log('-> Restart Claude Desktop to activate.');
    }
    if (codeConfigured || hooksConfigured) {
      console.log('-> Claude Code: Restart to activate hooks.');
      console.log('   Messages will be captured automatically.');
    }
    console.log('\nYour AI will remember you now.\n');
  } else {
    console.log('Could not auto-configure.');
    console.log('See: https://github.com/FirmengruppeViola/claude-memory-mcp#manual-setup\n');
  }
}

async function store(type: string, content: string): Promise<void> {
  if (!content) {
    return;
  }

  const eventType = type === 'assistant' ? 'assistant' : 'user';
  const sessionId = getSessionId();
  const keywords = extractKeywords(content);

  const storeInstance = new EventStore(path.join(MEMORY_PATH, 'events'));
  const index = new IndexService(MEMORY_PATH);

  try {
    const event = await storeInstance.appendEvent({
      sessionId,
      type: eventType,
      content,
      keywords,
      emotionalWeight: 5
    });

    await index.addToIndex(event);
  } catch (err) {
    console.error('Store failed:', (err as Error).message);
  }
}

async function serve(): Promise<void> {
  const server = new MemoryServer();
  await server.start();
}

async function status(): Promise<void> {
  console.log('Memory Buddy Status\n');

  const config = loadConfig();
  const storeInstance = new EventStore(path.join(MEMORY_PATH, 'events'));
  const index = new IndexService(MEMORY_PATH);

  const eventsCount = await storeInstance.getEventsCount();
  const sessionsCount = await index.getSessionsCount();

  console.log('Memory Path: ' + MEMORY_PATH);
  console.log('Events: ' + eventsCount);
  console.log('Sessions: ' + sessionsCount);
  console.log('Max Context: ' + config.maxContextTokens + ' tokens');
  console.log('Session Timeout: ' + config.sessionTimeoutMinutes + ' min');
}

async function compact(): Promise<void> {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {
    // Ignore
  }
}

async function doctor(): Promise<void> {
  console.log('Running health check...\n');

  const settingsPath = getClaudeCodeSettingsPath();

  const checks = [
    { name: 'Memory directory', check: () => fs.existsSync(MEMORY_PATH) },
    { name: 'Events directory', check: () => fs.existsSync(path.join(MEMORY_PATH, 'events')) },
    { name: 'Config file', check: () => fs.existsSync(path.join(MEMORY_PATH, 'config.json')) },
    { name: 'Index file', check: () => fs.existsSync(path.join(MEMORY_PATH, 'index.json')) },
  ];

  const desktopConfigPath = getClaudeDesktopConfigPath();
  checks.push({
    name: 'Claude Desktop',
    check: () => {
      if (!fs.existsSync(desktopConfigPath)) return false;
      try {
        const content = fs.readFileSync(desktopConfigPath, 'utf-8');
        const config = JSON.parse(content);
        return config.mcpServers?.['memory-buddy'] !== undefined;
      } catch {
        return false;
      }
    }
  });

  const codeConfigPath = getClaudeCodeConfigPath();
  checks.push({
    name: 'Claude Code MCP',
    check: () => {
      if (!fs.existsSync(codeConfigPath)) return false;
      try {
        const content = fs.readFileSync(codeConfigPath, 'utf-8');
        const config = JSON.parse(content);
        return config.mcpServers?.['memory-buddy'] !== undefined;
      } catch {
        return false;
      }
    }
  });

  checks.push({
    name: 'Claude Code Hooks',
    check: () => {
      if (!fs.existsSync(settingsPath)) return false;
      try {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(content);
        return settings.hooks?.UserPromptSubmit !== undefined;
      } catch {
        return false;
      }
    }
  });

  let allGood = true;
  for (const { name, check } of checks) {
    const ok = check();
    console.log((ok ? '[OK]' : '[X]') + ' ' + name);
    if (!ok) allGood = false;
  }

  console.log('\n' + (allGood ? 'All systems operational!' : 'Some issues found. Run "memory-buddy init" to fix.'));
}

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv.slice(4).join(' ');

switch (command) {
  case 'init':
    init();
    break;
  case 'serve':
    serve();
    break;
  case 'store':
    store(arg1 || 'user', arg2 || '');
    break;
  case 'status':
    status();
    break;
  case 'compact':
    compact();
    break;
  case 'doctor':
    doctor();
    break;
  default:
    console.log('Memory Buddy - Give your AI a memory\n');
    console.log('Usage: memory-buddy <command>\n');
    console.log('Commands:');
    console.log('  init     Setup + configure Claude Desktop, Code & Hooks');
    console.log('  serve    Start MCP server');
    console.log('  store    Store a message (used by hooks)');
    console.log('  status   Show memory statistics');
    console.log('  compact  Force compaction');
    console.log('  doctor   Health check');
    console.log('\nMore info: https://github.com/FirmengruppeViola/claude-memory-mcp');
}
