export const skillCatalog = [
  {id:'projectos.discover',version:'0.1.0',title:'Descoberta de projeto',modes:['new','existing','recovery'],read_only:true},
  {id:'projectos.plan',version:'0.1.0',title:'Planejamento incremental',modes:['new','existing','recovery'],read_only:true}
] as const;
export function getSkillById(id:'projectos.discover'|'projectos.plan') {
  switch(id) {
    case 'projectos.discover': return {
      ...skillCatalog[0],
      instructions:'Inspect the project through authorized client capabilities. Never modify files during discovery. Return architecture, risks, unknowns and evidence references.'
    };
    case 'projectos.plan': return {
      ...skillCatalog[1],
      instructions:'Decompose the approved scope into incremental tasks, dependencies, acceptance criteria, risks and verification evidence. Never execute code or deployment as part of planning.'
    };
  }
}
