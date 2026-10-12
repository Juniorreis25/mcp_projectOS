import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBuild, validateBuildRequest} from '../dist/core/build-planning.js';

const specification = {
  objective: 'Prepare a safe implementation plan',
  scope: ['Core planning contracts'],
  constraints: ['No remote execution'],
  acceptance_criteria: ['All steps remain client-side'],
  context: 'The client supplied and reviewed this specification',
  assumptions: [],
  unresolved_questions: [],
};

const validBuild = {
  capability_id: 'build',
  capability_version: '1.0.0',
  project_id: 'build-project',
  mode: 'new',
  specification,
  specification_review_ref: 'client:spec-review',
  dependencies: [],
  evidence: [{ref: 'client:spec-review', summary: 'Client review record for the specification'}],
};

test('prepares a valid read-only build plan', () => {
  const response = prepareBuild('build-ok', validBuild);
  assert.equal(response.status, 'ok');
  assert.equal(response.data?.workflow_state, 'planned');
  assert.equal(response.data?.execution_location, 'client');
  assert.equal(response.data?.proposal_or_findings.steps.length, 3);
  assert.ok(response.data?.proposal_or_findings.steps.every(step => step.execution_location === 'client'));
  assert.deepEqual(response.evidence_refs, ['client:spec-review']);
  assert.deepEqual(response.required_approvals, []);
});

test('requires a reviewed specification, matching evidence and dependencies', () => {
  const missingSpecification = prepareBuild('build-no-spec', {...validBuild, specification: undefined});
  assert.equal(missingSpecification.status, 'needs_input');

  const missingReviewEvidence = prepareBuild('build-no-review', {...validBuild, specification_review_ref: 'client:missing'});
  assert.equal(missingReviewEvidence.status, 'needs_input');

  const missingDependencies = prepareBuild('build-no-dependencies', {...validBuild, dependencies: undefined});
  assert.equal(missingDependencies.status, 'needs_input');
});

test('treats unresolved specification questions as insufficient input', () => {
  const response = prepareBuild('build-contradictory-spec', {
    ...validBuild,
    specification: {...specification, unresolved_questions: ['Which client owns execution?']},
  });
  assert.equal(response.status, 'needs_input');
});

test('returns error for malformed fields and unsupported versions', () => {
  const malformed = prepareBuild('build-malformed', {...validBuild, dependencies: 'none'});
  assert.equal(malformed.status, 'error');

  const future = prepareBuild('build-future', {...validBuild, capability_version: '2.0.0'});
  assert.equal(future.status, 'error');

  const unknown = validateBuildRequest({...validBuild, unexpected: true});
  assert.equal(unknown.valid, false);
  assert.ok(unknown.issues.some(issue => issue.code === 'UNKNOWN_FIELD'));
});

test('prioritizes error when missing and malformed inputs coexist', () => {
  const response = prepareBuild('build-error-priority', {...validBuild, specification: {objective: 42}, dependencies: 'invalid'});
  assert.equal(response.status, 'error');
});

test('blocks every requested operation regardless of its verb', () => {
  for (const operation of ['wipe workspace', 'rollback release', 'rotate keys']) {
    const response = prepareBuild(`build-blocked-${operation}`, {
      ...validBuild,
      requested_operations: [operation],
      approvals: [`human:approve:${operation}`],
    });
    assert.equal(response.status, 'blocked');
    assert.deepEqual(response.required_approvals, [`human:approve:${operation}`]);
    assert.equal(response.data, null);
  }
});

test('keeps plans logically isolated by project_id', () => {
  const first = prepareBuild('build-a', {...validBuild, project_id: 'project-a'});
  const second = prepareBuild('build-b', {...validBuild, project_id: 'project-b'});
  assert.equal(first.data?.project_id, 'project-a');
  assert.equal(second.data?.project_id, 'project-b');
  assert.notEqual(first.data?.project_id, second.data?.project_id);
});

test('does not execute or claim completion', () => {
  const response = prepareBuild('build-boundary', validBuild);
  assert.notEqual(response.data?.workflow_state, 'completed');
  assert.match(response.data?.proposal_or_findings.rollback_plan.join('\n') ?? '', /authorized client/i);
});
