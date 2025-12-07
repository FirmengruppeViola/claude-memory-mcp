/**
 * IndexService - Pattern-based memory retrieval
 * 
 * - Keywords → EventIds mapping
 * - Session summaries
 * - Emotional anchors
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { MemoryEvent } from './store.js';

export interface SessionMeta {
  id: string;
  startTime: string;
  endTime?: string;
  summary?: string;
  emotionalTone?: string;
  eventCount: number;
}

export interface EventMeta {
  id: string;
  baseScore: number;
  createdAt: string;
  accessCount: number;
  lastAccessed?: string;
}

export interface MemoryIndex {
  keywords: Record<string, string[]>;  // keyword → eventIds
  sessions: Record<string, SessionMeta>;
  anchors: string[];  // emotional anchor eventIds
  eventMeta: Record<string, EventMeta>;  // eventId → meta (for decay)
  lastUpdate: string;
}

export class IndexService {
  private indexPath: string;
  private index: MemoryIndex;

  constructor(basePath?: string) {
    const memoryPath = basePath || path.join(os.homedir(), '.claude-memory');
    this.indexPath = path.join(memoryPath, 'index.json');
    this.index = this.loadIndex();
  }

  private loadIndex(): MemoryIndex {
    if (fs.existsSync(this.indexPath)) {
      const content = fs.readFileSync(this.indexPath, 'utf-8');
      return JSON.parse(content);
    }
    return {
      keywords: {},
      sessions: {},
      anchors: [],
      eventMeta: {},
      lastUpdate: new Date().toISOString(),
    };
  }

  private saveIndex(): void {
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.index.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  async addToIndex(event: MemoryEvent): Promise<void> {
    // Index keywords
    for (const keyword of event.keywords) {
      const lower = keyword.toLowerCase();
      if (!this.index.keywords[lower]) {
        this.index.keywords[lower] = [];
      }
      if (!this.index.keywords[lower].includes(event.id)) {
        this.index.keywords[lower].push(event.id);
      }
    }

    // Track session
    if (!this.index.sessions[event.sessionId]) {
      this.index.sessions[event.sessionId] = {
        id: event.sessionId,
        startTime: event.timestamp,
        eventCount: 0,
      };
    }
    this.index.sessions[event.sessionId].eventCount++;
    this.index.sessions[event.sessionId].endTime = event.timestamp;

    // Track anchors (high emotional weight)
    if (event.emotionalWeight >= 7 && !this.index.anchors.includes(event.id)) {
      this.index.anchors.push(event.id);
    }

    // Track event meta for decay calculation
    this.index.eventMeta[event.id] = {
      id: event.id,
      baseScore: event.emotionalWeight,
      createdAt: event.timestamp,
      accessCount: 0
    };

    this.saveIndex();
  }

  async lookup(keywords: string[]): Promise<string[]> {
    const eventIds = new Set<string>();

    for (const keyword of keywords) {
      const lower = keyword.toLowerCase();
      const ids = this.index.keywords[lower] || [];
      ids.forEach((id) => eventIds.add(id));
    }

    return Array.from(eventIds);
  }

  async getAnchors(n?: number): Promise<string[]> {
    const anchors = this.index.anchors;
    return n ? anchors.slice(-n) : anchors;
  }

  async getSessionsCount(): Promise<number> {
    return Object.keys(this.index.sessions).length;
  }

  async getSession(sessionId: string): Promise<SessionMeta | undefined> {
    return this.index.sessions[sessionId];
  }

  async updateSessionSummary(sessionId: string, summary: string, tone?: string): Promise<void> {
    if (this.index.sessions[sessionId]) {
      this.index.sessions[sessionId].summary = summary;
      if (tone) {
        this.index.sessions[sessionId].emotionalTone = tone;
      }
      this.saveIndex();
    }
  }

  /**
   * Calculate effective score with decay
   * Formula: baseScore * decayFactor * accessBoost
   *
   * decayFactor = e^(-age_days / half_life)
   * accessBoost = 1 + (0.2 * accessCount)
   */
  calculateEffectiveScore(eventId: string, halfLifeDays: number = 30): number {
    const meta = this.index.eventMeta[eventId];
    if (!meta) return 5; // Default score if not tracked

    const ageMs = Date.now() - new Date(meta.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    const decayFactor = Math.exp(-ageDays / halfLifeDays);
    const accessBoost = 1 + (0.2 * meta.accessCount);

    return meta.baseScore * decayFactor * accessBoost;
  }

  /**
   * Record that an event was accessed (prevents decay)
   */
  async recordAccess(eventId: string): Promise<void> {
    if (this.index.eventMeta[eventId]) {
      this.index.eventMeta[eventId].accessCount++;
      this.index.eventMeta[eventId].lastAccessed = new Date().toISOString();
      this.saveIndex();
    }
  }

  /**
   * Get event meta
   */
  getEventMeta(eventId: string): EventMeta | undefined {
    return this.index.eventMeta[eventId];
  }

  /**
   * Get all event metas
   */
  getAllEventMeta(): Record<string, EventMeta> {
    return this.index.eventMeta;
  }
}
