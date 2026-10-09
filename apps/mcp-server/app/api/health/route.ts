export const runtime = 'nodejs';
export async function GET():Promise<Response> {
  return Response.json({service:'projectos-mcp',status:'ok',version:'0.2.0'},{headers:{'Cache-Control':'no-store'}});
}
