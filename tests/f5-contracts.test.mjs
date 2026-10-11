import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSpec, validateCapabilityRequest, validateSpecRequest} from '../dist/core/f5-contracts.js';

const validSpec = {
  capability_id: 'spec',
  capability_version: '1.0.0',
  project_id: 'f5-contracts',
  mode: 'new',
  objective: 'Define a read-only project specification',
  scope: ['Core contracts'],
  constraints: ['No remote execution'],
  acceptance_criteria: ['Envelope remains Core 1.0'],
  context: 'The authorized client supplied the initial project context',
  evidence: [{ref: 'client:brief', summary: 'Approved project brief'}],
};

test('validates a complete capability request and spec request', () => {
  const commonRequest = {
    capability_id: 'spec',
    capability_version: '1.0.0',
    project_id: 'f5-contracts',
    mode: 'new',
    evidence: [{ref: 'client:brief', summary: 'Approved project brief'}],
  };
  assert.equal(validateCapabilityRequest(commonRequest).valid, true);
  const result = validateSpecRequest(validSpec);
  assert.equal(result.valid, true);
  assert.equal(result.value?.project_id, 'f5-contracts');
});

test('rejects invalid types and unknown fields deterministically', () => {
  const result = validateSpecRequest({...validSpec, scope: 'Core contracts', unexpected: true});
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_TYPE' && issue.path === 'scope'));
  assert.ok(result.issues.some(issue => issue.code === 'UNKNOWN_FIELD' && issue.path === 'unexpected'));
});

test('returns needs_input for incomplete specification evidence', () => {
  const response = prepareSpec('f5-needs-input', {...validSpec, objective: '', evidence: []});
  assert.equal(response.schema_version, '1.0');
  assert.equal(response.request_id, 'f5-needs-input');
  assert.equal(response.status, 'needs_input');
  assert.equal(response.data, null);
  assert.ok(response.warnings.length > 0);
});

test('returns error for malformed capability input', () => {
  const response = prepareSpec('f5-invalid', {...validSpec, capability_version: 'next'});
  assert.equal(response.status, 'error');
  assert.equal(response.data, null);
});

test('rejects future SemVer versions as unsupported', () => {
  const validation = validateSpecRequest({...validSpec, capability_version: '2.0.0'});
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some(issue => issue.code === 'UNSUPPORTED_VERSION'));
  const response = prepareSpec('f5-future-version', {...validSpec, capability_version: '2.0.0'});
  assert.equal(response.status, 'error');
  assert.match(response.warnings.join('\n'), /Unsupported F5 contract version/);
});

test('distinguishes semantic absence from malformed types', () => {
  const missing = prepareSpec('f5-empty-objective', {...validSpec, objective: '   '});
  assert.equal(missing.status, 'needs_input');
  const malformed = prepareSpec('f5-wrong-objective-type', {...validSpec, objective: ['not', 'a', 'string']});
  assert.equal(malformed.status, 'error');
});

test('returns the Core envelope and a planned client-side specification', () => {
  const response = prepareSpec('f5-ok', validSpec);
  assert.deepEqual(Object.keys(response).sort(), ['data', 'evidence_refs', 'next_actions', 'request_id', 'required_approvals', 'schema_version', 'status', 'warnings']);
  assert.equal(response.status, 'ok');
  assert.equal(response.data?.capability_id, 'spec');
  assert.equal(response.data?.workflow_state, 'planned');
  assert.equal(response.data?.execution_location, 'client');
  assert.equal('evidence_refs' in (response.data ?? {}), false);
  assert.deepEqual(response.evidence_refs, ['client:brief']);
  assert.deepEqual(response.next_actions, ['Review the specification with the client', 'Proceed to a separately approved build plan']);
  assert.deepEqual(response.required_approvals, []);
});

test('blocks every requested operation and ignores unilateral approvals', () => {
  for (const operation of ['wipe workspace', 'rollback release', 'rotate keys']) {
    const response = prepareSpec(`f5-blocked-${operation}`, {
      ...validSpec,
      requested_operations: [operation],
      approvals: [`human:approve:${operation}`],
    });
    assert.equal(response.status, 'blocked');
    assert.equal(response.data?.workflow_state, 'blocked');
    assert.deepEqual(response.required_approvals, [`human:approve:${operation}`]);
    assert.equal(response.data?.execution_location, 'client');
  }
});

test('keeps project proposals logically isolated without persistence claims', () => {
  const first = prepareSpec('f5-project-a', {...validSpec, project_id: 'project-a'});
  const second = prepareSpec('f5-project-b', {...validSpec, project_id: 'project-b'});
  assert.equal(first.data?.project_id, 'project-a');
  assert.equal(second.data?.project_id, 'project-b');
  assert.notEqual(first.data?.project_id, second.data?.project_id);
});

test('does not mark a specification completed without a separate evidence-backed transition', () => {
  const response = prepareSpec('f5-state', validSpec);
  assert.notEqual(response.data?.workflow_state, 'completed');
  assert.equal(response.data?.workflow_state, 'planned');
});
