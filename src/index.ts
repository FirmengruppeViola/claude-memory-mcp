/**
 * Claude Memory MCP Server
 * 
 * Human-memory-inspired architecture:
 * - Stores everything
 * - Loads lazy (triggered by keywords)
 * - Anchors emotional moments
 * - Budget-limited context loading
 * 
 * Created: 2025-12-06 (Leipzig, betrunken, brilliant)
 */

import { MemoryServer } from './server.js';

const server = new MemoryServer();

server.start().catch((error) => {
  console.error('Failed to start Memory MCP Server:', error);
  process.exit(1);
});
