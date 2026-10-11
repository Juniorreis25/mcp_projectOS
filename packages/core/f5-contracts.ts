import { envelope, type Envelope, type Mode, type Risk, type Status, type WorkflowState } from './contracts.js';

export const F5_CONTRACT_VERSION = '1.0.0' as const;
export const F5_CAPABILITY_IDS = ['spec', 'build', 'review', 'test', 'debug', 'protect'] as const;
export type F5CapabilityId = typeof F5_CAPABILITY_IDS[number];

export interface CapabilityEvidence {
  ref: string;
  summary: string;
}

export interface CapabilityRisk {
  id: string;
  level: Risk;
  summary: string;
  mitigation: string;
}

export interface CapabilityData<TProposalOrFindings> {
  capability_id: F5CapabilityId;
  capability_version: string;
  project_id: string;
  mode: Mode | null;
  workflow_state: WorkflowState;
  proposal_or_findings: TProposalOrFindings;
  risks: CapabilityRisk[];
  decisions_pending: string[];
  execution_location: 'client';
}

export type CapabilityEnvelope<TProposalOrFindings> = Envelope<CapabilityData<TProposalOrFindings> | null>;

export interface CapabilityRequest {
  capability_id: F5CapabilityId;
  capability_version: string;
  project_id: string;
  mode?: Mode;
  evidence: CapabilityEvidence[];
  requested_operations?: string[];
  approvals?: string[];
}

export interface SpecRequest extends CapabilityRequest {
  capability_id: 'spec';
  objective: string;
  scope: string[];
  constraints: string[];
  acceptance_criteria: string[];
  context: string;
}

export interface SpecProposal {
  objective: string;
  scope: string[];
  constraints: string[];
  acceptance_criteria: string[];
  context: string;
  assumptions: string[];
  unresolved_questions: string[];
}

export interface ValidationIssue {
  path: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_FIELD';
  message: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

const capabilityIdSet = new Set<string>(F5_CAPABILITY_IDS);
const modeSet = new Set<Mode>(['new', 'existing', 'recovery']);
const supportedVersions = new Set<string>([F5_CONTRACT_VERSION]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: key, code: 'UNKNOWN_FIELD', message: `Unknown field: ${key}`});
  }
}

export function readString(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be a string`});
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) issues.push({path, code: required ? 'MISSING_REQUIRED' : 'INVALID_VALUE', message: `${path} must not be empty`});
  return trimmed;
}

export function readStringList(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be an array of strings`});
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      issues.push({path: `${path}[${index}]`, code: 'INVALID_TYPE', message: 'List items must be strings'});
      return;
    }
    const trimmed = item.trim();
    if (!trimmed) issues.push({path: `${path}[${index}]`, code: 'INVALID_VALUE', message: 'List items must not be empty'});
    else result.push(trimmed);
  });
  if (required && result.length === 0) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} must contain at least one item`});
  return result;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): CapabilityEvidence[] | undefined {
  if (value === undefined) {
    issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'evidence is required'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE', message: 'evidence must be an array'});
    return undefined;
  }
  const evidence: CapabilityEvidence[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({path: `evidence[${index}]`, code: 'INVALID_TYPE', message: 'Evidence must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary'], issues);
    const ref = readString(item.ref, `evidence[${index}].ref`, true, issues);
    const summary = readString(item.summary, `evidence[${index}].summary`, true, issues);
    if (ref && summary) evidence.push({ref, summary});
  });
  if (evidence.length === 0) issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'At least one evidence item is required'});
  return evidence;
}

function readRequestBase(input: Record<string, unknown>, issues: ValidationIssue[]): CapabilityRequest {
  const capabilityId = readString(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readString(input.capability_version, 'capability_version', true, issues);
  const projectId = readString(input.project_id, 'project_id', true, issues);
  const mode = input.mode === undefined ? undefined : readString(input.mode, 'mode', true, issues) as Mode | undefined;
  const evidence = readEvidence(input.evidence, issues) ?? [];
  const requestedOperations = input.requested_operations === undefined ? undefined : readStringList(input.requested_operations, 'requested_operations', false, issues);
  const approvals = input.approvals === undefined ? undefined : readStringList(input.approvals, 'approvals', false, issues);

  if (capabilityId && !capabilityIdSet.has(capabilityId)) issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Unsupported F5 capability'});
  if (capabilityVersion && !/^\d+\.\d+\.\d+$/.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE', message: 'capability_version must use semantic versioning'});
  else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION', message: `Unsupported F5 contract version: ${capabilityVersion}`});
  if (mode && !modeSet.has(mode)) issues.push({path: 'mode', code: 'INVALID_VALUE', message: 'mode must be new, existing or recovery'});

  return {
    capability_id: (capabilityId as F5CapabilityId | undefined) ?? 'spec',
    capability_version: capabilityVersion ?? F5_CONTRACT_VERSION,
    project_id: projectId ?? '',
    ...(mode ? {mode} : {}),
    evidence,
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateCapabilityRequest(input: unknown, additionalFields: readonly string[] = []): ValidationResult<CapabilityRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'mode', 'evidence', 'requested_operations', 'approvals', ...additionalFields], issues);
  const value = readRequestBase(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

export function validationStatus(issues: ValidationIssue[]): Extract<Status, 'needs_input' | 'error'> {
  const hasMalformedInput = issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code));
  return hasMalformedInput ? 'error' : issues.some(issue => issue.code === 'MISSING_REQUIRED') ? 'needs_input' : 'error';
}

export function validateSpecRequest(input: unknown): ValidationResult<SpecRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'mode', 'evidence', 'requested_operations', 'approvals', 'objective', 'scope', 'constraints', 'acceptance_criteria', 'context'], issues);
  const base = readRequestBase(input, issues);
  const objective = readString(input.objective, 'objective', true, issues);
  const scope = readStringList(input.scope, 'scope', true, issues);
  const constraints = readStringList(input.constraints, 'constraints', true, issues);
  const acceptanceCriteria = readStringList(input.acceptance_criteria, 'acceptance_criteria', true, issues);
  const context = readString(input.context, 'context', true, issues);
  if (base.capability_id !== 'spec') issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Spec requests must use capability_id=spec'});
  if (issues.length > 0) return {valid: false, value: null, issues};
  return {
    valid: true,
    value: {
      ...base,
      capability_id: 'spec',
      objective: objective as string,
      scope: scope as string[],
      constraints: constraints as string[],
      acceptance_criteria: acceptanceCriteria as string[],
      context: context as string,
    },
    issues: [],
  };
}

function evidenceRefs(evidence: CapabilityEvidence[]): string[] {
  return evidence.map(item => item.ref);
}

function commonData<T>(request: SpecRequest, proposal: T, state: WorkflowState, risks: CapabilityRisk[], decisions: string[]): CapabilityData<T> {
  return {
    capability_id: request.capability_id,
    capability_version: request.capability_version,
    project_id: request.project_id,
    mode: request.mode ?? null,
    workflow_state: state,
    proposal_or_findings: proposal,
    risks,
    decisions_pending: decisions,
    execution_location: 'client',
  };
}

export function prepareSpec(requestId: string, input: unknown): CapabilityEnvelope<SpecProposal> {
  const validation = validateSpecRequest(input);
  if (!validation.valid || !validation.value) {
    return envelope(requestId, validationStatus(validation.issues), null, {
      warnings: validation.issues.map(issue => `${issue.path || 'request'}: ${issue.message}`),
      next_actions: [validationStatus(validation.issues) === 'needs_input' ? 'Provide the missing specification inputs and evidence' : 'Correct the invalid specification request'],
    });
  }

  const request = validation.value;
  // requested_operations expresses intent only; any non-empty list is outside this read-only capability.
  const requestedOperations = request.requested_operations ?? [];
  const proposal: SpecProposal = {
    objective: request.objective,
    scope: request.scope,
    constraints: request.constraints,
    acceptance_criteria: request.acceptance_criteria,
    context: request.context,
    assumptions: [],
    unresolved_questions: [],
  };

  if (requestedOperations.length > 0) {
    const requiredApprovals = requestedOperations.map(operation => `human:approve:${operation}`);
    const nextActions = ['Keep the capability blocked', 'Obtain approval in the authorized client', 'Re-submit a read-only specification'];
    const data = commonData(request, proposal, 'blocked', [{
      id: 'sensitive-operation',
      level: 'critical',
      summary: `Execution was requested outside the read-only specification capability: ${requestedOperations.join(', ')}`,
      mitigation: 'The authorized client must evaluate and execute any such operation under its own security policy after explicit approval',
    }], ['Whether and when the authorized client may perform the requested operation']);
    return envelope(requestId, 'blocked', data, {required_approvals: requiredApprovals, evidence_refs: evidenceRefs(request.evidence), next_actions: nextActions});
  }

  const nextActions = ['Review the specification with the client', 'Proceed to a separately approved build plan'];
  const data = commonData(request, proposal, 'planned', [{
    id: 'client-execution-boundary',
    level: 'low',
    summary: 'The specification is a proposal based on client-provided context',
    mitigation: 'Review the proposal and keep implementation and execution in the authorized client',
  }], []);
  return envelope(requestId, 'ok', data, {evidence_refs: evidenceRefs(request.evidence), next_actions: nextActions});
}
