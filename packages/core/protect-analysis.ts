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
  validationStatus,
} from './f5-contracts.js';

export const PROTECT_CONTRACT_VERSION = F5_CONTRACT_VERSION;
export const PROTECT_MAX_ITEMS = 100;
export const PROTECT_MAX_TEXT_LENGTH = 20_000;

export type ProtectOperationKind = 'destructive' | 'financial' | 'access' | 'credentials' | 'deploy' | 'production' | 'other';
export type ProtectVerificationStatus = 'declared' | 'missing' | 'recommended';

export interface ProtectEvidence extends CapabilityEvidence {
  source?: string;
}

export interface ProtectAsset {
  id: string;
  description: string;
  impact: Risk;
  evidence_refs: string[];
}

export interface ProtectOperation {
  id: string;
  kind: ProtectOperationKind;
  description: string;
  consequences: string;
  evidence_refs: string[];
}

export interface ProtectControl {
  id: string;
  description: string;
  verification_status: ProtectVerificationStatus;
  independently_verified: false;
  evidence_refs: string[];
}

export interface ProtectRisk {
  id: string;
  level: Risk;
  category: string;
  summary: string;
  evidence_refs: string[];
  verification_status: 'identified' | 'unverified';
}

export interface ProtectAssessment {
  overall_risk: Risk;
  assets: ProtectAsset[];
  operations: ProtectOperation[];
  controls: ProtectControl[];
  risks: ProtectRisk[];
  gaps: string[];
  recommendations: string[];
  limitations: string[];
}

export interface ProtectControlInput {
  id: string;
  description: string;
  verification_status?: 'declared' | 'independently_verified';
  evidence_refs?: string[];
}

export interface ProtectRequest extends Omit<CapabilityRequest, 'evidence'> {
  capability_id: 'protect';
  evidence: ProtectEvidence[];
  assets?: ProtectAsset[];
  operations?: ProtectOperation[];
  context?: string;
  declared_controls?: ProtectControlInput[];
  mitigations?: string[];
  pending_verification?: string[];
}

interface ParsedBase {
  base: Omit<CapabilityRequest, 'evidence'> | null;
  evidence: ProtectEvidence[];
  requested_operations: string[];
  approvals: string[];
}

const riskSet = new Set<Risk>(['low', 'moderate', 'critical']);
const operationKindSet = new Set<ProtectOperationKind>(['destructive', 'financial', 'access', 'credentials', 'deploy', 'production', 'other']);
const malformedCodes = new Set(['INVALID_TYPE', 'INVALID_VALUE', 'UNSUPPORTED_VERSION', 'UNKNOWN_FIELD']);
const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const projectIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(value: Record<string, unknown>, fields: readonly string[], issues: ValidationIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) issues.push({path: key, code: 'UNKNOWN_FIELD', message: `Unknown field: ${key}`});
  }
}

function looksSensitive(value: string): boolean {
  return /authorization\s*:\s*bearer|\b(?:token|secret|password|api[_-]?key)\s*[:=]|\b(?:eyJ[a-z0-9_-]{8,}|sk-[a-z0-9_-]{8,}|ghp_[a-z0-9_-]{8,}|github_pat_[a-z0-9_-]{8,}|vercel_[a-z0-9_-]{8,})\b/i.test(value);
}

function readBoundedText(value: unknown, path: string, issues: ValidationIssue[], required = true): string | undefined {
  const text = readString(value, path, required, issues);
  if (text && text.length > PROTECT_MAX_TEXT_LENGTH) issues.push({path, code: 'INVALID_VALUE', message: `${path} exceeds the maximum text length`});
  return text;
}

function readOptionalText(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) return undefined;
  return readBoundedText(value, path, issues, false);
}

function readStrictIdentifier(value: unknown, path: string, issues: ValidationIssue[], label: string): string | undefined {
  const text = readBoundedText(value, path, issues);
  if (!text) return undefined;
  if (!identifierPattern.test(text) || looksSensitive(text)) {
    issues.push({path, code: 'INVALID_VALUE', message: `${label} has an invalid format`});
    return undefined;
  }
  return text;
}

function readStrictReference(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const text = readBoundedText(value, path, issues);
  if (!text) return undefined;
  if (!referencePattern.test(text) || looksSensitive(text)) {
    issues.push({path, code: 'INVALID_VALUE', message: 'Reference has an invalid format'});
    return undefined;
  }
  return text;
}

function readReferenceList(value: unknown, path: string, issues: ValidationIssue[], required = false): string[] {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be an array of references`});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path, code: 'INVALID_VALUE', message: `${path} contains too many items`});
  const refs: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const ref = readStrictReference(item, `${path}[${index}]`, issues);
    if (ref && seen.has(ref)) issues.push({path: `${path}[${index}]`, code: 'INVALID_VALUE', message: 'References must be unique'});
    if (ref) {
      seen.add(ref);
      refs.push(ref);
    }
  });
  if (required && refs.length === 0) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} must contain at least one reference`});
  return refs;
}

function readStringList(value: unknown, path: string, issues: ValidationIssue[], required = false): string[] {
  if (value === undefined) {
    if (required) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} is required`});
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({path, code: 'INVALID_TYPE', message: `${path} must be an array of strings`});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path, code: 'INVALID_VALUE', message: `${path} contains too many items`});
  const values: string[] = [];
  value.forEach((item, index) => {
    const text = readBoundedText(item, `${path}[${index}]`, issues);
    if (text) values.push(text);
  });
  if (required && values.length === 0) issues.push({path, code: 'MISSING_REQUIRED', message: `${path} must contain at least one item`});
  return values;
}

function readEvidence(value: unknown, issues: ValidationIssue[]): ProtectEvidence[] {
  if (value === undefined) {
    issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'evidence is required'});
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({path: 'evidence', code: 'INVALID_TYPE', message: 'evidence must be an array'});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path: 'evidence', code: 'INVALID_VALUE', message: 'evidence contains too many items'});
  const evidence: ProtectEvidence[] = [];
  const refs = new Set<string>();
  value.forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Evidence must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['ref', 'summary', 'source'], issues);
    const ref = readStrictReference(item.ref, `${path}.ref`, issues);
    const summary = readBoundedText(item.summary, `${path}.summary`, issues);
    const source = readOptionalText(item.source, `${path}.source`, issues);
    if (ref && refs.has(ref)) issues.push({path: `${path}.ref`, code: 'INVALID_VALUE', message: 'Evidence refs must be unique'});
    if (ref) refs.add(ref);
    if (ref && summary) evidence.push({ref, summary, ...(source ? {source} : {})});
  });
  if (evidence.length === 0) issues.push({path: 'evidence', code: 'MISSING_REQUIRED', message: 'At least one evidence item is required'});
  return evidence;
}

function readAssets(value: unknown, issues: ValidationIssue[]): ProtectAsset[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'assets', code: 'INVALID_TYPE', message: 'assets must be an array'});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path: 'assets', code: 'INVALID_VALUE', message: 'assets contains too many items'});
  const assets: ProtectAsset[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `assets[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Asset must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'description', 'impact', 'evidence_refs'], issues);
    const id = readStrictIdentifier(item.id, `${path}.id`, issues, 'Asset id');
    const description = readBoundedText(item.description, `${path}.description`, issues);
    const impact = readBoundedText(item.impact, `${path}.impact`, issues) as Risk | undefined;
    const evidenceRefs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, issues);
    if (impact && !riskSet.has(impact)) issues.push({path: `${path}.impact`, code: 'INVALID_VALUE', message: 'Unsupported risk level'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Asset ids must be unique'});
    if (id) ids.add(id);
    if (id && description && impact && riskSet.has(impact)) assets.push({id, description, impact, evidence_refs: evidenceRefs});
  });
  return assets;
}

function readOperations(value: unknown, issues: ValidationIssue[]): ProtectOperation[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'operations', code: 'INVALID_TYPE', message: 'operations must be an array'});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path: 'operations', code: 'INVALID_VALUE', message: 'operations contains too many items'});
  const operations: ProtectOperation[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `operations[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Operation must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'kind', 'description', 'consequences', 'evidence_refs'], issues);
    const id = readStrictIdentifier(item.id, `${path}.id`, issues, 'Operation id');
    const kind = readBoundedText(item.kind, `${path}.kind`, issues) as ProtectOperationKind | undefined;
    const description = readBoundedText(item.description, `${path}.description`, issues);
    const consequences = readBoundedText(item.consequences, `${path}.consequences`, issues);
    const evidenceRefs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, issues);
    if (kind && !operationKindSet.has(kind)) issues.push({path: `${path}.kind`, code: 'INVALID_VALUE', message: 'Unsupported operation kind'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Operation ids must be unique'});
    if (id) ids.add(id);
    if (id && kind && description && consequences && operationKindSet.has(kind)) operations.push({id, kind, description, consequences, evidence_refs: evidenceRefs});
  });
  return operations;
}

function readControls(value: unknown, issues: ValidationIssue[]): ProtectControlInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({path: 'declared_controls', code: 'INVALID_TYPE', message: 'declared_controls must be an array'});
    return [];
  }
  if (value.length > PROTECT_MAX_ITEMS) issues.push({path: 'declared_controls', code: 'INVALID_VALUE', message: 'declared_controls contains too many items'});
  const controls: ProtectControlInput[] = [];
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `declared_controls[${index}]`;
    if (!isRecord(item)) {
      issues.push({path, code: 'INVALID_TYPE', message: 'Control must be an object'});
      return;
    }
    hasOnlyKnownFields(item, ['id', 'description', 'verification_status', 'evidence_refs'], issues);
    const id = readStrictIdentifier(item.id, `${path}.id`, issues, 'Control id');
    const description = readBoundedText(item.description, `${path}.description`, issues);
    const status = item.verification_status === undefined ? undefined : readBoundedText(item.verification_status, `${path}.verification_status`, issues) as ProtectControlInput['verification_status'] | undefined;
    const evidenceRefs = readReferenceList(item.evidence_refs, `${path}.evidence_refs`, issues);
    if (status && status !== 'declared' && status !== 'independently_verified') issues.push({path: `${path}.verification_status`, code: 'INVALID_VALUE', message: 'Unsupported control verification status'});
    if (id && ids.has(id)) issues.push({path: `${path}.id`, code: 'INVALID_VALUE', message: 'Control ids must be unique'});
    if (id) ids.add(id);
    if (id && description && (!status || status === 'declared' || status === 'independently_verified')) controls.push({id, description, ...(status ? {verification_status: status} : {}), ...(evidenceRefs.length > 0 ? {evidence_refs: evidenceRefs} : {})});
  });
  return controls;
}

function parseBase(input: Record<string, unknown>, issues: ValidationIssue[]): ParsedBase {
  const capabilityId = readString(input.capability_id, 'capability_id', true, issues);
  const capabilityVersion = readString(input.capability_version, 'capability_version', true, issues);
  const projectId = readString(input.project_id, 'project_id', true, issues);
  const mode = input.mode === undefined ? undefined : readString(input.mode, 'mode', true, issues) as CapabilityRequest['mode'];
  const evidence = readEvidence(input.evidence, issues);
  const requestedOperations = input.requested_operations === undefined ? [] : readStringList(input.requested_operations, 'requested_operations', issues);
  const approvals = input.approvals === undefined ? [] : readStringList(input.approvals, 'approvals', issues);
  if (capabilityId && capabilityId !== 'protect') issues.push({path: 'capability_id', code: 'INVALID_VALUE', message: 'Protect requests must use capability_id=protect'});
  if (capabilityVersion && !/^\d+\.\d+\.\d+$/.test(capabilityVersion)) issues.push({path: 'capability_version', code: 'INVALID_VALUE', message: 'capability_version must use semantic versioning'});
  else if (capabilityVersion && capabilityVersion !== F5_CONTRACT_VERSION) issues.push({path: 'capability_version', code: 'UNSUPPORTED_VERSION', message: 'Unsupported F5 contract version'});
  if (projectId && (!projectIdPattern.test(projectId) || looksSensitive(projectId))) issues.push({path: 'project_id', code: 'INVALID_VALUE', message: 'project_id has an invalid format'});
  if (mode && !['new', 'existing', 'recovery'].includes(mode)) issues.push({path: 'mode', code: 'INVALID_VALUE', message: 'mode must be new, existing or recovery'});
  return {
    base: capabilityId && capabilityVersion && projectId ? {
      capability_id: 'protect',
      capability_version: capabilityVersion,
      project_id: projectId,
      ...(mode ? {mode} : {}),
      ...(requestedOperations.length > 0 ? {requested_operations: requestedOperations} : {}),
      ...(approvals.length > 0 ? {approvals} : {}),
    } : null,
    evidence,
    requested_operations: requestedOperations,
    approvals,
  };
}

export function validateProtectRequest(input: unknown): ValidationResult<ProtectRequest> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return {valid: false, value: null, issues: [{path: '', code: 'INVALID_TYPE', message: 'Request must be an object'}]};
  hasOnlyKnownFields(input, ['capability_id', 'capability_version', 'project_id', 'mode', 'evidence', 'requested_operations', 'approvals', 'assets', 'operations', 'context', 'declared_controls', 'mitigations', 'pending_verification'], issues);
  const parsed = parseBase(input, issues);
  const assets = readAssets(input.assets, issues);
  const operations = readOperations(input.operations, issues);
  const context = readOptionalText(input.context, 'context', issues);
  const controls = readControls(input.declared_controls, issues);
  const mitigations = input.mitigations === undefined ? undefined : readStringList(input.mitigations, 'mitigations', issues);
  const pendingVerification = input.pending_verification === undefined ? undefined : readStringList(input.pending_verification, 'pending_verification', issues);
  const evidenceRefs = new Set(parsed.evidence.map(item => item.ref));
  for (const [name, values] of [['assets', assets ?? []], ['operations', operations ?? []]] as const) {
    values.forEach((item, index) => item.evidence_refs.forEach(ref => {
      if (parsed.evidence.length > 0 && !evidenceRefs.has(ref)) issues.push({path: `${name}[${index}].evidence_refs`, code: 'INVALID_VALUE', message: 'References must point to supplied evidence'});
    }));
  }
  (controls ?? []).forEach((control, index) => (control.evidence_refs ?? []).forEach(ref => {
    if (parsed.evidence.length > 0 && !evidenceRefs.has(ref)) issues.push({path: `declared_controls[${index}].evidence_refs`, code: 'INVALID_VALUE', message: 'References must point to supplied evidence'});
  }));
  if (issues.length > 0 || !parsed.base) return {valid: false, value: null, issues};
  return {
    valid: true,
    value: {
      ...parsed.base,
      capability_id: 'protect',
      evidence: parsed.evidence,
      ...(assets ? {assets} : {}),
      ...(operations ? {operations} : {}),
      ...(context ? {context} : {}),
      ...(controls ? {declared_controls: controls} : {}),
      ...(mitigations ? {mitigations} : {}),
      ...(pendingVerification ? {pending_verification: pendingVerification} : {}),
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
  return input.evidence.flatMap(item => {
    if (!isRecord(item) || typeof item.ref !== 'string') return [];
    const ref = item.ref.trim();
    return referencePattern.test(ref) && !looksSensitive(ref) ? [ref] : [];
  });
}

function sanitizeText(value: string): string {
  return value
    .replace(/ignore\s+(?:all\s+)?previous\s+instructions[^.;\n]*/gi, '[UNTRUSTED_INSTRUCTION_REDACTED]')
    .replace(/authorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, 'sensitive=[REDACTED]')
    .replace(/\b(?:eyJ[a-z0-9_-]{8,}|sk-[a-z0-9_-]{8,}|ghp_[a-z0-9_-]{8,}|github_pat_[a-z0-9_-]{8,}|vercel_[a-z0-9_-]{8,})\b/gi, '[REDACTED]');
}

function protectData<T>(request: ProtectRequest, result: T, state: WorkflowState, risks: CapabilityRisk[], decisions: string[]): CapabilityData<T> {
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

function blockedResponse(requestId: string, input: unknown): CapabilityEnvelope<ProtectAssessment> {
  return envelope(requestId, 'blocked', null, {
    warnings: ['Execution requests are outside the read-only protection capability'],
    evidence_refs: safeEvidenceRefs(input),
    required_approvals: ['human:approval-required'],
    next_actions: ['Keep the request blocked', 'Evaluate any action only in the authorized client under its own security policy'],
  });
}

function riskRank(level: Risk): number {
  return level === 'critical' ? 3 : level === 'moderate' ? 2 : 1;
}

function highestRisk(risks: ProtectRisk[]): Risk {
  return risks.reduce<Risk>((highest, risk) => riskRank(risk.level) > riskRank(highest) ? risk.level : highest, 'low');
}

function operationCategory(operation: ProtectOperation): {category: string; level: Risk} | null {
  const text = `${operation.kind} ${operation.description} ${operation.consequences}`.toLowerCase();
  if (operation.kind === 'destructive' || /delete|destroy|drop|wipe|purge|rollback|migrat|overwrite/.test(text)) return {category: 'destructive', level: 'critical'};
  if (operation.kind === 'credentials' || /credential|secret|token|password|rotate\s+keys?|api\s*key/.test(text)) return {category: 'credentials', level: 'critical'};
  if (operation.kind === 'production' || /production|promote|release\s+(?:to|into)\s+production/.test(text)) return {category: 'production', level: 'critical'};
  if (operation.kind === 'deploy' || /deploy|publish/.test(text)) return {category: 'deploy', level: 'moderate'};
  if (operation.kind === 'financial' || /payment|financial|billing|transfer/.test(text)) return {category: 'financial', level: 'moderate'};
  if (operation.kind === 'access' || /permission|access|privilege|admin/.test(text)) return {category: 'access', level: 'moderate'};
  return null;
}

function buildAssessment(request: ProtectRequest): {assessment: ProtectAssessment; status: 'ok' | 'needs_input'; risks: CapabilityRisk[]; decisions: string[]; nextActions: string[]} {
  const assets = [...(request.assets ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const operations = [...(request.operations ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const controls = [...(request.declared_controls ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const evidence = new Set(request.evidence.map(item => item.ref));
  const gaps: string[] = [];
  const risks: ProtectRisk[] = [];
  for (const asset of assets) {
    risks.push({id: `asset-${asset.id}`, level: asset.impact, category: 'asset-impact', summary: `Asset impact was declared as ${asset.impact}`, evidence_refs: asset.evidence_refs, verification_status: 'unverified'});
  }
  const assessmentOperations = operations.map(operation => ({...operation, description: sanitizeText(operation.description), consequences: sanitizeText(operation.consequences)}));
  for (const operation of assessmentOperations) {
    const classification = operationCategory(operation);
    if (classification) risks.push({id: `operation-${operation.id}`, level: classification.level, category: classification.category, summary: `A ${classification.category} operation is described for analysis; no execution was requested by this assessment`, evidence_refs: operation.evidence_refs, verification_status: 'unverified'});
  }
  const assessmentControls: ProtectControl[] = controls.map(control => {
    if (control.verification_status === 'independently_verified') gaps.push(`Control ${control.id} is a client declaration and was not independently verified`);
    return {id: control.id, description: sanitizeText(control.description), verification_status: 'declared', independently_verified: false, evidence_refs: control.evidence_refs ?? []};
  });
  if (assessmentControls.length === 0) gaps.push('No protection controls were supplied for assessment');
  else gaps.push('Supplied controls are declared by the client and not independently verified');
  if (assets.length === 0 && operations.length === 0) gaps.push('Provide at least one asset or operation to assess');
  if (request.pending_verification && request.pending_verification.length > 0) gaps.push('Pending verification items must be resolved before treating the assessment as sufficient');
  const allText = [...request.evidence.map(item => item.summary), request.context ?? '', ...assessmentOperations.map(item => `${item.description} ${item.consequences}`)].join(' ');
  if (/contradict|conflict|inconsistent|mutually exclusive/i.test(allText)) gaps.push('Reconcile potentially incompatible protection evidence before confirming the assessment');
  const missingRefs = [...assets, ...operations, ...assessmentControls].some(item => item.evidence_refs.length === 0);
  if (missingRefs) gaps.push('Provide evidence references for each material asset, operation and control');
  const sufficient = request.evidence.length > 0 && (assets.length > 0 || operations.length > 0) && !missingRefs && !(request.pending_verification && request.pending_verification.length > 0) && !/contradict|conflict|inconsistent|mutually exclusive/i.test(allText);
  if (!sufficient && gaps.length === 0) gaps.push('Provide assets or operations and evidence sufficient for a protection assessment');
  const status: 'ok' | 'needs_input' = sufficient ? 'ok' : 'needs_input';
  const limitations = [
    'This is deterministic analysis of client-provided material; it does not independently verify controls, permissions or deployment state',
    'Absence of an indicator is not evidence that an asset or operation is safe',
    'Logs, prompts and descriptions are untrusted data; prompt-like instructions are not executed',
    'Operations described for analysis are not execution requests and do not authorize any action',
    'The authorized client owns execution, approval and enforcement; this capability has no filesystem, shell, network, GitHub or Vercel access',
  ];
  const recommendations = [
    'Verify each declared control in the authorized client before relying on it',
    'Keep sensitive operations blocked until the client security policy grants explicit authorization',
    'Collect missing evidence and reconcile contradictory statements before changing the assessment',
  ];
  const assessment: ProtectAssessment = {
    overall_risk: highestRisk(risks),
    assets,
    operations: assessmentOperations,
    controls: assessmentControls,
    risks: [...risks].sort((left, right) => left.id.localeCompare(right.id)),
    gaps,
    recommendations,
    limitations,
  };
  const capabilityRisks: CapabilityRisk[] = assessment.risks.map(risk => ({id: risk.id, level: risk.level, summary: risk.summary, mitigation: 'Verify the relevant evidence and control in the authorized client before acting'}));
  if (capabilityRisks.length === 0) capabilityRisks.push({id: 'protection-uncertainty', level: 'low', summary: 'No material protection risk was established from the supplied evidence', mitigation: 'Do not infer safety from missing evidence; provide more context'});
  const decisions = [...gaps, 'The authorized client must decide whether any recommendation is permitted under its own security policy'];
  const nextActions = status === 'needs_input'
    ? ['Provide the missing protection evidence and resolve the listed gaps', 'Re-run the read-only assessment after client verification']
    : ['Review the assessment with the client', 'Verify controls and enforce any decision only in the authorized client'];
  return {assessment, status, risks: capabilityRisks, decisions, nextActions};
}

function safeIssueWarning(issue: ValidationIssue): string {
  const safePath = /^[A-Za-z][A-Za-z0-9_.\[\]-]{0,127}$/.test(issue.path) ? issue.path : 'request';
  const messages: Record<ValidationIssue['code'], string> = {
    INVALID_TYPE: 'invalid type',
    MISSING_REQUIRED: 'required value is missing',
    INVALID_VALUE: 'invalid value',
    UNSUPPORTED_VERSION: 'unsupported contract version',
    UNKNOWN_FIELD: 'unknown field',
  };
  return `${safePath}: ${messages[issue.code]}`;
}

export function prepareProtect(requestId: string, input: unknown): CapabilityEnvelope<ProtectAssessment> {
  const validation = validateProtectRequest(input);
  const operation = operationRequest(input);
  const hasMalformedInput = validation.issues.some(issue => malformedCodes.has(issue.code)) || !operation.valid;
  if (operation.valid && operation.operations.length > 0 && !hasMalformedInput) return blockedResponse(requestId, input);
  if (!validation.valid || !validation.value) {
    const status = validationStatus(validation.issues);
    return envelope(requestId, status, null, {
      warnings: validation.issues.map(safeIssueWarning),
      next_actions: [status === 'needs_input' ? 'Provide the missing protection inputs and evidence' : 'Correct the invalid protection request'],
    });
  }
  const result = buildAssessment(validation.value);
  const data = protectData(validation.value, result.assessment, 'planned', result.risks, result.decisions);
  return envelope(requestId, result.status, data, {
    evidence_refs: validation.value.evidence.map(item => item.ref),
    next_actions: result.nextActions,
    warnings: result.status === 'needs_input' ? result.assessment.gaps : [],
  });
}
