import Link from 'next/link';
import styles from './site-header.module.css';

export function SiteHeader({ active }: { active: 'home' | 'docs' }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="ProjectOS, início">
          <span className={styles.mark} aria-hidden="true"><span /></span>
          <span>ProjectOS</span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link className={active === 'home' ? styles.active : ''} href="/">Visão geral</Link>
          <Link className={active === 'docs' ? styles.active : ''} href="/docs">Documentação</Link>
          <a href="https://github.com/Juniorreis25/mcp_projectOS" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </nav>
        <Link className={styles.cta} href="/docs#first-use">Começar agora <span aria-hidden="true">→</span></Link>
      </div>
    </header>
  );
}
