// utils/bandit.js — per-user LinUCB personalization (pure, dependency-free).
// Context is now SENDER-AWARE: it carries the global score AND signals about who/what
// the email is, so the bandit learns each user's taste for senders and types of mail.

// ----------------------------- minimal linear algebra -----------------------------
function identity(d) { const A = []; for (let i = 0; i < d; i++) { A.push(Array(d).fill(0)); A[i][i] = 1; } return A; }
function zeros(d) { return Array(d).fill(0); }
function matVec(A, x) { const d = x.length, y = zeros(d); for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += A[i][j] * x[j]; y[i] = s; } return y; }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function invert(M) {
    const d = M.length, I = identity(d);
    const A = M.map((row, i) => row.concat(I[i]));
    for (let col = 0; col < d; col++) {
        let piv = col;
        for (let r = col + 1; r < d; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
        if (Math.abs(A[piv][col]) < 1e-12) throw new Error("singular matrix");
        [A[col], A[piv]] = [A[piv], A[col]];
        const pv = A[col][col];
        for (let j = 0; j < 2 * d; j++) A[col][j] /= pv;
        for (let r = 0; r < d; r++) { if (r === col) continue; const f = A[r][col]; if (f === 0) continue; for (let j = 0; j < 2 * d; j++) A[r][j] -= f * A[col][j]; }
    }
    return A.map((row) => row.slice(d));
}

// ----------------------------- context (SENDER-AWARE) -----------------------------
// [ bias, global_score, sender_engagement, sender_seen_before, is_bulk ]
//   global_score      – the baseline model's score (the prior)
//   sender_engagement – this user's smoothed engagement rate with THIS sender (0.5 if new)
//   sender_seen_before– 1 if we have history with this sender for this user
//   is_bulk           – 1 if promotions/social category or has an unsubscribe header
// The bandit learns, per user, how much each of these matters.
const CONTEXT_DIM = 5;

function buildContext(globalScore, f = {}) {
    return [
        1,
        globalScore,
        f.senderEngagement == null ? 0.5 : f.senderEngagement,
        f.senderSeenBefore ? 1 : 0,
        f.isBulk ? 1 : 0,
    ];
}

// ----------------------------- LinUCB per-user state -----------------------------
function newState(d) { return { d, A: identity(d), b: zeros(d), n: 0 }; }
function theta(state) { return matVec(invert(state.A), state.b); }
function predict(state, x) { return dot(theta(state), x); }
function ucb(state, x, alpha = 0.5) {
    const Ainv = invert(state.A);
    const explore = Math.sqrt(Math.max(0, dot(x, matVec(Ainv, x))));
    return dot(theta(state), x) + alpha * explore;
}
// forgetting factor: <1 fades old evidence so the bandit tracks changing taste.
// 0.999 ≈ long memory (slow drift); lower = faster adaptation. Tune later with real data.
const GAMMA = parseFloat(process.env.BANDIT_GAMMA || "0.999");

function update(state, x, reward) {
    const d = state.d;
    for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) state.A[i][j] = GAMMA * state.A[i][j] + x[i] * x[j];
        state.b[i] = GAMMA * state.b[i] + reward * x[i];
    }
    state.n += 1;
    return state;
}

module.exports = { CONTEXT_DIM, buildContext, newState, theta, predict, ucb, update, _linalg: { identity, zeros, matVec, dot, invert } };