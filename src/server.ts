/**
 * MCP Server Implementation
 * 
 * Core responsibilities:
 * - Intercept all Claude interactions
 * - Auto-store every message as event
 * - Load relevant context (lazy loading)
 * - Detect session boundaries
 * - Trigger compaction on session end
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { EventStore } from './memory/store.js';
import { IndexService } from './memory/index.js';
import { ContextLoader } from './memory/loader.js';
import { Compactor } from './memory/compactor.js';

export class MemoryServer {
  private server: Server;
  private store: EventStore;
  private index: IndexService;
  private loader: ContextLoader;
  private compactor: Compactor;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-memory',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize components
    this.store = new EventStore();
    this.index = new IndexService();
    this.loader = new ContextLoader(this.store, this.index);
    this.compactor = new Compactor(this.store, this.index);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'memory_status',
          description: 'Get memory system status (events count, last session, etc.)',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'memory_search',
          description: 'Search through memories by keyword',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'memory_compact',
          description: 'Force compaction of current session',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'memory_status':
          return this.handleStatus();
        case 'memory_search':
          return this.handleSearch(args?.query as string);
        case 'memory_compact':
          return this.handleCompact();
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'memory://context',
          name: 'Memory Context',
          description: 'Current relevant memory context for Claude',
          mimeType: 'text/plain',
        },
        {
          uri: 'memory://status',
          name: 'Memory Status',
          description: 'Memory system status and statistics',
          mimeType: 'application/json',
        },
      ],
    }));

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'memory://context':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: await this.loader.buildContext(''),
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
  }

  private async handleStatus() {
    const status = await this.getStatus();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  private async handleSearch(query: string) {
    const results = await this.index.lookup(query.split(' '));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async handleCompact() {
    await this.compactor.compactCurrentSession();
    return {
      content: [
        {
          type: 'text',
          text: 'Session compacted successfully.',
        },
      ],
    };
  }

  private async getStatus() {
    return {
      version: '0.1.0',
      eventsCount: await this.store.getEventsCount(),
      sessionsCount: await this.index.getSessionsCount(),
      lastUpdate: new Date().toISOString(),
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Claude Memory MCP Server running on stdio');
  }
}
