/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  extractGranPagination,
  extractGranRows,
  mapGranBatchToQuestionImport,
  sanitizeRichText,
  validateQuestionImportPayload,
} from '../gran_mapper.mjs';

const rawQuestion = (overrides = {}) => ({
  id_questao: 991,
  numero_questao: 12,
  enunciado: '<p>Assinale a opcao correta.</p><script>alert(1)</script>',
  textos_questao: [{ texto: '<p>Texto de apoio.</p>' }],
  itens: [
    { id: 10, corpo: 'Alternativa A' },
    { id: 11, corpo: 'Alternativa B', is_correto: true },
  ],
  resposta: 11,
  bancas: [{ sigla: 'IBFC', nome: 'Instituto Brasileiro de Formacao' }],
  orgaos: [{ sigla: 'PM-PB', nome: 'Policia Militar da Paraiba' }],
  cargos: [{ nome: 'Soldado' }],
  carreiras: [{ nome: 'Policial' }],
  anos: [2024],
  materia_questao: 'Lingua Portuguesa',
  assuntos: [{ nome: 'Interpretacao de textos' }, { nome: 'Inferencia' }],
  escolaridade: { nome: 'Medio' },
  grupo_questao: {
    id: 77,
    enunciado: 'Texto para as questoes 12 e 13.',
    texto: '<p>Contexto compartilhado.</p>',
  },
  ...overrides,
});

test('extrai linhas e paginacao das respostas conhecidas da Gran', () => {
  const payload = { data: { rows: [rawQuestion()], total: 80, pages: 4 } };
  assert.equal(extractGranRows(payload).length, 1);
  assert.deepEqual(extractGranPagination(payload), { total: 80, pages: 4 });
});

test('mapeia lote Gran para question-import.v2 em rascunho e revisao', () => {
  const payload = mapGranBatchToQuestionImport([
    rawQuestion(),
    rawQuestion({ id_questao: 992, numero_questao: 13 }),
  ], { title: 'IBFC - 2024 - PM-PB - Soldado', year: 2024 });

  assert.equal(payload.schemaVersion, 'question-import.v2');
  assert.equal(payload.questions.length, 2);
  assert.equal(payload.contexts.length, 1);
  assert.deepEqual(payload.contexts[0].questionNumbers, [12, 13]);
  assert.equal(payload.questions[0].source.contextTempId, payload.contexts[0].tempId);
  assert.equal(payload.questions[0].content.supportText, '<p>Texto de apoio.</p>');
  assert.equal(payload.questions[0].answer.raw, 'B');
  assert.deepEqual(payload.questions[0].answer.correctAlternativeTempIds, ['gran_q_991_alt_b']);
  assert.equal(payload.questions[0].publication.status, 'draft');
  assert.equal(payload.questions[0].publication.visibility, 'private');
  assert.equal(payload.questions[0].review.required, true);
  assert.ok(payload.questions[0].review.reasons.includes('coleta_externa_requer_revisao'));
  assert.equal(payload.questions[0].filters.subjects[0].label, 'Lingua Portuguesa');
  assert.equal(payload.questions[0].filters.topics[0].label, 'Interpretacao de textos');
  assert.equal(payload.questions[0].filters.subtopics[0].label, 'Inferencia');
  assert.equal(validateQuestionImportPayload(payload).length, 0);
});

test('remove apoio individual somente quando duplica o contexto compartilhado', () => {
  const payload = mapGranBatchToQuestionImport([rawQuestion({
    textos_questao: [{ texto: '<p>Contexto compartilhado.</p>' }],
  })]);
  assert.equal(payload.questions[0].content.supportText, '');
  assert.equal(payload.questions[0].source.contextTempId, payload.contexts[0].tempId);
});

test('nao usa IDs remotos como IDs locais de taxonomia', () => {
  const payload = mapGranBatchToQuestionImport([rawQuestion({
    bancas: [{ id: 987654, sigla: 'IBFC', nome: 'Instituto Brasileiro de Formacao' }],
  })]);
  assert.equal('id' in payload.questions[0].filters.examBoards[0], false);
  assert.deepEqual(payload.questions[0].filters.examBoards[0], { label: 'IBFC', slug: 'ibfc' });
});

test('remove elementos executaveis e mantem marcadores de assets permitidos', () => {
  assert.equal(sanitizeRichText('<p>Seguro</p><script>alert(1)</script>'), '<p>Seguro</p>');
  const payload = mapGranBatchToQuestionImport([rawQuestion({
    grupo_questao: null,
    enunciado: '<p>Veja:</p><img src="https://arquivos.infra-questoes.grancursosonline.com.br/a.png" onerror="alert(1)">',
  })]);
  assert.match(payload.questions[0].content.statement, /\[image:gran_q_991_img_1\]/);
  assert.equal(payload.questions[0].assets.length, 1);
  assert.equal(payload.questions[0].assets[0].url, 'https://arquivos.infra-questoes.grancursosonline.com.br/a.png');
});

test('deduplica a mesma questao pelo identificador externo', () => {
  const payload = mapGranBatchToQuestionImport([rawQuestion(), rawQuestion()]);
  assert.equal(payload.questions.length, 1);
});

test('coletor nao persiste bearer nem varre storages do navegador', async () => {
  const source = await readFile(new URL('../gran_capture.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(source, /writeFile\([^)]*authorization/i);
  assert.match(source, /headers\.authorization/);
  assert.match(source, /HTTP 429/);
});
