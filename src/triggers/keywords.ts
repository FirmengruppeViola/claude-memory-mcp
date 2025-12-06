/**
 * Keyword Extraction - Simple, Open Source friendly
 * 
 * - No AI required
 * - Stopword removal
 * - Basic tokenization
 */

const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'and', 'or', 'but', 'if', 'then', 'else', 'so', 'because', 'although',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  'can', 'may', 'must', 'shall', 'need', 'want', 'get', 'got', 'let',
]);

const STOPWORDS_DE = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
  'ist', 'sind', 'war', 'waren', 'sein', 'haben', 'hat', 'hatte', 'hatten',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'mich', 'dich', 'sich', 'uns', 'euch',
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'ihr',
  'und', 'oder', 'aber', 'wenn', 'dann', 'weil', 'obwohl', 'dass',
  'zu', 'von', 'in', 'an', 'auf', 'mit', 'bei', 'nach', 'aus', 'durch', 'fuer',
  'als', 'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches',
  'auch', 'noch', 'schon', 'nur', 'sehr', 'mehr', 'immer', 'wieder', 'hier', 'da',
  'nicht', 'kein', 'keine', 'keiner', 'keinem', 'keinen', 'keines',
  'kann', 'muss', 'will', 'soll', 'darf', 'mag',
]);

const STOPWORDS = new Set([...STOPWORDS_EN, ...STOPWORDS_DE]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !STOPWORDS.has(word) &&
      !/^\d+$/.test(word)  // Exclude pure numbers
    )
    .filter((word, index, arr) => arr.indexOf(word) === index);  // Unique
}

export function extractKeywordsWithWeight(text: string): Array<{ keyword: string; weight: number }> {
  const keywords = extractKeywords(text);
  const counts: Record<string, number> = {};

  // Count occurrences in original text
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const regex = new RegExp(keyword, 'gi');
    const matches = lower.match(regex);
    counts[keyword] = matches ? matches.length : 1;
  }

  return keywords.map(k => ({
    keyword: k,
    weight: Math.min(counts[k], 5),  // Cap at 5
  }));
}
