/**
 * MCP Server Implementation
 *
 * Core server that handles all MCP protocol communication.
 * Auto-increments counter after EVERY tool call.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MemoryManager } from './memory/manager.js';
import { Counter } from './memory/counter.js';
import { Compactor } from './memory/compactor.js';
import { Config, loadConfig } from './config/schema.js';

export class MemoryServer {
  private server: Server;
  private memory: MemoryManager;
  private counter: Counter;
  private compactor: Compactor;
  private config: Config;

  constructor() {
    this.config = loadConfig();
    this.memory = new MemoryManager(this.config);
    this.counter = new Counter(this.memory);
    this.compactor = new Compactor(this.memory, this.config);

    this.server = new Server(
      {
        name: 'claude-memory-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'memory_read',
          description: 'Read current memory state (longterm, shortterm, or both)',
          inputSchema: {
            type: 'object' as const,
            properties: {
              scope: {
                type: 'string',
                enum: ['longterm', 'shortterm', 'both'],
                default: 'both',
                description: 'Which memory to read',
              },
            },
          },
        },
        {
          name: 'memory_update',
          description: 'Add insight to shortterm memory',
          inputSchema: {
            type: 'object' as const,
            properties: {
              content: {
                type: 'string',
                description: 'The insight to add',
              },
              importance: {
                type: 'number',
                minimum: 0,
                maximum: 10,
                default: 5,
                description: 'Importance level (0-10)',
              },
              section: {
                type: 'string',
                enum: ['NOW', 'RECENT', 'ACTIVE', 'INSIGHTS'],
                default: 'INSIGHTS',
                description: 'Which section to add to',
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'memory_compact',
          description: 'Trigger manual compaction (compress shortterm into longterm)',
          inputSchema: {
            type: 'object' as const,
            properties: {
              force: {
                type: 'boolean',
                default: false,
                description: 'Force compaction even if threshold not reached',
              },
            },
          },
        },
        {
          name: 'memory_status',
          description: 'Get current counter and system status',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
      ],
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'memory://longterm',
          name: 'Long-term Memory',
          description: 'Persistent knowledge and history',
          mimeType: 'text/markdown',
        },
        {
          uri: 'memory://shortterm',
          name: 'Short-term Memory',
          description: 'Recent activity and working context',
          mimeType: 'text/markdown',
        },
        {
          uri: 'memory://status',
          name: 'Memory System Status',
          description: 'Counter, last compaction, health',
          mimeType: 'application/json',
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      switch (uri) {
        case 'memory://longterm':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: await this.memory.readLongterm(),
              },
            ],
          };

        case 'memory://shortterm':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: await this.memory.readShortterm(),
              },
            ],
          };

        case 'memory://status':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(await this.getStatus(), null, 2),
              },
            ],
          };

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: unknown;

        switch (name) {
          case 'memory_read':
            result = await this.handleMemoryRead(args as { scope?: string });
            break;

          case 'memory_update':
            result = await this.handleMemoryUpdate(
              args as { content: string; importance?: number; section?: string }
            );
            break;

          case 'memory_compact':
            result = await this.handleMemoryCompact(args as { force?: boolean });
            break;

          case 'memory_status':
            result = await this.getStatus();
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // AUTO-INCREMENT COUNTER AFTER EVERY TOOL CALL
        // This is the CORE innovation - external enforcement!
        await this.incrementAndCheckThreshold();

        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async incrementAndCheckThreshold(): Promise<void> {
    await this.counter.increment();
    const count = await this.counter.getValue();

    // Warning at threshold - 5
    if (count === this.config.threshold - 5) {
      console.error(`[Memory] Warning: ${5} messages until compaction`);
    }

    // Auto-compaction at threshold
    if (count >= this.config.threshold) {
      console.error('[Memory] Threshold reached, triggering auto-compaction...');
      await this.compactor.compact();
      await this.counter.reset();
      console.error('[Memory] Compaction complete, counter reset');
    }
  }

  private async handleMemoryRead(args: { scope?: string }): Promise<string> {
    const scope = args.scope ?? 'both';

    switch (scope) {
      case 'longterm':
        return await this.memory.readLongterm();
      case 'shortterm':
        return await this.memory.readShortterm();
      case 'both':
      default:
        const longterm = await this.memory.readLongterm();
        const shortterm = await this.memory.readShortterm();
        return `# LONGTERM MEMORY\n\n${longterm}\n\n---\n\n# SHORTTERM MEMORY\n\n${shortterm}`;
    }
  }

  private async handleMemoryUpdate(args: {
    content: string;
    importance?: number;
    section?: string;
  }): Promise<string> {
    const { content, importance = 5, section = 'INSIGHTS' } = args;

    await this.memory.addInsight(content, importance, section);

    return `Added to ${section} (importance: ${importance}/10):\n${content}`;
  }

  private async handleMemoryCompact(args: { force?: boolean }): Promise<string> {
    const { force = false } = args;
    const count = await this.counter.getValue();

    if (!force && count < this.config.threshold) {
      return `Compaction not needed. Counter: ${count}/${this.config.threshold}. Use force=true to override.`;
    }

    await this.compactor.compact();
    await this.counter.reset();

    return `Compaction complete. Counter reset to 0/${this.config.threshold}.`;
  }

  private async getStatus(): Promise<object> {
    const count = await this.counter.getValue();
    const metadata = await this.memory.getMetadata();

    return {
      counter: count,
      threshold: this.config.threshold,
      lastCompaction: metadata.lastCompaction,
      lastUpdate: metadata.lastUpdate,
      profile: this.config.activeProfile,
      health: 'ok',
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Memory] Claude Memory MCP Server started');
    console.error(`[Memory] Threshold: ${this.config.threshold} messages`);
  }
}
