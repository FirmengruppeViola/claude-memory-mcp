/**
 * Importance Scoring - Bewertet wie wichtig eine Nachricht ist
 *
 * Score 1-10:
 * - 1-3: Unwichtig (Bestaetigungen, kurze Antworten)
 * - 4-6: Normal (Standard-Konversation)
 * - 7-10: Wichtig (Persoenliche Info, Entscheidungen, Emotionen)
 */

export interface ImportanceResult {
  score: number;
  factors: string[];
}

interface PatternConfig {
  patterns: RegExp[];
  weight: number;
}

// Deutsche und englische Patterns
const PATTERNS: Record<string, PatternConfig> = {
  // +3: Persoenliche Informationen
  personalInfo: {
    patterns: [
      /ich bin/i,
      /i am/i,
      /mein name/i,
      /my name/i,
      /ich arbeite/i,
      /i work/i,
      /ich mag/i,
      /i like/i,
      /ich hasse/i,
      /i hate/i,
      /meine? (frau|mann|partner|kind|eltern|familie)/i,
      /my (wife|husband|partner|child|parents|family)/i,
      /ich wohne/i,
      /i live/i,
      /mein (projekt|firma|unternehmen|restaurant|bar)/i,
      /my (project|company|business|restaurant|bar)/i,
    ],
    weight: 3
  },

  // +2: Entscheidungen
  decision: {
    patterns: [
      /ich habe (mich )?(entschieden|beschlossen)/i,
      /i (have )?(decided|chose)/i,
      /lass uns/i,
      /let'?s/i,
      /wir machen/i,
      /we('ll| will) (do|make)/i,
      /ich werde/i,
      /i will/i,
      /ich plane/i,
      /i plan/i,
      /mein ziel/i,
      /my goal/i,
    ],
    weight: 2
  },

  // +2: Emotionen
  emotion: {
    patterns: [
      /ich (liebe|hasse|fuerchte|hoffe)/i,
      /i (love|hate|fear|hope)/i,
      /(frustriert|begeistert|aufgeregt|traurig|gluecklich)/i,
      /(frustrated|excited|sad|happy|angry)/i,
      /das nervt/i,
      /this (sucks|annoys)/i,
      /ich freue mich/i,
      /i('m| am) (happy|glad|excited)/i,
      /endlich/i,
      /finally/i,
      /(toll|super|geil|awesome|amazing)/i,
      /(scheisse|shit|damn|verdammt)/i,
    ],
    weight: 2
  },

  // +1: Fragen (oft wichtig fuer Kontext)
  question: {
    patterns: [
      /^(wie|warum|was|wer|wo|wann|welche)/i,
      /^(how|why|what|who|where|when|which)/i,
      /\?$/,
      /kannst du/i,
      /can you/i,
      /hilf mir/i,
      /help me/i,
    ],
    weight: 1
  },

  // +2: Technische Entscheidungen / Code
  technical: {
    patterns: [
      /implementier/i,
      /implement/i,
      /architektur/i,
      /architecture/i,
      /refactor/i,
      /bug fix/i,
      /feature/i,
      /deploy/i,
      /publish/i,
      /release/i,
    ],
    weight: 2
  },

  // -1: Bestaetigungen (weniger wichtig)
  confirmation: {
    patterns: [
      /^ok$/i,
      /^okay$/i,
      /^ja$/i,
      /^yes$/i,
      /^nein$/i,
      /^no$/i,
      /^gut$/i,
      /^good$/i,
      /^genau$/i,
      /^exactly$/i,
      /^danke$/i,
      /^thanks$/i,
      /^alles klar$/i,
      /^got it$/i,
    ],
    weight: -2
  },

  // -1: Kurze Befehle
  shortCommand: {
    patterns: [
      /^go$/i,
      /^weiter$/i,
      /^next$/i,
      /^continue$/i,
      /^stop$/i,
      /^wait$/i,
    ],
    weight: -1
  }
};

/**
 * Berechnet die Wichtigkeit einer Nachricht
 */
export function calculateImportance(content: string): ImportanceResult {
  let score = 5; // Baseline
  const factors: string[] = [];

  // Pattern Matching
  for (const [name, config] of Object.entries(PATTERNS)) {
    const matches = config.patterns.some(p => p.test(content));
    if (matches) {
      score += config.weight;
      factors.push(name);
    }
  }

  // Laenge-basierte Anpassung
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount < 5) {
    score -= 1;
    factors.push('veryShort');
  } else if (wordCount > 50) {
    score += 1;
    factors.push('detailed');
  }

  // Clamp zwischen 1 und 10
  const finalScore = Math.max(1, Math.min(10, score));

  return {
    score: finalScore,
    factors
  };
}

/**
 * Schnellcheck ob eine Nachricht ueberhaupt gespeichert werden sollte
 * (filtert komplett unwichtige Nachrichten)
 */
export function shouldStore(content: string): boolean {
  // Leere Nachrichten nicht speichern
  if (!content || content.trim().length === 0) {
    return false;
  }

  // Sehr kurze Bestaetigungen nicht speichern
  const trimmed = content.trim().toLowerCase();
  const skipPatterns = [
    /^\.+$/,        // Nur Punkte
    /^ok+$/i,       // ok, okk, okkk
    /^k$/i,         // k
    /^y$/i,         // y
    /^n$/i,         // n
    /^ja+$/i,       // ja, jaa
    /^yes+$/i,      // yes, yess
    /^no+$/i,       // no, noo
    /^nein+$/i,     // nein, neinn
  ];

  if (skipPatterns.some(p => p.test(trimmed))) {
    return false;
  }

  return true;
}
