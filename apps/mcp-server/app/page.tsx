import Link from 'next/link';
import { SiteHeader } from './site-header';
import styles from './home.module.css';
import { publicTools, skillCatalog, workflows } from '../lib/docs-content';

export const metadata = {
  title: 'ProjectOS — contexto para decisões melhores',
  description: 'ProjectOS organiza contexto e propostas read-only para fluxos de desenvolvimento assistidos por MCP.',
};

const principles = [
  ['01', 'Contexto antes da ação', 'O cliente autorizado fornece objetivo, evidências e limites; o ProjectOS organiza o que está disponível.'],
  ['02', 'Propostas, não automação oculta', 'Toda saída é uma proposta estruturada. O cliente mantém o controle de arquivos, comandos e aprovações.'],
  ['03', 'Estados honestos', 'Falta de evidência vira needs_input. Operações sensíveis ficam blocked, sem atalhos por payload.'],
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <SiteHeader active="home" />
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span className={styles.liveDot} /> MCP CORE · READ-ONLY</p>
              <h1 id="hero-title">Contexto claro.<br /><em>Decisões melhores.</em></h1>
              <p className={styles.heroLead}>ProjectOS transforma contexto fornecido pelo cliente em propostas estruturadas, rastreáveis e seguras para o trabalho de desenvolvimento.</p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/docs">Explorar a documentação <span aria-hidden="true">↗</span></Link>
                <a className={styles.textButton} href="#how-it-works">Como funciona <span aria-hidden="true">↓</span></a>
              </div>
              <div className={styles.heroNote}><span>✓</span> Sem execução remota · Sem acesso ao filesystem</div>
            </div>
            <div className={styles.heroVisual} aria-label="Fluxo visual do ProjectOS" role="img">
              <div className={`${styles.orbit} ${styles.orbitOne}`} aria-hidden="true" />
              <div className={`${styles.orbit} ${styles.orbitTwo}`} aria-hidden="true" />
              <div className={styles.visualCard}>
                <div className={styles.cardTop}><span className={styles.terminalDots}><i /><i /><i /></span><span>projectos.start</span><span className={styles.cardStatus}>● ready</span></div>
                <div className={styles.codeLine}><span className={styles.codeKey}>project_id</span><span>:</span><span className={styles.codeValue}>&quot;atlas-docs&quot;</span></div>
                <div className={styles.codeLine}><span className={styles.codeKey}>mode</span><span>:</span><span className={styles.codeValue}>&quot;new&quot;</span></div>
                <div className={styles.codeLine}><span className={styles.codeKey}>evidence</span><span>:</span><span className={styles.codeValue}>[2 refs]</span></div>
                <div className={styles.divider} />
                <div className={styles.resultRow}><span className={styles.resultIcon}>✓</span><span>proposta estruturada</span><strong>planned</strong></div>
                <div className={styles.resultRow}><span className={styles.resultIcon}>↗</span><span>próximo passo</span><strong>client</strong></div>
              </div>
              <div className={`${styles.floatTag} ${styles.tagClient}`}><span>◎</span> Cliente autorizado</div>
              <div className={`${styles.floatTag} ${styles.tagEnvelope}`}><span>◇</span> Core Envelope 1.0</div>
            </div>
          </div>
        </section>

        <section className={styles.signalBar} aria-label="Propriedades do ProjectOS"><div className={styles.containerSignal}><span>CONSTRUÍDO PARA FLUXOS DE DESENVOLVIMENTO</span><span>Streamable HTTP</span><span>Envelope Core 1.0</span><span>3 tools públicas</span></div></section>

        <section className={styles.section} id="how-it-works">
          <div className={styles.container}>
            <div className={styles.sectionHeader}><p className={styles.kicker}>O modelo</p><h2>Um limite claro entre<br /><span>pensar e executar.</span></h2><p>O ProjectOS trabalha no espaço onde contexto vira direção. A execução continua no cliente, com as permissões e aprovações adequadas.</p></div>
            <div className={styles.principleGrid}>{principles.map(([number, title, description]) => <article className={styles.principle} key={number}><span className={styles.principleNumber}>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.darkSection}`} id="public-surface">
          <div className={styles.container}>
            <div className={styles.sectionHeader}><p className={styles.kicker}>Superfície pública</p><h2>Três tools.<br /><span>Um contrato confiável.</span></h2><p>O catálogo MCP mantém a superfície pequena, legível e compatível com clientes autorizados.</p></div>
            <div className={styles.toolGrid}>{publicTools.map((tool, index) => <article className={styles.toolCard} key={tool.id}><div className={styles.toolIndex}>0{index + 1}</div><p className={styles.toolLabel}>PROJECTOS · MCP TOOL</p><h3>{tool.title}</h3><code>{tool.id}</code><p>{tool.description}</p><span className={styles.toolAccess}>↳ {tool.access}</span></article>)}</div>
            <div className={styles.skillStrip}><div><p className={styles.toolLabel}>SKILLS PUBLICADAS</p><h3>O catálogo que o cliente pode descobrir.</h3></div><div className={styles.skillList}>{skillCatalog.map(skill => <span key={skill.id}><i />{skill.id}<small>v{skill.version}</small></span>)}</div></div>
          </div>
        </section>

        <section className={styles.section} id="workflows">
          <div className={styles.container}>
            <div className={styles.sectionHeaderInline}><div><p className={styles.kicker}>Três caminhos</p><h2>Comece de onde<br /><span>o projeto está.</span></h2></div><p>Contexto novo, existente ou em recuperação. O resultado é sempre explícito sobre o que sabe — e o que ainda precisa.</p></div>
            <div className={styles.workflowGrid}>{workflows.map((workflow, index) => <article className={styles.workflowCard} key={workflow.id}><span className={styles.workflowNumber}>0{index + 1}</span><h3>{workflow.title}</h3><p>{workflow.description}</p><div><span>SAÍDA</span><strong>{workflow.result}</strong></div></article>)}</div>
          </div>
        </section>

        <section className={styles.section} id="security">
          <div className={`${styles.container} ${styles.securityLayout}`}><div className={styles.securityHeading}><p className={styles.kicker}>Limites por design</p><h2>Seguro porque<br /><span>é explícito.</span></h2><p>Não há mágica escondida no servidor. Cada limite é parte do contrato e cada ausência de evidência aparece como estado.</p><Link className={styles.outlineButton} href="/docs#security">Ler sobre segurança <span aria-hidden="true">→</span></Link></div><div className={styles.securityList}><div><span>01</span><strong>Read-only</strong><p>Nenhum shell, arquivo, migração ou deploy executado pelo MCP.</p></div><div><span>02</span><strong>Sem contexto inventado</strong><p>Snapshots e histórico vêm do cliente autorizado, não do filesystem.</p></div><div><span>03</span><strong>Needs input é um resultado</strong><p>Incerteza não é convertida artificialmente em aprovação.</p></div></div></div>
        </section>

        <section className={styles.ctaSection}><div className={styles.container}><div className={styles.ctaPanel}><div><p className={styles.kicker}>Primeiro passo</p><h2>Veja o ProjectOS<br /><span>em ação.</span></h2><p>Configure um cliente MCP e faça sua primeira chamada com dados fictícios e seguros.</p></div><Link className={styles.primaryButton} href="/docs#first-use">Abrir guia de onboarding <span aria-hidden="true">↗</span></Link></div></div></section>
      </main>
      <footer className={styles.footer}><div className={styles.container}><span className={styles.footerBrand}>ProjectOS <small>MCP 0.2.0</small></span><span>Core read-only · Envelope 1.0</span><Link href="/docs">Documentação</Link><a href="https://github.com/Juniorreis25/mcp_projectOS" target="_blank" rel="noreferrer">GitHub ↗</a></div></footer>
    </div>
  );
}
