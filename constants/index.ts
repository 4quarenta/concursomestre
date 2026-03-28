
export const PLAN_DETAILS = {
  Gratuito: {
    color: 'bg-slate-500',
    features: [
      { text: '15 questões por dia', included: true },
      { text: 'Estatísticas básicas', included: true },
      { text: 'Comentários da comunidade', included: true },
      { text: 'Explicações via IA', included: false },
      { text: 'Sem anúncios', included: false },
      { text: 'Chat Mentor Ilimitado', included: false },
      { text: 'Simulados Exclusivos', included: false },
    ]
  },
  Essencial: {
    color: 'bg-blue-500',
    features: [
      { text: 'Questões Ilimitadas', included: true },
      { text: 'Estatísticas básicas', included: true },
      { text: 'Comentários da comunidade', included: true },
      { text: 'Sem anúncios', included: true },
      { text: 'Explicações via IA', included: false },
      { text: 'Chat Mentor Ilimitado', included: false },
      { text: 'Simulados Exclusivos', included: false },
    ]
  },
  Pro: {
    color: 'bg-indigo-600',
    popular: true,
    features: [
      { text: 'Questões Ilimitadas', included: true },
      { text: 'Análise de Desempenho Detalhada', included: true },
      { text: 'Sem anúncios', included: true },
      { text: 'Explicações via IA (Gemini)', included: true },
      { text: 'Caderno de Erros Inteligente', included: true },
      { text: 'Simulados Exclusivos', included: true },
    ]
  },
  Elite: {
    color: 'bg-amber-500',
    features: [
      { text: 'Tudo do plano Pro', included: true },
      { text: 'Chat Mentor Ilimitado', included: true },
      { text: 'Cronograma de Estudos IA', included: true },
      { text: 'Suporte Prioritário', included: true },
      { text: 'Acesso Antecipado a Recursos', included: true },
    ]
  }
};

export const PRICING = {
  Gratuito: { monthly: 0, quarterly: 0, annual: 0 },
  Essencial: { monthly: 14.90, quarterly: 39.90, annual: 118.80 },
  Pro: { monthly: 29.90, quarterly: 79.90, annual: 238.80 },
  Elite: { monthly: 54.90, quarterly: 149.90, annual: 478.80 }
};

export const CHART_COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308'];
