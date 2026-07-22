export type FaqIconKey =
  | 'target'
  | 'book'
  | 'zap'
  | 'award'
  | 'crown'
  | 'shield'
  | 'users'
  | 'help';

export type FaqEntry = {
  q: string;
  a: string;
};

export type FaqCategory = {
  category: string;
  icon: FaqIconKey;
  questions: FaqEntry[];
};

export const FAQ_DATA: FaqCategory[] = [
  {
    category: 'Questões e estudo',
    icon: 'target',
    questions: [
      {
        q: 'Como encontro questões por matéria, banca, órgão, cargo e assunto?',
        a: 'Use a página de questões para filtrar por foco, matéria, banca, órgão, ano, nível, cargo, assunto e modalidade. A prova vinculada aparece no card da questão, junto dos metadados da questão.',
      },
      {
        q: 'Qual a diferença entre “Excluir questões” e “Apenas questões com”?',
        a: 'Excluir questões remove itens do treino, como anuladas, desatualizadas, resolvidas, acertei ou errei. Apenas questões com mostra somente itens que atendem ao critério escolhido, como salvas, com comentário do professor, análise detalhada, acertei ou errei.',
      },
      {
        q: 'O que aparece no card da questão?',
        a: 'O card mostra enunciado, alternativas, banca, ano, órgão, cargo, prova vinculada, assunto, status da questão, comentários, análise detalhada, estatísticas, materiais relacionados e leis relacionadas quando houver correspondência.',
      },
      {
        q: 'Comentários do professor e análise detalhada podem ser avaliados?',
        a: 'Sim. Quando disponíveis, comentário do professor e análise detalhada possuem botões de gostei e não gostei para ajudar a plataforma a medir qualidade editorial.',
      },
    ],
  },
  {
    category: 'Lei Comentada',
    icon: 'book',
    questions: [
      {
        q: 'Como funciona a Lei Comentada?',
        a: 'A Lei Comentada organiza leis por capítulos, seções e artigos, com comentários do professor, doutrina, jurisprudência, súmulas, macetes, questões relacionadas e ferramentas de leitura.',
      },
      {
        q: 'Como o progresso de leitura é calculado?',
        a: 'O progresso principal é calculado pelos artigos vistos ou concluídos. Quando a lei não traz artigos suficientes para esse cálculo, a plataforma usa seções e o progresso registrado como apoio.',
      },
      {
        q: 'Posso pedir comentário do professor em um trecho específico?',
        a: 'Sim. Em artigos, incisos, alíneas e parágrafos, você pode solicitar comentário do professor para aquele ponto específico da lei.',
      },
      {
        q: 'Posso marcar textos na Lei Comentada?',
        a: 'Sim. A leitura possui ferramentas para destacar, sublinhar, colorir, formatar e salvar marcações do estudante no próprio leitor.',
      },
    ],
  },
  {
    category: 'Simulados e rankings',
    icon: 'zap',
    questions: [
      {
        q: 'Como funcionam os simulados?',
        a: 'Os simulados ficam em modo lista por padrão e permitem resolver blocos de questões com correção, histórico, desempenho e análise por matéria.',
      },
      {
        q: 'O ranking pós-prova é o mesmo ranking de XP?',
        a: 'Não. O ranking pós-prova classifica candidatos por pontuação em uma prova específica. O ranking de XP mede constância e avanço geral de estudo dentro da plataforma.',
      },
      {
        q: 'O que é o Raio-X da banca?',
        a: 'É uma análise da banca com recorrência de temas, dificuldade, formato provável de cobrança, características da prova e tipo de raciocínio mais cobrado.',
      },
    ],
  },
  {
    category: 'XP, nível e sequência',
    icon: 'award',
    questions: [
      {
        q: 'Como ganho XP e subo de nível?',
        a: 'Você ganha XP por estudar: acertos, erros revisados, participação em rankings e resultados oficiais podem gerar pontos. A página Níveis XP mostra as regras e o ranking por XP.',
      },
      {
        q: 'Onde vejo meu ranking de XP?',
        a: 'Acesse Níveis XP pelo menu flutuante do topo ao clicar no seu nome. Esse ranking mostra usuários por XP acumulado e não se mistura com rankings de provas específicas.',
      },
      {
        q: 'Como funciona a sequência de estudos?',
        a: 'O dashboard mostra a semana de domingo a sábado e destaca os dias em que você acessou a plataforma. Também mostra sequência atual e melhor marca.',
      },
    ],
  },
  {
    category: 'Assinaturas e reembolso',
    icon: 'crown',
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
      {
        q: 'Como altero minha forma de pagamento?',
        a: 'A área de assinatura e cobrança no perfil concentra dados de plano, status de recorrência e métodos de pagamento suportados pela plataforma.',
      },
    ],
  },
  {
    category: 'Conta e privacidade',
    icon: 'shield',
    questions: [
      {
        q: 'Posso escolher modo claro ou escuro como padrão?',
        a: 'Sim. Em Perfil > Privacidade e Preferências você define tema padrão, modo padrão de questões e modo padrão de simulados.',
      },
      {
        q: 'Posso controlar minha exposição em rankings?',
        a: 'Sim. Você pode definir perfil público, exibição de foto no ranking de XP, compartilhamento de dados e notificações nas preferências do perfil.',
      },
      {
        q: 'Excluir conta é funcional?',
        a: 'Sim. A exclusão pode ser solicitada em Perfil > Privacidade. A ação exige confirmação, motivo e segue as regras de segurança configuradas.',
      },
      {
        q: 'Meus dados de pagamento estão seguros?',
        a: 'Sim. O processamento usa provedores oficiais e a plataforma evita armazenar dados sensíveis completos de cartão.',
      },
    ],
  },
  {
    category: 'Marketplace de materiais',
    icon: 'book',
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
    icon: 'users',
    questions: [
      {
        q: 'Como funciona o Indique e Ganhe?',
        a: 'Cada usuário possui um código ou link próprio. Quando um indicado se cadastra ou assina, a plataforma calcula os bônus previstos para a campanha ativa.',
      },
    ],
  },
  {
    category: 'Suporte, avaliações e sugestões',
    icon: 'help',
    questions: [
      {
        q: 'Como falar com o suporte técnico?',
        a: 'Use a página de suporte para abrir chamado, pedir ajuda, enviar sugestão ou relatar problema. O histórico das conversas fica disponível no perfil do aluno.',
      },
      {
        q: 'O que acontece com sugestões enviadas?',
        a: 'Sugestões podem aparecer em uma área pública de votação, onde alunos podem apoiar ou rejeitar ideias com likes e dislikes.',
      },
      {
        q: 'Como avalio a plataforma?',
        a: 'No perfil, use Avaliar plataforma. O modal mostra suas avaliações anteriores e envia uma nova avaliação para revisão administrativa.',
      },
    ],
  },
];
