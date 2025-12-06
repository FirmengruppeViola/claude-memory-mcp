/**
 * Compactor
 *
 * Handles compression of shortterm memory into longterm.
 * Filters by importance, compresses, and resets shortterm.
 */

import { MemoryManager } from './manager.js';
import { Config } from '../config/schema.js';

interface ParsedInsight {
  date: string;
  importance: number;
  content: string;
}

export class Compactor {
  private memory: MemoryManager;
  private config: Config;

  constructor(memory: MemoryManager, config: Config) {
    this.memory = memory;
    this.config = config;
  }

  /**
   * Perform full compaction cycle
   */
  async compact(): Promise<void> {
    // 1. Read shortterm
    const shortterm = await this.memory.readShortterm();

    // 2. Extract insights section
    const insights = this.extractInsights(shortterm);

    // 3. Filter by importance threshold
    const important = insights.filter(
      (i) => i.importance >= this.config.importanceThreshold
    );

    // 4. Compress if there are insights
    if (important.length > 0) {
      const compressed = this.compressInsights(important);

      // 5. Append to longterm
      await this.memory.appendToLongterm(compressed, 'EVOLUTION');
    }

    // 6. Reset shortterm (preserves NOW/ACTIVE/NEXT)
    await this.memory.resetShortterm();
  }

  /**
   * Extract insights from shortterm memory
   */
  private extractInsights(shortterm: string): ParsedInsight[] {
    const insights: ParsedInsight[] = [];

    // Pattern: **[2025-01-15]** (8/10): Content here
    const pattern = /\*\*\[(\d{4}-\d{2}-\d{2})\]\*\*\s*\((\d+)\/10\):\s*(.+)/g;

    let match;
    while ((match = pattern.exec(shortterm)) !== null) {
      const date = match[1];
      const importance = match[2];
      const content = match[3];

      if (date && importance && content) {
        insights.push({
          date,
          importance: parseInt(importance, 10),
          content: content.trim(),
        });
      }
    }

    return insights;
  }

  /**
   * Compress insights into summary
   */
  private compressInsights(insights: ParsedInsight[]): string {
    if (insights.length === 0) return '';

    // Group by date
    const grouped = new Map<string, ParsedInsight[]>();
    for (const insight of insights) {
      const existing = grouped.get(insight.date) || [];
      existing.push(insight);
      grouped.set(insight.date, existing);
    }

    // Build compressed summary
    const lines: string[] = [];

    for (const [date, dateInsights] of grouped) {
      // Combine insights for the date
      const combined = dateInsights
        .sort((a, b) => b.importance - a.importance)
        .map((i) => `- ${i.content} (${i.importance}/10)`)
        .join('\n');

      lines.push(`**${date}:**\n${combined}`);
    }

    return lines.join('\n\n');
  }
}
