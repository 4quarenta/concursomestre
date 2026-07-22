export type PublicInformationSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

export const SUPPORT_SEO_SECTIONS: PublicInformationSection[] = [
  {
    title: 'Reportar problema',
    paragraphs: [
      'Informe erros de acesso, páginas que não carregam, lentidão, travamentos, falhas de login, problemas de pagamento ou recursos indisponíveis.',
    ],
    items: ['Descreva o que aconteceu', 'Informe os passos realizados', 'Explique o resultado esperado'],
  },
  {
    title: 'Enviar sugestão',
    paragraphs: [
      'Envie ideias para novas funcionalidades e melhorias na interface, na experiência de estudo, na inteligência artificial, no aplicativo ou no desempenho da plataforma.',
    ],
  },
  {
    title: 'Solicitar ajuda',
    paragraphs: [
      'Peça ajuda sobre conta, assinatura, cobrança, renovação, reembolso, materiais, questões, Lei Comentada e uso dos recursos do ConcursoMestre.',
    ],
  },
  {
    title: 'Acompanhar solicitações',
    paragraphs: [
      'Usuários autenticados acompanham respostas e o status de cada solicitação no histórico da própria conta.',
    ],
  },
];

export const PRIVACY_SEO_SECTIONS: PublicInformationSection[] = [
  {
    title: '1. Coleta de dados',
    paragraphs: [
      'O ConcursoMestre coleta os dados necessários para identificar a conta, prestar os serviços contratados, processar pagamentos e personalizar a experiência de estudo.',
    ],
    items: [
      'Nome, e-mail e avatar para identificação e comunicação.',
      'Dados fiscais e de endereço apenas quando necessários para cobrança ou obrigações legais.',
      'Dados de estudo, respostas e progresso para estatísticas e personalização.',
    ],
  },
  {
    title: '2. Segurança da informação',
    paragraphs: [
      'O tráfego utiliza conexão segura e os dados sensíveis de pagamento são processados por provedores especializados. A plataforma não armazena números completos de cartão.',
    ],
  },
  {
    title: '3. Compartilhamento restrito',
    paragraphs: [
      'Os dados são compartilhados somente quando necessários para executar serviços, processar pagamentos, atender integrações autorizadas ou cumprir obrigação legal.',
    ],
  },
  {
    title: '4. Direitos do titular',
    paragraphs: [
      'Nos termos da LGPD, o titular pode solicitar acesso, correção, portabilidade, informação sobre compartilhamento e exclusão quando aplicável.',
    ],
  },
];

export const TERMS_SEO_SECTIONS: PublicInformationSection[] = [
  {
    title: '1. Aceite dos termos',
    paragraphs: [
      'Ao criar uma conta ou utilizar o ConcursoMestre, o usuário declara ter lido e aceitado estes termos e a Política de Privacidade.',
    ],
  },
  {
    title: '2. Regras de conduta',
    paragraphs: [
      'A conta deve ser utilizada de forma lícita, segura e pessoal, sem tentativa de fraude, abuso, violação de direitos ou interferência no funcionamento da plataforma.',
    ],
  },
  {
    title: '3. Serviços e aplicações de inteligência artificial',
    paragraphs: [
      'Recursos de inteligência artificial auxiliam o estudo, mas podem produzir respostas imprecisas. O gabarito oficial e as fontes primárias devem prevalecer quando houver divergência.',
    ],
  },
  {
    title: '4. Planos, assinaturas e estornos',
    paragraphs: [
      'Planos pagos podem possuir renovação automática. Cancelamento, vigência, reembolso e cobrança obedecem às condições apresentadas no checkout e à legislação aplicável.',
    ],
  },
  {
    title: '5. Limitação de responsabilidade',
    paragraphs: [
      'A plataforma é uma ferramenta de apoio aos estudos e não garante aprovação. Resultados dependem também da preparação e das circunstâncias de cada candidato.',
    ],
  },
];
