import { envelope, type Envelope, type Risk } from './contracts.js';

export const AUDIT_CONTRACT_VERSION = '1.0.0' as const;
export const AUDIT_MAX_TEXT_LENGTH = 20_000;
export const AUDIT_MAX_LIST_ITEMS = 100;
export const AUDIT_MAX_VALIDATION_WARNINGS = 20;
export const AUDIT_MAX_WARNING_LENGTH = 160;

export type AuditSeverity = 'low' | 'moderate' | 'critical';
export type AuditControlCriticality = AuditSeverity;
export type AuditAssessmentStatus = 'declared_compliant' | 'declared_noncompliant' | 'uncertain' | 'not_assessed';
export type AuditFindingKind = 'evidence_gap' | 'noncompliance' | 'contradiction' | 'governance_gap';

export interface AuditControl {
  id: string;
  description: string;
  criticality: AuditControlCriticality;
  criteria: string[];
}

export interface AuditAssessment {
  id: string;
  control_id: string;
  status: AuditAssessmentStatus;
  justification: string;
  evidence_refs: string[];
}

export interface AuditEvidence {
  ref: string;
  summary: string;
  origin: string;
}

export interface AuditEvent {
  id: string;
  summary: string;
  evidence_refs: string[];
}

export interface AuditRequest {
  capability_id: 'audit';
  capability_version: string;
  project_id: string;
  audit_scope: string[];
  controls: AuditControl[];
  assessments: AuditAssessment[];
  evidence: AuditEvidence[];
  events?: AuditEvent[];
  approvals_pending: string[];
  decisions_pending: string[];
  snapshot_ref?: string;
  snapshot_at?: string;
  snapshot_version?: string;
  requested_operations?: string[];
  approvals?: string[];
}

export interface AuditControlAssessment {
  control_id: string;
  assessment_id?: string;
  criticality: AuditControlCriticality;
  status: AuditAssessmentStatus;
  evidence_refs: string[];
  observation: string;
}

export interface AuditFinding {
  id: string;
  kind: AuditFindingKind;
  severity: AuditSeverity;
  control_id?: string;
  assessment_id?: string;
  evidence_refs: string[];
  summary: string;
}

export interface AuditReport {
  audit_scope: string[];
  controls: AuditControlAssessment[];
  counts: {
    total: number;
    declared_compliant: number;
    declared_noncompliant: number;
    uncertain: number;
    not_assessed: number;
  };
  findings: AuditFinding[];
  evidence_gaps: string[];
  approvals_pending: string[];
  decisions_pending: string[];
  recommendations: string[];
  limitations: string[];
}

export interface AuditData {
  capability_id: 'audit';
  capability_version: string;
  project_id: string;
  workflow_state: 'planned' | 'blocked';
  proposal_or_findings: AuditReport;
  risks: Array<{id: string; level: Risk; summary: string; mitigation: string}>;
  decisions_pending: string[];
  execution_location: 'client';
}

export type AuditEnvelope = Envelope<AuditData | null>;

interface ValidationIssue {
  path: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_FIELD';
}

interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

const supportedVersions = new Set<string>([AUDIT_CONTRACT_VERSION]);
const severitySet = new Set<AuditSeverity>(['low', 'moderate', 'critical']);
const assessmentStatusSet = new Set<AuditAssessmentStatus>(['declared_compliant', 'declared_noncompliant', 'uncertain', 'not_assessed']);
const findingKindSet = new Set<AuditFindingKind>(['evidence_gap', 'noncompliance', 'contradiction', 'governance_gap']);
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
  /^(?:capability_id|capability_version|project_id|audit_scope|controls|assessments|evidence|events|approvals_pending|decisions_pending|snapshot_ref|snapshot_at|snapshot_version|requested_operations|approvals)$/,
  /^(?:audit_scope|approvals_pending|decisions_pending|requested_operations|approvals)\[\d{1,3}\]$/,
  /^controls\[\d{1,3}\]\.(?:id|description|criticality|criteria)$/,
  /^controls\[\d{1,3}\]\.criteria\[\d{1,3}\]$/,
  /^assessments\[\d{1,3}\]\.(?:id|control_id|status|justification|evidence_refs)$/,
  /^assessments\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
  /^evidence\[\d{1,3}\]\.(?:ref|summary|origin)$/,
  /^events\[\d{1,3}\]\.(?:id|summary|evidence_refs)$/,
  /^events\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
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
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value).slice(0, AUDIT_MAX_TEXT_LENGTH);
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
  if (trimmed.length > AUDIT_MAX_TEXT_LENGTH) issues.push({path, code: 'INVALID_VALUE'});
  return trimmed;
}

function readIdentifier(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const identifier = readText(value, path, true, issues);
  if (identifier && (!identifierPattern.test(identifier) || containsSecret(identifier))) issues.push({path, code: 'INVALID_VALUE'});
  return identifier;
}

function readProjectId(value: unknown, issues: ValidationIssue[]): string | undefined {
  const projectId = readText(value, 'project_id', true, issues);
  if (projectId && (!projectPattern.test(projectId) || containsSecret(projectId))) issues.push({path: 'project_id', code: 'INVALID_VALUE'});
  return projectId;
}

function readReference(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const reference = readText(value, path, true, issues);
  if (reference && (!referencePattern.test(reference) || containsSecret(reference))) issues.push({path, code: 'INVALID_VALUE'});
  return reference;
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
  if (value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  value.forEach((item, index) => {
    const text = readText(item, `${path}[${index}]`, true, issues);
    if (text) result.push(text);
  });
  if (required && result.length === 0) issues.push({path, code: 'MISSING_REQUIRED'});
  return result;
}

function readReferenceList(value: unknown, path: string, knownRefs: Set<string>, issues: ValidationIssue[], required = true): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const ref = readReference(item, `${path}[${index}]`, issues);
    if (!ref) return;
    if (seen.has(ref) || !knownRefs.has(ref)) issues.push({path: `${path}[${index}]`, code: 'INVALID_VALUE'});
    seen.add(ref);
    result.push(ref);
  });
  return result;
}

function readControls(value: unknown, issues: ValidationIssue[]): AuditControl[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'controls', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length === 0 || value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path: 'controls', code: value.length === 0 ? 'MISSING_REQUIRED' : 'INVALID_VALUE'});
  const result: AuditControl[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `controls[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'description', 'criticality', 'criteria'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const description = readText(item.description, `${path}.description`, true, issues);
    const criticality = readText(item.criticality, `${path}.criticality`, true, issues) as AuditControlCriticality | undefined;
    const criteria = readStringList(item.criteria, `${path}.criteria`, true, issues);
    if (criticality && !severitySet.has(criticality)) issues.push({path: `${path}.criticality`, code: 'INVALID_VALUE'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    const hasIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && description && criticality && severitySet.has(criticality) && criteria && criteria.length > 0 && !hasIssue) result.push({id, description, criticality, criteria});
  });
  return result;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): AuditEvidence[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE'});
  const result: AuditEvidence[] = [];
  const refs = new Set<string>();
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary', 'origin'], issues, path);
    const ref = readReference(item.ref, `${path}.ref`, issues);
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    const origin = readText(item.origin, `${path}.origin`, true, issues);
    if (ref && refs.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE'});
    if (ref) refs.add(ref);
    if (ref && summary && origin) result.push({ref, summary, origin});
  });
  return result;
}

function readAssessments(value: unknown, knownControls: Set<string>, knownRefs: Set<string>, issues: ValidationIssue[]): AuditAssessment[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'assessments', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path: 'assessments', code: 'INVALID_VALUE'});
  const result: AuditAssessment[] = [];
  const ids = new Set<string>();
  const controlIds = new Set<string>();
  value.forEach((item, index) => {
    const path = `assessments[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'control_id', 'status', 'justification', 'evidence_refs'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const controlId = readIdentifier(item.control_id, `${path}.control_id`, issues);
    const status = readText(item.status, `${path}.status`, true, issues) as AuditAssessmentStatus | undefined;
    const justification = readText(item.justification, `${path}.justification`, true, issues);
    const evidenceRefs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, knownRefs, issues) ?? [];
    if (status && !assessmentStatusSet.has(status)) issues.push({path: `${path}.status`, code: 'INVALID_VALUE'});
    if (controlId && !knownControls.has(controlId)) issues.push({path: `${path}.control_id`, code: 'INVALID_VALUE'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (controlId && controlIds.has(controlId)) issues.push({path: `${path}.control_id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    if (controlId) controlIds.add(controlId);
    const hasIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && controlId && status && assessmentStatusSet.has(status) && justification && !hasIssue) result.push({id, control_id: controlId, status, justification, evidence_refs: evidenceRefs});
  });
  return result;
}

function readEvents(value: unknown, knownRefs: Set<string>, issues: ValidationIssue[]): AuditEvent[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'events', code: 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > AUDIT_MAX_LIST_ITEMS) issues.push({path: 'events', code: 'INVALID_VALUE'});
  const result: AuditEvent[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `events[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'summary', 'evidence_refs'], issues, path);
    const id = readIdentifier(item.id, `${path}.id`, issues);
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    const refs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, knownRefs, issues, false) ?? [];
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    const hasIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && summary && !hasIssue) result.push({id, summary, evidence_refs: refs});
  });
  return result;
}

function readRequest(input: Record<string, unknown>, issues: ValidationIssue[]): AuditRequest {
  const capabilityId = readText(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readText(input.capability_version, 'capability_version', true, issues);
  const projectId = readProjectId(input.project_id, issues);
  const auditScope = readStringList(input.audit_scope, 'audit_scope', true, issues) ?? [];
  const controls = readControls(input.controls, issues) ?? [];
  const evidence = readEvidence(input.evidence, issues) ?? [];
  const knownRefs = new Set(evidence.map(item => item.ref));
  const knownControls = new Set(controls.map(item => item.id));
  const assessments = readAssessments(input.assessments, knownControls, knownRefs, issues) ?? [];
  const events = readEvents(input.events, knownRefs, issues);
  const approvalsPending = input.approvals_pending === undefined
    ? (issues.push({path: 'approvals_pending', code: 'MISSING_REQUIRED'}), [])
    : readStringList(input.approvals_pending, 'approvals_pending', false, issues) ?? [];
  const decisionsPending = input.decisions_pending === undefined
    ? (issues.push({path: 'decisions_pending', code: 'MISSING_REQUIRED'}), [])
    : readStringList(input.decisions_pending, 'decisions_pending', false, issues) ?? [];
  const snapshotRef = input.snapshot_ref === undefined ? undefined : readReference(input.snapshot_ref, 'snapshot_ref', issues);
  const snapshotAt = input.snapshot_at === undefined ? undefined : readText(input.snapshot_at, 'snapshot_at', false, issues);
  const snapshotVersion = input.snapshot_version === undefined ? undefined : readText(input.snapshot_version, 'snapshot_version', false, issues);
  const requestedOperations = input.requested_operations === undefined ? undefined : readStringList(input.requested_operations, 'requested_operations', false, issues);
  const approvals = input.approvals === undefined ? undefined : readStringList(input.approvals, 'approvals', false, issues);
  if (capabilityId && capabilityId !== 'audit') issues.push({path: 'capability_id', code: 'INVALID_VALUE'});
  if (capabilityVersion && !semverPattern.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE'});
  else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION'});
  return {
    capability_id: 'audit',
    capability_version: capabilityVersion ?? AUDIT_CONTRACT_VERSION,
    project_id: projectId ?? '',
    audit_scope: auditScope,
    controls,
    assessments,
    evidence,
    ...(events ? {events} : {}),
    approvals_pending: approvalsPending,
    decisions_pending: decisionsPending,
    ...(snapshotRef ? {snapshot_ref: snapshotRef} : {}),
    ...(snapshotAt ? {snapshot_at: snapshotAt} : {}),
    ...(snapshotVersion ? {snapshot_version: snapshotVersion} : {}),
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateAuditRequest(input: unknown): ValidationResult<AuditRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'audit_scope', 'controls', 'assessments', 'evidence', 'events', 'approvals_pending', 'decisions_pending', 'snapshot_ref', 'snapshot_at', 'snapshot_version', 'requested_operations', 'approvals'], issues);
  const value = readRequest(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

function validationStatus(issues: ValidationIssue[]): Extract<AuditEnvelope['status'], 'needs_input' | 'error'> {
  return issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code)) ? 'error' : 'needs_input';
}

function safeIssuePath(path: string): string {
  return path.length <= AUDIT_MAX_WARNING_LENGTH && safeIssuePathPatterns.some(pattern => pattern.test(path)) ? path : 'request';
}

function warningsForValidation(issues: ValidationIssue[]): string[] {
  const messages: Record<ValidationIssue['code'], string> = {
    INVALID_TYPE: 'Input type is invalid',
    MISSING_REQUIRED: 'Required input is missing',
    INVALID_VALUE: 'Input value is invalid',
    UNSUPPORTED_VERSION: 'Contract version is unsupported',
    UNKNOWN_FIELD: 'Input contains an unknown field',
  };
  const warnings = issues.slice(0, AUDIT_MAX_VALIDATION_WARNINGS).map(issue => `${safeIssuePath(issue.path)}: ${messages[issue.code]}`);
  if (issues.length > AUDIT_MAX_VALIDATION_WARNINGS) warnings.push('request: Additional validation issues omitted');
  return warnings.map(warning => warning.slice(0, AUDIT_MAX_WARNING_LENGTH));
}

function evidenceRefs(request: AuditRequest): string[] {
  return request.evidence.map(item => item.ref).sort((left, right) => left.localeCompare(right));
}

function findingId(kind: AuditFindingKind, controlId: string, suffix = ''): string {
  return `audit-${kind}-${controlId}${suffix ? `-${suffix}` : ''}`;
}

function buildAudit(request: AuditRequest): {report: AuditReport; risks: AuditData['risks']; needsInput: boolean} {
  const controls = [...request.controls].sort((left, right) => left.id.localeCompare(right.id));
  const assessments = [...request.assessments].sort((left, right) => left.control_id.localeCompare(right.control_id));
  const evidenceByRef = new Map(request.evidence.map(item => [item.ref, item]));
  const assessmentByControl = new Map(assessments.map(item => [item.control_id, item]));
  const findings: AuditFinding[] = [];
  const controlRows: AuditControlAssessment[] = [];
  const evidenceGaps: string[] = [];

  for (const control of controls) {
    const assessment = assessmentByControl.get(control.id);
    if (!assessment) {
      controlRows.push({control_id: control.id, criticality: control.criticality, status: 'not_assessed', evidence_refs: [], observation: 'No client assessment was supplied for this control'});
      findings.push({id: findingId('evidence_gap', control.id, 'not-assessed'), kind: 'evidence_gap', severity: control.criticality === 'critical' ? 'critical' : 'moderate', control_id: control.id, evidence_refs: [], summary: 'The control has no client-provided assessment'});
      evidenceGaps.push(`Control ${control.id} has no assessment`);
      continue;
    }
    const linkedEvidence = assessment.evidence_refs.filter(ref => evidenceByRef.has(ref));
    const observation = assessment.status === 'declared_compliant'
      ? linkedEvidence.length > 0 ? 'Compliance was declared with client-provided evidence; it was not independently verified' : 'Compliance was declared without sufficient evidence'
      : assessment.status === 'declared_noncompliant'
        ? 'Non-compliance was declared by the client and requires reconciliation'
        : assessment.status === 'uncertain'
          ? 'The client assessment is uncertain and requires reconciliation'
          : 'The control was declared not assessed';
    controlRows.push({control_id: control.id, assessment_id: assessment.id, criticality: control.criticality, status: assessment.status, evidence_refs: [...linkedEvidence].sort(), observation});
    if (assessment.status === 'declared_compliant' && linkedEvidence.length === 0) {
      findings.push({id: findingId('evidence_gap', control.id, 'compliance-without-evidence'), kind: 'evidence_gap', severity: control.criticality === 'critical' ? 'critical' : 'moderate', control_id: control.id, assessment_id: assessment.id, evidence_refs: [], summary: 'Declared compliance has no linked client evidence'});
      evidenceGaps.push(`Control ${control.id} lacks evidence for declared compliance`);
    }
    if (assessment.status === 'declared_noncompliant') {
      findings.push({id: findingId('noncompliance', control.id), kind: 'noncompliance', severity: control.criticality, control_id: control.id, assessment_id: assessment.id, evidence_refs: linkedEvidence.sort(), summary: 'The client declared this control non-compliant'});
      evidenceGaps.push(`Control ${control.id} requires reconciliation of declared non-compliance`);
    }
    if (assessment.status === 'uncertain' || assessment.status === 'not_assessed') {
      findings.push({id: findingId('evidence_gap', control.id, assessment.status), kind: 'evidence_gap', severity: control.criticality === 'critical' ? 'critical' : 'moderate', control_id: control.id, assessment_id: assessment.id, evidence_refs: linkedEvidence.sort(), summary: 'The control assessment is insufficient for a favorable conclusion'});
      evidenceGaps.push(`Control ${control.id} has insufficient assessment evidence`);
    }
  }

  const contradictoryEvidenceRefs = request.evidence.filter(item => contradictionPattern.test(item.summary)).map(item => item.ref);
  const contradictoryEventRefs = (request.events ?? []).filter(item => contradictionPattern.test(item.summary)).flatMap(item => item.evidence_refs);
  const contradictoryRefs = [...new Set([...contradictoryEvidenceRefs, ...contradictoryEventRefs])].sort((left, right) => left.localeCompare(right));
  if (contradictoryRefs.length > 0) {
    findings.push({id: 'audit-contradictory-evidence', kind: 'contradiction', severity: 'moderate', evidence_refs: contradictoryRefs, summary: 'Client-provided evidence contains a possible contradiction requiring reconciliation'});
    evidenceGaps.push('Client-provided evidence contains a possible contradiction');
  }
  if (request.approvals_pending.length > 0) {
    findings.push({id: 'audit-pending-approvals', kind: 'governance_gap', severity: 'moderate', evidence_refs: [], summary: 'Approvals remain pending in the client-provided audit context'});
    evidenceGaps.push('Approvals pending require client governance review');
  }
  if (request.decisions_pending.length > 0) {
    findings.push({id: 'audit-pending-decisions', kind: 'governance_gap', severity: 'moderate', evidence_refs: [], summary: 'Decisions remain pending in the client-provided audit context'});
    evidenceGaps.push('Decisions pending require client governance review');
  }

  const sortedFindings = findings.sort((left, right) => left.id.localeCompare(right.id)).map(finding => ({...finding, evidence_refs: [...finding.evidence_refs].sort()}));
  const counts = {
    total: controlRows.length,
    declared_compliant: controlRows.filter(row => row.status === 'declared_compliant').length,
    declared_noncompliant: controlRows.filter(row => row.status === 'declared_noncompliant').length,
    uncertain: controlRows.filter(row => row.status === 'uncertain').length,
    not_assessed: controlRows.filter(row => row.status === 'not_assessed').length,
  };
  const sanitizedEvidenceGaps = [...new Set(evidenceGaps.map(sanitizeText))].sort((left, right) => left.localeCompare(right));
  const report: AuditReport = {
    audit_scope: sortStrings(request.audit_scope),
    controls: controlRows,
    counts,
    findings: sortedFindings,
    evidence_gaps: sanitizedEvidenceGaps,
    approvals_pending: sortStrings(request.approvals_pending),
    decisions_pending: sortStrings(request.decisions_pending),
    recommendations: [
      'Review every finding and linked evidence in the authorized client',
      'Reconcile uncertain, non-compliant, contradictory and unassessed controls before relying on the audit',
      'Obtain separate human approval before any sensitive client-side operation',
    ],
    limitations: [
      'This audit evaluates only client-provided controls, assessments, evidence and events',
      'Client evidence and assessment statuses are declarations and are not independently verified',
      'Absence of findings is not certification of compliance, security, merge approval or release readiness',
      'The Core does not access external sources, filesystems, repositories or persistent storage',
      'Free-text sanitization covers known patterns and is not universal secret detection',
    ],
  };
  const risks: AuditData['risks'] = sortedFindings.map(finding => ({
    id: finding.id,
    level: finding.severity,
    summary: sanitizeText(finding.summary),
    mitigation: 'Review and reconcile this client-provided audit finding in the authorized client',
  }));
  return {report, risks, needsInput: sortedFindings.length > 0 || request.evidence.length === 0};
}

function blockedResponse(requestId: string, request: AuditRequest): AuditEnvelope {
  return envelope(requestId, 'blocked', null, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:audit-execution-approval'],
    warnings: ['Requested operations are outside the read-only audit capability'],
    next_actions: ['Keep the request blocked', 'Evaluate any execution request only in the authorized client under its own security policy'],
  });
}

export function prepareAudit(requestId: string, input: unknown): AuditEnvelope {
  const validation = validateAuditRequest(input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: warningsForValidation(validation.issues),
      next_actions: [status === 'needs_input' ? 'Provide the missing audit scope, controls, assessments and evidence' : 'Correct the invalid audit request'],
    });
  }
  const request = validation.value;
  if ((request.requested_operations ?? []).length > 0) return blockedResponse(requestId, request);
  const {report, risks, needsInput} = buildAudit(request);
  const data: AuditData = {
    capability_id: 'audit',
    capability_version: request.capability_version,
    project_id: request.project_id,
    workflow_state: 'planned',
    proposal_or_findings: report,
    risks,
    decisions_pending: sortStrings(request.decisions_pending),
    execution_location: 'client',
  };
  return envelope(requestId, needsInput ? 'needs_input' : 'ok', data, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:audit-review'],
    warnings: ['Client-provided controls, assessments and evidence are declarations, not independent verification'],
    next_actions: report.recommendations,
  });
}
