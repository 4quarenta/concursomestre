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
import TermsClient from './TermsClient';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Leia nossos termos de uso para entender suas obrigações e as responsabilidades da ConcursoMestre em nossa plataforma de questões e simulados.',
  alternates: {
    canonical: 'https://concursomestre.com.br/terms'
  }
};

export default function TermsPage() {
  return <TermsClient />;
}
