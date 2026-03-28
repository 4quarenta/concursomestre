// Pricing structure for all plans
export const PRICING = {
    Gratuito: {
        monthly: 0,
        quarterly: 0,
        annual: 0,
        quarterlyDiscountPercent: 0,
        annualDiscountPercent: 0
    },
    Essencial: {
        monthly: 29.90,
        quarterly: 80.73, // 10% off
        annual: 251.16, // 30% off
        quarterlyDiscountPercent: 10,
        annualDiscountPercent: 30
    },
    Pro: {
        monthly: 49.90,
        quarterly: 134.73, // 10% off
        annual: 418.86, // 30% off
        quarterlyDiscountPercent: 10,
        annualDiscountPercent: 30
    },
    Elite: {
        monthly: 79.90,
        quarterly: 215.73, // 10% off
        annual: 670.86, // 30% off
        quarterlyDiscountPercent: 10,
        annualDiscountPercent: 30
    }
};

// Plan features and details
export const PLAN_DETAILS = {
    Gratuito: {
        name: 'Gratuito',
        features: [
            { text: '50 questões por mês', included: true },
            { text: 'Filtros básicos', included: true },
            { text: 'Comentários da comunidade', included: true },
            { text: 'Análise detalhada com IA', included: false },
            { text: 'Raio-X da Banca', included: false },
            { text: 'Simulados ilimitados', included: false },
            { text: 'Caderno de erros avançado', included: false },
            { text: 'Suporte prioritário', included: false }
        ]
    },
    Essencial: {
        name: 'Essencial',
        features: [
            { text: '500 questões por mês', included: true },
            { text: 'Todos os filtros avançados', included: true },
            { text: 'Comentários da comunidade', included: true },
            { text: 'Análise detalhada com IA', included: true },
            { text: 'Raio-X da Banca (básico)', included: true },
            { text: 'Simulados ilimitados', included: false },
            { text: 'Caderno de erros avançado', included: false },
            { text: 'Suporte prioritário', included: false }
        ]
    },
    Pro: {
        name: 'Pro',
        features: [
            { text: 'Questões ilimitadas', included: true },
            { text: 'Todos os filtros avançados', included: true },
            { text: 'Comentários da comunidade', included: true },
            { text: 'Análise detalhada com IA', included: true },
            { text: 'Raio-X da Banca completo', included: true },
            { text: 'Simulados ilimitados', included: true },
            { text: 'Caderno de erros avançado', included: true },
            { text: 'Suporte prioritário', included: false }
        ]
    },
    Elite: {
        name: 'Elite',
        features: [
            { text: 'Questões ilimitadas', included: true },
            { text: 'Todos os filtros avançados', included: true },
            { text: 'Comentários da comunidade', included: true },
            { text: 'Análise detalhada com IA', included: true },
            { text: 'Raio-X da Banca completo', included: true },
            { text: 'Simulados ilimitados', included: true },
            { text: 'Caderno de erros avançado', included: true },
            { text: 'Suporte prioritário 24/7', included: true }
        ]
    }
};
