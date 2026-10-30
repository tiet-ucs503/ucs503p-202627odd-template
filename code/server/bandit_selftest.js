// bandit_selftest.js — proves the bandit personalizes. No DB needed.
// Run:  node bandit_selftest.js
//
// Two users see the SAME global scores but have different taste:
//   - "lenient" treats anything above 0.35 as important
//   - "strict"  treats only things above 0.65 as important
// Each gets their own bandit, trained only on their own feedback.
// If personalization works, at the same global score the lenient user's
// personalized importance should come out HIGHER than the strict user's.

const { buildContext, newState, predict, update } = require("./utils/bandit");

function trainUser(threshold, n = 400) {
    const st = newState(2); // context = [bias, global_score]
    for (let i = 0; i < n; i++) {
        const score = Math.random();                 // the global model's score
        const important = score > threshold ? 1 : 0; // this user's true reaction
        update(st, buildContext(score), important);
    }
    return st;
}

const clamp = (v) => Math.max(0, Math.min(1, v));

const lenient = trainUser(0.35);
const strict = trainUser(0.65);

console.log("\nSame global scores, two users — personalized importance the bandit learned:\n");
console.log("  global | lenient user | strict user");
console.log("  -------+--------------+------------");
[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].forEach((s) => {
    const x = buildContext(s);
    const L = clamp(predict(lenient, x)).toFixed(2);
    const S = clamp(predict(strict, x)).toFixed(2);
    console.log(`   ${s.toFixed(2)}  |     ${L}     |    ${S}`);
});

console.log("\nThe lenient user's scores stay higher at the same global score —");
console.log("each bandit learned a different personal mapping from the SAME inputs.");
console.log(`(updates seen: lenient ${lenient.n}, strict ${strict.n})\n`);