#!/usr/bin/env node
/**
 * Claude Memory CLI
 *
 * Command-line interface for managing Claude Memory MCP Server.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, Config } from './config/schema.js';
import { MemoryManager } from './memory/manager.js';
import { Counter } from './memory/counter.js';

const MEMORY_DIR = path.join(os.homedir(), '.claude-memory');

// Colors for terminal output
const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function init(): Promise<void> {
  console.log(colors.bold('\n🧠 Claude Memory MCP - Initialization\n'));

  // Create directory
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    console.log(colors.green('✅ Created directory: ' + MEMORY_DIR));
  } else {
    console.log(colors.yellow('⚠️  Directory already exists: ' + MEMORY_DIR));
  }

  // Create config
  const configPath = path.join(MEMORY_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig: Config = {
      version: '1.0',
      threshold: 20,
      importanceThreshold: 7,
      memoryPath: MEMORY_DIR,
      activeProfile: 'default',
      profiles: {
        default: {
          longterm: 'longterm_memory.md',
          shortterm: 'shortterm_memory.md',
          enabled: true,
        },
      },
      compression: {
        maxShorttermSize: 2000,
        maxLongtermSize: 10000,
        strategy: 'importance-based',
      },
      logging: {
        level: 'info',
      },
    };
    saveConfig(defaultConfig);
    console.log(colors.green('✅ Created config: ' + configPath));
  } else {
    console.log(colors.yellow('⚠️  Config already exists: ' + configPath));
  }

  // Initialize memory files
  const config = loadConfig();
  const manager = new MemoryManager(config);
  await manager.initialize();
  console.log(colors.green('✅ Memory files initialized'));

  console.log(colors.bold('\n🚀 Ready! Run "claude-memory setup" to configure Claude Desktop.\n'));
}

async function status(): Promise<void> {
  console.log(colors.bold('\n🧠 Claude Memory Status\n'));

  const config = loadConfig();
  const manager = new MemoryManager(config);
  const counter = new Counter(manager);

  try {
    const count = await counter.getValue();
    const metadata = await manager.getMetadata();

    console.log(`Counter:        ${colors.blue(count.toString())}/${config.threshold}`);
    console.log(`Profile:        ${metadata.profile}`);
    console.log(`Last Update:    ${metadata.lastUpdate}`);
    console.log(`Last Compaction: ${metadata.lastCompaction}`);
    console.log(`Memory Path:    ${config.memoryPath}`);
    console.log(`Threshold:      ${config.threshold} messages`);
    console.log(`Importance:     ${config.importanceThreshold}/10 minimum`);

    // Progress bar
    const progress = Math.min(count / config.threshold, 1);
    const barWidth = 30;
    const filled = Math.round(progress * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    const barColor = progress >= 0.75 ? colors.red : progress >= 0.5 ? colors.yellow : colors.green;
    console.log(`\nProgress:       ${barColor(bar)} ${Math.round(progress * 100)}%`);

    if (count >= config.threshold - 5) {
      console.log(colors.yellow(`\n⚠️  Warning: ${config.threshold - count} messages until compaction!`));
    }

    console.log('');
  } catch (error) {
    console.log(colors.red('❌ Error reading memory. Run "claude-memory init" first.'));
    console.error(error);
  }
}

async function setup(): Promise<void> {
  console.log(colors.bold('\n🔧 Claude Memory - Setup for Claude Desktop\n'));

  // Find Claude Desktop config
  const possiblePaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'), // Windows
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'), // macOS
    path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json'), // Linux
  ];

  let configPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  // Build server path
  const serverPath = path.join(__dirname, 'index.js');

  const mcpConfig = {
    mcpServers: {
      'claude-memory': {
        command: 'node',
        args: [serverPath],
      },
    },
  };

  if (configPath) {
    // Read existing config
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const mcpServers = (existing['mcpServers'] as Record<string, unknown>) || {};

    // Add our server
    mcpServers['claude-memory'] = mcpConfig.mcpServers['claude-memory'];
    existing['mcpServers'] = mcpServers;

    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    console.log(colors.green('✅ Updated Claude Desktop config: ' + configPath));
  } else {
    // Create new config
    const newPath = possiblePaths[0];
    if (newPath) {
      const dir = path.dirname(newPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(newPath, JSON.stringify(mcpConfig, null, 2));
      console.log(colors.green('✅ Created Claude Desktop config: ' + newPath));
    }
  }

  console.log(colors.bold('\n📝 Manual setup (if needed):\n'));
  console.log('Add this to your claude_desktop_config.json:\n');
  console.log(JSON.stringify(mcpConfig, null, 2));
  console.log(colors.bold('\n🔄 Restart Claude Desktop to apply changes.\n'));
}

async function compact(): Promise<void> {
  console.log(colors.bold('\n🔄 Manual Compaction\n'));

  const config = loadConfig();
  const manager = new MemoryManager(config);
  const counter = new Counter(manager);

  const count = await counter.getValue();
  console.log(`Current counter: ${count}/${config.threshold}`);

  // Import compactor
  const { Compactor } = await import('./memory/compactor.js');
  const compactor = new Compactor(manager, config);

  console.log('Compacting...');
  await compactor.compact();
  await counter.reset();

  console.log(colors.green('✅ Compaction complete!'));
  console.log('Counter reset to 0/' + config.threshold);
  console.log('');
}

function help(): void {
  console.log(colors.bold('\n🧠 Claude Memory MCP - CLI\n'));
  console.log('Usage: claude-memory <command>\n');
  console.log('Commands:');
  console.log('  init      Initialize memory directory and config');
  console.log('  status    Show current counter and status');
  console.log('  setup     Configure Claude Desktop');
  console.log('  compact   Trigger manual compaction');
  console.log('  help      Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  claude-memory init');
  console.log('  claude-memory status');
  console.log('');
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    init().catch(console.error);
    break;
  case 'status':
    status().catch(console.error);
    break;
  case 'setup':
    setup().catch(console.error);
    break;
  case 'compact':
    compact().catch(console.error);
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    if (command) {
      console.log(colors.red(`Unknown command: ${command}`));
    }
    help();
}
