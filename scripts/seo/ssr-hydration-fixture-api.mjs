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
const sameSlugCategory = { id: 3, label: 'Segurança editorial', slug: 'seguranca', description: 'Categoria pública de segurança.', articleCount: 1 };
const sameSlugTag = { id: 3, label: 'Segurança temática', slug: 'seguranca', kind: 'topic', articleCount: 1 };
const taxonomyArchive = (type, slug) => {
  const taxonomy = type === 'category' && slug === category.slug
    ? { ...category, type, kind: null, imageUrl: null, lastPublishedAt: article.publishedAt, canonicalPath: `/blog/categoria/${category.slug}`, readiness: { status: 'READY', reasonCodes: [] } }
    : type === 'category' && slug === 'sem-posts'
      ? { id: 2, type, label: 'Sem posts', slug, kind: null, description: null, imageUrl: null, articleCount: 0, lastPublishedAt: null, canonicalPath: `/blog/categoria/${slug}`, readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.publication_blocked'] } }
      : type === 'category' && slug === sameSlugCategory.slug
        ? { ...sameSlugCategory, type, kind: null, imageUrl: null, lastPublishedAt: article.publishedAt, canonicalPath: `/blog/categoria/${slug}`, readiness: { status: 'READY', reasonCodes: [] } }
        : type === 'tag' && slug === tag.slug
          ? { ...tag, type, description: null, imageUrl: null, lastPublishedAt: article.publishedAt, canonicalPath: `/blog/tag/${tag.slug}`, readiness: { status: 'READY', reasonCodes: [] } }
          : type === 'tag' && slug === sameSlugTag.slug
            ? { ...sameSlugTag, type, description: null, imageUrl: null, lastPublishedAt: article.publishedAt, canonicalPath: `/blog/tag/${slug}`, readiness: { status: 'READY', reasonCodes: [] } }
            : type === 'tag' && slug === 'sem-posts'
              ? { id: 4, type, label: 'Tag sem posts', slug, kind: 'general', description: null, imageUrl: null, articleCount: 0, lastPublishedAt: null, canonicalPath: `/blog/tag/${slug}`, readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.publication_blocked'] } }
              : null;
  return taxonomy ? { taxonomy, items: taxonomy.articleCount > 0 ? [article] : [], pageInfo: { limit: 24, hasMore: false, nextCursor: null } } : null;
};
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
  contest: { id: 301, slug: 'concurso-canonico-2026', title: 'Concurso Canônico 2026', status: 'registration_open', path: '/concursos/concurso-canonico-2026' },
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
  roles: [{ id: 12, slug: 'analista', name: 'Analista', path: '/cargos/analista', questionsPath: '/questoes?cargo=Analista' }],
  disciplines: [{ id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', questionCount: 1, path: '/disciplinas/direito-constitucional' }],
  boards: [{ id: 10, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', examCount: 1, path: '/bancas/cebraspe' }],
  exams: [{ id: 101, slug: 'prova-ssr-2026', name: 'Prova SSR 2026', year: 2026, questionCount: 1, path: '/provas/prova-ssr-2026' }],
  questions: [{ id: 67813, excerpt: 'Art. 5º — Ação & Controle', updatedAt: '2026-08-18', path: '/questoes/67813/art-5o-acao-e-controle', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246' }],
  contests: [{ id: 301, slug: 'concurso-canonico-2026', title: 'Concurso Canônico 2026', status: 'registration_open', year: 2026, path: '/concursos/concurso-canonico-2026' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Órgãos', canonicalPath: '/orgaos' },
    { label: 'Órgão de Teste', canonicalPath: '/orgaos/orgao-de-teste' },
  ],
  updatedAt: '2026-08-18T12:00:00Z',
  externalImporterIdentity: 'SECRET_IMPORTER_SENTINEL',
  adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};
const contestSummary = {
  id: 301, slug: 'concurso-canonico-2026', title: 'Concurso Canônico 2026', description: 'Concurso público canônico para o harness.',
  status: 'registration_open', isOpen: true, year: 2026, registrationStart: '2026-08-01T00:00:00Z', registrationEnd: '2026-09-30T23:59:59Z',
  organization: 'Órgão de Teste', organizationAcronym: 'ODT', board: 'Centro Brasileiro de Pesquisa em Avaliação', boardAcronym: 'CEBRASPE', path: '/concursos/concurso-canonico-2026', updatedAt: '2026-08-19T12:00:00Z',
};
const contest = {
  ...contestSummary, officialUrl: 'https://example.com/concurso',
  dates: { announcedAt: '2026-07-01T00:00:00Z', noticePublishedAt: '2026-07-15T00:00:00Z', registrationStartAt: '2026-08-01T00:00:00Z', registrationEndAt: '2026-09-30T23:59:59Z', examStartAt: '2026-11-01T12:00:00Z' },
  organizations: [{ id: 11, slug: 'orgao-de-teste', name: 'Órgão de Teste', acronym: 'ODT', path: '/orgaos/orgao-de-teste' }],
  board: { id: 10, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', path: '/bancas/cebraspe' },
  positions: [{ id: 401, roleId: 12, slug: 'analista', name: 'Analista', path: '/cargos/analista', vacancies: 10, reserveRegistry: true, salaryMin: 5000, salaryMax: 7000, educationLevel: 'Superior', weeklyHours: 40, locationLabel: 'Paraíba' }],
  documents: [{ id: 501, type: 'notice', title: 'Edital 01/2026', url: 'https://example.com/edital.pdf', publishedAt: '2026-07-15T00:00:00Z' }],
  exams: [{ id: 101, slug: 'prova-ssr-2026', title: 'Prova SSR 2026', year: 2026, questionCount: 1, path: '/provas/prova-ssr-2026' }],
  questions: [{ id: 67813, excerpt: 'Art. 5º — Ação & Controle', path: '/questoes/67813/art-5o-acao-e-controle', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246' }],
  questionCount: 1, canonicalPath: '/concursos/concurso-canonico-2026',
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Concursos', canonicalPath: '/concursos' }, { label: 'Concurso Canônico 2026', canonicalPath: '/concursos/concurso-canonico-2026' }],
  updatedAt: '2026-08-19T12:00:00Z', adminNote: 'SECRET_ADMIN_NOTE_SENTINEL', importerIdentity: 'SECRET_IMPORTER_SENTINEL',
};
const knowledgeQuestion = {
  id: 67813,
  excerpt: 'Art. 5º — Ação & Controle',
  updatedAt: '2026-08-18',
  path: '/questoes/67813/art-5o-acao-e-controle',
  correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246',
  teacherComment: 'SECRET_TEACHER_COMMENT_SENTINEL',
};
const knowledgeRelations = {
  exams: [{ id: 101, slug: 'prova-ssr-2026', name: 'Prova SSR 2026', year: 2026, questionCount: 1, path: '/provas/prova-ssr-2026' }],
  boards: [{ id: 10, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', questionCount: 1, path: '/bancas/cebraspe' }],
  organizations: [{ id: 11, slug: 'orgao-de-teste', name: 'Órgão de Teste', acronym: 'ODT', questionCount: 1, path: '/orgaos/orgao-de-teste' }],
  questions: [knowledgeQuestion],
};
const knowledgeCrumbs = (tail) => [
  { label: 'Início', canonicalPath: '/' },
  { label: 'Disciplinas', canonicalPath: '/disciplinas' },
  ...tail,
];
const discipline = {
  id: 20, slug: 'direito-constitucional', requestedSlug: 'direito-constitucional', name: 'Direito Constitucional',
  description: 'Descrição pública da disciplina.', taxonomyLevel: 'materia', canonicalPath: '/disciplinas/direito-constitucional',
  questionsPath: '/questoes?materia=Direito%20Constitucional', readiness: { status: 'READY', reasonCodes: [] },
  parent: null, root: null, topic: null, subtopic: null, questionCount: 1,
  topics: [{ id: 21, slug: 'controle-de-constitucionalidade', name: 'Controle de Constitucionalidade', taxonomyLevel: 'topico', questionCount: 1, path: '/topicos/controle-de-constitucionalidade', questionsPath: '/questoes?topico=Controle%20de%20Constitucionalidade' }],
  subtopics: [], subjects: [], ...knowledgeRelations,
  breadcrumbs: knowledgeCrumbs([{ label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' }]),
  updatedAt: '2026-08-18T12:00:00Z', importerMetadata: 'SECRET_IMPORTER_SENTINEL', adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};
const topic = {
  id: 21, slug: 'controle-de-constitucionalidade', requestedSlug: 'controle-de-constitucionalidade', name: 'Controle de Constitucionalidade',
  description: null, taxonomyLevel: 'topico', canonicalPath: '/topicos/controle-de-constitucionalidade',
  questionsPath: '/questoes?topico=Controle%20de%20Constitucionalidade', readiness: { status: 'READY', reasonCodes: [] },
  parent: { id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', taxonomyLevel: 'materia', path: '/disciplinas/direito-constitucional' },
  root: { id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', taxonomyLevel: 'materia', path: '/disciplinas/direito-constitucional' },
  topic: null, subtopic: null, questionCount: 1, topics: [],
  subtopics: [{ id: 22, slug: 'modelos-de-controle', name: 'Modelos de controle', taxonomyLevel: 'subtopico' }],
  subjects: [
    { id: 24, slug: 'controle-concentrado', name: 'Controle concentrado', taxonomyLevel: 'assunto', questionCount: 1, subtopicId: 22, subtopicName: 'Modelos de controle', path: '/assuntos/controle-concentrado', questionsPath: '/questoes?assunto=Controle%20concentrado' },
  ],
  ...knowledgeRelations,
  breadcrumbs: knowledgeCrumbs([
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' },
    { label: 'Controle de Constitucionalidade', canonicalPath: '/topicos/controle-de-constitucionalidade' },
  ]), updatedAt: '2026-08-18T12:00:00Z',
};
const subject = {
  id: 24, slug: 'controle-concentrado', requestedSlug: 'controle-concentrado', name: 'Controle concentrado',
  description: 'Recorte público sobre controle concentrado.', taxonomyLevel: 'assunto', canonicalPath: '/assuntos/controle-concentrado',
  questionsPath: '/questoes?assunto=Controle%20concentrado', readiness: { status: 'READY', reasonCodes: [] },
  parent: { id: 22, slug: 'modelos-de-controle', name: 'Modelos de controle', taxonomyLevel: 'subtopico' },
  root: { id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', taxonomyLevel: 'materia', path: '/disciplinas/direito-constitucional' },
  topic: { id: 21, slug: 'controle-de-constitucionalidade', name: 'Controle de Constitucionalidade', taxonomyLevel: 'topico', path: '/topicos/controle-de-constitucionalidade' },
  subtopic: { id: 22, slug: 'modelos-de-controle', name: 'Modelos de controle', taxonomyLevel: 'subtopico' },
  questionCount: 1, topics: [], subtopics: [], subjects: [], ...knowledgeRelations,
  breadcrumbs: knowledgeCrumbs([
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' },
    { label: 'Controle de Constitucionalidade', canonicalPath: '/topicos/controle-de-constitucionalidade' },
    { label: 'Controle concentrado', canonicalPath: '/assuntos/controle-concentrado' },
  ]), updatedAt: '2026-08-18T12:00:00Z',
};
const invalidChainSubject = {
  ...subject,
  id: 25,
  slug: 'assunto-cadeia-invalida',
  requestedSlug: 'assunto-cadeia-invalida',
  name: 'Assunto com cadeia inválida',
  canonicalPath: '/assuntos/assunto-cadeia-invalida',
  readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.wrong_parent_level', 'instance_readiness.invalid_taxonomy_chain'] },
  parent: null,
  root: null,
  topic: null,
  subtopic: null,
  topics: [],
  subtopics: [],
  subjects: [],
  breadcrumbs: knowledgeCrumbs([{ label: 'Assunto com cadeia inválida', canonicalPath: '/assuntos/assunto-cadeia-invalida' }]),
};
const professionalRelations = {
  contests: [{ id: 301, slug: 'concurso-canonico-2026', title: 'Concurso Canônico 2026', status: 'registration_open', year: 2026, organization: 'Órgão de Teste', path: '/concursos/concurso-canonico-2026' }],
  organizations: [{ id: 11, slug: 'orgao-de-teste', name: 'Órgão de Teste', acronym: 'ODT', path: '/orgaos/orgao-de-teste' }],
  exams: [{ id: 101, slug: 'prova-ssr-2026', name: 'Prova SSR 2026', year: 2026, questionCount: 1, path: '/provas/prova-ssr-2026' }],
  questions: [{ id: 67813, excerpt: 'Art. 5º — Ação & Controle', path: '/questoes/67813/art-5o-acao-e-controle', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246' }],
  boards: [{ id: 10, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', path: '/bancas/cebraspe' }],
  readiness: { status: 'READY', reasonCodes: [] }, updatedAt: '2026-08-19T12:00:00Z',
};
const career = {
  kind: 'career', id: 13, slug: 'carreira-fiscal', name: 'Carreira Fiscal', description: 'Carreira pública editorial usada pelo harness.',
  canonicalPath: '/carreiras/carreira-fiscal', questionsPath: '/questoes?career=Carreira%20Fiscal', contestsPath: '/concursos',
  questionCount: 1, examCount: 1, careers: [],
  positions: [{ id: 12, slug: 'analista', name: 'Analista', questionCount: 1, examCount: 1, path: '/cargos/analista' }],
  ...professionalRelations,
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Carreiras', canonicalPath: '/carreiras' }, { label: 'Carreira Fiscal', canonicalPath: '/carreiras/carreira-fiscal' }],
  importerIdentity: 'SECRET_IMPORTER_SENTINEL', adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};
const position = {
  kind: 'position', id: 12, slug: 'analista', name: 'Analista', description: 'Cargo público usado pelo harness.',
  canonicalPath: '/cargos/analista', questionsPath: '/questoes?role=Analista', contestsPath: '/concursos?cargo=Analista',
  questionCount: 1, examCount: 1,
  careers: [{ id: 13, slug: 'carreira-fiscal', name: 'Carreira Fiscal', path: '/carreiras/carreira-fiscal' }], positions: [],
  ...professionalRelations,
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Cargos', canonicalPath: '/cargos' }, { label: 'Analista', canonicalPath: '/cargos/analista' }],
  sourceExternalId: 'SECRET_PROVIDER_SENTINEL', adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};
const professionalFor = (kind, requestedSlug) => {
  const item = kind === 'career' ? career : kind === 'position' ? position : null;
  if (!item) return null;
  if (requestedSlug === item.slug) return item;
  if (requestedSlug === `${item.slug}-antigo`) return { redirectSlug: item.slug };
  return null;
};
const publicSimulationSummary = {
  id: 601, slug: 'simulado-publico-constitucional', title: 'Simulado de Direito Constitucional',
  description: 'Simulado editorial público com composição estável para validar a experiência SSR.',
  durationMinutes: 45, questionCount: 1, availabilityStatus: 'available',
  path: '/simulados/simulado-publico-constitucional', updatedAt: '2026-08-19T13:00:00Z',
};
const publicSimulation = {
  ...publicSimulationSummary, canonicalPath: publicSimulationSummary.path,
  instructions: 'Leia cada questão com atenção antes de concluir a prática.', isAttemptAvailable: true,
  practicePath: '/simulation', readiness: { status: 'READY', reasonCodes: [] },
  questions: [{ id: 67813, excerpt: 'Art. 5º — Ação & Controle', position: 1, path: '/questoes/67813/art-5o-acao-e-controle', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL_246', teacherComment: 'SECRET_TEACHER_COMMENT_SENTINEL' }],
  taxonomies: [
    { id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', relationType: 'discipline', path: '/disciplinas/direito-constitucional' },
    { id: 13, slug: 'carreira-fiscal', name: 'Carreira Fiscal', relationType: 'career', path: '/carreiras/carreira-fiscal' },
    { id: 12, slug: 'analista', name: 'Analista', relationType: 'position', path: '/cargos/analista' },
    { id: 11, slug: 'orgao-de-teste', name: 'Órgão de Teste', relationType: 'organization', path: '/orgaos/orgao-de-teste' },
  ],
  contests: [{ id: 301, slug: 'concurso-canonico-2026', title: 'Concurso Canônico 2026', path: '/concursos/concurso-canonico-2026' }],
  exams: [{ id: 101, slug: 'prova-ssr-2026', title: 'Prova SSR 2026', year: 2026, path: '/provas/prova-ssr-2026' }],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Simulados', canonicalPath: '/simulados' }, { label: 'Simulado de Direito Constitucional', canonicalPath: '/simulados/simulado-publico-constitucional' }],
  attempt_id: 'SECRET_ATTEMPT_SENTINEL', user_id: 'SECRET_USER_SENTINEL', score: 100,
  answers: ['SECRET_ANSWER_SENTINEL'], adminNote: 'SECRET_ADMIN_NOTE_SENTINEL', providerIdentity: 'SECRET_PROVIDER_SENTINEL',
};
const publicSimulationWithoutComposition = {
  ...publicSimulationSummary,
  id: 602,
  slug: 'simulado-sem-composicao',
  title: 'Simulado sem composicao valida',
  description: 'Definicao editorial publica ainda sem questoes validas.',
  questionCount: 0,
  availabilityStatus: 'unavailable',
  path: '/simulados/simulado-sem-composicao',
  canonicalPath: '/simulados/simulado-sem-composicao',
  instructions: null,
  isAttemptAvailable: false,
  practicePath: '/simulation',
  readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
  questions: [], taxonomies: [], contests: [], exams: [],
  breadcrumbs: [{ label: 'Inicio', canonicalPath: '/' }, { label: 'Simulados', canonicalPath: '/simulados' }, { label: 'Simulado sem composicao valida', canonicalPath: '/simulados/simulado-sem-composicao' }],
};
const publicSimulationFor = (requestedSlug) => {
  if (requestedSlug === publicSimulation.slug) return publicSimulation;
  if (requestedSlug === publicSimulationWithoutComposition.slug) return publicSimulationWithoutComposition;
  if (requestedSlug === 'simulado-publico-antigo') return { redirectSlug: publicSimulation.slug };
  return null;
};
const materialBase = {
  id: 'mat-publico-1', slug: 'guia-publico-de-estudo', title: 'Guia público de estudo',
  description: 'Material editorial público usado para validar SSR e segurança.', format: 'PDF', pageCount: 42, year: 2026,
  publicAuthorName: 'Equipe ConcursoMestre', coverUrl: null, previewUrl: 'https://example.com/material-preview.pdf',
  hasAsset: true, offer: { mode: 'paid', amountMinor: 2990, currency: 'BRL', available: true },
  path: '/materiais/guia-publico-de-estudo', updatedAt: '2026-08-21T12:00:00Z',
};
const publicMaterial = {
  ...materialBase, canonicalPath: materialBase.path, marketplacePath: '/marketplace',
  taxonomies: [{ id: 20, slug: 'direito-constitucional', name: 'Direito Constitucional', relationType: 'discipline', path: '/disciplinas/direito-constitucional' }],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: materialBase.title, canonicalPath: materialBase.path }],
  readiness: { status: 'READY', reasonCodes: [] }, listingReadiness: { status: 'READY', reasonCodes: [] },
  storagePath: 'SECRET_STORAGE_PATH_SENTINEL', signedDownloadUrl: 'SECRET_SIGNED_DOWNLOAD_SENTINEL',
  sellerEmail: 'SECRET_SELLER_EMAIL_SENTINEL', purchaseId: 'SECRET_PURCHASE_SENTINEL', paymentId: 'SECRET_PAYMENT_SENTINEL',
};
const freeMaterial = {
  ...publicMaterial, id: 'mat-gratis-1', slug: 'material-gratuito-publico', title: 'Material gratuito público',
  path: '/materiais/material-gratuito-publico', canonicalPath: '/materiais/material-gratuito-publico',
  offer: { mode: 'free', amountMinor: null, currency: null, available: true },
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: 'Material gratuito público', canonicalPath: '/materiais/material-gratuito-publico' }],
};
const unavailableMaterial = {
  ...publicMaterial, id: 'mat-historico-1', slug: 'material-historico', title: 'Material histórico',
  path: '/materiais/material-historico', canonicalPath: '/materiais/material-historico',
  offer: { mode: 'unavailable', amountMinor: null, currency: null, available: false },
  listingReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: 'Material histórico', canonicalPath: '/materiais/material-historico' }],
};
const notForSaleMaterial = {
  ...publicMaterial, id: 'mat-editorial-1', slug: 'material-editorial-publico', title: 'Material editorial público',
  path: '/materiais/material-editorial-publico', canonicalPath: '/materiais/material-editorial-publico',
  offer: { mode: 'not_for_sale', amountMinor: null, currency: null, available: false },
  listingReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: 'Material editorial público', canonicalPath: '/materiais/material-editorial-publico' }],
};
const includedInPlanMaterial = {
  ...publicMaterial, id: 'mat-plano-1', slug: 'material-incluido-em-plano', title: 'Material incluído em plano',
  path: '/materiais/material-incluido-em-plano', canonicalPath: '/materiais/material-incluido-em-plano',
  offer: { mode: 'included_in_plan', amountMinor: null, currency: null, available: true },
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: 'Material incluído em plano', canonicalPath: '/materiais/material-incluido-em-plano' }],
};
const xssMaterial = {
  ...publicMaterial, id: 'mat-xss-1', slug: 'material-xss-seguro',
  title: '<script>window.XSS_TITLE=1</script>',
  description: '<svg onload="window.XSS_DESCRIPTION=1"></svg><iframe src="javascript:alert(1)"></iframe>',
  publicAuthorName: '<img src=x onerror="window.XSS_AUTHOR=1">', previewUrl: 'javascript:alert(1)',
  path: '/materiais/material-xss-seguro', canonicalPath: '/materiais/material-xss-seguro',
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: '<script>window.XSS_TITLE=1</script>', canonicalPath: '/materiais/material-xss-seguro' }],
};
const materialWithoutAsset = {
  ...publicMaterial, id: 'mat-sem-asset', slug: 'material-sem-asset', title: 'Material sem asset validado',
  path: '/materiais/material-sem-asset', canonicalPath: '/materiais/material-sem-asset', hasAsset: false,
  readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
  listingReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Materiais', canonicalPath: '/materiais' }, { label: 'Material sem asset validado', canonicalPath: '/materiais/material-sem-asset' }],
};
const materialFor = (requestedSlug) => {
  if (requestedSlug === publicMaterial.slug) return publicMaterial;
  if (requestedSlug === freeMaterial.slug) return freeMaterial;
  if (requestedSlug === unavailableMaterial.slug) return unavailableMaterial;
  if (requestedSlug === notForSaleMaterial.slug) return notForSaleMaterial;
  if (requestedSlug === includedInPlanMaterial.slug) return includedInPlanMaterial;
  if (requestedSlug === xssMaterial.slug) return xssMaterial;
  if (requestedSlug === materialWithoutAsset.slug) return materialWithoutAsset;
  if (requestedSlug === 'guia-publico-antigo') return { redirectSlug: publicMaterial.slug };
  return null;
};
const emptyTopic = {
  ...topic,
  id: 26,
  slug: 'topico-sem-conteudo-atual',
  requestedSlug: 'topico-sem-conteudo-atual',
  name: 'Tópico sem conteúdo atual',
  canonicalPath: '/topicos/topico-sem-conteudo-atual',
  questionsPath: '/questoes?topico=T%C3%B3pico%20sem%20conte%C3%BAdo%20atual',
  questionCount: 0,
  subtopics: [], subjects: [], exams: [], boards: [], organizations: [], questions: [],
  breadcrumbs: knowledgeCrumbs([
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' },
    { label: 'Tópico sem conteúdo atual', canonicalPath: '/topicos/topico-sem-conteudo-atual' },
  ]),
};
const knowledgeFor = (level, requestedSlug) => {
  const fixtures = { materia: discipline, topico: topic, assunto: subject };
  const aliases = { materia: 'direito-constitucional-antigo', topico: 'controle-constitucional-antigo', assunto: 'controle-concentrado-antigo' };
  if (level === 'assunto' && requestedSlug === invalidChainSubject.slug) return invalidChainSubject;
  if (level === 'topico' && requestedSlug === emptyTopic.slug) return emptyTopic;
  const fixture = fixtures[level];
  if (!fixture) return null;
  if (requestedSlug === fixture.slug) return fixture;
  if (requestedSlug === aliases[level]) return { ...fixture, requestedSlug };
  return null;
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
    officialStatus: 'active',
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
const lawArticleFixture = (articleSlug = 'artigo-5') => {
  const variants = {
    'artigo-5': { id: 501, number: '5º', title: 'Direitos e garantias fundamentais', officialText: 'Todos são iguais perante a lei, sem distinção de qualquer natureza.', officialStatus: 'active' },
    'artigo-5-a': { id: 502, number: '5º-A', title: null, officialText: 'Texto oficial do artigo incluído para validar numeração alfanumérica.', officialStatus: 'active' },
    'artigo-5-b': { id: 506, number: '5º-B', title: null, officialText: 'Texto oficial do segundo artigo alfanumérico.', officialStatus: 'active' },
    'artigo-6': { id: 503, number: '6º', title: null, officialText: 'Texto histórico revogado preservado para consulta.', officialStatus: 'revoked' },
    'artigo-7': { id: 504, number: '7º', title: null, officialText: 'Dispositivo vetado.', officialStatus: 'vetoed' },
    'artigo-sem-texto': { id: 505, number: '8º', title: null, officialText: '', officialStatus: 'active' },
  };
  const variant = variants[articleSlug];
  if (!variant) return null;
  const articlePath = `/lei-comentada/constituicao-federal/${articleSlug}`;
  return {
    law: { id: 1, slug: 'constituicao-federal', title: 'Constituição Federal', shortTitle: 'Constituição Federal', number: '1988', year: '1988', status: 'published', officialUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm', sourceName: 'Portal do Planalto', updatedAt: '2026-08-20T10:00:00-03:00' },
    article: { ...variant, lawId: 1, sectionId: 1, slug: articleSlug, officialAnchor: `art-${variant.number}`, updatedAt: '2026-08-20T10:00:00-03:00', blocks: variant.officialText ? [{ id: variant.id, uid: `${articleSlug}-caput`, kind: 'caput', label: `Art. ${variant.number}`, text: variant.officialText, parentUid: null, anchor: null, sortOrder: 0 }] : [] },
    section: { id: 1, title: 'Direitos e garantias fundamentais', titleLabel: 'TÍTULO II', titleName: 'Dos Direitos e Garantias Fundamentais', chapterLabel: 'CAPÍTULO I', chapterName: 'Dos Direitos e Deveres Individuais e Coletivos' },
    navigation: {
      previous: articleSlug === 'artigo-5-a'
        ? { slug: 'artigo-5', number: '5º', title: null, path: '/lei-comentada/constituicao-federal/artigo-5' }
        : articleSlug === 'artigo-5-b'
          ? { slug: 'artigo-5-a', number: '5º-A', title: null, path: '/lei-comentada/constituicao-federal/artigo-5-a' }
          : null,
      next: articleSlug === 'artigo-5'
        ? { slug: 'artigo-5-a', number: '5º-A', title: null, path: '/lei-comentada/constituicao-federal/artigo-5-a' }
        : articleSlug === 'artigo-5-a'
          ? { slug: 'artigo-5-b', number: '5º-B', title: null, path: '/lei-comentada/constituicao-federal/artigo-5-b' }
          : articleSlug === 'artigo-5-b'
            ? { slug: 'artigo-6', number: '6º', title: null, path: '/lei-comentada/constituicao-federal/artigo-6' }
            : null,
    },
    canonicalPath: articlePath,
    breadcrumbs: [{ label: 'Início', path: '/' }, { label: 'Lei Comentada', path: '/lei-comentada' }, { label: 'Constituição Federal', path: '/lei-comentada/constituicao-federal' }, { label: `Art. ${variant.number}`, path: articlePath }],
    readiness: variant.officialText ? { status: 'READY', reasonCodes: [] } : { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
    editorial: { commentaryAvailable: false, protectedContentIncluded: false },
  };
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
  filters: {
    subjects: [{ id: 20, label: 'Direito Constitucional', slug: 'direito-constitucional', taxonomyLevel: 'materia', seoReady: true }],
    topics: [{ id: 21, label: 'Controle de Constitucionalidade', slug: 'controle-de-constitucionalidade', taxonomyLevel: 'topico', seoReady: true }],
    subtopics: [
      { id: 24, label: 'Controle concentrado', slug: 'controle-concentrado', taxonomyLevel: 'assunto', seoReady: true },
      { id: 25, label: 'Assunto inválido', slug: 'assunto-cadeia-invalida', taxonomyLevel: 'assunto', seoReady: false },
    ],
    roles: [{ id: 12, label: 'Analista', slug: 'analista', taxonomyLevel: 'cargo', seoReady: true }],
    careers: [{ id: 13, label: 'Carreira Fiscal', slug: 'carreira-fiscal', taxonomyLevel: 'carreira', seoReady: true }],
  },
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
  if (pathname === '/v2/questions/list.php' || pathname === '/questionsList') return {
    success: true,
    data: {
      items: [{
        id: question.id,
        statementPreview: question.enunciado_clean,
        type: 'multiple_choice',
        difficulty: 'medium',
        hasImage: false,
        taxonomySummary: {
          subjects: question.filters.subjects,
          topics: question.filters.topics,
          subtopics: question.filters.subtopics,
          examBoards: question.bancas.map((item) => ({ id: item.id, label: item.nome, slug: item.slug })),
          organizations: [],
          roles: question.filters.roles,
          careers: question.filters.careers,
          years: question.anos,
        },
        publication: { status: 'published', visibility: 'public' },
      }],
      pageInfo: { limit: 20, total: 1, hasMore: false },
    },
  };
  if (pathname === '/exams/directory.php') return { success: true, data: { items: [examItem], pageInfo: { page: 1, limit: 12, totalItems: 1, totalPages: 1, hasPrevious: false, hasNext: false }, facets: { years: [2026], regions: ['Nordeste'], states: [{ code: 'PB', name: 'Paraíba' }] } } };
  if (pathname === '/exams/detail.php') return { success: true, data: { exam } };
  if (pathname === '/contests/index.php') return { success: true, data: { items: [contestSummary], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } } };
  if (pathname === '/contests/open.php') return { success: true, data: { items: [contestSummary], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } } };
  if (pathname === '/contests/detail.php') {
    if (url.searchParams.get('slug') === 'concurso-canonico-antigo') {
      return { success: true, data: { redirectSlug: contest.slug } };
    }
    return { success: true, data: contest };
  }
  if (pathname === '/simulations/public-directory.php') {
    const requestedPage = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    return { success: true, data: { items: [publicSimulationSummary], pageInfo: { page: Math.min(requestedPage, 2), pages: 2, limit: 24, total: 25 } } };
  }
  if (pathname === '/simulations/public-detail.php') return { success: true, data: publicSimulationFor(url.searchParams.get('slug')) };
  if (pathname === '/materials/public-directory.php') {
    const scope = url.searchParams.get('scope') === 'marketplace' ? 'marketplace' : 'materials';
    const items = scope === 'marketplace' ? [materialBase, { ...freeMaterial, canonicalPath: undefined, breadcrumbs: undefined, readiness: undefined, listingReadiness: undefined }] : [materialBase, { ...freeMaterial, canonicalPath: undefined, breadcrumbs: undefined, readiness: undefined, listingReadiness: undefined }, { ...unavailableMaterial, canonicalPath: undefined, breadcrumbs: undefined, readiness: undefined, listingReadiness: undefined }];
    return { success: true, data: { items, pageInfo: { page: 1, pages: 1, limit: 24, total: items.length }, scope } };
  }
  if (pathname === '/materials/public-detail.php') return { success: true, data: materialFor(url.searchParams.get('slug')) };
  if (pathname === '/materials/public-legacy.php') return { success: true, data: url.searchParams.get('id') === publicMaterial.id ? { redirectSlug: publicMaterial.slug } : null };
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
  if (pathname === '/filters/knowledge-taxonomy.php') return { success: true, data: knowledgeFor(url.searchParams.get('level'), url.searchParams.get('slug')) };
  if (pathname === '/filters/professional-directory.php') {
    const kind = url.searchParams.get('kind'); const item = kind === 'career' ? career : kind === 'position' ? position : null;
    return { success: true, data: { items: item ? [{ id: item.id, slug: item.slug, name: item.name, description: item.description, questionCount: item.questionCount, examCount: item.examCount, path: item.canonicalPath }] : [], pageInfo: { page: 1, pages: 1, limit: 30, total: item ? 1 : 0 } } };
  }
  if (pathname === '/filters/professional-taxonomy.php') return { success: true, data: professionalFor(url.searchParams.get('kind'), url.searchParams.get('slug')) };
  if (pathname === '/blog/detail.php') return { success: true, data: article };
  if (pathname === '/blog/list.php') return { success: true, data: { items: [article], pageInfo: { limit: 24, hasMore: false, nextCursor: null, total: 1 } } };
  if (pathname === '/blog/categories.php') return { success: true, data: { items: [category] } };
  if (pathname === '/blog/tags.php') return { success: true, data: { items: [tag] } };
  if (pathname === '/blog/taxonomy.php') return { success: true, data: taxonomyArchive(url.searchParams.get('type'), url.searchParams.get('slug')) };
  if (pathname === '/legal-commentary/list.php') return { success: true, data: { areas: [{ id: 1, name: 'Constitucional', slug: 'constitucional' }], lawsByArea: [{ area: { id: 1, name: 'Constitucional', slug: 'constitucional' }, laws: [lawSummary] }], mostAccessed: [lawSummary], favoriteLaws: [], favoriteItems: [], recentlyStudied: [], recentlyUpdated: [], totals: { laws: 1, articles: 1, commentedArticles: 1, updatedRecently: 0 } } };
  if (pathname === '/legal-commentary/detail.php') {
    return url.searchParams.get('slug') === lawSummary.slug
      ? { success: true, data: protectedLaw }
      : { success: false, message: 'Lei nao encontrada.' };
  }
  if (pathname === '/legal-commentary/article-detail.php') {
    const lawSlug = url.searchParams.get('lawSlug');
    const articleSlug = url.searchParams.get('articleSlug');
    if (lawSlug === 'constituicao-antiga' && articleSlug === 'artigo-5') {
      return { success: true, data: { redirectPath: '/lei-comentada/constituicao-federal/artigo-5' } };
    }
    return { success: true, data: lawSlug === 'constituicao-federal' ? lawArticleFixture(articleSlug) : null };
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
  if (url.pathname.replace(/^\/api\//, '/') === '/blog/detail.php' && url.searchParams.get('slug') !== article.slug) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Artigo nao encontrado.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/legal-commentary/detail.php' && url.searchParams.get('slug') !== lawSummary.slug) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Lei nao encontrada.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/legal-commentary/article-detail.php') {
    const lawSlug = url.searchParams.get('lawSlug'); const articleSlug = url.searchParams.get('articleSlug');
    const validLaw = ['constituicao-federal', 'constituicao-antiga'].includes(lawSlug);
    const validArticle = ['artigo-5', 'artigo-5-a', 'artigo-5-b', 'artigo-6', 'artigo-7', 'artigo-sem-texto'].includes(articleSlug);
    if (!validLaw || !validArticle || (lawSlug === 'constituicao-antiga' && articleSlug !== 'artigo-5')) {
      count(url.pathname);
      return json(response, 404, { success: false, message: 'Artigo normativo não encontrado.' }, origin);
    }
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/filters/organization.php' && url.searchParams.get('slug') !== organization.slug) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Orgao nao encontrado.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/filters/knowledge-taxonomy.php') {
    const fixture = knowledgeFor(url.searchParams.get('level'), url.searchParams.get('slug'));
    if (!fixture) {
      count(url.pathname);
      return json(response, 404, { success: false, message: 'Taxonomia nao encontrada.' }, origin);
    }
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/filters/professional-taxonomy.php'
    && !professionalFor(url.searchParams.get('kind'), url.searchParams.get('slug'))) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Entidade profissional não encontrada.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/contests/detail.php'
    && ![contest.slug, 'concurso-canonico-antigo'].includes(url.searchParams.get('slug'))) {
    return json(response, 404, { success: false, error: { code: 'not_found', message: 'Concurso não encontrado.' } }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/simulations/public-detail.php'
    && ![publicSimulation.slug, publicSimulationWithoutComposition.slug, 'simulado-publico-antigo'].includes(url.searchParams.get('slug'))) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Simulado não encontrado.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/materials/public-detail.php'
    && !materialFor(url.searchParams.get('slug'))) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Material não encontrado.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/materials/public-legacy.php'
    && url.searchParams.get('id') !== publicMaterial.id) {
    count(url.pathname);
    return json(response, 404, { success: false, message: 'Material não encontrado.' }, origin);
  }
  if (url.pathname.replace(/^\/api\//, '/') === '/blog/taxonomy.php') {
    const cursor = url.searchParams.get('cursor') || '';
    if (cursor !== '' && cursor !== 'signed') {
      count(url.pathname);
      return json(response, 400, { success: false, message: 'Cursor de paginação inválido.' }, origin);
    }
  }
  count(url.pathname);
  return json(response, 200, payloadFor(url), origin);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SSR_HYDRATION_FIXTURE_API|http://127.0.0.1:${port}/api/`);
});
