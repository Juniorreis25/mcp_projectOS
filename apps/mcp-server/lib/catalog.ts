import { readFileSync } from 'node:fs';
import { parseManifest, validateCatalog, type SkillManifest } from '../../../packages/skills/manifest';

const skillSources = {
  'projectos.discover': {
    manifest: new URL('../../../skills/discover/manifest.yaml', import.meta.url),
    instructions: new URL('../../../skills/discover/SKILL.md', import.meta.url),
  },
  'projectos.plan': {
    manifest: new URL('../../../skills/plan/manifest.yaml', import.meta.url),
    instructions: new URL('../../../skills/plan/SKILL.md', import.meta.url),
  },
} as const;

export type SkillId = keyof typeof skillSources;
export type SkillDefinition = SkillManifest & { instructions: string; resources: string[] };

function readFixedWorkspaceFile(filename: URL): string {
  return readFileSync(filename, 'utf8');
}

function loadSkill(id: SkillId): SkillDefinition {
  const source = skillSources[id];
  const manifest = parseManifest(readFixedWorkspaceFile(source.manifest));
  if (manifest.id !== id) throw new Error(`CONFLICT: manifest id mismatch for ${id}`);
  return {
    ...manifest,
    instructions: readFixedWorkspaceFile(source.instructions),
    resources: ['manifest.yaml', 'SKILL.md'],
  };
}

const loadedSkills = (Object.keys(skillSources) as SkillId[]).map(loadSkill);
validateCatalog(loadedSkills);

export const skillCatalog = loadedSkills.map(({ instructions: _instructions, ...manifest }) => manifest);

export function getSkillById(id: string): SkillDefinition | undefined {
  return loadedSkills.find(skill => skill.id === id);
}
