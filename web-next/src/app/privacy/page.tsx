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
import PrivacyClient from './PrivacyClient';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Saiba como a ConcursoMestre protege seus dados. Conheça nossa política de privacidade, regras de coleta, segurança e conformidade com a LGPD.',
  alternates: {
    canonical: 'https://concursomestre.com.br/privacy'
  }
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
