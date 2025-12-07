/**
 * ContextLoader - Lazy loading with budget limits
 * 
 * - Always load: Core identity (~500 tokens)
 * - Triggered: Relevant memories based on keywords
 * - Budget: Never exceed maxTokens
 */

import type { EventStore, MemoryEvent } from './store.js';
import type { IndexService } from './index.js';
import { createEmbeddingService, VectorStore, cosineSimilarity, type EmbeddingService } from './embeddings.js';
import { loadConfig } from '../config/schema.js';

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
  private embeddingService: EmbeddingService | null = null;
  private vectorStore: VectorStore | null = null;

  constructor(store: EventStore, index: IndexService, config?: Partial<LoaderConfig>) {
    this.store = store;
    this.index = index;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize semantic search if enabled
    const appConfig = loadConfig();
    if (appConfig.semanticSearch.enabled && appConfig.semanticSearch.apiKey) {
      this.embeddingService = createEmbeddingService(
        appConfig.semanticSearch.provider,
        appConfig.semanticSearch.apiKey
      );
      this.vectorStore = new VectorStore();
    }
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
      const memories = await this.loadTriggeredMemories(keywords, currentMessage);
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

  private async loadTriggeredMemories(keywords: string[], originalMessage?: string): Promise<string[]> {
    const events = await this.store.getEvents();
    if (events.length === 0) return [];

    let candidateIds: Set<string>;

    // Use semantic search if available, otherwise fall back to keywords
    if (this.embeddingService && this.vectorStore && originalMessage) {
      candidateIds = await this.getSemanticCandidates(originalMessage, events);
    } else if (keywords.length > 0) {
      const keywordIds = await this.index.lookup(keywords);
      candidateIds = new Set(keywordIds);
    } else {
      return [];
    }

    // Find matching events
    const matches = events.filter(e => candidateIds.has(e.id));

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

      // Record access (prevents decay, boosts future relevance)
      await this.index.recordAccess(event.id);
    }

    return result;
  }

  /**
   * Get candidate events using semantic similarity
   */
  private async getSemanticCandidates(query: string, events: MemoryEvent[]): Promise<Set<string>> {
    if (!this.embeddingService || !this.vectorStore) {
      return new Set();
    }

    try {
      // Ensure all events have embeddings
      for (const event of events) {
        if (!(await this.vectorStore.has(event.id))) {
          const vector = await this.embeddingService.embed(event.content);
          await this.vectorStore.store(event.id, vector);
        }
      }

      // Embed the query
      const queryVector = await this.embeddingService.embed(query);

      // Find similar events
      const similar = await this.vectorStore.findSimilar(queryVector, 20);

      // Filter by similarity threshold (0.5 = moderately similar)
      const candidates = similar
        .filter(s => s.similarity > 0.5)
        .map(s => s.eventId);

      return new Set(candidates);
    } catch (err) {
      console.error('Semantic search failed, falling back to keywords:', err);
      return new Set();
    }
  }

  private calculateScore(event: MemoryEvent, keywords: string[]): number {
    // Use decay-adjusted score from index (includes access boost)
    const effectiveScore = this.index.calculateEffectiveScore(event.id);

    // Normalize to 0-1 range (effectiveScore can be > 10 with access boost)
    const normalizedEffective = Math.min(effectiveScore, 15) / 15;

    // Keyword match bonus (0-0.3)
    const matchCount = keywords.filter(k =>
      event.keywords.some(ek => ek.toLowerCase().includes(k.toLowerCase()))
    ).length;
    const keywordScore = (matchCount / Math.max(keywords.length, 1)) * 0.3;

    // Combined: 70% decay-adjusted importance, 30% keyword relevance
    return normalizedEffective * 0.7 + keywordScore;
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
