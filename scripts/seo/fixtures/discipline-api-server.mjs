#!/usr/bin/env node

import http from 'node:http';

const portArg = process.argv.find((value) => value.startsWith('--port='));
const port = Number(portArg?.slice('--port='.length) || process.env.PORT || 4310);
const counts = new Map();

const discipline = {
  id: 10,
  slug: 'direito-constitucional',
  name: 'Direito Constitucional',
  description: 'Descrição pública da disciplina.',
  canonicalPath: '/disciplinas/direito-constitucional',
  questionsPath: '/questoes?materia=Direito%20Constitucional',
  parent: null,
  root: null,
  questionCount: 12,
  topics: [{ id: 11, slug: 'controle', name: 'Controle de Constitucionalidade', questionCount: 5, questionsPath: '/questoes?topico=Controle%20de%20Constitucionalidade' }],
  exams: [{ id: 20, slug: 'prova-persistida', name: 'Prova Persistida 2026', year: 2026, questionCount: 3, path: '/provas/prova-persistida' }],
  boards: [{ id: 30, slug: 'cebraspe', name: 'Centro Brasileiro de Pesquisa em Avaliação', acronym: 'CEBRASPE', questionCount: 8, path: '/bancas/cebraspe' }],
  questions: [{ id: 40, excerpt: 'Art. 5º - Ação & Controle', updatedAt: '2026-08-16', path: '/questoes/40/art-5o-acao-e-controle' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Disciplinas', canonicalPath: '/disciplinas' },
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' }
  ],
  updatedAt: '2026-08-16T12:00:00Z'
};

const disciplineForSlug = (slug) => {
  if (slug === discipline.slug) return discipline;
  if (slug !== 'direito-administrativo') return null;
  return {
    ...discipline,
    id: 12,
    slug,
    name: 'Direito Administrativo',
    canonicalPath: `/disciplinas/${slug}`,
    questionsPath: '/questoes?materia=Direito%20Administrativo',
    breadcrumbs: discipline.breadcrumbs.map((item, index) => index === 2
      ? { label: 'Direito Administrativo', canonicalPath: `/disciplinas/${slug}` }
      : item),
  };
};

const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body));
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/__reset' && request.method === 'POST') {
    counts.clear();
    return json(response, 200, { ok: true });
  }
  if (url.pathname === '/__metrics') {
    return json(response, 200, {
      total: Array.from(counts.values()).reduce((sum, value) => sum + value, 0),
      requests: Object.fromEntries(counts),
    });
  }

  const metricKey = `${request.method || 'GET'} ${url.pathname}${url.search}`;
  counts.set(metricKey, (counts.get(metricKey) || 0) + 1);
  if (url.pathname.endsWith('/filters/discipline.php')) {
    const fixture = disciplineForSlug(url.searchParams.get('slug'));
    if (fixture) {
      return json(response, 200, { success: true, data: fixture });
    }
    return json(response, 404, { success: false, error: { code: 'not_found', message: 'Disciplina não encontrada.' } });
  }

  return json(response, 200, { success: true, data: {} });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`discipline-api-fixture:http://127.0.0.1:${port}/api/\n`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
