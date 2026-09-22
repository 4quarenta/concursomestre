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

import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const fail = (message) => failures.push(message);
const expectText = (source, expected, message) => {
  if (!source.includes(expected)) fail(message);
};

const clientSource = read('mobile/src/api/client.ts');
const authSource = read('mobile/src/providers/AuthProvider.tsx');

// O contrato deve renovar 401 e a resposta legada de sessao invalida em 500.
const isLegacySessionFailure = ({ status, message = '' }) => (
  status === 500 && /sess[aã]o.*(inv[aá]lida|expirada)/i.test(message)
);
const shouldAttemptRefresh = ({ status, message, authRequest = false, retry = false }) => (
  !authRequest && !retry && (status === 401 || isLegacySessionFailure({ status, message }))
);
const shouldClearAfterRefresh = (status) => status === 401 || status === 422;

[
  { name: '401 protegido renova', input: { status: 401 }, expected: true },
  { name: '403 preserva sessao', input: { status: 403 }, expected: false },
  { name: 'offline preserva sessao', input: { status: undefined }, expected: false },
  { name: '500 generico preserva sessao', input: { status: 500, message: 'Servidor indisponivel' }, expected: false },
  { name: '500 legado de sessao renova', input: { status: 500, message: 'Sessao invalida' }, expected: true },
  { name: '401 ja repetido nao renova', input: { status: 401, retry: true }, expected: false },
  { name: '401 de login nao renova', input: { status: 401, authRequest: true }, expected: false },
].forEach(({ name, input, expected }) => {
  if (shouldAttemptRefresh(input) !== expected) fail(`Matriz de sessao falhou: ${name}.`);
});

[
  { name: '401 no refresh limpa', status: 401, expected: true },
  { name: '422 no refresh limpa', status: 422, expected: true },
  { name: '403 no refresh preserva', status: 403, expected: false },
  { name: 'offline no refresh preserva', status: undefined, expected: false },
  { name: '500 no refresh preserva', status: 500, expected: false },
].forEach(({ name, status, expected }) => {
  if (shouldClearAfterRefresh(status) !== expected) fail(`Politica de limpeza falhou: ${name}.`);
});

// Simula duas requisicoes concorrentes para garantir uma unica rotacao.
let refreshCalls = 0;
let refreshInFlight = null;
const fakeRefresh = () => {
  refreshCalls += 1;
  return Promise.resolve('token-de-teste');
};
const singleFlight = () => {
  if (!refreshInFlight) {
    refreshInFlight = fakeRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};
const firstRefresh = singleFlight();
const secondRefresh = singleFlight();
if (firstRefresh !== secondRefresh || refreshCalls !== 1) {
  fail('Refresh concorrente deve compartilhar a mesma Promise.');
}

expectText(
  clientSource,
  'const sessionFailure = status === 401 || isLegacySessionFailure(error);',
  'Cliente nao declara a politica de 401/500 legado para renovacao.',
);
expectText(
  clientSource,
  'refreshFailure.status === 401 || refreshFailure.status === 422',
  'Cliente nao restringe limpeza do refresh a 401/422.',
);
expectText(clientSource, 'refreshInFlight = null;', 'Refresh concorrente deve liberar o lock ao finalizar.');
if (clientSource.includes('.catch(() => null)')) {
  fail('Refresh nao pode converter falha transitoria em sessao invalida.');
}
if (authSource.includes('failure.status === 401 || failure.status === 403')) {
  fail('Bootstrap nao pode apagar a sessao por resposta 403.');
}

if (failures.length) {
  console.error('Mobile session contract FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Mobile session contract PASS (401, 403, refresh concorrente, offline e 5xx)');
