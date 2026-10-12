'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './docs-portal.module.css';

export function DocsSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const sections = document.querySelectorAll<HTMLElement>('[data-doc-search]');
    sections.forEach(section => {
      const haystack = section.dataset.docSearch?.toLocaleLowerCase('pt-BR') ?? '';
      section.hidden = Boolean(normalized && !haystack.includes(normalized));
    });
  }, [query]);

  return (
    <div className={styles.searchArea}>
      <label htmlFor="docs-search">Buscar nesta documentação</label>
      <div className={styles.searchBox}><span aria-hidden="true">⌕</span><input id="docs-search" type="search" placeholder="Ex.: autenticação, workflow..." value={query} onChange={event => setQuery(event.target.value)} /></div>
      <p className={styles.searchHint} aria-live="polite">{query ? `Filtrando por “${query}”` : 'Busca local · nada sai deste navegador'}</p>
      {children}
    </div>
  );
}
