/**
 * Counter System
 *
 * Tracks message count and persists to memory metadata.
 * This is the core mechanism for triggering compaction.
 */

import { MemoryManager } from './manager.js';

export class Counter {
  private memory: MemoryManager;
  private value: number = 0;
  private loaded: boolean = false;

  constructor(memory: MemoryManager) {
    this.memory = memory;
  }

  /**
   * Load current counter value from memory
   */
  private async load(): Promise<void> {
    if (this.loaded) return;

    const metadata = await this.memory.getMetadata();
    this.value = metadata.counter;
    this.loaded = true;
  }

  /**
   * Get current counter value
   */
  async getValue(): Promise<number> {
    await this.load();
    return this.value;
  }

  /**
   * Increment counter by 1
   */
  async increment(): Promise<number> {
    await this.load();
    this.value += 1;
    await this.memory.updateMetadata({ counter: this.value });
    return this.value;
  }

  /**
   * Reset counter to 0
   */
  async reset(): Promise<void> {
    this.value = 0;
    await this.memory.updateMetadata({ counter: 0 });
  }

  /**
   * Set counter to specific value (for recovery)
   */
  async set(value: number): Promise<void> {
    this.value = value;
    await this.memory.updateMetadata({ counter: value });
  }
}
