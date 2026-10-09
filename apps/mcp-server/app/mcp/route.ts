import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { skillCatalog, getSkillById } from '../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler((server) => {
  server.registerTool('projectos.list_skills', {
    title: 'List ProjectOS skills',
    description: 'List published ProjectOS skills and their versions.',
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => ({
    content: [{type: 'text', text: JSON.stringify(skillCatalog)}],
    structuredContent: {skills: skillCatalog},
  }));

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
    return {content: [{type:'text',text:JSON.stringify(skill)}], structuredContent: {skill}};
  });
}, {serverInfo: {name: 'ProjectOS MCP', version: '0.2.0'}});

function isAuthorized(req: Request): boolean {
  const key = process.env.PROJECTOS_MCP_TOKEN;
  if (!key || key.length < 32) return false;
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return false;
  const incoming = authorization.slice(7);
  if (!incoming || /\s/.test(incoming)) return false;
  const a = Buffer.from(incoming, 'utf8');
  const b = Buffer.from(key, 'utf8');
  return a.length === b.length && timingSafeEqual(a,b);
}
async function protectedHandler(req:Request):Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'Authentication required'}}), {status:401,headers:{'Content-Type':'application/json','Cache-Control':'no-store','WWW-Authenticate':'Bearer realm="ProjectOS MCP"'}});
  }
  const result = await handler(req);
  result.headers.set('Cache-Control','no-store');
  return result;
}
export const POST=protectedHandler;
export const GET=protectedHandler;
export async function DELETE():Promise<Response> {return new Response(null,{status:405,headers:{Allow:'GET, POST'}});}
