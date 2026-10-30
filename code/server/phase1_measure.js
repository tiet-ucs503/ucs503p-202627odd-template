// phase1_measure.js — Phase 1: measure the LIVE baseline from the feedbacks collection
// --------------------------------------------------------------------------------------
// WHAT IT DOES:
//   - Pulls every resolved feedback row (label 0/1) — these already carry the score v1 gave.
//   - Computes the LIVE ROC-AUC of predictedScore vs the real label (how good v1 actually is
//     in the wild, vs the 0.949 it scored offline on the original 6,000).
//   - Audits your thresholds: how many IMPORTANT emails got archived (the damaging error),
//     and how much junk you left visible.
//
// HOW TO RUN (from your server folder, where .env lives):
//   node phase1_measure.js
//
// NEEDS: the same MONGO_URI (or MONGODB_URI) in your .env that Vigilante uses. No new installs.

require("dotenv").config();
const mongoose = require("mongoose");

const ARCHIVE_THRESHOLD = 0.2; // below this, Vigilante archives (predicts "unimportant")
const DISPLAY_THRESHOLD = 0.4; // your "important" display cutoff

async function main() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("No MONGO_URI / MONGODB_URI found in .env — check the variable name.");
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const rows = await db
        .collection("feedbacks")
        .find({ label: { $ne: null } }, { projection: { predictedScore: 1, label: 1, action: 1 } })
        .toArray();

    // keep only clean rows: numeric score + binary label
    const data = rows.filter(
        (r) => typeof r.predictedScore === "number" && (r.label === 0 || r.label === 1)
    );

    const n = data.length;
    const pos = data.filter((r) => r.label === 1).length;
    const neg = n - pos;

    console.log("\n==================== PHASE 1: LIVE BASELINE ====================");
    console.log(`Resolved rows used    : ${n}`);
    console.log(`Positives (important) : ${pos}`);
    console.log(`Negatives (not)       : ${neg}`);
    console.log(`Base rate (positive)  : ${n ? ((pos / n) * 100).toFixed(1) : 0}%`);

    if (pos === 0 || neg === 0) {
        console.log("\nNeed BOTH classes present to measure anything. Aborting.");
        await mongoose.disconnect();
        return;
    }

    // ---------- LIVE ROC-AUC (rank method, tie-aware = Mann-Whitney) ----------
    const auc = rocAuc(
        data.map((r) => r.predictedScore),
        data.map((r) => r.label)
    );
    console.log("\n---------------------------------------------------------------");
    console.log(`LIVE ROC-AUC          : ${auc.toFixed(4)}`);
    console.log(`(offline baseline was : 0.949 on the original 6,000 emails)`);
    console.log(interpretAuc(auc));

    // ---------- Threshold audits ----------
    thresholdAudit("ARCHIVE threshold", ARCHIVE_THRESHOLD, data);
    thresholdAudit("DISPLAY threshold", DISPLAY_THRESHOLD, data);

    console.log("===============================================================\n");
    await mongoose.disconnect();
}

function thresholdAudit(name, t, data) {
    // "predicted important" = score >= t ; otherwise predicted unimportant (archived)
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const r of data) {
        const predImportant = r.predictedScore >= t;
        if (predImportant && r.label === 1) tp++;
        else if (predImportant && r.label === 0) fp++;
        else if (!predImportant && r.label === 0) tn++;
        else fn++; // predicted unimportant, but was actually important  <-- the bad one
    }
    const archived = tn + fn; // rows below threshold
    const kept = tp + fp;     // rows at/above threshold
    const falseArchiveRate = archived ? (fn / archived) * 100 : 0;
    const clutterRate = kept ? (fp / kept) * 100 : 0;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;

    console.log("\n---------------------------------------------------------------");
    console.log(`${name} = ${t}`);
    console.log(`  Confusion (predicted important = score >= ${t}):`);
    console.log(`      TP ${tp}   FP ${fp}`);
    console.log(`      FN ${fn}   TN ${tn}`);
    console.log(
        `  FALSE-ARCHIVE rate  : ${falseArchiveRate.toFixed(1)}%  (${fn} important emails hidden below ${t})  <-- most damaging`
    );
    console.log(
        `  Clutter rate        : ${clutterRate.toFixed(1)}%  (${fp} unimportant emails left visible)`
    );
    console.log(`  Precision(important): ${precision.toFixed(3)}    Recall(important): ${recall.toFixed(3)}`);
}

// Tie-aware ROC-AUC via average ranks of the positive class (Wilcoxon statistic).
function rocAuc(scores, labels) {
    const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
    const ranks = new Array(scores.length);
    let i = 0;
    while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
        const avgRank = (i + 1 + (j + 1)) / 2; // 1-based average rank for the tie group
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

function interpretAuc(auc) {
    if (auc >= 0.9) return "  Read: v1 holds up live. The win is personalization, not a new global model.";
    if (auc >= 0.8) return "  Read: solid but retraining v2 on live data should help.";
    if (auc >= 0.7) return "  Read: mediocre live. Retraining v2 is worth it.";
    return "  Read: weak live. The base model itself is the problem — retrain is the priority.";
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});