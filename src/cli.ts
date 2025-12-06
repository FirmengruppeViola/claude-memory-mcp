#!/usr/bin/env node
/**
 * Memory Buddy CLI
 *
 * Commands:
 * - init: Setup memory directory + auto-configure Claude Desktop & Claude Code
 * - serve: Start MCP server
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

const MEMORY_PATH = path.join(os.homedir(), '.memory-buddy');

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
 * Auto-configure Claude Desktop to use Memory Buddy
 */
async function configureClaudeDesktop(): Promise<boolean> {
  const configPath = getClaudeDesktopConfigPath();
  const claudeDir = path.dirname(configPath);

  // Check if Claude directory exists
  if (!fs.existsSync(claudeDir)) {
    return false;
  }

  console.log('🔍 Found Claude Desktop');

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
    console.log('✅ Configured Claude Desktop');
    return true;

  } catch (err) {
    console.log('❌ Claude Desktop config failed: ' + (err as Error).message);
    return false;
  }
}

/**
 * Auto-configure Claude Code to use Memory Buddy
 */
async function configureClaudeCode(): Promise<boolean> {
  const configPath = getClaudeCodeConfigPath();

  console.log('🔍 Configuring Claude Code');

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

    // Claude Code uses type: "stdio" explicitly
    (config.mcpServers as Record<string, unknown>)['memory-buddy'] = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'memory-buddy', 'serve']
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Configured Claude Code');
    return true;

  } catch (err) {
    console.log('❌ Claude Code config failed: ' + (err as Error).message);
    return false;
  }
}

async function init(): Promise<void> {
  console.log('🚀 Initializing Memory Buddy...\n');

  // Create directory
  if (!fs.existsSync(MEMORY_PATH)) {
    fs.mkdirSync(MEMORY_PATH, { recursive: true });
    console.log('✅ Created: ' + MEMORY_PATH);
  } else {
    console.log('✅ Exists: ' + MEMORY_PATH);
  }

  // Create events directory
  const eventsPath = path.join(MEMORY_PATH, 'events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    console.log('✅ Created: ' + eventsPath);
  }

  // Create config
  const configPath = path.join(MEMORY_PATH, 'config.json');
  if (!fs.existsSync(configPath)) {
    const config = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Created: ' + configPath);
  }

  console.log('');

  // Auto-configure Claude Desktop
  const desktopConfigured = await configureClaudeDesktop();

  // Auto-configure Claude Code
  const codeConfigured = await configureClaudeCode();

  console.log('');

  if (desktopConfigured || codeConfigured) {
    console.log('🎉 Done!\n');
    if (desktopConfigured) {
      console.log('→ Restart Claude Desktop to activate.');
    }
    if (codeConfigured) {
      console.log('→ Claude Code is ready (restart if running).');
    }
    console.log('\nYour AI will remember you now.\n');
  } else {
    console.log('⚠️  Could not auto-configure.');
    console.log('   See: https://github.com/FirmengruppeViola/claude-memory-mcp#manual-setup\n');
  }
}

async function serve(): Promise<void> {
  const server = new MemoryServer();
  await server.start();
}

async function status(): Promise<void> {
  console.log('Memory Buddy Status\n');

  const config = loadConfig();
  const store = new EventStore();
  const index = new IndexService();

  const eventsCount = await store.getEventsCount();
  const sessionsCount = await index.getSessionsCount();

  console.log('Memory Path: ' + config.memoryPath);
  console.log('Events: ' + eventsCount);
  console.log('Sessions: ' + sessionsCount);
  console.log('Max Context: ' + config.maxContextTokens + ' tokens');
  console.log('Session Timeout: ' + config.sessionTimeoutMinutes + ' min');
}

async function compact(): Promise<void> {
  console.log('Compacting current session...');
  // TODO: Implement actual compaction
  console.log('Done!');
}

async function doctor(): Promise<void> {
  console.log('Running health check...\n');

  const checks = [
    { name: 'Memory directory', check: () => fs.existsSync(MEMORY_PATH) },
    { name: 'Events directory', check: () => fs.existsSync(path.join(MEMORY_PATH, 'events')) },
    { name: 'Config file', check: () => fs.existsSync(path.join(MEMORY_PATH, 'config.json')) },
    { name: 'Index file', check: () => fs.existsSync(path.join(MEMORY_PATH, 'index.json')) },
  ];

  // Check Claude Desktop config
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

  // Check Claude Code config
  const codeConfigPath = getClaudeCodeConfigPath();
  checks.push({
    name: 'Claude Code',
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

  let allGood = true;
  for (const { name, check } of checks) {
    const ok = check();
    console.log((ok ? '✅' : '❌') + ' ' + name);
    if (!ok) allGood = false;
  }

  console.log('\n' + (allGood ? '🎉 All systems operational!' : '⚠️  Some issues found. Run "memory-buddy init" to fix.'));
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'serve':
    serve();
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
    console.log('  init     Setup + configure Claude Desktop & Code');
    console.log('  serve    Start MCP server');
    console.log('  status   Show memory statistics');
    console.log('  compact  Force compaction');
    console.log('  doctor   Health check');
    console.log('\nMore info: https://github.com/FirmengruppeViola/claude-memory-mcp');
}
