/**
 * Memory Manager
 *
 * Handles all read/write operations for longterm and shortterm memory files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { Config } from '../config/schema.js';

export interface Metadata {
  counter: number;
  lastCompaction: string;
  lastUpdate: string;
  profile: string;
}

export interface Insight {
  content: string;
  importance: number;
  timestamp: string;
  section: string;
}

export class MemoryManager {
  private config: Config;
  private longtermPath: string;
  private shorttermPath: string;

  constructor(config: Config) {
    this.config = config;
    this.longtermPath = path.join(config.memoryPath, 'longterm_memory.md');
    this.shorttermPath = path.join(config.memoryPath, 'shortterm_memory.md');
  }

  /**
   * Ensure memory directory and files exist
   */
  async initialize(): Promise<void> {
    // Create directory if it doesn't exist
    await fs.mkdir(this.config.memoryPath, { recursive: true });

    // Create longterm if it doesn't exist
    try {
      await fs.access(this.longtermPath);
    } catch {
      await this.createLongtermTemplate();
    }

    // Create shortterm if it doesn't exist
    try {
      await fs.access(this.shorttermPath);
    } catch {
      await this.createShorttermTemplate();
    }
  }

  /**
   * Read longterm memory
   */
  async readLongterm(): Promise<string> {
    await this.initialize();
    return await fs.readFile(this.longtermPath, 'utf-8');
  }

  /**
   * Read shortterm memory
   */
  async readShortterm(): Promise<string> {
    await this.initialize();
    return await fs.readFile(this.shorttermPath, 'utf-8');
  }

  /**
   * Read both memories
   */
  async readBoth(): Promise<{ longterm: string; shortterm: string }> {
    const [longterm, shortterm] = await Promise.all([
      this.readLongterm(),
      this.readShortterm(),
    ]);
    return { longterm, shortterm };
  }

  /**
   * Get metadata from shortterm memory
   */
  async getMetadata(): Promise<Metadata> {
    const content = await this.readShortterm();
    const parsed = matter(content);

    return {
      counter: (parsed.data['counter'] as number) ?? 0,
      lastCompaction: (parsed.data['lastCompaction'] as string) ?? 'never',
      lastUpdate: (parsed.data['lastUpdate'] as string) ?? new Date().toISOString(),
      profile: (parsed.data['profile'] as string) ?? 'default',
    };
  }

  /**
   * Update metadata in shortterm memory
   */
  async updateMetadata(updates: Partial<Metadata>): Promise<void> {
    const content = await this.readShortterm();
    const parsed = matter(content);

    // Merge updates
    const newData = {
      ...parsed.data,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };

    // Reconstruct file
    const newContent = matter.stringify(parsed.content, newData);
    await fs.writeFile(this.shorttermPath, newContent, 'utf-8');
  }

  /**
   * Add an insight to shortterm memory
   */
  async addInsight(content: string, importance: number, section: string): Promise<void> {
    const shortterm = await this.readShortterm();

    // Find the section and append
    const sectionHeader = `## [${section}]`;
    const lines = shortterm.split('\n');
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes(sectionHeader)) {
        // Find end of section (next ## or end of file)
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j]?.startsWith('## ') || lines[j]?.startsWith('---')) {
            insertIndex = j;
            break;
          }
        }
        if (insertIndex === -1) {
          insertIndex = lines.length;
        }
        break;
      }
    }

    if (insertIndex === -1) {
      // Section not found, append at end
      insertIndex = lines.length;
    }

    // Format insight
    const timestamp = new Date().toISOString().split('T')[0];
    const insight = `\n**[${timestamp}]** (${importance}/10): ${content}\n`;

    lines.splice(insertIndex, 0, insight);

    await fs.writeFile(this.shorttermPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Append content to longterm memory
   */
  async appendToLongterm(content: string, section: string): Promise<void> {
    const longterm = await this.readLongterm();

    // Find the section and append
    const sectionHeader = `## [${section}]`;
    const lines = longterm.split('\n');
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.includes(sectionHeader)) {
        // Find end of section
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j]?.startsWith('## ') || lines[j]?.startsWith('---')) {
            insertIndex = j;
            break;
          }
        }
        if (insertIndex === -1) {
          insertIndex = lines.length;
        }
        break;
      }
    }

    if (insertIndex === -1) {
      // Section not found, append at end
      insertIndex = lines.length;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n### Compaction - ${timestamp}\n\n${content}\n`;

    lines.splice(insertIndex, 0, entry);

    await fs.writeFile(this.longtermPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Reset shortterm memory (preserve NOW/ACTIVE/NEXT)
   */
  async resetShortterm(): Promise<void> {
    const current = await this.readShortterm();
    const parsed = matter(current);

    // Extract sections to preserve
    const now = this.extractSection(current, 'NOW');
    const active = this.extractSection(current, 'ACTIVE');
    const next = this.extractSection(current, 'NEXT');

    // Create fresh shortterm
    const fresh = this.buildShorttermContent({
      now: now || 'Current focus goes here.',
      active: active || 'Open tasks and questions.',
      next: next || 'Immediate next steps.',
      recent: `Last compaction: ${new Date().toISOString()}`,
      insights: '',
    });

    const newContent = matter.stringify(fresh, {
      ...parsed.data,
      counter: 0,
      lastCompaction: new Date().toISOString(),
    });

    await fs.writeFile(this.shorttermPath, newContent, 'utf-8');
  }

  /**
   * Extract content of a section
   */
  private extractSection(content: string, section: string): string {
    const sectionHeader = `## [${section}]`;
    const lines = content.split('\n');
    const result: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.includes(sectionHeader)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (line.startsWith('## ') || line.startsWith('---')) {
          break;
        }
        result.push(line);
      }
    }

    return result.join('\n').trim();
  }

  /**
   * Build shortterm content from sections
   */
  private buildShorttermContent(sections: {
    now: string;
    active: string;
    next: string;
    recent: string;
    insights: string;
  }): string {
    return `
# Shortterm Memory

> Rolling window of recent activity. Resets every ${this.config.threshold} messages.

---

## [NOW] CURRENT FOCUS

${sections.now}

---

## [RECENT] LAST SESSIONS

${sections.recent}

---

## [ACTIVE] OPEN QUESTIONS & TASKS

${sections.active}

---

## [NEXT] IMMEDIATE STEPS

${sections.next}

---

## [INSIGHTS] WAITING FOR COMPACTION

${sections.insights}

---

**End of Shortterm Memory**
`.trim();
  }

  /**
   * Create initial longterm memory template
   */
  private async createLongtermTemplate(): Promise<void> {
    const template = `---
version: "1.0"
created: "${new Date().toISOString()}"
---

# Longterm Memory

> Persistent knowledge and history. Grows slowly through compaction.

---

## [IDENTITY] WHO

*Who is the user? Core identity, preferences, style.*

---

## [WHY] CORE MOTIVATION

*Why are they building? Goals, dreams, constraints.*

---

## [HOW] WORKING STYLE

*How do they work? Tools, patterns, preferences.*

---

## [EVOLUTION] COMPACTED HISTORY

*Compressed insights from past sessions.*

---

**End of Longterm Memory**
`;

    await fs.writeFile(this.longtermPath, template, 'utf-8');
  }

  /**
   * Create initial shortterm memory template
   */
  private async createShorttermTemplate(): Promise<void> {
    const content = this.buildShorttermContent({
      now: 'No current focus set.',
      active: 'No active tasks.',
      next: 'No immediate steps.',
      recent: 'No recent sessions.',
      insights: 'No insights yet.',
    });

    const withFrontmatter = matter.stringify(content, {
      counter: 0,
      lastCompaction: 'never',
      lastUpdate: new Date().toISOString(),
      profile: 'default',
    });

    await fs.writeFile(this.shorttermPath, withFrontmatter, 'utf-8');
  }
}
