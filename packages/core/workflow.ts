import type { WorkflowState } from './contracts.js';
const transitions: Record<WorkflowState, readonly WorkflowState[]> = {
 draft:['planned','blocked','cancelled'], planned:['awaiting_approval','running','blocked','cancelled'], awaiting_approval:['running','blocked','cancelled'], running:['verifying','blocked','failed','cancelled'], verifying:['completed','running','blocked','failed'], completed:[], blocked:['planned','cancelled'], failed:['planned','cancelled'], cancelled:[]
};
export function nextState(current:WorkflowState, target:WorkflowState, evidence:string[]=[]):WorkflowState {
 if (!transitions[current].includes(target)) throw new Error(`CONFLICT: ${current} -> ${target}`);
 if (target==='completed' && evidence.length===0) throw new Error('MISSING_EVIDENCE');
 return target;
}
