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

import type { Prova, Question, SystemSettings } from '@types';
import { slugify } from '../database/slugify';

const toText = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Normaliza um registro de prova para o formato oficial usado no admin.
 *
 * @since 1.0.0
 */
export const normalizeProvaRecord = (raw: any): Prova | null => {
  if (!raw) {
    return null;
  }

  const id = toNumber(raw.id, 0);
  const nome = toText(raw.nome ?? raw.name);

  if (!id || !nome) {
    return null;
  }

  const bancaNome = toText(raw.banca?.nome ?? raw.banca?.name);
  const bancaSigla = toText(raw.banca?.sigla) || bancaNome;
  const orgaoNome = toText(raw.orgao?.nome ?? raw.orgao?.name);
  const orgaoSigla = toText(raw.orgao?.sigla) || orgaoNome;
  const cargoDescricao = toText(raw.cargo?.descricao ?? raw.cargo?.['descrição'] ?? raw.cargo?.name);

  return {
    id,
    nome,
    slug: toText(raw.slug) || slugify(nome || `prova-${id}`),
    ano: toNumber(raw.ano, new Date().getFullYear()),
    tipo: toNumber(raw.tipo, 0),
    index: toText(raw.index),
    nivel: toText(raw.nivel ?? raw.level),
    banca: {
      ...(raw.banca || {}),
      nome: bancaNome,
      sigla: bancaSigla,
      name: toText(raw.banca?.name) || bancaNome || bancaSigla,
    } as any,
    orgao: {
      ...(raw.orgao || {}),
      nome: orgaoNome,
      sigla: orgaoSigla,
      name: toText(raw.orgao?.name) || orgaoNome || orgaoSigla,
    } as any,
    cargo: {
      ...(raw.cargo || {}),
      descricao: cargoDescricao,
      ['descrição']: cargoDescricao,
      name: toText(raw.cargo?.name) || cargoDescricao,
    } as any,
  };
};

/**
 * Une banco salvo e provas embutidas nas questoes.
 * O cadastro salvo no admin tem prioridade.
 *
 * @since 1.0.0
 */
export const mergeExamBankSources = (
  systemSettings: SystemSettings,
  questions: Question[] = [],
) => {
  const examMap = new Map<string, Prova>();

  const pushExam = (raw: any) => {
    const normalized = normalizeProvaRecord(raw);
    if (!normalized) {
      return;
    }

    examMap.set(String(normalized.id), {
      ...normalized,
      ...examMap.get(String(normalized.id)),
    });
  };

  (systemSettings.examBank || []).forEach(pushExam);
  questions.forEach((question) => {
    (question.provas || []).forEach(pushExam);
  });

  return Array.from(examMap.values()).sort((left, right) => {
    if (right.ano !== left.ano) {
      return right.ano - left.ano;
    }

    return left.nome.localeCompare(right.nome, 'pt-BR');
  });
};

/**
 * Texto curto de exibicao da prova.
 *
 * @since 1.0.0
 */
export const formatProvaLabel = (prova: Prova) => {
  const banca = toText(prova.banca?.sigla || prova.banca?.nome);
  return `${prova.nome} ${prova.ano ? `(${prova.ano})` : ''}${banca ? ` - ${banca}` : ''}`.trim();
};

/**
 * Texto usado na busca do seletor e da lista.
 *
 * @since 1.0.0
 */
export const buildProvaSearchText = (prova: Prova) => (
  [
    prova.id,
    prova.nome,
    prova.ano,
    prova.nivel,
    prova.index,
    prova.banca?.sigla,
    prova.banca?.nome,
    prova.orgao?.sigla,
    prova.orgao?.nome,
    prova.cargo?.descricao,
    prova.cargo?.['descrição'],
  ]
    .map((item) => toText(item).toLowerCase())
    .join(' ')
);

/**
 * Verifica se uma questao esta vinculada a uma prova especifica.
 *
 * @since 1.0.0
 */
export const isQuestionLinkedToProva = (question: Question, provaId: string | number) => {
  const normalizedId = String(provaId);
  return String(question.provaId ?? '') === normalizedId
    || (question.provas || []).some((prova) => String(prova?.id ?? '') === normalizedId);
};

/**
 * Atualiza a representacao local da prova dentro da questao.
 *
 * @since 1.0.0
 */
export const applyProvaToQuestion = (question: Question, prova: Prova): Question => {
  const nextProvas = (question.provas || []).filter((item) => String(item?.id ?? '') !== String(prova.id));
  nextProvas.push(prova);

  return {
    ...question,
    provaId: prova.id,
    provas: nextProvas,
  };
};

/**
 * Remove a vinculacao da prova da questao.
 *
 * @since 1.0.0
 */
export const removeProvaFromQuestion = (question: Question, provaId: string | number): Question => ({
  ...question,
  provaId: String(question.provaId ?? '') === String(provaId) ? undefined : question.provaId,
  provas: (question.provas || []).filter((item) => String(item?.id ?? '') !== String(provaId)),
});

