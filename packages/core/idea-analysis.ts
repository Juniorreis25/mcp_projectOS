import { envelope, type Envelope, type Risk, type WorkflowState } from './contracts.js';
import { F5_CONTRACT_VERSION, type ValidationIssue, type ValidationResult } from './f5-contracts.js';

export const IDEA_CONTRACT_VERSION = F5_CONTRACT_VERSION;
export const IDEA_MAX_TEXT_LENGTH = 20_000;
export const IDEA_MAX_LIST_ITEMS = 100;

export type IdeaStatusEnvelope = Envelope<IdeaData<IdeaProposal> | null>;

export interface IdeaEvidence {
  ref: string;
  summary: string;
}

export interface IdeaHypothesis {
  id: string;
  statement: string;
  evidence_refs: string[];
}

export interface IdeaRequest {
  capability_id: 'idea';
  capability_version: string;
  project_id: string;
  objective: string;
  problem: string;
  target_audience: string;
  benefits: string[];
  constraints: string[];
  hypotheses: IdeaHypothesis[];
  evidence: IdeaEvidence[];
  requested_operations?: string[];
  approvals?: string[];
}

export interface IdeaProposal {
  objective: string;
  problem: string;
  target_audience: string;
  benefits: string[];
  constraints: string[];
  hypotheses: Array<IdeaHypothesis & {status: 'unverified'}>;
  verified_facts: string[];
  evidence_assessment: 'client_declared_not_verified';
  information_gaps: string[];
  assumptions: string[];
}

export interface IdeaData<TProposal> {
  capability_id: 'idea';
  capability_version: string;
  project_id: string;
  workflow_state: WorkflowState;
  proposal_or_findings: TProposal;
  risks: Array<{id: string; level: Risk; summary: string; mitigation: string}>;
  decisions_pending: string[];
  execution_location: 'client';
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const supportedVersions = new Set<string>([IDEA_CONTRACT_VERSION]);
const sensitiveIdentifierPattern = /(?:authorization\s*:\s*bearer|\b(?:gh[pousr]_|sk-|xox[baprs]-)|\b(?:password|passwd|secret|token|api[_ -]?key)\b)/i;
const secretPatterns: readonly RegExp[] = [
  /authorization\s*:\s*bearer\s+[^\s,;]+/gi,
  /\b(?:bearer|password|passwd|secret|token|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_/-]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/gi,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];
const contradictionPattern = /\b(?:contradict(?:s|ory|ion)?|conflict(?:s|ing)?|inconsistent|incompat(?:ible|ibility))\b|contradi[cç][aã]o|incompat[ií]vel|conflitante/i;
const genericObjectivePattern = /^(?:(?:start|create|build|make|plan|develop|work on)\s+(?:a|an|the|my|new)?\s*(?:project|app|application|system|solution|workflow)|(?:iniciar|criar|construir|fazer|planejar|desenvolver)\s+(?:um|uma|o|a|meu|minha|novo|nova)?\s*(?:projeto|aplicativo|aplica[cç][aã]o|sistema|solu[cç][aã]o|fluxo))$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[], path = ''): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: path ? `${path}.${key}` : key, code: 'UNKNOWN_FIELD', message: 'Unknown field'});
  }
}

function readText(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be a string`});
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    issues.push({path, code: required ? 'MISSING_REQUIRED' : 'INVALID_VALUE', message: `${path} must not be empty`});
    return undefined;
  }
  if (trimmed.length > IDEA_MAX_TEXT_LENGTH) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} exceeds the maximum text length`});
  }
  return trimmed;
}

function readIdentifier(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const identifier = readText(value, path, true, issues);
  if (!identifier) return undefined;
  if (!identifierPattern.test(identifier) || sensitiveIdentifierPattern.test(identifier)) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} must be a safe identifier`});
    return undefined;
  }
  return identifier;
}

function readTextList(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be an array of strings`});
    return undefined;
  }
  if (value.length > IDEA_MAX_LIST_ITEMS) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} contains too many items`});
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const text = readText(item, `${path}[${index}]`, true, issues);
    if (text) result.push(text);
  });
  return result;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): IdeaEvidence[] | undefined {
  if (value === undefined) {
    issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'evidence is required'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE', message: 'evidence must be an array'});
    return undefined;
  }
  if (value.length > IDEA_MAX_LIST_ITEMS) {
    issues.push({path: 'evidence', code: 'INVALID_VALUE', message: 'evidence contains too many items'});
  }
  const refs = new Set<string>();
  const evidence: IdeaEvidence[] = [];
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Evidence must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary'], issues, path);
    const ref = readIdentifier(item.ref, `${path}.ref`, issues);
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    if (ref && refs.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE', message: 'Evidence references must be unique'});
    if (ref) refs.add(ref);
    if (ref && summary) evidence.push({ref, summary});
  });
  return evidence;
}

function readHypotheses(value: unknown, issues: ValidationIssue[]): IdeaHypothesis[] | undefined {
  if (value === undefined) {
    issues.push({path: 'hypotheses', code: 'MISSING_REQUIRED', message: 'hypotheses is required'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'hypotheses', code: 'INVALID_TYPE', message: 'hypotheses must be an array'});
    return undefined;
  }
  if (value.length > IDEA_MAX_LIST_ITEMS) {
    issues.push({path: 'hypotheses', code: 'INVALID_VALUE', message: 'hypotheses contains too many items'});
  }
  const ids = new Set<string>();
  const hypotheses: IdeaHypothesis[] = [];
  value.forEach((item, index) => {
    const path = `hypotheses[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Hypotheses must be objects'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'statement', 'evidence_refs'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const statement = readText(item.statement, `${path}.statement`, true, issues);
    const evidenceRefs = readTextList(item.evidence_refs, `${path}.evidence_refs`, true, issues);
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Hypothesis identifiers must be unique'});
    if (id) ids.add(id);
    if (id && statement && evidenceRefs) hypotheses.push({id, statement, evidence_refs: evidenceRefs});
  });
  return hypotheses;
}

function readOperations(value: unknown, path: string, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) return undefined;
  return readTextList(value, path, false, issues);
}

function readRequest(input: Record<string, unknown>, issues: ValidationIssue[]): IdeaRequest {
  const capabilityId = readText(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readText(input.capability_version, 'capability_version', true, issues);
  const projectId = readIdentifier(input.project_id, 'project_id', issues);
  const objective = readText(input.objective, 'objective', true, issues);
  const problem = readText(input.problem, 'problem', true, issues);
  const targetAudience = readText(input.target_audience, 'target_audience', true, issues);
  const benefits = readTextList(input.benefits, 'benefits', true, issues);
  const constraints = readTextList(input.constraints, 'constraints', true, issues);
  const hypotheses = readHypotheses(input.hypotheses, issues);
  const evidence = readEvidence(input.evidence, issues);
  const requestedOperations = readOperations(input.requested_operations, 'requested_operations', issues);
  const approvals = readOperations(input.approvals, 'approvals', issues);

  if (capabilityId !== 'idea') issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Idea requests must use capability_id=idea'});
  if (capabilityVersion && !/^\d+\.\d+\.\d+$/.test(capabilityVersion)) {
    issues.push({path: 'capability_version', code: 'INVALID_VALUE', message: 'capability_version must use semantic versioning'});
  } else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) {
    issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION', message: 'Unsupported idea contract version'});
  }

  const evidenceRefs = new Set((evidence ?? []).map(item => item.ref));
  if (evidenceRefs.size > 0) {
    for (const [index, hypothesis] of (hypotheses ?? []).entries()) {
      for (const ref of hypothesis.evidence_refs) {
        if (!evidenceRefs.has(ref)) issues.push({path: `hypotheses[${index}].evidence_refs`, code: 'INVALID_VALUE', message: 'Hypothesis references unknown evidence'});
      }
    }
  }

  return {
    capability_id: 'idea',
    capability_version: capabilityVersion ?? IDEA_CONTRACT_VERSION,
    project_id: projectId ?? '',
    objective: objective ?? '',
    problem: problem ?? '',
    target_audience: targetAudience ?? '',
    benefits: benefits ?? [],
    constraints: constraints ?? [],
    hypotheses: hypotheses ?? [],
    evidence: evidence ?? [],
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateIdeaRequest(input: unknown): ValidationResult<IdeaRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'objective', 'problem', 'target_audience', 'benefits', 'constraints', 'hypotheses', 'evidence', 'requested_operations', 'approvals'], issues);
  const value = readRequest(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

function validationStatus(issues: ValidationIssue[]): 'needs_input' | 'error' {
  return issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code)) ? 'error' : 'needs_input';
}

function sanitizeText(value: string): string {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value);
}

function evidenceRefs(request: IdeaRequest): string[] {
  return request.evidence.map(item => item.ref);
}

function contradictoryEvidence(request: IdeaRequest): boolean {
  return request.evidence.some(item => contradictionPattern.test(item.summary));
}

function ambiguousIdea(request: IdeaRequest): boolean {
  return genericObjectivePattern.test(request.objective) || genericObjectivePattern.test(request.problem);
}

function warningsForValidation(issues: ValidationIssue[]): string[] {
  return issues.map(issue => `${issue.path || 'request'}: ${issue.message}`);
}

function blockedResponse(requestId: string, request: IdeaRequest): IdeaStatusEnvelope {
  return envelope(requestId, 'blocked', null, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:approval-required'],
    warnings: ['Requested operations are outside the read-only idea capability'],
    next_actions: ['Keep the request blocked', 'Evaluate any execution only in the authorized client under its own security policy'],
  });
}

export function prepareIdea(requestId: string, input: unknown): IdeaStatusEnvelope {
  const validation = validateIdeaRequest(input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      evidence_refs: [],
      warnings: warningsForValidation(validation.issues),
      next_actions: [status === 'needs_input' ? 'Provide the missing idea inputs and declared evidence' : 'Correct the invalid idea request'],
    });
  }

  const request = validation.value;
  if ((request.requested_operations ?? []).length > 0) return blockedResponse(requestId, request);

  if (request.evidence.length === 0) {
    return envelope(requestId, 'needs_input', null, {
      warnings: ['Declared evidence is required before structuring the idea'],
      next_actions: ['Provide client-declared evidence and its references', 'Separate verified facts from unverified hypotheses'],
    });
  }

  if (request.benefits.length === 0 || request.constraints.length === 0 || request.hypotheses.length === 0) {
    return envelope(requestId, 'needs_input', null, {
      evidence_refs: evidenceRefs(request),
      warnings: ['The idea is incomplete: benefits, constraints and hypotheses must be supplied'],
      next_actions: ['Provide the missing benefits, constraints and hypotheses', 'Keep hypotheses separate from verified facts'],
    });
  }

  if (contradictoryEvidence(request)) {
    return envelope(requestId, 'needs_input', null, {
      evidence_refs: evidenceRefs(request),
      warnings: ['Evidence contains a possible contradiction and requires client reconciliation'],
      next_actions: ['Reconcile the conflicting evidence', 'Resubmit the idea with the resulting decision recorded'],
    });
  }

  if (ambiguousIdea(request)) {
    return envelope(requestId, 'needs_input', null, {
      evidence_refs: evidenceRefs(request),
      warnings: ['The objective or problem statement is too generic to structure safely'],
      next_actions: ['Describe the concrete outcome or problem', 'Identify the initial scope and intended audience'],
    });
  }

  const proposal: IdeaProposal = {
    objective: sanitizeText(request.objective),
    problem: sanitizeText(request.problem),
    target_audience: sanitizeText(request.target_audience),
    benefits: request.benefits.map(sanitizeText),
    constraints: request.constraints.map(sanitizeText),
    hypotheses: [...request.hypotheses]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(hypothesis => ({...hypothesis, statement: sanitizeText(hypothesis.statement), status: 'unverified' as const})),
    verified_facts: [],
    evidence_assessment: 'client_declared_not_verified',
    information_gaps: [
      ...(request.hypotheses.length === 0 ? ['Define the key hypotheses to evaluate'] : []),
      ...(request.constraints.length === 0 ? ['Confirm constraints and non-goals'] : []),
    ],
    assumptions: ['No market, cost, customer or external validation was inferred'],
  };
  const risks = [{
    id: 'client-provided-context',
    level: 'moderate' as const,
    summary: 'The idea is structured from client-provided material that has not been independently verified',
    mitigation: 'Validate facts, hypotheses and decisions in the authorized client before implementation',
  }];
  const data: IdeaData<IdeaProposal> = {
    capability_id: 'idea',
    capability_version: request.capability_version,
    project_id: request.project_id,
    workflow_state: 'planned',
    proposal_or_findings: proposal,
    risks,
    decisions_pending: ['Confirm the problem, audience, constraints and acceptance criteria with the client'],
    execution_location: 'client',
  };
  return envelope(requestId, 'ok', data, {
    evidence_refs: evidenceRefs(request),
    next_actions: ['Review the structured idea with the client', 'Define the next approved planning step'],
  });
}
