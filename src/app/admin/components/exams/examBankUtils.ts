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

import type { Banca, Cargo, Orgao, Prova, Question, SystemSettings } from '@types';
import { slugify } from '../database/slugify';

const toText = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
);

/**
 * Normaliza um registro de prova para o formato oficial usado no admin.
 *
 * @since 1.0.0
 */
export const normalizeProvaRecord = (raw: unknown): Prova | null => {
  const rawRecord = toRecord(raw);
  if (!rawRecord) {
    return null;
  }

  const id = toNumber(rawRecord.id, 0);
  const nome = toText(rawRecord.nome ?? rawRecord.name);

  if (!id || !nome) {
    return null;
  }

  const bancaRecord = toRecord(rawRecord.banca);
  const orgaoRecord = toRecord(rawRecord.orgao);
  const cargoRecord = toRecord(rawRecord.cargo);

  const bancaNome = toText(bancaRecord?.nome ?? bancaRecord?.name);
  const bancaSigla = toText(bancaRecord?.sigla) || bancaNome;
  const orgaoNome = toText(orgaoRecord?.nome ?? orgaoRecord?.name);
  const orgaoSigla = toText(orgaoRecord?.sigla) || orgaoNome;
  const cargoDescricao = toText(cargoRecord?.descricao ?? cargoRecord?.['descrição'] ?? cargoRecord?.name);

  const banca: Banca = {
    id: toNumber(bancaRecord?.id, 0),
    sigla: bancaSigla,
    nome: bancaNome,
    name: toText(bancaRecord?.name) || bancaNome || bancaSigla,
    slug: toText(bancaRecord?.slug) || slugify(bancaNome || bancaSigla || `banca-${id}`),
    descricao: toText(bancaRecord?.descricao),
  };

  const orgao: Orgao = {
    id: toNumber(orgaoRecord?.id, 0),
    nome: orgaoNome,
    name: toText(orgaoRecord?.name) || orgaoNome || orgaoSigla,
    sigla: orgaoSigla,
    slug: toText(orgaoRecord?.slug) || slugify(orgaoNome || orgaoSigla || `orgao-${id}`),
  };

  const cargo: Cargo = {
    id: toNumber(cargoRecord?.id, 0),
    slug: toText(cargoRecord?.slug) || slugify(cargoDescricao || `cargo-${id}`),
    ['descrição']: cargoDescricao,
    descricao: cargoDescricao,
    name: toText(cargoRecord?.name) || cargoDescricao,
  };

  return {
    id,
    nome,
    slug: toText(rawRecord.slug) || slugify(nome || `prova-${id}`),
    ano: toNumber(rawRecord.ano, new Date().getFullYear()),
    tipo: toNumber(rawRecord.tipo, 0),
    index: toText(rawRecord.index),
    nivel: toText(rawRecord.nivel ?? rawRecord.level),
    publishStatus: (toText(rawRecord.publishStatus) as Prova['publishStatus']) || 'published',
    visibilityStatus: (toText(rawRecord.visibilityStatus) as Prova['visibilityStatus']) || 'public',
    scheduledAt: toText(rawRecord.scheduledAt),
    banca,
    orgao,
    cargo,
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

  const pushExam = (raw: unknown) => {
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
 * @since v1.0.0
 */
export const formatProvaLabel = (prova: Prova) => {
  const banca = toText(prova.banca?.sigla || prova.banca?.nome);
  return `${prova.nome} ${prova.ano ? `(${prova.ano})` : ''}${banca ? ` - ${banca}` : ''}`.trim();
};

/**
 * Texto usado na busca do seletor e da lista.
 *
 * @since v1.0.0
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
 * @since v1.0.0
 */
export const isQuestionLinkedToProva = (question: Question, provaId: string | number) => {
  const normalizedId = String(provaId);
  return String(question.provaId ?? '') === normalizedId
    || (question.provas || []).some((prova) => String(prova?.id ?? '') === normalizedId);
};

/**
 * Atualiza a representacao local da prova dentro da questao.
 *
 * @since v1.0.0
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
 * @since v1.0.0
 */
export const removeProvaFromQuestion = (question: Question, provaId: string | number): Question => ({
  ...question,
  provaId: String(question.provaId ?? '') === String(provaId) ? undefined : question.provaId,
  provas: (question.provas || []).filter((item) => String(item?.id ?? '') !== String(provaId)),
});
