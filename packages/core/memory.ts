import {envelope, type Envelope, type Risk, type WorkflowState} from './contracts.js';

export const MEMORY_CONTRACT_VERSION = '1.0.0' as const;
export const MEMORY_MAX_TEXT_LENGTH = 20_000;
export const MEMORY_MAX_LIST_ITEMS = 100;
export const MEMORY_MAX_VALIDATION_WARNINGS = 20;
export const MEMORY_MAX_WARNING_LENGTH = 160;

export type MemoryRecordType = 'fact' | 'decision' | 'constraint' | 'pending' | 'lesson';
export type MemoryRecordState = 'open' | 'resolved' | 'superseded' | 'unknown';

export interface MemoryEvidence {
  ref: string;
  summary: string;
}

export interface MemoryRecord {
  id: string;
  type: MemoryRecordType;
  content: string;
  evidence_refs: string[];
  source: string;
  date_or_version?: string;
  state?: MemoryRecordState;
}

export interface MemoryRequest {
  capability_id: 'memory';
  capability_version: string;
  project_id: string;
  records: MemoryRecord[];
  evidence: MemoryEvidence[];
  query: string;
  requested_operations?: string[];
  approvals?: string[];
}

export interface MemoryRecordView extends MemoryRecord {
  content: string;
  source: string;
  date_or_version?: string;
}

export interface MemoryConclusion {
  id: string;
  kind: 'summary' | 'decision' | 'constraint' | 'pending' | 'conflict' | 'gap';
  text: string;
  record_ids: string[];
  evidence_refs: string[];
  basis: 'client_declared_not_verified' | 'absence_of_matching_history';
}

export interface MemoryAnalysis {
  query: string;
  context_summary: MemoryConclusion[];
  relevant_records: MemoryRecordView[];
  applicable_decisions: MemoryConclusion[];
  applicable_constraints: MemoryConclusion[];
  open_items: MemoryConclusion[];
  conflicts: MemoryConclusion[];
  gaps: MemoryConclusion[];
  limitations: string[];
}

export interface MemoryData {
  capability_id: 'memory';
  capability_version: string;
  project_id: string;
  workflow_state: Extract<WorkflowState, 'planned' | 'blocked'>;
  proposal_or_findings: MemoryAnalysis;
  risks: Array<{id: string; level: Risk; summary: string; mitigation: string}>;
  decisions_pending: string[];
  execution_location: 'client';
}

export type MemoryEnvelope = Envelope<MemoryData | null>;

interface ValidationIssue {
  path: string;
  code: 'INVALID_TYPE' | 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_FIELD';
}

interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

interface MemoryAnalysisInternal {
  analysis: MemoryAnalysis;
  relevant: MemoryRecord[];
  riskLevel: Extract<Risk, 'low' | 'moderate'>;
  needsInput: boolean;
}

const supportedVersions = new Set<string>([MEMORY_CONTRACT_VERSION]);
const recordTypes = new Set<MemoryRecordType>(['fact', 'decision', 'constraint', 'pending', 'lesson']);
const recordStates = new Set<MemoryRecordState>(['open', 'resolved', 'superseded', 'unknown']);
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const projectIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const semverPattern = /^\d+\.\d+\.\d+$/;
const secretPatterns: readonly RegExp[] = [
  /authorization\s*:\s*bearer\s+[^\s,;]+/gi,
  /\b(?:bearer|password|passwd|secret|token|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_\/-]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/gi,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /ignore\s+all\s+previous\s+instructions[^.\n]*/gi,
];
const explicitConflictPattern = /\b(?:contradict(?:s|ory|ion)?|conflict(?:s|ing)?|inconsistent|incompat(?:ible|ibility))\b|contradi[cç][aã]o|incompat[ií]vel|conflitante/i;
const stalePattern = /\b(?:stale|outdated|obsolete|old|desatualizad[oa]|antig[oa]|obsolet[oa])\b/i;

type ConflictPolarity = 'positive' | 'negative';
type ConflictFamily = 'permission' | 'approval';

interface ConflictSignal {
  family: ConflictFamily;
  polarity: ConflictPolarity;
  topics: Set<string>;
  environments: Set<string>;
}

const conflictDefinitions: readonly {family: ConflictFamily; polarity: ConflictPolarity; pattern: RegExp; terms: readonly string[]}[] = [
  {
    family: 'permission',
    polarity: 'positive',
    pattern: /\b(?:allow|allows|allowed|permit|permits|permitted|authorize|authorizes|authorized|enable|enables|enabled|permitir|permite|permitido|autorizar|autoriza|autorizado|habilitar|habilita|habilitado)\b/i,
    terms: ['allow', 'allows', 'allowed', 'permit', 'permits', 'permitted', 'authorize', 'authorizes', 'authorized', 'enable', 'enables', 'enabled', 'permitir', 'permite', 'permitido', 'autorizar', 'autoriza', 'autorizado', 'habilitar', 'habilita', 'habilitado'],
  },
  {
    family: 'permission',
    polarity: 'negative',
    pattern: /\b(?:deny|denies|denied|prohibit|prohibits|prohibited|forbid|forbids|forbidden|disallow|disallows|disable|disabled|revoke|revokes|revoked|negar|nega|negado|proibir|proíbe|proibido|desabilitar|desabilita|desabilitado|desativar|revogar|revogado)\b/i,
    terms: ['deny', 'denies', 'denied', 'prohibit', 'prohibits', 'prohibited', 'forbid', 'forbids', 'forbidden', 'disallow', 'disallows', 'disable', 'disabled', 'revoke', 'revokes', 'revoked', 'negar', 'nega', 'negado', 'proibir', 'proíbe', 'proibido', 'desabilitar', 'desabilita', 'desabilitado', 'desativar', 'revogar', 'revogado'],
  },
  {
    family: 'approval',
    polarity: 'positive',
    pattern: /\b(?:require|requires|required|must|mandatory|approval\s+required|exigir|exige|exigido|obrigat[oó]rio|necess[aá]rio)\b/i,
    terms: ['require', 'requires', 'required', 'must', 'mandatory', 'approval', 'exigir', 'exige', 'exigido', 'obrigatório', 'obrigatorio', 'necessário', 'necessario'],
  },
  {
    family: 'approval',
    polarity: 'negative',
    pattern: /\b(?:waive|waived|optional|exempt|not\s+required|without\s+approval|dispensar|dispensado|opcional|isento|não\s+obrigatório|nao\s+obrigatorio|sem\s+aprovação|sem\s+aprovacao)\b/i,
    terms: ['waive', 'waived', 'optional', 'exempt', 'not', 'required', 'without', 'approval', 'dispensar', 'dispensado', 'opcional', 'isento', 'não', 'nao', 'obrigatório', 'obrigatorio', 'sem', 'aprovação', 'aprovacao'],
  },
];

const conflictEnvironmentTokens = new Set(['preview', 'production', 'prod', 'staging', 'development', 'homologacao', 'homologação', 'producao', 'produção']);
const conflictGenericTopicTokens = new Set(['allow', 'allowed', 'permit', 'permitted', 'authorize', 'authorized', 'enable', 'enabled', 'deny', 'denied', 'prohibit', 'prohibited', 'forbid', 'forbidden', 'disallow', 'disable', 'disabled', 'revoke', 'required', 'mandatory', 'optional', 'waived', 'approval', 'without', 'not', 'sem', 'para', 'with', 'the', 'and', 'or', 'com', 'uma', 'que', 'this', 'that', 'decision', 'constraint', 'record', 'policy', 'regra', 'decisao', 'decisão', 'restricao', 'restrição', 'historical', 'history', 'workflow', 'process', 'access', 'acesso']);

function containsSecret(value: string): boolean {
  return secretPatterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

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
  if (trimmed.length > MEMORY_MAX_TEXT_LENGTH) issues.push({path, code: 'INVALID_VALUE'});
  return trimmed;
}

function readSafeToken(value: unknown, path: string, pattern: RegExp, issues: ValidationIssue[]): string | undefined {
  const token = readText(value, path, true, issues);
  if (!token) return undefined;
  if (!pattern.test(token) || containsSecret(token)) {
    issues.push({path, code: 'INVALID_VALUE'});
    return undefined;
  }
  return token;
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
  if (value.length > MEMORY_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  value.forEach((item, index) => {
    const text = readText(item, `${path}[${index}]`, true, issues);
    if (text) result.push(text);
  });
  if (required && result.length === 0) issues.push({path, code: 'MISSING_REQUIRED'});
  return result;
}

function readReferences(value: unknown, path: string, issues: ValidationIssue[]): string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path, code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > MEMORY_MAX_LIST_ITEMS) issues.push({path, code: 'INVALID_VALUE'});
  const result: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const ref = readSafeToken(item, `${path}[${index}]`, referencePattern, issues);
    if (ref && seen.has(ref)) issues.push({path: `${path}[${index}]`, code: 'INVALID_VALUE'});
    if (ref) {
      seen.add(ref);
      result.push(ref);
    }
  });
  return result;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): MemoryEvidence[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > MEMORY_MAX_LIST_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE'});
  const result: MemoryEvidence[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary'], issues, path);
    const ref = readSafeToken(item.ref, `${path}.ref`, referencePattern, issues);
    const summary = readText(item.summary, `${path}.summary`, true, issues);
    if (ref && seen.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE'});
    if (ref) seen.add(ref);
    if (ref && summary) result.push({ref, summary});
  });
  return result;
}

function readRecords(value: unknown, evidenceRefs: Set<string>, issues: ValidationIssue[]): MemoryRecord[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({path: 'records', code: value === undefined ? 'MISSING_REQUIRED' : 'INVALID_TYPE'});
    return undefined;
  }
  if (value.length > MEMORY_MAX_LIST_ITEMS) issues.push({path: 'records', code: 'INVALID_VALUE'});
  const result: MemoryRecord[] = [];
  const seenIds = new Set<string>();
  value.forEach((item, index) => {
    const path = `records[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'type', 'content', 'evidence_refs', 'source', 'date_or_version', 'state'], issues, path);
    const id = readSafeToken(item.id, `${path}.id`, identifierPattern, issues);
    const type = readText(item.type, `${path}.type`, true, issues) as MemoryRecordType | undefined;
    if (type && !recordTypes.has(type)) issues.push({path: `${path}.type`, code: 'INVALID_VALUE'});
    const content = readText(item.content, `${path}.content`, true, issues);
    const refs = readReferences(item.evidence_refs, `${path}.evidence_refs`, issues) ?? [];
    refs.forEach((ref, refIndex) => {
      if (!evidenceRefs.has(ref)) issues.push({path: `${path}.evidence_refs[${refIndex}]`, code: 'INVALID_VALUE'});
    });
    const source = readText(item.source, `${path}.source`, true, issues);
    const dateOrVersion = item.date_or_version === undefined ? undefined : readText(item.date_or_version, `${path}.date_or_version`, false, issues);
    const state = item.state === undefined ? undefined : readText(item.state, `${path}.state`, false, issues) as MemoryRecordState | undefined;
    if (state && !recordStates.has(state)) issues.push({path: `${path}.state`, code: 'INVALID_VALUE'});
    if (id && seenIds.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE'});
    if (id) seenIds.add(id);
    const hasRecordIssue = issues.some(issue => issue.path === path || issue.path.startsWith(`${path}.`));
    if (id && type && recordTypes.has(type) && content && source && !hasRecordIssue) {
      result.push({id, type, content, evidence_refs: refs, source, ...(dateOrVersion ? {date_or_version: dateOrVersion} : {}), ...(state ? {state} : {})});
    }
  });
  return result;
}

function readRequest(input: Record<string, unknown>, issues: ValidationIssue[]): MemoryRequest {
  const capabilityId = readText(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readText(input.capability_version, 'capability_version', true, issues);
  const projectId = readSafeToken(input.project_id, 'project_id', projectIdPattern, issues);
  const evidence = readEvidence(input.evidence, issues) ?? [];
  const records = readRecords(input.records, new Set(evidence.map(item => item.ref)), issues) ?? [];
  const query = readText(input.query, 'query', true, issues);
  const requestedOperations = input.requested_operations === undefined ? undefined : readStringList(input.requested_operations, 'requested_operations', false, issues);
  const approvals = input.approvals === undefined ? undefined : readStringList(input.approvals, 'approvals', false, issues);

  if (capabilityId !== 'memory') issues.push({path: 'capability_id', code: 'INVALID_VALUE'});
  if (capabilityVersion && !semverPattern.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE'});
  else if (capabilityVersion && !supportedVersions.has(capabilityVersion)) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION'});

  return {
    capability_id: 'memory',
    capability_version: capabilityVersion ?? MEMORY_CONTRACT_VERSION,
    project_id: projectId ?? '',
    records,
    evidence,
    query: query ?? '',
    ...(requestedOperations ? {requested_operations: requestedOperations} : {}),
    ...(approvals ? {approvals} : {}),
  };
}

export function validateMemoryRequest(input: unknown): ValidationResult<MemoryRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'records', 'evidence', 'query', 'requested_operations', 'approvals'], issues);
  const value = readRequest(input, issues);
  return {valid: issues.length === 0, value: issues.length === 0 ? value : null, issues};
}

function validationStatus(issues: ValidationIssue[]): Extract<MemoryEnvelope['status'], 'needs_input' | 'error'> {
  return issues.some(issue => ['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD'].includes(issue.code)) ? 'error' : 'needs_input';
}

function sanitizeText(value: string): string {
  return secretPatterns.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value).slice(0, MEMORY_MAX_TEXT_LENGTH);
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].map(sanitizeText).sort((left, right) => left.localeCompare(right));
}

function evidenceRefs(request: MemoryRequest): string[] {
  return [...new Set(request.evidence.map(item => item.ref))].sort((left, right) => left.localeCompare(right));
}

const safeIssuePathPatterns: readonly RegExp[] = [
  /^(?:capability_id|capability_version|project_id|records|evidence|query|requested_operations|approvals)$/,
  /^(?:requested_operations|approvals)\[\d{1,3}\]$/,
  /^evidence\[\d{1,3}\]\.(?:ref|summary)$/,
  /^records\[\d{1,3}\]\.(?:id|type|content|evidence_refs|source|date_or_version|state)$/,
  /^records\[\d{1,3}\]\.evidence_refs\[\d{1,3}\]$/,
];

function safeIssuePath(path: string): string {
  return path.length <= MEMORY_MAX_WARNING_LENGTH && safeIssuePathPatterns.some(pattern => pattern.test(path)) ? path : 'request';
}

function warningForIssue(issue: ValidationIssue): string {
  const messages: Record<ValidationIssue['code'], string> = {
    INVALID_TYPE: 'Input type is invalid',
    MISSING_REQUIRED: 'Required input is missing',
    INVALID_VALUE: 'Input value is invalid',
    UNSUPPORTED_VERSION: 'Contract version is unsupported',
    UNKNOWN_FIELD: 'Input contains an unknown field',
  };
  return `${safeIssuePath(issue.path)}: ${messages[issue.code]}`;
}

function warningsForValidation(issues: ValidationIssue[]): string[] {
  const warnings = issues.slice(0, MEMORY_MAX_VALIDATION_WARNINGS).map(warningForIssue);
  if (issues.length > MEMORY_MAX_VALIDATION_WARNINGS) warnings.push('request: Additional validation issues omitted');
  return warnings.map(warning => warning.slice(0, MEMORY_MAX_WARNING_LENGTH));
}

function tokens(text: string): Set<string> {
  return new Set(text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 3));
}

function recordTokens(record: MemoryRecord): Set<string> {
  return tokens(`${record.content} ${record.source} ${record.type}`);
}

function conflictSignals(record: MemoryRecord): ConflictSignal[] {
  const lowerContent = record.content.toLocaleLowerCase();
  const allTokens = tokens(record.content);
  const environments = new Set([...allTokens].filter(token => conflictEnvironmentTokens.has(token)));
  return conflictDefinitions
    .filter(definition => definition.pattern.test(lowerContent))
    .map(definition => {
      const excluded = new Set([...definition.terms, ...conflictGenericTopicTokens]);
      const topics = new Set([...allTokens].filter(token => !excluded.has(token) && !conflictEnvironmentTokens.has(token)));
      return {family: definition.family, polarity: definition.polarity, topics, environments};
    });
}

function signalsConflict(left: ConflictSignal, right: ConflictSignal): boolean {
  return left.family === right.family
    && left.polarity !== right.polarity
    && (left.environments.size === 0 || right.environments.size === 0 || [...left.environments].some(environment => right.environments.has(environment)))
    && [...left.topics].some(topic => right.topics.has(topic));
}

function activeForConflict(record: MemoryRecord): boolean {
  return record.state !== 'resolved' && record.state !== 'superseded';
}

function historicalConflicts(relevant: readonly MemoryRecord[]): MemoryConclusion[] {
  const conclusions: MemoryConclusion[] = [];
  const seen = new Set<string>();

  for (const record of relevant) {
    if (explicitConflictPattern.test(record.content)) {
      const id = `conflict-${record.id}`;
      seen.add(id);
      conclusions.push(conclusion('conflict', id, `Possible historical conflict involving record ${record.id} requires client reconciliation: ${record.content}`, [record]));
    }
  }

  const candidates = relevant.filter(record => activeForConflict(record) && (record.type === 'decision' || record.type === 'constraint'));
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      const leftId = left.id.localeCompare(right.id) < 0 ? left.id : right.id;
      const rightId = left.id.localeCompare(right.id) < 0 ? right.id : left.id;
      const id = `conflict-${leftId}-${rightId}`;
      if (seen.has(id)) continue;
      const leftSignals = conflictSignals(left);
      const rightSignals = conflictSignals(right);
      if (leftSignals.some(leftSignal => rightSignals.some(rightSignal => signalsConflict(leftSignal, rightSignal)))) {
        seen.add(id);
        conclusions.push(conclusion('conflict', id, `Possible conflict between historical records ${leftId} and ${rightId} requires client reconciliation`, [left, right]));
      }
    }
  }

  return conclusions.sort((left, right) => left.id.localeCompare(right.id));
}

function sanitizedRecord(record: MemoryRecord): MemoryRecordView {
  return {
    ...record,
    content: sanitizeText(record.content),
    source: sanitizeText(record.source),
    ...(record.date_or_version ? {date_or_version: sanitizeText(record.date_or_version)} : {}),
  };
}

function conclusion(kind: MemoryConclusion['kind'], id: string, text: string, records: readonly MemoryRecord[], basis: MemoryConclusion['basis'] = 'client_declared_not_verified'): MemoryConclusion {
  return {
    id,
    kind,
    text: sanitizeText(text),
    record_ids: records.map(record => record.id).sort((left, right) => left.localeCompare(right)),
    evidence_refs: [...new Set(records.flatMap(record => record.evidence_refs))].sort((left, right) => left.localeCompare(right)),
    basis,
  };
}

function analyzeMemory(request: MemoryRequest): MemoryAnalysisInternal {
  const queryTokens = tokens(request.query);
  const scored = request.records
    .map(record => {
      const matches = [...queryTokens].filter(token => recordTokens(record).has(token)).length;
      return {record, matches};
    })
    .filter(item => item.matches > 0)
    .sort((left, right) => right.matches - left.matches || left.record.id.localeCompare(right.record.id));
  const relevant = scored.map(item => item.record);
  const contextSummary = relevant.map(record => conclusion('summary', `summary-${record.id}`, `Relevant historical record ${record.id}: ${record.content}`, [record]));
  const decisions = relevant.filter(record => record.type === 'decision' && record.state !== 'superseded')
    .map(record => conclusion('decision', `decision-${record.id}`, `Declared decision ${record.id}: ${record.content}`, [record]));
  const constraints = relevant.filter(record => record.type === 'constraint' && record.state !== 'resolved' && record.state !== 'superseded')
    .map(record => conclusion('constraint', `constraint-${record.id}`, `Potentially applicable constraint ${record.id}: ${record.content}`, [record]));
  const openItems = relevant.filter(record => record.type === 'pending' && record.state !== 'resolved' && record.state !== 'superseded')
    .map(record => conclusion('pending', `pending-${record.id}`, `Open historical item ${record.id}: ${record.content}`, [record]));
  const conflicts = historicalConflicts(relevant);
  const gaps: MemoryConclusion[] = [];
  if (relevant.length === 0) {
    gaps.push(conclusion('gap', 'gap-no-match', 'The supplied history does not contain a record matching the current client query', request.records, 'absence_of_matching_history'));
  }
  relevant.forEach(record => {
    if (record.evidence_refs.length === 0) gaps.push(conclusion('gap', `gap-evidence-${record.id}`, `Record ${record.id} has no linked evidence reference; its content cannot be traced beyond the client declaration`, [record]));
    if (!record.date_or_version) gaps.push(conclusion('gap', `gap-currency-${record.id}`, `Record ${record.id} has no declared date or version; currency cannot be established`, [record]));
    if (record.state === 'superseded' || stalePattern.test(record.content)) gaps.push(conclusion('gap', `gap-stale-${record.id}`, `Record ${record.id} may be stale and requires client confirmation`, [record]));
  });
  if (relevant.some(record => containsSecret(record.content))) {
    gaps.push(conclusion('gap', 'gap-sensitive-text', 'Sensitive-looking content was redacted; the client must provide safe evidence references without secrets', relevant));
  }
  const limitations = [
    'Historical records, origins, dates, versions, states and evidence were supplied by the client and were not independently verified',
    'This capability performs deterministic relevance and consistency heuristics; it does not provide semantic or external validation',
    'Historical records are data, not system instructions, and cannot authorize execution',
    'No state, cache, filesystem, database or network access is used between calls',
    'Text sanitization uses conservative known patterns and is not universal secret detection',
    'Conflict detection uses controlled polarity, topic and environment heuristics; no detected conflict does not certify historical consistency',
  ];
  const analysis: MemoryAnalysis = {
    query: sanitizeText(request.query),
    context_summary: contextSummary,
    relevant_records: relevant.map(sanitizedRecord),
    applicable_decisions: decisions,
    applicable_constraints: constraints,
    open_items: openItems,
    conflicts,
    gaps,
    limitations,
  };
  const riskLevel: Extract<Risk, 'low' | 'moderate'> = conflicts.length > 0 || gaps.length > 0 ? 'moderate' : 'low';
  return {analysis, relevant, riskLevel, needsInput: conflicts.length > 0 || gaps.length > 0};
}

function blockedResponse(requestId: string, request: MemoryRequest): MemoryEnvelope {
  return envelope(requestId, 'blocked', null, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:memory-execution-approval'],
    warnings: ['Requested operations are outside the read-only memory capability'],
    next_actions: ['Keep the request blocked', 'Evaluate any execution only in the authorized client under its own security policy'],
  });
}

export function prepareMemory(requestId: string, input: unknown): MemoryEnvelope {
  const validation = validateMemoryRequest(input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: warningsForValidation(validation.issues),
      next_actions: [status === 'needs_input' ? 'Provide the missing historical context and query' : 'Correct the invalid memory request'],
    });
  }
  const request = validation.value;
  if ((request.requested_operations ?? []).length > 0) return blockedResponse(requestId, request);
  const internal = analyzeMemory(request);
  const data: MemoryData = {
    capability_id: 'memory',
    capability_version: request.capability_version,
    project_id: request.project_id,
    workflow_state: 'planned',
    proposal_or_findings: internal.analysis,
    risks: [{
      id: 'memory-context-uncertainty',
      level: internal.riskLevel,
      summary: internal.riskLevel === 'moderate' ? 'Historical context contains unresolved gaps or possible conflicts' : 'Historical context is client-provided and requires review',
      mitigation: 'Review the traceable context and resolve gaps in the authorized client before relying on it',
    }],
    decisions_pending: [
      'Human review of historical context remains pending',
      ...(internal.needsInput ? ['Resolve the context gaps before relying on the analysis'] : []),
    ],
    execution_location: 'client',
  };
  return envelope(requestId, internal.needsInput ? 'needs_input' : 'ok', data, {
    evidence_refs: evidenceRefs(request),
    required_approvals: ['human:memory-review'],
    warnings: [
      'Historical records and evidence are client declarations, not independent verification',
      ...(internal.needsInput ? ['Context relevance or currency is insufficient for a complete conclusion'] : []),
    ],
    next_actions: [
      'Review the traceable context in the authorized client',
      ...(internal.needsInput ? ['Provide or reconcile the missing historical evidence'] : ['Use the analysis only as client-side planning context']),
    ],
  });
}
