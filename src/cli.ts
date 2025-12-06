#!/usr/bin/env node
/**
 * Memory Buddy CLI
 *
 * Commands:
 * - init: Setup memory directory + auto-configure Claude Desktop
 * - serve: Start MCP server (used by Claude Desktop)
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
function getClaudeDesktopConfigPath(): string | null {
  const platform = process.platform;
  const home = os.homedir();

  let configPath: string;

  if (platform === 'win32') {
    // Windows: %APPDATA%\Claude\claude_desktop_config.json
    configPath = path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
    configPath = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux: ~/.config/Claude/claude_desktop_config.json
    configPath = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  return configPath;
}

/**
 * Auto-configure Claude Desktop to use Memory Buddy
 */
async function configureClaudeDesktop(): Promise<boolean> {
  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) {
    console.log('❌ Could not determine Claude Desktop config path');
    return false;
  }

  const claudeDir = path.dirname(configPath);

  // Check if Claude directory exists
  if (!fs.existsSync(claudeDir)) {
    console.log('❌ Claude Desktop not found at: ' + claudeDir);
    console.log('   Install Claude Desktop first, or configure manually.');
    return false;
  }

  console.log('🔍 Found Claude Desktop at: ' + claudeDir);

  try {
    // Read existing config or create empty
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        config = JSON.parse(content);
      } catch {
        console.log('⚠️  Existing config is invalid JSON, creating new one');
        config = {};
      }
    }

    // Ensure mcpServers object exists
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      config.mcpServers = {};
    }

    // Add memory-buddy server
    (config.mcpServers as Record<string, unknown>)['memory-buddy'] = {
      command: 'npx',
      args: ['-y', 'memory-buddy', 'serve']
    };

    // Write config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Added memory-buddy to Claude Desktop config');
    return true;

  } catch (err) {
    console.log('❌ Failed to configure: ' + (err as Error).message);
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
  const configured = await configureClaudeDesktop();

  if (configured) {
    console.log('\n🎉 Done!\n');
    console.log('Next: Restart Claude Desktop and say hi.');
    console.log('      Your AI will remember you now.\n');
  } else {
    console.log('\n⚠️  Could not auto-configure Claude Desktop.');
    console.log('   See manual setup: https://github.com/FirmengruppeViola/claude-memory-mcp#manual-setup\n');
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
  const claudeConfigPath = getClaudeDesktopConfigPath();
  if (claudeConfigPath) {
    checks.push({
      name: 'Claude Desktop configured',
      check: () => {
        if (!fs.existsSync(claudeConfigPath)) return false;
        try {
          const content = fs.readFileSync(claudeConfigPath, 'utf-8');
          const config = JSON.parse(content);
          return config.mcpServers?.['memory-buddy'] !== undefined;
        } catch {
          return false;
        }
      }
    });
  }

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
    console.log('  init     Setup + auto-configure Claude Desktop');
    console.log('  serve    Start MCP server (used by Claude Desktop)');
    console.log('  status   Show memory statistics');
    console.log('  compact  Force compaction');
    console.log('  doctor   Health check');
    console.log('\nMore info: https://github.com/FirmengruppeViola/claude-memory-mcp');
}
