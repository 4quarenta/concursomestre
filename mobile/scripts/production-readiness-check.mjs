const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://concursomestre.com/api/').replace(/\/+$/, '');
const failures = [];

const requestJson = async (path, expectedStatus) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
      headers: {
        Accept: 'application/json',
        'X-Client-Platform': 'concursomestre-mobile',
        'X-ConcursoMestre-Client': 'mobile',
      },
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      failures.push(`${path}: resposta nao-JSON`);
    }
    if (response.status !== expectedStatus) {
      failures.push(`${path}: HTTP ${response.status}; esperado ${expectedStatus}`);
    }
    return { response, body };
  } catch (error) {
    failures.push(`${path}: ${error?.name === 'AbortError' ? 'timeout' : error?.message || 'falha de rede'}`);
    return { response: null, body: null };
  } finally {
    clearTimeout(timer);
  }
};

const readData = (body) => body?.data && typeof body.data === 'object' ? body.data : body;
const readRows = (body) => {
  const data = readData(body);
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['rows', 'items', 'plans', 'questions']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
};

const settings = await requestJson('settings.php', 200);
if (!settings.body || settings.body.success === false) failures.push('settings.php: envelope publico invalido');

const plans = await requestJson('plans/list.php', 200);
const planRows = readRows(plans.body);
if (planRows.length === 0) failures.push('plans/list.php: nenhum plano retornado');

const questions = await requestJson('questions/list.php?page=1&limit=1', 200);
const questionRows = readRows(questions.body);
const questionData = readData(questions.body);
const total = Number(questionData?.total ?? questions.body?.total);
if (!Number.isFinite(total) || total < 0) failures.push('questions/list.php: total ausente ou invalido');
if (questionRows.length > 1) failures.push('questions/list.php: ignorou limite=1');

const authMe = await requestJson('auth/me.php', 401);
if (authMe.response?.status === 200) failures.push('auth/me.php: acesso anonimo inesperadamente permitido');

if (failures.length > 0) {
  console.error('\nProduction readiness gate FAILED:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production readiness PASS — settings 200; planos ${planRows.length}; questoes total ${total}; limite 1; auth/me anonimo 401`);
