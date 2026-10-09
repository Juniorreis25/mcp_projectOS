export interface SkillManifest {schema_version:string; id:string; version:string; title:string; summary:string; modes:string[]; risk_level:string; required_inputs:string[]; outputs:string[]; permissions:string[]; approval:string; execution_location:string; compatible_interfaces:string[]; references:string[]}
const keys = ['schema_version','id','version','title','summary','modes','risk_level','required_inputs','outputs','permissions','approval','execution_location','compatible_interfaces','references'] as const;
const arrays = new Set(['modes','required_inputs','outputs','permissions','compatible_interfaces','references']);
export function parseManifest(yaml:string):SkillManifest {
 const output:Record<string,unknown>={};
 for (const raw of yaml.split(/\r?\n/)) {
  const line=raw.trim(); if (!line || line.startsWith('#')) continue;
  const match=/^([a-z_]+):\s*(.*)$/.exec(line);
  if (!match) throw new Error(`INVALID_INPUT: malformed manifest line ${line}`);
  const [,key,value]=match;
  if (!keys.includes(key as typeof keys[number]) || key in output) throw new Error(`INVALID_INPUT: unknown or duplicate ${key}`);
  if (arrays.has(key)) { if (!/^\[.*\]$/.test(value)) throw new Error(`INVALID_INPUT: array required ${key}`); output[key]=value.slice(1,-1).trim()?value.slice(1,-1).split(',').map(x=>x.trim().replace(/^['"]|['"]$/g,'')):[]; }
  else output[key]=value.replace(/^['"]|['"]$/g,'');
 }
 for (const key of keys) if (!(key in output)) throw new Error(`INVALID_INPUT: missing ${key}`);
 const m=output as unknown as SkillManifest;
 if (m.schema_version!=='1.0' || !/^projectos\.[a-z][a-z0-9_-]*$/.test(m.id) || !/^\d+\.\d+\.\d+$/.test(m.version)) throw new Error('INVALID_INPUT: invalid identifiers');
 if ([m.id,m.version,m.title,m.summary,m.risk_level,m.approval,m.execution_location].some(value=>!value.trim())) throw new Error('INVALID_INPUT: empty manifest field');
 if (!['low','moderate','critical'].includes(m.risk_level) || !['client','server'].includes(m.execution_location) || !['none','explicit'].includes(m.approval)) throw new Error('INVALID_INPUT: invalid policy');
 if (m.permissions.some(x=>!['project:read','project:write','command:execute','release:publish'].includes(x))) throw new Error('INVALID_INPUT: unknown permission');
 if (m.execution_location==='server' && m.permissions.includes('project:write')) throw new Error('FORBIDDEN: remote project writes');
 if (m.modes.some(x=>!['new','existing','recovery'].includes(x))) throw new Error('INVALID_INPUT: invalid mode');
 if (m.compatible_interfaces.some(x=>!['mcp_tool','mcp_prompt','mcp_resource'].includes(x))) throw new Error('INVALID_INPUT: invalid interface');
 return m;
}
export function validateCatalog(catalog:SkillManifest[]):void {const ids=new Set<string>(); for(const skill of catalog){const key=`${skill.id}@${skill.version}`;if(ids.has(key))throw new Error(`CONFLICT: duplicate ${key}`);ids.add(key)}}
