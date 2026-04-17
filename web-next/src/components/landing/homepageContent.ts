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

export const BILLING_CYCLE_OPTIONS = [
  { key: 'monthly', label: 'Mensal' },
  { key: 'quarterly', label: 'Trimestral' },
  { key: 'annual', label: 'Anual' },
] as const;

export type LandingBillingCycle = typeof BILLING_CYCLE_OPTIONS[number]['key'];

export const HERO_BENEFITS = [
  'Veja exatamente onde você está errando e o que revisar primeiro.',
  'Treine com questões e simulados que dão direção ao seu estudo.',
  'Acompanhe sua evolução com clareza e ajuste a rota mais rápido.',
];

export const PROOF_STRIP = [
  {
    title: 'Questões com foco real',
    description: 'Encontre o que faz sentido para sua prova e transforme prática em revisão útil.',
  },
  {
    title: 'Simulados que mostram nível',
    description: 'Meça ritmo, acerto e consistência antes da prova para corrigir o que pesa no resultado.',
  },
  {
    title: 'Desempenho sem achismo',
    description: 'Entenda onde você perde ponto e o que precisa melhorar agora, não depois.',
  },
  {
    title: 'Começo sem risco',
    description: 'Crie sua conta, use grátis e faça upgrade quando perceber valor real no seu estudo.',
  },
];

export const HOW_IT_HELPS = [
  {
    title: 'Pare de estudar sem direção',
    description: 'Organize sua rotina com mais clareza e saiba exatamente o que atacar primeiro no seu plano de estudo.',
  },
  {
    title: 'Encontre exatamente o que estudar',
    description: 'Use filtros para chegar rápido nas questões que combinam com sua prova, sua matéria e seu momento.',
  },
  {
    title: 'Revise com mais eficiência',
    description: 'Volte aos erros, comentários e materiais certos para revisar com contexto em vez de repetir estudo solto.',
  },
  {
    title: 'Veja onde você ainda perde ponto',
    description: 'Acompanhe por matéria e assunto onde seu desempenho cai para corrigir antes da prova.',
  },
  {
    title: 'Saiba se você está realmente evoluindo',
    description: 'Tenha uma leitura clara da sua constância, do seu volume e do seu desempenho para saber se o plano está funcionando.',
  },
  {
    title: 'Mantenha consistência até a prova',
    description: 'Centralize prática, revisão e simulados no mesmo fluxo para ganhar ritmo sem perder tempo com ferramentas separadas.',
  },
];

export const FEEDBACK_ITEMS = [
  {
    quote: 'Quando comecei a ver exatamente onde errava, parei de revisar no escuro e meu estudo ficou muito mais eficiente.',
    author: 'Larissa M.',
    context: 'Estudante para concursos policiais',
  },
  {
    quote: 'O que mais mudou foi a clareza. Hoje eu sei o que praticar, o que revisar e se estou realmente evoluindo.',
    author: 'Bruno A.',
    context: 'Preparação para área fiscal',
  },
  {
    quote: 'Entrei no gratuito para testar e subi de plano quando percebi o quanto a plataforma economizava meu tempo.',
    author: 'Camila S.',
    context: 'Preparação para OAB',
  },
];

export const OBJECTIVE_FOCUS_ITEMS = [
  {
    title: 'Concursos públicos',
    description: 'Treine com questões que realmente caem e acompanhe sua evolução por disciplina para chegar mais forte na prova.',
    bullets: [
      'Questões direcionadas por banca, assunto e perfil de prova.',
      'Simulados para medir ritmo, consistência e velocidade.',
      'Revisão estratégica para consolidar conteúdo de alta incidência.',
    ],
  },
  {
    title: 'OAB',
    description: 'Resolva questões por matéria e simule a prova com análise completa para entender onde ainda precisa subir.',
    bullets: [
      'Questões para treinar leitura jurídica, interpretação e constância.',
      'Análise de desempenho por área para revisar melhor.',
      'Rotina de prática e revisão pensada para aprovação.',
    ],
  },
  {
    title: 'ENEM',
    description: 'Pratique com foco nas competências, revise melhor e acompanhe sua evolução por área de conhecimento.',
    bullets: [
      'Questões e simulados por área e assunto.',
      'Leitura de desempenho para ajustar a preparação.',
      'Rotina mais previsível até a prova.',
    ],
  },
];

export const PLAN_COPY_BY_TIER: Record<string, { eyebrow: string; description: string; cta: string }> = {
  Gratuito: {
    eyebrow: 'Entrada sem risco',
    description: 'Entre sem pagar, teste a plataforma e descubra rápido onde você pode melhorar.',
    cta: 'Começar grátis',
  },
  Essencial: {
    eyebrow: 'Mais consistência',
    description: 'Ideal para quem quer ganhar ritmo, estudar com menos dispersão e manter a rotina sob controle.',
    cta: 'Assinar Essencial',
  },
  Pro: {
    eyebrow: 'Mais escolhido',
    description: 'Combina profundidade, revisão e análise para quem quer acelerar resultado com mais segurança.',
    cta: 'Assinar Pro',
  },
  Elite: {
    eyebrow: 'Máximo desempenho',
    description: 'Para quem quer o pacote mais completo, com mais profundidade e mais apoio para buscar alta performance.',
    cta: 'Assinar Elite',
  },
};

export const FINAL_CONVERSION_CONTENT = [
  {
    title: 'Estudar mais nem sempre significa estudar melhor',
    paragraphs: [
      'Muita gente estuda bastante, mas ainda sente que falta clareza sobre o que revisar, quais questões resolver e como organizar a rotina de estudos.',
      'Quando você enxerga o que precisa melhorar, fica mais fácil transformar esforço em progresso real e manter constância até a prova.',
    ],
  },
  {
    title: 'Tudo o que você precisa para estudar com mais direção',
    paragraphs: [
      'Com o ConcursoMestre, você reúne em um só lugar banco de questões, simulados online, revisão estratégica, análise de desempenho e materiais de estudo para concurso público, OAB e ENEM.',
      'Assim fica mais simples entender onde você está errando, acompanhar sua evolução e montar um plano de estudos mais eficiente, sem perder tempo com tentativa e erro.',
    ],
  },
];
