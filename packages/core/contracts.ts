export type Status = 'ok' | 'needs_input' | 'blocked' | 'error';
export type Risk = 'low' | 'moderate' | 'critical';
export type Mode = 'new' | 'existing' | 'recovery';
export type WorkflowState = 'draft'|'planned'|'awaiting_approval'|'running'|'verifying'|'completed'|'blocked'|'failed'|'cancelled';
export type ErrorCode = 'INVALID_INPUT'|'UNAUTHORIZED'|'FORBIDDEN'|'NOT_FOUND'|'VERSION_UNSUPPORTED'|'MISSING_EVIDENCE'|'CONFLICT'|'RATE_LIMITED'|'INTERNAL_ERROR';
export interface Envelope<T> { schema_version: '1.0'; request_id: string; status: Status; data: T|null; warnings: string[]; evidence_refs: string[]; required_approvals: string[]; next_actions: string[] }
export function envelope<T>(request_id: string, status: Status, data: T|null, options: Partial<Omit<Envelope<T>, 'schema_version'|'request_id'|'status'|'data'>> = {}): Envelope<T> {
 if (!request_id.trim()) throw new Error('INVALID_INPUT: request_id');
 return {schema_version:'1.0', request_id, status, data, warnings:options.warnings ?? [], evidence_refs:options.evidence_refs ?? [], required_approvals:options.required_approvals ?? [], next_actions:options.next_actions ?? []};
}
