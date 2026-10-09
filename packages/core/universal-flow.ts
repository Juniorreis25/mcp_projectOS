import type {Mode, Risk, Status, WorkflowState} from './contracts.js';

export interface ClientEvidence {
  ref: string;
  summary: string;
}

export interface ProjectSnapshot {
  structure?: string[];
  config_files?: string[];
  technologies?: string[];
  documentation?: string[];
  git_status?: string;
  tests?: string[];
  risks?: string[];
}

export interface RecoveryContext {
  original_goal?: string;
  last_known_state?: string;
  pending_changes?: string[];
  previous_decisions?: string[];
  incomplete_work?: string[];
  blockers?: string[];
  next_steps?: string[];
}

export interface StartWorkflowInput {
  project_id?: string;
  requested_mode?: Mode;
  goal?: string;
  scope?: string[];
  constraints?: string[];
  priority_requirements?: string[];
  project_snapshot?: ProjectSnapshot;
  recovery?: RecoveryContext;
  evidence?: ClientEvidence[];
  requested_operations?: string[];
  approvals?: string[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  outcome: string;
  execution_location: 'client';
}

export interface WorkflowRisk {
  id: string;
  level: Risk;
  summary: string;
  mitigation: string;
}

export interface WorkflowProposal {
  project_id: string;
  mode: Mode | null;
  state: WorkflowState;
  objective: string | null;
  initial_scope: string[];
  constraints: string[];
  priority_requirements: string[];
  proposed_structure: string[];
  incremental_plan: WorkflowStep[];
  acceptance_criteria: string[];
  project_analysis: ProjectSnapshot | null;
  recovery_summary: RecoveryContext | null;
  risks: WorkflowRisk[];
  decisions_pending: string[];
  required_approvals: string[];
  evidence_refs: string[];
  next_actions: string[];
}

export interface StartWorkflowResult {
  status: Extract<Status, 'ok' | 'needs_input' | 'blocked'>;
  proposal: WorkflowProposal;
}

const sensitiveOperation = /delete|remove|drop|migrat|deploy|publish|write|execute|shell|command|credential|secret|production/i;

function startState(blocked: boolean): WorkflowState {
  // workflow.ts defines both destinations as valid transitions from draft.
  return blocked ? 'blocked' : 'planned';
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map(value => value.trim()).filter(Boolean);
}

function evidenceRefs(input: StartWorkflowInput): string[] {
  return (input.evidence ?? []).map(item => item.ref.trim()).filter(Boolean);
}

function emptyProposal(input: StartWorkflowInput, pending: string[], risks: WorkflowRisk[]): WorkflowProposal {
  const projectId = clean(input.project_id) ?? 'unassigned';
  const refs = evidenceRefs(input);
  return {
    project_id: projectId,
    mode: null,
    state: 'draft',
    objective: clean(input.goal) ?? null,
    initial_scope: cleanList(input.scope),
    constraints: cleanList(input.constraints),
    priority_requirements: cleanList(input.priority_requirements),
    proposed_structure: [],
    incremental_plan: [],
    acceptance_criteria: [],
    project_analysis: input.project_snapshot ?? null,
    recovery_summary: input.recovery ?? null,
    risks,
    decisions_pending: pending,
    required_approvals: [],
    evidence_refs: refs,
    next_actions: pending.map(item => `Provide evidence or decision: ${item}`),
  };
}

function determineMode(input: StartWorkflowInput): {mode?: Mode; ambiguity?: string} {
  const hasSnapshot = Boolean(input.project_snapshot);
  const hasRecovery = Boolean(input.recovery);
  if (hasSnapshot && hasRecovery && !input.requested_mode) return {ambiguity: 'Both project_snapshot and recovery were provided'};
  if (input.requested_mode === 'new' && (hasSnapshot || hasRecovery)) return {ambiguity: 'requested_mode=new conflicts with supplied existing or recovery evidence'};
  if (input.requested_mode === 'existing' && hasRecovery) return {ambiguity: 'requested_mode=existing conflicts with recovery evidence'};
  if (input.requested_mode === 'recovery' && hasSnapshot) return {ambiguity: 'requested_mode=recovery conflicts with project snapshot evidence'};
  if (input.requested_mode) return {mode: input.requested_mode};
  if (hasRecovery) return {mode: 'recovery'};
  if (hasSnapshot) return {mode: 'existing'};
  if (clean(input.goal)) return {mode: 'new'};
  return {ambiguity: 'No mode-defining evidence or goal was provided'};
}

function basePlan(mode: Mode): WorkflowStep[] {
  const common: WorkflowStep[] = [
    {id: 'inspect', title: 'Confirm supplied evidence', outcome: 'Record source, scope and unknowns without accessing a remote workspace', execution_location: 'client'},
    {id: 'plan', title: 'Prepare the smallest safe plan', outcome: 'Produce dependencies, evidence needs and acceptance checks', execution_location: 'client'},
    {id: 'validate', title: 'Validate before execution', outcome: 'Require explicit approvals before any sensitive client-side operation', execution_location: 'client'},
  ];
  if (mode === 'new') common.splice(1, 0, {id: 'shape', title: 'Shape the initial project', outcome: 'Confirm objective, scope, constraints and proposed structure', execution_location: 'client'});
  if (mode === 'existing') common.splice(1, 0, {id: 'analyze', title: 'Analyze the supplied snapshot', outcome: 'Summarize structure, configuration, technologies, documentation, Git and tests', execution_location: 'client'});
  if (mode === 'recovery') common.splice(1, 0, {id: 'recover', title: 'Reconstruct the last known state', outcome: 'Separate known facts, pending work, blockers and unknowns', execution_location: 'client'});
  return common;
}

function acceptanceCriteria(mode: Mode): string[] {
  const common = ['All claims have client-provided evidence references', 'No remote file write, shell command or deployment is performed', 'Sensitive actions remain pending explicit approval'];
  if (mode === 'new') return ['Objective, initial scope, constraints and priority requirements are confirmed', 'A proposed structure and incremental plan are reviewed by the client', ...common];
  if (mode === 'existing') return ['Repository structure, configuration, technologies, documentation, Git state and tests are analyzed only from supplied evidence', 'Risks and inconsistencies are recorded without claiming direct workspace access', ...common];
  return ['Original objective, last known state, pending changes, prior decisions, incomplete work and blockers are identified or marked unknown', 'Next recovery steps are safe and evidence-backed', ...common];
}

function modeRequirements(input: StartWorkflowInput, mode: Mode): string[] {
  const missing: string[] = [];
  if (!(input.evidence ?? []).some(item => clean(item.ref) && clean(item.summary))) missing.push('client evidence');
  if (mode === 'new' && !clean(input.goal)) missing.push('goal');
  if ((mode === 'existing' || mode === 'recovery') && !clean(input.project_id)) missing.push('project_id');
  if (mode === 'existing') {
    const snapshot = input.project_snapshot;
    if (!snapshot || Object.values(snapshot).every(value => Array.isArray(value) ? value.length === 0 : !clean(value))) missing.push('project_snapshot details');
  }
  if (mode === 'recovery') {
    const recovery = input.recovery;
    if (!recovery || (!clean(recovery.original_goal) && !clean(recovery.last_known_state) && cleanList(recovery.blockers).length === 0)) missing.push('recovery context');
  }
  return missing;
}

export function startWorkflow(input: StartWorkflowInput): StartWorkflowResult {
  const selection = determineMode(input);
  if (!selection.mode || selection.ambiguity) {
    const proposal = emptyProposal(input, [selection.ambiguity ?? 'mode'], [{id: 'mode-selection', level: 'moderate', summary: 'The workflow mode cannot be selected safely', mitigation: 'Ask the client to choose one mode and provide matching evidence'}]);
    return {status: 'needs_input', proposal};
  }

  const mode = selection.mode;
  const missing = modeRequirements(input, mode);
  if (missing.length > 0) {
    const proposal = emptyProposal(input, missing, [{id: 'insufficient-evidence', level: 'moderate', summary: 'Required evidence is incomplete', mitigation: 'Collect the missing client-side evidence before planning'}]);
    proposal.mode = mode;
    return {status: 'needs_input', proposal};
  }

  const operations = cleanList(input.requested_operations);
  const sensitive = operations.filter(operation => sensitiveOperation.test(operation));
  const risks: WorkflowRisk[] = sensitive.length > 0
    ? [{id: 'sensitive-operation', level: 'critical', summary: `Sensitive operations were requested: ${sensitive.join(', ')}`, mitigation: 'The remote MCP server never executes these operations; the authorized client must handle them after explicit approval'}]
    : [{id: 'read-only-proposal', level: mode === 'new' ? 'low' : 'moderate', summary: 'This response is a proposal based on supplied evidence', mitigation: 'Keep execution in the authorized client and verify evidence before changes'}];
  const approvals = sensitive.map(operation => `human:approve:${operation}`);
  const state = startState(sensitive.length > 0);
  const projectId = clean(input.project_id) ?? 'unassigned';
  const objective = clean(input.goal) ?? (mode === 'existing' ? 'Analyze and continue the existing project' : input.recovery?.original_goal ?? 'Recover and resume the interrupted project');
  const proposal: WorkflowProposal = {
    project_id: projectId,
    mode,
    state,
    objective: objective ?? null,
    initial_scope: cleanList(input.scope),
    constraints: cleanList(input.constraints),
    priority_requirements: cleanList(input.priority_requirements),
    proposed_structure: mode === 'new' ? ['README.md', 'docs/', 'src/', 'tests/'] : cleanList(input.project_snapshot?.structure),
    incremental_plan: basePlan(mode),
    acceptance_criteria: acceptanceCriteria(mode),
    project_analysis: mode === 'existing' ? input.project_snapshot ?? null : null,
    recovery_summary: mode === 'recovery' ? input.recovery ?? null : null,
    risks,
    decisions_pending: sensitive.length > 0 ? ['Whether and when the authorized client may perform the requested sensitive operations'] : [],
    required_approvals: approvals,
    evidence_refs: evidenceRefs(input),
    next_actions: sensitive.length > 0 ? ['Keep the workflow blocked', 'Obtain explicit human approval in the authorized client', 'Re-submit a read-only proposal after approval'] : ['Review the proposal with the client', 'Collect any remaining evidence', 'Keep implementation and execution in the authorized client'],
  };
  return {status: sensitive.length > 0 ? 'blocked' : 'ok', proposal};
}
