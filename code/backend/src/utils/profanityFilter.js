/**
 * ClassPulse Profanity & Offensive Language Filter
 * 
 * Provides automated detection of abusive, vulgar, or offensive terms
 * in student live word cloud submissions.
 */

// List of profane / abusive keywords and patterns (lowercased)
const OFFENSIVE_TERMS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckk', 'fck',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitches', 'bitching',
  'asshole', 'ass', 'asses', 'dumbass', 'badass',
  'bastard', 'bastards',
  'dick', 'dicks', 'dickhead',
  'cunt', 'cunts',
  'cock', 'cocks', 'cocksucker',
  'slut', 'sluts',
  'whore', 'whores',
  'pussy', 'pussies',
  'fag', 'faggot', 'faggots',
  'nigger', 'nigga', 'niggers', 'niggas',
  'retard', 'retarded',
  'porn', 'porno', 'sex', 'sexy', 'horny', 'orgasm',
  'motherfucker', 'motherfucking',
  'bollocks', 'wanker',
  'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'gand', 'gaand', 'bhosadi', 'bhosdike', 'lodu', 'lauda', 'harami', 'kameena'
];

// Leetspeak mapping
const LEET_MAP = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
};

// Common inflections that should still match a base offensive term.
const SUFFIXES = ['s', 'es', 'ed', 'ing', 'er', 'ers', 'y', 'ies'];

function leetToLetters(text) {
  let mapped = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    mapped += LEET_MAP[ch] || ch;
  }
  return mapped;
}

function collapseRepeats(token) {
  return token.replace(/(.)\1+/g, '$1');
}

/**
 * Normalizes a text string by:
 * 1. Lowercasing
 * 2. Translating leetspeak numbers/symbols to letters
 * 3. Splitting on non-alphanumeric separators into tokens
 * 4. Collapsing repeated characters within each token ("fuuuck" -> "fuck")
 */
function normalizeText(input) {
  if (!input || typeof input !== 'string') {
    return { raw: '', collapsed: '', alphanumericOnly: '', tokens: [] };
  }

  const raw = input.toLowerCase();
  const mapped = leetToLetters(raw);
  const tokens = mapped
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(collapseRepeats);

  // Keep the legacy fields for callers that still inspect them, but derive
  // them from sanitized tokens so separators never create false positives.
  // Collapsing the squished form also catches "f.u.u.c.k".
  const collapsed = tokens.join(' ');
  const alphanumericOnly = collapseRepeats(tokens.join(''));

  return {
    raw,
    collapsed,
    alphanumericOnly,
    tokens,
  };
}

function matchOffensiveTerm(candidate) {
  for (const term of OFFENSIVE_TERMS) {
    if (candidate === term) return term;
    for (const suffix of SUFFIXES) {
      if (candidate === `${term}${suffix}`) return term;
    }
  }
  return null;
}

/**
 * Check if the text contains offensive or prohibited words.
 * Matches whole tokens (plus common suffixes) and separator-obfuscated input
 * such as "f.u.c.k" / "f u c k". Substring matching is intentionally avoided
 * because it flags innocent words such as "shiitake" or "Scunthorpe".
 * @param {string} text - The input submission string
 * @returns {{ isBlocked: boolean, reason: string | null, matchedWord: string | null }}
 */
function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { isBlocked: false, reason: null, matchedWord: null };
  }

  const { tokens, alphanumericOnly } = normalizeText(text);

  for (const token of tokens) {
    const matched = matchOffensiveTerm(token);
    if (matched) {
      return {
        isBlocked: true,
        reason: `Flagged by profanity filter (matches "${matched}")`,
        matchedWord: matched,
      };
    }
  }

  // Obfuscated input with separators squishes down to a single term.
  const squishedMatch = matchOffensiveTerm(alphanumericOnly);
  if (squishedMatch) {
    return {
      isBlocked: true,
      reason: `Flagged by profanity filter (matches "${squishedMatch}")`,
      matchedWord: squishedMatch,
    };
  }

  return { isBlocked: false, reason: null, matchedWord: null };
}

module.exports = {
  checkProfanity,
  normalizeText,
  OFFENSIVE_TERMS,
};
