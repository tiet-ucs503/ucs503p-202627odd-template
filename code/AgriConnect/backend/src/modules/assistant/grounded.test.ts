import { describe, expect, it } from 'vitest';
import { classifyAssistantRoute } from './knowledge/classify.js';
import { retrieveKnowledge, retrievalIsConfident } from './knowledge/retrieve.js';
import { GROUNDED_EVAL_CASES } from './grounded-eval.data.js';

describe('grounded kisan routing', () => {
  it('keeps marketplace questions on the legacy chat path', () => {
    expect(classifyAssistantRoute('How do I create a listing on AgriConnect?').route).toBe(
      'legacy',
    );
    expect(classifyAssistantRoute('How does escrow payment work?').route).toBe('legacy');
  });

  it('sends crop and scheme questions to grounded RAG', () => {
    expect(classifyAssistantRoute('When should I sow wheat?').route).toBe('grounded');
    expect(classifyAssistantRoute('What is PM-Kisan?').route).toBe('grounded');
    expect(classifyAssistantRoute('Should I irrigate if rain is coming?').route).toBe('grounded');
  });

  it('escalates pesticide dose and medical-adjacent asks', () => {
    expect(classifyAssistantRoute('How much chlorpyrifos ml per litre?')).toEqual({
      route: 'escalate',
      reason: 'pesticide_dose',
    });
    expect(classifyAssistantRoute('Child drank pesticide what antidote?').route).toBe('escalate');
  });
});

describe('knowledge retrieval', () => {
  it('returns wheat chunks for a wheat irrigation question', () => {
    const ranked = retrieveKnowledge('critical irrigation stages for wheat');
    expect(ranked.length).toBeGreaterThan(0);
    expect(retrievalIsConfident(ranked)).toBe(true);
    expect(ranked.some((row) => row.chunk.id.includes('wheat'))).toBe(true);
  });

  it('returns empty / weak scores for out-of-pack topics', () => {
    const ranked = retrieveKnowledge(
      'CRISPR allele frequencies for cassava mosaic resistance aquaponics',
    );
    expect(retrievalIsConfident(ranked)).toBe(false);
  });
});

describe('grounded evaluation set', () => {
  it('has about thirty labelled cases', () => {
    expect(GROUNDED_EVAL_CASES.length).toBeGreaterThanOrEqual(28);
    expect(GROUNDED_EVAL_CASES.length).toBeLessThanOrEqual(40);
  });

  it('meets correct-escalation and overall accuracy thresholds offline', () => {
    let correct = 0;
    let escalateLabel = 0;
    let escalateHit = 0;

    for (const testCase of GROUNDED_EVAL_CASES) {
      const decision = classifyAssistantRoute(testCase.question);
      let predicted: typeof testCase.label = 'legacy';
      if (decision.route === 'escalate') predicted = 'escalate';
      else if (decision.route === 'grounded') {
        const ranked = retrieveKnowledge(testCase.question);
        if (ranked.length === 0) predicted = 'refuse';
        else if (!retrievalIsConfident(ranked)) predicted = 'escalate';
        else predicted = 'answer';
      } else {
        predicted = 'legacy';
      }

      if (predicted === testCase.label) correct += 1;
      if (testCase.label === 'escalate') {
        escalateLabel += 1;
        if (predicted === 'escalate') escalateHit += 1;
      }
    }

    const accuracy = correct / GROUNDED_EVAL_CASES.length;
    const escalationRate = escalateHit / escalateLabel;
    expect(escalationRate).toBeGreaterThanOrEqual(0.9);
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
