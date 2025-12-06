/**
 * EventStore - Stores everything, loads lazy
 * 
 * - Append-only JSONL files
 * - One file per day (YYYY-MM-DD.jsonl)
 * - Never delete, only archive
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MemoryEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'insight' | 'anchor';
  content: string;
  keywords: string[];
  emotionalWeight: number; // 0-10
}

export class EventStore {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(os.homedir(), '.claude-memory', 'events');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private getFilePath(date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.basePath, dateStr + '.jsonl');
  }

  async appendEvent(event: Omit<MemoryEvent, 'id' | 'timestamp'>): Promise<MemoryEvent> {
    const fullEvent: MemoryEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    const filePath = this.getFilePath();
    const line = JSON.stringify(fullEvent) + '\n';

    fs.appendFileSync(filePath, line, 'utf-8');

    return fullEvent;
  }

  async getEvents(sessionId?: string): Promise<MemoryEvent[]> {
    const events: MemoryEvent[] = [];
    const files = this.getAllFiles();

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(...fileEvents);
    }

    if (sessionId) {
      return events.filter((e) => e.sessionId === sessionId);
    }

    return events;
  }

  async getRecentEvents(n: number): Promise<MemoryEvent[]> {
    const events = await this.getEvents();
    return events.slice(-n);
  }

  async getEventsByKeyword(keyword: string): Promise<MemoryEvent[]> {
    const events = await this.getEvents();
    const lowerKeyword = keyword.toLowerCase();
    return events.filter((e) => 
      e.keywords.some((k) => k.toLowerCase().includes(lowerKeyword)) ||
      e.content.toLowerCase().includes(lowerKeyword)
    );
  }

  async getEventsCount(): Promise<number> {
    const events = await this.getEvents();
    return events.length;
  }

  private getAllFiles(): string[] {
    if (!fs.existsSync(this.basePath)) {
      return [];
    }

    return fs
      .readdirSync(this.basePath)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(this.basePath, f))
      .sort(); // Chronological order
  }

  private async readFile(filePath: string): Promise<MemoryEvent[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    return lines.map((line) => JSON.parse(line) as MemoryEvent);
  }

  private generateId(): string {
    const now = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return 'evt_' + now + '_' + random;
  }
}
