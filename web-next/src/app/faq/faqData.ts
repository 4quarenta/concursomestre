export type FaqQuestion = {
  q: string;
  a: string;
};

export type FaqCategory = {
  category: string;
  questions: FaqQuestion[];
};

export const FAQ_DATA: FaqCategory[] = [
  {
    category: 'Gamificação e nível',
    questions: [
      {
        q: 'Como ganho XP e subo de nível?',
        a: 'O XP é conquistado resolvendo questões: cada acerto concede 10 XP e cada erro 2 XP. Cada nível exige 1000 XP para ser completado.',
      },
      {
        q: 'O que é o sistema de reputação?',
        a: 'Sua reputação cresce quando seus comentários ajudam outros usuários. Curtidas em respostas e colaborações relevantes aumentam esse indicador.',
      },
      {
        q: 'Qual a vantagem de ter um nível alto?',
        a: 'Níveis mais altos refletem constância, destravam conquistas e fortalecem sua posição em rankings e experiências futuras da plataforma.',
      },
    ],
  },
  {
    category: 'Assinaturas e reembolso',
    questions: [
      {
        q: 'Como funcionam os planos e a renovação?',
        a: 'Os planos mensal, trimestral e anual podem ter renovação automática. A gestão fica disponível na área de assinatura do perfil.',
      },
      {
        q: 'Tenho direito a reembolso?',
        a: 'Sim. O pedido pode ser feito dentro da janela legal prevista para arrependimento ou conforme as regras do fluxo de estorno exibidas na plataforma.',
      },
      {
        q: 'Como cancelo minha assinatura?',
        a: 'O cancelamento da recorrência fica disponível em Perfil > Assinatura. O acesso premium permanece até o fim do período já pago.',
      },
    ],
  },
  {
    category: 'Ferramentas de estudo',
    questions: [
      {
        q: 'O que é o Raio-X da banca?',
        a: 'É a análise estatística que mostra recorrência de temas, padrão de cobrança e dificuldade por banca examinadora.',
      },
      {
        q: 'Como funciona a mentoria por IA?',
        a: 'A IA cruza desempenho, histórico e padrões de estudo para sugerir foco, sequência e reforço de revisão.',
      },
      {
        q: 'O que são os simulados inéditos?',
        a: 'São provas montadas para replicar estilo de edital e banca, com correção, ranking e análise de desempenho.',
      },
    ],
  },
  {
    category: 'Marketplace de materiais',
    questions: [
      {
        q: 'Como acesso os materiais que comprei?',
        a: 'Os materiais ficam disponíveis na área do Marketplace e no seu histórico de compras, com acesso ao arquivo e itens relacionados.',
      },
      {
        q: 'Quem cria os materiais do Marketplace?',
        a: 'Os materiais podem ser publicados por parceiros e autores validados, com fluxo de moderação e controle administrativo.',
      },
    ],
  },
  {
    category: 'Indicações e bônus',
    questions: [
      {
        q: 'Como funciona o Indique e Ganhe?',
        a: 'Cada usuário possui um código ou link próprio. Quando um indicado se cadastra ou assina, a plataforma calcula os bônus previstos para a campanha ativa.',
      },
    ],
  },
  {
    category: 'Suporte e segurança',
    questions: [
      {
        q: 'Como falar com o suporte técnico?',
        a: 'Use a tela de suporte para abrir um chamado, enviar sugestões ou relatar problemas. O histórico fica centralizado por conversa.',
      },
      {
        q: 'Meus dados de pagamento estão seguros?',
        a: 'Sim. O processamento passa pelos gateways oficiais e a plataforma evita armazenar dados sensíveis completos de cartão.',
      },
    ],
  },
];
