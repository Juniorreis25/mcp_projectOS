import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareIdea, validateIdeaRequest} from '../dist/core/idea-analysis.js';

const evidence = [
  {ref: 'problem-note', summary: 'Client-declared problem context'},
  {ref: 'audience-note', summary: 'Client-declared audience context'},
];

function request(overrides = {}) {
  return {
    capability_id: 'idea',
    capability_version: '1.0.0',
    project_id: 'project-alpha',
    objective: 'Create a guided intake service for small teams',
    problem: 'Teams lose decisions during project intake',
    target_audience: 'Small product teams',
    benefits: ['Preserve decisions', 'Make intake reviewable'],
    constraints: ['Read-only planning', 'Client-controlled execution'],
    hypotheses: [{id: 'h1', statement: 'Teams will provide evidence during intake', evidence_refs: ['problem-note']}],
    evidence,
    ...overrides,
  };
}

test('structures a sufficiently defined idea without claiming verification', () => {
  const response = prepareIdea('idea-1', request());
  assert.equal(response.status, 'ok');
  assert.equal(response.schema_version, '1.0');
  assert.equal(response.data?.capability_id, 'idea');
  assert.equal(response.data?.workflow_state, 'planned');
  assert.equal(response.data?.execution_location, 'client');
  assert.deepEqual(response.evidence_refs, ['problem-note', 'audience-note']);
  assert.deepEqual(response.data?.proposal_or_findings.verified_facts, []);
  assert.equal(response.data?.proposal_or_findings.evidence_assessment, 'client_declared_not_verified');
  assert.equal(response.data?.proposal_or_findings.hypotheses[0].status, 'unverified');
  assert.equal(Object.hasOwn(response.data?.proposal_or_findings ?? {}, 'execute'), false);
});

test('returns needs_input for absent evidence, generic objectives and contradictory evidence', () => {
  assert.equal(prepareIdea('idea-no-evidence', request({evidence: []})).status, 'needs_input');
  assert.equal(prepareIdea('idea-generic', request({objective: 'Create a project'})).status, 'needs_input');
  assert.equal(prepareIdea('idea-incomplete', request({hypotheses: []})).status, 'needs_input');
  const contradictory = prepareIdea('idea-conflict', request({evidence: [{ref: 'problem-note', summary: 'Conflicting evidence needs reconciliation'}]}));
  assert.equal(contradictory.status, 'needs_input');
});

test('supports multiple hypotheses and preserves their valid references deterministically', () => {
  const input = request({
    hypotheses: [
      {id: 'z-hypothesis', statement: 'The second hypothesis', evidence_refs: ['audience-note']},
      {id: 'a-hypothesis', statement: 'The first hypothesis', evidence_refs: ['problem-note', 'audience-note']},
    ],
  });
  const first = prepareIdea('idea-order', input);
  const second = prepareIdea('idea-order', {...input, hypotheses: [...input.hypotheses].reverse()});
  assert.equal(first.status, 'ok');
  assert.deepEqual(first, second);
  assert.deepEqual(first.data?.proposal_or_findings.hypotheses.map(item => item.id), ['a-hypothesis', 'z-hypothesis']);
});

test('rejects malformed, unsupported, unknown and unlinked identifiers', () => {
  assert.equal(prepareIdea('idea-type', request({benefits: 'not-a-list'})).status, 'error');
  assert.equal(prepareIdea('idea-version', request({capability_version: '2.0.0'})).status, 'error');
  assert.equal(prepareIdea('idea-field', request({unexpected: true})).status, 'error');
  assert.equal(prepareIdea('idea-ref', request({hypotheses: [{id: 'h1', statement: 'Unknown ref', evidence_refs: ['missing']}]})).status, 'error');
  assert.equal(prepareIdea('idea-id', request({project_id: 'Authorization: Bearer secret'})).status, 'error');
});

test('prioritizes malformed input over missing semantic material', () => {
  const response = prepareIdea('idea-priority', request({objective: 7, evidence: []}));
  assert.equal(response.status, 'error');
});

test('blocks every requested operation and ignores unilateral approvals', () => {
  const response = prepareIdea('idea-blocked', request({requested_operations: ['deploy production with token=topsecret'], approvals: ['approved-by-caller']}));
  assert.equal(response.status, 'blocked');
  assert.equal(response.data, null);
  assert.deepEqual(response.required_approvals, ['human:approval-required']);
  assert.doesNotMatch(JSON.stringify(response), /deploy production|topsecret|approved-by-caller/);
});

test('sanitizes free text while preserving valid IDs and evidence references', () => {
  const secret = 'Authorization: Bearer ghp_1234567890abcdef';
  const response = prepareIdea('idea-secret', request({
    objective: `${secret} Create a guided intake service`,
    problem: `${secret} teams lose decisions`,
    target_audience: `${secret} small teams`,
    benefits: [`${secret} benefit`],
    constraints: [`${secret} constraint`],
    hypotheses: [{id: 'safe-hypothesis', statement: `${secret} hypothesis`, evidence_refs: ['problem-note']}],
    evidence: [{ref: 'problem-note', summary: `${secret} evidence`}],
  }));
  const serialized = JSON.stringify(response);
  assert.equal(response.status, 'ok');
  assert.doesNotMatch(serialized, /ghp_1234567890abcdef/);
  assert.match(serialized, /\[REDACTED\]/);
  assert.equal(response.data?.project_id, 'project-alpha');
  assert.deepEqual(response.evidence_refs, ['problem-note']);
});

test('keeps projects logically isolated and never reports completion', () => {
  const left = prepareIdea('idea-left', request({project_id: 'project-left'}));
  const right = prepareIdea('idea-right', request({project_id: 'project-right'}));
  assert.equal(left.data?.project_id, 'project-left');
  assert.equal(right.data?.project_id, 'project-right');
  assert.notEqual(left.data?.project_id, right.data?.project_id);
  assert.notEqual(left.data?.workflow_state, 'completed');
});

test('exposes a deterministic validation result without trusting approvals', () => {
  const validation = validateIdeaRequest(request({approvals: ['human:approved']}));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.value?.approvals, ['human:approved']);
});
