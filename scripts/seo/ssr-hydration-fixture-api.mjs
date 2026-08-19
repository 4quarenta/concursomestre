#!/usr/bin/env node

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

import { createServer } from 'node:http';

const port = Number(process.env.CM_SSR_FIXTURE_API_PORT || process.argv[2] || 3298);
const annotatedLawsEnabled = String(process.env.CM_SSR_LAW_MODULE_ENABLED || 'true').toLowerCase() !== 'false';
const counts = new Map();
const count = (pathname) => counts.set(pathname, (counts.get(pathname) || 0) + 1);
const json = (response, status, payload, origin = '*') => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-auth-token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
};

const category = { id: 1, label: 'Concursos', slug: 'concursos', description: 'Notícias de concursos', articleCount: 1 };
const tag = { id: 1, label: 'Nordeste', slug: 'nordeste', kind: 'region', articleCount: 1 };
const article = {
  id: 1,
  title: 'Notícia SSR de teste',
  slug: 'noticia-ssr',
  excerpt: 'Conteúdo editorial público usado pelo harness semântico.',
  readingMinutes: 3,
  bodyHtml: '<h2>Conteúdo da notícia</h2><p>Informação pública estável para validar SSR e hidratação.</p>',
  bodyText: 'Conteúdo da notícia. Informação pública estável para validar SSR e hidratação.',
  coverImageUrl: '',
  coverImageAlt: '',
  status: 'published',
  featured: true,
  allowComments: true,
  publishedAt: '2026-08-01T12:00:00Z',
  createdAt: '2026-08-01T12:00:00Z',
  updatedAt: '2026-08-01T12:00:00Z',
  taxonomy: { category, tags: [tag] },
  author: { id: 'staff-1', name: 'Equipe ConcursoMestre', role: 'staff', avatarUrl: null },
  engagement: { likesCount: 0, commentsCount: 0, isLiked: false },
};
const examItem = {
  id: 101,
  title: 'Prova SSR 2026',
  slug: 'prova-ssr-2026',
  year: 2026,
  board: 'CEBRASPE',
  boardSlug: 'cebraspe',
  organizations: ['Órgão de Teste'],
  questionCount: 1,
  proofUrl: null,
  answerKeyUrl: null,
  stateCode: 'PB',
  stateName: 'Paraíba',
  region: 'Nordeste',
};
const exam = {
  ...examItem,
  officialTitle: 'Prova oficial SSR 2026',
  shortTitle: 'Prova SSR',
  noticeNumber: '01/2026',
  level: 'Superior',
  registrationStart: '2026-01-01',
  registrationEnd: '2026-01-31',
  examDate: '2026-03-01',
  resultDate: '2026-04-01',
  vacancies: 10,
  reserveVacancies: 2,
  officialUrl: null,
  board: { id: 10, name: 'Centro Brasileiro de Pesquisa em Avaliação', slug: 'cebraspe' },
  organizations: [{ id: 11, name: 'Órgão de Teste', slug: 'orgao-de-teste' }],
  roles: [{ id: 12, name: 'Analista', slug: 'analista' }],
  careers: [],
  areas: [],
  subjects: [{ id: 13, name: 'Direito Administrativo', slug: 'direito-administrativo' }],
  examTypes: [],
  files: [],
  relatedExams: [],
};
const board = {
  id: 10,
  name: 'Centro Brasileiro de Pesquisa em Avaliação',
  slug: 'cebraspe',
  acronym: 'CEBRASPE',
  description: 'Banca pública de teste usada pelo harness SSR.',
  imageUrl: null,
  questionCount: 1,
  examCount: 1,
  website: 'https://example.com',
};
const organization = {
  id: 11,
  slug: 'orgao-de-teste',
  name: 'Órgão de Teste',
  acronym: 'ODT',
  description: 'Órgão público usado para validar a landing SSR.',
  website: 'https://example.com/orgao',
  imageUrl: null,
  stateCode: 'PB',
  sphere: 'Estadual',
  canonicalPath: '/orgaos/orgao-de-teste',
  questionsPath: '/questoes?orgao=%C3%93rg%C3%A3o%20de%20Teste',
  questionCount: 1,
  examCount: 1,
  roles: [{ id: 12, name: 'Analista', questionsPath: '/questoes?cargo=Analista' }],
  disciplines: [{ id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', questionCount: 1, path: '/disciplinas/direito-constitucional' }],
  boards: [{ id: 10, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', examCount: 1, path: '/bancas/cebraspe' }],
  exams: [{ id: 101, slug: 'prova-ssr-2026', name: 'Prova SSR 2026', year: 2026, questionCount: 1, path: '/provas/prova-ssr-2026' }],
  questions: [{ id: 67813, excerpt: 'Art. 5º — Ação & Controle', updatedAt: '2026-08-18', path: '/questoes/67813/art-5o-acao-e-controle', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Órgãos', canonicalPath: '/orgaos' },
    { label: 'Órgão de Teste', canonicalPath: '/orgaos/orgao-de-teste' },
  ],
  updatedAt: '2026-08-18T12:00:00Z',
  externalImporterIdentity: 'SECRET_IMPORTER_SENTINEL',
  adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};
const lawSummary = {
  id: 'law-1', slug: 'constituicao-federal', title: 'Constituição Federal', shortTitle: 'CF',
  summary: 'Texto constitucional público.', articleCount: 1, commentedArticleCount: 1,
};
const protectedLaw = {
  ...lawSummary,
  status: 'published',
  officialUrl: 'https://www.planalto.gov.br/',
  area: { id: 1, name: 'Constitucional', slug: 'constitucional' },
  sections: [{ id: 'section-1', lawId: 'law-1', slug: 'direitos', title: 'Direitos fundamentais', fromArticle: 1, toArticle: 1, articleCount: 1, sortOrder: 1 }],
  articles: [{
    id: 'article-1', lawId: 'law-1', sectionId: 'section-1', slug: 'artigo-5', number: '5',
    title: 'Art. 5º', text: 'Todos são iguais perante a lei.',
    comentarios: [{ body: 'SECRET_EDITORIAL_SENTINEL_123' }],
  }],
  sectionEditorials: [{
    id: 'editorial-1', lawId: 'law-1', sectionId: 'section-1', sectionTitle: 'Direitos fundamentais',
    summary: 'SECRET_SUMMARY_SENTINEL_456', blocks: [{ type: 'text', content: 'SECRET_BLOCK_SENTINEL_789' }],
  }],
  features: {
    'lei.comentario_basico': { feature_key: 'lei.comentario_basico', mode: 'locked', fallback_mode: 'locked', enabled: true, requires_plan: true },
    'lei.raiox': { feature_key: 'lei.raiox', mode: 'locked', fallback_mode: 'locked', enabled: true, requires_plan: true },
  },
  hasLockedFeatures: true,
  planAccess: { planName: 'Gratuito', status: 'active' },
};
const question = {
  id: 67813,
  enunciado: '<p>Art. 5º — Ação & Controle</p>',
  enunciado_clean: 'Art. 5º — Ação & Controle',
  status: 'published',
  visibility: 'public',
  tipo: 'multipla escolha',
  dificuldade: 2,
  itens: [
    { id: 'a', texto: 'Alternativa pública A' },
    { id: 'b', texto: 'Alternativa pública B' },
  ],
  alternativas: [
    { id: 'a', texto: 'Alternativa pública A' },
    { id: 'b', texto: 'Alternativa pública B' },
  ],
  materias: [{ id: 1, nome: 'Direito Constitucional', slug: 'direito-constitucional' }],
  assuntos: [{ id: 2, nome: 'Direitos fundamentais', slug: 'direitos-fundamentais' }],
  bancas: [{ id: 10, nome: 'CEBRASPE', sigla: 'CEBRASPE', slug: 'cebraspe' }],
  orgaos: [], cargos: [], anos: [2026],
};

const pageInfo = { page: 1, perPage: 30, pages: 1, total: 1, hasPrevious: false, hasMore: false };

const payloadFor = (url) => {
  const pathname = url.pathname.replace(/^\/api\//, '/');
  if (pathname === '/settings.php') return {
    success: true,
    data: {
      loginRequired: false,
      maintenanceMode: false,
      features: {
        annotatedLawsEnabled,
        practiceEnabled: true,
        supportDonationsEnabled: true,
      },
    },
  };
  if (pathname === '/auth/me.php') return { success: true, data: { user: null } };
  if (pathname === '/notifications/list.php') return { success: true, data: { items: [], unreadCount: 0 } };
  if (pathname === '/questions/show.php') return { success: true, data: question };
  if (pathname === '/v2/questions/list.php' || pathname === '/questionsList') return { success: true, data: { items: [question], questions: [question], pageInfo: { limit: 20, total: 1, hasMore: false } } };
  if (pathname === '/exams/directory.php') return { success: true, data: { items: [examItem], pageInfo: { page: 1, limit: 12, totalItems: 1, totalPages: 1, hasPrevious: false, hasNext: false }, facets: { years: [2026], regions: ['Nordeste'], states: [{ code: 'PB', name: 'Paraíba' }] } } };
  if (pathname === '/exams/detail.php') return { success: true, data: { exam } };
  if (pathname === '/filters/directory.php') {
    const type = url.searchParams.get('type');
    const items = type === 'boards'
      ? [board]
      : type === 'organizations'
        ? [{ ...organization, canonicalPath: undefined, questionsPath: undefined, roles: undefined, disciplines: undefined, boards: undefined, exams: undefined, questions: undefined, breadcrumbs: undefined }]
        : [{ ...board, id: 20, name: 'Direito Constitucional', slug: 'direito-constitucional', acronym: null }];
    return { success: true, data: { items, pageInfo } };
  }
  if (pathname === '/filters/board.php') return { success: true, data: { board, examSummary: { total: 1, open: 0, upcoming: 1, completed: 0, unknown: 0 }, topSubjects: [{ id: 20, name: 'Direito Constitucional', slug: 'direito-constitucional', questionCount: 1 }], questionProfile: [{ modality: 'multiple_choice', difficulty: 2, questionCount: 1 }], exams: [{ ...examItem, organizations: ['Órgão de Teste'], registrationStart: null, registrationEnd: null, examDate: '2026-03-01', resultDate: null, status: 'upcoming' }], pageInfo } };
  if (pathname === '/filters/organization.php') return { success: true, data: organization };
  if (pathname === '/blog/detail.php') return { success: true, data: article };
  if (pathname === '/blog/list.php') return { success: true, data: { items: [article], pageInfo: { limit: 24, hasMore: false, nextCursor: null, total: 1 } } };
  if (pathname === '/blog/categories.php') return { success: true, data: { items: [category] } };
  if (pathname === '/blog/tags.php') return { success: true, data: { items: [tag] } };
  if (pathname === '/legal-commentary/list.php') return { success: true, data: { areas: [{ id: 1, name: 'Constitucional', slug: 'constitucional' }], lawsByArea: [{ area: { id: 1, name: 'Constitucional', slug: 'constitucional' }, laws: [lawSummary] }], mostAccessed: [lawSummary], favoriteLaws: [], favoriteItems: [], recentlyStudied: [], recentlyUpdated: [], totals: { laws: 1, articles: 1, commentedArticles: 1, updatedRecently: 0 } } };
  if (pathname === '/legal-commentary/detail.php') {
    return url.searchParams.get('slug') === lawSummary.slug
      ? { success: true, data: protectedLaw }
      : { success: false, message: 'Lei nao encontrada.' };
  }
  if (pathname === '/changelog/list.php') return { success: true, data: { items: [], pageInfo: { page: 1, limit: 8, total: 0, totalPages: 1, hasMore: false } } };
  if (pathname.includes('suggest')) return { success: true, data: { items: [] } };
  if (pathname === '/plans/list.php') return { success: true, data: { items: [] } };
  return { success: true, data: {} };
};

const server = createServer((request, response) => {
  const origin = request.headers.origin || '*';
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (request.method === 'OPTIONS') return json(response, 204, {}, origin);
  if (url.pathname === '/__reset') {
    counts.clear();
    return json(response, 200, { success: true }, origin);
  }
  if (url.pathname === '/__metrics') {
    return json(response, 200, { total: [...counts.values()].reduce((sum, value) => sum + value, 0), byPath: Object.fromEntries([...counts.entries()].sort()) }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/questions/show.php' && url.searchParams.get('id') !== String(question.id)) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Questao nao encontrada.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/legal-commentary/detail.php' && url.searchParams.get('slug') !== lawSummary.slug) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Lei nao encontrada.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/filters/organization.php' && url.searchParams.get('slug') !== organization.slug) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Orgao nao encontrado.' }, origin);
  }
  count(url.pathname);
  return json(response, 200, payloadFor(url), origin);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SSR_HYDRATION_FIXTURE_API|http://127.0.0.1:${port}/api/`);
});
