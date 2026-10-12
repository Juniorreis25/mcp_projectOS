import { SiteHeader } from '../site-header';
import { CopyButton } from './copy-button';
import { DocsSearch } from './docs-search';
import styles from './docs-portal.module.css';
import {
  codexConfigExample,
  docsSections,
  futureRoadmap,
  internalCapabilities,
  publicTools,
  requestExamples,
  skillCatalog,
  vsCodeConfigExample,
  workflows,
} from '../../lib/docs-content';

export const metadata = {
  title: 'Documentação e onboarding | ProjectOS',
  description: 'Instale, conecte e use o servidor MCP read-only do ProjectOS com segurança.',
};

function CodeExample({ value }: { value: string }) {
  return <div className={styles.codeWrap}><CopyButton value={value} /><pre className={styles.code}><code>{value}</code></pre></div>;
}

export default function DocsPage() {
  return (
    <div className={styles.shell}>
      <SiteHeader active="docs" />
      <div className={styles.docsIntro}><div className={styles.content}><p className={styles.eyebrow}>Documentação e onboarding · F6.6</p><h1>Seu primeiro fluxo<br /><span>começa aqui.</span></h1><p>Um guia direto para instalar, conectar e usar o ProjectOS com contexto autorizado — sem perder de vista os limites.</p><div className={styles.introMeta}><span>● Conteúdo do catálogo atual</span><span>↗ Read-only por contrato</span><span>v0.2.0</span></div></div></div>
      <div className={`${styles.content} ${styles.layout}`}>
        <aside className={styles.sidebar} aria-label="Navegação da documentação">
          <div className={styles.sidebarTitle}>NAVEGUE</div>
          <nav className={styles.nav}>{docsSections.map(([id, label], index) => <a key={id} href={`#${id}`}><span>0{index + 1}</span>{label}</a>)}</nav>
          <div className={styles.sideNote}><span>●</span><strong>Preview protegido</strong><p>Use credenciais apenas na sessão necessária. Nunca em URLs ou commits.</p></div>
        </aside>
        <main className={styles.main}>
          <DocsSearch>
            <section className={styles.section} id="intro" data-doc-search="visão geral introdução envelope core read-only" aria-labelledby="intro-title">
              <p className={styles.sectionEyebrow}>01 · VISÃO GERAL</p><h2 id="intro-title">O que é o ProjectOS?</h2><p className={styles.sectionLead}>Uma camada de contexto para clientes MCP. Você fornece objetivo, evidências e limites; o servidor devolve catálogo, propostas e próximos passos em um contrato previsível.</p>
              <div className={styles.factGrid}><div><span>TRANSPORTE</span><strong>Streamable HTTP</strong></div><div><span>CONTRATO</span><strong>Core Envelope 1.0</strong></div><div><span>EXECUÇÃO</span><strong>Somente cliente</strong></div></div>
            </section>

            <section className={styles.section} id="install" data-doc-search="instalação conexão cliente codex vs code pré-requisitos">
              <p className={styles.sectionEyebrow}>02 · INSTALAÇÃO</p><h2>Conecte sem improvisar.</h2><p className={styles.sectionLead}>O ProjectOS é um servidor MCP remoto. O cliente faz a conexão; o servidor recebe apenas dados autorizados e devolve propostas estruturadas.</p>
              <ol className={styles.steps}><li><b>Escolha o Preview.</b> Use um endpoint autorizado e a rota <code>/mcp</code>; não use Production sem aceite específico.</li><li><b>Configure o processo.</b> Use variáveis de ambiente e nunca cole tokens em URLs, arquivos versionados, prompts ou logs.</li><li><b>Confirme o handshake.</b> Reinicie o cliente, valide a descoberta e confira o envelope antes de enviar contexto real.</li><li><b>Comece pequeno.</b> Execute o primeiro workflow com dados fictícios e seguros.</li></ol>
              <div className={styles.callout}><strong>Importante:</strong> o formato varia por cliente e host. Os exemplos abaixo refletem configurações verificadas; confirme a sintaxe da versão instalada.</div>
              <div className={styles.splitCards}><article className={styles.miniCard}><span className={styles.status}>CODEX CLI · VERIFICADO</span><h3>Variáveis na sessão</h3><p>Use <code>bearer_token_env_var</code> e <code>env_http_headers</code>. Depois confirme <code>codex mcp list</code> e a descoberta das tools.</p></article><article className={styles.miniCard}><span className={styles.status}>VS CODE · EXTENSION HOST</span><h3>Host MCP nativo</h3><p>Use <code>.vscode/mcp.json</code> e <strong>MCP: List Servers</strong>. O Agent Host ainda depende de homologação específica na F8.</p></article></div>
            </section>

            <section className={styles.section} id="auth" data-doc-search="autenticação bearer bypass vercel credencial segurança">
              <p className={styles.sectionEyebrow}>03 · AUTENTICAÇÃO</p><h2>Duas camadas, zero segredos no código.</h2><p className={styles.sectionLead}>O endpoint exige o Bearer do ProjectOS. Um Preview protegido pode exigir também o bypass de automação da Vercel, enviado como cabeçalho separado.</p><div className={styles.codeLabel}>CODEX · CONFIG.TOML</div><CodeExample value={codexConfigExample} /><div className={styles.codeLabel}>VS CODE · .VSCODE/MCP.JSON</div><p>O Extension Host solicita os dois valores como entradas protegidas e não os coloca no arquivo.</p><CodeExample value={vsCodeConfigExample} /><p className={styles.muted}>Os valores são placeholders. <code>PROJECTOS_MCP_TOKEN</code> autentica o ProjectOS; <code>VERCEL_AUTOMATION_BYPASS_SECRET</code> atravessa a proteção do Preview quando autorizado. Não use Production neste guia.</p>
            </section>

            <section className={styles.section} id="catalog" data-doc-search="catálogo skills tools capacidades core públicas internas">
              <p className={styles.sectionEyebrow}>04 · CATÁLOGO</p><h2>Pequeno por propósito.</h2><p className={styles.sectionLead}>A lista abaixo vem dos manifestos versionados. Skills publicadas são diferentes das capacidades Core internas; estas últimas não aparecem como tools MCP.</p>
              <div className={styles.catalogGrid}>{skillCatalog.map(skill => <article className={styles.catalogCard} key={skill.id}><div className={styles.catalogTop}><span className={styles.status}>PUBLICADA · v{skill.version}</span><span>↗</span></div><h3>{skill.id}</h3><p><strong>{skill.title}.</strong> {skill.summary}</p><div className={styles.tags}><span>risco: {skill.risk_level}</span><span>execução: {skill.execution_location}</span></div></article>)}</div>
              <h3 className={styles.subheading}>Tools MCP públicas</h3><div className={styles.toolTable}>{publicTools.map(tool => <div className={styles.toolRow} key={tool.id}><code>{tool.id}</code><span>{tool.description}</span><small>{tool.access}</small></div>)}</div>
              <h3 className={styles.subheading}>Capacidades Core internas</h3><div className={styles.internalGrid}>{internalCapabilities.map(capability => <div className={styles.internalCard} key={capability.id}><span>{capability.phase} · {capability.status}</span><strong>{capability.id}</strong><p>{capability.description}</p></div>)}</div>
            </section>

            <section className={styles.section} id="workflows" data-doc-search="workflows new existing recovery projeto novo existente recuperação">
              <p className={styles.sectionEyebrow}>05 · WORKFLOWS</p><h2>Três modos para começar.</h2><p className={styles.sectionLead}>A skill <code>projectos.start</code> escolhe um modo a partir do contexto fornecido. Ela produz uma proposta: não cria arquivos, executa shell ou acessa o workspace.</p><div className={styles.workflowList}>{workflows.map((workflow, index) => <article key={workflow.id}><span>0{index + 1}</span><div><h3>{workflow.title}</h3><p>{workflow.description}</p></div><strong>{workflow.result}</strong></article>)}</div>
            </section>

            <section className={styles.section} id="first-use" data-doc-search="primeiro uso chamada exemplo list skills get skill start workflow">
              <p className={styles.sectionEyebrow}>06 · PRIMEIRO USO</p><h2>Um fluxo reproduzível.</h2><p className={styles.sectionLead}>Execute na ordem abaixo e valide <code>schema_version</code>, <code>request_id</code>, <code>status</code> e <code>data</code> em cada resposta.</p><ol className={styles.steps}><li>Chame <code>projectos_list_skills</code> para confirmar o catálogo.</li><li>Chame <code>projectos_get_skill</code> com <code>projectos.discover</code>.</li><li>Chame <code>projectos_start_workflow</code> com contexto mínimo.</li><li>Aceite <code>needs_input</code> quando faltarem evidências; operações solicitadas retornam <code>blocked</code>.</li></ol><div className={styles.codeLabel}>LISTAR SKILLS</div><CodeExample value={requestExamples.list} /><div className={styles.codeLabel}>CONSULTAR SKILL</div><CodeExample value={requestExamples.get} /><div className={styles.codeLabel}>INICIAR PROPOSTA</div><CodeExample value={requestExamples.start} />
            </section>

            <section className={styles.section} id="security" data-doc-search="segurança limites filesystem persistência needs input blocked autorização">
              <p className={styles.sectionEyebrow}>07 · SEGURANÇA</p><h2>Limites que fazem parte do produto.</h2><div className={styles.securityGrid}><article><span>01</span><h3>Read-only por contrato</h3><p>Sem comandos, escrita de arquivos, migrações, deploys ou acesso direto ao filesystem.</p></article><article><span>02</span><h3>Contexto autorizado</h3><p>Análise e recuperação usam somente snapshot, documentos, histórico e evidências fornecidos pelo cliente.</p></article><article><span>03</span><h3>Sem persistência implícita</h3><p>O isolamento por <code>project_id</code> é lógico e contratual; não há memória entre sessões.</p></article><article><span>04</span><h3>Estados honestos</h3><p>Informação insuficiente retorna <code>needs_input</code>. Propostas não são aprovação de merge ou release.</p></article></div><div className={styles.callout}><strong>Nunca envie segredos como contexto.</strong> Sanitização conservadora não garante detectar todos os formatos de credencial.</div>
            </section>

            <section className={styles.section} id="faq" data-doc-search="faq problemas troubleshooting 401 tools não vejo needs input roadmap">
              <p className={styles.sectionEyebrow}>08 · FAQ E PROBLEMAS</p><h2>Quando algo não sair como esperado.</h2><div className={styles.faqGrid}><article><h3>Recebi 401</h3><p>Confirme o Bearer e que o processo herdou <code>PROJECTOS_MCP_TOKEN</code>. Para Preview protegido, confirme o bypass sem colocá-lo na URL.</p></article><article><h3>Não vejo as tools</h3><p>Reinicie o cliente, confirme Streamable HTTP e diferencie servidor registrado, conectado e tools descobertas.</p></article><article><h3>Recebi needs_input</h3><p>Forneça objetivo, snapshot ou evidências suficientes. O sistema não inventa contexto ausente.</p></article><article><h3>O que vem depois?</h3><p>F7 permanece <strong>BACKLOG FUTURO</strong>; F8 é homologação e release 1.0, ainda não iniciados.</p></article></div><div className={styles.roadmap}>{futureRoadmap.map(item => <span key={item.id}><b>{item.id}</b>{item.status}</span>)}</div>
            </section>
          </DocsSearch>
          <p className={styles.footer}>Conteúdo baseado no catálogo e contratos versionados do repositório. Confirme sempre o estado do código, endpoint e cliente antes de um teste operacional.</p>
        </main>
      </div>
    </div>
  );
}
