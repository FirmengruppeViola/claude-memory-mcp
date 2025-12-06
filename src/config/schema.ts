/**
 * Configuration Schema
 *
 * Defines and validates configuration for the memory system.
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Schema definition
const ConfigSchema = z.object({
  version: z.string().default('1.0'),
  threshold: z.number().min(1).max(100).default(20),
  importanceThreshold: z.number().min(0).max(10).default(7),
  memoryPath: z.string().default(path.join(os.homedir(), '.claude-memory')),
  activeProfile: z.string().default('default'),

  profiles: z
    .record(
      z.string(),
      z.object({
        longterm: z.string(),
        shortterm: z.string(),
        enabled: z.boolean().default(true),
      })
    )
    .default({
      default: {
        longterm: 'longterm_memory.md',
        shortterm: 'shortterm_memory.md',
        enabled: true,
      },
    }),

  compression: z
    .object({
      maxShorttermSize: z.number().default(2000),
      maxLongtermSize: z.number().default(10000),
      strategy: z.enum(['importance-based', 'time-based']).default('importance-based'),
    })
    .default({
      maxShorttermSize: 2000,
      maxLongtermSize: 10000,
      strategy: 'importance-based',
    }),

  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      file: z.string().optional(),
    })
    .default({
      level: 'info',
    }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  version: '1.0',
  threshold: 20,
  importanceThreshold: 7,
  memoryPath: path.join(os.homedir(), '.claude-memory'),
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

/**
 * Get path to config file
 */
function getConfigPath(): string {
  return path.join(os.homedir(), '.claude-memory', 'config.json');
}

/**
 * Load configuration from file or use defaults
 */
export function loadConfig(): Config {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      const validated = ConfigSchema.parse(parsed);
      return validated;
    }
  } catch (error) {
    console.error('[Memory] Error loading config, using defaults:', error);
  }

  return DEFAULT_CONFIG;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Validate configuration
 */
export function validateConfig(config: unknown): Config {
  return ConfigSchema.parse(config);
}
