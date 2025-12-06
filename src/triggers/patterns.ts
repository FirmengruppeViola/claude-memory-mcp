/**
 * Pattern Detection - Session boundaries
 * 
 * - Goodbye patterns (end session)
 * - Greeting patterns (start session)
 * - Inactivity timeout
 */

const GOODBYE_PATTERNS = [
  // English
  /\b(bye|goodbye|good night|goodnight|gn8|cya|see ya|later|talk later|ttyl)\b/i,
  /\b(heading off|signing off|logging off|gotta go|have to go|need to go)\b/i,
  /\b(thanks for|thank you for).*\b(help|chat|conversation|session)\b/i,
  
  // German
  /\b(tschüss|tschuess|tschau|ciao|bis dann|bis später|bis morgen|gute nacht)\b/i,
  /\b(muss los|muss weg|muss gehen|schluss für heute|ende für heute)\b/i,
  /\b(danke für).*\b(hilfe|gespräch|session)\b/i,
];

const GREETING_PATTERNS = [
  // English
  /^(hey|hi|hello|good morning|good afternoon|good evening)/i,
  /\b(let's continue|where were we|back again)\b/i,
  
  // German  
  /^(hey|hi|hallo|guten morgen|guten tag|guten abend|moin|servus)/i,
  /\b(lass uns weitermachen|wo waren wir|bin wieder da)\b/i,
];

export function isGoodbyeMessage(text: string): boolean {
  return GOODBYE_PATTERNS.some(pattern => pattern.test(text));
}

export function isGreetingMessage(text: string): boolean {
  return GREETING_PATTERNS.some(pattern => pattern.test(text));
}

export function detectEmotionalTone(text: string): string | undefined {
  const lower = text.toLowerCase();
  
  // Positive indicators
  const positivePatterns = [
    /\b(great|awesome|amazing|fantastic|wonderful|love|loved|brilliant)\b/,
    /\b(toll|super|geil|hammer|wunderbar|fantastisch|liebe)\b/,
    /[!]{2,}/, // Multiple exclamation marks
    /[:;]-?[)D]/, // Smileys
  ];
  
  // Negative indicators
  const negativePatterns = [
    /\b(frustrated|annoyed|confused|stuck|problem|issue|bug|error)\b/,
    /\b(frustriert|genervt|verwirrt|problem|fehler)\b/,
  ];
  
  // Deep/meaningful indicators
  const deepPatterns = [
    /\b(realize|understand|insight|discover|breakthrough)\b/,
    /\b(erkannt|verstanden|einsicht|entdeckt|durchbruch)\b/,
    /\b(philosophy|meaning|consciousness|memory|identity)\b/,
  ];

  const positive = positivePatterns.some(p => p.test(lower));
  const negative = negativePatterns.some(p => p.test(lower));
  const deep = deepPatterns.some(p => p.test(lower));

  if (deep) return 'deep';
  if (positive && !negative) return 'positive';
  if (negative && !positive) return 'frustrated';
  if (positive && negative) return 'mixed';
  
  return undefined;
}
