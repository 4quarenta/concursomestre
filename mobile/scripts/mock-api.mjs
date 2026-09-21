import http from 'node:http';

const port = Number(process.env.PORT || 4010);

const payloadFor = (url) => {
  const path = url.pathname;

  if (path.includes('questions/mobile_list.php')) {
    return {
      success: true,
      data: {
        rows: [
          {
            id: 101,
            enunciado: 'De acordo com a Constituição Federal, assinale a alternativa correta sobre direitos e garantias fundamentais.',
            alternativas: [
              { texto: 'A liberdade de associação é plena, inclusive para fins paramilitares.' },
              { texto: 'Ninguém poderá ser compelido a associar-se ou a permanecer associado.' },
              { texto: 'É vedada a criação de associações sem autorização estatal.' },
              { texto: 'A dissolução compulsória independe de decisão judicial.' }
            ],
            banca: 'CEBRASPE',
            ano: 2025,
            dificuldade: 'Medio',
            materias: [{ nome: 'Direito Constitucional' }],
            assuntos: [{ nome: 'Direitos Fundamentais' }]
          },
          {
            id: 102,
            enunciado: 'Sobre os princípios expressos da Administração Pública, julgue a afirmação apresentada.',
            alternativas: [
              { texto: 'Certo' },
              { texto: 'Errado' }
            ],
            banca: 'FGV',
            ano: 2026,
            dificuldade: 'Facil',
            materias: [{ nome: 'Direito Administrativo' }],
            assuntos: [{ nome: 'Princípios Administrativos' }]
          }
        ],
        total: 8421,
        page: 1,
        perPage: 20,
        pages: 422
      }
    };
  }

  if (path.includes('filtersList')) {
    return {
      success: true,
      data: {
        subjects: [
          { id: 1, nome: 'Direito Constitucional' },
          { id: 2, nome: 'Direito Administrativo' }
        ],
        topics: [], agencies: [], organizations: [], roles: [], years: [2026, 2025, 2024]
      }
    };
  }

  if (path.includes('simulationsList')) {
    return {
      success: true,
      data: [
        { id: 77, name: 'Simulado PM - Bloco 1', status: 'completed', score: 82, questionCount: 50, updatedAt: Date.now() - 86400000 },
        { id: 72, name: 'Revisão Direito Constitucional', status: 'completed', score: 76, questionCount: 30, updatedAt: Date.now() - 432000000 }
      ]
    };
  }

  if (path.includes('settings.php')) {
    return { success: true, data: {} };
  }

  if (path.includes('transactionsList')) return { success: true, data: [] };
  if (path.includes('users/list_cards.php')) return { success: true, data: [] };
  if (path.includes('feedback/list.php')) return { success: true, data: [] };
  if (path.includes('statistics/')) return { success: true, data: {} };
  if (path.includes('plans/list.php')) return { success: true, data: [] };

  return { success: true, data: {} };
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const body = JSON.stringify(payloadFor(url));
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(req.method === 'OPTIONS' ? '' : body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Visual snapshot API listening on http://127.0.0.1:${port}`);
});
