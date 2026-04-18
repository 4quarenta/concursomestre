/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import type { Metadata } from 'next';
import { serverFetch } from '@/lib/api';
import ChangelogClient, { type ChangelogVersion } from './ChangelogClient';

export const metadata: Metadata = {
  title: 'Changelog e Atualizações',
  description: 'Acompanhe todas as novidades, melhorias, correções de bugs e evolução da plataforma ConcursoMestre através do nosso registro oficial de versão.',
  alternates: {
    canonical: 'https://concursomestre.com.br/changelog'
  }
};

export default async function ChangelogPage() {
  let initialVersions: ChangelogVersion[] = [];
  let error = '';

  try {
    // Busca dados no server side (SSR/ISR) sem expor loading states ou spinners aos crawlers.
    // Opcional: Para ativar SSG com revalidator, adicione: { next: { revalidate: 3600 } } ao fetch
    const data = await serverFetch<any>('changelog/list.php', {
      next: { revalidate: 3600 } // ISR - Revalida de hora em hora
    });
    
    if (Array.isArray(data)) {
       initialVersions = data;
    } else if (data && Array.isArray(data.versions)) {
       initialVersions = data.versions;
    } else {
       // Dados vazios.
       initialVersions = [];
    }
  } catch (err: any) {
    error = err.message || 'Não foi possível carregar o changelog agora.';
  }

  return <ChangelogClient initialVersions={initialVersions} error={error} />;
}
