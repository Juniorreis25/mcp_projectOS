import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { skillCatalog, getSkillById } from '../../lib/catalog';
import { envelope } from '../../../../packages/core/contracts';
import { currentRequestId, runWithRequestId } from '../../lib/request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler((server) => {
  server.registerTool('projectos.list_skills', {
    title: 'List ProjectOS skills',
    description: 'List published ProjectOS skills and their versions.',
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const response = envelope(currentRequestId(), 'ok', {skills: skillCatalog});
    return {content: [{type: 'text', text: JSON.stringify(response)}], structuredContent: response};
  });

  server.registerTool('projectos.get_skill', {
    title: 'Get ProjectOS skill',
    description: 'Read a versioned ProjectOS skill definition and instructions.',
    inputSchema: z.object({id: z.enum(['projectos.discover','projectos.plan'])}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({id}) => {
    const skill = getSkillById(id);
    if (!skill) {
      return {isError: true, content: [{type: 'text', text: 'Skill not found'}]};
    }
    const response = envelope(currentRequestId(), 'ok', {skill});
    return {content: [{type:'text',text:JSON.stringify(response)}], structuredContent: response};
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
