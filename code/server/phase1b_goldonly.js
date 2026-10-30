// phase1b_goldonly.js — the UN-CONFOUNDED baseline measurement
// ---------------------------------------------------------------------------
// The plain Phase 1 AUC is inflated because `archived_untouched` rows label
// themselves 0 (we hid them, so the user never acted). This script:
//   1. Shows the composition of your labels by `outcome`.
//   2. Recomputes ROC-AUC on GOLD signals only (user actually acted on a
//      visible email), excluding the self-confirming archived_untouched rows.
//
// RUN (from your server folder):  node phase1b_goldonly.js

require("dotenv").config();
const mongoose = require("mongoose");

// outcomes where the user took a real, visible action:
const GOLD_POS = new Set(["starred", "read", "unarchived"]);        // label 1
const GOLD_NEG = new Set(["user_archived", "trashed", "deleted"]);  // label 0
// everything else (mainly "archived_untouched") is CONFOUNDED -> excluded

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) { console.error("No MONGO_URI / MONGODB_URI in .env"); process.exit(1); }
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const rows = await db.collection("feedbacks")
        .find({ label: { $ne: null } },
            { projection: { predictedScore: 1, label: 1, outcome: 1 } })
        .toArray();

    // ---- composition by outcome ----
    const byOutcome = {};
    for (const r of rows) {
        const o = r.outcome || "(none)";
        byOutcome[o] = (byOutcome[o] || 0) + 1;
    }
    console.log("\n============== LABEL COMPOSITION (by outcome) ==============");
    Object.entries(byOutcome).sort((a, b) => b[1] - a[1])
        .forEach(([o, n]) => console.log(`  ${o.padEnd(20)} : ${n}`));

    // ---- gold-only set ----
    const gold = rows.filter(
        (r) => typeof r.predictedScore === "number" &&
            (GOLD_POS.has(r.outcome) || GOLD_NEG.has(r.outcome))
    );
    const confounded = rows.length - gold.length;

    const scores = gold.map((r) => r.predictedScore);
    const labels = gold.map((r) => (GOLD_POS.has(r.outcome) ? 1 : 0));
    const pos = labels.filter((l) => l === 1).length;
    const neg = labels.length - pos;

    console.log("\n============== GOLD-ONLY MEASUREMENT ==============");
    console.log(`Rows excluded (confounded, e.g. archived_untouched): ${confounded}`);
    console.log(`Gold rows used        : ${gold.length}`);
    console.log(`Gold positives        : ${pos}`);
    console.log(`Gold negatives        : ${neg}`);

    if (pos === 0 || neg === 0) {
        console.log("\n>>> Not enough of BOTH gold classes to measure.");
        console.log(">>> If gold negatives are near zero, that's the real finding:");
        console.log(">>> aggressive archiving means users rarely dismiss mail themselves,");
        console.log(">>> so you have almost no un-confounded negative signal yet.");
        await mongoose.disconnect();
        return;
    }

    const auc = rocAuc(scores, labels);
    console.log(`\nGOLD-ONLY ROC-AUC     : ${auc.toFixed(4)}`);
    console.log(`(plain Phase 1 AUC was: 0.9924 — inflated by self-confirmation)`);
    if (auc >= 0.9) console.log("  Read: v1 is genuinely strong. Pivot to personalization, not a global retrain.");
    else if (auc >= 0.8) console.log("  Read: real but softer than it looked. v2 retrain is worthwhile.");
    else if (auc >= 0.7) console.log("  Read: the 0.99 was mostly illusion. Retraining v2 matters.");
    else console.log("  Read: on honest signal the model is weak. The base model is the problem.");
    console.log("===================================================\n");

    await mongoose.disconnect();
}

function rocAuc(scores, labels) {
    const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
    const ranks = new Array(scores.length);
    let i = 0;
    while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
        const avgRank = (i + 1 + (j + 1)) / 2;
        for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank;
        i = j + 1;
    }
    let sumRanksPos = 0, nPos = 0, nNeg = 0;
    for (let k = 0; k < labels.length; k++) {
        if (labels[k] === 1) { sumRanksPos += ranks[k]; nPos++; }
        else nNeg++;
    }
    return (sumRanksPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

main().catch((e) => { console.error(e); process.exit(1); });