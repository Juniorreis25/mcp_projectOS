import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseManifest, validateCatalog, type SkillManifest } from '../../../packages/skills/manifest';

const skillSources = {
  'projectos.discover': {
    manifest: readFileSync(resolve(process.cwd(), '../../skills/discover/manifest.yaml'), 'utf8'),
    instructions: readFileSync(resolve(process.cwd(), '../../skills/discover/SKILL.md'), 'utf8'),
  },
  'projectos.plan': {
    manifest: readFileSync(resolve(process.cwd(), '../../skills/plan/manifest.yaml'), 'utf8'),
    instructions: readFileSync(resolve(process.cwd(), '../../skills/plan/SKILL.md'), 'utf8'),
  },
  'projectos.start': {
    manifest: readFileSync(resolve(process.cwd(), '../../skills/start/manifest.yaml'), 'utf8'),
    instructions: readFileSync(resolve(process.cwd(), '../../skills/start/SKILL.md'), 'utf8'),
  },
} as const;

export type SkillId = keyof typeof skillSources;
export type SkillDefinition = SkillManifest & { instructions: string; resources: string[] };

function loadSkill(id: SkillId): SkillDefinition {
  const source = skillSources[id];
  const manifest = parseManifest(source.manifest);
  if (manifest.id !== id) throw new Error(`CONFLICT: manifest id mismatch for ${id}`);
  return {
    ...manifest,
    instructions: source.instructions,
    resources: ['manifest.yaml', 'SKILL.md'],
  };
}

const loadedSkills = (Object.keys(skillSources) as SkillId[]).map(loadSkill);
validateCatalog(loadedSkills);

export const skillCatalog = loadedSkills.map(({ instructions: _instructions, ...manifest }) => manifest);

export function getSkillById(id: string): SkillDefinition | undefined {
  return loadedSkills.find(skill => skill.id === id);
}
