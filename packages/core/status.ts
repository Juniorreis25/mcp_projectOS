import { envelope, type Envelope, type Risk, type WorkflowState } from './contracts.js';

export const STATUS_CONTRACT_VERSION = '1.0.0' as const;
export const STATUS_MAX_TEXT_LENGTH = 20_000;
export const STATUS_MAX_LIST_ITEMS = 100;
export const STATUS_MAX_VALIDATION_WARNINGS = 20;
export const STATUS_MAX_WARNING_LENGTH = 160;

export type StatusMilestoneState = 'completed' | 'in_progress' | 'blocked' | 'not_started' | 'unknown';
export type StatusRiskLevel = 'low' | 'moderate' | 'critical';
export type StatusReadiness = 'informational' | 'needs_reconciliation' | 'insufficient_evidence';

export interface StatusEvidence {
  ref: string;
  summary: string;
}

export interface StatusMilestone {
  id: string;
  title: string;
  state: StatusMilestoneState;
  evidence_refs: string[];
}

export interface StatusRiskInput {
  id: string;
  level: StatusRiskLevel;
  summary: string;
  evidence_refs: string[];
}

export interface StatusRequest {
  capability_id: 'status';
  capability_version: string;
  project_id: string;
  objective?: string;
  scope?: string[];
  milestones: StatusMilestone[];
  evidence: StatusEvidence[];
  risks: StatusRiskInput[];
  blockers: string[];
  dependencies: string[];
  decisions_pending: string[];
  snapshot_ref?: string;
  snapshot_at?: string;
  snapshot_version?: string;
  requested_operations?: string[];
  approvals?: string[];
}

export interface StatusMilestoneAssessment extends StatusMilestone {
  declared: true;
  evidence_sufficient: boolean;
  observation: string;
}

export interface StatusAssessment {
  summary: string;
  readiness: StatusReadiness;
  milestone_assessments: StatusMilestoneAssessment[];
  counts: {
    total: number;
    completed: number;
    completed_with_evidence: number;
    in_progress: number;
    blocked: number;
    not_started: number;
    unknown: number;
    declared_progress_percent?: number;
    verifiable_progress_percent?: number;
  };
  risks: StatusRiskInput[];
  blockers: string[];
  dependencies: string[];
  decisions_pending: string[];
  evidence_gaps: string[];
  client_next_steps: string[];
  snapshot: {
    ref?: string;
    at?: string;
    version?: string;
  };
  limitations: string[];
}

export interface StatusData {
  capability_id: 'status';
  capability_version: string;
  project_id: string;
  workflow_state: Extract<WorkflowState, 'planned' | 'blocked'>;
  proposal_or_findings: StatusAssessment;
  risks: Array<{id: string; level: Risk; summary: string; mitigation: string}>;
  decisions_pending: string[];
  execution_location: 'client';
}

export type StatusEnvelope = Envelope<StatusData | null>;

interface ValidationIssue {
  path: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_FIELD';
}

interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

const supportedVersions = new Set<string>([STATUS_CONTRACT_VERSION]);
const milestoneStates = new Set<StatusMilestoneState>(['completed', 'in_progress', 'blocked', 'not_started', 'unknown']);
const riskLevels = new Set<StatusRiskLevel>(['low', 'moderate', 'critical']);
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const projectPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const semverPattern = /^\d+\.\d+\.\d+$/;
const secretPatterns: readonly RegExp[] = [
  /authorization\s*:\s*bearer\s+[^\s,;]+/gi,
  /\b(?:bearer|password|passwd|secret|token|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_\/-]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/gi,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /ignore\s+all\s+previous\s+instructions[^.\n]*/gi,
];
const contradictionPattern = /\b(?:contradict(?:s|ory|ion)?|conflict(?:s|ing)?|inconsistent|incompat(?:ible|ibility))\b|contradi[cç][aã]o|incompat[ií]vel|conflitante/i;
const safeIssuePathPatterns: readonly RegExp[] = [
  /^(?:capability_id|capability_version|project_id|objective|scope|milestones|evidence|risks|blockers|dependencies|decisions_pending|snapshot_ref|snapshot_at|snapshot_version|requested_operations|approvals)$/,
  /^(?:scope|blockers|dependencies|decisions_pending|requested_operations|approvals)\[\d{1,3}\]$/,
  /^milestones\[\d{1,3}\]\.(?:id|title|state|evidence_refs)$/,
  /^milestones\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
  /^evidence\[\d{1,3}\]\.(?:ref|summary)$/,
  /^risks\[\d{1,3}\]\.(?:id|level|summary|evidence_refs)$/,
  /^risks\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[], path = ''): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: path ? `${path}.${key}` : key, code: 'UNKNOWN_FIELD'});
  }
}

function containsSecret(value: string): boolean {
  return secretPatterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function sanitizeText(value: string): string {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value).slice(0, STATUS_MAX_TEXT_LENGTH);
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].map(sanitizeText).sort((left, right) => left.localeCompare(right));
}

function readText(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push({path, code: 'INVALID_TYPE'});
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    issues.push({path, code: required ? 'MISSING_REQUIRED' : 'INVALID_VALUE'});
    return undefined;
  }
  if (trimmed.length > STATUS_MAX_TEXT_LENGTH) issues.push({path, code: 'INVALID_VALUE'});
  return trimmed;
}

function readIdentifier(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const identifier = readText(value, path, true, issues);
  if (identifier && (!identifierPattern.test(identifier) || containsSecret(identifier))) issues.push({path, code: 'INVALID_VALUE'});
  return identifier;
}

function readReference(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const reference = readText(value, path, true, issues);
  if (reference && (!referencePattern.test(reference) || containsSecret(reference))) issues.push({path, code: 'INVALID_VALUE'});
  return reference;
}

function readProjectId(value: unknown, issues: ValidationIssue[]): string | undefined {
  const projectId = readText(value, 'project_id', true, issues);
  if (projectId && (!projectPattern.test(projectId) || containsSecret(projectId))) issues.push({path: 'project_id', code: 'INVALID_VALUE'});
  return projectId;
}

function readStringList(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > STATUS_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  value.forEach((item, index) => {
    const text = readText(item, `${path}[${index}]`, true, issues);
    if (text) result.push(text);
  });
  return result;
}

function readReferenceList(value: unknown, path: string, evidenceRefs: Set<string>, issues: ValidationIssue[]): string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path, code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > STATUS_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const ref = readReference(item, `${path}[${index}]`, issues);
    if (!ref) return;
    if (seen.has(ref) || !evidenceRefs.has(ref)) issues.push({path: `${path}[${index}]`, code: 'INVALID_VALUE'});
    seen.add(ref);
    result.push(ref);
  });
  return result;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): StatusEvidence[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > STATUS_MAX_LIST_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE'});
  const result: StatusEvidence[] = [];
  const refs = new Set<string>();
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary'], issues, path);
    const ref = readReference(item.ref, `${path}.ref`, issues);
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    if (ref && refs.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE'});
    if (ref) refs.add(ref);
    if (ref && summary) result.push({ref, summary});
  });
  return result;
}

function readMilestones(value: unknown, evidenceRefs: Set<string>, issues: ValidationIssue[]): StatusMilestone[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'milestones', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > STATUS_MAX_LIST_ITEMS) issues.push({path: 'milestones', code: 'INVALID_VALUE'});
  const result: StatusMilestone[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `milestones[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'title', 'state', 'evidence_refs'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const title = readText(item.title, `${path}.title`, true, issues);
    const state = readText(item.state, `${path}.state`, true, issues) as StatusMilestoneState | undefined;
    if (state && !milestoneStates.has(state)) issues.push({path: `${path}.state`, code: 'INVALID_VALUE'});
    const refs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, evidenceRefs, issues) ?? [];
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    const hasIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && title && state && milestoneStates.has(state) && !hasIssue) result.push({id, title, state, evidence_refs: refs});
  });
  return result;
}

function readRisks(value: unknown, evidenceRefs: Set<string>, issues: ValidationIssue[]): StatusRiskInput[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'risks', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > STATUS_MAX_LIST_ITEMS) issues.push({path: 'risks', code: 'INVALID_VALUE'});
  const result: StatusRiskInput[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `risks[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'level', 'summary', 'evidence_refs'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const level = readText(item.level, `${path}.level`, true, issues) as StatusRiskLevel | undefined;
    if (level && !riskLevels.has(level)) issues.push({path: `${path}.level`, code: 'INVALID_VALUE'});
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    const refs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, evidenceRefs, issues) ?? [];
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    const hasIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && level && riskLevels.has(level) && summary && !hasIssue) result.push({id, level, summary, evidence_refs: refs});
  });
  return result;
}

function readRequest(input: Record<string, unknown>, issues: ValidationIssue[]): StatusRequest {
  const capabilityId = readText(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readText(input.capability_version, 'capability_version', true, issues);
  const projectId = readProjectId(input.project_id, issues);
  const objective = input.objective === undefined ? undefined : readText(input.objective, 'objective', false, issues);
  const scope = input.scope === undefined ? undefined : readStringList(input.scope, 'scope', false, issues);
  const evidence = readEvidence(input.evidence, issues) ?? [];
  const evidenceRefs = new Set(evidence.map(item => item.ref));
  const milestones = readMilestones(input.milestones, evidenceRefs, issues) ?? [];
  const risks = readRisks(input.risks, evidenceRefs, issues) ?? [];
  const blockers = readStringList(input.blockers, 'blockers', true, issues) ?? [];
  const dependencies = readStringList(input.dependencies, 'dependencies', true, issues) ?? [];
  const decisionsPending = readStringList(input.decisions_pending, 'decisions_pending', true, issues) ?? [];
  const snapshotRef = input.snapshot_ref === undefined ? undefined : readReference(input.snapshot_ref, 'snapshot_ref', issues);
  const snapshotAt = input.snapshot_at === undefined ? undefined : readText(input.snapshot_at, 'snapshot_at', false, issues);
  const snapshotVersion = input.snapshot_version === undefined ? undefined : readText(input.snapshot_version, 'snapshot_version', false, issues);
  const requestedOperations = input.requested_operations === undefined ? undefined : readStringList(input.requested_operations, 'requested_operations', false, issues);
  const approvals = input.approvals === undefined ? undefined : readStringList(input.approvals, 'approvals', false, issues);

  if (capabilityId && capabilityId !== 'status') issues.push({path: 'capability_id', code: 'INVALID_VALUE'});
  if (capabilityVersion && !semverPattern.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE'});
  else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION'});
  if (objective === undefined && (scope === undefined || scope.length === 0)) issues.push({path: 'objective', code: 'MISSING_REQUIRED'});

  return {
    capability_id: 'status',
    capability_version: capabilityVersion ?? STATUS_CONTRACT_VERSION,
    project_id: projectId ?? '',
    ...(objective ? {objective} : {}),
    ...(scope ? {scope} : {}),
    milestones,
    evidence,
    risks,
    blockers,
    dependencies,
    decisions_pending: decisionsPending,
    ...(snapshotRef ? {snapshot_ref: snapshotRef} : {}),
    ...(snapshotAt ? {snapshot_at: snapshotAt} : {}),
    ...(snapshotVersion ? {snapshot_version: snapshotVersion} : {}),
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateStatusRequest(input: unknown): ValidationResult<StatusRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'objective', 'scope', 'milestones', 'evidence', 'risks', 'blockers', 'dependencies', 'decisions_pending', 'snapshot_ref', 'snapshot_at', 'snapshot_version', 'requested_operations', 'approvals'], issues);
  const value = readRequest(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

function validationStatus(issues: ValidationIssue[]): Extract<StatusEnvelope['status'], 'needs_input' | 'error'> {
  return issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code)) ? 'error' : 'needs_input';
}

function safeIssuePath(path: string): string {
  return path.length <= STATUS_MAX_WARNING_LENGTH && safeIssuePathPatterns.some(pattern => pattern.test(path)) ? path : 'request';
}

function warningsForValidation(issues: ValidationIssue[]): string[] {
  const messages: Record<ValidationIssue['code'], string> = {
    INVALID_TYPE: 'Input type is invalid',
    MISSING_REQUIRED: 'Required input is missing',
    INVALID_VALUE: 'Input value is invalid',
    UNSUPPORTED_VERSION: 'Contract version is unsupported',
    UNKNOWN_FIELD: 'Input contains an unknown field',
  };
  const warnings = issues.slice(0, STATUS_MAX_VALIDATION_WARNINGS).map(issue => `${safeIssuePath(issue.path)}: ${messages[issue.code]}`);
  if (issues.length > STATUS_MAX_VALIDATION_WARNINGS) warnings.push('request: Additional validation issues omitted');
  return warnings.map(warning => warning.slice(0, STATUS_MAX_WARNING_LENGTH));
}

function evidenceRefs(request: StatusRequest): string[] {
  return [...new Set(request.evidence.map(item => item.ref))].sort((left, right) => left.localeCompare(right));
}

function assessmentFor(request: StatusRequest): {assessment: StatusAssessment; riskEntries: StatusData['risks']; needsInput: boolean} {
  const milestones = [...request.milestones].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEvidence = [...request.evidence].sort((left, right) => left.ref.localeCompare(right.ref));
  const contradictoryEvidence = sortedEvidence.some(item => contradictionPattern.test(item.summary));
  const completed = milestones.filter(item => item.state === 'completed');
  const completedWithEvidence = completed.filter(item => item.evidence_refs.length > 0);
  const counts = {
    total: milestones.length,
    completed: completed.length,
    completed_with_evidence: completedWithEvidence.length,
    in_progress: milestones.filter(item => item.state === 'in_progress').length,
    blocked: milestones.filter(item => item.state === 'blocked').length,
    not_started: milestones.filter(item => item.state === 'not_started').length,
    unknown: milestones.filter(item => item.state === 'unknown').length,
    ...(milestones.length > 0 ? {
      declared_progress_percent: Math.round((completed.length / milestones.length) * 100),
      verifiable_progress_percent: Math.round((completedWithEvidence.length / milestones.length) * 100),
    } : {}),
  };
  const evidenceGaps: string[] = [];
  for (const milestone of milestones) {
    if (milestone.state === 'completed' && milestone.evidence_refs.length === 0) evidenceGaps.push(`Milestone ${milestone.id} is declared completed without evidence`);
    if (milestone.state === 'unknown') evidenceGaps.push(`Milestone ${milestone.id} has an unknown state`);
  }
  if (request.evidence.length === 0) evidenceGaps.push('No client-provided evidence was supplied');
  if (contradictoryEvidence) evidenceGaps.push('Client-provided evidence contains a possible contradiction requiring reconciliation');
  if (request.milestones.length === 0) evidenceGaps.push('No milestones or deliverables were supplied');

  const criticalRisk = request.risks.some(risk => risk.level === 'critical');
  const materialBlockers = request.blockers.length > 0 || request.dependencies.length > 0 || request.decisions_pending.length > 0;
  const needsInput = criticalRisk || materialBlockers || evidenceGaps.length > 0;
  const readiness: StatusReadiness = criticalRisk || request.blockers.length > 0 ? 'needs_reconciliation' : needsInput ? 'insufficient_evidence' : 'informational';
  const sanitizedRisks = [...request.risks].sort((left, right) => left.id.localeCompare(right.id)).map(risk => ({...risk, summary: sanitizeText(risk.summary), evidence_refs: [...risk.evidence_refs].sort()}));
  const riskEntries = sanitizedRisks.map(risk => ({
    id: risk.id,
    level: risk.level,
    summary: risk.level === 'critical' ? 'A client-declared critical risk requires reconciliation' : 'A client-declared risk requires client review',
    mitigation: 'Review this client-provided risk and its evidence before making a project decision',
  }));
  if (request.blockers.length > 0) riskEntries.push({id: 'status-material-blocker', level: 'critical', summary: 'Client-declared blockers prevent an optimistic status assessment', mitigation: 'Resolve blockers in the authorized client'});
  const milestoneAssessments = milestones.map(milestone => ({
    ...milestone,
    title: sanitizeText(milestone.title),
    evidence_refs: [...milestone.evidence_refs].sort(),
    declared: true as const,
    evidence_sufficient: milestone.state !== 'completed' || milestone.evidence_refs.length > 0,
    observation: milestone.state === 'completed' && milestone.evidence_refs.length > 0
      ? 'Completion was declared and has client-provided evidence references; it was not independently verified'
      : milestone.state === 'completed'
        ? 'Completion was declared without evidence and requires client confirmation'
        : `State was declared as ${milestone.state} by the client`,
  }));
  const limitations = [
    'This assessment analyzes only the client-provided snapshot and is not independent verification',
    'Progress percentages refer only to the supplied milestones and do not measure effort or real-world completion',
    'The Core does not compare this snapshot with a current external state or persist it between sessions',
  ];
  const clientNextSteps = [
    'Review the consolidated status and evidence in the authorized client',
    ...(evidenceGaps.length > 0 ? ['Provide or reconcile the missing and contradictory evidence'] : []),
    ...(request.blockers.length > 0 ? ['Resolve the declared blockers before treating the project as ready'] : []),
    ...(request.decisions_pending.length > 0 ? ['Resolve pending decisions with the responsible client authority'] : []),
  ];
  const summary = needsInput
    ? 'The client-provided snapshot contains gaps, blockers, risks or pending decisions that require review'
    : 'The client-provided snapshot was consolidated for informational review; it is not an independent certification';
  return {
    assessment: {
      summary,
      readiness,
      milestone_assessments: milestoneAssessments,
      counts,
      risks: sanitizedRisks,
      blockers: sortStrings(request.blockers),
      dependencies: sortStrings(request.dependencies),
      decisions_pending: sortStrings(request.decisions_pending),
      evidence_gaps: evidenceGaps.map(sanitizeText).sort((left, right) => left.localeCompare(right)),
      client_next_steps: [...new Set(clientNextSteps)].sort((left, right) => left.localeCompare(right)),
      snapshot: {
        ...(request.snapshot_ref ? {ref: request.snapshot_ref} : {}),
        ...(request.snapshot_at ? {at: sanitizeText(request.snapshot_at)} : {}),
        ...(request.snapshot_version ? {version: sanitizeText(request.snapshot_version)} : {}),
      },
      limitations,
    },
    riskEntries,
    needsInput,
  };
}

function blockedResponse(requestId: string, request: StatusRequest): StatusEnvelope {
  return envelope(requestId, 'blocked', null, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:status-execution-approval'],
    warnings: ['Requested operations are outside the read-only status capability'],
    next_actions: ['Keep the request blocked', 'Use the authorized client to evaluate any execution request under its own policy'],
  });
}

export function prepareStatus(requestId: string, input: unknown): StatusEnvelope {
  const validation = validateStatusRequest(input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: warningsForValidation(validation.issues),
      next_actions: [status === 'needs_input' ? 'Provide the missing project snapshot inputs and evidence' : 'Correct the invalid status request'],
    });
  }
  const request = validation.value;
  if ((request.requested_operations ?? []).length > 0) return blockedResponse(requestId, request);
  const {assessment, riskEntries, needsInput} = assessmentFor(request);
  const data: StatusData = {
    capability_id: 'status',
    capability_version: request.capability_version,
    project_id: request.project_id,
    workflow_state: 'planned',
    proposal_or_findings: assessment,
    risks: riskEntries,
    decisions_pending: sortStrings(request.decisions_pending),
    execution_location: 'client',
  };
  return envelope(requestId, needsInput ? 'needs_input' : 'ok', data, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:status-review'],
    warnings: ['Client-provided snapshot values and states are declarations, not independent verification'],
    next_actions: assessment.client_next_steps,
  });
}
