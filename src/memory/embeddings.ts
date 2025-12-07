/**
 * Embeddings Service - Semantic Search via Vector Similarity
 *
 * Supports:
 * - Google Generative AI (text-embedding-004)
 * - OpenAI (text-embedding-3-small)
 *
 * Vectors are stored locally in ~/.memory-buddy/embeddings/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Google Generative AI Embeddings
 * Model: text-embedding-004
 * Dimensions: 768
 */
export class GoogleEmbeddings implements EmbeddingService {
  private apiKey: string;
  private model = 'text-embedding-004';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${this.model}:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Embeddings error: ${error}`);
    }

    const data = await response.json() as { embedding: { values: number[] } };
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Google doesn't have a batch endpoint, so we process sequentially
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

/**
 * OpenAI Embeddings
 * Model: text-embedding-3-small
 * Dimensions: 1536
 */
export class OpenAIEmbeddings implements EmbeddingService {
  private apiKey: string;
  private model = 'text-embedding-3-small';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map(d => d.embedding);
  }
}

/**
 * Vector Store - Stores and searches embeddings locally
 */
export interface StoredVector {
  eventId: string;
  vector: number[];
}

export class VectorStore {
  private basePath: string;
  private vectors: Map<string, number[]> = new Map();
  private indexPath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(os.homedir(), '.memory-buddy', 'embeddings');
    this.indexPath = path.join(this.basePath, 'vectors.json');
    this.ensureDirectory();
    this.loadVectors();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private loadVectors(): void {
    if (fs.existsSync(this.indexPath)) {
      try {
        const content = fs.readFileSync(this.indexPath, 'utf-8');
        const data: StoredVector[] = JSON.parse(content);
        for (const { eventId, vector } of data) {
          this.vectors.set(eventId, vector);
        }
      } catch {
        // Start fresh if corrupted
        this.vectors = new Map();
      }
    }
  }

  private saveVectors(): void {
    const data: StoredVector[] = [];
    for (const [eventId, vector] of this.vectors) {
      data.push({ eventId, vector });
    }
    fs.writeFileSync(this.indexPath, JSON.stringify(data));
  }

  async store(eventId: string, vector: number[]): Promise<void> {
    this.vectors.set(eventId, vector);
    this.saveVectors();
  }

  async get(eventId: string): Promise<number[] | undefined> {
    return this.vectors.get(eventId);
  }

  async has(eventId: string): Promise<boolean> {
    return this.vectors.has(eventId);
  }

  /**
   * Find most similar vectors to query
   * Returns eventIds sorted by similarity (descending)
   */
  async findSimilar(queryVector: number[], topK: number = 10): Promise<Array<{ eventId: string; similarity: number }>> {
    const results: Array<{ eventId: string; similarity: number }> = [];

    for (const [eventId, vector] of this.vectors) {
      const similarity = cosineSimilarity(queryVector, vector);
      results.push({ eventId, similarity });
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Get total count of stored vectors
   */
  count(): number {
    return this.vectors.size;
  }
}

/**
 * Factory function to create embedding service based on config
 */
export function createEmbeddingService(
  provider: 'google' | 'openai' | 'none',
  apiKey?: string
): EmbeddingService | null {
  if (provider === 'none' || !apiKey) {
    return null;
  }

  switch (provider) {
    case 'google':
      return new GoogleEmbeddings(apiKey);
    case 'openai':
      return new OpenAIEmbeddings(apiKey);
    default:
      return null;
  }
}
