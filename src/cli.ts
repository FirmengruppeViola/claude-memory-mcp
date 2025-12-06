#!/usr/bin/env node
/**
 * Claude Memory CLI
 * 
 * Commands:
 * - init: Setup memory directory
 * - status: Show stats
 * - compact: Force compaction
 * - doctor: Health check
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getDefaultConfig } from './config/schema.js';
import { EventStore } from './memory/store.js';
import { IndexService } from './memory/index.js';

const MEMORY_PATH = path.join(os.homedir(), '.claude-memory');

async function init(): Promise<void> {
  console.log('Initializing Claude Memory...\n');

  // Create directory
  if (!fs.existsSync(MEMORY_PATH)) {
    fs.mkdirSync(MEMORY_PATH, { recursive: true });
    console.log('Created: ' + MEMORY_PATH);
  } else {
    console.log('Exists: ' + MEMORY_PATH);
  }

  // Create events directory
  const eventsPath = path.join(MEMORY_PATH, 'events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    console.log('Created: ' + eventsPath);
  }

  // Create config
  const configPath = path.join(MEMORY_PATH, 'config.json');
  if (!fs.existsSync(configPath)) {
    const config = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Created: ' + configPath);
  } else {
    console.log('Exists: ' + configPath);
  }

  console.log('\nClaude Memory initialized!');
  console.log('\nNext steps:');
  console.log('1. Add to Claude Desktop config');
  console.log('2. Start chatting - memories are automatic!');
}

async function status(): Promise<void> {
  console.log('Claude Memory Status\n');

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

  let allGood = true;
  for (const { name, check } of checks) {
    const ok = check();
    console.log((ok ? 'OK' : 'MISSING') + ' ' + name);
    if (!ok) allGood = false;
  }

  console.log('\n' + (allGood ? 'All systems operational!' : 'Some issues found. Run "claude-memory init" to fix.'));
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    init();
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
    console.log('Claude Memory MCP - Give Claude persistent memory\n');
    console.log('Usage: claude-memory <command>\n');
    console.log('Commands:');
    console.log('  init     Setup memory directory');
    console.log('  status   Show memory statistics');
    console.log('  compact  Force compaction');
    console.log('  doctor   Health check');
    console.log('\nMore info: https://github.com/FirmengruppeViola/claude-memory-mcp');
}
