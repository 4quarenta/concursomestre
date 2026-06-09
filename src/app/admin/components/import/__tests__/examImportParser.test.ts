import { describe, expect, it, vi } from 'vitest';
import { __examImportParserTestApi } from '../useAdminImportWorkflow';

vi.mock('@services/questions', () => ({
  aiService: {},
  questionService: {},
}));

vi.mock('@services/filters', () => ({
  ENEM_FOCUS_NAME: 'ENEM',
  ENEM_SUBJECT_AREA_DESCRIPTIONS: {},
  ENEM_SUBJECT_AREA_OPTIONS: [],
}));

const {
  buildExamTitle,
  buildImportExamTaxonomyMetadata,
  createMechanicalExtractionFromText,
  extractionLikelyNeedsSupportContextFallback,
  extractionNeedsAi,
  extractQuestionNumbersFromText,
  findCarryoverTextContextForQuestion,
  formatStructuredSupportHtml,
  getExtractedQuestionNumber,
  inferExpectedOptionsCountFromText,
  parseAnswerKeyFromText,
  resolveExamParserProfile,
  textNeedsExternalSupportContext,
} = __examImportParserTestApi;

const buildQuestion = (number: number, optionsCount = 4) => {
  const labels = ['a', 'b', 'c', 'd', 'e'].slice(0, optionsCount);
  return [
    `${number}) Enunciado da questao ${number}, assinale a alternativa correta.`,
    ...labels.map((label) => `${label}) Alternativa ${label.toUpperCase()} da questao ${number}.`),
  ].join(' ');
};

const buildIbfcFixture = () => {
  const parts = [
    [
      'IBFC_01 - VERSAO D',
      'LINGUA PORTUGUESA',
      'Texto Santinho',
      '',
      'Luiz Fernando Verissimo.',
      '',
      'Me lembro com clareza de todas as minhas professoras. Este texto de apoio deve ser preservado.',
      '',
      'Ele e usado pelas questoes que tratam do texto, do narrador e das passagens destacadas.',
    ].join('\n'),
  ];

  for (let number = 1; number <= 80; number += 1) {
    if (number === 3) {
      parts.push(
        'Considere as duas passagens destacadas abaixo para responder as questoes 3, 4 e 5 seguintes. '
        + '"Era uma mulher pequena com um perfil de passarinho." "Um passarinho imaginario pousou no meu ombro."',
      );
    }
    parts.push(buildQuestion(number, 4));
  }

  return parts.join(' ');
};

describe('exam import parser profiles', () => {
  it('builds exam names as agency, year, organization and role', () => {
    expect(buildExamTitle({
      agency: 'EXATUS',
      year: '2014',
      source: 'PM-RJ',
      role: 'Soldado da Policia Militar',
    })).toBe('EXATUS - 2014 - PM-RJ - Soldado da Policia Militar');

    expect(buildExamTitle({
      agency: 'IBADE',
      year: '2019',
      source: 'PM-RJ',
      role: 'Aspirante da Policia Militar',
    })).toBe('IBADE - 2019 - PM-RJ - Aspirante da Policia Militar');

    expect(buildExamTitle({
      agency: 'IBFC',
      year: '2018',
      source: 'PM-PB / CBM-PB',
      roles: ['Soldado PM - Combatentes - QPC', 'Soldado BM - Combatentes - QBMP - 0'],
    })).toBe('IBFC - 2018 - PM-PB/CBM-PB - Soldado PM - Combatentes - QPC/Soldado BM - Combatentes - QBMP - 0');

    expect(buildExamTitle({
      agency: 'IBFC',
      year: '2018',
      source: 'PM-PB/CBM-PB',
      role: 'SOLDADO',
    })).toBe('IBFC - 2018 - PM-PB/CBM-PB - SOLDADO');

    expect(buildExamTitle({
      title: 'IBFC - 2018 - PM-PB/CBM-PB - SOLDADO',
      agency: 'IBFC',
      year: '2018',
      source: 'PM-PB',
      role: 'Soldado',
    })).toBe('IBFC - 2018 - PM-PB/CBM-PB - SOLDADO');
  });

  it('builds publish metadata with bank, organizations and roles as taxonomies', () => {
    const metadata = buildImportExamTaxonomyMetadata({
      agency: 'IBFC',
      year: '2018',
      source: 'PM-PB/CBM-PB',
      role: 'SOLDADO PM/SOLDADO BM',
    });

    expect(metadata.payload.banca).toEqual(expect.objectContaining({
      name: 'IBFC',
      sigla: 'IBFC',
      slug: 'ibfc',
    }));
    expect(metadata.payload.bancas).toHaveLength(1);
    expect(metadata.payload.sources).toEqual(['PM-PB', 'CBM-PB']);
    expect(metadata.payload.orgaos).toEqual([
      expect.objectContaining({ name: 'PM-PB', slug: 'pm-pb' }),
      expect.objectContaining({ name: 'CBM-PB', slug: 'cbm-pb' }),
    ]);
    expect(metadata.payload.roles).toEqual(['SOLDADO PM', 'SOLDADO BM']);
    expect(metadata.payload.cargos).toEqual([
      expect.objectContaining({ name: 'SOLDADO PM', descricao: 'SOLDADO PM', slug: 'soldado-pm' }),
      expect.objectContaining({ name: 'SOLDADO BM', descricao: 'SOLDADO BM', slug: 'soldado-bm' }),
    ]);
  });

  it('detects IBFC as a parser profile without changing the generic fallback', () => {
    expect(resolveExamParserProfile('IBFC_01 - VERSAO D').id).toBe('ibfc');
    expect(resolveExamParserProfile('Banca qualquer').id).toBe('generic');
  });

  it('extracts the IBFC 80-question model with four alternatives and shared contexts', () => {
    const result = createMechanicalExtractionFromText(
      buildIbfcFixture(),
      2,
      'ibfc-2018-pm-pb-soldado-da-policia-militar-prova.pdf',
    );

    const numbers = result.questions.map((question) => Number(question.questionNumber || question.number));
    expect(numbers).toEqual(Array.from({ length: 80 }, (_, index) => index + 1));
    expect(result.questions.every((question) => question.options?.length === 4)).toBe(true);
    expect(result.questions.every((question) => Number(question.expectedOptionsCount) === 4)).toBe(true);

    const sharedContext = result.pageContexts?.find((context) => (
      context.appliesToQuestionNumbers?.join(',') === '3,4,5'
    ));
    expect(sharedContext?.text).toContain('Considere as duas passagens destacadas');
    expect(result.questions.find((question) => Number(question.questionNumber) === 3)?.contextKey)
      .toBe(sharedContext?.contextKey);
    expect(result.questions.find((question) => Number(question.questionNumber) === 2)?.options?.[3])
      .not.toContain('Considere');
  });

  it('marks canceled answers from official answer keys', () => {
    const keyMap = parseAnswerKeyFromText('1 A 2 B 27 * 59 Anulada 60 X');
    expect(keyMap[1]).toBe(0);
    expect(keyMap[27]).toBe(-1);
    expect(keyMap[59]).toBe(-1);
    expect(keyMap[60]).toBe(-1);
  });

  it('keeps the IBFC page with questions 64 through 73 aligned with the answer key', () => {
    const result = createMechanicalExtractionFromText(
      [
        'IBFC_01 - VERSAO D',
        ...Array.from({ length: 7 }, (_, index) => buildQuestion(index + 64, 4)),
        'GEOGRAFIA E HISTORIA DA PARAIBA',
        ...Array.from({ length: 3 }, (_, index) => buildQuestion(index + 71, 4)),
      ].join(' '),
      7,
      'ibfc-2018-pm-pb-soldado-da-policia-militar-prova.pdf',
    );

    expect(result.questions.map((question) => getExtractedQuestionNumber(question, 0)))
      .toEqual([64, 65, 66, 67, 68, 69, 70, 71, 72, 73]);
    expect(result.questions.every((question) => question.options?.length === 4)).toBe(true);
  });

  it('accepts pasted question text and keeps answer alternatives separated', () => {
    const result = createMechanicalExtractionFromText(
      [
        '8) Em "Talvez por medo de que ela se materializasse aqui ao meu lado e exigisse o Dona" (1o paragrafo),',
        'o carater hipotetico do que se afirma no fragmento e introduzido pelo talvez e reforcado pelos verbos flexionados no:',
        'a) Preterito perfeito do Indicativo.',
        'b) Preterito imperfeito do Subjuntivo.',
        'c) Futuro do preterito do Indicativo.',
        'd) Futuro do Subjuntivo.',
      ].join(' '),
      1,
      'ibfc-2018-pm-pb-soldado-da-policia-militar-prova.pdf',
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].questionNumber).toBe(8);
    expect(result.questions[0].options).toEqual([
      'Preterito perfeito do Indicativo.',
      'Preterito imperfeito do Subjuntivo.',
      'Futuro do preterito do Indicativo.',
      'Futuro do Subjuntivo.',
    ]);
    expect(result.questions[0].text).toContain('carater hipotetico');
    expect(result.questions[0].text).not.toContain('a) Preterito');
  });

  it('tolerates IBFC question markers extracted with a dot without treating years as questions', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Fonte: JANUARIO, 2009. (Adaptado).',
        '64. Relativamente a imputabilidade penal, assinale a alternativa correta:',
        'a) Alternativa A da questao 64.',
        'b) Alternativa B da questao 64.',
        'c) Alternativa C da questao 64.',
        'd) Alternativa D da questao 64.',
        '65. Ticio pratica atos de violencia e deve responder pelo delito de:',
        'a) Alternativa A da questao 65.',
        'b) Alternativa B da questao 65.',
        'c) Alternativa C da questao 65.',
        'd) Alternativa D da questao 65.',
      ].join(' '),
      7,
      'ibfc-2018-pm-pb-soldado-da-policia-militar-prova.pdf',
    );

    expect(result.questions.map((question) => getExtractedQuestionNumber(question, 0))).toEqual([64, 65]);
    expect(result.questions.every((question) => question.options?.length === 4)).toBe(true);
  });

  it('keeps generic numbered and word-marker questions working for A-D and A-E models', () => {
    const numbered = createMechanicalExtractionFromText(buildQuestion(12, 4), 1, 'generic.pdf');
    expect(numbered.questions).toHaveLength(1);
    expect(numbered.questions[0].questionNumber).toBe(12);
    expect(numbered.questions[0].options).toHaveLength(4);

    const wordMarker = createMechanicalExtractionFromText(
      `Questao 13 ${buildQuestion(13, 5).replace(/^13\)\s*/, '')}`,
      1,
      'generic.pdf',
    );
    expect(wordMarker.questions).toHaveLength(1);
    expect(wordMarker.questions[0].questionNumber).toBe(13);
    expect(wordMarker.questions[0].options).toHaveLength(5);
    expect(inferExpectedOptionsCountFromText(wordMarker.questions[0].text, wordMarker.questions[0].options?.join(' ')))
      .toBe(5);
  });

  it('detects common multi-bank profiles and keeps their expected option counts', () => {
    [
      ['fgv-prova.pdf', 'FGV Questao 1 Assinale a alternativa correta. A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon.', 'fgv', 5],
      ['fcc-prova.pdf', 'FCC QUESTAO 01 Assinale a alternativa correta. A. Alfa. B. Beta. C. Gama. D. Delta. E. Epsilon.', 'fcc', 5],
      ['vunesp-prova.pdf', 'VUNESP Q. 1 Assinale a alternativa correta. A - Alfa. B - Beta. C - Gama. D - Delta. E - Epsilon.', 'vunesp', 5],
      ['enem-2024.pdf', 'ENEM Q1 Assinale a alternativa correta. A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon.', 'enem', 5],
      ['instituto-aocp-prova.pdf', 'Instituto AOCP 01 - Assinale a alternativa correta. A) Alfa. B) Beta. C) Gama. D) Delta.', 'instituto-aocp', 4],
      ['idecan-prova.pdf', 'IDECAN 1. Assinale a alternativa correta. A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon.', 'idecan', 5],
      ['quadrix-prova.pdf', 'Quadrix Item 1 Assinale a alternativa correta. A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon.', 'quadrix', 5],
    ].forEach(([fileName, text, profileId, optionsCount]) => {
      expect(resolveExamParserProfile(fileName).id).toBe(profileId);
      const result = createMechanicalExtractionFromText(String(text), 1, String(fileName));
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].options).toHaveLength(Number(optionsCount));
      expect(Number(result.questions[0].expectedOptionsCount)).toBe(Number(optionsCount));
    });
  });

  it('detects the expanded national bank profile catalog', () => {
    [
      ['IADES', 'iades'],
      ['FUNDATEC concurso publico', 'fundatec'],
      ['CETRO prova objetiva', 'cetro'],
      ['CONSULPLAN', 'consulplan'],
      ['Instituto Mais', 'instituto-mais'],
      ['NC-UFPR vestibular', 'nc-ufpr'],
      ['FUMARC', 'fumarc'],
      ['FEPESE', 'fepese'],
      ['FUNRIO', 'funrio'],
      ['IESES', 'ieses'],
      ['Instituto ACCESS', 'instituto-access'],
      ['Instituto Consultec', 'instituto-consultec'],
      ['Instituto Selecon', 'instituto-selecon'],
      ['Avanca SP', 'avanca-sp'],
      ['CETAP', 'cetap'],
      ['FUNCAB', 'funcab'],
      ['VUNESP Militar Soldado PM', 'vunesp-militar'],
      ['ESAF acervo antigo', 'esaf'],
      ['Fundacao CESGRANRIO', 'cesgranrio'],
      ['FUVEST vestibular tradicional', 'vestibular'],
    ].forEach(([signal, profileId]) => {
      expect(resolveExamParserProfile(signal).id).toBe(profileId);
    });
  });

  it('recognizes standalone numeric question markers and loose option letters', () => {
    const result = createMechanicalExtractionFromText(
      [
        '001',
        'Assinale a alternativa correta sobre o tema apresentado:',
        'A Alfa.',
        'B Beta.',
        'C Gama.',
        'D Delta.',
        '002',
        'Assinale a alternativa incorreta sobre o mesmo tema:',
        'A Uma afirmacao.',
        'B Outra afirmacao.',
        'C Terceira afirmacao.',
        'D Quarta afirmacao.',
      ].join('\n'),
      1,
      'generic.pdf',
    );

    expect(extractQuestionNumbersFromText('001\nAssinale a alternativa correta.\n002\nAssinale a alternativa incorreta.'))
      .toEqual([1, 2]);
    expect(result.questions.map((question) => Number(question.questionNumber))).toEqual([1, 2]);
    expect(result.questions.every((question) => question.options?.length === 4)).toBe(true);
  });

  it('keeps non-monotonic and incomplete numbered drafts instead of dropping them', () => {
    const outOfOrder = createMechanicalExtractionFromText(
      [
        buildQuestion(1, 4),
        buildQuestion(3, 4),
        buildQuestion(2, 4),
      ].join(' '),
      1,
      'generic.pdf',
    );
    const incomplete = createMechanicalExtractionFromText(
      '4) Este item numerado veio sem alternativas no OCR e deve ser mantido para revisao manual.',
      1,
      'generic.pdf',
    );

    expect(outOfOrder.questions.map((question) => Number(question.questionNumber))).toEqual([1, 3, 2]);
    expect(incomplete.questions).toHaveLength(1);
    expect(incomplete.questions[0].questionNumber).toBe(4);
    expect(incomplete.questions[0].extractionStatus).toBe('incompleta');
    expect(incomplete.questions[0].statusReasons).toContain('sem_alternativas');
  });

  it('keeps duplicate numbered drafts and flags them for review', () => {
    const result = createMechanicalExtractionFromText(
      [
        buildQuestion(10, 4),
        buildQuestion(10, 4).replace('Enunciado da questao 10', 'Outro enunciado da questao 10'),
      ].join(' '),
      1,
      'generic.pdf',
    );

    expect(result.questions.map((question) => Number(question.questionNumber))).toEqual([10, 10]);
    expect(result.questions.every((question) => question.statusReasons?.includes('numero_duplicado'))).toBe(true);
  });

  it('parses national answer-key variants including cancellations and attributed-to-all markers', () => {
    const keyMap = parseAnswerKeyFromText([
      '001 - A',
      '002-B',
      '003 Questao cancelada',
      '004 Atribuida a todos',
      '005 T',
      '006 TODOS',
    ].join(' '));

    expect(keyMap[1]).toBe(0);
    expect(keyMap[2]).toBe(1);
    expect(keyMap[3]).toBe(-1);
    expect(keyMap[4]).toBe(-2);
    expect(keyMap[5]).toBe(-2);
    expect(keyMap[6]).toBe(-2);
  });

  it('extracts CEBRASPE/CESPE items as certo ou errado with shared text context', () => {
    const result = createMechanicalExtractionFromText(
      [
        'CEBRASPE',
        'Texto para os itens 1 e 2',
        'Texto I',
        'A administracao publica deve observar a legalidade e a impessoalidade em seus atos.',
        'Julgue os itens a seguir.',
        'Item 1 A legalidade administrativa limita a atuacao do gestor publico.',
        'Item 2 O texto apresentado afasta a necessidade de motivacao dos atos administrativos.',
      ].join('\n'),
      1,
      'cebraspe-prova.pdf',
    );

    expect(result.questions.map((question) => Number(question.questionNumber))).toEqual([1, 2]);
    expect(result.questions.every((question) => question.options?.join('|') === 'Certo|Errado')).toBe(true);
    expect(result.questions.every((question) => question.modality === 'certo ou errado')).toBe(true);
    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([1, 2]);
    expect(result.questions[0].contextKey).toBe(result.pageContexts?.[0]?.contextKey);
  });

  it('marks a question that references a missing text context for review', () => {
    const result = createMechanicalExtractionFromText(
      [
        '1) Com base no texto, assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
      ].join(' '),
      1,
      'generic.pdf',
    );

    expect(result.questions[0].extractionStatus).toBe('revisar');
    expect(result.questions[0].statusReasons).toContain('contexto_referenciado_nao_encontrado');
  });

  it('formats structured support text without flattening title, author, paragraphs or highlights', () => {
    const html = formatStructuredSupportHtml([
      'Texto I',
      'Santinho',
      'Luiz Fernando Verissimo',
      '',
      'Me lembro com clareza de todas as minhas professoras.',
      '',
      'O <strong>menino</strong> observava a sala.',
    ].join('\n'));

    expect(html).toContain('<h4>Texto I</h4>');
    expect(html).toContain('<p>Santinho</p>');
    expect(html).toContain('<p><em>Luiz Fernando Verissimo</em></p>');
    expect(html).toContain('<p>Me lembro com clareza');
    expect(html).toContain('<strong>menino</strong>');
  });

  it('preserves a figure marker between support paragraphs', () => {
    const html = formatStructuredSupportHtml([
      'Paragrafo antes da figura.',
      '',
      '[FIGURA: ctx-001-fig-01]',
      '',
      'Paragrafo depois da figura.',
    ].join('\n'));

    expect(html).toBe('<p>Paragrafo antes da figura.</p>[FIGURA: ctx-001-fig-01]<p>Paragrafo depois da figura.</p>');
  });

  it('formats simple pipe tables without flattening rows and columns', () => {
    const html = formatStructuredSupportHtml([
      'Ano | Populacao',
      '2020 | 100',
      '2021 | 200',
    ].join('\n'));

    expect(html).toContain('<table>');
    expect(html).toContain('<th>Ano</th>');
    expect(html).toContain('<td>2021</td>');
    expect(html).not.toContain('Ano Populacao 2020 100 2021 200');
  });

  it('preserves poems and legal articles with relevant line breaks', () => {
    const poemHtml = formatStructuredSupportHtml([
      'Minha terra tem palmeiras',
      'Onde canta o sabia',
      '',
      'As aves que aqui gorjeiam',
      'Nao gorjeiam como la',
    ].join('\n'));
    const lawHtml = formatStructuredSupportHtml([
      'Art. 5o',
      'I - todos sao iguais perante a lei;',
      'II - ninguem sera obrigado a fazer algo senao em virtude de lei;',
      '§1o As normas definidoras tem aplicacao imediata.',
    ].join('\n'));

    expect(poemHtml).toContain('Minha terra tem palmeiras<br />Onde canta o sabia');
    expect(poemHtml).toContain('As aves que aqui gorjeiam<br />Nao gorjeiam como la');
    expect(lawHtml).toContain('Art. 5o<br />I - todos sao iguais');
    expect(lawHtml).toContain('§1o As normas definidoras');
  });

  it('keeps Texto I and Texto II as separate shared contexts', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto I',
        'Primeiro texto-base usado na comparacao entre os textos.',
        '',
        'Texto II',
        'Segundo texto-base usado na comparacao entre os textos.',
        '',
        '1) Leia os textos I e II e assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
        '2) Em relacao aos textos, assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
      ].join('\n'),
      1,
      'generic.pdf',
    );

    expect(result.pageContexts?.map((context) => context.title)).toEqual(['Texto I', 'Texto II']);
    expect(result.pageContexts?.[0]?.text).toContain('Primeiro texto-base');
    expect(result.pageContexts?.[0]?.text).not.toContain('Segundo texto-base');
    expect(result.pageContexts?.[1]?.text).toContain('Segundo texto-base');
  });

  it('separates bibliographic references from shared support text', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto I',
        'Texto-base com informacoes relevantes para a questao.',
        'Fonte: Revista Brasileira, 2020. Adaptado.',
        buildQuestion(1, 4),
        buildQuestion(2, 4),
      ].join('\n'),
      1,
      'generic.pdf',
    );

    const context = result.pageContexts?.[0];
    expect(context?.text).toContain('Texto-base com informacoes');
    expect(context?.text).not.toContain('Fonte: Revista Brasileira');
    expect(context?.referenceText).toContain('Fonte: Revista Brasileira, 2020');
  });

  it('marks corrupted table, poem and cross-page context references for review', () => {
    const table = createMechanicalExtractionFromText(
      '1) Analise a tabela Ano Populacao 2020 100 2021 200 2022 300 e assinale a alternativa correta. a) Alfa. b) Beta. c) Gama. d) Delta.',
      1,
      'generic.pdf',
    );
    const poem = createMechanicalExtractionFromText(
      '1) No poema Minha terra tem palmeiras Onde canta o sabia As aves que aqui gorjeiam Nao gorjeiam como la, assinale a alternativa correta. a) Alfa. b) Beta. c) Gama. d) Delta.',
      1,
      'generic.pdf',
    );
    const broken = createMechanicalExtractionFromText(
      '1) Na continuidade do texto da pagina anterior, assinale a alternativa correta. a) Alfa. b) Beta. c) Gama. d) Delta.',
      2,
      'generic.pdf',
    );

    expect(table.questions[0].statusReasons).toContain('tabela_corrompida');
    expect(poem.questions[0].statusReasons).toContain('poema_corrompido');
    expect(broken.questions[0].statusReasons).toContain('contexto_quebrado_entre_paginas');
  });

  it('marks flattened legal provisions for review', () => {
    const result = createMechanicalExtractionFromText(
      [
        '1) Considere o seguinte dispositivo legal: Art. 5o todos sao iguais perante a lei, sem distincao de qualquer natureza,',
        'I - homens e mulheres sao iguais em direitos e obrigacoes; II - ninguem sera obrigado a fazer ou deixar de fazer alguma coisa senao em virtude de lei;',
        '§1o as normas definidoras dos direitos e garantias fundamentais tem aplicacao imediata. Assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
      ].join(' '),
      1,
      'generic.pdf',
    );

    expect(result.questions[0].statusReasons).toContain('lei_corrompida');
  });

  it('signals figure-dependent charge, comic strip, graph and map questions without crop boxes', () => {
    [
      'Observe a charge e assinale a alternativa correta.',
      'Observe a tirinha e assinale a alternativa correta.',
      'Observe o grafico e assinale a alternativa correta.',
      'Observe o mapa e assinale a alternativa correta.',
    ].forEach((statement, index) => {
      const result = createMechanicalExtractionFromText(
        `${index + 1}) ${statement} a) Alfa. b) Beta. c) Gama. d) Delta.`,
        1,
        'generic.pdf',
      );
      expect(result.questions[0].statusReasons).toContain('figura_sem_recorte');
    });
  });

  it('creates placeholders for compact visual alternatives', () => {
    const result = createMechanicalExtractionFromText(
      'ENEM 1) O grafico que representa corretamente a situacao descrita esta em: A B C D E',
      1,
      'enem-2024.pdf',
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options).toEqual([
      'Alternativa visual A',
      'Alternativa visual B',
      'Alternativa visual C',
      'Alternativa visual D',
      'Alternativa visual E',
    ]);
    expect(result.questions[0].statusReasons).toContain('figura_sem_recorte');
  });

  it('promotes support text before the first question as shared context', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto I Este e um texto de apoio longo, com mais de cento e vinte caracteres, '
          + 'usado para responder as questoes seguintes e preservar o contexto na importacao.',
        buildQuestion(1, 4),
        buildQuestion(2, 4),
      ].join(' '),
      1,
      'generic.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([1, 2]);
    expect(result.questions[0].contextKey).toBe(result.pageContexts?.[0]?.contextKey);
    expect(result.questions[1].contextKey).toBe(result.pageContexts?.[0]?.contextKey);
  });

  it('links explicit shared support ranges written as question numbers', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Leia o texto, para responder as questoes de numeros 03 a 05.',
        'Texto I',
        'Um texto-base com paragrafos suficientes para orientar somente as questoes indicadas.',
        buildQuestion(3, 4),
        buildQuestion(4, 4),
        buildQuestion(5, 4),
        buildQuestion(6, 4),
      ].join('\n'),
      2,
      'fcc-prova.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([3, 4, 5]);
    expect(result.questions.filter((question) => question.contextKey).map((question) => Number(question.questionNumber)))
      .toEqual([3, 4, 5]);
    expect(result.questions.find((question) => Number(question.questionNumber) === 6)?.contextKey).toBe('');
  });

  it('links explicit shared support ranges written without the word numbers', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Atencao: Para responder as questoes de 1 a 3, leia o texto abaixo.',
        'Texto-base com informacoes comuns para as tres perguntas seguintes.',
        buildQuestion(1, 4),
        buildQuestion(2, 4),
        buildQuestion(3, 4),
        buildQuestion(4, 4),
      ].join('\n'),
      1,
      'generic.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([1, 2, 3]);
    expect(result.questions.filter((question) => question.contextKey).map((question) => Number(question.questionNumber)))
      .toEqual([1, 2, 3]);
    expect(result.questions.find((question) => Number(question.questionNumber) === 4)?.contextKey).toBe('');
  });

  it('links explicit shared support lists written with item numbers', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto para os itens 1 e 2',
        'Texto I',
        'A administracao publica deve observar principios constitucionais no cotidiano institucional.',
        'Item 1 O texto apresentado menciona a legalidade administrativa.',
        'Item 2 Com base no texto, e correto afirmar que ha dever de impessoalidade.',
      ].join('\n'),
      1,
      'cebraspe-prova.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([1, 2]);
    expect(result.questions.every((question) => question.contextKey === result.pageContexts?.[0]?.contextKey))
      .toBe(true);
  });

  it('infers shared context by usage when no range is explicit', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto I',
        'O documento descreve um episodio historico e apresenta dados de uma tabela usada para interpretacao.',
        '1) Em relacao ao texto, assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
        '2) Com base na tabela, assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
        buildQuestion(3, 4),
      ].join('\n'),
      1,
      'generic.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([1, 2]);
    expect(result.questions.find((question) => Number(question.questionNumber) === 1)?.contextKey)
      .toBe(result.pageContexts?.[0]?.contextKey);
    expect(result.questions.find((question) => Number(question.questionNumber) === 2)?.contextKey)
      .toBe(result.pageContexts?.[0]?.contextKey);
    expect(result.questions.find((question) => Number(question.questionNumber) === 3)?.contextKey).toBe('');
  });

  it('keeps one-question support text inside the question instead of pageContexts', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Texto I',
        'Um texto-base individual usado apenas por uma pergunta de interpretacao.',
        '1) Com base no texto, assinale a alternativa correta.',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
        buildQuestion(2, 4),
      ].join('\n'),
      1,
      'generic.pdf',
    );

    expect(result.pageContexts).toEqual([]);
    expect(result.questions[0].contextKey).toBe('');
    expect(result.questions[0].supportText).toContain('Um texto-base individual');
    expect(result.questions[1].supportText || '').toBe('');
  });

  it('links text-dependent statements such as memorialistic perspective to the base text', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Santinho',
        '',
        'Luiz Fernando Verissimo',
        '',
        'Me lembro com clareza de todas as minhas professoras. A narrativa recupera cenas da escola, '
          + 'da infancia e das lembrancas do narrador, formando um texto-base amplo para interpretacao.',
        '',
        '1) Em relacao ao entendimento do sentido global do texto, e correto afirmar que:',
        'a) Alfa.',
        'b) Beta.',
        'c) Gama.',
        'd) Delta.',
        '2) O texto assume um carater memorialistico estabelecendo-se, assim, um recorte de posicionamento a partir da perspectiva:',
        'a) do leitor.',
        'b) dos alunos.',
        'c) do narrador.',
        'd) da professora.',
      ].join('\n'),
      1,
      'ibfc-prova.pdf',
    );

    const question = result.questions.find((item) => Number(item.questionNumber) === 2);
    expect(textNeedsExternalSupportContext(String(question?.text || ''))).toBe(true);
    expect(question?.contextKey).toBe(result.pageContexts?.[0]?.contextKey);
    expect(result.pageContexts?.[0]?.text).toContain('Me lembro com clareza');
  });

  it('uses explicit context scope and does not link a 3-5 text to unrelated questions', () => {
    const result = createMechanicalExtractionFromText(
      [
        'Considere as duas passagens destacadas abaixo para responder as questoes 3, 4 e 5 seguintes.',
        '"Era uma mulher pequena com um perfil de passarinho. Um pequeno passarinho loiro. E uma fera." (1o paragrafo)',
        '"nao foram poucas as vezes em que um passarinho imaginario com perfil de professora pousou no meu ombro e me chamou de fingido" (3o paragrafo)',
        ...Array.from({ length: 8 }, (_, index) => buildQuestion(index + 1, 4)),
      ].join('\n'),
      2,
      'ibfc-prova.pdf',
    );

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([3, 4, 5]);
    expect(result.questions.filter((question) => question.contextKey).map((question) => Number(question.questionNumber)))
      .toEqual([3, 4, 5]);
    expect(result.questions.find((question) => Number(question.questionNumber) === 1)?.contextKey).toBe('');
    expect(result.questions.find((question) => Number(question.questionNumber) === 6)?.contextKey).toBe('');
  });

  it('uses AI fallback when a page has support context signals but no context was linked', () => {
    const pageText = [
      'Considere as duas passagens destacadas abaixo para responder as questoes 3, 4 e 5 seguintes.',
      '"Era uma mulher pequena com um perfil de passarinho."',
      '"nao foram poucas as vezes em que um passarinho imaginario pousou no meu ombro."',
      buildQuestion(3, 4),
      buildQuestion(4, 4),
      buildQuestion(5, 4),
    ].join('\n');

    expect(extractionNeedsAi(pageText, {
      metadata: {},
      pageContexts: [],
      questions: [
        { number: '3', questionNumber: 3, text: 'O texto assume um carater memorialistico?', options: ['A', 'B', 'C', 'D'] },
        { number: '4', questionNumber: 4, text: 'No trecho destacado, assinale a correta.', options: ['A', 'B', 'C', 'D'] },
        { number: '5', questionNumber: 5, text: 'Em relacao ao texto, assinale a correta.', options: ['A', 'B', 'C', 'D'] },
      ],
    }, false, false)).toBe(true);
  });

  it('does not use context fallback when explicit support context is already linked', () => {
    const pageText = [
      'Considere as duas passagens destacadas abaixo para responder as questoes 3, 4 e 5 seguintes.',
      '"Era uma mulher pequena com um perfil de passarinho."',
      '"nao foram poucas as vezes em que um passarinho imaginario pousou no meu ombro."',
      buildQuestion(3, 4),
      buildQuestion(4, 4),
      buildQuestion(5, 4),
    ].join('\n');
    const result = createMechanicalExtractionFromText(pageText, 2, 'ibfc-prova.pdf');
    const parserProfile = resolveExamParserProfile('ibfc-prova.pdf', pageText);

    expect(result.pageContexts?.[0]?.appliesToQuestionNumbers).toEqual([3, 4, 5]);
    expect(extractionLikelyNeedsSupportContextFallback(pageText, result, parserProfile)).toBe(false);
  });

  it('carries broad text contexts to following pages without reusing specific fragments', () => {
    const mainContext = {
      tempId: 'pag-2-contexto-textual',
      title: 'Texto de apoio - pagina 2',
      text: 'Texto Santinho\n\nTexto base longo usado pelas questoes de interpretacao.',
      questionNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      hasFigure: false,
      figureDescription: '',
      page: 2,
    };
    const fragmentContext = {
      tempId: 'pag-3-contexto-q-14-16',
      title: 'Texto de apoio - questoes 14, 15, 16',
      text: 'Considere o fragmento abaixo para responder as questoes 14, 15 e 16.',
      questionNumbers: [14, 15, 16],
      hasFigure: false,
      figureDescription: '',
      page: 3,
    };

    expect(textNeedsExternalSupportContext('O modo como o pronome foi empregado no inicio da primeira oracao do texto.'))
      .toBe(true);
    expect(textNeedsExternalSupportContext('Considerando o conjunto verdade dos conectivos logicos proposicionais.'))
      .toBe(false);
    expect(findCarryoverTextContextForQuestion(17, 3, [mainContext, fragmentContext])?.tempId)
      .toBe('pag-2-contexto-textual');
  });

  it('counts imported drafts that only expose the number field in diagnostics', () => {
    expect(getExtractedQuestionNumber({ number: '64' } as never, 1)).toBe(64);
    expect(getExtractedQuestionNumber({ question_number: '65' } as never, 1)).toBe(65);
    expect(getExtractedQuestionNumber({ questionNumber: 66 } as never, 1)).toBe(66);
  });
});
