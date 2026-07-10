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

import { describe, expect, it } from 'vitest';

import { EXTERNAL_AI_EXAM_PROMPT, EXTERNAL_AI_FULL_BATCH_PROMPT } from '../externalAiExamPrompt';

const withoutAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

describe('prompt externo agnostico de provas', () => {
  it('preserva o contrato raiz e o schema consumido pelo importador', () => {
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"schemaVersion": "question-import.v2"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"import"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"exam"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"contexts"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"questions"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"content"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"assets"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('"editorial"');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('Nao use "metadata" no objeto raiz');
  });

  it('proibe suposicoes e alternativas artificiais', () => {
    const prompt = withoutAccents(EXTERNAL_AI_EXAM_PROMPT);

    expect(prompt).toContain('sem inventar conteudo');
    expect(prompt).toContain('Nao crie alternativa vazia');
    expect(prompt).toContain('Preserve a numeracao oficial');
    expect(prompt).toContain('Se a prova comeca na questao 91');
  });

  it('exige pendencia auditavel em vez de invencao', () => {
    const prompt = withoutAccents(EXTERNAL_AI_EXAM_PROMPT);

    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('review.required');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('reasons');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('comentario_editorial_sem_base_suficiente');
    expect(prompt).toContain('Validacao final obrigatoria');
  });

  it('exige classificacao editorial por materia, topico e assunto quando houver base', () => {
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('Filtros por questao');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('subjects');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('topics');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('subtopics');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('id, label e slug');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('Nao deixe topics e subtopics vazios se for possivel inferir');
  });

  it('mantem fallback para arquivo JSON unico', () => {
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('concursomestre-exam.json');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('LIMITE_DA_INTERFACE');
    expect(EXTERNAL_AI_EXAM_PROMPT.trim().endsWith('Retorne somente o JSON final.')).toBe(true);
  });

  it('explicita que questoes vinculadas a contexts nao duplicam o texto compartilhado em content', () => {
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('contexts[].tempId');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('source.contextTempId');
    expect(EXTERNAL_AI_EXAM_PROMPT).toContain('Nao duplique o body do contexto em questions[].content.statement nem em questions[].content.supportText');
  });

  it('usa um prompt unico para extrair o lote e gerar editoriais de todas as questoes', () => {
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain(EXTERNAL_AI_EXAM_PROMPT);
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('Editorial pedagogico');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('type = "teacher_comment"');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('type = "detailed_analysis"');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('Comentario rapido, mas realmente didatico');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('## Gabarito comentado');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('## Analise das alternativas');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT).toContain('Use elementos concretos do enunciado');
    expect(EXTERNAL_AI_FULL_BATCH_PROMPT.trim().endsWith('Retorne somente o JSON final.')).toBe(true);
  });
});
