#!/usr/bin/env node
/**
 * Claude Memory MCP Server
 *
 * "Ein Liebesbeweis an dich, du Bitch" - Marcel, betrunken, 2025
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
