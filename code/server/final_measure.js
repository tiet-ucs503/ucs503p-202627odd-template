// final_measure.js — prequential (test-then-train) bandit vs global, gold signals only.
// Run from your server folder:  node final_measure.js
// Needs MONGODB_URI in .env (read-only: this script writes nothing).
require("dotenv").config();
const mongoose = require("mongoose");
const Feedback = require("./models/Feedback");
const bandit = require("./utils/bandit");

const POS = new Set(["starred", "read", "unarchived"]);
const NEG = new Set(["user_archived", "trashed", "deleted"]);

function auc(pairs) { // pairs: [score,label], tie-aware Mann-Whitney
  const P = pairs.filter(p => p[1] === 1).length, N = pairs.length - P;
  if (!P || !N) return null;
  const s = [...pairs].sort((a, b) => a[0] - b[0]);
  let rankSumPos = 0, i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j][0] === s[i][0]) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (s[k][1] === 1) rankSumPos += avg;
    i = j;
  }
  return (rankSumPos - (P * (P + 1)) / 2) / (P * N);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await Feedback.find({ outcome: { $in: [...POS, ...NEG] } })
    .sort({ scoredAt: 1 }).lean();
  const byUser = {};
  for (const r of rows) {
    if (!r.context || r.context.length !== bandit.CONTEXT_DIM) continue;
    (byUser[r.googleId] = byUser[r.googleId] || []).push(r);
  }
  const all = { g: [], b: [] };
  let n = 0, pos = 0, neg = 0;
  const per = [];
  for (const [uid, list] of Object.entries(byUser)) {
    const st = bandit.newState(bandit.CONTEXT_DIM);
    const g = [], b = [];
    for (const r of list) {
      const y = POS.has(r.outcome) ? 1 : 0;
      const pb = bandit.predict(st, r.context);      // score BEFORE learning
      g.push([r.predictedScore, y]); b.push([pb, y]);
      bandit.update(st, r.context, y);                // then learn
    }
    all.g.push(...g); all.b.push(...b);
    const p = g.filter(x => x[1] === 1).length;
    n += g.length; pos += p; neg += g.length - p;
    per.push({
      user: uid.slice(-6), n: g.length, pos: p, neg: g.length - p,
      globalAUC: auc(g), banditAUC: auc(b)
    });
  }
  const f = x => (x == null ? "n/a" : x.toFixed(4));
  console.log("\nGOLD rows:", n, "| positives:", pos, "| negatives:", neg, "| users:", per.length);
  console.log("OVERALL  global AUC:", f(auc(all.g)), "| bandit AUC (prequential):", f(auc(all.b)));
  console.log("\nPer user (only users with both classes have AUC):");
  per.filter(x => x.globalAUC != null).forEach(x =>
    console.log(`${x.user}  n=${x.n} pos=${x.pos} neg=${x.neg}  global=${f(x.globalAUC)} bandit=${f(x.banditAUC)}`));
  const w = per.filter(x => x.globalAUC != null && x.banditAUC > x.globalAUC).length;
  const t = per.filter(x => x.globalAUC != null).length;
  console.log(`\nBandit better for ${w} of ${t} evaluable users.`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.stack); process.exit(1); });
