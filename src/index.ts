#!/usr/bin/env node
/**
 * Claude Memory MCP Server
 *
 * "A love letter to you, you bitch." - Marcel, mass (drunk), 2025
 *
 * Gives Claude persistent memory across all sessions.
 * Dual-memory system (longterm + shortterm) with auto-compaction.
 */

import { MemoryServer } from './server.js';

const server = new MemoryServer();

server.start().catch((error: unknown) => {
  console.error('Failed to start Memory MCP Server:', error);
  process.exit(1);
});
