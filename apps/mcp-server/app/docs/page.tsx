import { CopyButton } from './copy-button';
import styles from './docs-portal.module.css';
import {
  codexConfigExample,
  docsSections,
  futureRoadmap,
  internalCapabilities,
  publicTools,
  requestExamples,
  skillCatalog,
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
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}><span className={styles.brandMark}>P</span><span>ProjectOS Docs</span></div>
          <a className={styles.headerLink} href="/">Voltar ao serviço MCP</a>
        </div>
      </header>
      <div className={`${styles.content} ${styles.layout}`}>
        <aside className={styles.sidebar} aria-label="Navegação da documentação">
          <div className={styles.sidebarTitle}>Neste guia</div>
          <nav className={styles.nav}>
            {docsSections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>
        </aside>
        <main>
          <section className={styles.hero} id="intro">
            <div className={styles.eyebrow}>F6.6 · documentação atual</div>
            <h1>Conecte o ProjectOS ao seu fluxo de trabalho.</h1>
            <p className={styles.lead}>Um guia prático para instalar, autenticar e usar o servidor MCP read-only com contexto fornecido pelo cliente autorizado.</p>
            <div className={styles.badgeRow}><span className={styles.badge}>Streamable HTTP</span><span className={styles.badge}>Core Envelope 1.0</span><span className={styles.badge}>Sem execução remota</span></div>
          </section>

          <section className={styles.section} id="install">
            <h2>Instalação e conexão</h2>
            <p className={styles.sectionIntro}>O ProjectOS é um servidor MCP remoto. O cliente MCP faz a conexão; o servidor recebe apenas os dados autorizados pelo cliente e devolve propostas e evidências estruturadas.</p>
            <ol className={styles.steps}>
              <li>Escolha um endpoint Preview autorizado para o teste. A rota MCP é <code>/mcp</code>; não use um domínio Production sem aceite específico.</li>
              <li>Configure o cliente usando somente os nomes das variáveis de ambiente. Nunca cole tokens em URLs, arquivos versionados, prompts ou logs.</li>
              <li>Reinicie o processo do cliente após disponibilizar as variáveis e confirme o handshake, a descoberta e a resposta do envelope.</li>
              <li>Comece com as chamadas de leitura desta página antes de enviar contexto de um projeto real.</li>
            </ol>
            <div className={styles.callout}><strong>Importante:</strong> o formato de configuração varia por cliente e host. Os exemplos abaixo refletem a configuração Codex registrada na F3; confirme a sintaxe da versão instalada antes de usar.</div>
            <div className={styles.grid}>
              <article className={styles.card}><span className={styles.status}>CODEX CLI · PROCEDIMENTO VERIFICADO</span><h3>Configuração por ambiente</h3><p>Use um bloco <code>[mcp_servers.projectos_f3]</code> com <code>url</code>, <code>bearer_token_env_var</code> e <code>env_http_headers</code>. Forneça as variáveis somente ao processo da sessão, confirme <code>codex mcp list</code> e valide a descoberta antes de invocar as tools.</p></article>
              <article className={styles.card}><span className={styles.status}>VS CODE · HOST A VALIDAR</span><h3>Extension Host e Agent Host</h3><p>O VS Code registra servidores em <code>.vscode/mcp.json</code> com <code>servers</code>; o formato portátil documentado usa <code>.mcp.json</code> ou <code>~/.copilot/mcp-config.json</code> com <code>mcpServers</code>. No Extension Host, inputs de senha podem ser usados fora do controle de versão; no Agent Host, inputs interativos podem não ser encaminhados. Confirme em <strong>MCP: List Servers</strong> e nunca presuma a herança de credenciais.</p></article>
            </div>
          </section>

          <section className={styles.section} id="auth">
            <h2>Autenticação segura</h2>
            <p className={styles.sectionIntro}>O endpoint exige Bearer do ProjectOS. Preview protegido pode exigir também o bypass de automação da Vercel, enviado como cabeçalho separado pelo cliente.</p>
            <CodeExample value={codexConfigExample} />
            <p className={styles.muted}>Os valores são deliberadamente placeholders. <code>PROJECTOS_MCP_TOKEN</code> autentica o ProjectOS; <code>VERCEL_AUTOMATION_BYPASS_SECRET</code> atravessa a proteção do Preview quando autorizado. Production não é o alvo deste guia.</p>
          </section>

          <section className={styles.section} id="catalog">
            <h2>Catálogo publicado</h2>
            <p className={styles.sectionIntro}>A lista abaixo é renderizada diretamente dos manifestos versionados carregados pelo catálogo do servidor. Capacidades internas não aparecem como tools MCP públicas.</p>
            <div className={styles.grid}>
              {skillCatalog.map(skill => <article className={styles.card} key={skill.id}><span className={styles.status}>PUBLICADA · v{skill.version}</span><h3>{skill.id}</h3><p><strong>{skill.title}.</strong> {skill.summary}</p><p><strong>Entradas:</strong> {skill.required_inputs.join(', ')}. <strong>Saídas:</strong> {skill.outputs.join(', ')}.</p><p><strong>Exemplo:</strong> forneça {skill.required_inputs.join(' e ')} e use a resposta para orientar o próximo passo no cliente.</p><div className={styles.tagRow}><span className={styles.tag}>risco: {skill.risk_level}</span><span className={styles.tag}>execução: {skill.execution_location}</span></div></article>)}
            </div>
            <h3 style={{ marginTop: 28 }}>Tools MCP</h3>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nome</th><th>Função</th><th>Limites</th></tr></thead><tbody>{publicTools.map(tool => <tr key={tool.id}><td><code>{tool.id}</code></td><td>{tool.description}</td><td>{tool.access}</td></tr>)}</tbody></table></div>
            <h3 style={{ marginTop: 28 }}>Capacidades Core internas</h3>
            <div className={styles.grid}>{internalCapabilities.map(capability => <article className={styles.card} key={capability.id}><span className={styles.status}>{capability.status} · {capability.phase}</span><h3>{capability.id}</h3><p>{capability.description}</p></article>)}</div>
          </section>

          <section className={styles.section} id="workflows">
            <h2>Workflows</h2>
            <p className={styles.sectionIntro}>A skill <code>projectos.start</code> seleciona um modo com base no contexto fornecido. Ela produz proposta: não cria arquivos, não executa shell e não acessa o workspace do cliente.</p>
            <div className={styles.grid}>{workflows.map(workflow => <article className={styles.card} key={workflow.id}><span className={styles.status}>MODO {workflow.id}</span><h3>{workflow.title}</h3><p>{workflow.description}</p><p><strong>Saída:</strong> {workflow.result}</p></article>)}</div>
          </section>

          <section className={styles.section} id="first-use">
            <h2>Primeiro workflow reproduzível</h2>
            <p className={styles.sectionIntro}>Execute as chamadas na ordem abaixo, validando o envelope Core em cada resposta. O resultado esperado inclui <code>schema_version</code>, <code>request_id</code>, <code>status</code> e <code>data</code>.</p>
            <ol className={styles.steps}>
              <li>Chame <code>projectos_list_skills</code> para confirmar o catálogo publicado.</li>
              <li>Chame <code>projectos_get_skill</code> com <code>projectos.discover</code> e leia manifesto e instruções.</li>
              <li>Chame <code>projectos_start_workflow</code> com contexto mínimo e evidência não sensível.</li>
              <li>Se faltarem evidências, aceite <code>needs_input</code>. Operações solicitadas devem retornar <code>blocked</code>; não trate <code>approvals</code> no payload como autorização.</li>
            </ol>
            <h3 style={{ marginTop: 26 }}>Exemplos seguros</h3>
            <p><code>projectos_list_skills</code></p><CodeExample value={requestExamples.list} />
            <p><code>projectos_get_skill</code></p><CodeExample value={requestExamples.get} />
            <p><code>projectos_start_workflow</code></p><CodeExample value={requestExamples.start} />
          </section>

          <section className={styles.section} id="security">
            <h2>Segurança e limites</h2>
            <div className={styles.grid}>
              <article className={styles.card}><h3>Read-only por contrato</h3><p>O servidor não executa comandos, escreve arquivos, migra dados, faz deploy nem acessa diretamente o filesystem do cliente.</p></article>
              <article className={styles.card}><h3>Contexto autorizado</h3><p>Análise e recuperação usam somente o snapshot, documentos, histórico e evidências fornecidos pelo cliente autorizado.</p></article>
              <article className={styles.card}><h3>Sem persistência implícita</h3><p>O isolamento por <code>project_id</code> é lógico e contratual; não há promessa de memória entre sessões nem dependência obrigatória de banco.</p></article>
              <article className={styles.card}><h3>Estados honestos</h3><p>Informação insuficiente retorna <code>needs_input</code>. Achados e propostas não equivalem a aprovação de merge, release ou segurança.</p></article>
            </div>
            <div className={styles.callout}><strong>Nunca envie segredos como contexto.</strong> Mesmo com sanitização conservadora, nenhum filtro de padrões garante detectar todos os formatos de credencial.</div>
          </section>

          <section className={styles.section} id="faq">
            <h2>FAQ e solução de problemas</h2>
            <div className={styles.grid}>
              <article className={styles.card}><h3>Recebi 401</h3><p>Confirme o Bearer e que o processo do cliente realmente herdou <code>PROJECTOS_MCP_TOKEN</code>. Para Preview protegido, confirme o cabeçalho de bypass pelo mecanismo suportado, sem colocá-lo na URL.</p></article>
              <article className={styles.card}><h3>Não vejo as tools</h3><p>Reinicie o cliente após a configuração, confirme o transporte Streamable HTTP e consulte o log de inicialização. Diferencie servidor registrado, conectado e tools descobertas.</p></article>
              <article className={styles.card}><h3>O resultado foi needs_input</h3><p>Forneça objetivo, snapshot ou evidências suficientes. O sistema não inventa contexto ausente para transformar incerteza em aprovação.</p></article>
              <article className={styles.card}><h3>Onde estão as próximas fases?</h3><p>F6.6 é este portal. F7 permanece <strong>BACKLOG FUTURO</strong>; F8 é a homologação e o release 1.0, ainda não iniciados.</p></article>
            </div>
            <div className={styles.tagRow}>{futureRoadmap.map(item => <span className={styles.tag} key={item.id}>{item.id}: {item.status}</span>)}</div>
          </section>
          <p className={styles.footer}>Conteúdo baseado no catálogo e nos contratos versionados do repositório. Confirme sempre o estado do código, do endpoint e do cliente antes de um teste operacional.</p>
        </main>
      </div>
    </div>
  );
}
