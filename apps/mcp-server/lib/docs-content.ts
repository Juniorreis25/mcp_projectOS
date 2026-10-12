import { skillCatalog } from './catalog';

export const publicTools = [
  {
    id: 'projectos_list_skills',
    title: 'Listar skills',
    description: 'Lista o catálogo de skills publicadas pelo servidor.',
    access: 'Leitura, idempotente e sem efeitos externos.',
  },
  {
    id: 'projectos_get_skill',
    title: 'Consultar uma skill',
    description: 'Retorna o manifesto e as instruções de uma skill publicada.',
    access: 'Leitura, idempotente e sem efeitos externos.',
  },
  {
    id: 'projectos_start_workflow',
    title: 'Iniciar proposta de workflow',
    description: 'Classifica o contexto e produz uma proposta read-only para o projeto.',
    access: 'Leitura; não executa comandos, grava arquivos, migra ou faz deploy.',
  },
] as const;

export const internalCapabilities = [
  { id: 'spec', phase: 'F5', status: 'INTERNO', description: 'Contratos e preparação de especificações.' },
  { id: 'build', phase: 'F5', status: 'INTERNO', description: 'Planejamento de implementação read-only.' },
  { id: 'review', phase: 'F5', status: 'INTERNO', description: 'Análise estruturada de artefatos e evidências.' },
  { id: 'test', phase: 'F5', status: 'INTERNO', description: 'Planejamento e avaliação de testes.' },
  { id: 'debug', phase: 'F5', status: 'INTERNO', description: 'Diagnóstico determinístico sem execução.' },
  { id: 'protect', phase: 'F5', status: 'INTERNO', description: 'Análise read-only de proteção e controles.' },
  { id: 'idea', phase: 'F6', status: 'INTERNO', description: 'Análise de ideias e inventário.' },
  { id: 'release', phase: 'F6', status: 'INTERNO', description: 'Planejamento conservador de releases.' },
  { id: 'memory', phase: 'F6', status: 'INTERNO', description: 'Memória contextual auditável fornecida pelo cliente.' },
  { id: 'status', phase: 'F6', status: 'INTERNO', description: 'Consolidação de status declarados.' },
  { id: 'audit', phase: 'F6', status: 'INTERNO', description: 'Análise de auditoria e conformidade.' },
];

export const futureRoadmap = [
  { id: 'F6.6', title: 'Portal Web de Documentação e Onboarding', status: 'EM IMPLEMENTAÇÃO' },
  { id: 'F7', title: 'Persistência compartilhada', status: 'BACKLOG FUTURO' },
  { id: 'F8', title: 'Homologação e release 1.0', status: 'NÃO INICIADA' },
];

export const workflows = [
  {
    id: 'new',
    title: 'Novo projeto',
    description: 'Usa objetivo, escopo, restrições e evidências fornecidos pelo cliente.',
    result: 'Proposta inicial, riscos, dependências e próximos passos.',
  },
  {
    id: 'existing',
    title: 'Projeto existente',
    description: 'Analisa um snapshot, documentos e evidências fornecidos pelo cliente autorizado.',
    result: 'Leitura do estado informado, sem acessar o workspace diretamente.',
  },
  {
    id: 'recovery',
    title: 'Recuperação',
    description: 'Organiza histórico conhecido, pendências e decisões fornecidos pelo cliente.',
    result: 'Proposta de retomada; contexto ausente retorna needs_input.',
  },
] as const;

export const docsSections = [
  ['intro', 'Visão geral'],
  ['install', 'Instalação'],
  ['auth', 'Autenticação'],
  ['catalog', 'Catálogo'],
  ['workflows', 'Workflows'],
  ['first-use', 'Primeiro uso'],
  ['security', 'Segurança'],
  ['faq', 'FAQ e problemas'],
] as const;

export const codexConfigExample = `[mcp_servers.projectos_f3]\nurl = "https://<preview>/mcp"\nbearer_token_env_var = "PROJECTOS_MCP_TOKEN"\nenv_http_headers = { "x-vercel-protection-bypass" = "VERCEL_AUTOMATION_BYPASS_SECRET" }`;

export const vsCodeConfigExample = `{
  "inputs": [
    {
      "type": "promptString",
      "id": "projectos-token",
      "description": "ProjectOS Bearer token (Preview)",
      "password": true
    },
    {
      "type": "promptString",
      "id": "vercel-bypass",
      "description": "Vercel Protection Bypass secret (Preview)",
      "password": true
    }
  ],
  "servers": {
    "projectos": {
      "type": "http",
      "url": "https://<preview>/mcp",
      "headers": {
        "Authorization": "Bearer \${input:projectos-token}",
        "x-vercel-protection-bypass": "\${input:vercel-bypass}"
      }
    }
  }
}`;

export const requestExamples = {
  list: '{ }',
  get: '{ "id": "projectos.discover" }',
  start: `{
  "project_id": "meu-projeto",
  "requested_mode": "new",
  "goal": "Documentar o primeiro fluxo read-only",
  "scope": ["catalogo", "onboarding"],
  "evidence": [{ "ref": "brief-001", "summary": "Objetivo fornecido pelo cliente" }]
}`,
} as const;

export { skillCatalog };
