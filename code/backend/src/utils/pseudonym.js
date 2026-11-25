const crypto = require('crypto');
const db = require('../db');

const PSEUDONYM_SECRET = process.env.PSEUDONYM_SECRET || process.env.JWT_SECRET;
if (!PSEUDONYM_SECRET) {
  throw new Error('PSEUDONYM_SECRET (or JWT_SECRET) is required to generate pseudonyms.');
}

const ADJECTIVES = [
  'Quantum', 'Brave', 'Curious', 'Swift', 'Silent',
  'Nebula', 'Echo', 'Frost', 'Amber', 'Vivid',
  'Radiant', 'Stellar', 'Cosmic', 'Solar', 'Lunar',
  'Crimson', 'Azure', 'Emerald', 'Shadow', 'Iron'
];

const NOUNS = [
  'Falcon', 'Otter', 'Badger', 'Panda', 'Lynx',
  'Phoenix', 'Wolf', 'Owl', 'Dolphin', 'Tiger',
  'Fox', 'Hawk', 'Bear', 'Eagle', 'Cheetah',
  'Raven', 'Bison', 'Leopard', 'Koala', 'Dragon'
];

/**
 * Deterministically get or assign a persistent pseudonym for a user within a course.
 * Guarantees consistent pseudonym across all posts and replies in the same course.
 */
async function getOrAssignPseudonym(userId, courseId) {
  // Check if pseudonym already assigned
  const existing = await db.query(
    'SELECT pseudonym FROM pseudonym_assignments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].pseudonym;
  }

  // Generate a deterministic pseudonym from an HMAC of userId + courseId.
  // The secret prevents anyone who knows the public user/course ids from
  // recomputing the pseudonym.
  const hash = crypto
    .createHmac('sha256', PSEUDONYM_SECRET)
    .update(`${userId}:${courseId}`)
    .digest('hex');
  const adjIdx = parseInt(hash.substring(0, 4), 16) % ADJECTIVES.length;
  const nounIdx = parseInt(hash.substring(4, 8), 16) % NOUNS.length;
  const numSuffix = (parseInt(hash.substring(8, 12), 16) % 90) + 10; // 10..99

  const pseudonym = `${ADJECTIVES[adjIdx]}${NOUNS[nounIdx]}${numSuffix}`;

  // Insert into DB
  try {
    const insertRes = await db.query(
      `INSERT INTO pseudonym_assignments (user_id, course_id, pseudonym)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, course_id) DO UPDATE SET pseudonym = EXCLUDED.pseudonym
       RETURNING pseudonym`,
      [userId, courseId, pseudonym]
    );
    return insertRes.rows[0].pseudonym;
  } catch (err) {
    console.error('[ClassPulse Pseudonym] Error assigning pseudonym:', err);
    return pseudonym;
  }
}

module.exports = {
  getOrAssignPseudonym,
};
