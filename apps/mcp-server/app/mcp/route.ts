import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { skillCatalog, getSkillById } from '../../lib/catalog';
import { envelope } from '../../../../packages/core/contracts';
import { startWorkflow, type StartWorkflowInput } from '../../../../packages/core/universal-flow';
import { currentRequestId, runWithRequestId } from '../../lib/request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler((server) => {
  server.registerTool('projectos_list_skills', {
    title: 'List ProjectOS skills',
    description: 'List published ProjectOS skills and their versions.',
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const response = envelope(currentRequestId(), 'ok', {skills: skillCatalog});
    return {content: [{type: 'text', text: JSON.stringify(response)}], structuredContent: response};
  });

  server.registerTool('projectos_get_skill', {
    title: 'Get ProjectOS skill',
    description: 'Read a versioned ProjectOS skill definition and instructions.',
    inputSchema: z.object({id: z.enum(['projectos.discover','projectos.plan','projectos.start'])}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({id}) => {
    const skill = getSkillById(id);
    if (!skill) {
      const response = envelope(currentRequestId(), 'error', null, {warnings: ['Skill not found']});
      return {isError: true, content: [{type: 'text', text: JSON.stringify(response)}], structuredContent: response};
    }
    const response = envelope(currentRequestId(), 'ok', {skill});
    return {content: [{type:'text',text:JSON.stringify(response)}], structuredContent: response};
  });

  server.registerTool('projectos_start_workflow', {
    title: 'Start ProjectOS workflow',
    description: 'Select a project mode and produce a read-only, evidence-backed workflow proposal.',
    inputSchema: z.object({
      project_id: z.string().trim().min(1).max(120).optional(),
      requested_mode: z.enum(['new', 'existing', 'recovery']).optional(),
      goal: z.string().trim().min(1).max(2000).optional(),
      scope: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
      constraints: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
      priority_requirements: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
      project_snapshot: z.object({
        structure: z.array(z.string().trim().min(1).max(500)).max(500).optional(),
        config_files: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
        technologies: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
        documentation: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
        git_status: z.string().trim().max(5000).optional(),
        tests: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
        risks: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
      }).strict().optional(),
      recovery: z.object({
        original_goal: z.string().trim().min(1).max(2000).optional(),
        last_known_state: z.string().trim().min(1).max(2000).optional(),
        pending_changes: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
        previous_decisions: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
        incomplete_work: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
        blockers: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
        next_steps: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
      }).strict().optional(),
      evidence: z.array(z.object({
        ref: z.string().trim().min(1).max(300),
        summary: z.string().trim().min(1).max(2000),
      }).strict()).max(100).optional(),
      requested_operations: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
      approvals: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input) => {
    const result = startWorkflow(input as StartWorkflowInput);
    const response = envelope(currentRequestId(), result.status, result.proposal, {
      evidence_refs: result.proposal.evidence_refs,
      required_approvals: result.proposal.required_approvals,
      next_actions: result.proposal.next_actions,
    });
    return {content: [{type: 'text', text: JSON.stringify(response)}], structuredContent: response};
  });
}, {serverInfo: {name: 'ProjectOS MCP', version: '0.2.0'}});

function isAuthorized(req: Request): boolean {
  const key = process.env.PROJECTOS_MCP_TOKEN;
  if (!key || key.length < 32) return false;
  const authorization = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) return false;
  const incoming = match[1];
  const a = Buffer.from(incoming, 'utf8');
  const b = Buffer.from(key, 'utf8');
  return a.length === b.length && timingSafeEqual(a,b);
}
function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'Authentication required'}}), {status:401,headers:{'Content-Type':'application/json','Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="ProjectOS MCP"'}});
}
async function protectedHandler(req:Request):Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  return runWithRequestId(async () => {
    const result = await handler(req);
    result.headers.set('Cache-Control','no-store');
    return result;
  });
}
export const POST=protectedHandler;
export const GET=protectedHandler;
export async function DELETE(req:Request):Promise<Response> {
  if (!isAuthorized(req)) return unauthorizedResponse();
  return new Response(null,{status:405,headers:{Allow:'GET, POST','Cache-Control':'no-store'}});
}
