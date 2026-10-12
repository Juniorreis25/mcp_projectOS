import { envelope, type Envelope, type Risk, type WorkflowState } from './contracts.js';

export const RELEASE_CONTRACT_VERSION = '1.0.0' as const;
export const RELEASE_MAX_TEXT_LENGTH = 20_000;
export const RELEASE_MAX_LIST_ITEMS = 100;
export const RELEASE_MAX_VALIDATION_WARNINGS = 20;
export const RELEASE_MAX_WARNING_LENGTH = 160;

export type ReleaseTargetEnvironment = 'preview' | 'production' | 'staging' | 'development' | 'unknown';
export type ReleaseTestStatus = 'passed' | 'failed' | 'skipped' | 'blocked' | 'not_run';
export type ReleaseCriterionStatus = 'met' | 'not_met' | 'not_verified';
export type ReleaseReadiness = 'ready_for_client_review' | 'not_ready' | 'insufficient_evidence';

export interface ReleaseEvidence {
  ref: string;
  summary: string;
}

export interface ReleaseTestResult {
  id: string;
  status: ReleaseTestStatus;
  evidence_refs: string[];
  summary?: string;
}

export interface ReleaseRequest {
  capability_id: 'release';
  capability_version: string;
  project_id: string;
  proposed_version: string;
  scope: string[];
  planned_changes: string[];
  declared_risks: string[];
  acceptance_criteria: string[];
  test_results: ReleaseTestResult[];
  evidence: ReleaseEvidence[];
  dependencies: string[];
  decisions_pending: string[];
  rollback_strategy: string;
  target_environment: ReleaseTargetEnvironment;
  requested_operations?: string[];
  approvals?: string[];
}

export interface ReleaseCriterion {
  id: string;
  statement: string;
  status: ReleaseCriterionStatus;
  evidence_refs: string[];
}

export interface ReleaseTestAssessment {
  id: string;
  status: ReleaseTestStatus;
  independently_verified: false;
  evidence_refs: string[];
  observation: string;
}

export interface ReleasePlan {
  proposed_version: string;
  scope: string[];
  planned_changes: string[];
  target_environment: ReleaseTargetEnvironment;
  readiness: ReleaseReadiness;
  criteria: ReleaseCriterion[];
  test_assessments: ReleaseTestAssessment[];
  rollback_strategy: string;
  risks: string[];
  evidence_gaps: string[];
  pre_publication_checks: string[];
  client_next_steps: string[];
  limitations: string[];
}

export interface ReleaseData {
  capability_id: 'release';
  capability_version: string;
  project_id: string;
  workflow_state: Extract<WorkflowState, 'planned'>;
  proposal_or_findings: ReleasePlan;
  risks: Array<{id: string; level: Risk; summary: string; mitigation: string}>;
  decisions_pending: string[];
  execution_location: 'client';
}

export type ReleaseEnvelope = Envelope<ReleaseData | null>;

type ReleaseRiskLevel = Extract<Risk, 'moderate' | 'critical'>;
type ReleaseRiskCategory = 'destructive' | 'credentials' | 'access' | 'migration' | 'production' | 'inconsistency' | 'availability';
type ReleaseRiskSource = 'target_environment' | 'scope' | 'planned_changes' | 'declared_risks' | 'dependencies' | 'decisions_pending';

interface RiskSignal {
  key: string;
  category: ReleaseRiskCategory;
  level: ReleaseRiskLevel;
  source: ReleaseRiskSource;
}

interface RiskEntry {
  key: string;
  level: ReleaseRiskLevel;
  summary: string;
}

interface PlanAnalysis {
  plan: ReleasePlan;
  riskEntries: RiskEntry[];
  criticalRisk: boolean;
  materialBlockers: string[];
}

interface ValidationIssue {
  path: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_FIELD';
}

interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

const supportedVersions = new Set<string>([RELEASE_CONTRACT_VERSION]);
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const projectPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const semverPattern = /^\d+\.\d+\.\d+$/;
const targetEnvironments = new Set<ReleaseTargetEnvironment>(['preview', 'production', 'staging', 'development', 'unknown']);
const testStatuses = new Set<ReleaseTestStatus>(['passed', 'failed', 'skipped', 'blocked', 'not_run']);
const secretPatterns: readonly RegExp[] = [
  /authorization\s*:\s*bearer\s+[^\s,;]+/gi,
  /\b(?:bearer|password|passwd|secret|token|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_\/-]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/gi,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /ignore\s+all\s+previous\s+instructions[^.\n]*/gi,
];
const contradictionPattern = /\b(?:contradict(?:s|ory|ion)?|conflict(?:s|ing)?|inconsistent|incompat(?:ible|ibility))\b|contradi[cç][aã]o|incompat[ií]vel|conflitante/i;
const productionPattern = /\b(?:production|prod\b|live|release\/production|produ[cç][aã]o|ao vivo)\b/i;
const destructivePattern = /\b(?:delete|delet(?:e|ion)|remove|drop|destroy|purge|wipe|erase|truncate|irreversible|data loss|excluir|deletar|remover|destruir|apagar|purgar|limpar|irrevers[ií]vel|perda de dados)\b/i;
const credentialPattern = /\b(?:rotate|rotation|expose|exposure|revoke|credential|credentials|secret|secrets|token|password|passwd|api key|access key|rotate keys|rotacionar|rota[cç][aã]o|expor|exposi[cç][aã]o|credencial|segredo|senha|chave de api)\b/i;
const accessPattern = /\b(?:admin|administrator|permission|permissions|privilege|privileges|role|iam|acl|access control|elevat(?:e|ion)|permiss[aã]o|privil[eé]gio|administrador|controle de acesso|elevar acesso)\b/i;
const migrationPattern = /\b(?:migrat(?:e|ion)|schema|database|db\b|data migration|migra[cç][aã]o|esquema|banco de dados)\b/i;
const availabilityPattern = /\b(?:downtime|availability|performance|latency|breaking change|compatibility|degrada[cç][aã]o|indisponibilidade|desempenho|lat[eê]ncia|mudan[cç]a incompat[ií]vel|compatibilidade)\b/i;
const materialDependencyPattern = /\b(?:blocked|blocking|unresolved|missing|not available|unavailable|pending|required|depends on|bloquead[ao]|bloqueante|incompleto|ausente|indispon[ií]vel|pendente|necess[aá]ri[ao]|depende de|aguardando)\b/i;
const materialDecisionPattern = /\b(?:approval|authorize|authorization|security|production|credential|migration|rollback|aprova[cç][aã]o|autoriza[cç][aã]o|seguran[cç]a|produ[cç][aã]o|credencial|migra[cç][aã]o|rollback)\b/i;
const safeIssuePathPatterns: readonly RegExp[] = [
  /^(?:capability_id|capability_version|project_id|proposed_version|scope|planned_changes|declared_risks|acceptance_criteria|test_results|evidence|dependencies|decisions_pending|rollback_strategy|target_environment|requested_operations|approvals)$/,
  /^(?:scope|planned_changes|declared_risks|acceptance_criteria|dependencies|decisions_pending|requested_operations|approvals)\[\d{1,3}\]$/,
  /^evidence\[\d{1,3}\]\.(?:ref|summary)$/,
  /^test_results\[\d{1,3}\]\.(?:id|status|evidence_refs|summary)$/,
  /^test_results\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[], path = ''): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: path ? `${path}.${key}` : key, code: 'UNKNOWN_FIELD'});
  }
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
  if (trimmed.length > RELEASE_MAX_TEXT_LENGTH) issues.push({path, code: 'INVALID_VALUE'});
  return trimmed;
}

function readList(value: unknown, path: string, required: boolean, issues: ValidationIssue[]): string[] | undefined {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > RELEASE_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  value.forEach((item, index) => {
    const text = readText(item, `${path}[${index}]`, true, issues);
    if (text) result.push(text);
  });
  return result;
}

function readReference(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const ref = readText(value, path, true, issues);
  if (ref && (!referencePattern.test(ref) || /(?:authorization\s*:\s*bearer|\b(?:secret|token|password)\b)/i.test(ref))) {
    issues.push({path, code: 'INVALID_VALUE'});
    return undefined;
  }
  return ref;
}

function readProjectId(value: unknown, issues: ValidationIssue[]): string | undefined {
  const projectId = readText(value, 'project_id', true, issues);
  if (projectId && !projectPattern.test(projectId)) issues.push({path: 'project_id', code: 'INVALID_VALUE'});
  return projectId;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): ReleaseEvidence[] | undefined {
  if (value === undefined) {
    issues.push({path: 'evidence', code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE'});
    return undefined;
  }
  const refs = new Set<string>();
  const evidence: ReleaseEvidence[] = [];
  if (value.length > RELEASE_MAX_LIST_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE'});
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
    if (ref && summary) evidence.push({ref, summary});
  });
  return evidence;
}

function readTestResults(value: unknown, evidenceRefs: Set<string>, issues: ValidationIssue[]): ReleaseTestResult[] | undefined {
  if (value === undefined) {
    issues.push({path: 'test_results', code: 'MISSING_REQUIRED'});
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'test_results', code: 'INVALID_TYPE'});
    return undefined;
  }
  const ids = new Set<string>();
  const results: ReleaseTestResult[] = [];
  if (value.length > RELEASE_MAX_LIST_ITEMS) issues.push({path: 'test_results', code: 'INVALID_VALUE'});
  value.forEach((item, index) => {
    const path = `test_results[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'status', 'evidence_refs', 'summary'], issues, path);
    const id = readText(item.id, `${path}.id`, true, issues);
    if (id && !identifierPattern.test(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) ids.add(id);
    const status = readText(item.status, `${path}.status`, true, issues) as ReleaseTestStatus | undefined;
    if (status && !testStatuses.has(status)) issues.push({path: `${path}.status`, code: 'INVALID_VALUE'});
    const refs = readList(item.evidence_refs, `${path}.evidence_refs`, true, issues) ?? [];
    const refSet = new Set<string>();
    refs.forEach((ref, refIndex) => {
      if (!referencePattern.test(ref)) issues.push({path: `${path}.evidence_refs[${refIndex}]`, code: 'INVALID_VALUE'});
      if (refSet.has(ref)) issues.push({path: `${path}.evidence_refs[${refIndex}]`, code: 'INVALID_VALUE'});
      refSet.add(ref);
      if (!evidenceRefs.has(ref)) issues.push({path: `${path}.evidence_refs[${refIndex}]`, code: 'INVALID_VALUE'});
    });
    const summary = item.summary === undefined ? undefined : readText(item.summary, `${path}.summary`, false, issues);
    if (id && status && testStatuses.has(status) && !issues.some(issue => issue.path.startsWith(path))) {
      results.push({id, status, evidence_refs: refs, ...(summary ? {summary} : {})});
    }
  });
  return results;
}

function readRequest(input: Record<string, unknown>, issues: ValidationIssue[]): ReleaseRequest {
  const capabilityId = readText(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readText(input.capability_version, 'capability_version', true, issues);
  const projectId = readProjectId(input.project_id, issues);
  const proposedVersion = readText(input.proposed_version, 'proposed_version', true, issues);
  if (proposedVersion && !semverPattern.test(proposedVersion)) issues.push({path: 'proposed_version', code: 'INVALID_VALUE'});
  const scope = readList(input.scope, 'scope', true, issues);
  const plannedChanges = readList(input.planned_changes, 'planned_changes', true, issues);
  const declaredRisks = readList(input.declared_risks, 'declared_risks', true, issues);
  const acceptanceCriteria = readList(input.acceptance_criteria, 'acceptance_criteria', true, issues);
  const dependencies = readList(input.dependencies, 'dependencies', true, issues);
  const decisionsPending = readList(input.decisions_pending, 'decisions_pending', true, issues);
  const rollbackStrategy = readText(input.rollback_strategy, 'rollback_strategy', true, issues);
  const targetEnvironment = readText(input.target_environment, 'target_environment', true, issues) as ReleaseTargetEnvironment | undefined;
  if (targetEnvironment && !targetEnvironments.has(targetEnvironment)) issues.push({path: 'target_environment', code: 'INVALID_VALUE'});
  const evidence = readEvidence(input.evidence, issues) ?? [];
  const testResults = readTestResults(input.test_results, new Set(evidence.map(item => item.ref)), issues) ?? [];
  const requestedOperations = input.requested_operations === undefined ? undefined : readList(input.requested_operations, 'requested_operations', false, issues);
  const approvals = input.approvals === undefined ? undefined : readList(input.approvals, 'approvals', false, issues);

  if (capabilityId !== 'release') issues.push({path: 'capability_id', code: 'INVALID_VALUE'});
  if (capabilityVersion && !semverPattern.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE'});
  else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION'});

  return {
    capability_id: 'release',
    capability_version: capabilityVersion ?? RELEASE_CONTRACT_VERSION,
    project_id: projectId ?? '',
    proposed_version: proposedVersion ?? '',
    scope: scope ?? [],
    planned_changes: plannedChanges ?? [],
    declared_risks: declaredRisks ?? [],
    acceptance_criteria: acceptanceCriteria ?? [],
    test_results: testResults,
    evidence,
    dependencies: dependencies ?? [],
    decisions_pending: decisionsPending ?? [],
    rollback_strategy: rollbackStrategy ?? '',
    target_environment: targetEnvironment ?? 'unknown',
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateReleaseRequest(input: unknown): ValidationResult<ReleaseRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'proposed_version', 'scope', 'planned_changes', 'declared_risks', 'acceptance_criteria', 'test_results', 'evidence', 'dependencies', 'decisions_pending', 'rollback_strategy', 'target_environment', 'requested_operations', 'approvals'], issues);
  const value = readRequest(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

function validationStatus(issues: ValidationIssue[]): 'needs_input' | 'error' {
  return issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code)) ? 'error' : 'needs_input';
}

function sanitizeText(value: string): string {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value).slice(0, RELEASE_MAX_TEXT_LENGTH);
}

function sortText(values: readonly string[]): string[] {
  return [...values].map(sanitizeText).sort((left, right) => left.localeCompare(right));
}

function evidenceRefs(request: ReleaseRequest): string[] {
  return [...new Set(request.evidence.map(item => item.ref))].sort((left, right) => left.localeCompare(right));
}

function safeIssuePath(path: string): string {
  if (path.length <= RELEASE_MAX_WARNING_LENGTH && safeIssuePathPatterns.some(pattern => pattern.test(path))) return path;
  return 'request';
}

function warningsForValidation(issues: ValidationIssue[]): string[] {
  const warnings = issues.slice(0, RELEASE_MAX_VALIDATION_WARNINGS).map(issue => `${safeIssuePath(issue.path)}: invalid release input`);
  if (issues.length > RELEASE_MAX_VALIDATION_WARNINGS) warnings.push('request: Additional validation issues omitted');
  return warnings.map(warning => warning.slice(0, RELEASE_MAX_WARNING_LENGTH));
}

function contradictory(request: ReleaseRequest): boolean {
  return request.evidence.some(item => contradictionPattern.test(item.summary));
}

function signalForText(text: string, source: ReleaseRiskSource, index: number): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const indicators: Array<[ReleaseRiskCategory, RegExp, ReleaseRiskLevel]> = [
    ['destructive', destructivePattern, 'critical'],
    ['credentials', credentialPattern, 'critical'],
    ['access', accessPattern, 'critical'],
    ['migration', migrationPattern, 'critical'],
    ['production', productionPattern, 'critical'],
    ['availability', availabilityPattern, 'moderate'],
  ];
  for (const [category, pattern, level] of indicators) {
    if (pattern.test(text)) signals.push({key: `${source}-${index}-${category}`, category, level, source});
  }
  return signals;
}

function riskAnalysis(request: ReleaseRequest): {entries: RiskEntry[]; criticalRisk: boolean; materialBlockers: string[]} {
  const signals: RiskSignal[] = [];
  const sourceValues: Array<{source: ReleaseRiskSource; values: readonly string[]}> = [
    {source: 'scope', values: request.scope},
    {source: 'planned_changes', values: request.planned_changes},
    {source: 'declared_risks', values: request.declared_risks},
    {source: 'dependencies', values: request.dependencies},
    {source: 'decisions_pending', values: request.decisions_pending},
  ];
  for (const {source, values} of sourceValues) {
    values.forEach((value, index) => signals.push(...signalForText(value, source, index)));
  }
  if (request.target_environment === 'production') {
    signals.push({key: 'target_environment-production', category: 'production', level: 'critical', source: 'target_environment'});
  }
  const containsProductionIndicator = sourceValues.some(({values}) => values.some(value => productionPattern.test(value)));
  if (request.target_environment === 'preview' && containsProductionIndicator) {
    signals.push({key: 'target-environment-inconsistency', category: 'inconsistency', level: 'critical', source: 'target_environment'});
  }

  const uniqueSignals = [...new Map(signals.map(signal => [signal.key, signal])).values()]
    .sort((left, right) => left.key.localeCompare(right.key));
  const entries: RiskEntry[] = uniqueSignals.map(signal => ({
    key: signal.key,
    level: signal.level,
    summary: `Heuristic ${signal.category} indicator detected in client-provided ${signal.source}; independent confirmation is required`,
  }));
  request.declared_risks.forEach((risk, index) => {
    const riskSignals = signalForText(risk, 'declared_risks', index);
    const level: ReleaseRiskLevel = riskSignals.some(signal => signal.level === 'critical') ? 'critical' : 'moderate';
    entries.push({key: `declared-risk-${index}`, level, summary: `Client-declared risk: ${sanitizeText(risk)}`});
  });

  const materialBlockers: string[] = [];
  if (request.dependencies.some(dependency => materialDependencyPattern.test(dependency))) {
    materialBlockers.push('A material dependency remains unresolved and requires client resolution');
  }
  if (request.decisions_pending.some(decision => materialDecisionPattern.test(decision))) {
    materialBlockers.push('A material release decision remains pending and requires client resolution');
  }
  const deduplicatedEntries = [...new Map(entries.map(entry => [entry.key, entry])).values()]
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    entries: deduplicatedEntries,
    criticalRisk: deduplicatedEntries.some(entry => entry.level === 'critical'),
    materialBlockers,
  };
}

function semanticGaps(request: ReleaseRequest): string[] {
  const gaps: string[] = [];
  if (request.scope.length === 0) gaps.push('Define the release scope');
  if (request.planned_changes.length === 0) gaps.push('Describe the planned changes');
  if (request.declared_risks.length === 0) gaps.push('Declare known release risks or explicitly record that none are known');
  if (request.acceptance_criteria.length === 0) gaps.push('Provide acceptance criteria');
  if (request.test_results.length === 0) gaps.push('Provide client-declared test results');
  if (request.evidence.length === 0) gaps.push('Provide traceable client-declared evidence');
  if (!request.rollback_strategy.trim()) gaps.push('Provide a rollback strategy');
  if (request.target_environment === 'unknown') gaps.push('Identify the target environment');
  return gaps;
}

function buildPlan(request: ReleaseRequest): PlanAnalysis {
  const gaps = semanticGaps(request);
  const contradictionFound = contradictory(request);
  const failedTests = request.test_results.filter(test => test.status === 'failed' || test.status === 'blocked');
  const unverifiedTests = request.test_results.filter(test => test.status === 'skipped' || test.status === 'not_run' || test.evidence_refs.length === 0);
  const productionTarget = request.target_environment === 'production';
  const risks = riskAnalysis(request);
  const criteria: ReleaseCriterion[] = request.acceptance_criteria
    .map((statement, index) => ({id: `criterion-${index + 1}`, statement: sanitizeText(statement), status: 'not_verified' as const, evidence_refs: []}))
    .sort((left, right) => left.id.localeCompare(right.id));
  const testAssessments = request.test_results
    .map(result => ({
      id: result.id,
      status: result.status,
      independently_verified: false as const,
      evidence_refs: [...result.evidence_refs].sort((left, right) => left.localeCompare(right)),
      observation: result.status === 'passed' ? 'Passed status was declared by the client and was not independently verified' : `Client declared test status: ${result.status}`,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const evidenceGaps = [
    ...gaps,
    ...(contradictionFound ? ['Evidence contains a possible contradiction requiring client reconciliation'] : []),
    ...(failedTests.length > 0 ? ['One or more client-declared tests failed or were blocked'] : []),
    ...(unverifiedTests.length > 0 ? ['One or more tests are skipped, not run, or lack traceable evidence'] : []),
    ...(productionTarget ? ['Production readiness requires separate release authorization and operational verification'] : []),
    ...(risks.criticalRisk ? ['Sensitive or Production indicators were detected heuristically; confirm scope and authorization in the client'] : []),
    ...risks.materialBlockers,
  ];
  const readiness: ReleaseReadiness = gaps.length > 0 || contradictionFound || failedTests.length > 0 || unverifiedTests.length > 0 || productionTarget || risks.criticalRisk || risks.materialBlockers.length > 0
    ? (contradictionFound || unverifiedTests.length > 0 || request.evidence.length === 0 ? 'insufficient_evidence' : 'not_ready')
    : 'ready_for_client_review';
  const plan: ReleasePlan = {
    proposed_version: request.proposed_version,
    scope: sortText(request.scope),
    planned_changes: sortText(request.planned_changes),
    target_environment: request.target_environment,
    readiness,
    criteria,
    test_assessments: testAssessments,
    rollback_strategy: sanitizeText(request.rollback_strategy),
    risks: risks.entries.map(entry => entry.summary),
    evidence_gaps: sortText(evidenceGaps),
    pre_publication_checks: [
      'Verify all acceptance criteria in the authorized client',
      'Reconcile evidence and confirm test results independently where policy requires',
      'Confirm explicit human release approval before any publication or promotion',
      'Validate rollback readiness in the authorized client',
    ],
    client_next_steps: [
      'Review this plan and its evidence in the authorized client',
      'Resolve every evidence gap before requesting a release decision',
      'Keep publication, promotion, rollback and migration outside this read-only capability',
    ],
    limitations: [
      'Client-provided tests and evidence are declarations, not independent certification',
      'This capability does not publish, promote, deploy, migrate, rollback or change branches, tags or aliases',
      'Text sanitization uses conservative known patterns and is not universal secret detection',
      'A ready_for_client_review assessment is not authorization to release or certify Production',
    ],
  };
  return {plan, riskEntries: risks.entries, criticalRisk: risks.criticalRisk, materialBlockers: risks.materialBlockers};
}

function dataFor(request: ReleaseRequest, analysis: PlanAnalysis): ReleaseData {
  const {plan, riskEntries, criticalRisk, materialBlockers} = analysis;
  return {
    capability_id: 'release',
    capability_version: request.capability_version,
    project_id: request.project_id,
    workflow_state: 'planned',
    proposal_or_findings: plan,
    risks: riskEntries.map((entry, index) => ({
      id: `release-risk-${index + 1}`,
      level: entry.level,
      summary: entry.summary,
      mitigation: 'Review and resolve this risk in the authorized client before any release decision',
    })),
    decisions_pending: [
      'Human review and release approval remain pending',
      ...(request.target_environment === 'production' ? ['Confirm separate Production authorization and verification'] : []),
      ...(criticalRisk ? ['Resolve heuristic sensitive-risk indicators before any release decision'] : []),
      ...materialBlockers,
      ...sortText(request.decisions_pending),
    ],
    execution_location: 'client',
  };
}

function blockedResponse(requestId: string, request: ReleaseRequest): ReleaseEnvelope {
  return envelope(requestId, 'blocked', null, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:release-execution-approval'],
    warnings: ['Requested operations are outside the read-only release capability'],
    next_actions: ['Keep the request blocked', 'Evaluate execution only in the authorized client under its own security policy'],
  });
}

export function prepareRelease(requestId: string, input: unknown): ReleaseEnvelope {
  const validation = validateReleaseRequest(input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: warningsForValidation(validation.issues),
      next_actions: [status === 'needs_input' ? 'Provide the missing release planning inputs and declared evidence' : 'Correct the invalid release request'],
    });
  }

  const request = validation.value;
  if ((request.requested_operations ?? []).length > 0) return blockedResponse(requestId, request);

  const analysis = buildPlan(request);
  const semanticNeedsInput = analysis.plan.evidence_gaps.length > 0;
  const status = semanticNeedsInput ? 'needs_input' : 'ok';
  const data = dataFor(request, analysis);
  return envelope(requestId, status, data, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:release-review'],
    warnings: [
      'Client-provided evidence and test results are not independently verified',
      ...(request.target_environment === 'production' ? ['Production readiness is not certified by this Preview/read-only plan'] : []),
      ...(analysis.criticalRisk ? ['Sensitive-risk classification is heuristic and requires client confirmation'] : []),
    ],
    next_actions: analysis.plan.client_next_steps,
  });
}
