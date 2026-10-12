'use client';

import { useState } from 'react';
import styles from './docs-portal.module.css';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className={styles.copyButton} type="button" onClick={copy} aria-label="Copiar exemplo">
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}
