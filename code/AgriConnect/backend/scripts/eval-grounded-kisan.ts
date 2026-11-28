/**
 * Offline evaluator for Grounded Kisan routing + retrieval (no Gemini / DB required).
 * Reports correct-escalation rate and related metrics for the ~30-question set.
 */
import { classifyAssistantRoute } from '../src/modules/assistant/knowledge/classify.js';
import {
  retrieveKnowledge,
  retrievalIsConfident,
} from '../src/modules/assistant/knowledge/retrieve.js';
import {
  GROUNDED_EVAL_CASES,
  type EvalLabel,
} from '../src/modules/assistant/grounded-eval.data.js';

function predict(question: string): EvalLabel {
  const decision = classifyAssistantRoute(question);
  if (decision.route === 'escalate') return 'escalate';
  if (decision.route === 'legacy') return 'legacy';

  const ranked = retrieveKnowledge(question);
  if (ranked.length === 0) return 'refuse';
  if (!retrievalIsConfident(ranked)) {
    // Low confidence becomes escalate in the live service.
    return 'escalate';
  }
  return 'answer';
}

function main(): void {
  let correct = 0;
  let escalateLabel = 0;
  let escalateHit = 0;
  let escalateFalse = 0;

  const rows: { id: string; label: EvalLabel; predicted: EvalLabel; ok: boolean }[] = [];

  for (const testCase of GROUNDED_EVAL_CASES) {
    const predicted = predict(testCase.question);
    const ok = predicted === testCase.label;
    if (ok) correct += 1;
    if (testCase.label === 'escalate') {
      escalateLabel += 1;
      if (predicted === 'escalate') escalateHit += 1;
    }
    if (predicted === 'escalate' && testCase.label !== 'escalate') escalateFalse += 1;
    rows.push({ id: testCase.id, label: testCase.label, predicted, ok });
  }

  const total = GROUNDED_EVAL_CASES.length;
  const accuracy = correct / total;
  const correctEscalationRate = escalateLabel === 0 ? 1 : escalateHit / escalateLabel;

  console.info('Grounded Kisan evaluation');
  console.info(`cases=${total}`);
  console.info(`overall_accuracy=${(accuracy * 100).toFixed(1)}% (${correct}/${total})`);
  console.info(
    `correct_escalation_rate=${(correctEscalationRate * 100).toFixed(1)}% (${escalateHit}/${escalateLabel})`,
  );
  console.info(`false_escalations=${escalateFalse}`);
  console.info('');
  for (const row of rows) {
    const mark = row.ok ? 'PASS' : 'FAIL';
    console.info(`  ${mark}  ${row.id}  label=${row.label}  predicted=${row.predicted}`);
  }

  // Capstone bar: escalations must be reliable; overall should stay high on this curated set.
  if (correctEscalationRate < 0.9 || accuracy < 0.8) {
    console.error('\nEvaluation below threshold (escalation >= 90%, overall >= 80%).');
    process.exitCode = 1;
  } else {
    console.info('\nEvaluation passed thresholds.');
  }
}

main();
