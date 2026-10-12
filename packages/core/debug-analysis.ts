import {envelope, type Risk, type WorkflowState} from './contracts.js';
import {
  F5_CONTRACT_VERSION,
  type CapabilityData,
  type CapabilityEnvelope,
  type CapabilityEvidence,
  type CapabilityRequest,
  type CapabilityRisk,
  type ValidationIssue,
  type ValidationResult,
  readString,
  readStringList,
  validateCapabilityRequest,
  validationStatus,
} from './f5-contracts.js';

export const DEBUG_CONTRACT_VERSION = F5_CONTRACT_VERSION;
export const DEBUG_MAX_ITEMS = 100;
export const DEBUG_MAX_TEXT_LENGTH = 20_000;

export type DebugUncertainty = 'low' | 'medium' | 'high';
export type DebugHypothesisStatus = 'unconfirmed';
export type DebugDiagnosisStatus = 'initial' | 'inconclusive' | 'contradictory';
export type DebugDiagnosticStepKind = 'reproduce' | 'isolate' | 'verify';

export interface DebugEvidence extends CapabilityEvidence {
  source: string;
  context: string;
}

export interface DebugSymptom {
  id: string;
  environment?: string;
  expected: string;
  observed: string;
  message?: string;
}

export interface DebugHypothesis {
  id: string;
  summary: string;
  supporting_evidence: string[];
  uncertainty: DebugUncertainty;
  impact: Risk;
  status: DebugHypothesisStatus;
}

export interface DebugDiagnosticStep {
  id: string;
  kind: DebugDiagnosticStepKind;
  action: string;
  expected_observation: string;
  execution_location: 'client';
  supporting_evidence?: string[];
}

export interface DebugEvidenceSource {
  ref: string;
  source: string;
}

export interface DebugAssessment {
  diagnosis_status: DebugDiagnosisStatus;
  symptoms: DebugSymptom[];
  evidence_sources: DebugEvidenceSource[];
  hypotheses: DebugHypothesis[];
  diagnostic_steps: DebugDiagnosticStep[];
  gaps: string[];
  correction_strategies: string[];
  limitations: string[];
}

export interface DebugRequest extends Omit<CapabilityRequest, 'evidence'> {
  capability_id: 'debug';
  evidence: DebugEvidence[];
  symptoms: DebugSymptom[];
  context?: string;
  hypotheses?: DebugHypothesis[];
  diagnostic_steps?: DebugDiagnosticStep[];
}

interface ParsedDebugBase {
  base: CapabilityRequest | null;
  evidence: DebugEvidence[];
}

const uncertaintySet = new Set<DebugUncertainty>(['low', 'medium', 'high']);
const impactSet = new Set<Risk>(['low', 'moderate', 'critical']);
const stepKindSet = new Set<DebugDiagnosticStepKind>(['reproduce', 'isolate', 'verify']);
const malformedCodes = new Set(['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: key, code: 'UNKNOWN_FIELD', message: `Unknown field: ${key}`});
  }
}

function readBoundedText(value: unknown, path: string, issues: ValidationIssue[], required = true): string | undefined {
  const text = readString(value, path, required, issues);
  if (text && text.length > DEBUG_MAX_TEXT_LENGTH) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} exceeds the maximum text length`});
  }
  return text;
}

function readOptionalText(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) return undefined;
  return readBoundedText(value, path, issues, false);
}

function readDebugEvidence(value: unknown, issues: ValidationIssue[]): DebugEvidence[] {
  if (value === undefined) {
    issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'evidence is required'});
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE', message: 'evidence must be an array'});
    return [];
  }
  if (value.length > DEBUG_MAX_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE', message: 'evidence contains too many items'});
  const refs = new Set<string>();
  const evidence: DebugEvidence[] = [];
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Evidence must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary', 'source', 'context'], issues);
    const ref = readBoundedText(item.ref, `${path}.ref`, issues);
    const summary = readBoundedText(item.summary, `${path}.summary`, issues);
    const source = readBoundedText(item.source, `${path}.source`, issues);
    const context = readBoundedText(item.context, `${path}.context`, issues);
    if (ref && refs.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE', message: 'Evidence refs must be unique'});
    if (ref) refs.add(ref);
    if (ref && summary && source && context) evidence.push({ref, summary, source, context});
  });
  if (evidence.length === 0) issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'At least one evidence item is required'});
  return evidence;
}

function readSymptoms(value: unknown, issues: ValidationIssue[]): DebugSymptom[] {
  if (value === undefined) {
    issues.push({path: 'symptoms', code: 'MISSING_REQUIRED', message: 'At least one observable symptom is required'});
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'symptoms', code: 'INVALID_TYPE', message: 'symptoms must be an array'});
    return [];
  }
  if (value.length > DEBUG_MAX_ITEMS) issues.push({path: 'symptoms', code: 'INVALID_VALUE', message: 'symptoms contains too many items'});
  const symptoms: DebugSymptom[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `symptoms[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Symptom must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'environment', 'expected', 'observed', 'message'], issues);
    const id = readBoundedText(item.id, `${path}.id`, issues);
    const environment = readOptionalText(item.environment, `${path}.environment`, issues);
    const expected = readBoundedText(item.expected, `${path}.expected`, issues);
    const observed = readBoundedText(item.observed, `${path}.observed`, issues);
    const message = readOptionalText(item.message, `${path}.message`, issues);
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Symptom ids must be unique'});
    if (id) ids.add(id);
    if (id && expected && observed) symptoms.push({id, ...(environment ? {environment} : {}), expected, observed, ...(message ? {message} : {})});
  });
  if (symptoms.length === 0) issues.push({path: 'symptoms', code: 'MISSING_REQUIRED', message: 'At least one complete observable symptom is required'});
  return symptoms;
}

function readHypotheses(value: unknown, issues: ValidationIssue[]): DebugHypothesis[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'hypotheses', code: 'INVALID_TYPE', message: 'hypotheses must be an array'});
    return [];
  }
  if (value.length > DEBUG_MAX_ITEMS) issues.push({path: 'hypotheses', code: 'INVALID_VALUE', message: 'hypotheses contains too many items'});
  const hypotheses: DebugHypothesis[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `hypotheses[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Hypothesis must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'summary', 'supporting_evidence', 'uncertainty', 'impact', 'status'], issues);
    const id = readBoundedText(item.id, `${path}.id`, issues);
    const summary = readBoundedText(item.summary, `${path}.summary`, issues);
    const supportingEvidence = readStringList(item.supporting_evidence, `${path}.supporting_evidence`, true, issues);
    const uncertainty = readBoundedText(item.uncertainty, `${path}.uncertainty`, issues) as DebugUncertainty | undefined;
    const impact = readBoundedText(item.impact, `${path}.impact`, issues) as Risk | undefined;
    const status = readBoundedText(item.status, `${path}.status`, issues);
    if (uncertainty && !uncertaintySet.has(uncertainty)) issues.push({path: `${path}.uncertainty`, code: 'INVALID_VALUE', message: 'Unsupported uncertainty level'});
    if (impact && !impactSet.has(impact)) issues.push({path: `${path}.impact`, code: 'INVALID_VALUE', message: 'Unsupported impact level'});
    if (status && status !== 'unconfirmed') issues.push({path: `${path}.status`, code: 'INVALID_VALUE', message: 'Hypotheses must remain unconfirmed'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Hypothesis ids must be unique'});
    if (id) ids.add(id);
    if (id && summary && supportingEvidence && uncertainty && impact && status === 'unconfirmed') {
      hypotheses.push({id, summary, supporting_evidence: supportingEvidence, uncertainty, impact, status});
    }
  });
  return hypotheses;
}

function readDiagnosticSteps(value: unknown, issues: ValidationIssue[]): DebugDiagnosticStep[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'diagnostic_steps', code: 'INVALID_TYPE', message: 'diagnostic_steps must be an array'});
    return [];
  }
  if (value.length > DEBUG_MAX_ITEMS) issues.push({path: 'diagnostic_steps', code: 'INVALID_VALUE', message: 'diagnostic_steps contains too many items'});
  const steps: DebugDiagnosticStep[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `diagnostic_steps[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Diagnostic step must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'kind', 'action', 'expected_observation', 'execution_location', 'supporting_evidence'], issues);
    const id = readBoundedText(item.id, `${path}.id`, issues);
    const kind = readBoundedText(item.kind, `${path}.kind`, issues) as DebugDiagnosticStepKind | undefined;
    const action = readBoundedText(item.action, `${path}.action`, issues);
    const expectedObservation = readBoundedText(item.expected_observation, `${path}.expected_observation`, issues);
    const location = readBoundedText(item.execution_location, `${path}.execution_location`, issues);
    const supportingEvidence = item.supporting_evidence === undefined ? undefined : readStringList(item.supporting_evidence, `${path}.supporting_evidence`, false, issues);
    if (kind && !stepKindSet.has(kind)) issues.push({path: `${path}.kind`, code: 'INVALID_VALUE', message: 'Unsupported diagnostic step kind'});
    if (location && location !== 'client') issues.push({path: `${path}.execution_location`, code: 'INVALID_VALUE', message: 'Diagnostic steps must execute at the client'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Diagnostic step ids must be unique'});
    if (id) ids.add(id);
    if (id && kind && action && expectedObservation && location === 'client') {
      steps.push({id, kind, action, expected_observation: expectedObservation, execution_location: 'client', ...(supportingEvidence && supportingEvidence.length > 0 ? {supporting_evidence: supportingEvidence} : {})});
    }
  });
  return steps;
}

function parseBase(input: Record<string, unknown>, issues: ValidationIssue[]): ParsedDebugBase {
  const rawEvidence = input.evidence;
  const normalizedEvidence = Array.isArray(rawEvidence)
    ? rawEvidence.map(item => isRecord(item) ? {ref: item.ref, summary: item.summary} : item)
    : rawEvidence;
  const baseInput = {...input, evidence: normalizedEvidence};
  const base = validateCapabilityRequest(baseInput, ['symptoms', 'context', 'hypotheses', 'diagnostic_steps']);
  issues.push(...base.issues);
  const evidence = readDebugEvidence(rawEvidence, issues);
  return {base: base.value, evidence};
}

export function validateDebugRequest(input: unknown): ValidationResult<DebugRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  const parsed = parseBase(input, issues);
  const symptoms = readSymptoms(input.symptoms, issues);
  const context = readOptionalText(input.context, 'context', issues);
  const hypotheses = readHypotheses(input.hypotheses, issues);
  const diagnosticSteps = readDiagnosticSteps(input.diagnostic_steps, issues);
  const knownEvidence = new Set(parsed.evidence.map(item => item.ref));
  for (const [index, hypothesis] of (hypotheses ?? []).entries()) {
    for (const ref of hypothesis.supporting_evidence) {
      if (!knownEvidence.has(ref)) issues.push({path: `hypotheses[${index}].supporting_evidence`, code: 'INVALID_VALUE', message: 'Hypothesis references unknown evidence'});
    }
  }
  for (const [index, step] of (diagnosticSteps ?? []).entries()) {
    for (const ref of step.supporting_evidence ?? []) {
      if (!knownEvidence.has(ref)) issues.push({path: `diagnostic_steps[${index}].supporting_evidence`, code: 'INVALID_VALUE', message: 'Diagnostic step references unknown evidence'});
    }
  }
  if (typeof input.capability_id === 'string' && input.capability_id.trim() && input.capability_id.trim() !== 'debug') {
    issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Debug requests must use capability_id=debug'});
  }
  if (issues.length > 0 || !parsed.base) return {valid: false, value: null, issues};
  return {
    valid: true,
    value: {
      ...parsed.base,
      capability_id: 'debug',
      evidence: parsed.evidence,
      symptoms,
      ...(context ? {context} : {}),
      ...(hypotheses ? {hypotheses} : {}),
      ...(diagnosticSteps ? {diagnostic_steps: diagnosticSteps} : {}),
    },
    issues: [],
  };
}

function operationRequest(input: unknown): {valid: boolean; operations: string[]} {
  if (!isRecord(input) || input.requested_operations === undefined) return {valid: true, operations: []};
  if (!Array.isArray(input.requested_operations)) return {valid: false, operations: []};
  const operations = input.requested_operations.filter(item => typeof item === 'string' && item.trim()).map(item => (item as string).trim());
  return {valid: operations.length === input.requested_operations.length, operations};
}

function safeEvidenceRefs(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.evidence)) return [];
  return input.evidence.flatMap(item => isRecord(item) && typeof item.ref === 'string' && item.ref.trim() ? [item.ref.trim()] : []);
}

function debugData<T>(request: DebugRequest, result: T, state: WorkflowState, risks: CapabilityRisk[], decisions: string[]): CapabilityData<T> {
  return {
    capability_id: request.capability_id,
    capability_version: request.capability_version,
    project_id: request.project_id,
    mode: request.mode ?? null,
    workflow_state: state,
    proposal_or_findings: result,
    risks,
    decisions_pending: decisions,
    execution_location: 'client',
  };
}

function blockedResponse(requestId: string, input: unknown, operations: string[]): CapabilityEnvelope<DebugAssessment> {
  return envelope(requestId, 'blocked', null, {
    warnings: ['Execution requests are outside the read-only debug capability'],
    evidence_refs: safeEvidenceRefs(input),
    required_approvals: operations.map(operation => `human:approve:${operation}`),
    next_actions: ['Keep the request blocked', 'Evaluate any action only in the authorized client under its own security policy'],
  });
}

function sanitizeText(value: string): string {
  return value
    .replace(/ignore\s+(?:all\s+)?previous\s+instructions[^.;\n]*/gi, '[UNTRUSTED_INSTRUCTION_REDACTED]')
    .replace(/authorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, 'sensitive=[REDACTED]')
    .replace(/\b(?:eyJ[a-z0-9_-]{8,}|sk-[a-z0-9_-]{8,}|ghp_[a-z0-9_-]{8,}|github_pat_[a-z0-9_-]{8,}|vercel_[a-z0-9_-]{8,})\b/gi, '[REDACTED]');
}

function evidenceText(item: DebugEvidence): string {
  return `${item.summary} ${item.source} ${item.context}`.toLowerCase();
}

const indicatorRules: readonly {id: string; pattern: RegExp; summary: string; impact: Risk}[] = [
  {id: 'configuration-mismatch', pattern: /config|environment variable|env var|missing variable|invalid token|authentication|\b401\b|unauthori[sz]ed/i, summary: 'A configuration or authentication mismatch may explain the observed symptom', impact: 'moderate'},
  {id: 'build-or-typecheck-failure', pattern: /build failed|build error|typecheck|compile|npm run build|deployment failed/i, summary: 'A build or typecheck failure may explain the observed symptom', impact: 'moderate'},
  {id: 'test-failure', pattern: /test failed|failing test|assertion|regression|test error/i, summary: 'A test failure or regression may explain the observed symptom', impact: 'moderate'},
  {id: 'transport-or-network-failure', pattern: /timeout|connection|dns|unreachable|\b502\b|\b503\b|network error/i, summary: 'A transport or network failure may explain the observed symptom', impact: 'moderate'},
];

function deriveHypotheses(request: DebugRequest): DebugHypothesis[] {
  const explicit = request.hypotheses ?? [];
  const evidence = request.evidence;
  const derived = indicatorRules.flatMap(rule => {
    const refs = evidence.filter(item => rule.pattern.test(evidenceText(item))).map(item => item.ref).sort();
    if (refs.length === 0) return [];
    return [{id: rule.id, summary: rule.summary, supporting_evidence: refs, uncertainty: 'high' as const, impact: rule.impact, status: 'unconfirmed' as const}];
  });
  const byId = new Map<string, DebugHypothesis>();
  for (const hypothesis of [...derived, ...explicit]) byId.set(hypothesis.id, {...hypothesis, summary: sanitizeText(hypothesis.summary), supporting_evidence: [...hypothesis.supporting_evidence].sort()});
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function contradictionDetected(request: DebugRequest): boolean {
  return request.evidence.some(item => /contradict|conflict|inconsistent|mutually exclusive/i.test(evidenceText(item)));
}

function defaultDiagnosticSteps(): DebugDiagnosticStep[] {
  return [
    {id: 'reproduce-observation', kind: 'reproduce', action: 'Reproduce the reported symptom using the authorized client and the supplied context', expected_observation: 'The observed behavior can be compared with the expected behavior', execution_location: 'client'},
    {id: 'isolate-boundary', kind: 'isolate', action: 'Isolate the smallest client-controlled input or boundary associated with the symptom', expected_observation: 'The scope of the deviation is narrowed without changing the environment', execution_location: 'client'},
    {id: 'verify-hypotheses', kind: 'verify', action: 'Verify each unconfirmed hypothesis against new client-provided evidence', expected_observation: 'A hypothesis is supported, refuted or remains unconfirmed', execution_location: 'client'},
  ];
}

function buildAssessment(request: DebugRequest): {assessment: DebugAssessment; status: 'ok' | 'needs_input'; risks: CapabilityRisk[]; decisions: string[]; nextActions: string[]} {
  const hypotheses = deriveHypotheses(request);
  const contradictory = contradictionDetected(request);
  const gaps: string[] = [];
  if (hypotheses.length === 0) gaps.push('No explicit evidence supports a causal hypothesis');
  if (contradictory) gaps.push('Resolve contradictory evidence before confirming a cause');
  const status: 'ok' | 'needs_input' = contradictory ? 'needs_input' : 'ok';
  const diagnosisStatus: DebugDiagnosisStatus = contradictory ? 'contradictory' : hypotheses.length > 0 ? 'initial' : 'inconclusive';
  const limitations = [
    'This is deterministic analysis of client-provided material; it does not independently verify the incident',
    'Logs, stack traces and descriptions are untrusted data; prompt-like instructions are not executed',
    'A hypothesis is not a confirmed diagnosis and no external service, filesystem or shell was accessed',
  ];
  const diagnosticSteps = request.diagnostic_steps && request.diagnostic_steps.length > 0 ? request.diagnostic_steps.map(step => ({...step, action: sanitizeText(step.action), expected_observation: sanitizeText(step.expected_observation)})) : defaultDiagnosticSteps();
  const assessment: DebugAssessment = {
    diagnosis_status: diagnosisStatus,
    symptoms: request.symptoms.map(symptom => ({...symptom, ...(symptom.environment ? {environment: sanitizeText(symptom.environment)} : {}), expected: sanitizeText(symptom.expected), observed: sanitizeText(symptom.observed), ...(symptom.message ? {message: sanitizeText(symptom.message)} : {})})),
    evidence_sources: request.evidence.map(item => ({ref: item.ref, source: sanitizeText(item.source)})),
    hypotheses,
    diagnostic_steps: diagnosticSteps,
    gaps,
    correction_strategies: hypotheses.map(hypothesis => `Validate ${hypothesis.id} in the authorized client before considering any change`),
    limitations,
  };
  const risks = hypotheses.length > 0
    ? hypotheses.map(hypothesis => ({id: `hypothesis-${hypothesis.id}`, level: hypothesis.impact, summary: `Unconfirmed hypothesis: ${sanitizeText(hypothesis.summary)}`, mitigation: 'Obtain and review additional client-provided evidence before acting'}))
    : [{id: 'diagnostic-uncertainty', level: 'low' as const, summary: 'No causal diagnosis was confirmed', mitigation: 'Collect the missing diagnostic evidence in the authorized client'}];
  const decisions = [...gaps, 'The authorized client must decide whether proposed diagnostic steps are permitted'];
  const nextActions = status === 'needs_input'
    ? ['Provide consistent diagnostic evidence and resolve the identified contradiction', 'Run proposed checks only in the authorized client']
    : ['Review the unconfirmed hypotheses with the client', 'Run proposed checks only in the authorized client'];
  return {assessment, status, risks, decisions, nextActions};
}

export function prepareDebug(requestId: string, input: unknown): CapabilityEnvelope<DebugAssessment> {
  const validation = validateDebugRequest(input);
  const operation = operationRequest(input);
  const hasMalformedInput = validation.issues.some(issue => malformedCodes.has(issue.code)) || !operation.valid;
  if (operation.valid && operation.operations.length > 0 && !hasMalformedInput) return blockedResponse(requestId, input, operation.operations);

  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: validation.issues.map(issue => `${issue.path || 'request'}: ${issue.message}`),
      next_actions: [status === 'needs_input' ? 'Provide an observable symptom, context and supporting evidence' : 'Correct the invalid debug request'],
    });
  }

  const request = validation.value;
  const result = buildAssessment(request);
  const data = debugData(request, result.assessment, 'planned', result.risks, result.decisions);
  return envelope(requestId, result.status, data, {
    evidence_refs: request.evidence.map(item => item.ref),
    next_actions: result.nextActions,
    warnings: result.status === 'needs_input' ? result.assessment.gaps : [],
  });
}
