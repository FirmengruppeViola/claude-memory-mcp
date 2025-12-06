/**
 * Compactor - Session-based compaction with emotional anchors
 * 
 * - Creates emotional anchor on session end
 * - Compresses session events → summary
 * - Logarithmic growth (daily → weekly → monthly → yearly)
 */

import type { EventStore, MemoryEvent } from './store.js';
import type { IndexService } from './index.js';

export class Compactor {
  private store: EventStore;
  private index: IndexService;
  private currentSessionId: string | null = null;

  constructor(store: EventStore, index: IndexService) {
    this.store = store;
    this.index = index;
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

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  private createSessionSummary(events: MemoryEvent[]): string {
    // Get first and last timestamps
    const first = events[0];
    const last = events[events.length - 1];
    
    // Count by type
    const userMessages = events.filter(e => e.type === 'user').length;
    const insights = events.filter(e => e.type === 'insight').length;
    
    // Extract high-importance content
    const importantEvents = events
      .filter(e => e.emotionalWeight >= 7)
      .map(e => e.content)
      .slice(0, 3);

    // Build summary
    let summary = 'Session: ' + userMessages + ' messages';
    if (insights > 0) {
      summary += ', ' + insights + ' insights';
    }
    
    if (importantEvents.length > 0) {
      summary += '. Key moments: ' + importantEvents.join('; ');
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

  private calculateSessionEmotionalWeight(events: MemoryEvent[]): number {
    if (events.length === 0) return 5;

    // Average emotional weight, weighted towards higher values
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
