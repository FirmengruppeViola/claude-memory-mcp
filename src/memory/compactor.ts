/**
 * Compactor - Session-based compaction with emotional anchors
 *
 * - Creates emotional anchor on session end
 * - Compresses session events → summary
 * - Automatic compaction of old sessions (>24h)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EventStore, MemoryEvent } from './store.js';
import type { IndexService, SessionMeta } from './index.js';

export interface CompactedSession {
  sessionId: string;
  originalEventCount: number;
  summary: string;
  keyTopics: string[];
  emotionalHighlights: string[];
  averageImportance: number;
  startTime: string;
  endTime: string;
  compactedAt: string;
}

export class Compactor {
  private store: EventStore;
  private index: IndexService;
  private currentSessionId: string | null = null;
  private compactedPath: string;

  constructor(store: EventStore, index: IndexService, basePath?: string) {
    this.store = store;
    this.index = index;
    this.compactedPath = path.join(
      basePath || path.join(require('os').homedir(), '.memory-buddy'),
      'compacted'
    );
    this.ensureCompactedDir();
  }

  private ensureCompactedDir(): void {
    if (!fs.existsSync(this.compactedPath)) {
      fs.mkdirSync(this.compactedPath, { recursive: true });
    }
  }

  async startSession(): Promise<string> {
    this.currentSessionId = this.generateSessionId();
    return this.currentSessionId;
  }

  async endSession(emotionalTone?: string): Promise<void> {
    if (!this.currentSessionId) return;

    const events = await this.store.getEvents(this.currentSessionId);
    if (events.length === 0) return;

    // Create session summary
    const summary = this.createSessionSummary(events);

    // Create emotional anchor
    const anchor: Omit<MemoryEvent, 'id' | 'timestamp'> = {
      sessionId: this.currentSessionId,
      type: 'anchor',
      content: summary,
      keywords: this.extractTopKeywords(events),
      emotionalWeight: this.calculateSessionEmotionalWeight(events),
    };

    await this.store.appendEvent(anchor);
    await this.index.updateSessionSummary(
      this.currentSessionId,
      summary,
      emotionalTone
    );

    this.currentSessionId = null;
  }

  async compactCurrentSession(): Promise<void> {
    await this.endSession();
  }

  /**
   * Compact all old sessions (older than maxAgeHours)
   */
  async compactOldSessions(maxAgeHours: number = 24): Promise<number> {
    const sessions = await this.getOldSessions(maxAgeHours);
    let compactedCount = 0;

    for (const session of sessions) {
      const success = await this.compactSession(session.id);
      if (success) compactedCount++;
    }

    return compactedCount;
  }

  /**
   * Get sessions older than maxAgeHours
   */
  private async getOldSessions(maxAgeHours: number): Promise<SessionMeta[]> {
    const allEvents = await this.store.getEvents();
    const sessionIds = new Set(allEvents.map(e => e.sessionId));
    const oldSessions: SessionMeta[] = [];
    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);

    for (const sessionId of sessionIds) {
      const sessionEvents = allEvents.filter(e => e.sessionId === sessionId);
      if (sessionEvents.length === 0) continue;

      const lastEvent = sessionEvents[sessionEvents.length - 1];
      const lastTime = new Date(lastEvent.timestamp).getTime();

      if (lastTime < cutoff) {
        const firstEvent = sessionEvents[0];
        oldSessions.push({
          id: sessionId,
          startTime: firstEvent.timestamp,
          endTime: lastEvent.timestamp,
          eventCount: sessionEvents.length
        });
      }
    }

    return oldSessions;
  }

  /**
   * Compact a single session
   */
  async compactSession(sessionId: string): Promise<boolean> {
    try {
      const events = await this.store.getEvents(sessionId);
      if (events.length === 0) return false;

      // Already compacted?
      if (this.isSessionCompacted(sessionId)) {
        return false;
      }

      // Create compacted summary
      const compacted: CompactedSession = {
        sessionId,
        originalEventCount: events.length,
        summary: this.createSessionSummary(events),
        keyTopics: this.extractTopKeywords(events),
        emotionalHighlights: this.extractEmotionalHighlights(events),
        averageImportance: this.calculateSessionEmotionalWeight(events),
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
        compactedAt: new Date().toISOString()
      };

      // Save to compacted file (grouped by month)
      await this.saveCompactedSession(compacted);

      return true;
    } catch (err) {
      console.error('Compaction failed for session ' + sessionId + ':', err);
      return false;
    }
  }

  /**
   * Save compacted session to monthly file
   */
  private async saveCompactedSession(compacted: CompactedSession): Promise<void> {
    const monthKey = compacted.startTime.substring(0, 7); // YYYY-MM
    const filePath = path.join(this.compactedPath, monthKey + '.json');

    let sessions: CompactedSession[] = [];
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      sessions = JSON.parse(content);
    }

    // Check if already exists
    if (!sessions.find(s => s.sessionId === compacted.sessionId)) {
      sessions.push(compacted);
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
    }
  }

  /**
   * Check if session is already compacted
   */
  private isSessionCompacted(sessionId: string): boolean {
    const files = fs.readdirSync(this.compactedPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.compactedPath, file), 'utf-8');
      const sessions: CompactedSession[] = JSON.parse(content);
      if (sessions.find(s => s.sessionId === sessionId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all compacted sessions
   */
  async getCompactedSessions(): Promise<CompactedSession[]> {
    const all: CompactedSession[] = [];
    const files = fs.readdirSync(this.compactedPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.compactedPath, file), 'utf-8');
      const sessions: CompactedSession[] = JSON.parse(content);
      all.push(...sessions);
    }

    return all.sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  private createSessionSummary(events: MemoryEvent[]): string {
    const first = events[0];
    const last = events[events.length - 1];

    // Count by type
    const userMessages = events.filter(e => e.type === 'user').length;
    const insights = events.filter(e => e.type === 'insight').length;

    // Calculate duration
    const startTime = new Date(first.timestamp);
    const endTime = new Date(last.timestamp);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMin = Math.round(durationMs / 60000);

    // Extract high-importance content
    const importantEvents = events
      .filter(e => e.emotionalWeight >= 7)
      .map(e => e.content.substring(0, 100))
      .slice(0, 3);

    // Get top keywords
    const topKeywords = this.extractTopKeywords(events).slice(0, 5);

    // Build summary
    let summary = `Session (${durationMin} min, ${userMessages} messages)`;

    if (insights > 0) {
      summary += `, ${insights} insights`;
    }

    if (topKeywords.length > 0) {
      summary += `. Topics: ${topKeywords.join(', ')}`;
    }

    if (importantEvents.length > 0) {
      summary += `. Highlights: ${importantEvents.join(' | ')}`;
    }

    return summary;
  }

  private extractTopKeywords(events: MemoryEvent[]): string[] {
    const keywordCounts: Record<string, number> = {};

    for (const event of events) {
      for (const keyword of event.keywords) {
        const lower = keyword.toLowerCase();
        keywordCounts[lower] = (keywordCounts[lower] || 0) + 1;
      }
    }

    // Sort by count and take top 10
    return Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);
  }

  private extractEmotionalHighlights(events: MemoryEvent[]): string[] {
    return events
      .filter(e => e.emotionalWeight >= 7)
      .sort((a, b) => b.emotionalWeight - a.emotionalWeight)
      .slice(0, 5)
      .map(e => e.content.substring(0, 200));
  }

  private calculateSessionEmotionalWeight(events: MemoryEvent[]): number {
    if (events.length === 0) return 5;

    const weights = events.map(e => e.emotionalWeight);
    const max = Math.max(...weights);
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;

    // Blend: 60% max, 40% average
    return Math.round(max * 0.6 + avg * 0.4);
  }

  private generateSessionId(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return 'session_' + dateStr + '_' + timeStr;
  }
}
