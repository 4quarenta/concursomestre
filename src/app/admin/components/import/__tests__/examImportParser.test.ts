import { describe, expect, it, vi } from 'vitest';
import { __examImportParserTestApi } from '../useAdminImportWorkflow';
import { buildQuestionPayloadImportCard } from '../adminImportWorkflowCore';

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
  auditQuestionCoverage,
  buildAdaptiveExamParserProfile,
  buildExamTitle,
  buildImportExamTaxonomyMetadata,
  buildPageContentInventory,
  createMechanicalExtractionFromText,
  decideAiExtractionForPage,
  estimatePdfQuestionRegionBox,
  estimatePdfResourceRegionBox,
  enrichMechanicalExtractionFromInventory,
  extractContextsFromPageInventory,
  extractExplicitContextQuestionNumbers,
  extractionLikelyNeedsSupportContextFallback,
  extractionNeedsAi,
  extractQuestionNumbersFromText,
  findCarryoverTextContextForQuestion,
  formatStructuredSupportHtml,
  getExtractedQuestionNumber,
  ensureExpectedQuestionDrafts,
  inferExpectedOptionsCountFromText,
  inferProbablePagesForMissingQuestion,
  isQuestionReadyForImportPublication,
  mergeExtractionContextList,
  normalizeAiQuestionOptions,
  externalDetailedCommentIsGeneric,
  parseAnswerKeyFromText,
  resolveExamParserProfile,
  textNeedsExternalSupportContext,
} = __examImportParserTestApi;

describe('identidade canonica do JSON externo', () => {
  it('preserva a identidade Gran durante a montagem do card', () => {
    const question = buildQuestionPayloadImportCard({
      tempId: 'gran-question-991',
      source: {
        origin: 'exam',
        provider: 'gran',
        externalId: '991',
        externalExamId: '501',
        sourceExamKey: 'gran:exam:501',
        questionNumber: 12,
        sourcePage: 3,
      },
      questionNumber: 12,
      statement: 'Assinale a opcao correta.',
      introText: '',
      referenceText: '',
      teacherComment: '',
      detailedComment: '',
      contextKey: '',
      bancas: [],
      orgaos: [],
      cargos: [],
      assuntos: [],
      anos: [],
      carreiras: [],
      niveis: [],
      tiposProva: [],
      tipo: 'single_choice',
      dificuldade: 2,
      itens: [
        { id: 1, corpo: 'Alternativa A', rotulo: 'A' },
        { id: 2, corpo: 'Alternativa B', rotulo: 'B' },
      ],
      resposta: 1,
      correctOptionIndex: 0,
      hasFigure: false,
      supportImages: [],
      status: 'ok',
      needsImportReview: false,
      reasons: [],
      quality: {
        origin: 'manual',
        confidence: 1,
        complete: true,
        localized: true,
        needsReview: false,
        reasons: [],
      },
    });

    expect(question.tempId).toBe('gran-question-991');
    expect(question.source).toMatchObject({
      provider: 'gran',
      externalId: '991',
      externalExamId: '501',
      sourceExamKey: 'gran:exam:501',
      questionNumber: 12,
      sourcePage: 3,
    });
    expect(question.questionCreatePayload?.source).toEqual(question.source);
  });
});

describe('normalização do JSON da IA externa', () => {
  it('remove alternativa vazia criada para completar A-E', () => {
    const alternatives = normalizeAiQuestionOptions([
      { label: 'A', text: 'Leitor' },
      { label: 'B', text: 'Alunos' },
      { label: 'C', text: 'Narrador' },
      { label: 'D', text: 'Professora' },
      { label: 'E', text: '', imageData: '' },
    ]);

    expect(alternatives).toHaveLength(4);
    expect(alternatives.map((option: { label: string }) => option.label)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('preserva alternativa visual mesmo sem texto', () => {
    const alternatives = normalizeAiQuestionOptions([
      { label: 'A', text: '', imageData: 'base64-real' },
      { label: 'B', text: 'Alternativa textual' },
    ]);

    expect(alternatives).toHaveLength(2);
    expect(alternatives[0].imageData).toBe('base64-real');
  });

  it('rejeita análise que repete justificativa genérica nas alternativas', () => {
    const detailed = `## Gabarito comentado
Resposta C.
## Análise das alternativas
A) não acompanha o critério decisivo do item.
B) não acompanha o critério decisivo do item.
C) correta.`;

    expect(externalDetailedCommentIsGeneric(detailed)).toBe(true);
    expect(externalDetailedCommentIsGeneric('A alternativa A erra ao confundir narrador com leitor; B atribui a perspectiva aos personagens.')).toBe(false);
  });
});

const buildImportDiagnostics = (expectedQuestionNumbers: number[]) => ({
  expectedQuestionNumbers,
  extractedQuestionNumbers: [],
  localizedQuestionNumbers: [],
  completeQuestionNumbers: [],
  incompleteQuestionNumbers: [],
  missingQuestionNumbers: expectedQuestionNumbers,
  placeholderQuestionNumbers: [],
  visualPendingQuestionNumbers: [],
  duplicateQuestionNumbers: [],
  suspiciousQuestionNumbers: [],
  cardsCreatedCount: 0,
  completeCardsCount: 0,
  incompleteCardsCount: 0,
  placeholderCardsCount: 0,
});

const buildImportedQuestionDraft = (
  number: number,
  {
    statement = `Enunciado suficientemente completo da questao ${number}.`,
    options = ['A', 'B', 'C', 'D'],
    status = 'ok',
    sourcePage = 1,
  }: {
    statement?: string;
    options?: string[];
    status?: 'ok' | 'incompleta' | 'revisar';
    sourcePage?: number;
  } = {},
) => ({
  questionNumber: number,
  number,
  sourcePage,
  enunciado: statement,
  text: statement,
  tipo: 'multipla escolha',
  expectedOptionsCount: 4,
  itens: options.map((option, index) => ({
    id: index + 1,
    ordem: index + 1,
    rotulo: String.fromCharCode(65 + index),
    corpo: option,
  })),
  options,
  resposta: 1,
  correctOptionIndex: 0,
  status,
  extractionStatus: status,
  bancas: [],
  orgaos: [],
  cargos: [],
  assuntos: [],
  anos: [2026],
  dificuldade: 2,
});

const buildPdfLine = (text: string, normalizedX: number, normalizedY: number, index: number, columnIndex = 0) => ({
  text,
  richText: text,
  pageNumber: 1,
  index,
  items: [],
  x: normalizedX,
  y: normalizedY,
  width: 200,
  height: 14,
  normalizedX,
  normalizedY,
  normalizedWidth: 220,
  normalizedHeight: 18,
  columnIndex,
});

const buildPdfBlock = (
  text: string,
  normalizedY: number,
  index: number,
  {
    normalizedX = 80,
    normalizedWidth = 840,
    normalizedHeight = 55,
    columnIndex = 0,
  } = {},
) => ({
  text,
  richText: text,
  pageNumber: 1,
  index,
  lines: [buildPdfLine(text, normalizedX, normalizedY, index, columnIndex)],
  x: normalizedX,
  y: normalizedY,
  width: normalizedWidth,
  height: normalizedHeight,
  normalizedX,
  normalizedY,
  normalizedWidth,
  normalizedHeight,
  columnIndex,
});

const buildQuestion = (number: number, optionsCount = 4) => {
  const labels = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, optionsCount);
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

  it('builds an adaptive profile from the PDF text instead of forcing bank defaults', () => {
    const text = [
      'BANCA DESCONHECIDA',
      '1) Primeira questao com quatro alternativas.',
      'a) Alfa. b) Beta. c) Gama. d) Delta.',
      '2) Segunda questao com quatro alternativas.',
      'a) Alfa. b) Beta. c) Gama. d) Delta.',
      '3) Terceira questao com quatro alternativas.',
      'a) Alfa. b) Beta. c) Gama. d) Delta.',
    ].join(' ');

    const profile = buildAdaptiveExamParserProfile(text, resolveExamParserProfile(text));
    expect(profile.id).toBe('adaptive');
    expect(profile.defaultMultipleChoiceOptions).toBe(4);
    expect(profile.adaptiveEvidence?.observedOptionCounts).toContain(4);

    const result = createMechanicalExtractionFromText(text, 1, 'banca-desconhecida.pdf');
    expect(result.questions).toHaveLength(3);
    expect(result.questions.every((question) => question.options?.length === 4)).toBe(true);
    expect(result.questions.every((question) => Number(question.expectedOptionsCount) === 4)).toBe(true);
  });

  it('infers six-option unknown exams without forcing the generic A-E default', () => {
    const text = [
      'BANCA MUNICIPAL DESCONHECIDA',
      '1) Questao com seis alternativas.',
      'A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon. F) Zeta.',
      '2) Segunda questao com seis alternativas.',
      'A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon. F) Zeta.',
      '3) Terceira questao com seis alternativas.',
      'A) Alfa. B) Beta. C) Gama. D) Delta. E) Epsilon. F) Zeta.',
    ].join(' ');

    const profile = buildAdaptiveExamParserProfile(text, resolveExamParserProfile(text));
    expect(profile.id).toBe('adaptive');
    expect(profile.defaultMultipleChoiceOptions).toBe(6);
    expect(profile.adaptiveEvidence?.observedOptionCounts).toContain(6);
    expect(profile.adaptiveEvidence?.observedOptionMarkers.length).toBeGreaterThan(0);
    expect(profile.adaptiveEvidence?.probableModalities).toContain('multipla escolha');

    const result = createMechanicalExtractionFromText(text, 1, 'banca-desconhecida.pdf');
    expect(result.questions).toHaveLength(3);
    expect(result.questions.every((question) => question.options?.length === 6)).toBe(true);
    expect(result.questions.every((question) => Number(question.expectedOptionsCount) === 6)).toBe(true);
  });

  it('detects common bank profiles but infers option counts from the actual questions', () => {
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

  it('does not force option count or modality from the bank name alone', () => {
    const ibfcText = 'IBFC Caderno de prova sem questoes ou alternativas visiveis nesta pagina.';
    const cebraspeText = 'CEBRASPE Caderno de prova sem comando de julgamento nesta pagina.';

    expect(inferExpectedOptionsCountFromText(ibfcText)).toBe(0);

    const ibfcProfile = buildAdaptiveExamParserProfile(ibfcText, resolveExamParserProfile(ibfcText));
    const cebraspeProfile = buildAdaptiveExamParserProfile(cebraspeText, resolveExamParserProfile(cebraspeText));

    expect(ibfcProfile.defaultMultipleChoiceOptions).toBe(0);
    expect(cebraspeProfile.defaultMultipleChoiceOptions).toBe(0);
    expect(cebraspeProfile.trueFalseMode).toBe(false);
    expect(cebraspeProfile.certoErradoMode).toBe(false);
    expect(cebraspeProfile.adaptiveEvidence?.probableModalities || []).not.toContain('certo ou errado');
  });

  it('separates localized incomplete questions from numbers that were not localized', () => {
    const completeQuestion = {
      questionNumber: 1,
      text: 'Enunciado completo da primeira questao para publicacao.',
      options: ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      expectedOptionsCount: 4,
      extractionStatus: 'ok',
      extractionOrigin: 'mechanical',
    };
    const incompleteQuestion = {
      questionNumber: 2,
      text: 'Enunciado localizado da segunda questao, ainda com alternativas ausentes.',
      options: ['Alternativa A', 'Alternativa B'],
      expectedOptionsCount: 4,
      extractionStatus: 'incompleta',
      statusReasons: ['alternativas_incompletas'],
      extractionOrigin: 'mechanical',
    };

    const coverage = auditQuestionCoverage(
      [completeQuestion, incompleteQuestion] as never[],
      [1, 2, 3],
    );

    expect(coverage.localizedQuestionNumbers).toEqual([1, 2]);
    expect(coverage.completeQuestionNumbers).toEqual([1]);
    expect(coverage.incompleteQuestionNumbers).toEqual([2]);
    expect(coverage.missingQuestionNumbers).toEqual([3]);
    expect(coverage.questions[1].qualityReport).toMatchObject({
      origin: 'mechanical',
      localized: true,
      complete: false,
      needsReview: true,
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

  it('splits two-column FGV numeric headers into independent questions', () => {
    const result = createMechanicalExtractionFromText(
      [
        'CORPO DE BOMBEIROS MILITAR DO ESTADO DO RIO DE JANEIRO - CBMERJ FGV',
        '7 12',
        'Assinale a frase em que ha uma metafora corretamente analisada.',
        '(A) Alternativa A da questao 7.',
        '(B) Alternativa B da questao 7.',
        '(C) Alternativa C da questao 7.',
        '(D) Alternativa D da questao 7.',
        '(E) Alternativa E da questao 7.',
        'Assinale a opcao em que todas as formas estao corretamente grafadas.',
        '(A) Alternativa A da questao 12.',
        '(B) Alternativa B da questao 12.',
        '(C) Alternativa C da questao 12.',
        '(D) Alternativa D da questao 12.',
        '(E) Alternativa E da questao 12.',
      ].join('\n'),
      4,
      'fgv-2022-cbm-rj-cadete-do-corpo-de-bombeiro-prova.pdf',
    );

    expect(result.questions.map((question) => getExtractedQuestionNumber(question, 0))).toEqual([7, 12]);
    expect(result.questions.some((question) => question.extractionStatus !== 'ok')).toBe(true);
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

  it('parses explicit context lists and intervals without expanding the scope', () => {
    expect(extractExplicitContextQuestionNumbers('Leia os textos para as questões 79 e 80.')).toEqual([79, 80]);
    expect(extractExplicitContextQuestionNumbers('Texto para os itens 1/2/3.')).toEqual([1, 2, 3]);
    expect(extractExplicitContextQuestionNumbers('Considere a tabela nas questões 10 até 13.')).toEqual([10, 11, 12, 13]);
  });

  it('creates a shared context inventory for Textos I e II linked only to questions 79 and 80', () => {
    const inventory = buildPageContentInventory({
      pageNumber: 1,
      pageType: 'context_page',
      blocks: [
        buildPdfBlock('Leia os Textos I e II abaixo para, em seguida, responder às questões 79 e 80.', 90, 0),
        buildPdfBlock('Texto I\nPrimeiro texto-base com conteúdo suficiente para interpretação.', 170, 1),
        buildPdfBlock('Texto II\nSegundo texto-base com conteúdo suficiente para comparação.', 280, 2),
        buildPdfBlock('Fonte: Revista Exemplo. Disponível em: https://example.com.', 390, 3),
        buildPdfBlock('79) Com base nos textos, assinale a alternativa correta.', 470, 4),
        buildPdfBlock('80) A relação entre os Textos I e II permite concluir que:', 650, 5),
      ],
    });
    const contexts = extractContextsFromPageInventory(inventory, 1);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].title).toMatch(/Textos I e II/i);
    expect(contexts[0].appliesToQuestionNumbers).toEqual([79, 80]);
    expect(contexts[0].text).toContain('Primeiro texto-base');
    expect(contexts[0].text).toContain('Segundo texto-base');
    expect(contexts[0].referenceText).toContain('Revista Exemplo');
  });

  it('keeps an individual support block in the question instead of creating a shared context', () => {
    const inventory = buildPageContentInventory({
      pageNumber: 1,
      pageType: 'question_page',
      blocks: [
        buildPdfBlock('Considere a seguinte situação hipotética: uma servidora praticou o ato descrito.', 100, 0),
        buildPdfBlock('15) À luz da situação apresentada, assinale a alternativa correta.', 230, 1),
      ],
    });
    const extraction = enrichMechanicalExtractionFromInventory({
      metadata: {},
      pageContexts: [],
      questions: [{
        number: '15',
        questionNumber: 15,
        text: 'À luz da situação apresentada, assinale a alternativa correta.',
        options: ['A', 'B', 'C', 'D'],
      }],
    }, inventory, 1);

    expect(extraction.pageContexts).toEqual([]);
    expect(extraction.questions[0].supportText).toContain('situação hipotética');
    expect(extraction.questions[0].contextKey || '').toBe('');
  });

  it('associates a shared visual region to the explicit context scope', () => {
    const inventory = buildPageContentInventory({
      pageNumber: 1,
      pageType: 'context_page',
      blocks: [
        buildPdfBlock('Observe a figura para responder às questões 20 a 22.', 80, 0, { normalizedHeight: 35 }),
        buildPdfBlock('20) Com base na figura, assinale a alternativa correta.', 430, 1),
        buildPdfBlock('21) O elemento visual indica que:', 610, 2),
        buildPdfBlock('22) A leitura do gráfico permite concluir:', 790, 3),
      ],
    });
    const contexts = extractContextsFromPageInventory(inventory, 1);

    expect(contexts[0].appliesToQuestionNumbers).toEqual([20, 21, 22]);
    expect(contexts[0].hasFigure).toBe(true);
    expect(contexts[0].figureBox).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    }));
  });

  it('preserves a textual table as structured context instead of flattening it into a visual-only figure', () => {
    const inventory = buildPageContentInventory({
      pageNumber: 1,
      pageType: 'context_page',
      blocks: [
        buildPdfBlock('Analise a tabela para responder às questões 1 e 2.', 70, 0),
        buildPdfBlock('Ano | Receita | Despesa\n2024 | 100 | 80\n2025 | 120 | 90', 150, 1),
        buildPdfBlock('1) Conforme a tabela, assinale a alternativa correta.', 350, 2),
        buildPdfBlock('2) A comparação dos dados demonstra que:', 540, 3),
      ],
    });
    const contexts = extractContextsFromPageInventory(inventory, 1);

    expect(contexts[0].text).toContain('Ano | Receita | Despesa');
    expect(contexts[0].hasFigure).toBe(false);
    expect(formatStructuredSupportHtml(contexts[0].text || '')).toContain('<table>');
  });

  it('deduplicates equivalent contexts while preserving the most complete text, references and scope', () => {
    const contexts = mergeExtractionContextList([
      {
        contextKey: 'ctx-a',
        title: 'Texto I',
        text: 'Texto-base compartilhado com conteúdo suficientemente longo para comparação.',
        appliesToQuestionNumbers: [1, 2],
        sourcePage: 1,
      },
      {
        contextKey: 'ctx-b',
        title: 'Texto I',
        text: 'Texto-base compartilhado com conteúdo suficientemente longo para comparação. Parágrafo complementar.',
        referenceText: 'Fonte: Exemplo.',
        appliesToQuestionNumbers: [1, 2],
        sourcePage: 1,
      },
    ]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0].text).toContain('Parágrafo complementar');
    expect(contexts[0].referenceText).toContain('Fonte: Exemplo');
  });

  it('focuses context repair crops on resource blocks rather than the whole page', () => {
    const pageData = {
      plainText: '',
      richText: '',
      highlights: [],
      hasHighlights: false,
      lines: [],
      contentBlocks: [
        {
          id: 'ctx',
          pageNumber: 1,
          type: 'shared_context',
          text: 'Texto para as questões 3 e 4.',
          boundingBox: { x: 80, y: 100, width: 840, height: 250 },
          confidence: 0.9,
          linkedQuestionNumbers: [3, 4],
          reasons: [],
        },
      ],
    };

    const cropBox = estimatePdfResourceRegionBox(pageData, [3, 4]);
    expect(cropBox).toEqual(expect.objectContaining({ x: 62, y: 82 }));
    expect((cropBox?.width || 0)).toBeLessThanOrEqual(1000);
    expect((cropBox?.height || 0)).toBeLessThan(400);
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

  it('does not use AI only because teacher comments or PDF highlights are enabled', () => {
    const pageText = [
      buildQuestion(1, 4),
      buildQuestion(2, 4),
    ].join('\n');
    const result = createMechanicalExtractionFromText(pageText, 1, 'prova-generica.pdf');

    expect(result.questions).toHaveLength(2);
    expect(extractionNeedsAi(pageText, result, true, false)).toBe(false);
    expect(extractionNeedsAi(pageText, result, false, true)).toBe(false);
    expect(extractionNeedsAi(pageText, result, true, true)).toBe(false);
  });

  it('keeps the AI decision disabled when the mechanical extraction is already complete', () => {
    const pageText = [
      buildQuestion(1, 4),
      buildQuestion(2, 4),
    ].join('\n');
    const result = createMechanicalExtractionFromText(pageText, 1, 'prova-generica.pdf');

    const decision = decideAiExtractionForPage(pageText, result, {
      pageNumber: 1,
      includeTeacherComment: true,
      hasPageHighlights: true,
    });

    expect(decision.useAi).toBe(false);
    expect(decision.purpose).toBe('none');
  });

  it('routes scanned pages to visual AI extraction when text extraction is empty', () => {
    const decision = decideAiExtractionForPage('', {
      metadata: {},
      pageContexts: [],
      questions: [],
    }, {
      pageNumber: 3,
    });

    expect(decision.useAi).toBe(true);
    expect(decision.purpose).toBe('scanned_page');
    expect(decision.targetPages).toEqual([3]);
  });

  it('targets only missing mechanical questions when page markers are present', () => {
    const pageText = [
      buildQuestion(1, 4),
      buildQuestion(2, 4),
    ].join('\n');
    const partialExtraction = {
      metadata: {},
      pageContexts: [],
      questions: [
        { number: '1', questionNumber: 1, text: 'Enunciado da questao 1.', options: ['A', 'B', 'C', 'D'] },
      ],
    };

    const decision = decideAiExtractionForPage(pageText, partialExtraction, {
      pageNumber: 1,
      expectedQuestionNumbers: [1, 2],
      alreadyExtractedQuestionNumbers: [1],
    });

    expect(decision.useAi).toBe(true);
    expect(decision.purpose).toBe('missing_question');
    expect(decision.targetQuestionNumbers).toEqual([2]);
  });

  it('estimates a focused crop box from positioned PDF lines for missing questions', () => {
    const pageData = {
      plainText: '',
      richText: '',
      highlights: [],
      hasHighlights: false,
      lines: [
        buildPdfLine('1) Questao um', 80, 120, 0),
        buildPdfLine('a) alternativa A', 100, 150, 1),
        buildPdfLine('2) Questao dois', 80, 240, 2),
        buildPdfLine('a) alternativa A', 100, 270, 3),
        buildPdfLine('b) alternativa B', 100, 300, 4),
        buildPdfLine('3) Questao tres', 80, 410, 5),
      ],
    };

    const cropBox = estimatePdfQuestionRegionBox(pageData, [2]);
    expect(cropBox).toEqual(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    }));
    expect(cropBox?.y).toBeLessThanOrEqual(240);
    expect((cropBox?.y || 0) + (cropBox?.height || 0)).toBeLessThan(410);

    const decision = decideAiExtractionForPage(buildQuestion(1, 4) + '\n' + buildQuestion(2, 4), {
      metadata: {},
      pageContexts: [],
      questions: [
        { number: '1', questionNumber: 1, text: 'Enunciado da questao 1.', options: ['A', 'B', 'C', 'D'] },
      ],
    }, {
      pageNumber: 1,
      expectedQuestionNumbers: [1, 2],
      alreadyExtractedQuestionNumbers: [1],
      pageData,
    });
    expect(decision.cropBox).toEqual(cropBox);
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

  it('creates 17 editable placeholders when 80 questions are expected and 63 were extracted', () => {
    const expected = Array.from({ length: 80 }, (_, index) => index + 1);
    const extracted = expected.slice(0, 63).map((number) => buildImportedQuestionDraft(number));
    const result = ensureExpectedQuestionDrafts({
      questions: extracted as never,
      expectedQuestionNumbers: expected,
      diagnostics: buildImportDiagnostics(expected),
      totalPages: 10,
    });

    expect(result.questions).toHaveLength(80);
    expect(result.createdPlaceholders).toHaveLength(17);
    expect(result.diagnostics.cardsCreatedCount).toBe(80);
    expect(result.diagnostics.completeCardsCount).toBe(63);
    expect(result.diagnostics.placeholderCardsCount).toBe(17);
    expect(result.diagnostics.placeholderQuestionNumbers).toEqual(expected.slice(63));
    expect(result.diagnostics.missingQuestionNumbers).toEqual(expected.slice(63));
  });

  it('keeps a partially localized question as incomplete instead of replacing it with a placeholder', () => {
    const expected = [1, 2];
    const result = ensureExpectedQuestionDrafts({
      questions: [
        buildImportedQuestionDraft(1),
        buildImportedQuestionDraft(2, {
          statement: 'Trecho real localizado para a questao dois.',
          options: [],
          status: 'incompleta',
          sourcePage: 3,
        }),
      ] as never,
      expectedQuestionNumbers: expected,
      diagnostics: buildImportDiagnostics(expected),
      totalPages: 5,
    });

    expect(result.createdPlaceholders).toHaveLength(0);
    expect(result.diagnostics.localizedQuestionNumbers).toContain(2);
    expect(result.diagnostics.incompleteQuestionNumbers).toContain(2);
    expect(result.diagnostics.placeholderQuestionNumbers).not.toContain(2);
  });

  it('preserves the answer key in a placeholder without inventing statement or alternatives', () => {
    const result = ensureExpectedQuestionDrafts({
      questions: [] as never,
      expectedQuestionNumbers: [17],
      diagnostics: buildImportDiagnostics([17]),
      answerKeyMap: { 17: 2 },
      totalPages: 8,
    });
    const placeholder = result.questions[0] as never as {
      enunciado: string;
      itens: unknown[];
      correctOptionIndex: number;
      statusReasons: string[];
    };

    expect(placeholder.enunciado).toBe('');
    expect(placeholder.itens).toEqual([]);
    expect(placeholder.correctOptionIndex).toBe(2);
    expect(placeholder.statusReasons).toContain('gabarito_indica_existencia');
  });

  it('keeps a localized visual question for manual figure review', () => {
    const visualQuestion = {
      ...buildImportedQuestionDraft(9, { options: [], status: 'revisar' }),
      hasFigure: true,
      statusReasons: ['figura_sem_recorte'],
    };
    const result = ensureExpectedQuestionDrafts({
      questions: [visualQuestion] as never,
      expectedQuestionNumbers: [9],
      diagnostics: buildImportDiagnostics([9]),
      totalPages: 3,
    });

    expect(result.createdPlaceholders).toHaveLength(0);
    expect(result.diagnostics.localizedQuestionNumbers).toEqual([9]);
    expect(result.diagnostics.visualPendingQuestionNumbers).toEqual([9]);
  });

  it('keeps placeholders when AI quota is unavailable', () => {
    const expected = [1, 2, 3];
    const result = ensureExpectedQuestionDrafts({
      questions: [buildImportedQuestionDraft(1)] as never,
      expectedQuestionNumbers: expected,
      diagnostics: {
        ...buildImportDiagnostics(expected),
        aiQuotaLimitReached: true,
      },
      totalPages: 3,
    });

    expect(result.questions).toHaveLength(3);
    expect(result.diagnostics.aiQuotaLimitReached).toBe(true);
    expect(result.diagnostics.placeholderQuestionNumbers).toEqual([2, 3]);
  });

  it('deduplicates by keeping the most complete version and does not create a duplicate placeholder', () => {
    const partial = buildImportedQuestionDraft(4, {
      statement: 'Questao quatro parcialmente localizada.',
      options: [],
      status: 'incompleta',
    });
    const complete = buildImportedQuestionDraft(4);
    const result = ensureExpectedQuestionDrafts({
      questions: [partial, complete] as never,
      expectedQuestionNumbers: [4],
      diagnostics: buildImportDiagnostics([4]),
      totalPages: 2,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.createdPlaceholders).toHaveLength(0);
    expect(result.diagnostics.completeQuestionNumbers).toEqual([4]);
    expect(result.diagnostics.duplicateQuestionNumbers).toEqual([4]);
  });

  it('infers at most three probable pages from neighboring localized questions', () => {
    const pages = inferProbablePagesForMissingQuestion({
      questionNumber: 17,
      extractedQuestions: [
        buildImportedQuestionDraft(16, { sourcePage: 4 }),
        buildImportedQuestionDraft(18, { sourcePage: 5 }),
      ] as never,
      pageQuestionRanges: [
        { pageNumber: 4, minQuestion: 14, maxQuestion: 16 },
        { pageNumber: 5, minQuestion: 18, maxQuestion: 21 },
      ],
      totalPages: 10,
      expectedQuestionCount: 80,
    });

    expect(pages).toEqual([4, 5]);
    expect(pages.length).toBeLessThanOrEqual(3);
  });

  it('blocks publication of placeholders and allows a complete manually filled question', () => {
    const placeholderResult = ensureExpectedQuestionDrafts({
      questions: [] as never,
      expectedQuestionNumbers: [1],
      diagnostics: buildImportDiagnostics([1]),
      totalPages: 1,
    });

    expect(isQuestionReadyForImportPublication(placeholderResult.questions[0] as never)).toBe(false);
    expect(isQuestionReadyForImportPublication(buildImportedQuestionDraft(1) as never)).toBe(true);
  });

  it('preserves a shared context restricted to questions 79 and 80', () => {
    const expected = Array.from({ length: 80 }, (_, index) => index + 1);
    const contextKey = 'ctx-textos-i-ii';
    const result = ensureExpectedQuestionDrafts({
      questions: [
        {
          ...buildImportedQuestionDraft(79, { sourcePage: 9 }),
          contextKey,
          contextTitle: 'Textos I e II',
        },
        {
          ...buildImportedQuestionDraft(80, { sourcePage: 9 }),
          contextKey,
          contextTitle: 'Textos I e II',
        },
      ] as never,
      expectedQuestionNumbers: expected,
      diagnostics: buildImportDiagnostics(expected),
      totalPages: 9,
    });

    const byNumber = new Map(result.questions.map((question) => [
      Number((question as never as { questionNumber?: number }).questionNumber),
      question as never as { contextKey?: string; contextTitle?: string },
    ]));

    expect(byNumber.get(79)).toEqual(expect.objectContaining({
      contextKey,
      contextTitle: 'Textos I e II',
    }));
    expect(byNumber.get(80)).toEqual(expect.objectContaining({
      contextKey,
      contextTitle: 'Textos I e II',
    }));
    expect(Array.from(byNumber.entries())
      .filter(([number]) => number !== 79 && number !== 80)
      .every(([, question]) => !question.contextKey)).toBe(true);
  });

  it('creates the declared expected sequence even when there is no answer key', () => {
    const expected = Array.from({ length: 5 }, (_, index) => index + 1);
    const result = ensureExpectedQuestionDrafts({
      questions: [] as never,
      expectedQuestionNumbers: expected,
      diagnostics: buildImportDiagnostics(expected),
      totalPages: 2,
    });

    expect(result.questions.map((question) => (
      question as never as { questionNumber: number }
    ).questionNumber)).toEqual(expected);
    expect(result.diagnostics.cardsCreatedCount).toBe(5);
    expect(result.diagnostics.placeholderQuestionNumbers).toEqual(expected);
  });
});
