import { envelope, type Mode, type WorkflowState } from './contracts.js';
import {
  F5_CONTRACT_VERSION,
  type CapabilityData,
  type CapabilityEnvelope,
  type CapabilityRisk,
  type CapabilityRequest,
  type SpecProposal,
  type ValidationIssue,
  type ValidationResult,
  readString,
  readStringList,
  validateCapabilityRequest,
  validationStatus,
} from './f5-contracts.js';

export interface BuildRequest extends CapabilityRequest {
  capability_id: 'build';
  specification: SpecProposal;
  specification_review_ref: string;
  dependencies: string[];
}

export interface BuildStep {
  id: string;
  title: string;
  outcome: string;
  execution_location: 'client';
}

export interface BuildPlan {
  specification_review_ref: string;
  objective: string;
  scope: string[];
  constraints: string[];
  acceptance_criteria: string[];
  steps: BuildStep[];
  expected_artifacts: string[];
  dependencies: string[];
  verification_steps: string[];
  rollback_plan: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: key, code: 'UNKNOWN_FIELD', message: `Unknown field: ${key}`});
  }
}

function readSpecification(value: unknown, issues: ValidationIssue[]): SpecProposal | null {
  if (value === undefined) {
    issues.push({path: 'specification', code: 'MISSING_REQUIRED', message: 'specification is required'});
    return null;
  }
  if (!isRecord(value)) {
    issues.push({path: 'specification', code: 'INVALID_TYPE', message: 'specification must be an object'});
    return null;
  }
  hasOnlyKnownFields(value, ['objective', 'scope', 'constraints', 'acceptance_criteria', 'context', 'assumptions', 'unresolved_questions'], issues);
  const objective = readString(value.objective, 'specification.objective', true, issues);
  const scope = readStringList(value.scope, 'specification.scope', true, issues);
  const constraints = readStringList(value.constraints, 'specification.constraints', true, issues);
  const acceptanceCriteria = readStringList(value.acceptance_criteria, 'specification.acceptance_criteria', true, issues);
  const context = readString(value.context, 'specification.context', true, issues);
  const assumptions = value.assumptions === undefined ? [] : readStringList(value.assumptions, 'specification.assumptions', false, issues);
  const unresolvedQuestions = value.unresolved_questions === undefined ? [] : readStringList(value.unresolved_questions, 'specification.unresolved_questions', false, issues);
  if (issues.length > 0) return null;
  return {
    objective: objective as string,
    scope: scope as string[],
    constraints: constraints as string[],
    acceptance_criteria: acceptanceCriteria as string[],
    context: context as string,
    assumptions: assumptions ?? [],
    unresolved_questions: unresolvedQuestions ?? [],
  };
}

export function validateBuildRequest(input: unknown): ValidationResult<BuildRequest> {
  const base = validateCapabilityRequest(input, ['specification', 'specification_review_ref', 'dependencies']);
  const issues = [...base.issues];
  if (!isRecord(input)) return {valid: false, value: null, issues};

  const specification = readSpecification(input.specification, issues);
  const reviewRef = readString(input.specification_review_ref, 'specification_review_ref', true, issues);
  let dependencies: string[] | undefined;
  if (input.dependencies === undefined) {
    issues.push({path: 'dependencies', code: 'MISSING_REQUIRED', message: 'dependencies is required; use an empty array when none exist'});
  } else {
    dependencies = readStringList(input.dependencies, 'dependencies', false, issues);
  }

  if (base.value?.capability_id !== 'build') issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Build requests must use capability_id=build'});
  if (reviewRef && base.value && !base.value.evidence.some(item => item.ref === reviewRef)) {
    issues.push({path: 'specification_review_ref', code: 'MISSING_REQUIRED', message: 'specification_review_ref must identify client-provided review evidence'});
  }
  if (specification && specification.unresolved_questions.length > 0) {
    issues.push({path: 'specification.unresolved_questions', code: 'MISSING_REQUIRED', message: 'Resolve specification questions before preparing a build plan'});
  }
  if (issues.length > 0 || !base.value || !specification || !reviewRef || !dependencies) return {valid: false, value: null, issues};

  return {
    valid: true,
    value: {
      ...base.value,
      capability_id: 'build',
      specification,
      specification_review_ref: reviewRef,
      dependencies,
    },
    issues: [],
  };
}

function evidenceRefs(request: CapabilityRequest): string[] {
  return request.evidence.map(item => item.ref);
}

function requestedOperations(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.requested_operations)) return [];
  if (!input.requested_operations.every(item => typeof item === 'string' && item.trim())) return [];
  return input.requested_operations.map(item => (item as string).trim());
}

function buildData<T>(request: BuildRequest, proposal: T, workflowState: WorkflowState, risks: CapabilityRisk[], decisions: string[]): CapabilityData<T> {
  return {
    capability_id: request.capability_id,
    capability_version: request.capability_version,
    project_id: request.project_id,
    mode: request.mode ?? null,
    workflow_state: workflowState,
    proposal_or_findings: proposal,
    risks,
    decisions_pending: decisions,
    execution_location: 'client',
  };
}

function blockedResponse(requestId: string, input: unknown, operations: string[]): CapabilityEnvelope<BuildPlan> {
  const base = validateCapabilityRequest(input, ['specification', 'specification_review_ref', 'dependencies']);
  const refs = base.value ? evidenceRefs(base.value) : [];
  return envelope(requestId, 'blocked', null, {
    warnings: ['Execution requests are outside the read-only build planning capability'],
    evidence_refs: refs,
    required_approvals: operations.map(operation => `human:approve:${operation}`),
    next_actions: ['Keep the request blocked', 'Evaluate execution in the authorized client under its security policy'],
  });
}

export function prepareBuild(requestId: string, input: unknown): CapabilityEnvelope<BuildPlan> {
  const validation = validateBuildRequest(input);
  const operations = requestedOperations(input);
  const hasMalformedInput = validation.issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code));
  if (operations.length > 0 && !hasMalformedInput) return blockedResponse(requestId, input, operations);

  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: validation.issues.map(issue => `${issue.path || 'request'}: ${issue.message}`),
      next_actions: [status === 'needs_input' ? 'Provide the reviewed specification, dependencies and matching evidence' : 'Correct the invalid build request'],
    });
  }

  const request = validation.value;
  const specification = request.specification;
  const plan: BuildPlan = {
    specification_review_ref: request.specification_review_ref,
    objective: specification.objective,
    scope: specification.scope,
    constraints: specification.constraints,
    acceptance_criteria: specification.acceptance_criteria,
    steps: [
      {id: 'prepare', title: 'Confirm implementation inputs', outcome: 'Verify the reviewed specification and dependencies in the authorized client', execution_location: 'client'},
      {id: 'implement', title: 'Apply the approved implementation plan', outcome: 'Make only client-side changes within the reviewed scope', execution_location: 'client'},
      {id: 'verify', title: 'Verify the resulting change', outcome: 'Run the approved checks and compare results with acceptance criteria', execution_location: 'client'},
    ],
    expected_artifacts: ['Client-side implementation changes', 'Test evidence', 'Review and rollback record'],
    dependencies: request.dependencies,
    verification_steps: ['Run the approved validation commands in the authorized client', 'Review evidence against the acceptance criteria', 'Obtain any separate approval required before sensitive action'],
    rollback_plan: ['Stop before applying unapproved changes', 'Use the authorized client rollback mechanism if an approved change must be reverted', 'Record the resulting evidence and unresolved risks'],
  };
  const data = buildData(request, plan, 'planned', [{
    id: 'client-execution-boundary',
    level: 'moderate',
    summary: 'The build result is a plan based on a client-reviewed specification and supplied evidence',
    mitigation: 'Keep implementation, command execution and rollback in the authorized client',
  }], []);
  const nextActions = ['Review the build plan with the client', 'Execute only through the authorized client after any required approval'];
  return envelope(requestId, 'ok', data, {evidence_refs: evidenceRefs(request), next_actions: nextActions});
}

export const BUILD_CONTRACT_VERSION = F5_CONTRACT_VERSION;
