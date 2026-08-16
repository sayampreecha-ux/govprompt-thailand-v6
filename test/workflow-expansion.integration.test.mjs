import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const files = ['shared-context.js', 'core-engine.js', 'quality-gate.js', 'workflow-expansion.js'];
const indexHtml = readFileSync('index.html', 'utf8');

function runtime() {
  const context = { window: {} };
  vm.createContext(context);
  files.forEach(file => vm.runInContext(readFileSync(file, 'utf8'), context));
  return context.window;
}

function submitWorkflow(gpId, category, evidenceTypes = []) {
  const app = runtime();
  app.GOVPROMPT_CONTEXT.selectTool({ id: gpId, category });
  app.GOVPROMPT_CONTEXT.setUserInputs({ subject: 'example subject', facts: 'example facts' });
  app.GOVPROMPT_CONTEXT.update({
    evidence: { provided: evidenceTypes.length > 0, types: evidenceTypes, count: evidenceTypes.length },
    routing: { score: 0.8, confidence: 0.8, matchedReason: 'test route', fallback: false },
    workflowState: 'generated'
  });
  const execution = app.GOVPROMPT_CORE_ENGINE.prepare(app.GOVPROMPT_CONTEXT.get());
  const quality = app.GOVPROMPT_QUALITY_GATE.evaluate(execution);
  return app.GOVPROMPT_WORKFLOW_EXPANSION.plan(execution, quality);
}

test('production form submit flow wires the Batch 1 plan after Core Engine and Quality Gate', () => {
  assert.match(indexHtml, /const workflowExpansion=window\.GOVPROMPT_WORKFLOW_EXPANSION;/);
  assert.match(indexHtml, /const workflowPlan=workflowExpansion\?\.plan\(execution,quality\);/);
  assert.match(indexHtml, /window\.GOVPROMPT_WORKFLOW_PLAN=workflowPlan\|\|null;/);
});

test('all Batch 1 production workflow paths block readiness when their evidence is absent', () => {
  const cases = [
    ['GP009', 'พัสดุ', 'tor-procurement'],
    ['GP019', 'ผู้บริหาร', 'financial-disbursement'],
    ['GP005', 'กฎหมาย', 'legal-analysis'],
    ['GP001', 'หนังสือราชการ', 'official-letter-follow-up']
  ];
  for (const [gpId, category, workflowId] of cases) {
    const result = submitWorkflow(gpId, category);
    assert.equal(result.workflowId, workflowId);
    assert.equal(result.status, 'NEEDS_INFO');
    assert.equal(result.currentState, 'collecting-evidence');
    assert.ok(result.missingInformation.every(item => item.startsWith('workflow-evidence:')));
  }
});

test('each Batch 1 workflow becomes ready only with its own complete evidence set', () => {
  const cases = [
    ['GP009', 'พัสดุ', ['requirement-specification', 'market-information', 'budget-basis']],
    ['GP019', 'ผู้บริหาร', ['payment-request', 'supporting-documents', 'approval-reference']],
    ['GP005', 'กฎหมาย', ['facts', 'authority-or-source-provided', 'question-for-review']],
    ['GP001', 'หนังสือราชการ', ['facts', 'recipient-or-destination', 'reference-documents']]
  ];
  for (const [gpId, category, evidenceTypes] of cases) {
    const result = submitWorkflow(gpId, category, evidenceTypes);
    assert.equal(result.status, 'READY_FOR_REVIEW');
    assert.equal(result.currentState, 'human-review');
    assert.equal(result.requiresHumanReview, true);
    assert.equal(result.deliverable.state, 'READY_FOR_HUMAN_REVIEW');
  }
});
