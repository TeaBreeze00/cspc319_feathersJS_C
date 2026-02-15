/**
 * Tokenizer for BM25 search.
 *
 * Splits text into lowercase tokens, strips punctuation, and removes
 * common English stopwords so that only meaningful terms remain.
 */

const STOPWORDS: Set<string> = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'can',
  'could',
  'am',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'where',
  'when',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'from',
  'up',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'and',
  'but',
  'or',
  'nor',
  'if',
  'while',
  'as',
  'until',
  'although',
  'because',
  'since',
  'unless',
]);

/**
 * Tokenize a string into an array of lowercase, punctuation-free tokens
 * with stopwords removed.
 *
 * @param text - The input text to tokenize
 * @returns An array of cleaned tokens
 */
export function tokenize(text: string): string[] {
  // Convert to lowercase, replace punctuation with spaces, then split on whitespace
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  // Remove stopwords and very short tokens (single characters)
  return raw.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}
