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

/**
 * Gateway oficial de IA do admin.
 * Toda chamada ao Gemini passa pelo backend autenticado para evitar
 * exposicao de segredos no navegador.
 * @since 1.0.0
 */

import type { Question } from '@types';
import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';

type GeminiSchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

interface GeminiResponseSchema {
  type: GeminiSchemaType;
  properties?: Record<string, GeminiResponseSchema>;
  items?: GeminiResponseSchema;
  enum?: string[];
  required?: string[];
}

interface GeminiAttachment {
  mimeType: string;
  data: string;
}

interface GeminiGatewayPayload {
  prompt: string;
  attachments?: GeminiAttachment[];
  responseMimeType?: string;
  responseSchema?: GeminiResponseSchema;
  model?: string;
}

interface ExamParserPromptProfile {
  id?: string;
  label?: string;
  defaultMultipleChoiceOptions?: number;
  trueFalseMode?: boolean;
  certoErradoMode?: boolean;
  questionMarkerPatterns?: Array<{ source?: string }>;
  optionMarkerPatterns?: unknown[];
}

type ExtractedQuestionModality =
  | 'multipla escolha'
  | 'certo ou errado'
  | 'verdadeiro/falso'
  | 'multipla assertiva'
  | 'somatorio'
  | 'discursiva'
  | 'redacao'
  | 'estudo de caso'
  | 'desconhecido';

interface GeminiGatewayResponse {
  text?: string;
}

interface FigureBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface PageExtractionResult {
  metadata?: {
    agency?: string;
    source?: string;
    sources?: string[];
    year?: string;
    role?: string;
    roles?: string[];
    cargos?: string[];
    level?: string;
    title?: string;
    examTitle?: string;
    examName?: string;
    contestName?: string;
    examType?: 'Concurso' | 'ENEM';
    caderno?: string;
    tipoCaderno?: string;
    corCaderno?: string;
    bookletType?: string;
    bookletColor?: string;
  };
  pageContexts?: Array<{
    contextKey?: string;
    title?: string;
    text?: string;
    referenceText?: string;
    richText?: string;
    sourcePage?: number;
    appliesToQuestionNumbers?: number[];
    hasFigure?: boolean;
    figureDescription?: string;
    figureBox?: FigureBox;
    figures?: Array<{
      figureKey?: string;
      type?: string;
      description?: string;
      figureBox?: FigureBox;
      page?: number;
      order?: number;
    }>;
  }>;
  questions: Array<Partial<Question> & {
    number?: number | string;
    questionNumber?: number | string;
    isQuestion?: boolean;
    rejectionReason?: string;
    command?: string;
    supportText?: string;
    referenceText?: string;
    contextKey?: string;
    contextTitle?: string;
    contextScope?: string;
    hasFigure?: boolean;
    figureDescription?: string;
    figureBox?: FigureBox;
    supportFigureBox?: FigureBox;
    supportFigureBoxes?: FigureBox[];
    optionFigureBox?: FigureBox;
    optionFigureBoxes?: FigureBox[];
    imageDescriptions?: string[];
    modality?: ExtractedQuestionModality;
    expectedOptionsCount?: number | string;
    expected_options_count?: number | string;
    correctOptionIndex?: number;
    anulada?: boolean;
    isCanceled?: boolean;
    isCancelled?: boolean;
    isAttributedToAll?: boolean;
    attributedToAll?: boolean;
    raw?: string;
    status?: 'ok' | 'incompleta' | 'revisar';
    extractionStatus?: 'ok' | 'incompleta' | 'revisar';
    questionType?: ExtractedQuestionModality;
    statusReasons?: string[];
    validationReasons?: string[];
    subject?: string;
    topic?: string;
    specificSubject?: string;
    options?: string[];
    difficulty?: string;
    page?: number;
  }>;
}

export type OriginalQuestionModality = 'multipla escolha' | 'certo ou errado';

export interface OriginalQuestionGenerationRequest {
  agency: string;
  quantity: number;
  targetSubject?: string;
  targetModality?: OriginalQuestionModality;
  subjects?: string[];
  topics?: string[];
  organizations?: string[];
  roles?: string[];
  careers?: string[];
  roleFocusPairs?: string[];
  areas?: string[];
}

export interface GeneratedOriginalQuestion {
  enunciado: string;
  introText?: string;
  subject: string;
  topic?: string;
  specificSubject?: string;
  organization?: string;
  role?: string;
  career?: string;
  area?: string;
  year?: string | number;
  level?: string;
  difficulty?: string;
  modality?: OriginalQuestionModality;
  options: string[];
  correctOptionIndex: number;
  teacherComment: string;
  detailedComment: string;
}

export interface OriginalQuestionGenerationResult {
  questions: GeneratedOriginalQuestion[];
}

export interface ImportedQuestionTaxonomyClassificationItem {
  localId: string;
  number?: string | number;
  text: string;
  options?: string[];
  currentSubject?: string;
  currentTopic?: string;
  currentSpecificSubject?: string;
}

export interface ImportedQuestionTaxonomyClassificationRequest {
  questions: ImportedQuestionTaxonomyClassificationItem[];
  subjects?: string[];
  topics?: string[];
  specificSubjects?: string[];
}

export interface ImportedQuestionTaxonomyClassificationResult {
  localId: string;
  subject?: string;
  topic?: string;
  specificSubject?: string;
  difficulty?: string;
  confidence?: number;
}

export interface ImportedQuestionPartRepairRequest {
  rawText: string;
  supportText?: string;
  referenceText?: string;
  statement?: string;
  options?: string[];
  modality?: string;
  expectedOptionsCount?: number;
}

export interface ImportedQuestionPartRepairResult {
  supportText?: string;
  referenceText?: string;
  statement?: string;
  options?: string[];
  confidence?: number;
}

export interface DetailedAnalysisBatchItem {
  localId: string;
  question: Question;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

const extractTextFromGatewayResponse = (payload: GeminiGatewayResponse | string): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  return typeof payload?.text === 'string' ? payload.text : '';
};

const normalizeJsonText = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
};

const parseGeminiJson = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(normalizeJsonText(text)) as T;
  } catch {
    return fallback;
  }
};

const requestGeminiText = async (payload: GeminiGatewayPayload): Promise<string> => {
  const response = await apiClient.post<GeminiGatewayResponse | string>(ENDPOINTS.ai.generate, {
    model: DEFAULT_MODEL,
    ...payload,
  }) as unknown;
  const envelope = assertApiSuccess<GeminiGatewayResponse | string>(
    response,
    'Nao foi possivel executar a solicitacao de IA.',
  );
  const data = readApiData<GeminiGatewayResponse | string>(envelope.raw, { text: '' });
  return extractTextFromGatewayResponse(data);
};

const buildQuestionAlternatives = (question: Question): string => {
  const itens = Array.isArray(question.itens) ? question.itens : [];
  return itens
    .map((item, index) => `${String.fromCharCode(65 + index)}) ${item.corpo || ''}`)
    .join('\n');
};

const resolveCorrectLetter = (question: Question): string => {
  const itens = Array.isArray(question.itens) ? question.itens : [];
  const correctItemIndex = itens.findIndex((item) => item.id === question.resposta);
  return correctItemIndex !== -1 ? String.fromCharCode(65 + correctItemIndex) : '?';
};

const normalizeGeneratedCommentText = (value: string) => String(value || '')
  .replace(/^```(?:markdown|md)?\s*/i, '')
  .replace(/```\s*$/i, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<p[^>]*>/gi, '')
  .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
  .replace(/<\/strong>|<\/b>/gi, '**')
  .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
  .replace(/<\/em>|<\/i>/gi, '*')
  .replace(/<mark[^>]*>/gi, '**')
  .replace(/<\/mark>/gi, '**')
  .replace(/<\/?[a-z][^>]*>/gi, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const DETAILED_ANALYSIS_MARKDOWN_RULES = `
FORMATO VISUAL OBRIGATORIO:
- Retorne apenas Markdown. Nao use HTML.
- Use subtitulos curtos com ## e ###.
- Use **negrito** para regras, palavras-chave e conclusoes.
- Use __sublinhado__ apenas para termos decisivos da questao.
- Use *italico* com moderacao para observacoes.
- Use tabelas Markdown com separador correto: | Coluna | Coluna | e | --- | --- |.
- Nao use caixas, callouts, blockquotes ou marcadores do tipo [!GABARITO], [!DICA], [!ATENCAO], [!MACETE], [!PROVA].
- O conteudo deve parecer uma edicao de texto normal: subtitulos, paragrafos, listas, tabelas e destaques em negrito/sublinhado.
- Nao use saudacao, chamada motivacional ou encerramento generico.
- Nao escreva texto robotico, vago ou que serviria para qualquer questao.
- A explicacao deve ser totalmente didatica para leigo, mas precisa manter rigor tecnico.
- Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos.
- Nao deixe comandos como \\sqrt fora dos delimitadores LaTeX.
`.trim();

const normalizeDetailedAnalysisText = (value: string) => normalizeGeneratedCommentText(value)
  .replace(/^>\s*\[!(?:GABARITO|ATENCAO|ATENÇÃO|ERRO|DICA|MACETE|PROVA|CUIDADO)\]\s*/gim, '')
  .replace(/^\[!(?:GABARITO|ATENCAO|ATENÇÃO|ERRO|DICA|MACETE|PROVA|CUIDADO)\]\s*/gim, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const resolveOptionLetter = (index: number): string => {
  if (!Number.isInteger(index) || index < 0 || index > 25) {
    return '';
  }

  return String.fromCharCode(65 + index);
};

const ensureTeacherCommentMentionsAnswer = (comment: string, letter: string): string => {
  const normalized = normalizeGeneratedCommentText(comment);
  if (!normalized || !letter) {
    return normalized;
  }

  const escapedLetter = letter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicateOpeningPattern = new RegExp(
    `^(Gabarito\\s*:?\\s*${escapedLetter}\\s*[.!?]?\\s*)`
    + `(?:A\\s+)?(?:alternativa|resposta|letra)\\s*(?:correta\\s*)?(?:e|\\u00e9|:)?\\s*(?:a\\s+)?${escapedLetter}\\s*[.!?]?\\s*`,
    'i',
  );
  const compacted = normalized
    .replace(duplicateOpeningPattern, `Gabarito: ${letter}. `)
    .replace(/\s{2,}/g, ' ')
    .trim();

  const answerPattern = new RegExp(
    `(?:gabarito|resposta|alternativa|letra)\\s*(?:correta\\s*)?(?:e|\\u00e9|:)?\\s*(?:a\\s+)?${escapedLetter}\\b`,
    'i',
  );

  if (answerPattern.test(compacted)) {
    return compacted;
  }

  return `Gabarito: ${letter}. ${compacted}`;
};

/**
 * Centraliza os fluxos de IA usados pelo frontend administrativo.
 * @since 1.0.0
 */
export const aiService = {
  /**
   * Extrai questoes de uma imagem de pagina via backend.
   * @since 1.0.0
   */
  async extractQuestionsFromPage(
    pageBase64: string,
    includeTeacherComment: boolean = true,
    pageText: string = '',
    targetQuestionNumbers: number[] = [],
    pageRichText: string = '',
    parserProfile?: ExamParserPromptProfile,
  ): Promise<PageExtractionResult> {
    const commentInstruction = includeTeacherComment
      ? '- Comentario do Professor (teacherComment): gere uma mini-resolucao objetiva: cite o gabarito/alternativa correta e mostre o passo essencial que leva a resposta. Em questoes com calculo, inclua a formula com substituicao dos dados; em questoes teoricas, mencione a regra/conceito concreto aplicado. Nao faca comentario generico nem analise todas as alternativas. Escreva em tom humano, sem abertura padronizada; nao comece com frases como "A pegadinha aqui..." ou "O pulo do gato...". Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos.'
      : '';
    const profileLabel = parserProfile?.label || parserProfile?.id || 'Generico';
    const expectedProfileOptions = Number(parserProfile?.defaultMultipleChoiceOptions || 0);
    const profileQuestionPatterns = (parserProfile?.questionMarkerPatterns || [])
      .map((pattern) => pattern.source)
      .filter(Boolean)
      .join(', ');
    const parserProfileInstruction = `
PERFIL DO PARSER DETECTADO:
- Banca/perfil: ${profileLabel}.
- Alternativas esperadas em multipla escolha: ${expectedProfileOptions || 'detectar pela pagina'}.
- Modo CEBRASPE/CESPE certo/errado: ${parserProfile?.certoErradoMode || parserProfile?.trueFalseMode ? 'sim' : 'nao'}.
- Padroes de marcador esperados: ${profileQuestionPatterns || '1), 1., Questao 1, QUESTAO 01, Q1, Q. 1, Item 1, 01 -'}.

REGRAS DO PERFIL:
- Se o perfil for CEBRASPE/CESPE ou a pagina disser "julgue o item", cada item numerado vira uma questao independente do tipo "certo ou errado", com options exatamente ["Certo","Errado"]. Nao force alternativas A-E.
- Se o perfil for FGV, FCC, VUNESP ou ENEM, espere normalmente 5 alternativas A-E quando for multipla escolha.
- Se o perfil for IBFC, espere normalmente 4 alternativas A-D e nao invente alternativa E.
- Se o perfil for AOCP, IDECAN ou Quadrix, detecte pela pagina se ha 4 ou 5 alternativas.
- Use IA apenas para complementar blocos ambiguos do OCR; respeite numeros e estrutura ja detectados no texto da pagina.
`.trim();

    const targetNumbersInstruction = targetQuestionNumbers.length > 0
      ? `
NUMEROS DE QUESTOES DETECTADOS PELO OCR NESTA PAGINA:
${targetQuestionNumbers.join(', ')}

Use essa lista como checklist. Se esses numeros estiverem visiveis na imagem, retorne uma entrada em questions para cada um deles, mesmo que alguma alternativa precise ficar parcial para revisao.
`
      : '';

    const prompt = `
Voce e um especialista em OCR juridico/educacional, provas de concursos e ENEM.
Analise a imagem da pagina da prova fornecida e estruture SOMENTE o que for questao real.

${parserProfileInstruction}

REGRAS CRITICAS:
- Nao transforme instrucoes gerais da prova, capa, dados do candidato, avisos, textos de abertura, comandos de bloco ou instrucoes de cartao-resposta em questao.
- Uma questao real normalmente tem numero proprio, comando avaliativo e alternativas, ou e do tipo certo/errado.
- Extraia TODAS as questoes numeradas visiveis na pagina. Se a pagina tiver 4 ou 5 questoes, retorne todas; nunca pare na primeira questao encontrada.
- Se uma questao numerada estiver visivel, mas as alternativas estiverem parcialmente ilegíveis, mantenha a questao no JSON com options vazias ou parciais para revisao manual. Nao descarte questoes reais por falta de alternativa perfeita.
- Se a pagina contiver um texto que serve SOMENTE para uma questao, coloque esse texto em introText/supportText da propria questao e NAO crie pageContexts/contextKey para ele.
- Separe rigorosamente quatro partes quando existirem: supportText/introText = texto de apoio; referenceText = fonte/referencia bibliografica; text = comando/enunciado da questao; options = alternativas. Nao repita texto de apoio no text.
- Preserve a estrutura original de supportText/introText e pageContexts.text: titulos como "TEXTO I", subtitulos, paragrafos, versos, listas e quebras de linha. Nao achate texto de apoio em uma unica linha.
- Em textos-base, se houver titulo curto antes do texto, mantenha em linha propria; se houver autor abaixo do titulo, mantenha em linha propria. Cada paragrafo deve permanecer separado por "\\n\\n"; versos, listas, incisos, tabelas simples e trechos legais devem preservar quebras de linha relevantes.
- Use quebras "\\n" entre linhas do mesmo bloco e "\\n\\n" entre paragrafos/blocos no JSON. Se houver titulo do texto-base, deixe-o em linha propria antes do corpo.
- Referencias como "BADIO, B. et al. ... (adaptado).", "Disponivel em:" e "Acesso em:" devem ir em referenceText, nao em text nem em options.
- Use pageContexts/contextKey apenas quando o mesmo texto, imagem, grafico, tabela, tirinha, mapa ou figura servir para DUAS OU MAIS questoes.
- Se a pagina contiver um texto/imagem que serve para varias questoes, coloque esse material em pageContexts e vincule cada questao pelo contextKey. Nao repita o texto de apoio inteiro em todas as questoes.
- Quando voce for chamado como fallback, revise tambem se ha texto de apoio/contexto na pagina, mesmo que as questoes parecam completas. Se houver, retorne pageContexts e vincule as questoes corretas por contextKey.
- Se o texto-base disser explicitamente "questoes 3, 4 e 5", "questoes 3 a 5", "itens 10 e 11" ou equivalente, appliesToQuestionNumbers deve conter EXATAMENTE esses numeros. Nao vincule o contexto a outras questoes da pagina.
- Em pageContexts, use referenceText para fonte bibliografica, richText quando houver estrutura/destaques seguros, sourcePage para a pagina de origem e figures para multiplas figuras do mesmo contexto.
- Se houver figura no meio de um texto-base compartilhado, insira no ponto correspondente um marcador como [FIGURA: ctx-001-fig-01] em pageContexts.text e inclua o item correspondente em pageContexts.figures.
- Nao achate tabelas, poemas, versos, artigos de lei, incisos ou alineas. Se a estrutura estiver ilegivel ou truncada, mantenha raw/statusReasons para revisao em vez de inventar.
- Quando houver duvida estrutural, use status/extractionStatus "revisar" e um ou mais statusReasons: contexto_referenciado_nao_encontrado, estrutura_texto_achatada, tabela_corrompida, poema_corrompido, lei_corrompida, contexto_quebrado_entre_paginas, figura_sem_recorte, contexto_compartilhado_nao_vinculado, questao_sem_enunciado.
- Se a MESMA imagem, grafico, tabela, tirinha, mapa ou figura servir para mais de uma questao, crie UM UNICO item em pageContexts com appliesToQuestionNumbers contendo todos os numeros. Em cada questao, use o mesmo contextKey desse contexto. Nunca duplique a mesma imagem como contexto individual de cada questao.
- Se houver figura, grafico, mapa, tabela, tirinha, imagem ou esquema visual, descreva em figureDescription. Se a figura fizer parte do texto de apoio, marque hasFigure no contexto.
- Para cada figura real, retorne figureBox com x, y, width e height em coordenadas normalizadas de 0 a 1000 relativas a pagina inteira. A caixa deve recortar APENAS a figura/tabela/grafico necessario para aquela questao ou contexto; nunca use a pagina inteira.
- A figureBox deve ser justa, mas com margem de seguranca: exclua texto corrido do enunciado, numero da questao, cabecalho/rodape, margens largas e linhas externas que nao pertencam ao grafico/figura. Inclua legendas, eixos, rotulos, textos internos e toda borda util da propria figura para nao cortar conteudo.
- Se a imagem estiver ligada a uma questao especifica, coloque a caixa em supportFigureBox/supportFigureBoxes da propria questao, nao em pageContexts. Se for texto de apoio para varias questoes, coloque a figureBox em pageContexts.
- Detecte modalidades quando houver sinal claro: multipla escolha, certo ou errado, verdadeiro/falso, multipla assertiva, somatorio, discursiva, redacao e estudo de caso.
- Se o gabarito ou a pagina indicar questao anulada/cancelada, use anulada/isCanceled/isCancelled=true. Se indicar "atribuida a todos", "todos" ou "T", use isAttributedToAll/attributedToAll=true.
- Quando uma mesma questao tiver duas ou mais figuras intercaladas com texto (ex.: "Figura 1" + explicacao + "Figura 2"), trate como texto de apoio visual da propria questao: use supportText para o texto, imageDescriptions para descrever a ordem das figuras e supportFigureBoxes com uma caixa por figura/bloco visual. Se so conseguir uma caixa confiavel, use supportFigureBox cobrindo o bloco util das figuras relacionadas. Nao misture esse material com outra questao.
- Em ENEM, extraia as alternativas mesmo quando estiverem em colunas, com letras em circulos, ou com marcadores A/B/C/D/E sem parenteses.
- Em ENEM, quando as alternativas forem curtas e aparecerem compactadas como "A 1 B 2 C 3 D 4 E 5", retorne options exatamente ["1","2","3","4","5"]. Nao deixe isso no enunciado.
- Em ENEM, subject/materia NUNCA deve ser a area de conhecimento ampla. Nao use "Linguagens, Codigos e suas Tecnologias", "Ciencias Humanas e suas Tecnologias", "Ciencias da Natureza e suas Tecnologias" ou "Matematica e suas Tecnologias" como subject. Use a disciplina real do item: Lingua Portuguesa, Literatura, Lingua Estrangeira, Artes, Educacao Fisica, Tecnologias da Informacao e Comunicacao, Historia, Geografia, Filosofia, Sociologia, Quimica, Fisica, Biologia, Ecologia, Impactos Ambientais, Saude, Algebra, Geometria, Estatistica, Matematica Financeira, Raciocinio Logico ou Matematica.
- Em ENEM, a area de conhecimento pode orientar a classificacao, mas deve ficar fora de subject. Exemplo: area "Ciencias da Natureza..." + questao sobre ressonancia => subject "Fisica", topic "Ondulatoria", specificSubject "Ressonancia".
- Em provas IBFC e outros modelos com alternativas somente A-D/a-d, retorne exatamente 4 alternativas, defina expectedOptionsCount=4 e NAO invente alternativa E.
- Quando as alternativas forem graficos, figuras, mapas, imagens ou diagramas sem texto suficiente, retorne options como ["Alternativa visual A","Alternativa visual B","Alternativa visual C","Alternativa visual D","Alternativa visual E"]. Nesse caso, marque hasFigure=true na questao e use optionFigureBox cobrindo somente o bloco das alternativas visuais, com todas as letras/rotulos necessarios. Nao coloque "A B C D E" no campo text.
- Quando a questao ocupar duas colunas e as alternativas visuais estiverem na coluna da direita, o text deve conter apenas o enunciado da coluna da esquerda e o comando; options deve conter as cinco alternativas visuais; optionFigureBox deve cobrir a coluna/bloco das alternativas A, B, C, D e E, incluindo os graficos completos, legendas, eixos e letras das alternativas.
- Se voce identificar optionFigureBox ou optionFigureBoxes para alternativas visuais, options NUNCA pode ficar vazio. Preencha obrigatoriamente as alternativas visuais A-E.
- Quando o enunciado mencionar uma figura de apoio e as alternativas tambem forem figuras, separe: supportFigureBox deve cobrir apenas a figura de apoio/contexto; optionFigureBox deve cobrir apenas as alternativas visuais. Nunca misture figura de apoio com alternativas na mesma caixa.
- Use o TEXTO OCR abaixo como apoio para recuperar alternativas ou trechos que a imagem fique dificil de ler. A imagem continua sendo a fonte principal para figuras, tabelas e diagramas.
- Se as alternativas aparecerem dentro do enunciado OCR, separe-as em options e deixe text apenas com o comando/enunciado.
- Isso inclui sequencias compactas sem pontuacao clara, como "porque A ... B ... C ... D ... E ..." ou "e causada pela A ... B ...". Nesses casos, remova A/B/C/D/E do text e retorne cada trecho em options.
- Preserve destaques visuais relevantes do PDF em text, supportText, referenceText, pageContexts.text e options usando APENAS estas tags HTML seguras: <strong>...</strong> para negrito, <em>...</em> para italico e <u>...</u> para sublinhado.
- Quando uma palavra ou expressao aparecer sublinhada na imagem da pagina, retorne exatamente esse trecho com <u>...</u>. Nao invente sublinhados, negritos ou italicos.
- Quando o destaque aparecer dentro de uma alternativa A/B/C/D/E, preserve a tag no item correspondente de options. Nao mova esse destaque para text/enunciado.
- Se o destaque for apenas decorativo ou de cabecalho/rodape, ignore. Se o destaque altera a leitura da questao, como "incorreta", "exceto", "nao", termos tecnicos ou fragmentos citados, preserve.
- Nao coloque tags em torno de alternativas inteiras ou paragrafos inteiros, exceto quando o original inteiro estiver destacado.
- Preserve o numero original da questao em number.
- Classifique materia (subject), topico (topic) e assunto especifico (specificSubject) quando possivel.

METADADOS DA PROVA:
Identifique banca (agency), orgao/fonte principal (source), todos os orgaos aplicaveis quando houver mais de um (sources), ano (year), cargo/curso/prova principal (role), todos os cargos/versoes aplicaveis (roles), nivel (level), titulo da prova (title/examTitle), nome da prova (examName), concurso (contestName) e categoria (examType).
Se a mesma prova for aplicada para varios orgaos, como "PM-PB" e "CBM-PB", coloque cada orgao em sources e use source como resumo separado por "/": "PM-PB/CBM-PB".
Se a mesma prova for aplicada para varios cargos, como duas linhas de cabecalho "Soldado PM - Combatentes - QPC" e "Soldado BM - Combatentes - QBMP", coloque cada cargo completo em roles/cargos e use role como resumo separado por "/".
Identifique tambem o caderno/versao da prova quando aparecer: caderno, tipoCaderno/bookletType (ex.: Tipo A, Tipo B, Caderno 1) e corCaderno/bookletColor (ex.: Amarelo, Azul, Rosa, Branco, Cinza).
O titulo final deve seguir "Banca - Ano - Orgao - Cargo/Prova", por exemplo "EXATUS - 2014 - PM-RJ - Soldado da Policia Militar". Em ENEM use "INEP" como agency, "ENEM" como role e "INEP" ou o orgao responsavel como source quando aparecer na prova.

${commentInstruction}

TEXTO OCR DA PAGINA:
${pageText ? pageText.slice(0, 12000) : '(sem texto extraido do PDF)'}

TEXTO OCR COM DESTAQUES PRESERVADOS QUANDO DETECTADOS:
${pageRichText && pageRichText !== pageText ? pageRichText.slice(0, 12000) : '(sem destaques textuais detectados pelo PDF; use a imagem para sublinhados visuais)'}

${targetNumbersInstruction}

Retorne APENAS um JSON seguindo o esquema informado.
    `.trim();

    const schemaProperties: Record<string, GeminiResponseSchema> = {
      text: { type: 'STRING' },
      raw: { type: 'STRING' },
      number: { type: 'STRING' },
      isQuestion: { type: 'BOOLEAN' },
      rejectionReason: { type: 'STRING' },
      status: { type: 'STRING', enum: ['ok', 'incompleta', 'revisar'] },
      extractionStatus: { type: 'STRING', enum: ['ok', 'incompleta', 'revisar'] },
      statusReasons: { type: 'ARRAY', items: { type: 'STRING' } },
      validationReasons: { type: 'ARRAY', items: { type: 'STRING' } },
      correctOptionIndex: { type: 'NUMBER' },
      anulada: { type: 'BOOLEAN' },
      isCanceled: { type: 'BOOLEAN' },
      isCancelled: { type: 'BOOLEAN' },
      isAttributedToAll: { type: 'BOOLEAN' },
      attributedToAll: { type: 'BOOLEAN' },
      command: { type: 'STRING' },
      introText: { type: 'STRING' },
      supportText: { type: 'STRING' },
      referenceText: { type: 'STRING' },
      contextKey: { type: 'STRING' },
      contextTitle: { type: 'STRING' },
      contextScope: { type: 'STRING' },
      hasFigure: { type: 'BOOLEAN' },
      figureDescription: { type: 'STRING' },
      figureBox: {
        type: 'OBJECT',
        properties: {
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
          width: { type: 'NUMBER' },
          height: { type: 'NUMBER' },
        },
      },
      supportFigureBox: {
        type: 'OBJECT',
        properties: {
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
          width: { type: 'NUMBER' },
          height: { type: 'NUMBER' },
        },
      },
      supportFigureBoxes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            x: { type: 'NUMBER' },
            y: { type: 'NUMBER' },
            width: { type: 'NUMBER' },
            height: { type: 'NUMBER' },
          },
        },
      },
      optionFigureBox: {
        type: 'OBJECT',
        properties: {
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
          width: { type: 'NUMBER' },
          height: { type: 'NUMBER' },
        },
      },
      optionFigureBoxes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            x: { type: 'NUMBER' },
            y: { type: 'NUMBER' },
            width: { type: 'NUMBER' },
            height: { type: 'NUMBER' },
          },
        },
      },
      imageDescriptions: { type: 'ARRAY', items: { type: 'STRING' } },
      subject: { type: 'STRING' },
      topic: { type: 'STRING' },
      specificSubject: { type: 'STRING' },
      level: { type: 'STRING', enum: ['Fundamental', 'Medio', 'Superior'] },
      difficulty: { type: 'STRING' },
      modality: { type: 'STRING', enum: ['multipla escolha', 'certo ou errado', 'verdadeiro/falso', 'multipla assertiva', 'somatorio', 'discursiva', 'redacao', 'estudo de caso', 'desconhecido'] },
      questionType: { type: 'STRING', enum: ['multipla escolha', 'certo ou errado', 'verdadeiro/falso', 'multipla assertiva', 'somatorio', 'discursiva', 'redacao', 'estudo de caso', 'desconhecido'] },
      expectedOptionsCount: { type: 'NUMBER' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
    };

    const requiredFields = ['text', 'isQuestion', 'subject', 'options', 'topic', 'level'];

    if (includeTeacherComment) {
      schemaProperties.teacherComment = { type: 'STRING' };
      requiredFields.push('teacherComment');
    }

    const text = await requestGeminiText({
      prompt,
      attachments: [{ mimeType: 'image/jpeg', data: pageBase64 }],
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          metadata: {
            type: 'OBJECT',
            properties: {
              agency: { type: 'STRING' },
              source: { type: 'STRING' },
              sources: { type: 'ARRAY', items: { type: 'STRING' } },
              year: { type: 'STRING' },
              role: { type: 'STRING' },
              roles: { type: 'ARRAY', items: { type: 'STRING' } },
              cargos: { type: 'ARRAY', items: { type: 'STRING' } },
              level: { type: 'STRING' },
              title: { type: 'STRING' },
              examTitle: { type: 'STRING' },
              examName: { type: 'STRING' },
              contestName: { type: 'STRING' },
              examType: { type: 'STRING', enum: ['Concurso', 'ENEM'] },
              caderno: { type: 'STRING' },
              tipoCaderno: { type: 'STRING' },
              corCaderno: { type: 'STRING' },
              bookletType: { type: 'STRING' },
              bookletColor: { type: 'STRING' },
            },
          },
          pageContexts: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                contextKey: { type: 'STRING' },
                title: { type: 'STRING' },
                text: { type: 'STRING' },
                referenceText: { type: 'STRING' },
                richText: { type: 'STRING' },
                sourcePage: { type: 'NUMBER' },
                appliesToQuestionNumbers: { type: 'ARRAY', items: { type: 'INTEGER' } },
                hasFigure: { type: 'BOOLEAN' },
                figureDescription: { type: 'STRING' },
                figureBox: {
                  type: 'OBJECT',
                  properties: {
                    x: { type: 'NUMBER' },
                    y: { type: 'NUMBER' },
                    width: { type: 'NUMBER' },
                    height: { type: 'NUMBER' },
                  },
                },
                figures: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      figureKey: { type: 'STRING' },
                      type: { type: 'STRING' },
                      description: { type: 'STRING' },
                      page: { type: 'NUMBER' },
                      order: { type: 'NUMBER' },
                      figureBox: {
                        type: 'OBJECT',
                        properties: {
                          x: { type: 'NUMBER' },
                          y: { type: 'NUMBER' },
                          width: { type: 'NUMBER' },
                          height: { type: 'NUMBER' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: schemaProperties,
              required: requiredFields,
            },
          },
        },
      },
    });

    return parseGeminiJson<PageExtractionResult>(text, { questions: [] });
  },

  /**
   * Extrai o gabarito oficial a partir de uma imagem.
   * @since 1.0.0
   */
  async extractAnswerKeyMapping(keyImageBase64: string): Promise<Record<number, number>> {
    const prompt = `
Analise a imagem do gabarito oficial.
Extraia o mapeamento de numero da questao para a alternativa correta.
O gabarito pode estar em multiplas colunas, tabelas compactas ou blocos separados. Varra a pagina inteira e nao pare no primeiro bloco.
Se houver varios gabaritos por cor/caderno/versao, escolha apenas um conjunto coerente e completo de numeracao. Nao some versoes diferentes da mesma prova.
Ignore cabecalhos, legendas, textos de recurso e instrucoes. Preserve a numeracao original da prova.
Retorne um objeto JSON onde a chave e o numero da questao e o valor e o indice da alternativa (0 para A, 1 para B, 2 para C, 3 para D, 4 para E).
Quando a questao estiver anulada, marcada com *, X, ANULADA ou ANULADO, retorne -1 como valor dessa questao.
Quando a questao estiver marcada como ATRIBUIDA A TODOS, TODOS ou T, retorne -2 como valor dessa questao.
Exemplo: {"1": 2, "2": 0}
    `.trim();

    const text = await requestGeminiText({
      prompt,
      attachments: [{ mimeType: 'image/jpeg', data: keyImageBase64 }],
      responseMimeType: 'application/json',
    });

    return parseGeminiJson<Record<number, number>>(text, {});
  },

  /**
   * Reorganiza uma questao importada somente quando o parser mecanico fica ambiguo.
   * @since 1.0.0
   */
  async repairImportedQuestionParts({
    rawText,
    supportText = '',
    referenceText = '',
    statement = '',
    options = [],
    modality = '',
    expectedOptionsCount,
  }: ImportedQuestionPartRepairRequest): Promise<ImportedQuestionPartRepairResult> {
    const explicitExpectedOptions = Number(expectedOptionsCount || 0);
    const expectedOptions = explicitExpectedOptions >= 2 && explicitExpectedOptions <= 5
      ? explicitExpectedOptions
      : String(modality || '').toLowerCase().includes('certo') ? 2 : 5;
    const optionLabelRange = expectedOptions === 4 ? 'A/B/C/D' : expectedOptions === 2 ? 'Certo/Errado' : 'A/B/C/D/E';
    const prompt = `
Voce e um revisor de OCR de provas. Reorganize uma questao em partes SEM resolver a questao.

Separe exatamente:
- supportText: texto de apoio/base. Nao inclua referencia bibliografica nem comando da pergunta.
- referenceText: fonte/referencia bibliografica, como "BADIO, B. et al. ... (adaptado).", "Disponivel em:" ou "Acesso em:".
- statement: somente o comando/enunciado da pergunta. Nao repita texto de apoio nem referencia.
- options: alternativas, sem marcadores ${optionLabelRange} no inicio. Para multipla escolha, espere ${expectedOptions} alternativas quando existirem.

Regras:
- Nao invente conteudo.
- Preserve o texto original, apenas reposicione.
- Preserve paragrafos, titulos, quebras de linha, versos e listas em supportText usando "\\n" e "\\n\\n"; nao achate o texto de apoio em linha corrida.
- Se uma parte nao existir, retorne string vazia.
- Se as alternativas aparecerem compactadas no texto, separe-as.
- Se supportText e statement repetirem o mesmo paragrafo, mantenha o paragrafo apenas em supportText e deixe em statement somente o comando da pergunta.
- Em questoes do ENEM, textos literarios/cientificos, TEXTOS I/II, figuras descritas e trechos-base ficam em supportText; comandos como "Nesse contexto..." ficam em statement.
- Referencias bibliograficas ficam sempre em referenceText, nunca em supportText nem em statement.
- Se uma questao tiver texto de apoio proprio e nao compartilhado, ainda assim ele deve ficar em supportText.
- Quando o enunciado estiver colado nas alternativas ("... e A reflexao. B refracao..."), remova as alternativas do statement e preencha options.
- Se nao houver seguranca, mantenha o valor atual e reduza confidence.

TEXTO BRUTO:
${rawText.slice(0, 5000)}

ESTADO ATUAL:
supportText: ${supportText}
referenceText: ${referenceText}
statement: ${statement}
options:
${options.map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`).join('\n')}

Retorne apenas JSON com: supportText, referenceText, statement, options, confidence.
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          supportText: { type: 'STRING' },
          referenceText: { type: 'STRING' },
          statement: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          confidence: { type: 'NUMBER' },
        },
      },
    });

    return parseGeminiJson<ImportedQuestionPartRepairResult>(text, {});
  },

  /**
   * Classifica filtros editoriais de questoes importadas em lote.
   * @since 1.0.0
   */
  async classifyImportedQuestionTaxonomies({
    questions,
    subjects = [],
    topics = [],
    specificSubjects = [],
  }: ImportedQuestionTaxonomyClassificationRequest): Promise<ImportedQuestionTaxonomyClassificationResult[]> {
    const safeQuestions = questions
      .filter((question) => String(question.text || '').trim())
      .slice(0, 12);

    if (safeQuestions.length === 0) {
      return [];
    }

    const prompt = `
Voce e um classificador editorial de questoes para uma plataforma de concursos e ENEM.
Sua tarefa e preencher filtros de taxonomia, principalmente o ASSUNTO ESPECIFICO, para questoes ja extraidas de prova.

Regras:
1. Use a materia e o topico atuais quando fizerem sentido.
2. topic deve ser a categoria intermediaria, mais ampla que o ponto cobrado.
3. specificSubject deve ser o ponto especifico cobrado pela questao.
4. specificSubject nao pode ficar vazio.
5. specificSubject nao pode repetir exatamente a materia nem o topic. Se isso acontecer, corrija o topic para um agrupador mais amplo.
6. Exemplo importante: se o ponto cobrado for "Crase", use topic "Regencia" ou "Sintaxe" e specificSubject "Crase". Nunca use topic "Crase" e specificSubject "Crase".
7. Outros exemplos: topic "Ondulatoria" + specificSubject "Ressonancia"; topic "Estequiometria" + specificSubject "Calculo estequiometrico"; topic "Interpretacao de texto" + specificSubject "Inferencia"; topic "Geometria plana" + specificSubject "Area de figuras planas".
8. Para ENEM, subject/materia deve ser a disciplina real, nao a area ampla. Nao use "Linguagens, Codigos e suas Tecnologias", "Ciencias Humanas e suas Tecnologias", "Ciencias da Natureza e suas Tecnologias" ou "Matematica e suas Tecnologias" como subject. Use: Lingua Portuguesa, Literatura, Lingua Estrangeira, Artes, Educacao Fisica, Tecnologias da Informacao e Comunicacao, Historia, Geografia, Filosofia, Sociologia, Quimica, Fisica, Biologia, Ecologia, Impactos Ambientais, Saude, Algebra, Geometria, Estatistica, Matematica Financeira, Raciocinio Logico ou Matematica.
9. Prefira nomes canonicos curtos, em portugues.
10. Se existir um item cadastrado equivalente, use exatamente o nome cadastrado, respeitando a hierarquia topico > assunto especifico.
11. Nao invente metadados da prova; classifique apenas pelo conteudo do enunciado e alternativas.
12. Dificuldade deve ser "Facil", "Media" ou "Dificil".
13. Retorne apenas JSON valido no schema informado.

Materias cadastradas para referencia:
${subjects.slice(0, 80).join(', ') || '(sem lista)'}

Topicos cadastrados para referencia:
${topics.slice(0, 120).join(', ') || '(sem lista)'}

Assuntos especificos cadastrados para referencia:
${specificSubjects.slice(0, 160).join(', ') || '(sem lista)'}

Questoes:
${safeQuestions.map((question) => `
ID: ${question.localId}
Numero: ${question.number || ''}
Materia atual: ${question.currentSubject || ''}
Topico atual: ${question.currentTopic || ''}
Assunto atual: ${question.currentSpecificSubject || ''}
Enunciado: ${String(question.text || '').slice(0, 1800)}
Alternativas:
${(question.options || []).map((option, index) => `${String.fromCharCode(65 + index)}) ${String(option || '').slice(0, 500)}`).join('\n')}
`).join('\n---\n')}
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          classifications: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                localId: { type: 'STRING' },
                subject: { type: 'STRING' },
                topic: { type: 'STRING' },
                specificSubject: { type: 'STRING' },
                difficulty: { type: 'STRING', enum: ['Facil', 'Media', 'Dificil'] },
                confidence: { type: 'NUMBER' },
              },
              required: ['localId', 'subject', 'topic', 'specificSubject'],
            },
          },
        },
        required: ['classifications'],
      },
    });

    const payload = parseGeminiJson<{ classifications?: ImportedQuestionTaxonomyClassificationResult[] }>(
      text,
      { classifications: [] },
    );

    return Array.isArray(payload.classifications) ? payload.classifications : [];
  },

  /**
   * Gera uma analise detalhada em Markdown para uma questao.
   * @since 1.0.0
   */
  async generateDetailedAnalysis(question: Question): Promise<string> {
    const prompt = `
Atue como um professor senior de cursinho preparatorio para concursos.
Analise a seguinte questao:

Enunciado: ${question.enunciado}
Alternativas:
${buildQuestionAlternatives(question)}

A resposta correta e a letra: ${resolveCorrectLetter(question)}

Gere uma ANALISE DETALHADA, didatica e visualmente escaneavel.

REGRAS ESTRITAS DE ESTILO:
1. Nao use saudacoes, introducoes ou conclusoes genericas.
2. Va direto ao ponto.
3. Comece com "## Gabarito comentado" em texto normal, citando a letra correta e o motivo central.
4. Explique o conceito central em linguagem de aluno iniciante, sem resumir genericamente.
5. Mostre o caminho de resolucao, com conta, regra ou criterio aplicado quando houver.
6. Analise a questao completamente, alternativa por alternativa, explicando por que cada uma esta certa ou errada.
7. Inclua uma secao "## Pulo do gato" com a pegadinha, detalhe decisivo ou atalho mental que ajuda a resolver.
8. Se for util, use uma tabela simples para comparar alternativas, conceitos ou etapas.
9. Finalize com "## Resumo de prova" em bullets objetivos.
10. Nao use caixas, callouts, blockquotes nem marcadores do tipo [!GABARITO].
11. Se for questao de Certo/Errado, explique por que a assertiva fica certa ou errada e destaque exatamente o trecho decisivo.

${DETAILED_ANALYSIS_MARKDOWN_RULES}

Nao retorne JSON, retorne apenas o texto em Markdown.
    `.trim();

    const text = await requestGeminiText({ prompt });
    return normalizeDetailedAnalysisText(text) || 'Nao foi possivel gerar a analise detalhada.';
  },

  /**
   * Gera analises detalhadas em lote para reduzir chamadas repetidas de IA.
   * @since 1.0.0
   */
  async generateDetailedAnalysesBatch(items: DetailedAnalysisBatchItem[]): Promise<Record<string, string>> {
    const safeItems = items
      .filter((item) => item.localId && item.question)
      .slice(0, 6);

    if (safeItems.length === 0) {
      return {};
    }

    const prompt = `
Atue como um professor senior de cursinho preparatorio para concursos.
Gere uma analise detalhada para CADA questao abaixo.

REGRAS ESTRITAS:
1. Nao use saudacoes, introducoes ou conclusoes genericas.
2. Va direto ao ponto em cada analise.
3. Comece cada analise com "## Gabarito comentado" em texto normal, citando a letra correta e o motivo central.
4. Explique o conceito central em linguagem de aluno iniciante, sem resumir genericamente.
5. Mostre o caminho de resolucao, com conta, regra ou criterio aplicado quando houver.
6. Analise a questao completamente, alternativa por alternativa, explicando por que cada uma esta certa ou errada.
7. Inclua uma secao "## Pulo do gato" com a pegadinha, detalhe decisivo ou atalho mental que ajuda a resolver.
8. Se for util, use uma tabela simples para comparar alternativas, conceitos ou etapas.
9. Finalize cada item com "## Resumo de prova" em bullets objetivos.
10. Nao use caixas, callouts, blockquotes nem marcadores do tipo [!GABARITO].
11. Se for questao de Certo/Errado, explique por que a assertiva fica certa ou errada e destaque exatamente o trecho decisivo.
12. Cada resposta deve ficar no campo markdown da questao correspondente.
13. Nao misture analises entre questoes.

${DETAILED_ANALYSIS_MARKDOWN_RULES}

Questoes:
${safeItems.map(({ localId, question }) => `
ID: ${localId}
Enunciado: ${question.enunciado}
Alternativas:
${buildQuestionAlternatives(question)}
Resposta correta: ${resolveCorrectLetter(question)}
`).join('\n---\n')}

Retorne APENAS JSON valido no schema informado.
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          analyses: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                localId: { type: 'STRING' },
                markdown: { type: 'STRING' },
              },
              required: ['localId', 'markdown'],
            },
          },
        },
        required: ['analyses'],
      },
    });

    const payload = parseGeminiJson<{ analyses?: Array<{ localId?: string; markdown?: string }> }>(
      text,
      { analyses: [] },
    );
    const result: Record<string, string> = {};

    (payload.analyses || []).forEach((analysis) => {
      const localId = String(analysis.localId || '').trim();
      const markdown = normalizeDetailedAnalysisText(String(analysis.markdown || ''));
      if (localId && markdown) {
        result[localId] = markdown;
      }
    });

    return result;
  },

  /**
   * Gera comentarios do professor em lote para reduzir chamadas repetidas de IA.
   * @since 1.0.0
   */
  async generateTeacherCommentsBatch(items: DetailedAnalysisBatchItem[]): Promise<Record<string, string>> {
    const safeItems = items
      .filter((item) => item.localId && item.question)
      .slice(0, 8);

    if (safeItems.length === 0) {
      return {};
    }

    const prompt = `
Atue como um professor humano de cursinho preparatorio para concursos.
Gere um COMENTARIO DO PROFESSOR curto para CADA questao abaixo.

REGRAS ESTRITAS:
1. Nao use saudacoes.
2. Cada comentario deve ter de 2 a 4 frases.
3. Cite uma unica vez o gabarito, no formato "Gabarito: X.".
4. Explique por que a alternativa correta resolve a questao, de forma resumida e didatica para leigo.
5. Se houver calculo, mostre a formula ou conta essencial com os valores substituidos.
6. Se for teorica, cite a regra, conceito, artigo ou criterio concreto aplicado.
7. Nao analise todas as alternativas; isso pertence a analise detalhada.
8. Nao use frases genericas que poderiam servir para qualquer questao.
9. Varie a primeira frase entre os comentarios. Nao comece todos com "Gabarito:"; a linha do gabarito pode vir depois da frase inicial.
10. Nao force pegadinha. Use "cuidado", "pulo do gato" ou "macete" apenas quando realmente ajudar.
11. Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos.
12. Cada resposta deve ficar no campo comment da questao correspondente.

Questoes:
${safeItems.map(({ localId, question }) => `
ID: ${localId}
Enunciado: ${question.enunciado}
Alternativas:
${buildQuestionAlternatives(question)}
Resposta correta: ${resolveCorrectLetter(question)}
`).join('\n---\n')}

Retorne APENAS JSON valido no schema informado.
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          comments: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                localId: { type: 'STRING' },
                comment: { type: 'STRING' },
              },
              required: ['localId', 'comment'],
            },
          },
        },
        required: ['comments'],
      },
    });

    const payload = parseGeminiJson<{ comments?: Array<{ localId?: string; comment?: string }> }>(
      text,
      { comments: [] },
    );
    const result: Record<string, string> = {};

    (payload.comments || []).forEach((commentResult) => {
      const localId = String(commentResult.localId || '').trim();
      const question = safeItems.find((item) => item.localId === localId)?.question;
      const comment = ensureTeacherCommentMentionsAnswer(
        String(commentResult.comment || ''),
        question ? resolveCorrectLetter(question) : '',
      );
      if (localId && comment) {
        result[localId] = comment;
      }
    });

    return result;
  },

  /**
   * Gera um comentario curto do professor para uma questao.
   * @since 1.0.0
   */
  async generateTeacherComment(question: Question): Promise<string> {
    const itens = Array.isArray(question.itens) ? question.itens : [];
    const prompt = `
Atue como um professor humano de cursinho preparatorio para concursos.
Gere um COMENTARIO DO PROFESSOR curto para a questao abaixo.

REGRAS ESTRITAS:
1. Nao use saudacoes.
2. O comentario deve ter de 2 a 4 frases.
3. Cite uma unica vez o gabarito, no formato "Gabarito: ${resolveCorrectLetter(question)}.".
4. Explique por que a alternativa correta resolve a questao, de forma resumida e didatica para leigo.
5. Se houver calculo, mostre a formula ou conta essencial com os valores substituidos.
6. Se for teorica, cite a regra, conceito, artigo ou criterio concreto aplicado.
7. Nao analise todas as alternativas; isso pertence a analise detalhada.
8. Nao use frases genericas que poderiam servir para qualquer questao.
9. Escreva como um professor humano, com abertura natural e variada.
10. Nao force pegadinha. Use "cuidado", "pulo do gato" ou "macete" apenas quando realmente ajudar.
11. Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos.

Enunciado: ${question.enunciado}
Alternativas:
${itens.map((item, index) => `${String.fromCharCode(65 + index)}) ${item.corpo}`).join('\n')}
Resposta correta: ${resolveCorrectLetter(question)}
    `.trim();

    const text = await requestGeminiText({ prompt });
    return ensureTeacherCommentMentionsAnswer(text, resolveCorrectLetter(question));
  },

  /**
   * Gera questoes ineditas prontas para o fluxo administrativo de criacao.
   * @since 1.0.0
   */
  async generateOriginalQuestions({
    agency,
    quantity,
    targetSubject = '',
    targetModality,
    subjects = [],
    topics = [],
    organizations = [],
    roles = [],
    careers = [],
    roleFocusPairs = [],
    areas = [],
  }: OriginalQuestionGenerationRequest): Promise<GeneratedOriginalQuestion[]> {
    const safeQuantity = Math.max(1, Math.min(20, Math.round(Number(quantity) || 1)));
    const targetSubjectInstruction = targetSubject.trim()
      ? `\nMateria obrigatoria da geracao: ${targetSubject.trim()}. Todas as questoes devem pertencer a essa materia.`
      : '';
    const targetModalityInstruction = targetModality
      ? `\nModalidade obrigatoria da geracao: ${targetModality}. Todas as questoes devem usar exatamente essa modalidade.`
      : '';
    const subjectHint = subjects.length > 0
      ? `\nMaterias ja cadastradas que podem orientar a escolha: ${subjects.slice(0, 40).join(', ')}.`
      : '';
    const topicHint = topics.length > 0
      ? `\nTopicos/assuntos ja cadastrados que podem orientar a escolha: ${topics.slice(0, 60).join(', ')}.`
      : '';
    const organizationHint = organizations.length > 0
      ? `\nOrgaos/fonte cadastrados que podem orientar filtros: ${organizations.slice(0, 35).join(', ')}.`
      : '';
    const roleHint = roles.length > 0
      ? `\nCargos cadastrados que podem orientar filtros: ${roles.slice(0, 45).join(', ')}.`
      : '';
    const careerHint = careers.length > 0
      ? `\nFocos/carreiras cadastrados que podem orientar filtros: ${careers.slice(0, 35).join(', ')}.`
      : '';
    const roleFocusHint = roleFocusPairs.length > 0
      ? `\nHierarquia obrigatoria Foco -> Cargo cadastrada: ${roleFocusPairs.slice(0, 80).join('; ')}.`
      : '';
    const areaHint = areas.length > 0
      ? `\nAreas cadastradas que podem orientar filtros: ${areas.slice(0, 35).join(', ')}.`
      : '';

    const prompt = `
Voce e uma banca examinadora especializada em concursos publicos.
Crie ${safeQuantity} questao(oes) INEDITA(S), gerada(s) pela plataforma, com estilo 100% caracteristico da banca ${agency}.

Regras obrigatorias:
1. As questoes devem parecer questoes reais da banca ${agency}: comando, nivel de abstracao, pegadinhas, distribuicao das alternativas e linguagem devem seguir o padrao da banca.
2. Nao copie questoes existentes e nao mencione prova, ano, cargo, edital ou fonte real.
3. Gere conteudo pronto para publicacao na plataforma.
4. Preencha TODOS os filtros editoriais de acordo com a questao: materia, topico, assunto especifico, dificuldade, banca, orgao/fonte, ano, nivel, foco/carreira, cargo e modalidade. Nenhum desses campos pode vir vazio.
5. Use filtros coerentes com o conteudo; quando possivel, escolha itens das listas cadastradas abaixo. Se precisar criar um filtro novo, use um nome curto, canonico e especifico.
6. Cargo e subordinado a foco/carreira. O campo career deve ser a area/carreira em que o cargo se aplica, nunca um agrupador generico como "Outras" quando houver relacao clara.
7. Exemplos de pares corretos: Policial -> Soldado; Tribunais -> Analista Judiciario; Fiscal -> Auditor Fiscal; Educacao -> Professor.
8. Se escolher um cargo da hierarquia cadastrada, use exatamente o foco pai correspondente.
9. organization, role, career, subject, topic, specificSubject, level, difficulty, modality e year sao obrigatorios no JSON. Nao use "Outras", "Geral" ou "Diversos" se houver opcao mais especifica.
10. topic deve ser o topico intermediario e specificSubject deve ser o assunto mais especifico da questao. Eles nao podem ser iguais. Exemplo: subject "Matematica", topic "Sequencias", specificSubject "Progressao Aritmetica".
11. Inclua obrigatoriamente comentario do professor e analise detalhada.
12. O comentario do professor deve ser uma mini-resolucao objetiva: cite explicitamente a letra do gabarito conforme correctOptionIndex e mostre o passo essencial que leva aquela alternativa.
13. Em questoes com calculo, inclua a formula essencial com os valores substituidos e o resultado. Nao diga apenas que uma formula "permite encontrar"; mostre a conta principal.
14. Em questoes teoricas, mencione a regra, conceito, artigo ou criterio concreto aplicado.
15. Use uma unica abertura de gabarito. Exemplo desejado: "Gabarito: C. Como $S_n = ...$, temos ...". Nao escreva "Gabarito: C. A alternativa correta e a C."; isso e repetitivo.
16. Nao faca comentario generico que poderia servir para qualquer questao; mencione a regra, conceito, calculo ou detalhe concreto que justifica o gabarito.
17. Nao analise todas as alternativas no comentario do professor; isso pertence a analise detalhada.
18. O comentario do professor deve soar humano, leve e util, como uma observacao curta de professor depois da correcao.
19. Varie a primeira frase entre as questoes geradas; nao use a mesma abertura nem os mesmos primeiros 4 termos em mais de uma questao do lote.
20. Nao comece o comentario com frases padronizadas como "A pegadinha aqui esta...", "A pegadinha esta...", "Aqui a pegadinha...", "O pulo do gato e..." ou "Atencao:".
21. Nao force sempre pegadinha. Escolha naturalmente entre explicar o raciocinio, apontar um detalhe de prova, dar um macete, mostrar por que uma alternativa seduz ou lembrar um conceito central.
22. A analise detalhada deve explicar o conceito central e comentar cada alternativa.
23. Use apenas Markdown simples nos comentarios. Nao use tags HTML como <ul>, <li>, <strong>, <em>, <mark> ou tabelas.
24. Na analise, destaque erros das alternativas em Markdown, por exemplo: **Erro da B:** ...
25. A questao deve ter uma unica alternativa correta, sem ambiguidade. Todas as demais alternativas precisam estar claramente erradas ou incompletas.
26. Antes de retornar, confira se correctOptionIndex aponta para a unica alternativa correta e se nenhuma outra alternativa tambem poderia ser aceita como gabarito.
27. Quando houver formulas, use LaTeX entre $...$ para formulas inline e $$...$$ para blocos. Nao deixe comandos como \\sqrt fora desses delimitadores.
28. Para questoes no estilo certo/errado, retorne modality "certo ou errado" e exatamente duas alternativas: "Certo" e "Errado".
29. Para questoes de multipla escolha, retorne modality "multipla escolha" e de 4 a 5 alternativas plausiveis, mas apenas uma pode estar correta.
30. correctOptionIndex deve ser zero-based: 0 para a primeira alternativa, 1 para a segunda, e assim por diante.
${targetSubjectInstruction}${targetModalityInstruction}${subjectHint}${topicHint}${organizationHint}${roleHint}${careerHint}${roleFocusHint}${areaHint}

Retorne APENAS JSON seguindo o schema informado.
    `.trim();

    const text = await requestGeminiText({
      prompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                enunciado: { type: 'STRING' },
                introText: { type: 'STRING' },
                subject: { type: 'STRING' },
                topic: { type: 'STRING' },
                specificSubject: { type: 'STRING' },
                organization: { type: 'STRING' },
                role: { type: 'STRING' },
                career: { type: 'STRING' },
                area: { type: 'STRING' },
                year: { type: 'STRING' },
                level: { type: 'STRING', enum: ['Fundamental', 'Medio', 'Superior'] },
                difficulty: { type: 'STRING', enum: ['Facil', 'Medio', 'Dificil'] },
                modality: { type: 'STRING', enum: ['multipla escolha', 'certo ou errado'] },
                options: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
                correctOptionIndex: { type: 'INTEGER' },
                teacherComment: { type: 'STRING' },
                detailedComment: { type: 'STRING' },
              },
              required: [
                'enunciado',
                'subject',
                'topic',
                'specificSubject',
                'organization',
                'role',
                'career',
                'year',
                'level',
                'difficulty',
                'modality',
                'options',
                'correctOptionIndex',
                'teacherComment',
                'detailedComment',
              ],
            },
          },
        },
        required: ['questions'],
      },
    });

    const payload = parseGeminiJson<OriginalQuestionGenerationResult>(text, { questions: [] });
    return (payload.questions || [])
      .filter((question) => (
        String(question.enunciado || '').trim()
        && Array.isArray(question.options)
        && question.options.length >= 2
      ))
      .slice(0, safeQuantity)
      .map((question) => ({
        ...question,
        teacherComment: ensureTeacherCommentMentionsAnswer(
          question.teacherComment || '',
          resolveOptionLetter(Number(question.correctOptionIndex)),
        ),
        detailedComment: normalizeGeneratedCommentText(question.detailedComment || ''),
      }));
  },

  /**
   * Gera uma explicacao direta da questao em Markdown.
   * @since 1.0.0
   */
  async getQuestionExplanation(question: Question): Promise<string> {
    const prompt = `Explique didaticamente a questao: "${question.enunciado}" com resposta correta sendo a alternativa ${resolveCorrectLetter(question)}. Use Markdown.`;
    const text = await requestGeminiText({ prompt });
    return normalizeGeneratedCommentText(text) || 'Sem explicacao.';
  },

  /**
   * Extrai uma lista de aprovados a partir de um PDF.
   * @since 1.0.0
   */
  async extractApprovedListFromPDF(pdfBase64: string): Promise<string[]> {
    const text = await requestGeminiText({
      prompt: 'Extraia os numeros de inscricao dos aprovados deste PDF. Retorne um JSON { "approvedRegistrationNumbers": ["123", "456"] }.',
      attachments: [{ mimeType: 'application/pdf', data: pdfBase64 }],
      responseMimeType: 'application/json',
    });

    const result = parseGeminiJson<{ approvedRegistrationNumbers?: string[] }>(text, {});
    return Array.isArray(result.approvedRegistrationNumbers) ? result.approvedRegistrationNumbers : [];
  },
};

export default aiService;
