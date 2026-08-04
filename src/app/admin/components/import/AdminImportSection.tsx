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

import React from 'react';
import Image from 'next/image';
import type {
  Prova,
  Question,
  QuestionAsset,
  QuestionTaxonomyLabel,
  SystemSettings,
} from '@types';
import MathRichText from '@/components/shared/math/MathRichText';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Crop,
  Database,
  Edit3,
  FileCheck,
  FileQuestion,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  Zap,
} from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import { EXTERNAL_AI_FULL_BATCH_PROMPT } from './externalAiExamPrompt';
import { partitionQuestionTaxonomies } from './adminImportWorkflowPublicationCore';
import { renderQuestionContentWithAssets } from '@/services/questions/questionAssetRenderer';

type GenerateSpecificType = 'teacher' | 'detailed';
type ExternalEditorialMode = GenerateSpecificType;
type ImportPublishAction = 'exam' | 'questions' | `question:${number}`;
type ImportMetadataField =
  | 'agency'
  | 'source'
  | 'sources'
  | 'organization'
  | 'organizations'
  | 'orgao'
  | 'orgaos'
  | 'year'
  | 'ano'
  | 'role'
  | 'roles'
  | 'cargo'
  | 'cargos'
  | 'level'
  | 'nivel'
  | 'title'
  | 'examTitle'
  | 'examName'
  | 'contestName'
  | 'examType'
  | 'caderno'
  | 'tipoCaderno'
  | 'corCaderno'
  | 'bookletType'
  | 'bookletColor'
  | 'subjects'
  | 'registrationStart'
  | 'registrationEnd'
  | 'examDate'
  | 'registrationFee'
  | 'totalQuestions'
  | 'requirements'
  | 'requirementsDetailed'
  | 'remunerations'
  | 'remunerationsDetailed'
  | 'vacancies'
  | 'vacanciesDetailed'
  | 'programmaticContent'
  | 'programmaticContentDetailed'
  | 'stages'
  | 'platformQuestionIds';
type ExtractedQuestionEditableField =
  | 'subject'
  | 'topic'
  | 'specificSubject'
  | 'agency'
  | 'organization'
  | 'role'
  | 'year'
  | 'level'
  | 'difficulty'
  | 'modality';

type ExtractedQuestionPreview = Question & {
  correctOptionIndex?: number;
  questionNumber?: number | string;
  question_number?: number | string;
  number?: number | string;
  sourcePage?: number | string;
  needsImportReview?: boolean;
  contextKey?: string;
  grupoQuestaoTempId?: string | number;
  hasFigure?: boolean;
  figureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
  supportFigureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
  optionFigureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
  figureDescription?: string;
  referenceText?: string;
  reference_text?: string;
  supportImages?: ExtractedQuestionImagePreview[];
  role?: string;
  year?: string | number;
  status?: 'ok' | 'incompleta' | 'revisar';
  extractionStatus?: 'ok' | 'incompleta' | 'revisar';
  statusReasons?: string[];
  probablePages?: number[];
  qualityReport?: {
    origin?: 'mechanical' | 'ai' | 'hybrid' | 'manual' | 'placeholder';
    confidence?: number;
    localized?: boolean;
    complete?: boolean;
    needsReview?: boolean;
    reasons?: string[];
    probablePages?: number[];
  };
  extractionQuality?: {
    origin?: 'mechanical' | 'ai' | 'hybrid' | 'manual' | 'placeholder';
    confidence?: number;
    localized?: boolean;
    complete?: boolean;
    needsReview?: boolean;
    reasons?: string[];
    probablePages?: number[];
  };
};

type ExtractedQuestionImagePreview = {
  tempId: string;
  title: string;
  description?: string;
  imageData?: string;
  pageImageData?: string;
  figureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
  page?: number;
  manualCropApplied?: boolean;
};

type ExtractedOptionPreview = NonNullable<Question['itens']>[number] & {
  imageData?: string;
  pageImageData?: string;
  figureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
};

type ExtractedContextPreview = {
  tempId: string;
  title: string;
  text: string;
  referenceText?: string;
  richText?: string;
  questionNumbers: number[];
  hasFigure: boolean;
  figureDescription: string;
  page: number;
  imageData?: string;
  pageImageData?: string;
  figureBox?: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };
  figures?: Array<{
    figureKey?: string;
    type?: string;
    description?: string;
    imageData?: string;
    pageImageData?: string;
    figureBox?: {
      x?: number | string;
      y?: number | string;
      width?: number | string;
      height?: number | string;
    };
    page?: number;
    order?: number;
  }>;
  manualCropApplied?: boolean;
};

type ImportDiagnosticsPreview = {
  expectedQuestionNumbers: number[];
  extractedQuestionNumbers: number[];
  localizedQuestionNumbers?: number[];
  completeQuestionNumbers?: number[];
  incompleteQuestionNumbers?: number[];
  missingQuestionNumbers: number[];
  placeholderQuestionNumbers?: number[];
  visualPendingQuestionNumbers?: number[];
  duplicateQuestionNumbers?: number[];
  suspiciousQuestionNumbers?: number[];
  cardsCreatedCount?: number;
  completeCardsCount?: number;
  incompleteCardsCount?: number;
  placeholderCardsCount?: number;
  aiLimitReached?: boolean;
  aiTokenLimitReached?: boolean;
  aiQuotaLimitReached?: boolean;
  aiCallCount?: number;
  aiCallLimit?: number;
  aiCallsSkipped?: number;
  aiCallsSavedEstimate?: number;
  aiLimitedPages?: number[];
  aiTokenLimitPages?: number[];
  aiQuotaLimitPages?: number[];
  pagesWithoutNativeText?: number[];
  orphanContentBlocks?: Array<{
    id: string;
    pageNumber: number;
    text: string;
    type: string;
  }>;
  aiLimitMessage?: string;
  aiTokenLimitMessage?: string;
  aiQuotaLimitMessage?: string;
};

type CropDraft = { x: string; y: string; width: string; height: string };
type CropBox = { x: number; y: number; width: number; height: number };
type CropDragState = {
  mode: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  startX: number;
  startY: number;
  startBox: CropBox;
};

type ImportReviewTab = 'proof' | 'contexts' | 'questions' | 'pending';

const asText = (value: unknown) => String(value ?? '').trim();

const getExplicitContextQuestionNumbers = (...values: unknown[]) => {
  const text = values
    .map((value) => asText(value))
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  const scope = text.match(/\b(?:quest(?:ao|oes)|itens?)\b.{0,180}/i)?.[0] || '';
  const range = scope.match(/(\d{1,3})\s*(?:a|ate|-)\s*(\d{1,3})/i);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start > 0 && end >= start && end - start <= 120) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }
  return Array.from(scope.matchAll(/\d{1,3}/g))
    .map((match) => Number(match[0]))
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index);
};

const asTextList = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => asText(item)).filter(Boolean)
    : asText(value).split(/\s*\/\s*|[,;\n]/).map((item) => item.trim()).filter(Boolean)
);

const stringifyMetadataField = (value: unknown) => {
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.map((item) => asText(item)).filter(Boolean).join('\n');
    }
    return JSON.stringify(value, null, 2);
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return asText(value);
};

const dedupeTextList = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const cleanExamTitlePart = (value: unknown) => asText(value)
  .replace(/\s+/g, ' ')
  .replace(/\s*\(\d{4}\)\s*$/, '')
  .trim();

const cleanExplicitExamTitle = (value: unknown) => asText(value)
  .replace(/\s+/g, ' ')
  .trim();

const readExamYear = (...values: unknown[]) => (
  values.map((value) => asText(value).match(/\b(19\d{2}|20\d{2})\b/)?.[0]).find(Boolean) || ''
);

const joinExamTitleParts = (...parts: unknown[]) => parts.map(cleanExamTitlePart).filter(Boolean).join(' - ');
const joinExamTitleList = (items: string[], fallback: unknown = '') => (
  items.length > 0 ? items.join('/') : cleanExamTitlePart(fallback)
);

const buildStandardExamTitlePreview = (metadata: Record<string, unknown>) => {
  const roleList = dedupeTextList([...asTextList(metadata.roles), ...asTextList(metadata.cargos)]);
  const sourceList = dedupeTextList([
    ...asTextList(metadata.sources),
    ...asTextList(metadata.organizations),
    ...asTextList(metadata.orgaos),
    ...asTextList(metadata.source),
    ...asTextList(metadata.organization),
    ...asTextList(metadata.orgao),
  ]);
  const role = joinExamTitleList(roleList, metadata.role || metadata.cargo || metadata.examName || metadata.contestName);
  const agency = cleanExamTitlePart(metadata.agency);
  const year = readExamYear(metadata.year, metadata.ano);
  const source = joinExamTitleList(sourceList, metadata.source);
  return joinExamTitleParts(agency, year, source, role);
};

const buildExamTitlePreview = (metadata: Record<string, unknown>) => {
  const standardTitle = buildStandardExamTitlePreview(metadata);
  const explicitTitle = cleanExplicitExamTitle(metadata.title || metadata.examTitle || metadata.name || metadata.nome);
  return explicitTitle || standardTitle;
};

const getTaxonomyLabel = (item: unknown) => {
  if (!item || typeof item !== 'object') return asText(item);
  const record = item as Record<string, unknown>;
  return asText(record.name || record.nome || record.descricao || record.sigla || record.slug);
};

const getQuestionNumber = (question: ExtractedQuestionPreview, fallback: number) => {
  const match = asText(question.questionNumber ?? question.question_number ?? question.number ?? question.id ?? fallback).match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

const getQuestionTaxonomyGroups = (question: Question) => partitionQuestionTaxonomies(
  (question.assuntos || []) as unknown as QuestionTaxonomyLabel[],
);

const getQuestionTaxonomyItemName = (item: Record<string, unknown> | undefined) => (
  asText(item?.name || item?.nome || item?.label || item?.descricao || item?.slug)
);

const getQuestionSubject = (question: Question) => (
  getQuestionTaxonomyItemName(getQuestionTaxonomyGroups(question).subjects[0])
);

const getQuestionTopic = (question: Question) => (
  getQuestionTaxonomyItemName(getQuestionTaxonomyGroups(question).topics[0])
);

const getQuestionSpecificSubject = (question: Question) => (
  getQuestionTaxonomyItemName(getQuestionTaxonomyGroups(question).subtopics[0])
);

const getQuestionIntroText = (question: Question) => {
  const record = question as unknown as { introText?: unknown; intro_text?: unknown };
  return asText(question.content?.supportText || record.introText || record.intro_text);
};

const getQuestionReferenceText = (question: Question) => {
  const record = question as unknown as { referenceText?: unknown; reference_text?: unknown };
  return asText(question.content?.reference || record.referenceText || record.reference_text);
};

const getQuestionSupportImages = (question: Question) => {
  const record = question as unknown as { supportImages?: unknown };
  if (Array.isArray(question.assets)) {
    return question.assets
      .filter((asset) => asset.type === 'image' && asset.usage === 'support')
      .map((asset) => ({
        imageData: asset.base64 || asset.url || '',
        description: asset.alt || asset.caption || '',
        page: asset.sourcePage,
      })) as ExtractedQuestionImagePreview[];
  }
  return Array.isArray(record.supportImages) ? record.supportImages as ExtractedQuestionImagePreview[] : [];
};

const getQuestionStatementAssets = (question: Question): QuestionAsset[] => (
  (Array.isArray(question.assets) ? question.assets : [])
    .filter((asset) => asset.type === 'image' && asset.usage === 'statement')
);

const getQuestionStatementSummary = (question: Question) => {
  const summary = stripPreviewText(getQuestionStatementPreview(question))
    .replace(/\[image:[^\]]+\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (summary) return summary;
  return getQuestionStatementAssets(question).length > 0
    ? 'Enunciado visual. Abra o conteúdo para conferir a imagem.'
    : 'Enunciado ainda não preenchido.';
};

const getQuestionSubjects = (questions: Question[]) => questions
  .flatMap((question) => (question.assuntos || [])
    .filter((subject) => Boolean(subject.materia))
    .map((subject) => {
      const record = subject as unknown as Record<string, unknown>;
      return asText(record.name || record.nome || record.descricao);
    }))
  .filter((subject, index, list) => subject.length > 0 && list.indexOf(subject) === index);

const getQuestionOptions = (question: Question) => (
  Array.isArray(question.alternatives) && question.alternatives.length
    ? question.alternatives.map((alternative, index) => ({
      id: index + 1,
      ordem: alternative.order || index + 1,
      rotulo: alternative.label || String.fromCharCode(65 + index),
      corpo: alternative.text || '',
      corpo_clean: stripPreviewText(alternative.text || ''),
    }))
    : Array.isArray(question.itens) ? question.itens : []
);

const stripPreviewText = (value: unknown) => asText(value)
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getOptionPreviewText = (option: unknown) => {
  const record = option && typeof option === 'object' ? option as Record<string, unknown> : {};
  return stripPreviewText(record.corpo || record.texto || record.text || record.value || option);
};

const buildExternalEditorialPrompt = (mode: ExternalEditorialMode, questions: Question[]) => {
  const isTeacher = mode === 'teacher';
  const targetField = isTeacher ? 'teacherComment' : 'detailedComment';
  const fieldLabel = isTeacher ? 'comentario do professor' : 'analise detalhada';
  const payload = {
    task: isTeacher ? 'generate_teacher_comments' : 'generate_detailed_analyses',
    output_format: {
      questions: [
        {
          number: 1,
          [targetField]: isTeacher
            ? 'Texto direto, didatico e especifico da questao. Explique o caminho ate o gabarito e finalize com "Gabarito: X."'
            : 'Markdown completo com Gabarito comentado, conceito central, caminho de resolucao, analise de cada alternativa, pulo do gato e resumo de prova.',
        },
      ],
    },
    questions: questions.map((question, index) => {
      const questionRecord = question as unknown as Record<string, unknown>;
      const options = getQuestionOptions(question).map((option, optionIndex) => {
        const record = option as unknown as Record<string, unknown>;
        const label = asText(record.letra || record.rotulo || record.label || String.fromCharCode(65 + optionIndex));
        return {
          label,
          text: getOptionPreviewText(option),
          correct: Boolean(record.correta) || optionIndex === getCorrectOptionIndex(question as ExtractedQuestionPreview),
        };
      });
      const answerIndex = getCorrectOptionIndex(question as ExtractedQuestionPreview);
      return {
        number: getQuestionNumber(question as ExtractedQuestionPreview, index + 1),
        statement: stripPreviewText(question.content?.statement || question.enunciado || questionRecord.text || questionRecord.raw),
        supportText: stripPreviewText(getQuestionIntroText(question)),
        referenceText: stripPreviewText(getQuestionReferenceText(question)),
        contextKey: asText(questionRecord.contextKey || questionRecord.contextTempId),
        options,
        answer: options[answerIndex]?.label || '',
        subject: getQuestionSubject(question),
        topic: getQuestionTopic(question),
        specificSubject: getQuestionSpecificSubject(question),
      };
    }),
  };

  return [
    'Voce e o editor pedagogico senior do ConcursoMestre, especialista em concursos publicos.',
    `Gere somente o campo "${targetField}" (${fieldLabel}) para cada questao enviada.`,
    'Voce deve gerar um JSON valido como resposta final. Nao responda com explicacoes, plano, markdown fora do JSON, pedido para dividir em partes ou orientacao para outra ferramenta.',
    'Se a interface permitir arquivo/anexo, gere um arquivo JSON com o conteudo completo; se responder no chat, retorne somente o objeto JSON parseavel.',
    '',
    'REGRAS DE QUALIDADE',
    '- O texto deve parecer escrito por um professor experiente de curso preparatorio, nao por resumo automatico.',
    '- Use todas as informacoes disponiveis: enunciado, texto de apoio, referencia, contexto, figura/tabela quando descrita, alternativas e gabarito.',
    '- Explique como chegar ao gabarito; nao apenas diga qual e a resposta.',
    '- Nao invente leis, artigos, jurisprudencia, dados de imagem, doutrina, formulas ou fatos ausentes.',
    '- Adapte a explicacao ao tipo da questao: Portugues, Matematica, Fisica, Quimica, Direito, Historia, Geografia, Atualidades ou outra disciplina.',
    '- Varie a escrita entre as questoes. Evite aparencia de texto serializado.',
    '- Retorne JSON valido, sem markdown fora do JSON, sem comentarios extras.',
    '- Preserve exatamente os numeros das questoes.',
    '- Nao altere enunciado, alternativas, filtros, gabarito ou metadados.',
    '',
    isTeacher
      ? [
        'PADRAO DO COMENTARIO DO PROFESSOR',
        '- Comentario rapido, mas realmente didatico; nao vire mini aula.',
        '- Idealmente entre 1 e 4 paragrafos curtos, podendo chegar a 6 quando a questao exigir calculo ou raciocinio mais elaborado.',
        '- Tamanho sugerido: entre 500 e 1.200 caracteres, salvo questoes mais complexas.',
        '- Mostre o passo mental essencial que leva ao gabarito.',
        '- Use elementos concretos do enunciado, texto, figura, tabela ou alternativas.',
        '- Em calculo, mostre a formula/conta essencial; em questao teorica, cite a regra/conceito/criterio com base segura.',
        '- Em interpretacao textual, indique a ideia, termo, relacao textual, voz narrativa, genero ou inferencia que sustenta a resposta.',
        '- Aponte a pegadinha somente quando ela existir.',
        '- Nao analise todas as alternativas; isso pertence a analise detalhada.',
        '- So mencione alternativa incorreta quando ela for a principal pegadinha da questao.',
        '- Se o gabarito parecer incompatível com o enunciado ou alternativas, ainda gere o comentario com base no gabarito informado, mas evite afirmar algo contraditorio ou inventar justificativa.',
        '- Finalize com "Gabarito: X." quando houver gabarito.',
        '- Nao use frases genericas como "basta interpretar", "conforme o enunciado", "atende ao comando" ou "corresponde ao gabarito oficial".',
      ].join('\n')
      : [
        'PADRAO DA ANALISE DETALHADA',
        '- Use Markdown dentro da string do campo "detailedComment".',
        '- Preserve os titulos obrigatorios em Markdown, mas varie naturalmente a redacao interna de cada secao.',
        '- A analise deve ter profundidade de aula, mas sem enrolacao.',
        '- Tamanho sugerido: entre 2.000 e 4.500 caracteres por questao; ultrapasse apenas quando houver calculo longo, tabela, grafico ou analise juridica mais complexa.',
        '- Em questoes simples, seja completo sem alongar artificialmente.',
        '- Comece com "## Gabarito comentado", citando a letra correta e o motivo central especifico.',
        '- Inclua "## Conceito central" ensinando o conteudo em linguagem acessivel para aluno iniciante, mas com rigor tecnico.',
        '- Inclua "## Caminho de resolucao": se houver calculo, desenvolva formula, substituicao e conclusao; se nao houver, mostre o processo mental usado para chegar ao gabarito.',
        '- Inclua "## Analise das alternativas" e justifique CADA alternativa.',
        '- Em cada alternativa errada, explique o erro real: extrapolacao, inversao, generalizacao, conceito trocado, dado inexistente, excecao ignorada, calculo incorreto, leitura errada de tabela, interpretacao incompatível ou alternativa incompleta.',
        '- Em Portugues, diferencie claramente regra gramatical, semantica, interpretacao, literatura, tipologia textual, ortografia ou figura de linguagem.',
        '- Em Direito, cite dispositivo legal somente se ele estiver presente ou puder ser identificado com seguranca. Nunca invente artigo.',
        '- Em questoes com imagem, grafico ou tabela nao disponivel de forma legivel, nao invente dados visuais; trabalhe apenas com os elementos textuais fornecidos.',
        '- Se o gabarito parecer incompatível com o enunciado ou alternativas, gere uma analise cautelosa, sem fabricar justificativa falsa.',
        '- Inclua "## Pulo do gato" com macete, palavra-chave, diferenca recorrente, erro classico ou detalhe decisivo para futuras provas.',
        '- Inclua "## Resumo de prova" em bullets curtos, objetivos e revisaveis.',
        '- Nao repita a mesma justificativa trocando apenas a letra.',
        '- Nao use frases genericas como "nao atende ao comando", "nao corresponde ao gabarito oficial" ou "esta incorreta porque nao e a correta".',
      ].join('\n'),
    '',
    'FORMATO OBRIGATORIO DE SAIDA',
    JSON.stringify({ questions: [{ number: 1, [targetField]: '...' }] }, null, 2),
    '',
    'QUESTOES PARA GERAR',
    JSON.stringify(payload, null, 2),
  ].join('\n');
};

const getFilledQuestionOptionsCount = (question: Question) => (
  getQuestionOptions(question).filter((item) => asText(item.corpo)).length
);

const getQuestionExpectedOptionsCount = (question: Question) => {
  const record = question as unknown as {
    tipo?: unknown;
    modality?: unknown;
    expectedOptionsCount?: unknown;
    expected_options_count?: unknown;
    bancas?: unknown[];
    banca?: unknown;
  };
  const explicitCount = Number(asText(record.expectedOptionsCount ?? record.expected_options_count).match(/[2-5]/)?.[0] || 0);
  if (Number.isFinite(explicitCount) && explicitCount >= 2 && explicitCount <= 5) {
    return explicitCount;
  }
  const modalityText = asText(record.tipo || record.modality).toLowerCase();
  if (modalityText.includes('certo')) {
    return 2;
  }
  return Number(modalityText.match(/[2-5]/)?.[0] || 0) || getQuestionOptions(question).length;
};

const getCorrectOptionIndex = (question: ExtractedQuestionPreview) => {
  if (Number.isInteger(question.correctOptionIndex)) {
    return Number(question.correctOptionIndex);
  }
  const options = getQuestionOptions(question);
  const canonicalAnswerId = question.answer?.alternativeId;
  if (canonicalAnswerId) {
    const canonicalIndex = options.findIndex((item) => {
      const record = item as unknown as Record<string, unknown>;
      return asText(record.id) === asText(canonicalAnswerId)
        || asText(record.rotulo) === asText(question.answer?.value);
    });
    if (canonicalIndex >= 0) {
      return canonicalIndex;
    }
  }
  const answerIndex = options.findIndex((item) => Number(item.id) === Number(question.resposta));
  return answerIndex >= 0 ? answerIndex : Math.max(0, Number(question.resposta || 1) - 1);
};

const getQuestionStatementPreview = (question: Question) => (
  asText(question.content?.statement || question.enunciado || (question as unknown as Record<string, unknown>).text)
);

const getTeacherCommentPreview = (question: Question) => {
  return asText(question.editorialComments?.teacherComment || question.teacherComment);
};

const getDetailedCommentPreview = (question: Question) => {
  return asText(question.editorialComments?.detailedComment || question.detailedComment);
};

const getQuestionQuality = (question: ExtractedQuestionPreview) => (
  question.qualityReport || question.extractionQuality
);

const isPlaceholderQuestionPreview = (question: ExtractedQuestionPreview) => (
  getQuestionQuality(question)?.origin === 'placeholder'
  || (question.statusReasons || []).includes('questao_placeholder_criada')
);

const getQuestionProbablePages = (question: ExtractedQuestionPreview) => (
  Array.from(new Set([
    ...(question.probablePages || []),
    ...(getQuestionQuality(question)?.probablePages || []),
    Number(question.sourcePage || 0),
  ].filter((page) => Number.isFinite(page) && Number(page) > 0).map(Number)))
    .sort((left, right) => left - right)
);

const isQuestionReadyForPublicationPreview = (question: ExtractedQuestionPreview) => {
  const statement = getQuestionStatementPreview(question).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const optionsCount = getFilledQuestionOptionsCount(question);
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const type = asText(question.tipo).toLowerCase();
  const answer = Number(question.resposta);
  const correctOptionIndex = Number(question.correctOptionIndex);
  const discursive = ['discursiva', 'redacao', 'estudo de caso'].includes(type);
  const hasAnswer = discursive
    || (Number.isInteger(correctOptionIndex) && correctOptionIndex >= 0 && correctOptionIndex < optionsCount)
    || (Number.isInteger(answer) && answer > 0 && answer <= optionsCount)
    || Boolean(question.anulada || question.isCanceled);

  return statement.length >= 12
    && Boolean(type && type !== 'desconhecido')
    && (discursive || (
      optionsCount >= 2
      && (expectedOptionsCount <= 0 || optionsCount >= expectedOptionsCount)
      && hasAnswer
    ));
};

const getImageDataUri = (imageData?: string) => {
  const value = asText(imageData);
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
};

const escapeHtmlAttribute = (value: unknown) => asText(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const figureMarkerPattern = /\[FIGURA:\s*([-\w]+)\]/gi;

const createContextInlineFigureHtml = (
  context: ExtractedContextPreview,
  figureKey: string,
  imageData?: string,
  description?: string,
) => {
  const imageUri = getImageDataUri(imageData);
  const caption = asText(description || context.figureDescription);
  if (!imageUri) {
    return [
      '<figure class="question-support-figure cm-import-context-figure cm-import-context-figure--missing">',
      `<figcaption>Figura ${escapeHtmlAttribute(figureKey)} ainda sem recorte. Use "Ajustar recorte da figura" antes de publicar.</figcaption>`,
      '</figure>',
    ].join('');
  }

  return [
    '<figure class="question-support-figure cm-import-context-figure">',
    `<img src="${escapeHtmlAttribute(imageUri)}" alt="${escapeHtmlAttribute(caption || context.title || 'Figura do contexto')}" loading="lazy" />`,
    caption ? `<figcaption>${escapeHtmlAttribute(caption)}</figcaption>` : '',
    '</figure>',
  ].filter(Boolean).join('');
};

const getContextFigureImageData = (
  context: ExtractedContextPreview,
  figure?: NonNullable<ExtractedContextPreview['figures']>[number],
) => (figure
  ? (figure.imageData || figure.pageImageData || '')
  : (context.imageData || context.pageImageData || '')
);

const getContextPrimaryFigureImageData = (context: ExtractedContextPreview) => (
  context.imageData || context.pageImageData || ''
);

const renderContextTextWithInlineFigures = (context: ExtractedContextPreview) => {
  const rawText = asText(context.text);
  if (!rawText) {
    const imageData = getContextFigureImageData(context);
    return imageData
      ? createContextInlineFigureHtml(context, `${context.tempId}-fig-01`, imageData)
      : '';
  }

  if (/<img\b/i.test(rawText)) {
    return rawText;
  }

  const figures = Array.isArray(context.figures) ? context.figures : [];
  const figureByKey = new Map(figures.map((figure, index) => [
    asText(figure.figureKey || `${context.tempId}-fig-${String(index + 1).padStart(2, '0')}`),
    figure,
  ]));
  let consumedPrimaryImage = false;
  const replaced = rawText.replace(figureMarkerPattern, (_marker, rawFigureKey) => {
    const figureKey = asText(rawFigureKey);
    const figure = figureByKey.get(figureKey);
    const figureImageData = (figure ? getContextFigureImageData(context, figure) : '')
      || (!consumedPrimaryImage ? getContextPrimaryFigureImageData(context) : '');
    consumedPrimaryImage = consumedPrimaryImage || Boolean(figureImageData);
    return createContextInlineFigureHtml(
      context,
      figureKey,
      figureImageData,
      figure?.description || context.figureDescription,
    );
  });

  if (replaced !== rawText) {
    return replaced;
  }

  const imageData = getContextFigureImageData(context);
  return imageData
    ? [rawText, createContextInlineFigureHtml(context, `${context.tempId}-fig-01`, imageData)].join('\n\n')
    : rawText;
};

const contextHasInlineFigureHtml = (context: ExtractedContextPreview) => /<img\b|cm-import-context-figure/i.test(renderContextTextWithInlineFigures(context));

const getFirstEmbeddedImageData = (html?: string) => {
  const match = asText(html).match(/<img\b[^>]*\bsrc\s*=\s*["'](data:image\/[^"']+)["'][^>]*>/i);
  return match?.[1] || '';
};

const getOptionCropSourceImage = (option: ExtractedOptionPreview) => (
  option.pageImageData
  || option.imageData
  || getFirstEmbeddedImageData(option.corpo)
);

const readLocalImageFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
  reader.readAsDataURL(file);
});

const hasRichAlternativeContent = (value?: string) => /<img\b|<figure\b|<picture\b|<\/?[a-z][\s\S]*>/i.test(asText(value));

const normalizeCropBox = (box: CropDraft | CropBox): CropBox => {
  const x = Math.max(0, Math.min(1000, Number(box.x) || 0));
  const y = Math.max(0, Math.min(1000, Number(box.y) || 0));
  const width = Math.max(10, Math.min(1000 - x, Number(box.width) || 10));
  const height = Math.max(10, Math.min(1000 - y, Number(box.height) || 10));
  return { x, y, width, height };
};

const cropBoxToDraft = (box: CropBox): CropDraft => ({
  x: String(Math.round(box.x)),
  y: String(Math.round(box.y)),
  width: String(Math.round(box.width)),
  height: String(Math.round(box.height)),
});

const findQuestionContexts = (question: ExtractedQuestionPreview, fallbackIndex: number, contexts: ExtractedContextPreview[]) => {
  const questionNumber = getQuestionNumber(question, fallbackIndex + 1);
  const contextKey = asText(question.grupoQuestaoTempId || question.contextKey);
  return contexts.filter((context) => (
    context.questionNumbers.includes(questionNumber)
    || (contextKey && context.tempId === contextKey)
  ));
};

const getQuestionLevelText = (level: Question['nivel'] | Question['level']) => {
  if (level === null || level === undefined || level === '') return 'Superior';
  if (typeof level === 'string' || typeof level === 'number') return String(level);
  return String(level.nome || level.name || level.descricao || 'Superior');
};

const getFocusLabel = (focus: NonNullable<SystemSettings['taxonomies']>['careers'][number]) => (
  String(focus.name || focus.description || focus.slug || focus.id || '').trim()
);

const getRootFocusLabel = (value: string) => (
  String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0]
  || String(value || '').trim()
);

const slugifyFocusValue = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'foco';

const getFocusSelectValue = (focus: NonNullable<SystemSettings['taxonomies']>['careers'][number]) => {
  const id = String(focus.id ?? '').trim();
  if (id) return `id:${id}`;
  const slug = String(focus.slug ?? '').trim();
  if (slug) return `slug:${slug}`;
  return `name:${slugifyFocusValue(getRootFocusLabel(getFocusLabel(focus)))}`;
};

const getExamTaxonomyLabel = (value: unknown) => {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return asText(record.sigla ?? record.nome ?? record.name ?? record.descricao ?? record.description);
  }

  return asText(value);
};

const getExamBankSearchText = (exam: Prova) => [
  exam.nome,
  exam.slug,
  exam.ano,
  exam.nivel,
  getExamTaxonomyLabel(exam.banca),
  ...(exam.orgaos?.length ? exam.orgaos : [exam.orgao]).map(getExamTaxonomyLabel),
  ...(exam.cargos?.length ? exam.cargos : [exam.cargo]).map(getExamTaxonomyLabel),
  ...(exam.focos?.length ? exam.focos : exam.carreiras?.length ? exam.carreiras : [exam.foco, exam.carreira]).map(getExamTaxonomyLabel),
].filter(Boolean).join(' ');

const normalizeExamBankSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

interface SearchableExamBankSelectProps {
  exams: Prova[];
  selectedExamId: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const getExamOptionLabel = (exam: Prova) => (
  `${exam.nome}${exam.ano ? ` (${exam.ano})` : ''}`
);

const getExamOptionMeta = (exam: Prova) => {
  const agency = getExamTaxonomyLabel(exam.banca);
  const organizations = (exam.orgaos?.length ? exam.orgaos : [exam.orgao])
    .map(getExamTaxonomyLabel)
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
  const roles = (exam.cargos?.length ? exam.cargos : [exam.cargo])
    .map(getExamTaxonomyLabel)
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');

  return [agency, organizations, roles].filter(Boolean).join(' · ');
};

const SearchableExamBankSelect = ({
  exams,
  selectedExamId,
  onChange,
  disabled = false,
  isLoading = false,
}: SearchableExamBankSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const selectedExam = React.useMemo(
    () => exams.find((exam) => String(exam.id) === selectedExamId) || null,
    [exams, selectedExamId],
  );
  const visibleExams = React.useMemo(() => {
    const query = normalizeExamBankSearch(searchTerm);
    const list = query
      ? exams.filter((exam) => normalizeExamBankSearch(getExamBankSearchText(exam)).includes(query))
      : exams;

    if (selectedExam && !list.some((exam) => exam.id === selectedExam.id)) {
      return [selectedExam, ...list];
    }

    return list;
  }, [exams, searchTerm, selectedExam]);

  const handleChange = (value: string) => {
    onChange(value);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-xs font-bold text-slate-800 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isOpen ? 'ring-2 ring-violet-100 dark:ring-violet-950' : ''}`}
      >
        <span className="min-w-0 truncate">
          {isLoading
            ? 'Carregando provas cadastradas...'
            : selectedExam
              ? getExamOptionLabel(selectedExam)
              : 'Criar uma nova prova após a extração'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              autoFocus
              placeholder="Busca rápida"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
            />
          </div>

          <div className="max-h-72 overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => handleChange('')}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${!selectedExamId ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-transparent dark:border-slate-700'}`}>
                <Check size={13} />
              </span>
              Criar uma nova prova após a extração
            </button>

            <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Provas
            </p>

            {visibleExams.length > 0 ? visibleExams.map((exam) => {
              const value = String(exam.id);
              const isSelected = value === selectedExamId;
              const meta = getExamOptionMeta(exam);
              return (
                <button
                  type="button"
                  key={exam.id}
                  onClick={() => handleChange(value)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-transparent dark:border-slate-700'}`}>
                    <Check size={13} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      {getExamOptionLabel(exam)}
                    </span>
                    {meta && (
                      <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
                        {meta}
                      </span>
                    )}
                  </span>
                </button>
              );
            }) : (
              <div className="px-4 py-5 text-sm font-semibold text-slate-500">
                Nenhuma prova encontrada para a busca.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SearchableFocusSelectProps {
  focusOptions: NonNullable<SystemSettings['taxonomies']>['careers'];
  selectedFocusId: string;
  inheritedFocusLabel?: string;
  manualFocusName: string;
  onSelectedFocusIdChange: (value: string) => void;
  onManualFocusNameChange: (value: string) => void;
  disabled?: boolean;
}

const SearchableFocusSelect = ({
  focusOptions,
  selectedFocusId,
  inheritedFocusLabel = '',
  manualFocusName,
  onSelectedFocusIdChange,
  onManualFocusNameChange,
  disabled = false,
}: SearchableFocusSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const selectedFocus = React.useMemo(
    () => focusOptions.find((focus) => getFocusSelectValue(focus) === selectedFocusId) || null,
    [focusOptions, selectedFocusId],
  );
  const selectedLabel = inheritedFocusLabel
    || (selectedFocus ? getRootFocusLabel(getFocusLabel(selectedFocus)) : '')
    || manualFocusName.trim();
  const visibleFocusOptions = React.useMemo(() => {
    const query = normalizeExamBankSearch(searchTerm);
    const list = query
      ? focusOptions.filter((focus) => normalizeExamBankSearch([
        getFocusLabel(focus),
        focus.slug,
        focus.description,
      ].filter(Boolean).join(' ')).includes(query))
      : focusOptions;

    if (selectedFocus && !list.some((focus) => getFocusSelectValue(focus) === getFocusSelectValue(selectedFocus))) {
      return [selectedFocus, ...list];
    }

    return list;
  }, [focusOptions, searchTerm, selectedFocus]);

  const handleSelect = (value: string) => {
    onSelectedFocusIdChange(value);
    if (value) onManualFocusNameChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleManualChange = (value: string) => {
    onManualFocusNameChange(value);
    if (value.trim()) onSelectedFocusIdChange('');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={`flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-xs font-bold text-slate-800 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${isOpen ? 'ring-2 ring-violet-100 dark:ring-violet-950' : ''}`}
        >
          <span className="min-w-0 truncate">
            {selectedLabel || 'Selecionar foco existente'}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                autoFocus
                placeholder="Busca rápida"
                className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
              />
            </div>

            <div className="max-h-72 overflow-y-auto py-2">
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${!selectedFocusId ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-transparent dark:border-slate-700'}`}>
                  <Check size={13} />
                </span>
                Selecionar manualmente abaixo
              </button>

              <p className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Focos
              </p>

              {visibleFocusOptions.length > 0 ? visibleFocusOptions.map((focus) => {
                const value = getFocusSelectValue(focus);
                const label = getRootFocusLabel(getFocusLabel(focus)) || 'Foco sem nome';
                const isSelected = value === selectedFocusId;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => handleSelect(value)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-transparent dark:border-slate-700'}`}>
                      <Check size={13} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {label}
                      </span>
                      {focus.description && focus.description !== label && (
                        <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-snug text-slate-500 dark:text-slate-400">
                          {focus.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              }) : (
                <div className="px-4 py-5 text-sm font-semibold text-slate-500">
                  Nenhum foco encontrado para a busca.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <input
        type="text"
        value={manualFocusName}
        onChange={(event) => handleManualChange(event.target.value)}
        disabled={disabled}
        placeholder={inheritedFocusLabel || 'Ou adicionar novo foco. Ex.: ENEM, Policial, Tribunais'}
        className={`h-10 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-70 ${ADMIN_FIELD_CLASS}`}
      />
    </div>
  );
};

interface FigureCropSelectorProps {
  imageData: string;
  cropDraft: CropDraft;
  onChange: (box: CropBox) => void;
  onApply: (box: CropBox) => void | Promise<void>;
}

const FigureCropSelector = ({
  imageData,
  cropDraft,
  onChange,
  onApply,
}: FigureCropSelectorProps) => {
  const imageFrameRef = React.useRef<HTMLDivElement | null>(null);
  const imageElementRef = React.useRef<HTMLImageElement | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const localCropBoxRef = React.useRef<CropBox>(normalizeCropBox(cropDraft));
  const [dragState, setDragState] = React.useState<CropDragState | null>(null);
  const [localCropBox, setLocalCropBox] = React.useState<CropBox>(() => normalizeCropBox(cropDraft));
  const [isApplyingCrop, setIsApplyingCrop] = React.useState(false);
  const dataUri = getImageDataUri(imageData);

  React.useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const scheduleLocalCropBoxUpdate = React.useCallback((box: CropBox) => {
    const next = normalizeCropBox(box);
    localCropBoxRef.current = next;

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setLocalCropBox(localCropBoxRef.current);
    });
  }, []);

  React.useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const imageElement = imageElementRef.current;
      if (!imageElement) {
        return;
      }

      const rect = imageElement.getBoundingClientRect();
      const deltaX = ((event.clientX - dragState.startX) / Math.max(1, rect.width)) * 1000;
      const deltaY = ((event.clientY - dragState.startY) / Math.max(1, rect.height)) * 1000;
      const start = dragState.startBox;
      let next: CropBox = { ...start };

      if (dragState.mode === 'move') {
        next = {
          ...start,
          x: start.x + deltaX,
          y: start.y + deltaY,
        };
      } else {
        const movesWest = dragState.mode.includes('w');
        const movesEast = dragState.mode.includes('e');
        const movesNorth = dragState.mode.includes('n');
        const movesSouth = dragState.mode.includes('s');
        const left = movesWest ? start.x + deltaX : start.x;
        const top = movesNorth ? start.y + deltaY : start.y;
        const right = movesEast ? start.x + start.width + deltaX : start.x + start.width;
        const bottom = movesSouth ? start.y + start.height + deltaY : start.y + start.height;

        next = {
          x: Math.min(left, right - 10),
          y: Math.min(top, bottom - 10),
          width: Math.max(10, right - Math.min(left, right - 10)),
          height: Math.max(10, bottom - Math.min(top, bottom - 10)),
        };
      }

      scheduleLocalCropBoxUpdate(next);
    };

    const handlePointerUp = () => {
      const finalBox = normalizeCropBox(localCropBoxRef.current);
      setDragState(null);
      setLocalCropBox(finalBox);
      onChange(finalBox);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, onChange, scheduleLocalCropBoxUpdate]);

  const startDrag = (
    event: React.PointerEvent<HTMLButtonElement | HTMLDivElement>,
    mode: CropDragState['mode'],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBox: localCropBoxRef.current,
    });
  };

  const handleStyles: Array<{ mode: CropDragState['mode']; className: string; cursor: string }> = [
    { mode: 'nw', className: '-left-1.5 -top-1.5', cursor: 'cursor-nwse-resize' },
    { mode: 'ne', className: '-right-1.5 -top-1.5', cursor: 'cursor-nesw-resize' },
    { mode: 'sw', className: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
    { mode: 'se', className: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
    { mode: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'cursor-ns-resize' },
    { mode: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
    { mode: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
    { mode: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-sm border border-slate-300 bg-slate-950 p-2 dark:border-slate-700">
        <div ref={imageFrameRef} className="flex max-h-[520px] w-full items-center justify-center overflow-auto rounded-sm bg-slate-950">
          <div className="relative inline-block max-h-[520px] max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageElementRef}
              src={dataUri}
              alt="Pagina original para ajuste do recorte"
              className="block max-h-[520px] max-w-full select-none object-contain"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 bg-slate-950/35" />
            <div
              role="presentation"
              onPointerDown={(event) => startDrag(event, 'move')}
              className="absolute touch-none rounded-sm border-2 border-sky-400 bg-sky-400/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.36)]"
              style={{
                left: `${localCropBox.x / 10}%`,
                top: `${localCropBox.y / 10}%`,
                width: `${localCropBox.width / 10}%`,
                height: `${localCropBox.height / 10}%`,
              }}
            >
              <div className="absolute left-2 top-2 rounded-sm bg-sky-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-sm">
                Arraste para mover
              </div>
              {handleStyles.map((handle) => (
                <button
                  key={handle.mode}
                  type="button"
                  aria-label={`Redimensionar recorte ${handle.mode}`}
                  onPointerDown={(event) => startDrag(event, handle.mode)}
                  className={`absolute h-3 w-3 rounded-full border border-white bg-sky-500 shadow ${handle.className} ${handle.cursor}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          Arraste a caixa azul e use os pontos nas bordas para ajustar a figura.
        </p>
        <button
          type="button"
          disabled={isApplyingCrop}
          onClick={async () => {
            const finalBox = normalizeCropBox(localCropBoxRef.current);
            onChange(finalBox);
            setIsApplyingCrop(true);
            try {
              await onApply(finalBox);
            } finally {
              setIsApplyingCrop(false);
            }
          }}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          {isApplyingCrop ? 'Aplicando...' : 'Aplicar recorte'}
        </button>
      </div>
    </div>
  );
};

interface AdminImportSectionProps {
  reviewOnly?: boolean;
  reviewDisplayMode?: 'full' | 'cards';
  reviewSourceLabel?: string;
  reviewSelectedQuestionIndexes?: ReadonlySet<number>;
  reviewAllowIncompleteSelection?: boolean;
  reviewQueueIndexOffset?: number;
  reviewQuestionQueueStatuses?: Record<number, 'queued' | 'processing' | 'published' | 'failed'>;
  onReviewQuestionSelectionChange?: (index: number, selected: boolean) => void;
  onReviewQuestionPublishRequest?: (index: number) => void;
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => void;
  isSavingSettings?: boolean;
  qFile: File | null;
  onQFileChange: (file: File | null) => void;
  kFile: File | null;
  onKFileChange: (file: File | null) => void;
  examBank: Prova[];
  isLoadingExamBank: boolean;
  selectedExamId: string;
  onSelectedExamIdChange: (value: string) => void;
  selectedExamFocusLabel: string;
  inheritedProofFileName: string;
  inheritedAnswerKeyFileName: string;
  selectedFocusId: string;
  onSelectedFocusIdChange: (value: string) => void;
  manualFocusName: string;
  onManualFocusNameChange: (value: string) => void;
  importMetadata: Record<string, unknown> | null;
  importDiagnostics: ImportDiagnosticsPreview;
  onImportMetadataChange: (field: ImportMetadataField, value: string) => void;
  extractedContexts: ExtractedContextPreview[];
  extractWithComment: boolean;
  onExtractWithCommentChange: (value: boolean) => void;
  extractWithDetailedAnalysis: boolean;
  onExtractWithDetailedAnalysisChange: (value: boolean) => void;
  isProcessing: boolean;
  examProgress: number;
  keyProgress: number;
  onStartImport: () => void;
  logs: string[];
  extractedQuestions: Question[];
  isBulkGenerating: boolean;
  bulkGenerationType: GenerateSpecificType | null;
  isRetryingMissingQuestions: boolean;
  bulkProgress: number;
  publishedExam: Record<string, unknown> | null;
  publishedQuestionNumbers: number[];
  publishingAction: ImportPublishAction | null;
  onGenerateTeacherAll: () => void;
  onGenerateDetailedAll: () => void;
  onRetryMissingQuestions: () => void | Promise<void>;
  onParseQuestionsFromText: (text: string) => void | Promise<void>;
  onImportFromAiJson: (
    json: string,
    options?: { silentSuccess?: boolean },
  ) => void | Promise<void>;
  onImportExternalEditorialJson: (json: string) => void | Promise<void>;
  onPublishExam: () => void | Promise<void>;
  onPublishAllQuestions: () => void | Promise<void>;
  onPublishSelectedQuestions: (indexes: number[]) => void | Promise<void>;
  onPublishQuestion: (index: number) => void | Promise<void>;
  onEditExtractedQuestion: (question: Question, index: number) => void;
  onMarkExtractedQuestionReviewed: (index: number) => void;
  onDeleteExtractedQuestion: (index: number) => void;
  onContextFigureCropChange: (tempId: string, figureBox: NonNullable<ExtractedContextPreview['figureBox']>) => void | Promise<void>;
  onExtractedQuestionFieldChange: (index: number, field: ExtractedQuestionEditableField, value: string) => void;
  onExtractedQuestionStatementChange: (index: number, value: string) => void;
  onExtractedQuestionIntroTextChange: (index: number, value: string) => void;
  onExtractedQuestionReferenceTextChange: (index: number, value: string) => void;
  onExtractedQuestionOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  onExtractedQuestionCorrectOptionChange: (questionIndex: number, optionIndex: number) => void;
  onExtractedQuestionOptionAdd: (questionIndex: number) => void;
  onExtractedQuestionOptionRemove: (questionIndex: number, optionIndex: number) => void;
  onExtractedQuestionSupportImageAdd: (questionIndex: number, imageData: string, fileName?: string) => void;
  onExtractedQuestionOptionImageChange: (questionIndex: number, optionIndex: number, imageData: string) => void;
  onExtractedQuestionContextAdd: (questionIndex: number) => void;
  onExtractedContextAdd: () => void;
  onExtractedContextRemove: (tempId: string) => void;
  onExtractedContextContentChange: (tempId: string, value: string) => void;
  onExtractedContextFieldChange: (
    tempId: string,
    field: 'title' | 'text' | 'referenceText' | 'figureDescription',
    value: string,
  ) => void;
  onExtractedContextQuestionNumbersChange: (tempId: string, questionNumbers: number[]) => void;
  onExtractedContextImageChange: (tempId: string, imageData: string, fileName?: string) => void;
  onExtractedQuestionSupportImageCropChange: (
    questionIndex: number,
    imageTempId: string,
    figureBox: NonNullable<ExtractedQuestionImagePreview['figureBox']>,
  ) => void | Promise<void>;
  onExtractedQuestionSupportImageRemove: (questionIndex: number, imageTempId: string) => void;
  onExtractedQuestionOptionImageCropChange: (
    questionIndex: number,
    optionIndex: number,
    figureBox: NonNullable<ExtractedOptionPreview['figureBox']>,
  ) => void | Promise<void>;
  generatingSpecific: { index: number; type: GenerateSpecificType } | null;
  onGenerateSpecific: (index: number, type: GenerateSpecificType) => void;
}

const AdminImportSection = ({
  reviewOnly = false,
  reviewDisplayMode = 'full',
  reviewSourceLabel = '',
  reviewSelectedQuestionIndexes,
  reviewAllowIncompleteSelection = false,
  reviewQueueIndexOffset = 0,
  reviewQuestionQueueStatuses,
  onReviewQuestionSelectionChange,
  onReviewQuestionPublishRequest,
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings = false,
  qFile,
  onQFileChange,
  kFile,
  onKFileChange,
  examBank,
  isLoadingExamBank,
  selectedExamId,
  onSelectedExamIdChange,
  selectedExamFocusLabel,
  inheritedProofFileName,
  inheritedAnswerKeyFileName,
  selectedFocusId,
  onSelectedFocusIdChange,
  manualFocusName,
  onManualFocusNameChange,
  importMetadata,
  importDiagnostics,
  onImportMetadataChange,
  extractedContexts,
  extractWithComment,
  onExtractWithCommentChange,
  extractWithDetailedAnalysis,
  onExtractWithDetailedAnalysisChange,
  isProcessing,
  examProgress,
  keyProgress,
  onStartImport,
  logs,
  extractedQuestions,
  isBulkGenerating,
  bulkGenerationType,
  isRetryingMissingQuestions,
  bulkProgress,
  publishedExam,
  publishedQuestionNumbers,
  publishingAction,
  onGenerateTeacherAll,
  onGenerateDetailedAll,
  onRetryMissingQuestions,
  onParseQuestionsFromText,
  onImportFromAiJson,
  onImportExternalEditorialJson,
  onPublishExam,
  onPublishAllQuestions,
  onPublishQuestion,
  onEditExtractedQuestion,
  onMarkExtractedQuestionReviewed,
  onDeleteExtractedQuestion,
  onContextFigureCropChange,
  onExtractedQuestionFieldChange,
  onExtractedQuestionStatementChange,
  onExtractedQuestionIntroTextChange,
  onExtractedQuestionReferenceTextChange,
  onExtractedQuestionOptionChange,
  onExtractedQuestionCorrectOptionChange,
  onExtractedQuestionOptionAdd,
  onExtractedQuestionOptionRemove,
  onExtractedQuestionSupportImageAdd,
  onExtractedQuestionOptionImageChange,
  onExtractedQuestionContextAdd,
  onExtractedContextAdd,
  onExtractedContextRemove,
  onExtractedContextContentChange,
  onExtractedContextFieldChange,
  onExtractedContextQuestionNumbersChange,
  onExtractedContextImageChange,
  onExtractedQuestionSupportImageCropChange,
  onExtractedQuestionSupportImageRemove,
  onExtractedQuestionOptionImageCropChange,
  generatingSpecific,
  onGenerateSpecific,
}: AdminImportSectionProps) => {
  const configuredAiProvider = String(systemSettings.aiProvider || 'auto').toLowerCase();
  const configuredAiLabel = configuredAiProvider === 'gemini'
    ? `Gemini / ${systemSettings.geminiModel || 'gemini-3.5-flash'}`
    : configuredAiProvider === 'openai'
      ? `OpenAI / ${systemSettings.openAiModel || 'gpt-4o-mini'}`
      : `Automático: OpenAI ${systemSettings.openAiModel || 'gpt-4o-mini'} → Gemini ${systemSettings.geminiModel || 'gemini-3.5-flash'}`;
  const [activeReviewTab, setActiveReviewTab] = React.useState<ImportReviewTab>('questions');
  const [contextCropDrafts, setContextCropDrafts] = React.useState<Record<string, CropDraft>>({});
  const [supportImageCropDrafts, setSupportImageCropDrafts] = React.useState<Record<string, CropDraft>>({});
  const [optionImageCropDrafts, setOptionImageCropDrafts] = React.useState<Record<string, CropDraft>>({});
  const [editingContextId, setEditingContextId] = React.useState<string | null>(null);
  const [editingIntroTextIndex, setEditingIntroTextIndex] = React.useState<number | null>(null);
  const [editingReferenceTextIndex, setEditingReferenceTextIndex] = React.useState<number | null>(null);
  const [editingStatementIndex, setEditingStatementIndex] = React.useState<number | null>(null);
  const [editingOptionKey, setEditingOptionKey] = React.useState<string | null>(null);
  const [activeOptionCropKey, setActiveOptionCropKey] = React.useState<string | null>(null);
  const [contextPendingRemoval, setContextPendingRemoval] = React.useState<ExtractedContextPreview | null>(null);
  const [manualQuestionText, setManualQuestionText] = React.useState('');
  const [externalAiJsonText, setExternalAiJsonText] = React.useState('');
  const [externalEditorialMode, setExternalEditorialMode] = React.useState<ExternalEditorialMode | null>(null);
  const [externalEditorialJsonText, setExternalEditorialJsonText] = React.useState('');
  const [openExtractionMethod, setOpenExtractionMethod] = React.useState<'platform' | 'ai' | null>(null);
  const [aiPromptCopied, setAiPromptCopied] = React.useState(false);
  const [editorialPromptCopied, setEditorialPromptCopied] = React.useState(false);
  const [isParsingManualQuestionText, setIsParsingManualQuestionText] = React.useState(false);
  const [isImportingExternalAiJson, setIsImportingExternalAiJson] = React.useState(false);
  const [isImportingExternalEditorialJson, setIsImportingExternalEditorialJson] = React.useState(false);
  const metadata = importMetadata || {};
  const metadataRoleList = dedupeTextList([...asTextList(metadata.roles), ...asTextList(metadata.cargos)]);
  const metadataRole = metadataRoleList.length > 0 ? metadataRoleList.join('/') : asText(metadata.role || metadata.cargo || metadata.examName || metadata.contestName);
  const metadataAgency = asText(metadata.agency);
  const metadataSourceList = dedupeTextList([
    ...asTextList((metadata as Record<string, unknown>).sources),
    ...asTextList((metadata as Record<string, unknown>).organizations),
    ...asTextList((metadata as Record<string, unknown>).orgaos),
    ...asTextList(metadata.source),
    ...asTextList((metadata as Record<string, unknown>).organization),
    ...asTextList((metadata as Record<string, unknown>).orgao),
  ]);
  const metadataSource = metadataSourceList.length > 0 ? metadataSourceList.join('/') : asText(metadata.source);
  const metadataYear = asText(metadata.year || metadata.ano);
  const hasManualMetadataTitle = Object.prototype.hasOwnProperty.call(metadata, 'title')
    || Object.prototype.hasOwnProperty.call(metadata, 'examTitle');
  const metadataTitle = Object.prototype.hasOwnProperty.call(metadata, 'title')
    ? asText(metadata.title)
    : asText(metadata.examTitle);
  const examTitlePreview = buildExamTitlePreview(metadata);
  const selectedReviewExam = React.useMemo(
    () => examBank.find((exam) => String(exam.id) === selectedExamId) || null,
    [examBank, selectedExamId],
  );
  const selectedReviewExamLabel = selectedReviewExam
    ? getExamOptionLabel(selectedReviewExam)
    : asText(metadataTitle || examTitlePreview);
  const externalAiPrompt = EXTERNAL_AI_FULL_BATCH_PROMPT;
  const externalEditorialPrompt = React.useMemo(
    () => (externalEditorialMode ? buildExternalEditorialPrompt(externalEditorialMode, extractedQuestions) : ''),
    [externalEditorialMode, extractedQuestions],
  );
  const placeholderQuestionNumbers = importDiagnostics.placeholderQuestionNumbers || [];
  const placeholderQuestionSet = React.useMemo(
    () => new Set(placeholderQuestionNumbers),
    [placeholderQuestionNumbers],
  );
  const localizedQuestionNumbers = importDiagnostics.localizedQuestionNumbers || importDiagnostics.extractedQuestionNumbers || [];
  const localizedQuestionSet = React.useMemo(
    () => new Set(localizedQuestionNumbers),
    [localizedQuestionNumbers],
  );
  const localizedIncompleteQuestionNumbers = React.useMemo(
    () => (extractedQuestions as ExtractedQuestionPreview[])
      .map((question, index) => ({ question, number: getQuestionNumber(question, index + 1) }))
      .filter(({ question, number }) => (
        localizedQuestionSet.has(number)
        && !placeholderQuestionSet.has(number)
        && !isQuestionReadyForPublicationPreview(question)
      ))
      .map(({ number }) => number),
    [extractedQuestions, localizedQuestionSet, placeholderQuestionSet],
  );
  const pendingAlternativeQuestions = React.useMemo(() => (
    (extractedQuestions as ExtractedQuestionPreview[])
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => {
        const number = getQuestionNumber(question, index + 1);
        return placeholderQuestionSet.has(number)
          || !isQuestionReadyForPublicationPreview(question);
      })
  ), [extractedQuestions, placeholderQuestionSet]);
  const cardsOnly = reviewOnly && reviewDisplayMode === 'cards';
  const [expandedReviewQuestionIndexes, setExpandedReviewQuestionIndexes] = React.useState<Set<number>>(() => new Set());
  const effectiveReviewTab = cardsOnly
    ? 'questions'
    : activeReviewTab === 'pending' && pendingAlternativeQuestions.length === 0
      ? 'questions'
      : activeReviewTab;
  const questionsForReview = effectiveReviewTab === 'pending'
    ? pendingAlternativeQuestions
    : (extractedQuestions as ExtractedQuestionPreview[]).map((question, index) => ({ question, index }));
  const missingQuestionNumbers = importDiagnostics.missingQuestionNumbers || [];
  const trulyMissingQuestionNumbers = React.useMemo(
    () => Array.from(new Set([
      ...placeholderQuestionNumbers,
      ...missingQuestionNumbers.filter((number) => !localizedQuestionSet.has(number)),
    ])).sort((left, right) => left - right),
    [localizedQuestionSet, missingQuestionNumbers, placeholderQuestionNumbers],
  );
  const unresolvedQuestionNumbers = React.useMemo(
    () => Array.from(new Set([
      ...localizedIncompleteQuestionNumbers,
      ...trulyMissingQuestionNumbers,
    ])).sort((left, right) => left - right),
    [localizedIncompleteQuestionNumbers, trulyMissingQuestionNumbers],
  );
  const completeQuestionNumbers = importDiagnostics.completeQuestionNumbers || [];
  const visualPendingQuestionNumbers = importDiagnostics.visualPendingQuestionNumbers || [];
  const duplicateQuestionNumbers = importDiagnostics.duplicateQuestionNumbers || [];
  const expectedTotal = importDiagnostics.expectedQuestionNumbers?.length || 0;
  const cardsCreatedCount = extractedQuestions.length || importDiagnostics.cardsCreatedCount || 0;
  const incompleteCardsCount = pendingAlternativeQuestions.length;
  const completeCardsCount = Math.max(0, cardsCreatedCount - incompleteCardsCount);
  const placeholderCardsCount = placeholderQuestionNumbers.length || importDiagnostics.placeholderCardsCount || 0;
  const orphanContentBlocks = importDiagnostics.orphanContentBlocks || [];
  const extractedUniqueTotal = localizedQuestionNumbers.length;
  const missingByQuantity = unresolvedQuestionNumbers.length;
  const aiLimitedPages = importDiagnostics.aiLimitedPages || [];
  const aiTokenLimitPages = importDiagnostics.aiTokenLimitPages || [];
  const aiQuotaLimitPages = importDiagnostics.aiQuotaLimitPages || [];
  const pagesWithoutNativeText = importDiagnostics.pagesWithoutNativeText || [];
  const aiLimitReached = Boolean(importDiagnostics.aiLimitReached);
  const aiTokenLimitReached = Boolean(importDiagnostics.aiTokenLimitReached);
  const aiQuotaLimitReached = Boolean(importDiagnostics.aiQuotaLimitReached);
  const aiCallCount = importDiagnostics.aiCallCount ?? 0;
  const aiCallLimit = importDiagnostics.aiCallLimit ?? 0;
  const publishedQuestionSet = React.useMemo(() => new Set(publishedQuestionNumbers), [publishedQuestionNumbers]);
  const publishableUnpublishedQuestionCount = (extractedQuestions as ExtractedQuestionPreview[]).filter((question, index) => (
    !publishedQuestionSet.has(getQuestionNumber(question, index + 1))
    && isQuestionReadyForPublicationPreview(question)
  )).length;
  const figureContexts = extractedContexts.filter((context) => context.hasFigure || context.figureDescription || context.imageData);
  const questionLinkOptions = React.useMemo(() => (
    (extractedQuestions as ExtractedQuestionPreview[]).map((question, index) => ({
      index,
      number: getQuestionNumber(question, index + 1),
      label: `Questao ${getQuestionNumber(question, index + 1)}`,
    }))
  ), [extractedQuestions]);
  const isPublishing = Boolean(publishingAction);
  const importActionBusy = isBulkGenerating || isRetryingMissingQuestions;
  const manualTextParseBlocked = isProcessing
    || importActionBusy
    || isParsingManualQuestionText
    || !manualQuestionText.trim()
    || (!selectedFocusId && !manualFocusName.trim());
  const retryMissingBlocked = isProcessing || importActionBusy || missingByQuantity === 0 || !qFile;
  const examPublishBlocked = isProcessing || importActionBusy || isPublishing || !metadataAgency || !metadataYear || !metadataSource || !metadataRole || (!selectedFocusId && !manualFocusName.trim());
  const questionsPublishBlocked = isProcessing || importActionBusy || isPublishing || !publishedExam || publishableUnpublishedQuestionCount === 0;
  const metadataSubjects = Array.isArray(metadata.subjects)
    ? metadata.subjects.map((subject) => asText(subject)).filter(Boolean)
    : asText(metadata.subjects).split(/[,;\n]/).map((subject) => subject.trim()).filter(Boolean);
  const subjectsForDisplay = metadataSubjects.length > 0 ? metadataSubjects : getQuestionSubjects(extractedQuestions);
  const focusOptions = React.useMemo(() => {
    const options = new Map<string, NonNullable<SystemSettings['taxonomies']>['careers'][number]>();
    (systemSettings.taxonomies?.careers || []).forEach((focus) => {
      const label = getFocusLabel(focus);
      const rootLabel = getRootFocusLabel(label);
      const key = slugifyFocusValue(rootLabel);
      const previous = options.get(key);
      if (!previous || getFocusLabel(previous).includes('/')) {
        options.set(key, focus);
      }
    });
    return Array.from(options.values());
  }, [systemSettings.taxonomies?.careers]);
  const readContextCropDraft = (context: ExtractedContextPreview) => {
    const current = contextCropDrafts[context.tempId];
    if (current) {
      return current;
    }

    return {
      x: asText(context.figureBox?.x ?? 0),
      y: asText(context.figureBox?.y ?? 0),
      width: asText(context.figureBox?.width ?? 1000),
      height: asText(context.figureBox?.height ?? 1000),
    };
  };
  const writeContextCropDraft = (
    context: ExtractedContextPreview,
    updater: (box: CropBox) => CropBox,
  ) => {
    const current = normalizeCropBox(readContextCropDraft(context));
    const next = normalizeCropBox(updater(current));
    setContextCropDrafts((previous) => ({
      ...previous,
      [context.tempId]: cropBoxToDraft(next),
    }));
  };
  const setContextCropDraftBox = (context: ExtractedContextPreview, box: CropBox) => {
    const next = normalizeCropBox(box);
    setContextCropDrafts((previous) => ({
      ...previous,
      [context.tempId]: cropBoxToDraft(next),
    }));
  };
  const applyContextCropDraft = async (context: ExtractedContextPreview, box?: CropBox) => {
    const draft = normalizeCropBox(box || readContextCropDraft(context));
    setContextCropDrafts((previous) => ({
      ...previous,
      [context.tempId]: cropBoxToDraft(draft),
    }));
    await onContextFigureCropChange(context.tempId, draft);
  };
  const readSupportImageCropDraft = (questionIndex: number, image: ExtractedQuestionImagePreview) => {
    const key = `${questionIndex}:${image.tempId}`;
    const current = supportImageCropDrafts[key];
    if (current) {
      return current;
    }

    return {
      x: asText(image.figureBox?.x ?? 0),
      y: asText(image.figureBox?.y ?? 0),
      width: asText(image.figureBox?.width ?? 1000),
      height: asText(image.figureBox?.height ?? 1000),
    };
  };
  const setSupportImageCropDraftBox = (questionIndex: number, image: ExtractedQuestionImagePreview, box: CropBox) => {
    const key = `${questionIndex}:${image.tempId}`;
    setSupportImageCropDrafts((previous) => ({
      ...previous,
      [key]: cropBoxToDraft(normalizeCropBox(box)),
    }));
  };
  const applySupportImageCropDraft = async (questionIndex: number, image: ExtractedQuestionImagePreview, box?: CropBox) => {
    const draft = normalizeCropBox(box || readSupportImageCropDraft(questionIndex, image));
    setSupportImageCropDraftBox(questionIndex, image, draft);
    await onExtractedQuestionSupportImageCropChange(questionIndex, image.tempId, draft);
  };
  const readOptionImageCropDraft = (questionIndex: number, optionIndex: number, option: ExtractedOptionPreview) => {
    const key = `${questionIndex}:${optionIndex}`;
    const current = optionImageCropDrafts[key];
    if (current) {
      return current;
    }

    return {
      x: asText(option.figureBox?.x ?? 0),
      y: asText(option.figureBox?.y ?? 0),
      width: asText(option.figureBox?.width ?? 1000),
      height: asText(option.figureBox?.height ?? 1000),
    };
  };
  const setOptionImageCropDraftBox = (
    questionIndex: number,
    optionIndex: number,
    option: ExtractedOptionPreview,
    box: CropBox,
  ) => {
    const key = `${questionIndex}:${optionIndex}`;
    setOptionImageCropDrafts((previous) => ({
      ...previous,
      [key]: cropBoxToDraft(normalizeCropBox(box)),
    }));
  };
  const applyOptionImageCropDraft = async (
    questionIndex: number,
    optionIndex: number,
    option: ExtractedOptionPreview,
    box?: CropBox,
  ) => {
    const draft = normalizeCropBox(box || readOptionImageCropDraft(questionIndex, optionIndex, option));
    setOptionImageCropDraftBox(questionIndex, optionIndex, option, draft);
    await onExtractedQuestionOptionImageCropChange(questionIndex, optionIndex, draft);
  };
  const handleSupportImageUpload = async (questionIndex: number, file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const imageData = await readLocalImageFile(file);
    onExtractedQuestionSupportImageAdd(questionIndex, imageData, file.name);
  };
  const handleOptionImageUpload = async (questionIndex: number, optionIndex: number, file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const imageData = await readLocalImageFile(file);
    onExtractedQuestionOptionImageChange(questionIndex, optionIndex, imageData);
    setActiveOptionCropKey(`${questionIndex}:${optionIndex}`);
  };
  const handleContextImageUpload = async (contextId: string, file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const imageData = await readLocalImageFile(file);
    onExtractedContextImageChange(contextId, imageData, file.name);
  };
  const handleRemoveExtractedContext = (context: ExtractedContextPreview) => {
    setContextPendingRemoval(context);
  };
  const confirmRemoveExtractedContext = () => {
    const context = contextPendingRemoval;
    if (!context) {
      return;
    }

    setContextCropDrafts((previous) => {
      const next = { ...previous };
      delete next[context.tempId];
      return next;
    });
    setEditingContextId((current) => (current === context.tempId ? null : current));
    onExtractedContextRemove(context.tempId);
    setContextPendingRemoval(null);
  };
  const handleParseManualQuestionText = async () => {
    if (manualTextParseBlocked) {
      return;
    }

    setIsParsingManualQuestionText(true);
    try {
      await onParseQuestionsFromText(manualQuestionText);
    } finally {
      setIsParsingManualQuestionText(false);
    }
  };
  const handleCopyExternalAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(externalAiPrompt);
      setAiPromptCopied(true);
      window.setTimeout(() => setAiPromptCopied(false), 1600);
    } catch {
      setAiPromptCopied(false);
    }
  };
  const handleImportExternalAiJson = async () => {
    if (!externalAiJsonText.trim() || isImportingExternalAiJson) {
      return;
    }

    setIsImportingExternalAiJson(true);
    try {
      await onImportFromAiJson(externalAiJsonText);
    } finally {
      setIsImportingExternalAiJson(false);
    }
  };
  const handleExternalAiJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      return;
    }

    try {
      const text = await file.text();
      setExternalAiJsonText(text);
    } catch {
      setExternalAiJsonText('');
    }
  };
  const handleCopyExternalEditorialPrompt = async () => {
    if (!externalEditorialPrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(externalEditorialPrompt);
      setEditorialPromptCopied(true);
      window.setTimeout(() => setEditorialPromptCopied(false), 1600);
    } catch {
      setEditorialPromptCopied(false);
    }
  };
  const handleImportExternalEditorialJson = async () => {
    if (!externalEditorialJsonText.trim() || isImportingExternalEditorialJson) {
      return;
    }

    setIsImportingExternalEditorialJson(true);
    try {
      await onImportExternalEditorialJson(externalEditorialJsonText);
      setExternalEditorialJsonText('');
    } finally {
      setIsImportingExternalEditorialJson(false);
    }
  };

  return (
    <>
    <div className="space-y-6 animate-slide-up">
      <div className={`grid grid-cols-1 gap-6 ${reviewOnly ? '' : 'lg:grid-cols-12'}`}>
        {!reviewOnly && (
        <div className="space-y-6 lg:col-span-4">
          <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-6 p-6 transition-colors duration-300`}>
            <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Database size={20} className="text-sky-700 dark:text-sky-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Extracao Inteligente</h3>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setOpenExtractionMethod((current) => (current === 'ai' ? null : 'ai'))}
                className="flex w-full items-center justify-between rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-left transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">Novo metodo</span>
                  <span className="mt-1 block text-sm font-black text-slate-900 dark:text-slate-100">Gerar na IA e colar JSON</span>
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300">
                  {openExtractionMethod === 'ai' ? 'Ocultar' : 'Mostrar'}
                </span>
              </button>

              {openExtractionMethod === 'ai' && (
                <div className={`space-y-4 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
                  <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
                    <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      <Database size={12} className="text-violet-700 dark:text-violet-300" />
                      Prova do Banco de Provas
                    </label>
                    <SearchableExamBankSelect
                      exams={examBank}
                      selectedExamId={selectedExamId}
                      onChange={onSelectedExamIdChange}
                      disabled={isLoadingExamBank || isProcessing || isImportingExternalAiJson}
                      isLoading={isLoadingExamBank}
                    />
                    <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {isLoadingExamBank
                        ? 'Carregando provas cadastradas...'
                        : selectedExamId
                          ? 'O JSON importado será vinculado a esta prova, herdando metadados e foco quando disponíveis.'
                          : 'Opcional. Deixe em branco para cadastrar uma nova prova com os metadados extraídos pela IA.'}
                    </p>
                  </div>

                  <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
                    <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      <Target size={12} className="text-violet-700 dark:text-violet-300" />
                      Foco da prova <span className="font-black text-red-500">*</span>
                    </label>
                    <SearchableFocusSelect
                      focusOptions={focusOptions}
                      selectedFocusId={selectedFocusId}
                      inheritedFocusLabel={selectedExamFocusLabel}
                      manualFocusName={manualFocusName}
                      onSelectedFocusIdChange={onSelectedFocusIdChange}
                      onManualFocusNameChange={onManualFocusNameChange}
                      disabled={Boolean(selectedExamFocusLabel)}
                    />
                    <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {selectedExamFocusLabel
                        ? `Foco herdado da prova: ${selectedExamFocusLabel}.`
                        : 'O foco escolhido será aplicado ao JSON importado e a todas as questões da revisão.'}
                    </p>
                  </div>

                  <div className="rounded-md border border-violet-200 bg-white p-4 dark:border-violet-900/40 dark:bg-slate-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">Prompt para ChatGPT</p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                          Envie os PDFs à IA, cole este prompt e peça para ela gerar o JSON completo; depois cole o retorno abaixo ou carregue o arquivo .json gerado.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyExternalAiPrompt}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 px-4 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300`}
                      >
                        {aiPromptCopied ? 'Copiado' : 'Copiar prompt'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={externalAiPrompt}
                      className={`mt-3 h-72 w-full resize-y py-3 font-mono text-[10px] leading-relaxed ${ADMIN_FIELD_CLASS}`}
                    />
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="external-ai-json" className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        JSON completo da IA
                      </label>
                      <label className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-10 cursor-pointer justify-center px-4 text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200`}>
                        Carregar .json
                        <input
                          type="file"
                          accept="application/json,.json"
                          className="hidden"
                          onChange={handleExternalAiJsonFile}
                        />
                      </label>
                    </div>
                    <textarea
                      id="external-ai-json"
                      value={externalAiJsonText}
                      onChange={(event) => setExternalAiJsonText(event.target.value)}
                      placeholder='Cole aqui o JSON completo retornado pela IA ou o conteúdo do arquivo .json. Ex.: {"metadata": {...}, "temporary_context": {...}, "questions": [...]}'
                      className={`mt-2 h-64 w-full resize-y py-3 font-mono text-[11px] leading-relaxed ${ADMIN_FIELD_CLASS}`}
                    />
                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <button
                        type="button"
                        onClick={handleImportExternalAiJson}
                        disabled={!externalAiJsonText.trim() || isImportingExternalAiJson || isProcessing}
                        className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-violet-700 bg-violet-700 px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-violet-700/60 disabled:opacity-60"
                      >
                        {isImportingExternalAiJson ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        <span className="truncate">Gerar revisão pelo JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExternalAiJsonText('')}
                        disabled={isImportingExternalAiJson || !externalAiJsonText.trim()}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-11 justify-center px-4 text-[10px] font-black uppercase tracking-wide disabled:opacity-50`}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpenExtractionMethod((current) => (current === 'platform' ? null : 'platform'))}
                className="flex w-full items-center justify-between rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/30 dark:hover:bg-sky-950/50"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">Metodo atual</span>
                  <span className="mt-1 block text-sm font-black text-slate-900 dark:text-slate-100">Extrair pela plataforma</span>
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300">
                  {openExtractionMethod === 'platform' ? 'Ocultar' : 'Mostrar'}
                </span>
              </button>

              {openExtractionMethod === 'platform' && (
                <div className="space-y-4">
            <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  <Zap size={12} className={systemSettings.hasGeminiApiKeyConfigured || systemSettings.geminiApiKey ? 'text-emerald-500' : 'text-slate-400'} />
                  Gemini API Key
                </label>
                {systemSettings.hasGeminiApiKeyConfigured && (
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500">
                    <CheckCircle2 size={10} /> Configurada
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={systemSettings.geminiApiKey || ''}
                  onChange={(event) => onGeminiApiKeyChange(event.target.value)}
                  placeholder={systemSettings.hasGeminiApiKeyConfigured ? 'Digite uma nova chave para substituir a atual' : 'Cole sua API Key aqui (AIza...)'}
                  className={`h-9 flex-1 text-xs font-medium ${ADMIN_FIELD_CLASS}`}
                />
                <button
                  type="button"
                  onClick={onSaveSettings}
                  disabled={isSavingSettings}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 text-sky-700 dark:text-sky-300`}
                >
                  {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
              </div>
              {!systemSettings.hasGeminiApiKeyConfigured && !systemSettings.geminiApiKey && (
                <p className="text-[9px] font-medium leading-tight text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={10} className="mr-1 inline" />
                  Necessario configurar uma chave valida para extrair questoes.
                </p>
              )}
              {systemSettings.hasGeminiApiKeyConfigured && !systemSettings.geminiApiKey && (
                <p className="text-[9px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                  A chave atual fica oculta por seguranca. Preencha o campo apenas para substituir.
                </p>
              )}
            </div>

            <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Database size={12} className="text-sky-700 dark:text-sky-300" />
                Prova do Banco de Provas
              </label>
              <SearchableExamBankSelect
                exams={examBank}
                selectedExamId={selectedExamId}
                onChange={onSelectedExamIdChange}
                disabled={isLoadingExamBank || isProcessing}
                isLoading={isLoadingExamBank}
              />
              <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {isLoadingExamBank
                  ? 'Carregando provas cadastradas...'
                  : selectedExamId
                    ? 'As questões publicadas serão vinculadas a esta prova, sem criar duplicata.'
                    : 'Opcional. Deixe em branco para cadastrar uma nova prova com os metadados extraídos.'}
              </p>
            </div>

            <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Target size={12} className="text-sky-700 dark:text-sky-300" />
                Foco da prova <span className="font-black text-red-500">*</span>
              </label>
              <SearchableFocusSelect
                focusOptions={focusOptions}
                selectedFocusId={selectedFocusId}
                inheritedFocusLabel={selectedExamFocusLabel}
                manualFocusName={manualFocusName}
                onSelectedFocusIdChange={onSelectedFocusIdChange}
                onManualFocusNameChange={onManualFocusNameChange}
                disabled={Boolean(selectedExamFocusLabel)}
              />
              <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {selectedExamFocusLabel
                  ? `Foco herdado da prova: ${selectedExamFocusLabel}.`
                  : 'O foco escolhido será aplicado à prova e a todas as questões importadas.'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Arquivo da Prova <span className="font-black text-red-500">*</span>
                </label>
                {inheritedProofFileName ? (
                  <div className="flex h-20 w-full flex-col items-center justify-center rounded-sm border border-emerald-300 bg-emerald-50 px-4 text-center dark:border-emerald-900/40 dark:bg-emerald-900/10">
                    <FileCheck size={20} className="text-emerald-600" />
                    <span className="mt-2 line-clamp-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{inheritedProofFileName}</span>
                    <span className="text-[8px] font-black uppercase tracking-wide text-emerald-600/80">Arquivo do Banco de Provas</span>
                  </div>
                ) : <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${qFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onQFileChange(event.target.files?.[0] || null)} />
                  <UploadCloud size={24} className={qFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {qFile ? qFile.name : 'Selecionar Prova (PDF)'}
                  </span>
                </label>}
              </div>

              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Gabarito Oficial <span className="font-black text-red-500">*</span>
                </label>
                {inheritedAnswerKeyFileName ? (
                  <div className="flex h-20 w-full flex-col items-center justify-center rounded-sm border border-emerald-300 bg-emerald-50 px-4 text-center dark:border-emerald-900/40 dark:bg-emerald-900/10">
                    <FileCheck size={20} className="text-emerald-600" />
                    <span className="mt-2 line-clamp-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{inheritedAnswerKeyFileName}</span>
                    <span className="text-[8px] font-black uppercase tracking-wide text-emerald-600/80">Arquivo do Banco de Provas</span>
                  </div>
                ) : <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${kFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onKFileChange(event.target.files?.[0] || null)} />
                  <FileCheck size={24} className={kFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {kFile ? kFile.name : 'Selecionar Gabarito (PDF)'}
                  </span>
                </label>}
              </div>

              <div className="flex items-center gap-2 rounded-sm border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                <input
                  type="checkbox"
                  checked={extractWithComment}
                  onChange={(event) => onExtractWithCommentChange(event.target.checked)}
                  className="h-4 w-4 rounded-sm text-amber-600 focus:ring-amber-500"
                />
                <label
                  onClick={() => onExtractWithCommentChange(!extractWithComment)}
                  className="cursor-pointer select-none text-xs font-bold text-amber-800 dark:text-amber-200"
                >
                  Extrair Comentario Resumido (Prof)
                </label>
              </div>
              <div className="flex items-start gap-2 rounded-sm border border-sky-300 bg-sky-50 p-3 dark:border-sky-900/30 dark:bg-sky-900/10">
                <input
                  type="checkbox"
                  checked={extractWithDetailedAnalysis}
                  onChange={(event) => onExtractWithDetailedAnalysisChange(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-sm text-sky-700 focus:ring-sky-500"
                />
                <label
                  onClick={() => onExtractWithDetailedAnalysisChange(!extractWithDetailedAnalysis)}
                  className="cursor-pointer select-none text-xs font-bold text-sky-800 dark:text-sky-200"
                >
                  Gerar analise detalhada em lote
                  <span className="mt-1 block text-[10px] font-medium leading-relaxed text-sky-700/80 dark:text-sky-200/70">
                    Usa menos chamadas de IA que gerar uma por uma e preenche todas apos a extracao.
                  </span>
                </label>
              </div>
            </div>

            <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="manual-question-parser-text" className="flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <FileQuestion size={13} className="shrink-0 text-sky-700 dark:text-sky-300" />
                  <span className="truncate">Gerar por texto</span>
                </label>
                <span className="shrink-0 rounded-sm border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Parser local
                </span>
              </div>
              <textarea
                id="manual-question-parser-text"
                value={manualQuestionText}
                onChange={(event) => setManualQuestionText(event.target.value)}
                placeholder={'8) Enunciado da questao...\na) Alternativa A.\nb) Alternativa B.\nc) Alternativa C.\nd) Alternativa D.'}
                className={`h-auto min-h-52 w-full resize-y py-3 text-xs font-semibold leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-600 ${ADMIN_FIELD_CLASS}`}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <button
                  type="button"
                  onClick={handleParseManualQuestionText}
                  disabled={manualTextParseBlocked}
                  className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-sky-700 bg-sky-700 px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-700/60 disabled:opacity-60"
                >
                  {isParsingManualQuestionText ? <Loader2 className="animate-spin" size={14} /> : <FileQuestion size={14} />}
                  <span className="truncate">Gerar questao</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualQuestionText('')}
                  disabled={isParsingManualQuestionText || !manualQuestionText.trim()}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-11 justify-center px-4 text-[10px] font-black uppercase tracking-wide disabled:opacity-50`}
                >
                  Limpar
                </button>
              </div>
            </div>

            {isProcessing ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-sky-700 dark:text-sky-300">Progresso da Prova</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{examProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-sky-700 transition-all duration-500 dark:bg-sky-500" style={{ width: `${examProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Progresso do Gabarito</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{keyProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-emerald-600 transition-all duration-500 dark:bg-emerald-500" style={{ width: `${keyProgress}%` }} />
                  </div>
                </div>
                <p className="animate-pulse text-center text-[10px] italic text-slate-400 dark:text-slate-500">Processando...</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartImport}
                disabled={!qFile || !kFile || (!selectedFocusId && !manualFocusName.trim())}
                className={`${ADMIN_PRIMARY_BUTTON_CLASS} flex w-full items-center justify-center gap-3 py-4 font-black uppercase tracking-widest disabled:opacity-30`}
              >
                <PlayCircle size={20} /> Iniciar Importacao
              </button>
            )}
                </div>
              )}
            </div>
          </div>

          <div className="flex h-48 flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-900 font-mono text-[10px] text-emerald-400 shadow-inner transition-colors dark:border-slate-800 dark:bg-slate-950">
            <div className="shrink-0 border-b border-slate-800 px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-sky-300">
              IA configurada: {configuredAiLabel}
            </div>
            <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto p-6">
              <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="animate-fade-in opacity-80">{log}</div>
              ))}
              {isProcessing && <div className="animate-pulse">_</div>}
              </div>
            </div>
          </div>
        </div>
        )}

        <div className={`flex flex-col gap-6 ${reviewOnly ? 'min-w-0' : 'lg:col-span-8'}`}>
          {extractedQuestions.length > 0 ? (
            <div className="flex flex-1 flex-col space-y-4 animate-slide-up">
              {!cardsOnly && (
              <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-4 p-5`}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="grid min-w-[min(100%,42rem)] flex-1 grid-cols-2 gap-2 md:grid-cols-5">
                    {([
                      ['Esperadas', expectedTotal || cardsCreatedCount, 'slate'],
                      ['Cards criados', cardsCreatedCount, 'sky'],
                      ['Prontas', completeCardsCount, 'emerald'],
                      ['Revisar', incompleteCardsCount, 'amber'],
                      ['Sem conteúdo', placeholderCardsCount, 'rose'],
                    ] as const).map(([label, value, tone]) => (
                      <div
                        key={label}
                        className={`min-w-0 rounded-md border px-3 py-2.5 ${
                          tone === 'emerald'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : tone === 'amber'
                              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300'
                              : tone === 'rose'
                                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300'
                                : tone === 'sky'
                                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <p className="text-base font-black leading-none">{value}</p>
                        <p className="mt-1 truncate text-[8px] font-black uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`grid min-w-[min(100%,34rem)] flex-1 gap-2 sm:grid-cols-2 ${missingByQuantity > 0 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
                    <button
                      type="button"
                      onClick={onGenerateTeacherAll}
                      disabled={importActionBusy || isProcessing}
                      className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                    >
                      {isBulkGenerating && bulkGenerationType === 'teacher' ? <Loader2 className="shrink-0 animate-spin" size={15} /> : <GraduationCap className="shrink-0" size={15} />}
                      <span className="min-w-0">Gerar Professor</span>
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateDetailedAll}
                      disabled={importActionBusy || isProcessing}
                      className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                    >
                      {isBulkGenerating && bulkGenerationType === 'detailed' ? <Loader2 className="shrink-0 animate-spin" size={15} /> : <Sparkles className="shrink-0" size={15} />}
                      <span className="min-w-0">Análise Detalhada</span>
                    </button>
                    <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 xl:col-span-2">
                      <button
                        type="button"
                        onClick={() => setExternalEditorialMode((current) => (current === 'teacher' ? null : 'teacher'))}
                        disabled={extractedQuestions.length === 0 || isProcessing}
                        className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          externalEditorialMode === 'teacher'
                            ? 'border-amber-500 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                            : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:bg-slate-950 dark:text-amber-300 dark:hover:bg-amber-900/20'
                        }`}
                      >
                        <UploadCloud className="shrink-0" size={13} />
                        Professor via IA externa
                      </button>
                      <button
                        type="button"
                        onClick={() => setExternalEditorialMode((current) => (current === 'detailed' ? null : 'detailed'))}
                        disabled={extractedQuestions.length === 0 || isProcessing}
                        className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-center text-[9px] font-black uppercase leading-tight tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          externalEditorialMode === 'detailed'
                            ? 'border-sky-500 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200'
                            : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-900/30 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-sky-900/20'
                        }`}
                      >
                        <UploadCloud className="shrink-0" size={13} />
                        Detalhada via IA externa
                      </button>
                    </div>
                    {missingByQuantity > 0 && (
                      <button
                        type="button"
                        onClick={onRetryMissingQuestions}
                        disabled={retryMissingBlocked}
                        className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-md border border-amber-600 bg-amber-600 px-3 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-600/60 disabled:opacity-60"
                      >
                        {isRetryingMissingQuestions ? <Loader2 className="shrink-0 animate-spin" size={15} /> : <RefreshCw className="shrink-0" size={15} />}
                        <span className="min-w-0">Tentar Faltantes</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onPublishExam}
                      disabled={examPublishBlocked}
                      className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-md border border-sky-700 bg-sky-700 px-3 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-700/60 disabled:opacity-60"
                    >
                      {publishingAction === 'exam' ? <Loader2 className="shrink-0 animate-spin" size={15} /> : <FileCheck className="shrink-0" size={15} />}
                      <span className="min-w-0">{selectedExamId ? 'Prova Vinculada' : publishedExam ? 'Atualizar Prova' : 'Publicar Prova'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onPublishAllQuestions}
                      disabled={questionsPublishBlocked}
                      className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-md border border-emerald-700 bg-emerald-700 px-3 py-3 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/60 disabled:opacity-60"
                    >
                      {publishingAction === 'questions' ? <Loader2 className="shrink-0 animate-spin" size={15} /> : <CheckCircle2 className="shrink-0" size={15} />}
                      <span className="min-w-0">Publicar Todas</span>
                    </button>
                  </div>
                </div>
                {externalEditorialMode && (
                  <div className="w-full rounded-md border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
                          {externalEditorialMode === 'teacher' ? 'Comentário do professor com IA externa' : 'Análise detalhada com IA externa'}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                          Copie o prompt, peça para a IA externa gerar o JSON editorial e cole o retorno aqui. Apenas os campos editoriais serão aplicados às questões já carregadas.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyExternalEditorialPrompt}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-10 px-4 text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300`}
                      >
                        {editorialPromptCopied ? 'Copiado' : 'Copiar prompt'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={externalEditorialPrompt}
                      className={`mt-3 h-48 w-full resize-y py-3 font-mono text-[10px] leading-relaxed ${ADMIN_FIELD_CLASS}`}
                    />
                    <label htmlFor="external-editorial-json" className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      JSON editorial retornado pela IA externa
                    </label>
                    <textarea
                      id="external-editorial-json"
                      value={externalEditorialJsonText}
                      onChange={(event) => setExternalEditorialJsonText(event.target.value)}
                      placeholder='Cole aqui: {"questions":[{"number":1,"teacherComment":"..."},{"number":2,"teacherComment":"..."}]}'
                      className={`mt-2 h-40 w-full resize-y py-3 font-mono text-[11px] leading-relaxed ${ADMIN_FIELD_CLASS}`}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleImportExternalEditorialJson}
                        disabled={!externalEditorialJsonText.trim() || isImportingExternalEditorialJson || isProcessing}
                        className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-violet-700 bg-violet-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-violet-700/60 disabled:opacity-60"
                      >
                        {isImportingExternalEditorialJson ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        Aplicar JSON editorial
                      </button>
                      <button
                        type="button"
                        onClick={() => setExternalEditorialJsonText('')}
                        disabled={isImportingExternalEditorialJson || !externalEditorialJsonText.trim()}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-11 justify-center px-4 text-[10px] font-black uppercase tracking-wide disabled:opacity-50`}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                )}
                {(!metadataAgency || !metadataYear || !metadataSource || !metadataRole || !publishedExam || pendingAlternativeQuestions.length > 0) && (
                  <div className="flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {!metadataAgency || !metadataYear || !metadataSource || !metadataRole
                        ? 'Para publicar, preencha Banca, Ano, Órgão e Cargo/Prova para formar o título Banca - Ano - Órgão - Cargo/Prova.'
                        : !publishedExam
                          ? 'Publique a prova primeiro. Depois publique todas as questões ou apenas uma questão específica.'
                          : pendingAlternativeQuestions.length > 0
                            ? `${pendingAlternativeQuestions.length} questão(ões) precisa(m) de revisão estrutural. Publicar todas enviará somente as questões prontas.`
                            : ''}
                    </span>
                  </div>
                )}
              </div>
              )}

              {!cardsOnly && (
              <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-wrap gap-2 p-2`}>
                {([
                  ['proof', 'Prova', `${subjectsForDisplay.length} matérias`, Database],
                  ['contexts', 'Contextos', `${extractedContexts.length} ctx · ${figureContexts.length} fig`, BookOpen],
                  ...(pendingAlternativeQuestions.length > 0
                    ? [['pending', 'Revisão', `${pendingAlternativeQuestions.length} item(ns)`, AlertTriangle] as const]
                    : []),
                  ['questions', 'Questões', `${extractedQuestions.length} itens`, FileQuestion],
                ] as const).map(([tab, label, count, Icon]) => {
                  const isActive = effectiveReviewTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveReviewTab(tab)}
                      className={`flex min-w-[150px] flex-1 items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-900/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <Icon size={14} className="shrink-0" />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-sm bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              )}

              {!cardsOnly && effectiveReviewTab === 'proof' && (
              <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-4 p-4 text-xs`}>
                {selectedExamId ? (
                  <div className="rounded-sm border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">Prova vinculada</p>
                    <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                      {selectedReviewExamLabel || 'Prova selecionada'}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      As questões importadas serão vinculadas a esta prova. Metadados como banca, ano, órgão, cargo/prova, nível e foco serão herdados do Banco de Provas sempre que disponíveis.
                    </p>
                    {selectedExamFocusLabel && (
                      <span className="mt-3 inline-flex rounded-sm border border-violet-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-900/40 dark:bg-slate-900 dark:text-violet-300">
                        Foco herdado: {selectedExamFocusLabel}
                      </span>
                    )}
                  </div>
                ) : (
                <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Metadados da prova</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      A prova e salva primeiro no banco; depois as questoes sao vinculadas a ela. O titulo deve seguir <strong>Banca - Ano - Orgao - Cargo/Prova</strong>.
                    </p>
                  </div>
                  <span className="rounded-sm bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {metadataTitle || examTitlePreview || 'Titulo pendente'}
                  </span>
                </div>
                <label className="block space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Titulo da prova</span>
                  <input
                    type="text"
                    value={hasManualMetadataTitle ? metadataTitle : examTitlePreview}
                    onChange={(event) => onImportMetadataChange('title', event.target.value)}
                    placeholder="Ex.: EXATUS - 2014 - PM-RJ - Soldado da Policia Militar"
                    className={`h-10 text-xs font-bold ${ADMIN_FIELD_CLASS}`}
                  />
                  <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Se ficar em branco, o sistema usa automaticamente Banca - Ano - Orgao - Cargo/Prova.
                  </span>
                </label>
                <div className="grid gap-3 md:grid-cols-4">
                  {([
                    ['agency', 'Banca', 'Ex.: EXATUS, IBADE, FGV'],
                    ['year', 'Ano', 'Ex.: 2025'],
                    ['level', 'Nível', 'Ex.: Médio, Superior'],
                    ['examType', 'Categoria', 'Concurso ou ENEM'],
                    ['bookletType', 'Tipo/Caderno', 'Ex.: Tipo B, Caderno 1'],
                    ['bookletColor', 'Cor do caderno', 'Ex.: Amarelo, Azul'],
                    ['caderno', 'Resumo do caderno', 'Ex.: Tipo B - Azul'],
                    ['totalQuestions', 'Total de questões', 'Ex.: 80'],
                    ['registrationStart', 'Inscrição - início', 'Ex.: 2026-03-01'],
                    ['registrationEnd', 'Inscrição - fim', 'Ex.: 2026-03-20'],
                    ['examDate', 'Data da prova', 'Ex.: 2026-05-10'],
                    ['registrationFee', 'Valor da inscrição', 'Ex.: R$ 120,00'],
                  ] as Array<[ImportMetadataField, string, string]>).map(([field, label, placeholder]) => (
                    <label key={field} className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                      <input
                        type="text"
                        value={asText(metadata[field])}
                        onChange={(event) => onImportMetadataChange(field, event.target.value)}
                        placeholder={placeholder}
                        className={`h-10 text-xs font-bold ${ADMIN_FIELD_CLASS}`}
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {([
                    ['sources', 'Órgãos vinculados', 'Um órgão por linha. Ex.: PM-PB\\nCBM-PB'],
                    ['roles', 'Cargos/provas vinculados', 'Um cargo por linha. Ex.: Soldado PM\\nSoldado BM'],
                    ['requirementsDetailed', 'Requisitos', 'JSON ou linhas estruturadas extraídas do edital'],
                    ['remunerationsDetailed', 'Remuneração', 'JSON ou linhas estruturadas extraídas do edital'],
                    ['vacanciesDetailed', 'Vagas', 'JSON ou linhas estruturadas extraídas do edital'],
                    ['stages', 'Etapas', 'JSON com nome, critério, data e observação'],
                    ['programmaticContentDetailed', 'Conteúdo programático', 'JSON com matéria, tópico, assunto e questões esperadas'],
                    ['platformQuestionIds', 'Questões da plataforma vinculadas', 'IDs de questões já vinculadas à prova'],
                  ] as Array<[ImportMetadataField, string, string]>).map(([field, label, placeholder]) => (
                    <label key={field} className={field === 'programmaticContentDetailed' ? 'space-y-1 md:col-span-2' : 'space-y-1'}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                      <textarea
                        value={stringifyMetadataField(metadata[field])}
                        onChange={(event) => onImportMetadataChange(field, event.target.value)}
                        placeholder={placeholder}
                        className={`min-h-24 text-xs font-semibold ${ADMIN_FIELD_CLASS}`}
                      />
                    </label>
                  ))}
                </div>
                <div className="space-y-2 rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="bulk-import-subjects" className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Materias disponiveis na prova (array)
                    </label>
                    <span className="rounded-sm bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      {subjectsForDisplay.length} item(ns)
                    </span>
                  </div>
                  <textarea
                    id="bulk-import-subjects"
                    value={subjectsForDisplay.join(', ')}
                    onChange={(event) => onImportMetadataChange('subjects', event.target.value)}
                    placeholder="Ex.: Matemática, Física, Português"
                    className={`min-h-20 text-xs font-semibold ${ADMIN_FIELD_CLASS}`}
                  />
                  {subjectsForDisplay.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {subjectsForDisplay.map((subject) => (
                        <span key={subject} className="rounded-sm border border-sky-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-sky-700 dark:border-sky-900/40 dark:bg-slate-900 dark:text-sky-300">
                          {subject}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                </>
                )}
              </div>
              )}

              {!cardsOnly && effectiveReviewTab === 'contexts' && (
                <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-3 p-4`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Contextos e figuras extraidos
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Crie textos de apoio compartilhados e vincule as questoes corretas.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="rounded-sm bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {figureContexts.length} figura(s)
                      </span>
                      <button
                        type="button"
                        onClick={onExtractedContextAdd}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-sky-600 bg-sky-600 px-3 text-[9px] font-black uppercase tracking-widest text-white transition-colors hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-600 dark:hover:bg-sky-500"
                      >
                        <Plus size={13} />
                        Adicionar contexto
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {extractedContexts.map((context) => {
                      const explicitQuestionNumbers = getExplicitContextQuestionNumbers(
                        context.title,
                        context.text,
                        context.referenceText,
                      );
                      const linkedQuestionNumbers = [...context.questionNumbers].sort((left, right) => left - right);
                      const explicitLinkMismatch = explicitQuestionNumbers.length > 0 && (
                        explicitQuestionNumbers.length !== linkedQuestionNumbers.length
                        || explicitQuestionNumbers.some((number, index) => linkedQuestionNumbers[index] !== number)
                      );

                      return (
                      <div key={context.tempId} className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <label className="block space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Titulo do contexto</span>
                              <input
                                value={context.title || ''}
                                onChange={(event) => onExtractedContextFieldChange(context.tempId, 'title', event.target.value)}
                                placeholder="Ex.: Texto de apoio da questao 12"
                                className={`h-9 text-[11px] font-black ${ADMIN_FIELD_CLASS}`}
                              />
                            </label>
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Pag. {context.page || '-'} · Questoes {context.questionNumbers.length ? context.questionNumbers.join(', ') : 'sem vinculo'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {context.hasFigure && (
                              <span className="rounded-sm bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                Figura
                              </span>
                            )}
                            <label className="cursor-pointer rounded-sm border border-violet-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-900/20">
                              Inserir figura
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  void handleContextImageUpload(context.tempId, event.target.files?.[0] || null);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtractedContext(context)}
                              className="inline-flex items-center justify-center gap-1 rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
                              aria-label={`Excluir contexto ${context.title || context.tempId}`}
                            >
                              <Trash2 size={11} />
                              Excluir contexto
                            </button>
                          </div>
                        </div>
                        <label className="mt-3 block space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Texto do contexto</span>
                          <RichTextEditor
                            initialValue={renderContextTextWithInlineFigures(context)}
                            onChange={(html) => onExtractedContextFieldChange(context.tempId, 'text', html)}
                            placeholder="Texto de apoio, comando compartilhado ou descricao complementar."
                            allowImages
                            contentClassName="min-h-36 max-h-96 text-[11px] font-medium leading-relaxed"
                          />
                        </label>
                        <label className="mt-3 block space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Fonte / referência</span>
                          <textarea
                            value={context.referenceText || ''}
                            onChange={(event) => onExtractedContextFieldChange(context.tempId, 'referenceText', event.target.value)}
                            rows={2}
                            placeholder="Fonte, autor, obra, URL, adaptação ou data de acesso."
                            className={`${ADMIN_FIELD_CLASS} resize-y text-[11px] font-medium leading-relaxed`}
                          />
                        </label>
                        {explicitLinkMismatch && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            <div className="flex min-w-0 items-start gap-2">
                              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                              <p className="text-[10px] font-bold leading-relaxed">
                                O próprio contexto indica as questões {explicitQuestionNumbers.join(', ')}, mas o vínculo atual está diferente.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onExtractedContextQuestionNumbersChange(context.tempId, explicitQuestionNumbers)}
                              className="inline-flex h-8 shrink-0 items-center justify-center rounded-sm border border-amber-300 bg-white px-3 text-[9px] font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950"
                            >
                              Aplicar vínculo indicado
                            </button>
                          </div>
                        )}
                        <div className="mt-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Vincular a questoes</p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onExtractedContextQuestionNumbersChange(context.tempId, questionLinkOptions.map((question) => question.number))}
                                className="text-[9px] font-black uppercase text-sky-700 hover:text-sky-900 dark:text-sky-300"
                              >
                                Todas
                              </button>
                              <button
                                type="button"
                                onClick={() => onExtractedContextQuestionNumbersChange(context.tempId, [])}
                                className="text-[9px] font-black uppercase text-red-600 hover:text-red-800 dark:text-red-300"
                              >
                                Limpar
                              </button>
                            </div>
                          </div>
                          <div className="grid max-h-40 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                            {questionLinkOptions.map((question) => {
                              const checked = context.questionNumbers.includes(question.number);
                              return (
                                <label key={`${context.tempId}-${question.index}`} className="flex cursor-pointer items-center gap-2 rounded-sm border border-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const nextNumbers = event.target.checked
                                        ? [...context.questionNumbers, question.number]
                                        : context.questionNumbers.filter((number) => number !== question.number);
                                      onExtractedContextQuestionNumbersChange(context.tempId, nextNumbers);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                                  />
                                  <span>{question.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        {(context.hasFigure || context.figureDescription || context.imageData) && (
                          <label className="mt-3 block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-violet-500">Descricao da figura</span>
                            <textarea
                              value={context.figureDescription || ''}
                              onChange={(event) => onExtractedContextFieldChange(context.tempId, 'figureDescription', event.target.value)}
                              rows={3}
                              className={`${ADMIN_FIELD_CLASS} resize-y border-violet-200 text-[11px] font-semibold leading-relaxed text-violet-800 dark:border-violet-900/40 dark:text-violet-200`}
                            />
                          </label>
                        )}
                        {getImageDataUri(context.imageData) && !contextHasInlineFigureHtml(context) && (
                          <div className="relative mt-3 h-48 w-full overflow-hidden rounded-sm border border-slate-200 dark:border-slate-800">
                            <Image
                              key={`${context.tempId}-${String(context.imageData || '').slice(0, 32)}`}
                              src={getImageDataUri(context.imageData)}
                              alt={context.figureDescription || context.title || 'Figura extraida da prova'}
                              fill
                              sizes="(min-width: 1280px) 360px, 100vw"
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                        {context.pageImageData && (
                          <details className="mt-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300">
                              <span>Ajustar recorte da figura</span>
                              {context.manualCropApplied && (
                                <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                                  Recorte aplicado
                                </span>
                              )}
                            </summary>
                            <div className="mt-3 space-y-3">
                              <FigureCropSelector
                                key={`${context.tempId}-${readContextCropDraft(context).x}-${readContextCropDraft(context).y}-${readContextCropDraft(context).width}-${readContextCropDraft(context).height}`}
                                imageData={context.pageImageData}
                                cropDraft={readContextCropDraft(context)}
                                onChange={(box) => setContextCropDraftBox(context, box)}
                                onApply={(box) => applyContextCropDraft(context, box)}
                              />
                              <div className="grid gap-2 sm:grid-cols-3">
                                <button
                                  type="button"
                                  onClick={() => writeContextCropDraft(context, (box) => ({
                                    x: box.x - 18,
                                    y: box.y - 18,
                                    width: box.width + 36,
                                    height: box.height + 36,
                                  }))}
                                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                                >
                                  + Margem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => writeContextCropDraft(context, (box) => ({
                                    x: box.x + 18,
                                    y: box.y + 18,
                                    width: box.width - 36,
                                    height: box.height - 36,
                                  }))}
                                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                                >
                                  - Margem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => writeContextCropDraft(context, () => ({
                                    x: 0,
                                    y: 0,
                                    width: 1000,
                                    height: 1000,
                                  }))}
                                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                                >
                                  Pagina inteira
                                </button>
                              </div>
                              <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                O recorte e salvo no contexto da questao e pode ser reajustado antes de publicar.
                              </p>
                            </div>
                          </details>
                        )}
                      </div>
                      );
                    })}
                    {extractedContexts.length === 0 && (
                      <div className="rounded-sm border border-dashed border-slate-300 p-4 text-center text-xs font-semibold text-slate-400 dark:border-slate-700">
                        Nenhum item extraido para este filtro.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!cardsOnly && (
              <>
              {aiLimitReached && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-black uppercase tracking-widest">Limite de chamadas de IA atingido</p>
                      <p className="font-semibold">
                        {importDiagnostics.aiLimitMessage || `Foram usadas ${aiCallCount}/${aiCallLimit || aiCallCount} chamada(s) de IA. Algumas páginas precisavam de leitura visual/OCR e ficaram pendentes.`}
                      </p>
                      {aiLimitedPages.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas com fallback visual bloqueado pelo limite: {aiLimitedPages.join(', ')}.
                        </p>
                      )}
                      {pagesWithoutNativeText.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas sem texto nativo suficiente: {pagesWithoutNativeText.join(', ')}. Nesses casos, o parser mecânico só consegue extrair algo se houver OCR/texto legível disponível.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {aiQuotaLimitReached && (
                <div className="rounded-sm border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-black uppercase tracking-widest">Cota da IA excedida</p>
                      <p className="font-semibold">
                        {importDiagnostics.aiQuotaLimitMessage || 'O provedor de IA retornou limite de cota. O importador pausou novas chamadas e continuou com PDF.js/parser mecânico.'}
                      </p>
                      {aiQuotaLimitPages.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas afetadas pela cota da IA: {aiQuotaLimitPages.join(', ')}.
                        </p>
                      )}
                      {pagesWithoutNativeText.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas sem texto nativo suficiente: {pagesWithoutNativeText.join(', ')}. Se o PDF for escaneado e a cota estiver esgotada, essas páginas ficam pendentes para nova tentativa com OCR/IA visual.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {aiTokenLimitReached && (
                <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-black uppercase tracking-widest">Limite de tokens/contexto da IA</p>
                      <p className="font-semibold">
                        {importDiagnostics.aiTokenLimitMessage || 'A IA recusou parte da leitura por limite de tokens/contexto. O importador manteve a extração mecânica e sinalizou o que precisa de revisão.'}
                      </p>
                      {aiTokenLimitPages.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas afetadas pelo limite de tokens/contexto: {aiTokenLimitPages.join(', ')}.
                        </p>
                      )}
                      {pagesWithoutNativeText.length > 0 && (
                        <p className="break-words text-[11px] font-medium">
                          Páginas sem texto nativo suficiente: {pagesWithoutNativeText.join(', ')}. Se uma página escaneada não tiver OCR, o parser mecânico não tem texto para recuperar sozinho.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {localizedIncompleteQuestionNumbers.length > 0 && (
                <div className="rounded-sm border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <div className="min-w-0 space-y-1">
                      <p className="font-black uppercase tracking-widest">Questões localizadas, mas incompletas</p>
                      <p className="break-words font-semibold">
                        {localizedIncompleteQuestionNumbers.slice(0, 80).join(', ')}{localizedIncompleteQuestionNumbers.length > 80 ? '...' : ''}
                      </p>
                      <p className="text-[11px] font-medium">
                        O número e parte real dessas questões foram encontrados. Elas permanecem na revisão para completar alternativas, gabarito ou outros campos obrigatórios.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {duplicateQuestionNumbers.length > 0 && (
                <div className="rounded-sm border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100">
                  <p className="font-black uppercase tracking-widest">Numeração duplicada para revisão</p>
                  <p className="mt-1 break-words font-semibold">{duplicateQuestionNumbers.join(', ')}</p>
                </div>
              )}

              {visualPendingQuestionNumbers.length > 0 && (
                <div className="rounded-sm border border-fuchsia-200 bg-fuchsia-50 p-3 text-xs text-fuchsia-900 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20 dark:text-fuchsia-100">
                  <p className="font-black uppercase tracking-widest">Pendências visuais</p>
                  <p className="mt-1 break-words font-semibold">{visualPendingQuestionNumbers.join(', ')}</p>
                  <p className="mt-1 text-[11px] font-medium">Essas questões foram localizadas, mas ainda exigem figura, recorte ou validação visual.</p>
                </div>
              )}

              {orphanContentBlocks.length > 0 && (
                <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <p className="font-black uppercase tracking-widest">Blocos ainda sem classificação</p>
                  <p className="mt-1 text-[11px] font-medium">
                    {orphanContentBlocks.length} bloco(s) foram preservados para diagnóstico; nenhum conteúdo órfão foi descartado automaticamente.
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-black uppercase text-sky-700 dark:text-sky-300">Ver blocos</summary>
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {orphanContentBlocks.slice(0, 30).map((block) => (
                        <p key={block.id} className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-950">
                          Pág. {block.pageNumber}: {block.text}
                        </p>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {trulyMissingQuestionNumbers.length > 0 && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-black uppercase tracking-widest">Questões realmente não localizadas</p>
                      <p className="mt-1 break-words font-semibold">{trulyMissingQuestionNumbers.slice(0, 80).join(', ')}{trulyMissingQuestionNumbers.length > 80 ? '...' : ''}</p>
                      <p className="mt-2 text-[11px] font-medium">
                        Nenhum conteúdo real foi localizado para esses números. Os placeholders continuam editáveis na revisão. Cobertura localizada: {extractedUniqueTotal}/{expectedTotal || extractedUniqueTotal}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onRetryMissingQuestions}
                      disabled={retryMissingBlocked}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-sm border border-amber-500 bg-amber-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-600/60 disabled:opacity-60"
                    >
                      {isRetryingMissingQuestions ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
                      Tentar gerar faltantes
                    </button>
                  </div>
                </div>
              )}

              {(isBulkGenerating || isRetryingMissingQuestions) && (
                <div className={`${ADMIN_PAGE_PANEL_CLASS} animate-fade-in px-6 py-4`}>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase text-sky-700 dark:text-sky-300">
                      {isRetryingMissingQuestions ? <RefreshCw size={12} /> : <Sparkles size={12} />}
                      {isRetryingMissingQuestions
                        ? 'Tentando gerar faltantes'
                        : bulkGenerationType === 'detailed'
                          ? 'Gerando análises detalhadas em massa'
                          : 'Gerando comentários do professor em massa'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{bulkProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-sky-700 transition-all duration-300 dark:bg-sky-500" style={{ width: `${bulkProgress}%` }} />
                  </div>
                </div>
              )}

              </>
              )}

              {(effectiveReviewTab === 'questions' || effectiveReviewTab === 'pending') && (
              <div className={`no-scrollbar flex-1 space-y-4 ${cardsOnly ? 'max-h-none overflow-visible pr-0' : 'max-h-[800px] overflow-y-auto pr-2'}`}>
                {effectiveReviewTab === 'pending' && pendingAlternativeQuestions.length === 0 && (
                  <div className={`${ADMIN_PAGE_PANEL_CLASS} p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400`}>
                    Nenhuma questao pendente de alternativas.
                  </div>
                )}
                {questionsForReview.map(({ question, index }) => {
                  const questionNumber = getQuestionNumber(question, index + 1);
                  const linkedContexts = findQuestionContexts(question, index, extractedContexts);
                  const options = getQuestionOptions(question);
                  const correctIndex = getCorrectOptionIndex(question);
                  const hasMissingOptions = getFilledQuestionOptionsCount(question) < getQuestionExpectedOptionsCount(question);
                  const placeholder = isPlaceholderQuestionPreview(question);
                  const questionReadyForPublication = isQuestionReadyForPublicationPreview(question);
                  const probablePages = getQuestionProbablePages(question);
                  const qualityReasons = getQuestionQuality(question)?.reasons || question.statusReasons || [];
                  const hasStoredAnswer = Number.isInteger(Number(question.correctOptionIndex))
                    || Number(question.resposta || 0) > 0;
                  const queueStatus = reviewQuestionQueueStatuses?.[index];
                  const isQuestionPublished = publishedQuestionSet.has(questionNumber) || queueStatus === 'published';
                  const publishQuestionAction = `question:${questionNumber}` as const;
                  const isPublicationPending = queueStatus === 'queued' || queueStatus === 'processing';
                  const singlePublishBlocked = isPublishing || (!cardsOnly && !publishedExam) || !questionReadyForPublication || isQuestionPublished || isPublicationPending;
                  const isQuestionSelectable = Boolean(
                    cardsOnly
                    && onReviewQuestionSelectionChange
                    && (reviewAllowIncompleteSelection || questionReadyForPublication)
                    && !isQuestionPublished
                    && !isPublicationPending,
                  );
                  const isQuestionSelected = Boolean(reviewSelectedQuestionIndexes?.has(index));
                  const isCardExpanded = !cardsOnly || expandedReviewQuestionIndexes.has(index);
                  const introText = getQuestionIntroText(question);
                  const referenceText = getQuestionReferenceText(question);
                  const supportImages = getQuestionSupportImages(question);
                  const statementAssets = getQuestionStatementAssets(question);
                  const showIntroBlock = Boolean(introText) || supportImages.length > 0 || editingIntroTextIndex === index;
                  const showReferenceBlock = Boolean(referenceText) || editingReferenceTextIndex === index;
                  const hasSharedContext = linkedContexts.length > 0;
                  const hasIndividualSupport = Boolean(introText || supportImages.length > 0);
                  const taxonomyGroups = getQuestionTaxonomyGroups(question);
                  const subjectLabels = taxonomyGroups.subjects
                    .map(getQuestionTaxonomyItemName)
                    .filter(Boolean);
                  const topicLabels = taxonomyGroups.topics
                    .map(getQuestionTaxonomyItemName)
                    .filter(Boolean);
                  const subtopicLabels = taxonomyGroups.subtopics
                    .map(getQuestionTaxonomyItemName)
                    .filter(Boolean);
                  const hasFigureResource = Boolean(
                    question.hasFigure
                    || question.figureBox
                    || question.supportFigureBox
                    || question.optionFigureBox
                    || statementAssets.length > 0
                    || supportImages.length > 0
                    || linkedContexts.some((context) => context.hasFigure || context.imageData || context.figureBox),
                  );
                  const missingResourceReasons = qualityReasons.filter((reason) => [
                    'contexto_referenciado_nao_encontrado',
                    'texto_apoio_referenciado_nao_encontrado',
                    'figura_referenciada_nao_encontrada',
                    'tabela_referenciada_nao_encontrada',
                    'figura_sem_recorte',
                    'tabela_visual_sem_recorte',
                    'contexto_vinculo_ambiguo',
                  ].includes(reason));

                  return (
                  <div
                    key={index}
                    className={`group relative overflow-hidden rounded-sm border p-6 transition-colors ${
                      placeholder
                        ? 'border-amber-300 bg-amber-50/40 hover:border-amber-500 dark:border-amber-900/50 dark:bg-amber-950/10'
                        : 'border-slate-300 bg-white hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700'
                    }`}
                  >
                    <div className={`absolute left-0 top-0 h-full w-1 transition-colors ${
                      placeholder
                        ? 'bg-amber-500'
                        : 'bg-slate-200 group-hover:bg-sky-700 dark:bg-slate-800 dark:group-hover:bg-sky-500'
                    }`} />
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {cardsOnly && onReviewQuestionSelectionChange && (
                          <label
                            className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                              isQuestionSelectable
                                ? 'cursor-pointer border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-300'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600'
                            }`}
                            title={isQuestionSelectable
                              ? (questionReadyForPublication
                                ? 'Selecionar para publicação em lote'
                                : 'Selecionar para revisão; a publicação continuará bloqueada até a questão ficar completa')
                              : 'Esta questão já foi publicada ou está em processamento'}
                          >
                            <input
                              type="checkbox"
                              checked={isQuestionSelected}
                              disabled={!isQuestionSelectable}
                              onChange={(event) => onReviewQuestionSelectionChange(index, event.target.checked)}
                              className="h-3.5 w-3.5 accent-sky-700"
                            />
                            Selecionar
                          </label>
                        )}
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900 text-xs font-black text-white dark:bg-sky-700">
                          {questionNumber}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {cardsOnly && (
                            <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              Item #{reviewQueueIndexOffset + index + 1}
                            </span>
                          )}
                          {cardsOnly && reviewSourceLabel && (
                            <span className="max-w-[22rem] truncate rounded-sm border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300" title={reviewSourceLabel}>{reviewSourceLabel}</span>
                          )}
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {question.bancas?.map((banca) => banca.sigla || banca.name).join(' / ') || 'Banca N/I'}
                          </span>
                          <span className="rounded-sm bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            {subjectLabels.join(' / ') || 'Materia N/I'}
                          </span>
                          {topicLabels.length > 0 && (
                            <span className="rounded-sm bg-violet-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              Tópico: {topicLabels.join(' / ')}
                            </span>
                          )}
                          <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {subtopicLabels.length > 0 ? `Assunto: ${subtopicLabels.join(' / ')}` : 'Assunto N/I'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {(question.anulada || question.isCanceled) && <span className="rounded bg-red-100 px-2 py-0.5 text-[8px] font-black uppercase text-red-700 dark:bg-red-900/40 dark:text-red-400">Anulada</span>}
                        {(question.desatualizada || question.isOutdated) && <span className="rounded bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Desat.</span>}
                        {isQuestionPublished && <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">Publicada</span>}
                        {!isQuestionPublished && questionReadyForPublication && !queueStatus && <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">Pronta</span>}
                        {queueStatus === 'queued' && <span className="rounded-sm border border-sky-300 bg-sky-50 px-2 py-1 text-[9px] font-black uppercase text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">Na fila</span>}
                        {queueStatus === 'processing' && <span className="rounded-sm border border-sky-300 bg-sky-50 px-2 py-1 text-[9px] font-black uppercase text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">Processando</span>}
                        {queueStatus === 'failed' && <span className="rounded-sm border border-red-300 bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">Falhou</span>}
                        {placeholder && <span className="rounded-sm border border-amber-400 bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Pendente · não localizada</span>}
                        {!placeholder && !questionReadyForPublication && <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">Incompleta</span>}
                        <div className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase ${
                          hasStoredAnswer
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {hasStoredAnswer ? `Gabarito: ${String.fromCharCode(65 + correctIndex)}` : 'Gabarito pendente'}
                        </div>
                        {hasMissingOptions && (
                          <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">
                            Revisar alternativas
                          </span>
                        )}
                        {!placeholder && questionReadyForPublication && !isQuestionPublished && (
                          <button
                            type="button"
                            onClick={() => onMarkExtractedQuestionReviewed(index)}
                            className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            title="Marcar esta questão como revisada para publicação"
                          >
                            Revisado
                          </button>
                        )}
                        {cardsOnly && (
                          <button
                            type="button"
                            onClick={() => setExpandedReviewQuestionIndexes((previous) => {
                              const next = new Set(previous);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            })}
                            className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            <ChevronDown className={`transition-transform ${isCardExpanded ? 'rotate-180' : ''}`} size={13} />
                            {isCardExpanded ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}
                          </button>
                        )}
                        {cardsOnly && onReviewQuestionPublishRequest && !isQuestionPublished && (
                          <button
                            type="button"
                            onClick={() => onReviewQuestionPublishRequest(index)}
                            disabled={singlePublishBlocked}
                            className="inline-flex items-center gap-1 rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                          >
                            {queueStatus === 'processing' ? <Loader2 className="animate-spin" size={12} /> : <FileCheck size={12} />}
                            Publicar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditExtractedQuestion(question, index)}
                          className="rounded-sm border border-slate-300 bg-white p-1.5 text-slate-500 transition-colors hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-sky-300"
                          title="Editar Questao Extraida"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExtractedQuestion(index)}
                          className="rounded-sm border border-red-200 bg-white p-1.5 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30"
                          title="Excluir do lote"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {cardsOnly && !isCardExpanded && (
                      <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="line-clamp-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                          {getQuestionStatementSummary(question)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          <span>{options.length} alternativa(s)</span>
                          <span>{hasSharedContext ? 'Com contexto' : hasIndividualSupport ? 'Com apoio individual' : 'Sem contexto'}</span>
                          <span>{hasFigureResource ? 'Com recurso visual' : 'Sem recurso visual'}</span>
                        </div>
                      </div>
                    )}

                    {isCardExpanded && (
                    <>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Briefcase size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.cargos?.map((role) => role.descricao || role.name).join(', ') || question.role || 'Cargo Geral'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Calendar size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.anos?.join(', ') || question.year || '2024'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Layers size={12} />
                        <span className="text-[10px] font-bold uppercase">{getQuestionLevelText(question.nivel || question.level)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <TrendingUp size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.dificuldade === 1 ? 'Facil' : question.dificuldade === 3 ? 'Dificil' : 'Media'}</span>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {hasSharedContext && (
                        <span className="rounded-sm border border-sky-200 bg-sky-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">
                          Contexto compartilhado
                        </span>
                      )}
                      {hasIndividualSupport && (
                        <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Texto de apoio individual
                        </span>
                      )}
                      {hasFigureResource && (
                        <span className="rounded-sm border border-violet-200 bg-violet-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-300">
                          Figura/recurso visual
                        </span>
                      )}
                    </div>

                    {missingResourceReasons.length > 0 && (
                      <div className="mb-3 flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 p-3 text-[11px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                        <div>
                          <p className="font-black uppercase tracking-widest">Recurso necessário não localizado</p>
                          <p className="mt-1">
                            A questão menciona texto, contexto, figura ou tabela sem material associado. Vincule um contexto, adicione texto de apoio ou insira/recorte a figura antes de publicar.
                          </p>
                        </div>
                      </div>
                    )}

                    {placeholder && (
                      <div className="mb-4 rounded-sm border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-100">
                        <p className="text-[10px] font-black uppercase tracking-widest">Completar manualmente</p>
                        <p className="mt-1 text-xs font-semibold">A questão {questionNumber} existe na numeração esperada, mas seu conteúdo não foi localizado automaticamente.</p>
                        {probablePages.length > 0 && (
                          <p className="mt-2 text-[10px] font-bold">Página provável: {probablePages.join('–')}</p>
                        )}
                        {qualityReasons.length > 0 && (
                          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                            Pendências: {qualityReasons.map((reason) => reason.replace(/_/g, ' ')).join(', ')}.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mb-4 rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                      <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Filtros da questao</p>
                      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                        {([
                          ['subject', 'Materia', getQuestionSubject(question)],
                          ['topic', 'Topico', getQuestionTopic(question)],
                          ['specificSubject', 'Assunto', getQuestionSpecificSubject(question)],
                          ['agency', 'Banca', question.bancas?.map((banca) => getTaxonomyLabel(banca)).filter(Boolean).join(', ') || ''],
                          ['organization', 'Orgao', question.orgaos?.map((orgao) => getTaxonomyLabel(orgao)).filter(Boolean).join(', ') || ''],
                          ['role', 'Cargo/Prova', question.cargos?.map((role) => role.descricao || role.name).filter(Boolean).join(', ') || asText(question.role)],
                          ['year', 'Ano', question.anos?.join(', ') || asText(question.year)],
                          ['level', 'Nivel', getQuestionLevelText(question.nivel || question.level)],
                          ['modality', 'Modalidade', question.tipo || 'multipla escolha'],
                        ] as Array<[ExtractedQuestionEditableField, string, string]>).map(([field, label, value]) => {
                          if (field === 'modality') {
                            return (
                              <label key={field} className="space-y-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                                <select
                                  value={
                                    asText(value).toLowerCase().includes('certo')
                                      ? 'certo ou errado'
                                      : asText(value).toLowerCase().includes('multipla')
                                        ? 'multipla escolha'
                                        : 'desconhecido'
                                  }
                                  onChange={(event) => onExtractedQuestionFieldChange(index, field, event.target.value)}
                                  className={`h-9 text-[11px] font-bold ${ADMIN_FIELD_CLASS}`}
                                >
                                  <option value="desconhecido">Selecionar modalidade</option>
                                  <option value="multipla escolha">Multipla escolha</option>
                                  <option value="certo ou errado">Certo ou errado</option>
                                </select>
                              </label>
                            );
                          }

                          return (
                            <label key={field} className="space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                              <input
                                type="text"
                                value={value}
                                onChange={(event) => onExtractedQuestionFieldChange(index, field, event.target.value)}
                                className={`h-9 text-[11px] font-bold ${ADMIN_FIELD_CLASS}`}
                              />
                            </label>
                          );
                        })}
                        <label className="space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Dificuldade</span>
                          <select
                            value={question.dificuldade === 1 ? 'Fácil' : question.dificuldade === 3 ? 'Difícil' : 'Média'}
                            onChange={(event) => onExtractedQuestionFieldChange(index, 'difficulty', event.target.value)}
                            className={`h-9 text-[11px] font-bold ${ADMIN_FIELD_CLASS}`}
                          >
                            <option value="Fácil">Fácil</option>
                            <option value="Média">Média</option>
                            <option value="Difícil">Difícil</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/30">
                      <span className="mr-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Adicionar/ajustar</span>
                      <button
                        type="button"
                        onClick={() => setEditingIntroTextIndex(index)}
                        className="rounded-sm border border-slate-200 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Texto de apoio
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingReferenceTextIndex(index)}
                        className="rounded-sm border border-amber-200 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                      >
                        Referencia
                      </button>
                      <button
                        type="button"
                        onClick={() => onExtractedQuestionContextAdd(index)}
                        className="rounded-sm border border-sky-200 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/20"
                      >
                        Contexto
                      </button>
                      <label className="cursor-pointer rounded-sm border border-violet-200 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50 dark:border-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/20">
                        Inserir figura de apoio
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            void handleSupportImageUpload(index, event.target.files?.[0] || null);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {showIntroBlock && (
                      <div className="mb-3 rounded-r-xl border-l-2 border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Texto de apoio</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingIntroTextIndex(editingIntroTextIndex === index ? null : index)}
                              className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              {editingIntroTextIndex === index ? 'Concluir' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onExtractedQuestionIntroTextChange(index, '');
                                setEditingIntroTextIndex(null);
                              }}
                              disabled={!getQuestionIntroText(question)}
                              className="rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                        {editingIntroTextIndex === index ? (
                          <RichTextEditor
                            initialValue={introText}
                            onChange={(html) => onExtractedQuestionIntroTextChange(index, html)}
                            placeholder="Texto de apoio da questao. Use a barra para formatar e inserir imagens entre os paragrafos."
                            allowImages
                            contentClassName="min-h-40 max-h-[28rem] text-sm font-medium leading-relaxed"
                          />
                        ) : (
                          introText ? (
                            <MathRichText
                              content={introText}
                              className="question-rich-html rounded-sm border border-slate-100 bg-white p-3 text-[12px] italic leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 [&_img]:max-h-96 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-sm [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:p-1"
                            />
                          ) : (
                            <p className="rounded-sm border border-slate-100 bg-white p-3 text-[12px] italic leading-relaxed text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                              Esta questao possui figura de apoio, mas nenhum texto de apoio preenchido.
                            </p>
                          )
                        )}
                        {supportImages.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {supportImages.map((supportImage, supportImageIndex) => (
                              <details
                                key={supportImage.tempId}
                                className="rounded-sm border border-violet-200 bg-white p-3 dark:border-violet-900/40 dark:bg-slate-900"
                              >
                                <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
                                  <span>{supportImage.title || `Figura de apoio ${supportImageIndex + 1}`}</span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      onExtractedQuestionSupportImageRemove(index, supportImage.tempId);
                                    }}
                                    className="rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-300"
                                  >
                                    Remover
                                  </button>
                                </summary>
                                {supportImage.description && (
                                  <p className="mt-2 whitespace-pre-line text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                    {supportImage.description}
                                  </p>
                                )}
                                {getImageDataUri(supportImage.imageData) && (
                                  <div className="relative mt-3 h-72 w-full overflow-hidden rounded-sm border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                                    <Image
                                      src={getImageDataUri(supportImage.imageData)}
                                      alt={supportImage.title || 'Figura de apoio da questao'}
                                      fill
                                      sizes="(min-width: 1280px) 720px, 100vw"
                                      className="object-contain"
                                      unoptimized
                                    />
                                  </div>
                                )}
                                {supportImage.pageImageData && (
                                  <div className="mt-3">
                                    <FigureCropSelector
                                      imageData={supportImage.pageImageData}
                                      cropDraft={readSupportImageCropDraft(index, supportImage)}
                                      onChange={(box) => setSupportImageCropDraftBox(index, supportImage, box)}
                                      onApply={(box) => applySupportImageCropDraft(index, supportImage, box)}
                                    />
                                  </div>
                                )}
                              </details>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {showReferenceBlock && (
                      <div className="mb-3 rounded-r-xl border-l-2 border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Referencia</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingReferenceTextIndex(editingReferenceTextIndex === index ? null : index)}
                              className="rounded-sm border border-amber-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-slate-900 dark:text-amber-300"
                            >
                              {editingReferenceTextIndex === index ? 'Concluir' : 'Editar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onExtractedQuestionReferenceTextChange(index, '');
                                setEditingReferenceTextIndex(null);
                              }}
                              className="rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-300"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                        {editingReferenceTextIndex === index ? (
                          <textarea
                            value={referenceText}
                            onChange={(event) => onExtractedQuestionReferenceTextChange(index, event.target.value)}
                            rows={Math.min(8, Math.max(3, Math.ceil(referenceText.length / 110)))}
                            className={`${ADMIN_FIELD_CLASS} min-h-20 w-full resize-y text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200`}
                          />
                        ) : (
                          <p className="whitespace-pre-line rounded-sm border border-amber-100 bg-white p-3 text-[11px] font-semibold leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-slate-900 dark:text-amber-200">
                            {referenceText}
                          </p>
                        )}
                      </div>
                    )}

                    {linkedContexts.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {linkedContexts.map((context) => (
                          <details key={context.tempId} className="rounded-sm border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900/40 dark:bg-sky-900/10">
                            <summary className="flex cursor-pointer items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                              <span>Contexto vinculado · {context.title || 'Texto de apoio'} {context.hasFigure ? '· Figura' : ''}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  handleRemoveExtractedContext(context);
                                }}
                                className="rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-300"
                              >
                                Excluir contexto
                              </button>
                            </summary>
                            {(
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-300">
                                    Conteudo do contexto
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingContextId(editingContextId === context.tempId ? null : context.tempId)}
                                    className="rounded-sm border border-sky-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-slate-900 dark:text-sky-300"
                                  >
                                    {editingContextId === context.tempId ? 'Concluir' : 'Editar'}
                                  </button>
                                </div>
                                {editingContextId === context.tempId ? (
                                  <RichTextEditor
                                    initialValue={renderContextTextWithInlineFigures(context)}
                                    onChange={(html) => onExtractedContextContentChange(context.tempId, html)}
                                    placeholder="Texto de apoio ou contexto compartilhado."
                                    allowImages
                                    contentClassName="min-h-40 max-h-[28rem] text-[11px] font-medium leading-relaxed"
                                  />
                                ) : (
                                  <MathRichText
                                    content={renderContextTextWithInlineFigures(context)}
                                    className="max-h-80 overflow-y-auto rounded-sm border border-sky-100 bg-white p-3 text-[11px] font-medium leading-relaxed text-slate-600 dark:border-sky-900/30 dark:bg-slate-900 dark:text-slate-300"
                                  />
                                )}
                              </div>
                            )}
                            {context.figureDescription && (
                              <p className="mt-2 rounded-sm border border-violet-200 bg-white p-2 text-[11px] font-semibold leading-relaxed text-violet-800 dark:border-violet-900/40 dark:bg-slate-900 dark:text-violet-200">
                                {context.figureDescription}
                              </p>
                            )}
                            {getImageDataUri(context.imageData) && !contextHasInlineFigureHtml(context) && (
                              <div className="relative mt-3 h-64 w-full overflow-hidden rounded-sm border border-slate-200 dark:border-slate-800">
                                <Image
                                  src={getImageDataUri(context.imageData)}
                                  alt={context.figureDescription || context.title || 'Figura vinculada'}
                                  fill
                                  sizes="(min-width: 1280px) 620px, 100vw"
                                  className="object-contain"
                                  unoptimized
                                />
                              </div>
                            )}
                          </details>
                        ))}
                      </div>
                    )}

                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Enunciado</span>
                        <button
                          type="button"
                          onClick={() => setEditingStatementIndex(editingStatementIndex === index ? null : index)}
                          className={ADMIN_SECONDARY_BUTTON_CLASS}
                        >
                          {editingStatementIndex === index ? 'Concluir' : 'Editar enunciado'}
                        </button>
                      </div>
                      {editingStatementIndex === index ? (
                        <textarea
                          value={getQuestionStatementPreview(question)}
                          onChange={(event) => onExtractedQuestionStatementChange(index, event.target.value)}
                          rows={Math.min(12, Math.max(4, Math.ceil(getQuestionStatementPreview(question).length / 110)))}
                          className={`${ADMIN_FIELD_CLASS} min-h-32 w-full resize-y text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-200`}
                        />
                      ) : (
                        getQuestionStatementPreview(question) || statementAssets.length > 0 ? (
                          <MathRichText
                            content={renderQuestionContentWithAssets(getQuestionStatementPreview(question), statementAssets)}
                            className="question-rich-html rounded-sm border border-slate-200 bg-white p-3 text-sm font-bold leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200"
                          />
                        ) : (
                          <p className="rounded-sm border border-slate-200 bg-white p-3 text-sm font-bold leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
                            Enunciado ainda não preenchido. Clique em “Editar enunciado” para completar.
                          </p>
                        )
                      )}
                    </div>

                    <div className="mb-4 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/30">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alternativas</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase text-slate-400">{options.length || 0} item(ns)</span>
                          <button
                            type="button"
                            onClick={() => {
                              onExtractedQuestionOptionAdd(index);
                              setEditingOptionKey(`${index}:${options.length}`);
                            }}
                            className="rounded-sm border border-sky-200 bg-sky-50 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300"
                          >
                            + Alternativa
                          </button>
                        </div>
                      </div>
                      {options.length > 0 ? (
                        <div className="space-y-2">
                          {options.map((option, optionIndex) => {
                            const visualOption = option as ExtractedOptionPreview;
                            const optionCropSourceImage = getOptionCropSourceImage(visualOption);
                            const optionCropKey = `${index}:${optionIndex}`;
                            const hasOptionImageEditor = Boolean(optionCropSourceImage);
                            const isOptionCropOpen = activeOptionCropKey === optionCropKey;
                            return (
                              <div
                                key={`${option.rotulo}-${optionIndex}`}
                                className={`rounded-sm border p-2 text-[11px] leading-relaxed ${
                                  optionIndex === correctIndex
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-200'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex gap-3">
                                  <span className="font-black">{option.rotulo || String.fromCharCode(65 + optionIndex)}</span>
                                  {editingOptionKey === `${index}:${optionIndex}` ? (
                                    <textarea
                                      value={option.corpo || ''}
                                      onChange={(event) => onExtractedQuestionOptionChange(index, optionIndex, event.target.value)}
                                      placeholder={`Digite o texto da alternativa ${option.rotulo || String.fromCharCode(65 + optionIndex)}`}
                                      rows={Math.min(6, Math.max(2, Math.ceil(String(option.corpo || '').length / 110)))}
                                      className="min-h-16 flex-1 resize-y border-0 bg-transparent p-0 font-medium leading-relaxed outline-none focus:ring-0"
                                    />
                                  ) : (
                                    hasRichAlternativeContent(option.corpo) ? (
                                      <MathRichText
                                        content={option.corpo || ''}
                                        className="min-w-0 flex-1 font-medium [&_img]:max-h-80 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-sm [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:p-1"
                                      />
                                    ) : (
                                      <span className="flex-1 whitespace-pre-line font-medium">{option.corpo || 'Alternativa sem texto. Clique em Editar para preencher.'}</span>
                                    )
                                  )}
                                  <div className="flex shrink-0 items-start gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onExtractedQuestionCorrectOptionChange(index, optionIndex)}
                                      className={`rounded-sm border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${
                                        optionIndex === correctIndex && hasStoredAnswer
                                          ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                                          : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400'
                                      }`}
                                      title="Definir como alternativa correta"
                                    >
                                      {optionIndex === correctIndex && hasStoredAnswer ? 'Correta' : 'Marcar correta'}
                                    </button>
                                    <label
                                      className="cursor-pointer rounded-sm border border-violet-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-violet-600 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-slate-950 dark:text-violet-300"
                                      title="Inserir figura nesta alternativa"
                                    >
                                      Figura
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                          void handleOptionImageUpload(index, optionIndex, event.target.files?.[0] || null);
                                          event.target.value = '';
                                        }}
                                      />
                                    </label>
                                    {hasOptionImageEditor && (
                                      <button
                                        type="button"
                                        onClick={() => setActiveOptionCropKey(isOptionCropOpen ? null : optionCropKey)}
                                        className={`rounded-sm border px-2 py-1 text-[8px] font-black uppercase tracking-widest transition-colors ${
                                          isOptionCropOpen
                                            ? 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200'
                                            : 'border-slate-200 bg-white text-slate-500 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400'
                                        }`}
                                        title="Ajustar recorte da figura desta alternativa"
                                      >
                                        <Crop size={11} className="mr-1 inline" />
                                        Recortar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setEditingOptionKey(editingOptionKey === `${index}:${optionIndex}` ? null : `${index}:${optionIndex}`)}
                                      className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                                    >
                                      {editingOptionKey === `${index}:${optionIndex}` ? 'OK' : 'Editar'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onExtractedQuestionOptionRemove(index, optionIndex);
                                        setEditingOptionKey(null);
                                      }}
                                      className="rounded-sm border border-red-200 bg-white p-1.5 text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-400 dark:hover:bg-red-950/30"
                                      title="Remover alternativa"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                                {hasOptionImageEditor && isOptionCropOpen && (
                                  <div className="mt-3 rounded-sm border border-sky-200 bg-white p-3 shadow-sm dark:border-sky-900/50 dark:bg-slate-950">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                                          Ajustar figura da alternativa {option.rotulo || String.fromCharCode(65 + optionIndex)}
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                          Arraste o retangulo azul e aplique para substituir a imagem desta alternativa.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setActiveOptionCropKey(null)}
                                        className="rounded-sm border border-slate-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                                      >
                                        Fechar
                                      </button>
                                    </div>
                                    <FigureCropSelector
                                      imageData={optionCropSourceImage}
                                      cropDraft={readOptionImageCropDraft(index, optionIndex, visualOption)}
                                      onChange={(box) => setOptionImageCropDraftBox(index, optionIndex, visualOption, box)}
                                      onApply={(box) => applyOptionImageCropDraft(index, optionIndex, visualOption, box)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                          <p>Alternativas nao foram extraidas corretamente. Adicione manualmente antes de publicar.</p>
                          <button
                            type="button"
                            onClick={() => {
                              onExtractedQuestionOptionAdd(index);
                              setEditingOptionKey(`${index}:${options.length}`);
                            }}
                            className="rounded-sm border border-amber-300 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-slate-950 dark:text-amber-300"
                          >
                            + Adicionar alternativa
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onGenerateSpecific(index, 'teacher')}
                        disabled={!!generatingSpecific || isBulkGenerating}
                        className="flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                      >
                        {generatingSpecific?.index === index && generatingSpecific.type === 'teacher' ? <Loader2 className="animate-spin" size={12} /> : <GraduationCap size={12} />}
                        {getTeacherCommentPreview(question) ? 'Regerar Professor' : 'Gerar Professor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateSpecific(index, 'detailed')}
                        disabled={!!generatingSpecific || isBulkGenerating}
                        className="flex items-center gap-1.5 rounded-sm border border-sky-300 bg-sky-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                      >
                        {generatingSpecific?.index === index && generatingSpecific.type === 'detailed' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        {getDetailedCommentPreview(question) ? 'Regerar Detalhado' : 'Gerar Detalhado'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (cardsOnly && onReviewQuestionPublishRequest) onReviewQuestionPublishRequest(index);
                          else onPublishQuestion(index);
                        }}
                        disabled={singlePublishBlocked}
                        className="ml-auto flex items-center gap-1.5 rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        title={!cardsOnly && !publishedExam ? 'Publique a prova antes de publicar questoes.' : undefined}
                      >
                        {publishingAction === publishQuestionAction ? <Loader2 className="animate-spin" size={12} /> : <FileCheck size={12} />}
                        {isQuestionPublished ? 'Publicado' : 'Postar Questao'}
                      </button>
                    </div>

                    {getTeacherCommentPreview(question) && (
                      <div className="mt-4 animate-fade-in space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 opacity-80 group-hover:opacity-100 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <BookOpen size={14} /> Comentario do Professor
                        </p>
                        <p className="font-medium italic leading-relaxed">{getTeacherCommentPreview(question)}</p>
                      </div>
                    )}

                    {getDetailedCommentPreview(question) && (
                      <div className="mt-2 animate-fade-in space-y-2 rounded-sm border border-sky-300 bg-sky-50 p-4 text-xs text-sky-800 opacity-80 group-hover:opacity-100 dark:border-sky-900/30 dark:bg-sky-900/10 dark:text-sky-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <Sparkles size={14} /> Analise Detalhada (IA)
                        </p>
                        <MathRichText content={getDetailedCommentPreview(question)} disableCallouts className="max-h-72 overflow-y-auto rounded-sm bg-white/70 p-3 text-[11px] font-medium leading-relaxed text-slate-700 dark:bg-slate-950/20 dark:text-slate-200" />
                      </div>
                    )}
                    </>
                    )}
                  </div>
                  );
                })}
              </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-4 rounded-md border-2 border-dashed border-slate-200 bg-white p-20 text-center transition-colors dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-full bg-slate-50 p-8 text-slate-300 dark:bg-slate-800 dark:text-slate-700">
                {isProcessing ? <Loader2 size={64} className="animate-spin text-sky-600 dark:text-sky-400" /> : <FileText size={80} />}
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
                  {isProcessing ? 'Revisao em tempo real' : 'Aguardando Arquivos'}
                </h3>
                <p className="mx-auto max-w-xs text-sm font-medium text-slate-400 dark:text-slate-500">
                  {isProcessing
                    ? 'As questoes aparecerao aqui assim que cada uma for extraida e validada.'
                    : 'Faca o upload da Prova e do Gabarito para iniciar a extracao em massa.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {contextPendingRemoval && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-base font-black text-slate-900 dark:text-slate-100">Excluir contexto?</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                O contexto <strong>{contextPendingRemoval.title || 'Texto de apoio'}</strong>
                {contextPendingRemoval.questionNumbers.length > 0
                  ? ` sera desvinculado de ${contextPendingRemoval.questionNumbers.length} questao(oes).`
                  : ' nao possui questoes vinculadas.'}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setContextPendingRemoval(null)}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-widest`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmRemoveExtractedContext}
              className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AdminImportSection;
