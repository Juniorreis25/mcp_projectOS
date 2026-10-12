import {envelope, type WorkflowState} from './contracts.js';
import {
  F5_CONTRACT_VERSION,
  type CapabilityData,
  type CapabilityEnvelope,
  type CapabilityEvidence,
  type CapabilityRisk,
  type CapabilityRequest,
  type ValidationIssue,
  type ValidationResult,
  readString,
  validateCapabilityRequest,
  validationStatus,
} from './f5-contracts.js';

export const TEST_CONTRACT_VERSION = F5_CONTRACT_VERSION;
export const TEST_MAX_ITEMS = 100;
export const TEST_MAX_TEXT_LENGTH = 20_000;

export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'blocked' | 'not_run';
export type TestCoverage = 'covered' | 'failed' | 'blocked' | 'missing_test' | 'not_run' | 'missing_evidence' | 'contradictory';
export type TestAssessmentStatus = 'declared_with_evidence' | 'declared_without_evidence' | 'contradictory' | 'unknown_case';

export interface TestEvidence extends CapabilityEvidence {
  source: string;
  context: string;
}

export interface TestCase {
  id: string;
  title: string;
  criterion_refs: string[];
  verification: string;
  expected: string;
  execution_location: 'client';
}

export interface TestResult {
  case_id: string;
  status: TestResultStatus;
  evidence_links: string[];
  source: string;
  context: string;
}

export interface TestRequest extends Omit<CapabilityRequest, 'evidence'> {
  capability_id: 'test';
  evidence: TestEvidence[];
  acceptance_criteria: string[];
  test_cases?: TestCase[];
  results?: TestResult[];
}

export interface TestMatrixRow {
  criterion: string;
  test_case_ids: string[];
  evidence_links: string[];
  coverage: TestCoverage;
  declared_status: TestResultStatus | 'not_provided' | 'contradictory';
}

export interface TestMatrix {
  acceptance_criteria: string[];
  cases: TestCase[];
  rows: TestMatrixRow[];
  uncovered_criteria: string[];
  unexecuted_case_ids: string[];
}

export interface TestAssessment {
  case_id: string;
  declared_status: TestResultStatus;
  assessment: TestAssessmentStatus;
  evidence_links: string[];
  observation: string;
  independently_verified: false;
}

export interface TestEvaluation {
  matrix: TestMatrix;
  assessments: TestAssessment[];
  limitations: string[];
  recommendations: string[];
}

interface ParsedBase {
  base: CapabilityRequest | null;
  evidence: TestEvidence[];
}

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
  if (text && text.length > TEST_MAX_TEXT_LENGTH) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} exceeds the maximum text length`});
  }
  return text;
}

function readStringList(value: unknown, path: string, issues: ValidationIssue[], required: boolean): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be an array of strings`});
    return undefined;
  }
  if (value.length > TEST_MAX_ITEMS) {
    issues.push({path, code: 'INVALID_VALUE', message: `${path} contains too many items`});
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

function readTestEvidence(value: unknown, issues: ValidationIssue[]): TestEvidence[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE', message: 'evidence must be an array'});
    return [];
  }
  if (value.length > TEST_MAX_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE', message: 'evidence contains too many items'});
  const refs = new Set<string>();
  const evidence: TestEvidence[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({path: `evidence[${index}]`, code: 'INVALID_TYPE', message: 'Evidence must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary', 'source', 'context'], issues);
    const ref = readBoundedText(item.ref, `evidence[${index}].ref`, issues);
    const summary = readBoundedText(item.summary, `evidence[${index}].summary`, issues);
    const source = readBoundedText(item.source, `evidence[${index}].source`, issues);
    const context = readBoundedText(item.context, `evidence[${index}].context`, issues);
    if (ref && refs.has(ref)) issues.push({path: `evidence[${index}].ref`, code: 'INVALID_VALUE', message: 'Evidence refs must be unique'});
    if (ref) refs.add(ref);
    if (ref && summary && source && context) evidence.push({ref, summary, source, context});
  });
  return evidence;
}

function readTestCase(value: unknown, path: string, criteria: string[], issues: ValidationIssue[]): TestCase | null {
  if (!isRecord(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: 'Test case must be an object'});
    return null;
  }
  hasOnlyKnownFields(value, ['id', 'title', 'criterion_refs', 'verification', 'expected', 'execution_location'], issues);
  const id = readBoundedText(value.id, `${path}.id`, issues);
  const title = readBoundedText(value.title, `${path}.title`, issues);
  const criterionRefs = readStringList(value.criterion_refs, `${path}.criterion_refs`, issues, true);
  const verification = readBoundedText(value.verification, `${path}.verification`, issues);
  const expected = readBoundedText(value.expected, `${path}.expected`, issues);
  const location = readString(value.execution_location, `${path}.execution_location`, true, issues);
  if (location && location !== 'client') issues.push({path: `${path}.execution_location`, code: 'INVALID_VALUE', message: 'Test execution must remain at the client'});
  for (const criterion of criterionRefs ?? []) {
    if (!criteria.includes(criterion)) issues.push({path: `${path}.criterion_refs`, code: 'INVALID_VALUE', message: 'Test case references an unknown acceptance criterion'});
  }
  if (!id || !title || !criterionRefs || !verification || !expected || location !== 'client') return null;
  return {id, title, criterion_refs: criterionRefs, verification, expected, execution_location: 'client'};
}

function readResults(value: unknown, issues: ValidationIssue[]): TestResult[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push({path: 'results', code: 'INVALID_TYPE', message: 'results must be an array'});
    return [];
  }
  if (value.length > TEST_MAX_ITEMS) issues.push({path: 'results', code: 'INVALID_VALUE', message: 'results contains too many items'});
  const statuses = new Set<TestResultStatus>(['passed', 'failed', 'skipped', 'blocked', 'not_run']);
  const results: TestResult[] = [];
  value.forEach((item, index) => {
    const path = `results[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Test result must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['case_id', 'status', 'evidence_links', 'source', 'context'], issues);
    const caseId = readBoundedText(item.case_id, `${path}.case_id`, issues);
    const status = readString(item.status, `${path}.status`, true, issues) as TestResultStatus | undefined;
    const evidenceLinks = readStringList(item.evidence_links, `${path}.evidence_links`, issues, false) ?? [];
    const source = readBoundedText(item.source, `${path}.source`, issues);
    const context = readBoundedText(item.context, `${path}.context`, issues);
    if (status && !statuses.has(status)) issues.push({path: `${path}.status`, code: 'INVALID_VALUE', message: 'Unsupported test result status'});
    if (caseId && status && statuses.has(status) && source && context) results.push({case_id: caseId, status, evidence_links: evidenceLinks, source, context});
  });
  return results;
}

function parseBase(input: Record<string, unknown>, issues: ValidationIssue[]): ParsedBase {
  const rawEvidence = input.evidence;
  const baseInput: Record<string, unknown> = {...input};
  if (!Array.isArray(rawEvidence) || rawEvidence.length === 0) {
    baseInput.evidence = [{ref: '__test_evidence_placeholder__', summary: '__test_evidence_placeholder__'}];
  } else {
    baseInput.evidence = rawEvidence.map(item => isRecord(item) ? {ref: item.ref, summary: item.summary} : item);
  }
  const base = validateCapabilityRequest(baseInput, ['acceptance_criteria', 'test_cases', 'results']);
  issues.push(...base.issues.filter(issue => !issue.path.startsWith('evidence')));
  const evidence = readTestEvidence(rawEvidence, issues);
  if (base.value?.capability_id !== 'test') issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Test requests must use capability_id=test'});
  return {base: base.value, evidence};
}

export function validateTestRequest(input: unknown): ValidationResult<TestRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  const parsed = parseBase(input, issues);
  const criteria = readStringList(input.acceptance_criteria, 'acceptance_criteria', issues, true);
  const cases: TestCase[] = [];
  if (input.test_cases !== undefined) {
    if (!Array.isArray(input.test_cases)) issues.push({path: 'test_cases', code: 'INVALID_TYPE', message: 'test_cases must be an array'});
    else {
      if (input.test_cases.length > TEST_MAX_ITEMS) issues.push({path: 'test_cases', code: 'INVALID_VALUE', message: 'test_cases contains too many items'});
      const ids = new Set<string>();
      input.test_cases.forEach((item, index) => {
        const testCase = readTestCase(item, `test_cases[${index}]`, criteria ?? [], issues);
        if (testCase && ids.has(testCase.id)) issues.push({path: `test_cases[${index}].id`, code: 'INVALID_VALUE', message: 'Test case IDs must be unique'});
        if (testCase) {
          ids.add(testCase.id);
          cases.push(testCase);
        }
      });
    }
  }
  const results = readResults(input.results, issues);
  if (issues.length > 0 || !parsed.base || !criteria) return {valid: false, value: null, issues};
  return {
    valid: true,
    value: {
      ...parsed.base,
      capability_id: 'test',
      evidence: parsed.evidence,
      acceptance_criteria: criteria,
      ...(input.test_cases !== undefined ? {test_cases: cases} : {}),
      ...(input.results !== undefined ? {results} : {}),
    },
    issues: [],
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'criterion';
}

function generatedCases(criteria: string[]): TestCase[] {
  return criteria.map((criterion, index) => ({
    id: `test-${index + 1}-${slug(criterion)}`,
    title: `Verify acceptance criterion ${index + 1}`,
    criterion_refs: [criterion],
    verification: `The authorized client verifies: ${criterion}`,
    expected: criterion,
    execution_location: 'client',
  }));
}

function evidenceLinks(request: TestRequest): string[] {
  return request.evidence.map(item => item.ref);
}

function testData<T>(request: TestRequest, result: T, state: WorkflowState, risks: CapabilityRisk[], decisions: string[]): CapabilityData<T> {
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

function operationRequest(input: unknown): {valid: boolean; operations: string[]} {
  if (!isRecord(input) || input.requested_operations === undefined) return {valid: true, operations: []};
  if (!Array.isArray(input.requested_operations)) return {valid: false, operations: []};
  const operations: string[] = [];
  for (const operation of input.requested_operations) {
    if (typeof operation !== 'string' || !operation.trim()) return {valid: false, operations: []};
    operations.push(operation.trim());
  }
  return {valid: true, operations};
}

function safeEvidenceLinks(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.evidence)) return [];
  return input.evidence.flatMap(item => isRecord(item) && typeof item.ref === 'string' && item.ref.trim() ? [item.ref.trim()] : []);
}

function blockedResponse(requestId: string, input: unknown, operations: string[]): CapabilityEnvelope<TestEvaluation> {
  return envelope(requestId, 'blocked', null, {
    warnings: ['Execution requests are outside the read-only test planning and assessment capability'],
    evidence_refs: safeEvidenceLinks(input),
    required_approvals: operations.map(operation => `human:approve:${operation}`),
    next_actions: ['Keep the request blocked', 'Evaluate any execution only in the authorized client under its own security policy'],
  });
}

function assessmentFor(caseItem: TestCase, results: TestResult[], knownEvidence: Set<string>): TestAssessment | null {
  const matching = results.filter(result => result.case_id === caseItem.id);
  if (matching.length === 0) return null;
  const statuses = new Set(matching.map(result => result.status));
  const links = [...new Set(matching.flatMap(result => result.evidence_links))];
  if (statuses.size > 1) return {
    case_id: caseItem.id,
    declared_status: 'not_run',
    assessment: 'contradictory',
    evidence_links: links,
    observation: 'Conflicting declared statuses were supplied for the same test case; no resolution was inferred.',
    independently_verified: false,
  };
  const declaredStatus = matching[0].status;
  const unknownLinks = links.filter(link => !knownEvidence.has(link));
  const assessment: TestAssessmentStatus = unknownLinks.length > 0 || (declaredStatus !== 'not_run' && links.length === 0)
    ? 'declared_without_evidence'
    : 'declared_with_evidence';
  return {
    case_id: caseItem.id,
    declared_status: declaredStatus,
    assessment,
    evidence_links: links,
    observation: assessment === 'declared_with_evidence'
      ? `The client declared ${declaredStatus}; linked evidence is recorded but was not independently verified.`
      : `The client declared ${declaredStatus}, but the supplied evidence is absent or unresolved; no approval was inferred.`,
    independently_verified: false,
  };
}

function unknownCaseAssessments(results: TestResult[], knownCases: Set<string>): TestAssessment[] {
  return results.filter(result => !knownCases.has(result.case_id)).map(result => ({
    case_id: result.case_id,
    declared_status: result.status,
    assessment: 'unknown_case',
    evidence_links: [...result.evidence_links],
    observation: 'A result referenced a test case that was not supplied or generated; its outcome cannot be included in the traceability matrix.',
    independently_verified: false,
  }));
}

function coverageFor(criterion: string, cases: TestCase[], assessments: TestAssessment[]): TestMatrixRow {
  const criterionCases = cases.filter(testCase => testCase.criterion_refs.includes(criterion));
  const criterionAssessments = criterionCases.map(testCase => assessments.find(assessment => assessment.case_id === testCase.id)).filter((assessment): assessment is TestAssessment => assessment !== undefined);
  const links = [...new Set(criterionAssessments.flatMap(assessment => assessment.evidence_links))];
  const statuses = criterionAssessments.map(assessment => assessment.declared_status);
  let coverage: TestCoverage = 'not_run';
  if (criterionCases.length === 0) coverage = 'missing_test';
  else if (criterionAssessments.some(assessment => assessment.assessment === 'contradictory')) coverage = 'contradictory';
  else if (criterionAssessments.some(assessment => assessment.assessment === 'declared_without_evidence')) coverage = 'missing_evidence';
  else if (statuses.includes('failed')) coverage = 'failed';
  else if (statuses.includes('blocked')) coverage = 'blocked';
  else if (criterionAssessments.length === 0) coverage = 'not_run';
  else coverage = 'covered';
  return {
    criterion,
    test_case_ids: criterionCases.map(testCase => testCase.id),
    evidence_links: links,
    coverage,
    declared_status: criterionAssessments.some(assessment => assessment.assessment === 'contradictory') ? 'contradictory' : statuses[0] ?? 'not_provided',
  };
}

function buildEvaluation(request: TestRequest): {evaluation: TestEvaluation; needsInput: string[]; risks: CapabilityRisk[]; decisions: string[]} {
  const cases = request.test_cases ?? generatedCases(request.acceptance_criteria);
  const results = request.results ?? [];
  const knownEvidence = new Set(request.evidence.map(item => item.ref));
  const knownCases = new Set(cases.map(testCase => testCase.id));
  const assessments = cases.map(testCase => assessmentFor(testCase, results, knownEvidence)).filter((assessment): assessment is TestAssessment => assessment !== null);
  const unknownAssessments = unknownCaseAssessments(results, knownCases);
  const allAssessments = [...assessments, ...unknownAssessments];
  const rows = request.acceptance_criteria.map(criterion => coverageFor(criterion, cases, assessments));
  const unexecuted = cases.filter(testCase => !assessments.some(assessment => assessment.case_id === testCase.id)).map(testCase => testCase.id);
  const needsInput: string[] = [];
  if (rows.some(row => row.coverage === 'missing_test')) needsInput.push('Provide a test case for every acceptance criterion');
  if (rows.some(row => row.coverage === 'missing_evidence')) needsInput.push('Provide resolvable evidence for declared test results');
  if (rows.some(row => row.coverage === 'contradictory')) needsInput.push('Resolve contradictory results for the affected test cases');
  if (unknownAssessments.length > 0) needsInput.push('Provide the referenced test cases before evaluating their results');
  const risks: CapabilityRisk[] = [];
  if (rows.some(row => row.coverage === 'failed')) risks.push({id: 'test-declared-failure', level: 'moderate', summary: 'A client-declared test result failed', mitigation: 'Investigate the failure in the authorized client and attach evidence before relying on the result'});
  if (rows.some(row => row.coverage === 'blocked')) risks.push({id: 'test-declared-blocked', level: 'moderate', summary: 'A client-declared test result is blocked', mitigation: 'Resolve the client-side blocker before treating the criterion as covered'});
  if (needsInput.length > 0) risks.push({id: 'test-evidence-gap', level: 'moderate', summary: 'Test coverage or evidence is incomplete or contradictory', mitigation: 'Supply and reconcile the missing client-side test material'});
  const evaluation: TestEvaluation = {
    matrix: {
      acceptance_criteria: [...request.acceptance_criteria],
      cases,
      rows,
      uncovered_criteria: rows.filter(row => row.coverage !== 'covered').map(row => row.criterion),
      unexecuted_case_ids: unexecuted,
    },
    assessments: allAssessments,
    limitations: [
      'Test cases and results are supplied by the client and are not independently executed or verified.',
      'A passed result is an informational declaration, not proof of correctness, coverage, merge approval or release readiness.',
      'The server does not run commands, access filesystems, repositories or external services.',
      'Evidence content is treated as untrusted data and is not interpreted as instructions.',
    ],
    recommendations: [
      'Execute proposed checks only in the authorized client under its own permissions and security policy',
      'Attach sanitized evidence and reconcile every uncovered, failed or contradictory row',
      'Obtain separate human approval before any sensitive client-side operation',
    ],
  };
  return {evaluation, needsInput, risks, decisions: needsInput.length > 0 ? ['Resolve the reported test coverage and evidence gaps with the authorized client'] : []};
}

export function prepareTest(requestId: string, input: unknown): CapabilityEnvelope<TestEvaluation> {
  const validation = validateTestRequest(input);
  const operation = operationRequest(input);
  const malformed = validation.issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code));
  if (operation.valid && operation.operations.length > 0 && !malformed) return blockedResponse(requestId, input, operation.operations);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: validation.issues.map(issue => `${issue.path || 'request'}: ${issue.message}`),
      next_actions: [status === 'needs_input' ? 'Provide acceptance criteria and the missing test planning inputs' : 'Correct the invalid test request'],
    });
  }
  const request = validation.value;
  const {evaluation, needsInput, risks, decisions} = buildEvaluation(request);
  const status = needsInput.length > 0 ? 'needs_input' : 'ok';
  const state: WorkflowState = request.results && request.results.length > 0 ? 'verifying' : 'planned';
  const data = testData(request, evaluation, state, risks, decisions);
  return envelope(requestId, status, data, {
    evidence_refs: evidenceLinks(request),
    warnings: needsInput,
    next_actions: needsInput.length > 0 ? ['Provide the missing or reconciled test material', 'Re-submit the assessment in the authorized client'] : ['Review the proposed matrix with the authorized client', 'Execute checks only in the authorized client if approved'],
  });
}
