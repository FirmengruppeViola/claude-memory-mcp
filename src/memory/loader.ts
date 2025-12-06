/**
 * ContextLoader - Lazy loading with budget limits
 * 
 * - Always load: Core identity (~500 tokens)
 * - Triggered: Relevant memories based on keywords
 * - Budget: Never exceed maxTokens
 */

import type { EventStore, MemoryEvent } from './store.js';
import type { IndexService } from './index.js';

export interface LoaderConfig {
  maxTokens: number;
  coreIdentityTokens: number;
  recentAnchorsTokens: number;
  triggeredMemoriesTokens: number;
}

const DEFAULT_CONFIG: LoaderConfig = {
  maxTokens: 2500,
  coreIdentityTokens: 500,
  recentAnchorsTokens: 500,
  triggeredMemoriesTokens: 1500,
};

export class ContextLoader {
  private store: EventStore;
  private index: IndexService;
  private config: LoaderConfig;

  constructor(store: EventStore, index: IndexService, config?: Partial<LoaderConfig>) {
    this.store = store;
    this.index = index;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async buildContext(currentMessage: string): Promise<string> {
    const parts: string[] = [];

    // 1. Core identity (if exists)
    const core = await this.loadCoreIdentity();
    if (core) {
      parts.push('## Who You Are Talking To\n' + core);
    }

    // 2. Recent session anchors
    const anchors = await this.loadRecentAnchors(5);
    if (anchors.length > 0) {
      parts.push('## Recent Sessions\n' + anchors.map(a => '- ' + a).join('\n'));
    }

    // 3. Triggered memories (if message provided)
    if (currentMessage) {
      const keywords = this.extractKeywords(currentMessage);
      const memories = await this.loadTriggeredMemories(keywords);
      if (memories.length > 0) {
        parts.push('## Relevant Memories\n' + memories.join('\n\n'));
      }
    }

    return parts.join('\n\n---\n\n');
  }

  private async loadCoreIdentity(): Promise<string | null> {
    // TODO: Load from longterm_memory.md or core identity file
    // For now, return null
    return null;
  }

  private async loadRecentAnchors(n: number): Promise<string[]> {
    const anchorIds = await this.index.getAnchors(n);
    const summaries: string[] = [];

    for (const id of anchorIds) {
      // Get the event and extract summary
      const events = await this.store.getEvents();
      const event = events.find(e => e.id === id);
      if (event && event.type === 'anchor') {
        summaries.push(event.content);
      }
    }

    return summaries;
  }

  private async loadTriggeredMemories(keywords: string[]): Promise<string[]> {
    if (keywords.length === 0) return [];

    const eventIds = await this.index.lookup(keywords);
    const events = await this.store.getEvents();
    
    // Find matching events
    const matches = events.filter(e => eventIds.includes(e.id));
    
    // Score and sort
    const scored = matches.map(e => ({
      event: e,
      score: this.calculateScore(e, keywords),
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    // Take top events within budget
    const result: string[] = [];
    let tokenCount = 0;
    const maxTokens = this.config.triggeredMemoriesTokens;

    for (const { event } of scored) {
      const eventTokens = this.estimateTokens(event.content);
      if (tokenCount + eventTokens > maxTokens) break;
      
      result.push(this.formatEvent(event));
      tokenCount += eventTokens;
    }

    return result;
  }

  private calculateScore(event: MemoryEvent, keywords: string[]): number {
    let score = 0;

    // Recency (0.3)
    const age = Date.now() - new Date(event.timestamp).getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    const recencyScore = Math.max(0, 1 - age / (30 * dayInMs)); // Decay over 30 days
    score += recencyScore * 0.3;

    // Emotional weight (0.4)
    score += (event.emotionalWeight / 10) * 0.4;

    // Keyword match (0.3)
    const matchCount = keywords.filter(k => 
      event.keywords.some(ek => ek.toLowerCase().includes(k.toLowerCase()))
    ).length;
    const keywordScore = matchCount / Math.max(keywords.length, 1);
    score += keywordScore * 0.3;

    return score;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const stopwords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'der', 'die', 'das', 'ein', 'eine', 'ist', 'sind', 'war', 'waren',
      'i', 'you', 'we', 'they', 'it', 'ich', 'du', 'wir', 'sie', 'es',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'und', 'oder', 'aber', 'wenn', 'dann', 'auch', 'noch', 'schon',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'how',
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9äöüß]/g, ''))
      .filter(w => w.length > 2 && !stopwords.has(w));
  }

  private formatEvent(event: MemoryEvent): string {
    const date = new Date(event.timestamp).toLocaleDateString();
    return '[' + date + '] ' + event.content;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}
