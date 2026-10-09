import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startWorkflow} from '../dist/core/universal-flow.js';
import {nextState} from '../dist/core/workflow.js';

const evidence = [{ref: 'client:brief-1', summary: 'Brief and project context supplied by the authorized client'}];

function existingInput(project_id = 'project-existing') {
  return {
    project_id,
    requested_mode: 'existing',
    evidence,
    project_snapshot: {
      structure: ['src/', 'tests/'],
      config_files: ['package.json'],
      technologies: ['TypeScript'],
      documentation: ['README.md'],
      git_status: 'clean',
      tests: ['unit'],
    },
  };
}

test('new project produces a planned proposal', () => {
  const result = startWorkflow({project_id: 'new-project', goal: 'Build a catalog', scope: ['MVP'], priority_requirements: ['search'], evidence});
  assert.equal(result.status, 'ok');
  assert.equal(result.proposal.mode, 'new');
  assert.equal(result.proposal.state, 'planned');
  assert.deepEqual(result.proposal.proposed_structure, ['README.md', 'docs/', 'src/', 'tests/']);
});

test('existing project uses only the supplied snapshot', () => {
  const result = startWorkflow(existingInput());
  assert.equal(result.status, 'ok');
  assert.equal(result.proposal.mode, 'existing');
  assert.deepEqual(result.proposal.project_analysis?.structure, ['src/', 'tests/']);
  assert.match(result.proposal.acceptance_criteria.join('\n'), /supplied evidence/);
});

test('recovery returns known context and next steps', () => {
  const result = startWorkflow({
    project_id: 'project-recovery',
    requested_mode: 'recovery',
    recovery: {original_goal: 'Restore the release flow', last_known_state: 'verification pending', blockers: ['missing approval']},
    evidence,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.proposal.mode, 'recovery');
  assert.equal(result.proposal.recovery_summary?.last_known_state, 'verification pending');
  assert.ok(result.proposal.next_actions.length > 0);
});

test('ambiguous context returns needs_input', () => {
  const result = startWorkflow({...existingInput(), recovery: {last_known_state: 'interrupted'}});
  assert.equal(result.status, 'needs_input');
  assert.equal(result.proposal.mode, null);
  assert.match(result.proposal.decisions_pending[0], /conflicts|Both/);
});

test('insufficient evidence returns needs_input', () => {
  const result = startWorkflow({project_id: 'missing-evidence', requested_mode: 'existing', project_snapshot: {structure: ['src/']}});
  assert.equal(result.status, 'needs_input');
  assert.match(result.proposal.decisions_pending.join('\n'), /client evidence/);
});

test('draft can transition to planned', () => {
  assert.equal(nextState('draft', 'planned'), 'planned');
});

test('invalid workflow transition is rejected', () => {
  assert.throws(() => nextState('draft', 'completed'), /CONFLICT/);
});

test('destructive operation is blocked', () => {
  const result = startWorkflow({...existingInput(), requested_operations: ['deploy production']});
  assert.equal(result.status, 'blocked');
  assert.equal(result.proposal.state, 'blocked');
  assert.equal(result.proposal.risks[0].level, 'critical');
});

test('blocked operation requires explicit approval', () => {
  const result = startWorkflow({...existingInput(), requested_operations: ['database migration']});
  assert.deepEqual(result.proposal.required_approvals, ['human:approve:database migration']);
  assert.ok(result.proposal.decisions_pending.length > 0);
});

test('project proposals remain logically isolated', () => {
  const first = startWorkflow(existingInput('project-a'));
  const second = startWorkflow(existingInput('project-b'));
  assert.equal(first.proposal.project_id, 'project-a');
  assert.equal(second.proposal.project_id, 'project-b');
  assert.notEqual(first.proposal.project_id, second.proposal.project_id);
});

test('workflow plan is client-side and read-only', () => {
  const result = startWorkflow({project_id: 'readonly', goal: 'Plan safely', evidence});
  assert.equal(result.status, 'ok');
  assert.ok(result.proposal.incremental_plan.every(step => step.execution_location === 'client'));
  assert.match(result.proposal.acceptance_criteria.join('\n'), /No remote file write/);
});

test('conflicting requested mode does not override evidence', () => {
  const result = startWorkflow({...existingInput(), requested_mode: 'new', goal: 'Start over'});
  assert.equal(result.status, 'needs_input');
  assert.match(result.proposal.decisions_pending[0], /conflicts/);
});

test('MCP route contains no remote execution primitives', () => {
  const route = readFileSync('apps/mcp-server/app/mcp/route.ts', 'utf8');
  assert.doesNotMatch(route, /child_process|writeFile|spawn\(|execFile\(|rmSync|unlinkSync/);
  assert.match(route, /projectos_start_workflow/);
});
