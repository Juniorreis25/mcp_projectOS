import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'ProjectOS — contexto para decisões melhores',
    template: '%s | ProjectOS',
  },
  description: 'Documentação e onboarding do ProjectOS: propostas estruturadas, rastreáveis e read-only para fluxos de desenvolvimento assistidos por MCP.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
