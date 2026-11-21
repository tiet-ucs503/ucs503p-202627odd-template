import { KNOWLEDGE_PACK, type KnowledgeChunk } from './pack.js';

const TOP_K_DEFAULT = 4;
/** Below this score we treat retrieval as empty / low-confidence. */
export const RETRIEVAL_MIN_SCORE = 2.5;

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'are',
  'how',
  'what',
  'when',
  'where',
  'why',
  'with',
  'from',
  'my',
  'me',
  'i',
  'please',
  'ji',
  'kya',
  'hai',
  'ke',
  'ki',
  'ka',
  'se',
  'ko',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function documentTokens(chunk: KnowledgeChunk): string[] {
  return tokenize(`${chunk.title} ${chunk.tags.join(' ')} ${chunk.text}`);
}

/** Precomputed DF for IDF over the static pack. */
const DOC_FREQ = (() => {
  const freq = new Map<string, number>();
  for (const chunk of KNOWLEDGE_PACK) {
    const unique = new Set(documentTokens(chunk));
    for (const token of unique) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return freq;
})();

const DOC_COUNT = KNOWLEDGE_PACK.length;

function idf(token: string): number {
  const df = DOC_FREQ.get(token) ?? 0;
  return Math.log(1 + DOC_COUNT / (1 + df));
}

export interface RankedChunk {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Lightweight lexical retrieval (TF × IDF + tag boost). No embedding API required,
 * so demos work offline once the pack is loaded.
 */
export function retrieveKnowledge(
  query: string,
  topK = TOP_K_DEFAULT,
): RankedChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryTf = new Map<string, number>();
  for (const token of queryTokens) {
    queryTf.set(token, (queryTf.get(token) ?? 0) + 1);
  }

  const ranked: RankedChunk[] = [];
  for (const chunk of KNOWLEDGE_PACK) {
    const docTokens = documentTokens(chunk);
    const docTf = new Map<string, number>();
    for (const token of docTokens) {
      docTf.set(token, (docTf.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const [token, qf] of queryTf) {
      const tf = docTf.get(token) ?? 0;
      if (tf === 0) continue;
      score += qf * (1 + Math.log(tf)) * idf(token);
    }

    // Exact tag hits matter for short queries like "PMFBY" or "wheat rust".
    for (const tag of chunk.tags) {
      const tagTokens = tokenize(tag);
      if (tagTokens.some((token) => queryTf.has(token))) {
        score += 1.75;
      }
      // Avoid tiny tags like "ph" matching inside "photoperiod".
      if (tag.length >= 3 && query.toLowerCase().includes(tag.toLowerCase())) {
        score += 2.25;
      }
    }

    if (score > 0) ranked.push({ chunk, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topK);
}

export function retrievalIsConfident(ranked: RankedChunk[]): boolean {
  return ranked.length > 0 && (ranked[0]?.score ?? 0) >= RETRIEVAL_MIN_SCORE;
}
