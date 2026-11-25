const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  checkProfanity,
  normalizeText,
  OFFENSIVE_TERMS,
} = require('../src/utils/profanityFilter');

test('obvious profanity is blocked', () => {
  for (const input of ['fuck', 'fuuuck', 'f.u.c.k', 'f u c k', 'sh1t', 'bitch']) {
    const result = checkProfanity(input);
    assert.equal(result.isBlocked, true, `expected "${input}" to be blocked`);
    assert.ok(result.matchedWord);
  }
});

test('innocent words containing offensive letter sequences are allowed', () => {
  for (const input of [
    'class',
    'shiitake',
    'Scunthorpe',
    'assassin',
    'grass',
    'pass',
    'document',
    'hello',
  ]) {
    const result = checkProfanity(input);
    assert.equal(result.isBlocked, false, `expected "${input}" to be allowed`);
    assert.equal(result.matchedWord, null);
  }
});

test('normalizeText exposes per-token normalization and a squished form', () => {
  const normalized = normalizeText('f.u.u.u.c.k');
  assert.deepEqual(normalized.tokens, ['f', 'u', 'u', 'u', 'c', 'k']);
  assert.equal(normalized.alphanumericOnly, 'fuck');
});

test('the offensive term list remains exported', () => {
  assert.ok(Array.isArray(OFFENSIVE_TERMS));
  assert.ok(OFFENSIVE_TERMS.includes('fuck'));
});
