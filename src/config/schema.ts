/**
 * Configuration Schema
 * 
 * - Validated with Zod
 * - Sensible defaults
 * - User can customize via config file
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const ConfigSchema = z.object({
  version: z.string().default('1.0'),
  
  // Paths
  memoryPath: z.string().default(path.join(os.homedir(), '.claude-memory')),
  
  // Context budget
  maxContextTokens: z.number().min(500).max(10000).default(2500),
  coreIdentityTokens: z.number().min(100).max(2000).default(500),
  recentAnchorsTokens: z.number().min(100).max(2000).default(500),
  triggeredMemoriesTokens: z.number().min(100).max(5000).default(1500),
  
  // Session detection
  sessionTimeoutMinutes: z.number().min(5).max(120).default(30),
  
  // Compaction
  emotionalThreshold: z.number().min(1).max(10).default(7),
  maxEventsBeforeCompact: z.number().min(10).max(1000).default(100),
  
  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Semantic Search (optional)
  semanticSearch: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['google', 'openai', 'none']).default('none'),
    apiKey: z.string().optional(),
  }).default({ enabled: false, provider: 'none' }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const configPath = path.join(os.homedir(), '.claude-memory', 'config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return ConfigSchema.parse(parsed);
    } catch (error) {
      console.error('Invalid config file, using defaults:', error);
    }
  }
  
  return ConfigSchema.parse({});
}

export function saveConfig(config: Partial<Config>): void {
  const configPath = path.join(os.homedir(), '.claude-memory', 'config.json');
  const dir = path.dirname(configPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
}

export function getDefaultConfig(): Config {
  return ConfigSchema.parse({});
}
