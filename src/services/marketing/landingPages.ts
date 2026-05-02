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

import type {
  MarketingLandingComparisonRow,
  MarketingLandingFaqItem,
  MarketingLandingPage,
  MarketingLandingPlanCard,
  PlanName,
} from '@types';

const buildLandingId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeText = (value: unknown, fallback: string) => {
  const normalized = String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized !== '' ? normalized : fallback;
};

const sanitizeMarketingUrl = (value: unknown, fallback = '') => {
  const normalized = sanitizeText(value, '').trim();
  if (normalized === '') {
    return fallback;
  }

  if (/^(https?:\/\/|\/)/i.test(normalized)) {
    return normalized;
  }

  return fallback;
};

export const normalizeLandingSlug = (value: string) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

export const buildMarketingLandingPath = (slug: string) => {
  const normalizedSlug = normalizeLandingSlug(slug);
  if (normalizedSlug === 'planos') {
    return '/planos';
  }

  if (normalizedSlug === 'elite') {
    return '/elite';
  }

  return `/l/${normalizedSlug}`;
};

const createDefaultPlanCards = (): MarketingLandingPlanCard[] => ([
  {
    id: buildLandingId('plan-card'),
    title: 'Plano Básico',
    planName: 'Essencial',
    badge: 'Entrada inteligente',
    description: 'Para quem quer sair do improviso, praticar com consistência e ganhar clareza no estudo.',
    ctaLabel: 'Escolher Básico',
    summaryBenefits: [
      'Milhares de questões para praticar com foco',
      'Gabaritos comentados para aprender com cada erro',
      'Filtros para montar estudos com mais direção',
    ],
  },
  {
    id: buildLandingId('plan-card'),
    title: 'Plano Avançado',
    planName: 'Pro',
    badge: 'Mais vendido',
    description: 'Para quem já leva a preparação a sério e quer revisar, medir desempenho e manter constância.',
    ctaLabel: 'Escolher Avançado',
    summaryBenefits: [
      'Simulados para medir ritmo e evolução',
      'Análises detalhadas por disciplina, banca e assunto',
      'Recursos premium para estudar com mais profundidade',
    ],
  },
  {
    id: buildLandingId('plan-card'),
    title: 'Plano Elite',
    planName: 'Elite',
    badge: 'Mais completo',
    description: 'Para quem quer estudar sem limitações, acompanhar a própria evolução com precisão e buscar vantagem competitiva real.',
    ctaLabel: 'Assinar Plano Elite',
    featured: true,
    summaryBenefits: [
      'Acesso ao conjunto mais robusto de recursos premium',
      'Leitura profunda do desempenho para ajustar a rota',
      'Mais consistência, clareza e poder de execução até a prova',
    ],
  },
]);

const createDefaultComparisonRows = (): MarketingLandingComparisonRow[] => ([
  {
    id: buildLandingId('comparison-row'),
    label: 'Acesso a questões',
    values: { Essencial: 'Completo', Pro: 'Completo', Elite: 'Completo' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Gabaritos comentados',
    values: { Essencial: 'Essenciais', Pro: 'Avançados', Elite: 'Avançados + contexto premium' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Simulados',
    values: { Essencial: 'Limitados', Pro: 'Ilimitados', Elite: 'Ilimitados + foco estratégico' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Filtros avançados',
    values: { Essencial: 'Base', Pro: 'Completo', Elite: 'Completo' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Análises detalhadas',
    values: { Essencial: 'Resumo', Pro: 'Profundas', Elite: 'Profundas + visão competitiva' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Área de dúvidas respondidas',
    values: { Essencial: 'Não', Pro: 'Sim', Elite: 'Sim' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Organização de estudo',
    values: { Essencial: 'Boa', Pro: 'Avançada', Elite: 'Avançada' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Recursos premium',
    values: { Essencial: 'Parcial', Pro: 'Amplo', Elite: 'Total' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Experiência sem anúncios',
    values: { Essencial: 'Não', Pro: 'Sim', Elite: 'Sim' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Suporte a estudo avançado',
    values: { Essencial: 'Base', Pro: 'Forte', Elite: 'Máximo' },
  },
]);

const createDefaultFaq = (): MarketingLandingFaqItem[] => ([
  {
    id: buildLandingId('faq'),
    question: 'O que está incluso em cada plano?',
    answer: 'Cada plano libera um nível diferente de profundidade. O Básico atende quem quer começar com direção, o Avançado amplia análise e simulados, e o Elite entrega a experiência mais completa para estudar com profundidade e constância.',
  },
  {
    id: buildLandingId('faq'),
    question: 'Como funciona o acesso após a compra?',
    answer: 'Assim que o pagamento é aprovado, o acesso é liberado no mesmo fluxo da plataforma e a assinatura fica disponível no seu perfil.',
  },
  {
    id: buildLandingId('faq'),
    question: 'Posso cancelar depois?',
    answer: 'Sim. A gestão da assinatura segue o fluxo oficial da plataforma e você pode cancelar a renovação quando quiser, respeitando as regras do plano contratado.',
  },
  {
    id: buildLandingId('faq'),
    question: 'Como funciona a garantia?',
    answer: 'Você pode testar a experiência e, se se arrepender dentro do prazo de 7 dias, solicitar reembolso conforme a política vigente.',
  },
  {
    id: buildLandingId('faq'),
    question: 'O Plano Elite inclui todos os recursos premium?',
    answer: 'Sim. O Elite foi desenhado para concentrar o pacote mais robusto da plataforma, com acesso amplo aos recursos premium voltados para performance e consistência.',
  },
  {
    id: buildLandingId('faq'),
    question: 'O checkout é seguro?',
    answer: 'Sim. O fluxo de cobrança usa o checkout oficial da plataforma com Stripe e mantém as validações de segurança e renovação já adotadas no produto.',
  },
]);

const createEliteOnlyPlanCards = (): MarketingLandingPlanCard[] => ([
  {
    id: buildLandingId('plan-card'),
    title: 'Plano Gratuito',
    planName: 'Gratuito',
    badge: 'Comece sem risco',
    description: 'Para experimentar a plataforma, praticar o basico e entender como a rotina evolui com uma base organizada.',
    ctaLabel: 'Comecar gratis',
    summaryBenefits: [
      'Entrada gratuita para conhecer o fluxo da plataforma',
      'Pratica inicial para sair do estudo sem direcao',
      'Acesso imediato para testar antes de assinar',
    ],
  },
  {
    id: buildLandingId('plan-card'),
    title: 'Plano Elite',
    planName: 'Elite',
    badge: 'Mais completo',
    description: 'Para quem quer estudar com profundidade, acompanhar a evolucao com precisao e buscar alta performance sem limitacoes.',
    ctaLabel: 'Assinar Plano Elite',
    featured: true,
    summaryBenefits: [
      'Milhares de questoes para praticar com volume real',
      'Gabaritos comentados e recursos premium para revisar melhor',
      'Analises detalhadas, simulados e leitura profunda da evolucao',
    ],
  },
]);

const createEliteOnlyComparisonRows = (): MarketingLandingComparisonRow[] => ([
  {
    id: buildLandingId('comparison-row'),
    label: 'Acesso a questoes',
    values: { Gratuito: 'Limitado por dia', Elite: 'Completo e sem limites' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Gabaritos comentados',
    values: { Gratuito: 'Basico', Elite: 'Contexto premium para aprender com cada erro' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Simulados',
    values: { Gratuito: 'Nao', Elite: 'Ilimitados com analise detalhada' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Filtros avancados',
    values: { Gratuito: 'Basicos', Elite: 'Completos para estudo estrategico' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Analises detalhadas',
    values: { Gratuito: 'Resumo simples', Elite: 'Leitura profunda por disciplina, banca e assunto' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Area de duvidas respondidas',
    values: { Gratuito: 'Nao', Elite: 'Sim' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Experiencia sem anuncios',
    values: { Gratuito: 'Nao', Elite: 'Sim' },
  },
  {
    id: buildLandingId('comparison-row'),
    label: 'Recursos premium',
    values: { Gratuito: 'Nao', Elite: 'Pacote completo' },
  },
]);

export const createDefaultPlansLandingPage = (siteName = 'ConcursoMestre'): MarketingLandingPage => {
  const now = new Date().toISOString();

  return {
    id: buildLandingId('landing'),
    title: 'Landing de Planos',
    slug: 'planos',
    status: 'published',
    pageType: 'plans',
    linkedPlanId: null,
    hero: {
      eyebrow: 'Preparação premium',
      title: 'Estude com mais estratégia, pratique sem limites e acelere sua aprovação',
      description: `Plataforma completa para concursos com milhares de questões, gabaritos comentados, análises detalhadas, simulados, recursos de revisão e acompanhamento da sua evolução no ${siteName}.`,
      primaryCtaLabel: 'Assinar Plano Elite',
      secondaryCtaLabel: 'Ver planos',
      proof: 'Checkout seguro, garantia de 7 dias e acesso liberado após a aprovação.',
    },
    planCards: createDefaultPlanCards(),
    authoritySection: {
      eyebrow: 'Autoridade e valor',
      title: 'Uma preparação robusta em um só lugar',
      description: 'Você encontra o volume, a análise e a organização que faltam quando o estudo depende de várias ferramentas soltas.',
      items: [
        { title: 'Milhares de questões de concursos', description: 'Volume real para praticar todos os dias e construir repertório competitivo.' },
        { title: 'Gabaritos comentados', description: 'Entenda o raciocínio das respostas e transforme erro em revisão útil.' },
        { title: 'Análises detalhadas de desempenho', description: 'Veja onde você perde ponto e ajuste o estudo por disciplina, banca e assunto.' },
        { title: 'Simulados e filtros estratégicos', description: 'Monte sessões sob medida e teste sua preparação com ritmo de prova.' },
        { title: 'Cadernos e organização do progresso', description: 'Mantenha a rotina mais estruturada e acompanhe o que já evoluiu.' },
        { title: 'Área de dúvidas respondidas', description: 'Aprofunde a preparação com apoio para sair de impasses mais rápido.' },
      ],
    },
    valueMatrix: {
      eyebrow: 'Valor percebido',
      title: 'O que você faz, recebe e conquista',
      whatYouDo: [
        'Pratica com milhares de questões',
        'Monta cadernos e simulados sob medida',
        'Acompanha o desempenho com profundidade',
        'Revisa com mais inteligência e foco',
      ],
      whatYouReceive: [
        'Gabaritos comentados',
        'Análises detalhadas',
        'Recursos premium de estudo',
        'Área de dúvidas respondidas',
        'Ferramentas para organizar a preparação',
      ],
      whatYouConquer: [
        'Mais clareza no estudo',
        'Mais consistência na rotina',
        'Decisões melhores sobre o que revisar',
        'Evolução mais visível',
        'Preparo mais competitivo',
      ],
    },
    eliteSection: {
      eyebrow: 'Plano Elite',
      title: 'Para quem quer estudar com profundidade, consistência e vantagem competitiva',
      description: 'O Elite concentra a experiência mais completa da plataforma para quem não quer limitar treino, revisão e leitura do desempenho.',
      bullets: [
        'Estude sem limitações de volume e profundidade',
        'Tenha acesso ao conjunto mais forte de recursos premium',
        'Acompanhe sua evolução com mais precisão e contexto',
        'Ganhe mais clareza sobre onde melhorar antes da prova',
        'Sustente uma rotina mais séria e profissional de preparação',
      ],
      ctaLabel: 'Quero assinar o Elite',
    },
    comparisonRows: createDefaultComparisonRows(),
    objections: [
      {
        title: 'Ainda estou começando',
        description: 'A landing foi desenhada para mostrar um caminho claro: você pode começar com uma entrada mais acessível e evoluir para o Elite quando quiser mais profundidade.',
      },
      {
        title: 'Não sei por onde estudar',
        description: 'Os filtros, simulados e análises ajudam a transformar dúvida em direção prática sobre o que treinar e revisar.',
      },
      {
        title: 'Tenho pouco tempo',
        description: 'A plataforma reduz desperdício com organização, priorização e leitura rápida dos pontos fracos.',
      },
      {
        title: 'Já usei outras plataformas e não mantive constância',
        description: 'Aqui o foco é rotina com clareza: treino, revisão e acompanhamento da evolução no mesmo fluxo.',
      },
      {
        title: 'Não quero correr risco',
        description: 'A garantia de 7 dias reduz a fricção de entrada e permite avaliar a experiência com mais segurança.',
      },
    ],
    guarantee: {
      title: '7 dias de garantia',
      description: 'Você pode testar a experiência, entender se ela faz sentido para sua preparação e solicitar reembolso dentro do prazo de arrependimento.',
    },
    faq: createDefaultFaq(),
    finalCta: {
      title: 'Sua preparação pode ser mais estratégica a partir de hoje',
      description: 'Escolha o plano ideal para o seu momento e comece a estudar com mais clareza, profundidade e constância.',
      primaryCtaLabel: 'Assinar Plano Elite',
      secondaryCtaLabel: 'Comparar planos',
    },
    seo: {
      title: `${siteName} | Planos de assinatura para estudar com mais estratégia`,
      metaDescription: `Compare os planos do ${siteName} e escolha a assinatura ideal para estudar com milhares de questões, gabaritos comentados, simulados e análises detalhadas.`,
      canonicalUrl: '',
      ogTitle: `${siteName} | Escolha o plano ideal para acelerar sua preparação`,
      ogDescription: 'Conheça os planos de assinatura com foco em evolução, constância e vantagem competitiva para concursos.',
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const createDefaultEliteLandingPage = (siteName = 'ConcursoMestre'): MarketingLandingPage => {
  const now = new Date().toISOString();

  return {
    id: buildLandingId('landing'),
    title: 'Landing Plano Elite',
    slug: 'elite',
    status: 'published',
    pageType: 'plans',
    linkedPlanId: null,
    hero: {
      eyebrow: 'Plano Elite',
      title: 'Estude no nivel mais alto da plataforma e transforme esforco em progresso real',
      description: `O ${siteName} entrega milhares de questoes, gabaritos comentados, simulados, analises detalhadas e recursos premium para quem quer preparar serio e com mais vantagem competitiva.`,
      primaryCtaLabel: 'Assinar Plano Elite',
      secondaryCtaLabel: 'Comparar com o gratuito',
      proof: 'Comece gratis se quiser testar a base. Quando quiser profundidade total, o Elite concentra a experiencia mais completa.',
    },
    planCards: createEliteOnlyPlanCards(),
    authoritySection: {
      eyebrow: 'Por que o Elite',
      title: 'Um pacote premium para estudar com mais clareza, constancia e profundidade',
      description: 'A proposta aqui nao e ter mais ferramentas soltas. E reunir treino, revisao, analise e organizacao em um fluxo que realmente ajuda a evoluir.',
      items: [
        { title: 'Milhares de questoes de concursos', description: 'Volume robusto para praticar todos os dias e construir repertorio competitivo.' },
        { title: 'Gabaritos comentados', description: 'Entenda o raciocinio das respostas e acelere a revisao do que ainda trava sua performance.' },
        { title: 'Analises detalhadas de desempenho', description: 'Visualize onde voce perde ponto e priorize o que precisa melhorar com mais criterio.' },
        { title: 'Simulados e filtros estrategicos', description: 'Monte sessoes sob medida, simule prova e ajuste o estudo com mais direcao.' },
        { title: 'Organizacao do progresso', description: 'Mantenha rotina, cadernos e leitura da evolucao em um fluxo mais profissional.' },
        { title: 'Area de duvidas respondidas', description: 'Aprofunde a preparacao e destrave pontos importantes com mais rapidez.' },
      ],
    },
    valueMatrix: {
      eyebrow: 'Valor do Elite',
      title: 'O que voce faz, recebe e conquista no plano mais completo',
      whatYouDo: [
        'Pratica com milhares de questoes sem limite de profundidade',
        'Monta cadernos, filtros e simulados sob medida',
        'Revisa com mais criterio e menos improviso',
        'Acompanha sua evolucao com mais clareza',
      ],
      whatYouReceive: [
        'Gabaritos comentados',
        'Analises detalhadas',
        'Simulados e recursos premium',
        'Area de duvidas respondidas',
        'Experiencia mais limpa e focada',
      ],
      whatYouConquer: [
        'Mais direcao no estudo',
        'Mais consistencia na rotina',
        'Decisoes melhores sobre o que revisar',
        'Evolucao visivel',
        'Preparo mais competitivo',
      ],
    },
    eliteSection: {
      eyebrow: 'Destaque Elite',
      title: 'Para quem nao quer estudar no escuro e precisa de uma preparacao mais forte',
      description: 'O Elite foi desenhado para quem quer sair do improviso, estudar com profundidade e ter acesso ao conjunto mais completo de recursos da plataforma.',
      bullets: [
        'Acesso amplo ao melhor conjunto de recursos premium',
        'Leitura profunda do desempenho para ajustar a rota',
        'Mais clareza sobre o que treinar, revisar e priorizar',
        'Rotina de estudo mais seria, organizada e consistente',
        'Mais poder de execucao ate a prova',
      ],
      ctaLabel: 'Quero assinar o Elite',
    },
    comparisonRows: createEliteOnlyComparisonRows(),
    objections: [
      {
        title: 'Ainda estou comecando',
        description: 'Voce pode entrar pelo gratuito para conhecer o fluxo. Quando quiser mais volume, analise e profundidade, a migracao para o Elite faz sentido natural.',
      },
      {
        title: 'Nao sei por onde estudar',
        description: 'O Elite ajuda justamente a reduzir essa incerteza com filtros, simulados e leitura clara do desempenho.',
      },
      {
        title: 'Tenho pouco tempo',
        description: 'Quanto menos tempo voce tem, mais importa estudar com criterio. O Elite reduz desperdicio e melhora a priorizacao.',
      },
      {
        title: 'Nao quero correr risco',
        description: 'A garantia de 7 dias existe para diminuir a friccao e permitir avaliar a experiencia com mais seguranca.',
      },
    ],
    guarantee: {
      title: '7 dias de garantia',
      description: 'Voce pode testar a experiencia completa e, se se arrepender dentro do prazo, solicitar reembolso conforme a politica vigente.',
    },
    faq: [
      {
        id: buildLandingId('faq'),
        question: 'O que o Plano Elite inclui?',
        answer: 'O Elite concentra o pacote mais completo da plataforma, com acesso amplo a questoes, gabaritos comentados, simulados, analises detalhadas e recursos premium de estudo.',
      },
      {
        id: buildLandingId('faq'),
        question: 'Vale a pena comecar no gratuito antes?',
        answer: 'Sim. O gratuito ajuda a conhecer a base. O Elite entra quando voce quer mais profundidade, mais leitura da evolucao e menos limitacoes na rotina.',
      },
      {
        id: buildLandingId('faq'),
        question: 'Como funciona o acesso apos a compra?',
        answer: 'Assim que o pagamento e aprovado, a assinatura fica disponivel no seu perfil e o acesso premium e liberado no fluxo oficial da plataforma.',
      },
      {
        id: buildLandingId('faq'),
        question: 'O checkout e seguro?',
        answer: 'Sim. O fluxo usa o checkout oficial da plataforma com Stripe e respeita as validacoes de seguranca ja adotadas no produto.',
      },
    ],
    finalCta: {
      title: 'Se a sua meta e estudar com mais profundidade, o Elite e o proximo passo natural',
      description: 'Comece gratis se quiser testar a base. Quando quiser uma preparacao mais completa, clara e competitiva, o Plano Elite esta pronto para isso.',
      primaryCtaLabel: 'Assinar Plano Elite',
      secondaryCtaLabel: 'Ver comparacao',
    },
    seo: {
      title: `${siteName} | Plano Elite para estudar com mais profundidade`,
      metaDescription: `Conheca a landing do Plano Elite do ${siteName} e compare apenas com o gratuito. Mais questoes, gabaritos comentados, simulados e analises detalhadas para acelerar sua preparacao.`,
      canonicalUrl: '',
      ogTitle: `${siteName} | Plano Elite com foco em performance e vantagem competitiva`,
      ogDescription: 'Compare o gratuito com o Elite e veja por que o plano premium entrega a experiencia mais completa para estudar com seriedade.',
    },
    createdAt: now,
    updatedAt: now,
  };
};

const resolveDefaultLandingPage = (siteName: string, slug?: string | null) => {
  const normalizedSlug = normalizeLandingSlug(String(slug || ''));
  if (normalizedSlug === 'elite') {
    return createDefaultEliteLandingPage(siteName);
  }

  return createDefaultPlansLandingPage(siteName);
};

const normalizePlanName = (value: unknown): PlanName => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('elite')) return 'Elite';
  if (normalized.includes('pro')) return 'Pro';
  if (normalized.includes('essencial')) return 'Essencial';
  return 'Gratuito';
};

const normalizePlanCard = (card: Partial<MarketingLandingPlanCard>, index: number): MarketingLandingPlanCard => {
  const fallback = createDefaultPlanCards()[index] || createDefaultPlanCards()[0];

  return {
    id: sanitizeText(card.id, fallback.id),
    title: sanitizeText(card.title, fallback.title),
    planName: normalizePlanName(card.planName || fallback.planName),
    badge: sanitizeText(card.badge, fallback.badge || ''),
    description: sanitizeText(card.description, fallback.description),
    ctaLabel: sanitizeText(card.ctaLabel, fallback.ctaLabel),
    featured: typeof card.featured === 'boolean' ? card.featured : Boolean(fallback.featured),
    summaryBenefits: Array.isArray(card.summaryBenefits) && card.summaryBenefits.length > 0
      ? card.summaryBenefits.map((item) => sanitizeText(item, '')).filter(Boolean)
      : fallback.summaryBenefits,
  };
};

const normalizeComparisonRows = (rows: Partial<MarketingLandingComparisonRow>[]): MarketingLandingComparisonRow[] => {
  const fallback = createDefaultComparisonRows();
  if (!Array.isArray(rows) || rows.length === 0) {
    return fallback;
  }

  return rows.map((row, index) => ({
    id: sanitizeText(row.id, fallback[index]?.id || buildLandingId('comparison-row')),
    label: sanitizeText(row.label, fallback[index]?.label || 'Diferencial'),
    values: {
      Gratuito: row.values?.Gratuito ? sanitizeText(row.values.Gratuito, '') : undefined,
      Essencial: sanitizeText(row.values?.Essencial, fallback[index]?.values.Essencial || '-'),
      Pro: sanitizeText(row.values?.Pro, fallback[index]?.values.Pro || '-'),
      Elite: sanitizeText(row.values?.Elite, fallback[index]?.values.Elite || '-'),
    },
  }));
};

const normalizeFaq = (items: Partial<MarketingLandingFaqItem>[]): MarketingLandingFaqItem[] => {
  const fallback = createDefaultFaq();
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }

  return items.map((item, index) => ({
    id: sanitizeText(item.id, fallback[index]?.id || buildLandingId('faq')),
    question: sanitizeText(item.question, fallback[index]?.question || 'Pergunta frequente'),
    answer: sanitizeText(item.answer, fallback[index]?.answer || 'Resposta em configuração.'),
  }));
};

export const normalizeMarketingLandingPage = (page?: Partial<MarketingLandingPage> | null, siteName = 'ConcursoMestre'): MarketingLandingPage => {
  const fallback = resolveDefaultLandingPage(siteName, page?.slug);

  return {
    id: sanitizeText(page?.id, fallback.id),
    title: sanitizeText(page?.title, fallback.title),
    slug: normalizeLandingSlug(sanitizeText(page?.slug, fallback.slug)) || fallback.slug,
    status: page?.status === 'published' ? 'published' : 'draft',
    pageType: 'plans',
    linkedPlanId: typeof page?.linkedPlanId === 'number' ? page.linkedPlanId : (fallback.linkedPlanId ?? null),
    hero: {
      eyebrow: sanitizeText(page?.hero?.eyebrow, fallback.hero.eyebrow),
      title: sanitizeText(page?.hero?.title, fallback.hero.title),
      description: sanitizeText(page?.hero?.description, fallback.hero.description),
      primaryCtaLabel: sanitizeText(page?.hero?.primaryCtaLabel, fallback.hero.primaryCtaLabel),
      secondaryCtaLabel: sanitizeText(page?.hero?.secondaryCtaLabel, fallback.hero.secondaryCtaLabel),
      proof: sanitizeText(page?.hero?.proof, fallback.hero.proof),
    },
    planCards: Array.isArray(page?.planCards) && page?.planCards.length > 0
      ? page.planCards.map((card, index) => normalizePlanCard(card, index))
      : fallback.planCards,
    authoritySection: {
      eyebrow: sanitizeText(page?.authoritySection?.eyebrow, fallback.authoritySection.eyebrow),
      title: sanitizeText(page?.authoritySection?.title, fallback.authoritySection.title),
      description: sanitizeText(page?.authoritySection?.description, fallback.authoritySection.description),
      items: Array.isArray(page?.authoritySection?.items) && page.authoritySection.items.length > 0
        ? page.authoritySection.items.map((item, index) => ({
          title: sanitizeText(item.title, fallback.authoritySection.items[index]?.title || 'Benefício'),
          description: sanitizeText(item.description, fallback.authoritySection.items[index]?.description || 'Descrição em configuração.'),
        }))
        : fallback.authoritySection.items,
    },
    valueMatrix: {
      eyebrow: sanitizeText(page?.valueMatrix?.eyebrow, fallback.valueMatrix.eyebrow),
      title: sanitizeText(page?.valueMatrix?.title, fallback.valueMatrix.title),
      whatYouDo: Array.isArray(page?.valueMatrix?.whatYouDo) && page.valueMatrix.whatYouDo.length > 0
        ? page.valueMatrix.whatYouDo.map((item) => sanitizeText(item, '')).filter(Boolean)
        : fallback.valueMatrix.whatYouDo,
      whatYouReceive: Array.isArray(page?.valueMatrix?.whatYouReceive) && page.valueMatrix.whatYouReceive.length > 0
        ? page.valueMatrix.whatYouReceive.map((item) => sanitizeText(item, '')).filter(Boolean)
        : fallback.valueMatrix.whatYouReceive,
      whatYouConquer: Array.isArray(page?.valueMatrix?.whatYouConquer) && page.valueMatrix.whatYouConquer.length > 0
        ? page.valueMatrix.whatYouConquer.map((item) => sanitizeText(item, '')).filter(Boolean)
        : fallback.valueMatrix.whatYouConquer,
    },
    eliteSection: {
      eyebrow: sanitizeText(page?.eliteSection?.eyebrow, fallback.eliteSection.eyebrow),
      title: sanitizeText(page?.eliteSection?.title, fallback.eliteSection.title),
      description: sanitizeText(page?.eliteSection?.description, fallback.eliteSection.description),
      bullets: Array.isArray(page?.eliteSection?.bullets) && page.eliteSection.bullets.length > 0
        ? page.eliteSection.bullets.map((item) => sanitizeText(item, '')).filter(Boolean)
        : fallback.eliteSection.bullets,
      ctaLabel: sanitizeText(page?.eliteSection?.ctaLabel, fallback.eliteSection.ctaLabel),
    },
    comparisonRows: normalizeComparisonRows(page?.comparisonRows || []),
    objections: Array.isArray(page?.objections) && page.objections.length > 0
      ? page.objections.map((item, index) => ({
        title: sanitizeText(item.title, fallback.objections[index]?.title || 'Objeção'),
        description: sanitizeText(item.description, fallback.objections[index]?.description || 'Resposta em configuração.'),
      }))
      : fallback.objections,
    guarantee: {
      title: sanitizeText(page?.guarantee?.title, fallback.guarantee.title),
      description: sanitizeText(page?.guarantee?.description, fallback.guarantee.description),
    },
    faq: normalizeFaq(page?.faq || []),
    finalCta: {
      title: sanitizeText(page?.finalCta?.title, fallback.finalCta.title),
      description: sanitizeText(page?.finalCta?.description, fallback.finalCta.description),
      primaryCtaLabel: sanitizeText(page?.finalCta?.primaryCtaLabel, fallback.finalCta.primaryCtaLabel),
      secondaryCtaLabel: sanitizeText(page?.finalCta?.secondaryCtaLabel, fallback.finalCta.secondaryCtaLabel),
    },
    seo: {
      title: sanitizeText(page?.seo?.title, fallback.seo.title),
      metaDescription: sanitizeText(page?.seo?.metaDescription, fallback.seo.metaDescription),
      canonicalUrl: sanitizeMarketingUrl(page?.seo?.canonicalUrl, fallback.seo.canonicalUrl || ''),
      ogTitle: sanitizeText(page?.seo?.ogTitle, fallback.seo.ogTitle || ''),
      ogDescription: sanitizeText(page?.seo?.ogDescription, fallback.seo.ogDescription || ''),
    },
    createdAt: sanitizeText(page?.createdAt, fallback.createdAt),
    updatedAt: sanitizeText(page?.updatedAt, fallback.updatedAt),
  };
};

export const mergeMarketingLandingPages = (
  pages?: Partial<MarketingLandingPage>[] | null,
  siteName = 'ConcursoMestre',
): MarketingLandingPage[] => {
  if (!Array.isArray(pages)) {
    return [createDefaultPlansLandingPage(siteName), createDefaultEliteLandingPage(siteName)];
  }

  if (pages.length === 0) {
    return [];
  }

  const normalized = pages.map((page) => normalizeMarketingLandingPage(page, siteName));
  const hasPlanos = normalized.some((page) => page.slug === 'planos');
  const hasElite = normalized.some((page) => page.slug === 'elite');

  if (!hasPlanos) {
    normalized.unshift(createDefaultPlansLandingPage(siteName));
  }

  if (!hasElite) {
    normalized.push(createDefaultEliteLandingPage(siteName));
  }

  return normalized;
};

export const duplicateMarketingLandingPage = (page: MarketingLandingPage): MarketingLandingPage => {
  const now = new Date().toISOString();
  return {
    ...page,
    id: buildLandingId('landing'),
    title: `${page.title} (Cópia)`,
    slug: `${normalizeLandingSlug(page.slug)}-copia`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    planCards: page.planCards.map((card) => ({ ...card, id: buildLandingId('plan-card') })),
    comparisonRows: page.comparisonRows.map((row) => ({ ...row, id: buildLandingId('comparison-row') })),
    faq: page.faq.map((item) => ({ ...item, id: buildLandingId('faq') })),
  };
};

export const getPublishedMarketingLandingBySlug = (pages: MarketingLandingPage[], slug: string) => {
  const normalizedSlug = normalizeLandingSlug(slug);
  return pages.find((page) => page.status === 'published' && normalizeLandingSlug(page.slug) === normalizedSlug) || null;
};

export const getMarketingLandingPreviewById = (pages: MarketingLandingPage[], id?: string | null) => {
  const normalizedId = String(id || '').trim();
  if (normalizedId === '') {
    return null;
  }

  return pages.find((page) => page.id === normalizedId) || null;
};
