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
import FaqClient from './FaqClient';
import { FAQ_DATA } from './faqData';

export const metadata: Metadata = {
  title: 'Dúvidas Frequentes',
  description: 'Encontre respostas rápidas sobre assinaturas, simulados, mentorias, reputação e regras da plataforma ConcursoMestre na nossa central de ajuda.',
  alternates: {
    canonical: 'https://concursomestre.com.br/faq'
  }
};

export default function FaqPage() {
  const allQuestions = FAQ_DATA.flatMap(category => category.questions);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allQuestions.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqClient />
    </>
  );
}
