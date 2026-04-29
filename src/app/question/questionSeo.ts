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

import type { Question } from '@types';
import { getQuestionSeoLabel, summarizeSeoText } from '@services/seo/slug';

const stripHtml = (value: unknown) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const unique = (values: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    result.push(normalized);
  });

  return result;
};

const readNamedValue = (item: any, keys: string[]) => {
  if (!item) return '';
  if (typeof item === 'string' || typeof item === 'number') return String(item);

  for (const key of keys) {
    if (item[key]) return String(item[key]);
  }

  return '';
};

export const getQuestionContextLabels = (question: Partial<Question>) => {
  const bancas = unique((question.bancas || []).map((item: any) => readNamedValue(item, ['sigla', 'nome', 'name'])));
  const orgaos = unique((question.orgaos || []).map((item: any) => readNamedValue(item, ['sigla', 'nome', 'name'])));
  const cargos = unique((question.cargos || []).map((item: any) => readNamedValue(item, ['descricao', 'descrição', 'name', 'nome'])));
  const assuntos = unique((question.assuntos || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'slug'])));
  const carreiras = unique((question.carreiras || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'descricao', 'descrição'])));
  const anos = unique((question.anos || []).map((ano) => String(ano)));
  const provas = unique((question.provas || []).map((item: any) => readNamedValue(item, ['nome', 'name', 'slug'])));
  const nivel = readNamedValue(question.nivel || question.level, ['nome', 'name', 'descricao', 'descrição']) || String(question.nivel || question.level || '').trim();

  return {
    banca: bancas[0] || '',
    bancas,
    orgao: orgaos[0] || '',
    orgaos,
    cargo: cargos[0] || '',
    cargos,
    assunto: assuntos[0] || '',
    assuntos,
    carreira: carreiras[0] || '',
    carreiras,
    ano: anos[0] || '',
    anos,
    prova: provas[0] || '',
    provas,
    nivel,
  };
};

export const buildQuestionPageHeading = (question: Partial<Question>) => {
  const context = getQuestionContextLabels(question);
  const prefix = unique([
    'Questão de concurso',
    context.banca,
    context.orgao,
    context.ano,
    context.assunto,
  ]).join(' ');

  return summarizeSeoText(`${prefix}: ${getQuestionSeoLabel(question)}`, 118);
};

export const buildQuestionMetaTitle = (question: Partial<Question>) => {
  const context = getQuestionContextLabels(question);
  const parts = unique([
    'Questão comentada',
    context.banca,
    context.orgao,
    context.ano,
    context.assunto,
  ]);

  return summarizeSeoText(parts.join(' - ') || getQuestionSeoLabel(question), 62);
};

export const buildQuestionMetaDescription = (question: Partial<Question>) => {
  const context = getQuestionContextLabels(question);
  const contextText = unique([
    context.banca ? `banca ${context.banca}` : '',
    context.orgao ? `órgão ${context.orgao}` : '',
    context.cargo ? `cargo ${context.cargo}` : '',
    context.assunto ? `assunto ${context.assunto}` : '',
    context.ano ? `ano ${context.ano}` : '',
  ]).join(', ');
  const questionText = summarizeSeoText(stripHtml(question.enunciado_clean || question.enunciado || getQuestionSeoLabel(question)), 110);

  return summarizeSeoText(
    `Resolva questão de concurso${contextText ? ` de ${contextText}` : ''}. Enunciado, alternativas e prática gratuita no ConcursoMestre: ${questionText}`,
    160,
  );
};

export const buildQuestionKeywords = (question: Partial<Question>) => {
  const context = getQuestionContextLabels(question);
  const base = [
    'questões de concurso',
    'questão comentada',
    'resolver questões',
    'simulado para concurso',
    'banco de questões',
    context.banca && `questões ${context.banca}`,
    context.orgao && `questões ${context.orgao}`,
    context.cargo && `questões ${context.cargo}`,
    context.assunto && `questões de ${context.assunto}`,
    context.ano && `questões ${context.ano}`,
    ...context.bancas,
    ...context.orgaos,
    ...context.cargos,
    ...context.assuntos,
    ...context.carreiras,
  ];

  return unique(base).slice(0, 18);
};

export const buildQuestionKeywordPills = (question: Partial<Question>) => {
  const context = getQuestionContextLabels(question);
  return unique([
    'Questão de concurso',
    context.banca,
    context.orgao,
    context.cargo,
    context.assunto,
    context.ano,
    context.nivel,
    question.tipo === 'certo ou errado' ? 'Certo ou errado' : 'Múltipla escolha',
  ]).slice(0, 8);
};
