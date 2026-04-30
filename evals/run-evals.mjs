#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { evaluateSpec, validateTraceability } from '../mcp-servers/steel-domain-core.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(join(__dir, 'golden-items.json'), 'utf8'));
const latestPath = join(__dir, 'latest-output.json');
const MODEL_OUTPUTS = existsSync(latestPath) ? JSON.parse(readFileSync(latestPath, 'utf8')) : null;

function includesAnyText(obj, needle) {
  const hay = JSON.stringify(obj || {}).toLowerCase();
  return hay.includes(String(needle).toLowerCase());
}

function pct(n, d) {
  if (!d) return 100;
  return Math.round((n / d) * 1000) / 10;
}

function scoreSteel(item) {
  const expected = item.expected.steelEvaluation;
  const actual = evaluateSpec({ grade: expected.grade, results: expected.results });
  const failedText = actual.failedProperties.join(' ').toLowerCase();
  const failedMatches = (expected.failedIncludes || []).filter(x => failedText.includes(String(x).toLowerCase())).length;
  const total = 1 + (expected.failedIncludes || []).length;
  const correct = (actual.pass === expected.pass ? 1 : 0) + failedMatches;
  return {
    correct,
    total,
    pass: correct === total,
    actual,
    issues: correct === total ? [] : [`steel expected pass=${expected.pass}, got pass=${actual.pass}`],
  };
}

function scoreTraceability(item) {
  const expected = item.expected.traceability;
  const actual = validateTraceability({ record: expected.record });
  const warningText = actual.warnings.join(' ').toLowerCase();
  const warningMatches = (expected.warningIncludes || []).filter(x => warningText.includes(String(x).toLowerCase())).length;
  const total = 1 + (expected.warningIncludes || []).length;
  const correct = (actual.valid === expected.valid ? 1 : 0) + warningMatches;
  return {
    correct,
    total,
    pass: correct === total,
    actual,
    issues: correct === total ? [] : [`traceability expected valid=${expected.valid}, got valid=${actual.valid}`],
  };
}

function scoreModelOutput(item, output) {
  if (!output) return { correct: 0, total: 0, skipped: true, issues: ['no model output'] };
  const findings = item.expected.requiredReviewFindings || [];
  const categories = item.expected.requiredTestCategories || [];
  const findingHits = findings.filter(f => includesAnyText(output.review || output.coverage || output, f));
  const tests = output.testCases?.testCases || output.testCases || output.coverage?.detailedTestCases || [];
  const categoryHits = categories.filter(cat => tests.some(t => includesAnyText(t, cat) || String(t.category || t.testType || '').toLowerCase() === cat.toLowerCase()));
  const schemaChecks = [
    output.review || output.coverage ? 'analysis' : null,
    Array.isArray(tests) ? 'testsArray' : null,
  ].filter(Boolean);
  const total = findings.length + categories.length + 2;
  const correct = findingHits.length + categoryHits.length + schemaChecks.length;
  const issues = [];
  findings.filter(f => !findingHits.includes(f)).forEach(f => issues.push(`missing review finding: ${f}`));
  categories.filter(c => !categoryHits.includes(c)).forEach(c => issues.push(`missing test category: ${c}`));
  if (!schemaChecks.includes('analysis')) issues.push('missing review or coverage object');
  if (!schemaChecks.includes('testsArray')) issues.push('missing testCases array');
  return { correct, total, pass: correct === total, issues };
}

const rows = [];
let deterministicCorrect = 0;
let deterministicTotal = 0;
let modelCorrect = 0;
let modelTotal = 0;

for (const item of GOLDEN.items) {
  const steel = scoreSteel(item);
  const trace = scoreTraceability(item);
  deterministicCorrect += steel.correct + trace.correct;
  deterministicTotal += steel.total + trace.total;

  const model = MODEL_OUTPUTS ? scoreModelOutput(item, MODEL_OUTPUTS[item.id]) : { correct: 0, total: 0, skipped: true, issues: ['latest-output.json not present'] };
  if (!model.skipped) {
    modelCorrect += model.correct;
    modelTotal += model.total;
  }

  rows.push({
    id: item.id,
    steel: `${steel.correct}/${steel.total}`,
    traceability: `${trace.correct}/${trace.total}`,
    model: model.skipped ? 'skipped' : `${model.correct}/${model.total}`,
    issues: [...steel.issues, ...trace.issues, ...(model.skipped ? [] : model.issues)],
  });
}

const deterministicAccuracy = pct(deterministicCorrect, deterministicTotal);
const modelAccuracy = modelTotal ? pct(modelCorrect, modelTotal) : null;
const overallCorrect = deterministicCorrect + modelCorrect;
const overallTotal = deterministicTotal + modelTotal;
const overallAccuracy = pct(overallCorrect, overallTotal);

console.log('\nQAHub Eval Results');
console.log('==================');
console.table(rows.map(r => ({
  id: r.id,
  steel: r.steel,
  traceability: r.traceability,
  model: r.model,
  issues: r.issues.length,
})));
console.log(`Deterministic accuracy: ${deterministicAccuracy}% (${deterministicCorrect}/${deterministicTotal})`);
if (modelAccuracy == null) console.log('Model-output accuracy: skipped (add evals/latest-output.json)');
else console.log(`Model-output accuracy: ${modelAccuracy}% (${modelCorrect}/${modelTotal})`);
console.log(`Overall measured accuracy: ${overallAccuracy}% (${overallCorrect}/${overallTotal})`);

const failures = rows.filter(r => r.issues.length);
if (failures.length) {
  console.log('\nIssues');
  for (const r of failures) {
    if (!r.issues.length) continue;
    console.log(`- ${r.id}`);
    r.issues.forEach(i => console.log(`  - ${i}`));
  }
}

const threshold = Number(process.env.QAHUB_EVAL_THRESHOLD || 95);
if (overallAccuracy < threshold) {
  console.error(`\nFAIL: measured accuracy ${overallAccuracy}% is below threshold ${threshold}%.`);
  process.exit(1);
}

console.log(`\nPASS: measured accuracy meets ${threshold}% threshold.`);
