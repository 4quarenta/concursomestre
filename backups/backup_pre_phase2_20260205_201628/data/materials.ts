
import { Material, Subject } from '../types';

export const MOCK_MATERIALS: Material[] = [
  {
    id: 'm1',
    title: 'Resumão de Direito Constitucional - Art. 5º',
    description: 'Um guia completo e esquematizado sobre os Direitos e Garantias Fundamentais. Ideal para revisão rápida pré-prova.',
    authorId: 'partner1',
    authorName: 'Prof. Direito Fácil',
    price: 0,
    type: 'PDF',
    subject: Subject.LAW,
    examTarget: 'Geral',
    coverUrl: 'https://img.freepik.com/free-vector/gradient-law-firm-logo-design_23-2149346617.jpg',
    status: 'approved',
    salesCount: 150,
    rating: 4.8,
    createdAt: Date.now() - 10000000,
    // Fix: Added missing comments field
    comments: []
  },
  {
    id: 'm2',
    title: '100 Questões Comentadas de Português - FGV',
    description: 'Foco total na banca FGV. Questões recentes de 2023 e 2024 com gabarito comentado detalhadamente.',
    authorId: 'partner1',
    authorName: 'Prof. Direito Fácil',
    price: 29.90,
    type: 'PDF',
    subject: Subject.PORTUGUESE,
    examTarget: 'Tribunais',
    status: 'approved',
    salesCount: 45,
    rating: 4.5,
    createdAt: Date.now() - 5000000,
    // Fix: Added missing comments field
    comments: []
  },
  {
    id: 'm3',
    title: 'Simulado Reta Final - Polícia Federal',
    description: 'Simulado completo com 120 questões estilo Certo/Errado. Inclui informática pesada e contabilidade.',
    authorId: 'u-joao',
    authorName: 'João Concurseiro',
    price: 14.90,
    type: 'Simulado',
    subject: Subject.INFORMATICS,
    examTarget: 'Polícia Federal',
    status: 'pending', // Pendente de aprovação
    salesCount: 0,
    rating: 0,
    createdAt: Date.now(),
    // Fix: Added missing comments field
    comments: []
  }
];