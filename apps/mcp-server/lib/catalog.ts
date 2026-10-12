import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseManifest, validateCatalog, type SkillManifest } from '../../../packages/skills/manifest';

const cwd = process.cwd();
const repoRootSkills = resolve(cwd, 'skills');
const appRootSkills = resolve(cwd, '../../skills');
const hasCompleteCatalog = (root: string) => [
  'discover/manifest.yaml', 'discover/SKILL.md',
  'plan/manifest.yaml', 'plan/SKILL.md',
  'start/manifest.yaml', 'start/SKILL.md',
].every(relativePath => existsSync(resolve(root, relativePath)));

const catalogRoot = hasCompleteCatalog(repoRootSkills)
  ? 'repo'
  : hasCompleteCatalog(appRootSkills)
    ? 'app'
    : undefined;

if (!catalogRoot) {
  throw new Error(`ProjectOS catalog resources unavailable for cwd: ${cwd}`);
}

const skillSources = catalogRoot === 'repo'
  ? {
      'projectos.discover': {
        manifest: readFileSync(resolve(cwd, 'skills/discover/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, 'skills/discover/SKILL.md'), 'utf8'),
      },
      'projectos.plan': {
        manifest: readFileSync(resolve(cwd, 'skills/plan/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, 'skills/plan/SKILL.md'), 'utf8'),
      },
      'projectos.start': {
        manifest: readFileSync(resolve(cwd, 'skills/start/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, 'skills/start/SKILL.md'), 'utf8'),
      },
    }
  : {
      'projectos.discover': {
        manifest: readFileSync(resolve(cwd, '../../skills/discover/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, '../../skills/discover/SKILL.md'), 'utf8'),
      },
      'projectos.plan': {
        manifest: readFileSync(resolve(cwd, '../../skills/plan/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, '../../skills/plan/SKILL.md'), 'utf8'),
      },
      'projectos.start': {
        manifest: readFileSync(resolve(cwd, '../../skills/start/manifest.yaml'), 'utf8'),
        instructions: readFileSync(resolve(cwd, '../../skills/start/SKILL.md'), 'utf8'),
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
