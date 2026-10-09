import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { skillCatalog, getSkillById } from '../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler((server) => {
  server.registerTool('projectos_list_skills', {
    title: 'List ProjectOS skills',
    description: 'List published ProjectOS skills and their versions.',
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => ({
    content: [{type: 'text', text: JSON.stringify(skillCatalog)}],
    structuredContent: {skills: skillCatalog},
  }));

  server.registerTool('projectos_get_skill', {
    title: 'Get ProjectOS skill',
    description: 'Read a versioned ProjectOS skill definition and instructions.',
    inputSchema: z.object({id: z.enum(['projectos.discover','projectos.plan'])}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({id}) => {
    const skill = getSkillById(id);
    return {content: [{type:'text',text:JSON.stringify(skill)}], structuredContent: {skill}};
  });
});

function isAuthorized(req: Request): boolean {
  const key = process.env.PROJECTOS_MCP_TOKEN;
  if (!key || key.length < 32) return false;
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return false;
  const incoming = authorization.slice(7);
  const a = Buffer.from(incoming, 'utf8');
  const b = Buffer.from(key, 'utf8');
  return a.length === b.length && timingSafeEqual(a,b);
}
async function protectedHandler(req:Request):Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({error:'unauthorized'}), {status:401,headers:{'Content-Type':'application/json','Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="ProjectOS MCP"'}});
  }
  const result = await handler(req);
  result.headers.set('Cache-Control','no-store');
  return result;
}
export const POST=protectedHandler;
export const GET=protectedHandler;
export async function DELETE():Promise<Response> {return new Response(null,{status:405,headers:{Allow:'GET, POST'}});}
