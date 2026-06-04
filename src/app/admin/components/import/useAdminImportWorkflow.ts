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

import { useState } from 'react';
import type { Question, QuestionTaxonomyLabel, SystemSettings } from '@types';
import { aiService, questionService, type PageExtractionResult } from '@services/questions';
import {
  ENEM_FOCUS_NAME,
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
} from '@services/filters';
import { normalizeProvaRecord } from '../exams/examBankUtils';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

export type GenerateSpecificType = 'teacher' | 'detailed';
export type ImportPublishAction = 'exam' | 'questions' | `question:${number}`;

interface ImportedQuestionDraft extends Partial<Question> {
  text?: string;
  number?: number | string;
  questionNumber?: number | string;
  isQuestion?: boolean;
  rejectionReason?: string;
  supportText?: string;
  referenceText?: string;
  contextKey?: string;
  grupoQuestaoTempId?: string | number;
  contextTitle?: string;
  contextScope?: string;
  sourcePage?: number | string;
  hasFigure?: boolean;
  figureDescription?: string;
  figureBox?: FigureBox;
  supportFigureBox?: FigureBox;
  supportFigureBoxes?: FigureBox[];
  optionFigureBox?: FigureBox;
  optionFigureBoxes?: FigureBox[];
  supportImages?: ImportedQuestionImageDraft[];
  imageDescriptions?: string[];
  modality?: 'multipla escolha' | 'certo ou errado';
  expectedOptionsCount?: number | string;
  expected_options_count?: number | string;
  correctOptionIndex?: number;
  anulada?: boolean;
  isCanceled?: boolean;
  subject?: string;
  topic?: string;
  specificSubject?: string;
  options?: string[];
  difficulty?: string;
}

interface ImportMetadata extends NonNullable<PageExtractionResult['metadata']> {
  hash_id?: string;
  subjects?: string[];
  title?: string;
  examTitle?: string;
  name?: string;
  nome?: string;
  ano?: string | number;
  role?: string;
  cargo?: string;
  roles?: string[];
  cargos?: string[];
  caderno?: string;
  booklet?: string;
  tipoCaderno?: string;
  corCaderno?: string;
  bookletType?: string;
  bookletColor?: string;
  cadernoTipo?: string;
  cadernoCor?: string;
}

interface FigureBox {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
}

interface UseAdminImportWorkflowOptions {
  systemSettings: SystemSettings;
  addToast: (message: string, type?: string) => void;
  onImportedQuestionsSaved?: (questions: Question[]) => void;
  updateSystemSettings?: (settings: SystemSettings) => Promise<unknown> | unknown;
  saveSystemSettingsNow?: (settings?: SystemSettings) => Promise<unknown> | unknown;
}

interface ImportedContextDraft {
  tempId: string;
  title: string;
  text: string;
  questionNumbers: number[];
  hasFigure: boolean;
  figureDescription: string;
  page: number;
  imageData?: string;
  pageImageData?: string;
  figureBox?: FigureBox;
  manualCropApplied?: boolean;
}

interface ImportedQuestionImageDraft {
  tempId: string;
  title: string;
  description?: string;
  imageData?: string;
  pageImageData?: string;
  figureBox?: FigureBox;
  page?: number;
  manualCropApplied?: boolean;
}

interface ImportDiagnostics {
  expectedQuestionNumbers: number[];
  extractedQuestionNumbers: number[];
  missingQuestionNumbers: number[];
}

interface PdfTextHighlight {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface PdfPageRichText {
  plainText: string;
  richText: string;
  highlights: PdfTextHighlight[];
  hasHighlights: boolean;
}

type ImportMetadataField = keyof ImportMetadata;
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

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

const loadPdfJsModule = async (): Promise<PdfJsModule> => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();

      return module;
    });
  }

  return pdfJsModulePromise;
};

const readErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : 'Erro inesperado.'
);

const stripHtml = (value: string) => value.replace(/<[^>]*>?/gm, '');

const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockHtmlPattern = /<\/?(?:p|div|h[1-6]|ul|ol|li|table|figure|figcaption|blockquote|pre|section|article)\b/i;
const safeInlineHtmlPattern = /<\/?(?:strong|em|u|b|i|mark)\b[^>]*>|<br\s*\/?>/gi;

const normalizeStructuredText = (value: string) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u00A0/g, ' ')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').trim())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const normalizeInlineText = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeSafeInlineTag = (tag: string) => {
  const normalized = tag.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^<br\s*\/?>$/.test(normalized)) return '<br />';
  const closing = /^<\//.test(normalized);
  const name = normalized.match(/^<\/?\s*([a-z0-9]+)/)?.[1] || '';
  if (name === 'b') return closing ? '</strong>' : '<strong>';
  if (name === 'i') return closing ? '</em>' : '<em>';
  if (['strong', 'em', 'u', 'mark'].includes(name)) {
    return closing ? `</${name}>` : `<${name}>`;
  }
  return '';
};

const escapeStructuredTextPreservingInlineHtml = (value: string) => {
  const tokens: string[] = [];
  const safeTags: string[] = [];
  const tokenized = String(value || '').replace(safeInlineHtmlPattern, (tag) => {
    const safeTag = normalizeSafeInlineTag(tag);
    if (!safeTag) {
      return '';
    }
    const token = `__CM_SAFE_INLINE_${tokens.length}__`;
    tokens.push(token);
    safeTags.push(safeTag);
    return token;
  });

  return tokens.reduce(
    (current, token, index) => current.replaceAll(token, safeTags[index] || ''),
    escapeHtml(tokenized),
  );
};

const isLikelySupportTitleLine = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 120) {
    return false;
  }

  if (/^(?:TEXTOS?\s+(?:[IVXLC]+|\d+)|Texto\s+[A-Z0-9]+|Figura|Imagem|Tirinha|Charge|Gr[aá]fico|Tabela|Mapa|Quadro)\b/i.test(clean)) {
    return true;
  }

  const letters = clean.replace(/[^\p{L}]/gu, '');
  const uppercaseLetters = letters.replace(/[^\p{Lu}]/gu, '');
  return letters.length >= 5 && uppercaseLetters.length / letters.length > 0.72;
};

const formatStructuredSupportHtml = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw || blockHtmlPattern.test(raw)) {
    return raw;
  }

  const structured = normalizeStructuredText(raw);
  if (!structured) {
    return '';
  }

  const hasStructure = /\n/.test(structured);
  const hasInlineHtml = /<\/?(?:strong|em|u|b|i|mark)\b/i.test(structured);
  if (!hasStructure && !hasInlineHtml) {
    return structured;
  }

  return structured
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        return '';
      }

      if (lines.length === 1) {
        const content = escapeStructuredTextPreservingInlineHtml(lines[0]);
        return isLikelySupportTitleLine(lines[0]) ? `<h4>${content}</h4>` : `<p>${content}</p>`;
      }

      const [firstLine, ...bodyLines] = lines;
      const bodyHtml = bodyLines.map(escapeStructuredTextPreservingInlineHtml).join('<br />');
      if (isLikelySupportTitleLine(firstLine)) {
        return `<h4>${escapeStructuredTextPreservingInlineHtml(firstLine)}</h4>${bodyHtml ? `<p>${bodyHtml}</p>` : ''}`;
      }

      return `<p>${lines.map(escapeStructuredTextPreservingInlineHtml).join('<br />')}</p>`;
    })
    .filter(Boolean)
    .join('');
};

const toImportMetadata = (metadata: PageExtractionResult['metadata']) => (
  (metadata && typeof metadata === 'object' ? metadata : null) as ImportMetadata | null
);

const toImportedQuestionDraft = (question: Partial<Question>) => question as ImportedQuestionDraft;

const slugify = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

const normalizeComparisonText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const ROLE_START_PATTERN = /^(?:soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatente)\b/i;
const ROLE_SIGNAL_PATTERN = /\b(?:cargo|prova|soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatentes?|pol[ií]cia|policia|bombeiro|pm|bm|qpc|qbmp)\b/i;

const cleanRoleCandidate = (value: unknown) => String(value || '')
  .replace(/^[\s:;,\-–—]+/, '')
  .replace(/\b(?:cargo|prova|cargo\/prova)\s*[:\-–—]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const splitRoleCandidate = (value: unknown, requireSignal = false) => {
  const clean = cleanRoleCandidate(value);
  if (!clean) {
    return [];
  }

  return clean
    .split(/(?:\r?\n|;|\s+\/\s+|\s+\|\s+|\s+(?=(?:Soldado|Cabo|Sargento|Tenente|Oficial|Professor|Analista|T[eé]cnico|Tecnico|Agente|Assistente|Auditor|Fiscal|Escriv[aã]o|Delegado|M[eé]dico|Medico|Enfermeiro|Engenheiro)\b))/i)
    .map(cleanRoleCandidate)
    .filter((item) => item.length >= 3 && item.length <= 140)
    .filter((item) => !requireSignal || ROLE_SIGNAL_PATTERN.test(item));
};

const normalizeRoleList = (...values: unknown[]) => {
  const roles = values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => splitRoleCandidate(item));
      }

      return splitRoleCandidate(value);
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = normalizeComparisonText(role);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const summarizeRoleList = (roles: string[], fallback = '') => (
  roles.length > 0 ? roles.join(' / ') : String(fallback || '').trim()
);

const inferRolesFromText = (value: string, fileName = '') => {
  const text = String(value || '');
  const candidates: string[] = [];
  const labeledMatches = Array.from(text.matchAll(/\b(?:cargo|prova|cargo\/prova)\s*[:\-–—]\s*([^\r\n|]{3,180})/gi));
  labeledMatches.forEach((match) => {
    candidates.push(...splitRoleCandidate(match[1]));
  });

  text
    .split(/\r?\n/)
    .map(cleanRoleCandidate)
    .filter((line) => line.length >= 6 && line.length <= 140)
    .filter((line) => ROLE_SIGNAL_PATTERN.test(line) && (ROLE_START_PATTERN.test(line) || /\b(?:pm|bm|qpc|qbmp|combatentes?)\b/i.test(line)))
    .forEach((line) => candidates.push(...splitRoleCandidate(line, true)));

  candidates.push(...splitRoleCandidate(fileName.replace(/\.[a-z0-9]+$/i, ''), true));

  return normalizeRoleList(candidates);
};

const toLooseRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readPdfTextStyle = (item: unknown, styles: Record<string, unknown>) => {
  const record = toLooseRecord(item);
  const fontName = String(record?.fontName || '');
  const styleRecord = toLooseRecord(styles[fontName]);
  return `${fontName} ${String(styleRecord?.fontFamily || '')}`.toLowerCase();
};

const isBoldPdfTextStyle = (styleText: string) => (
  /\b(bold|black|heavy|semibold|semi-bold|demi|extrabold|extra-bold)\b/i.test(styleText)
);

const isItalicPdfTextStyle = (styleText: string) => (
  /\b(italic|oblique|italico|it\b)\b/i.test(styleText)
);

const isUnderlinePdfTextStyle = (styleText: string) => (
  /\b(underline|underlined|sublinhad[oa]|subline)\b/i.test(styleText)
);

const isMeaningfulHighlightText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  return clean.length >= 2 && /[\p{L}\p{N}]/u.test(clean) && !/^\W+$/.test(clean);
};

const mergeAdjacentHighlights = (items: PdfTextHighlight[]) => {
  const merged: PdfTextHighlight[] = [];
  items.forEach((item) => {
    const previous = merged[merged.length - 1];
    if (
      previous
      && previous.bold === item.bold
      && previous.italic === item.italic
      && previous.underline === item.underline
      && previous.text.length + item.text.length <= 120
    ) {
      previous.text = `${previous.text}${/\s$/.test(previous.text) || /^\s/.test(item.text) ? '' : ' '}${item.text}`.replace(/\s+/g, ' ');
      return;
    }

    merged.push({ ...item });
  });

  return merged
    .map((item) => ({ ...item, text: item.text.replace(/\s+/g, ' ').trim() }))
    .filter((item) => isMeaningfulHighlightText(item.text));
};

const wrapHighlightedText = (value: string, highlight: Pick<PdfTextHighlight, 'bold' | 'italic' | 'underline'>) => {
  let output = escapeHtml(value);
  if (highlight.underline) {
    output = `<u>${output}</u>`;
  }
  if (highlight.italic) {
    output = `<em>${output}</em>`;
  }
  if (highlight.bold) {
    output = `<strong>${output}</strong>`;
  }
  return output;
};

type PdfTextSegment = PdfTextHighlight & {
  lineBreakAfter?: boolean;
  blockBreakAfter?: boolean;
};

const joinPdfTextSegments = (
  items: PdfTextSegment[],
  render: (item: PdfTextSegment) => string,
) => {
  let output = '';
  items.forEach((item) => {
    const rendered = render(item).trim();
    if (!rendered) {
      return;
    }

    if (output && !/[\s\n]$/.test(output)) {
      output += ' ';
    }
    output += rendered;

    if (item.blockBreakAfter) {
      output += '\n\n';
    } else if (item.lineBreakAfter) {
      output += '\n';
    }
  });

  return normalizeStructuredText(output);
};

const buildPlainPdfText = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => item.text,
);

const buildHighlightedPdfTextHtml = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => (
    item.bold || item.italic || item.underline
      ? wrapHighlightedText(item.text, item)
      : escapeHtml(item.text)
  ),
);

const shouldIgnoreDominantHighlight = (items: PdfTextHighlight[], field: 'bold' | 'italic' | 'underline') => {
  const meaningfulItems = items.filter((item) => isMeaningfulHighlightText(item.text));
  if (meaningfulItems.length < 12) {
    return false;
  }
  const highlightedCount = meaningfulItems.filter((item) => item[field]).length;
  return highlightedCount / meaningfulItems.length > 0.72;
};

const applyPdfHighlightsToHtml = (value: string, highlights: PdfTextHighlight[]) => {
  if (!value || highlights.length === 0) {
    return value;
  }

  let output = value;
  const candidateHighlights = highlights
    .filter((highlight) => isMeaningfulHighlightText(highlight.text))
    .filter((highlight) => (
      stripHtml(output).replace(/\s+/g, ' ').toLowerCase()
        .includes(stripHtml(highlight.text).replace(/\s+/g, ' ').toLowerCase())
    ))
    .sort((left, right) => right.text.length - left.text.length)
    .slice(0, 30);

  candidateHighlights.forEach((highlight) => {
    const cleanText = stripHtml(highlight.text).replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      return;
    }

    const pattern = new RegExp(escapeRegExp(cleanText).replace(/\s+/g, '\\s+'), 'i');
    output = output.replace(pattern, (match, offset: number, fullText: string) => {
      const before = fullText.slice(Math.max(0, offset - 48), offset);
      const after = fullText.slice(offset + match.length, offset + match.length + 48);
      if (/<(?:strong|b|em|i|u)[^>]*>[^<]*$/i.test(before) && /^<\/(?:strong|b|em|i|u)>/i.test(after)) {
        return match;
      }

      return wrapHighlightedText(match, highlight);
    });
  });

  return output;
};

const ENEM_AREA_NORMALIZED_NAMES = new Set(
  ENEM_SUBJECT_AREA_OPTIONS.map((areaName) => normalizeComparisonText(areaName)),
);

const ENEM_DISCIPLINE_LABELS = Object.values(ENEM_SUBJECT_AREA_DESCRIPTIONS).flat();

const ENEM_DISCIPLINE_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Lingua Portuguesa', keywords: ['lingua portuguesa', 'portugues', 'gramatica', 'interpretacao de texto', 'crase', 'regencia', 'concordancia', 'coesao', 'coerencia'] },
  { label: 'Literatura', keywords: ['literatura', 'poesia', 'poema', 'romance', 'narrador', 'modernismo', 'barroco', 'arcadismo'] },
  { label: 'Lingua Estrangeira (Ingles ou Espanhol)', keywords: ['ingles', 'espanhol', 'english', 'spanish', 'foreign language'] },
  { label: 'Artes', keywords: ['arte', 'artes', 'pintura', 'escultura', 'musica', 'teatro', 'danca', 'cinema'] },
  { label: 'Educacao Fisica', keywords: ['educacao fisica', 'esporte', 'atividade fisica', 'corpo', 'jogo', 'lazer'] },
  { label: 'Tecnologias da Informacao e Comunicacao', keywords: ['tecnologia da informacao', 'tecnologias da informacao', 'tic', 'internet', 'rede social', 'midia digital'] },
  { label: 'Historia (Geral e Brasil)', keywords: ['historia', 'brasil colonial', 'republica', 'imperio', 'revolucao', 'guerra', 'ditadura', 'escravidao'] },
  { label: 'Geografia', keywords: ['geografia', 'clima', 'relevo', 'territorio', 'urbanizacao', 'cartografia', 'globalizacao', 'demografia'] },
  { label: 'Filosofia', keywords: ['filosofia', 'etica', 'moral', 'platao', 'aristoteles', 'kant', 'descartes', 'socrates'] },
  { label: 'Sociologia', keywords: ['sociologia', 'sociedade', 'cultura', 'classe social', 'movimento social', 'trabalho', 'desigualdade'] },
  { label: 'Quimica', keywords: ['quimica', 'molecula', 'atomo', 'reacao', 'solucao', 'ph', 'estequiometria', 'tabela periodica', 'ligacao quimica'] },
  { label: 'Fisica', keywords: ['fisica', 'forca', 'energia', 'calor', 'onda', 'ondas', 'ressonancia', 'frequencia', 'comprimento de onda', 'velocidade', 'movimento', 'grafico', 'luz', 'espectro', 'luminescencia', 'fluido', 'irradiacao'] },
  { label: 'Biologia', keywords: ['biologia', 'celula', 'genetica', 'organismo', 'anfibio', 'veneno', 'toxina', 'bacteria', 'virus', 'vacina', 'evolucao'] },
  { label: 'Ecologia', keywords: ['ecologia', 'ecossistema', 'cadeia alimentar', 'biodiversidade', 'bioma', 'populacao', 'relacao ecologica'] },
  { label: 'Impactos Ambientais', keywords: ['impacto ambiental', 'poluicao', 'aquecimento global', 'mudancas climaticas', 'desmatamento', 'emissoes', 'co2'] },
  { label: 'Saude', keywords: ['saude', 'doenca', 'epidemiologia', 'saneamento', 'vacina', 'tratamento', 'recem nascido'] },
  { label: 'Algebra', keywords: ['algebra', 'equacao', 'funcao', 'sistema linear', 'polinomio', 'inequacao'] },
  { label: 'Geometria', keywords: ['geometria', 'area', 'volume', 'angulo', 'triangulo', 'circunferencia', 'poligono', 'plano cartesiano'] },
  { label: 'Estatistica', keywords: ['estatistica', 'media', 'mediana', 'moda', 'probabilidade', 'desvio padrao', 'grafico estatistico'] },
  { label: 'Matematica Financeira', keywords: ['matematica financeira', 'juros', 'porcentagem', 'desconto', 'taxa', 'parcelamento'] },
  { label: 'Raciocinio Logico', keywords: ['raciocinio logico', 'logica', 'proposicao', 'sequencia logica', 'argumento'] },
  { label: 'Matematica', keywords: ['matematica', 'numero', 'razao', 'proporcao', 'sequencia', 'pa', 'pg', 'calculo'] },
];

const hasMeaningfulTextOverlap = (left: string, right: string) => {
  const normalizedLeft = normalizeComparisonText(left);
  const normalizedRight = normalizeComparisonText(right);
  if (normalizedLeft.length < 80 || normalizedRight.length < 80) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight.slice(0, 80))
    || normalizedRight.includes(normalizedLeft.slice(0, 80));
};

const normalizeQuestionNumber = (value: unknown, fallback: number) => {
  const match = String(value ?? '').match(/\d+/);
  const parsed = match ? Number(match[0]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const instructionPattern = /\b(instru[cç][oõ]es|cart[aã]o[- ]resposta|prova objetiva|rascunho|transcreva|assine|dura[cç][aã]o|caderno de quest[oõ]es|aten[cç][aã]o|folha de respostas)\b/i;
const questionCommandPattern = /\b(quest[aã]o|assinale|julgue|considere|responda|marque|com base|de acordo|nesse contexto|neste contexto|nesse sentido|neste sentido|infere-se|no que se refere|observe|analise|a partir|segundo|qual|quais|acerca|em rela[cç][aã]o|sobre|o texto|a figura|o gr[aá]fico|o esquema|a tabela)\b/i;

const isLikelyInstructionText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (clean.length < 18) {
    return true;
  }
  if (instructionPattern.test(clean) && !questionCommandPattern.test(clean)) {
    return true;
  }
  return false;
};

const normalizeContextClassifierText = (value: string) => stripHtml(String(value || ''))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[ºª]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const pageBookletHeaderPattern = /\b(CIENCIAS DA NATUREZA E SUAS TECNOLOGIAS|CIENCIAS HUMANAS E SUAS TECNOLOGIAS|LINGUAGENS(?: CODIGOS)? E SUAS TECNOLOGIAS|MATEMATICA E SUAS TECNOLOGIAS|CADERNO\s+\d+|QUESTOES?\s+DE\s+\d+\s+A\s+\d+|[12]\s*DIA|AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA|PROVA\s+(?:AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA))\b/i;
const supportContextSignalPattern = /\b(TEXTOS?\s+(?:[IVXLC]+|\d+)|fragmento|adaptad[ao]|disponivel em|acesso em|fonte|figura|imagem|tirinha|charge|grafico|tabela|mapa|cartum|esquema|diagrama|infografico|quadro)\b/i;
const supportContextStartPattern = /\b(TEXTOS?\s+(?:[IVXLC]+|\d+)|figura|imagem|tirinha|charge|gr[aá]fico|tabela|mapa|cartum|esquema|diagrama|infogr[aá]fico|quadro)\b/i;
const visualOptionPlaceholderPattern = /^Alternativa visual\b/i;

const isLikelyPageBookletHeader = (value: string) => {
  const normalized = normalizeContextClassifierText(value);
  if (!normalized) {
    return true;
  }

  const hasHeaderSignal = pageBookletHeaderPattern.test(normalized);
  const hasSupportSignal = supportContextSignalPattern.test(normalized);
  const hasQuestionCommand = questionCommandPattern.test(value);
  const mostlyHeaderTokens = [
    'CIENCIAS',
    'TECNOLOGIAS',
    'CADERNO',
    'QUESTOES',
    'DIA',
    'AMARELO',
    'AZUL',
    'ROSA',
    'BRANCO',
    'CINZA',
  ].filter((token) => normalized.includes(token)).length >= 3;

  return hasHeaderSignal && mostlyHeaderTokens && !hasSupportSignal && !hasQuestionCommand;
};

const trimBookletHeaderFromContext = (value: string) => {
  const structured = normalizeStructuredText(value);
  const lines = structured.split('\n').map((line) => line.trim()).filter(Boolean);
  const supportLineIndex = lines.findIndex((line) => supportContextStartPattern.test(stripHtml(line)));

  if (supportLineIndex > 0) {
    const possibleHeader = lines.slice(0, supportLineIndex).join(' ');
    if (isLikelyPageBookletHeader(possibleHeader)) {
      return lines.slice(supportLineIndex).join('\n').trim();
    }
  }

  return structured;
};

const isLikelyContextReferenceCommand = (value: string) => {
  const normalized = normalizeContextClassifierText(value);
  if (!normalized) {
    return true;
  }
  return /^(?:INTERNET\s*:\s*\.)?\s*(?:NO QUE SE REFERE|COM BASE|CONSIDERANDO|A PARTIR).*?\b(?:JULGUE|ASSINALE|RESPONDA)\b.*\b(?:ITENS|QUESTOES|ITEM)\b/.test(normalized)
    && normalized.length < 260;
};

const sanitizeSupportContextText = (value: string) => {
  if (blockHtmlPattern.test(String(value || ''))) {
    return String(value || '').trim();
  }

  let clean = trimBookletHeaderFromContext(value)
    .replace(/^pcimarkpci\s+/i, '')
    .replace(/^[A-Za-z0-9+/=]{80,}\s+/, '')
    .replace(/\bwww\.pciconcursos\.com\.br\b\s*\|\s*\d+_[A-Z0-9_]+.*?(?=\bTexto\s+[A-Z0-9]{4,}\b|\bTEXTOS?\s+[IVXLC]+\b|$)/i, '')
    .replace(/\b(?:CESPE|CEBRASPE)\s*[-|]\s*[^.]{0,180}?(?=\bTexto\s+[A-Z0-9]{4,}\b|\bTEXTOS?\s+[IVXLC]+\b|$)/i, '')
    .trim();

  const textMarker = clean.search(/\bTexto\s+[A-Z0-9]{4,}\b/i);
  if (textMarker > 0) {
    clean = clean.slice(textMarker).trim();
  }

  clean = clean
    .replace(/\s+(?:Considerando|No que se refere|Com base|A partir)\s+.{0,420}?\b(?:julgue|assinale|responda)\b.{0,180}$/i, '');

  clean = normalizeStructuredText(clean);

  if (isLikelyContextReferenceCommand(clean)) {
    return '';
  }

  return clean;
};

interface TextSpan {
  start: number;
  end: number;
  text: string;
}

const isReferenceSegment = (value: string) => (
  /\b(?:et al\.|Revista|Journal|Med\.|Chem\.|Res\.|Dispon[ií]vel em|Acesso em|Fonte|adaptad[ao]|fragmento|\d{4})\b/i
    .test(value)
);

const normalizeReferenceSegment = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .trim();

const collectReferenceSpans = (clean: string) => {
  const spans: TextSpan[] = [];
  const pushSpan = (start: number, end: number) => {
    if (start < 0 || end <= start || end > clean.length) {
      return;
    }

    const text = normalizeReferenceSegment(clean.slice(start, end));
    if (text && isReferenceSegment(text)) {
      spans.push({ start, end, text });
    }
  };

  const authorReferencePattern = /\b\p{Lu}{2,},\s+\p{Lu}\.[\s\S]{0,560}?\((?:fragmento|adaptad[ao])\)\.?/giu;
  for (const match of clean.matchAll(authorReferencePattern)) {
    pushSpan(match.index ?? -1, (match.index ?? -1) + match[0].length);
  }

  const sourceMarkerPattern = /\b(?:Dispon[ií]vel em|Fonte)\s*:/gi;
  for (const match of clean.matchAll(sourceMarkerPattern)) {
    const start = match.index ?? -1;
    if (start < 0 || spans.some((span) => start >= span.start && start < span.end)) {
      continue;
    }

    const tail = clean.slice(start);
    const adaptedMatch = tail.match(/\((?:fragmento|adaptad[ao])\)\.?/i);
    const accessMatch = tail.match(/Acesso em\s*:[\s\S]{0,160}?\d{4}\.?/i);
    const endpoint = [adaptedMatch, accessMatch]
      .map((endpointMatch) => (
        endpointMatch && endpointMatch.index !== undefined
          ? endpointMatch.index + endpointMatch[0].length
          : -1
      ))
      .filter((index) => index > 0)
      .sort((left, right) => right - left)[0];

    if (endpoint) {
      pushSpan(start, start + endpoint);
    }
  }

  return spans
    .sort((left, right) => left.start - right.start)
    .reduce<TextSpan[]>((merged, span) => {
      const previous = merged[merged.length - 1];
      if (!previous || span.start > previous.end) {
        merged.push(span);
        return merged;
      }

      if (span.end > previous.end) {
        previous.end = span.end;
        previous.text = normalizeReferenceSegment(clean.slice(previous.start, previous.end));
      }
      return merged;
    }, []);
};

const mergeReferenceText = (...values: string[]) => {
  const seen = new Set<string>();
  const segments = values
    .flatMap((value) => String(value || '').split(/\n{2,}/))
    .map(normalizeReferenceSegment)
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeComparisonText(value);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return segments.join('\n\n');
};

const splitQuestionSupportReference = (value: string) => {
  const clean = sanitizeSupportContextText(value);
  if (!clean) {
    return { supportText: '', referenceText: '' };
  }

  const referenceSpans = collectReferenceSpans(clean);
  if (!referenceSpans.length) {
    return { supportText: clean, referenceText: '' };
  }

  const supportParts: string[] = [];
  let cursor = 0;
  referenceSpans.forEach((span) => {
    supportParts.push(clean.slice(cursor, span.start));
    cursor = span.end;
  });
  supportParts.push(clean.slice(cursor));

  const supportText = normalizeStructuredText(supportParts.join('\n\n'))
    .replace(/[ \t]+([,.;:])/g, '$1')
    .trim();
  const referenceText = mergeReferenceText(...referenceSpans.map((span) => span.text));

  return {
    supportText,
    referenceText,
  };
};

const shouldRepairQuestionPartsWithAi = ({
  rawText,
  supportText,
  referenceText,
  statement,
  options,
  expectedOptionsCount,
}: {
  rawText: string;
  supportText: string;
  referenceText: string;
  statement: string;
  options: string[];
  expectedOptionsCount: number;
}) => {
  const cleanStatement = stripHtml(statement).replace(/\s+/g, ' ').trim();
  const hasReferenceInsideStatement = /\b(?:Dispon[ií]vel em|Acesso em|Fonte|et al\.|Revista|Journal|adaptad[ao])\b/i
    .test(cleanStatement);
  const hasSupportDuplicatedInStatement = Boolean(supportText) && hasMeaningfulTextOverlap(cleanStatement, supportText);
  const rawLooksOptioned = readOptionMarkers(rawText).length >= Math.min(5, expectedOptionsCount);
  const missingOptionsDespiteMarkers = options.length < expectedOptionsCount && rawLooksOptioned;

  return cleanStatement.length > 0
    && (
      hasReferenceInsideStatement
      || hasSupportDuplicatedInStatement
      || missingOptionsDespiteMarkers
      || (Boolean(referenceText) && hasMeaningfulTextOverlap(cleanStatement, referenceText))
    );
};

const normalizeAiRepairedOptions = (options: unknown, expectedOptionsCount: number) => (
  Array.isArray(options)
    ? options
      .map((option) => stripOptionLabel(String(option || '').replace(/\s+/g, ' ').trim()))
      .filter(Boolean)
      .slice(0, Math.max(2, expectedOptionsCount))
    : []
);

const shouldPromoteAsSupportContext = (value: string) => {
  const clean = sanitizeSupportContextText(value);
  if (clean.length <= 120) {
    return false;
  }
  if (isLikelyInstructionText(clean) || isLikelyPageBookletHeader(clean)) {
    return false;
  }
  return true;
};

const extractQuestionNumbersFromText = (value: string) => {
  const text = normalizeQuestionMarkerText(value);
  const matches = [
    ...Array.from(text.matchAll(/\b(?:quest[aã]o|questao|q\.?)\s*(?:n[ºo]\s*)?(\d{1,3})\b/gi))
      .map((match) => ({ number: Number(match[1]), index: match.index ?? 0, source: 'word' })),
    ...Array.from(text.matchAll(/(^|\s)(\d{1,3})\s*\)\s/g))
      .map((match) => ({ number: Number(match[2]), index: (match.index ?? 0) + match[1].length, source: 'numbered' })),
    ...(isTrueFalseExamText(text)
      ? findPlainTrueFalseMarkers(text).map((marker) => ({ number: marker.number, index: marker.index, source: marker.source }))
      : []),
  ]
    .filter((marker) => Number.isFinite(marker.number) && marker.number > 0 && marker.number < 500)
    .sort((left, right) => left.index - right.index)
    .filter((marker, index, list) => list.findIndex((item) => item.number === marker.number) === index)
    .filter((marker, index, list) => (
      marker.source === 'word'
      || marker.source === 'plain-true-false'
      || index === 0
      || marker.number > list.slice(0, index).reduce((highest, item) => Math.max(highest, item.number), 0)
    ));

  return matches.map((marker) => marker.number);
};

const normalizeQuestionMarkerText = (value: string) => String(value || '')
  .replace(/\bQ\s*U\s*E\s*S\s*T\s*\S\s*O\b/gi, 'Questao');

const isTrueFalseExamText = (value: string) => (
  /\b(cespe|cebraspe|julgue os itens|julgue os próximos itens|julgue os seguintes itens|item certo|item errado|código c|codigo c)\b/i.test(String(value || ''))
  || (/\bCERTO\b/i.test(String(value || '')) && /\bERRADO\b/i.test(String(value || '')))
);

const findPlainTrueFalseMarkers = (text: string) => {
  const candidates = Array.from(text.matchAll(/(^|\s)(\d{1,3})\s+(?=\p{Lu})/gu))
    .map((match) => ({
      number: Number(match[2]),
      index: (match.index ?? 0) + match[1].length,
      raw: match[0].slice(match[1].length),
      source: 'plain-true-false',
    }))
    .filter((marker) => Number.isFinite(marker.number) && marker.number > 0 && marker.number < 500);

  const accepted: typeof candidates = [];
  const hasNearbyCommand = (index: number) => /julgue\s+os\s+.{0,120}?itens/i
    .test(text.slice(Math.max(0, index - 420), index));

  candidates.forEach((marker) => {
    const previous = accepted[accepted.length - 1];
    const startsCommandBlock = hasNearbyCommand(marker.index);
    const continuesPreviousItem = Boolean(previous)
      && marker.number === previous.number + 1
      && marker.index > previous.index
      && marker.index - previous.index < 3200;

    if (startsCommandBlock || continuesPreviousItem) {
      accepted.push(marker);
    }
  });

  return accepted;
};

const inferRoleFromFileName = (fileName = '') => {
  const baseName = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const compact = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();

  if (!compact || compact.includes('gabarito') || compact.includes('provaenem')) {
    return '';
  }
  if (compact.includes('agenteadministrativo')) {
    return 'Agente Administrativo';
  }

  return baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const stripOptionLabel = (value: string) => String(value || '')
  .replace(/^\s*(?:alternativa\s*)?\(?[A-E]\)?[\s.)\-–—:]+/i, '')
  .trim();

const readOptionMarkers = (text: string) => {
  const markerPattern = /(?:^|[\s([{;,:.?!])(?:(\(?([A-E])\)?)|([a-e])(?=[).:\-–—]))(?=[\s.)\-–—:])/g;
  return Array.from(text.matchAll(markerPattern))
    .map((match) => {
      const raw = match[1] || match[3] || '';
      const index = (match.index ?? 0) + match[0].length - raw.length;
      let end = index + raw.length;
      const firstTrailingCharacter = text[end] || '';
      while (end < text.length && /[\s.)\-–—:]/.test(text[end])) {
        end += 1;
      }

      return {
        label: String(match[2] || match[3] || '').toUpperCase(),
        index,
        end,
        structured: /[).:;\-–—]/.test(firstTrailingCharacter) || raw.startsWith('(') || raw.includes(')'),
      };
    });
};

const looksLikeOptionCueBefore = (text: string, index: number) => {
  const before = text.slice(Math.max(0, index - 120), index).toLowerCase();
  return /(\?|respectivamente|alternativa|alternativas|op[cç][aã]o|op[cç][oõ]es|representad[oa] em|esbo[cç]ad[oa] no|corresponde(?:m)? a|associad[oa] a|causad[oa] pel[ao]|provocad[oa] pel[ao]|induzid[oa] pel[ao]|decorre d[ao]|mais pr[oó]xim[ao] de|igual a|valor de|resultado de|finalidade de|objetivo de|serve para|permite|porque|pois|s[ãa]o|seria(?:m)?|assinale|marque|em:)\s*[,.:;]?$/i.test(before)
    || /(?:^|\s)(?:[ée]\s+a|e\s+a|[ée]|e)\s*[,.:;]?$/.test(before);
};

const trimExtractedOptionText = (value: string) => String(value || '')
  .replace(/\s+(?:TEXTO\s+[IVXLC]+:?|MATEM[ÁA]TICA\b|RACIOC[IÍ]NIO\b|CONHECIMENTOS\b|www\.pciconcursos\.com\.br\b|\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?.*$|ENEM\d{4}.*$).*$/i, '')
  .trim();

const stripTrailingExamNoise = (value: string) => String(value || '')
  .replace(/\s+(?:\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?)(?:\s*ENEM\d{4}){1,}.*$/i, '')
  .replace(/\s+(?:ENEM\d{4}){2,}.*$/i, '')
  .replace(/\s+\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const extractOptionFragmentsFromText = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const candidates = readOptionMarkers(text);
  const firstStructuredIndex = candidates.findIndex((candidate) => candidate.structured);
  if (firstStructuredIndex < 0) {
    return { statement: text, optionsByLabel: new Map<string, string>() };
  }

  const markers = [];
  const seen = new Set<string>();
  for (let index = firstStructuredIndex; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (seen.has(candidate.label)) {
      if (!candidate.structured) {
        continue;
      }
      break;
    }
    if (!candidate.structured && markers.length > 0 && markers.every((marker) => marker.structured)) {
      continue;
    }
    seen.add(candidate.label);
    markers.push(candidate);
  }

  const optionsByLabel = new Map<string, string>();
  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const option = trimExtractedOptionText(text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim());
    if (option) {
      optionsByLabel.set(marker.label, option);
    }
  });

  const firstMarker = markers[0];
  const statement = firstMarker ? text.slice(0, firstMarker.index).replace(/\s+/g, ' ').trim() : text;
  return { statement, optionsByLabel };
};

const extractOptionsFromText = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const textWithoutTrailingNoise = stripTrailingExamNoise(text);
  const effectiveTextLength = Math.max(1, textWithoutTrailingNoise.length || text.length);
  const candidates = readOptionMarkers(text);

  const labels = ['A', 'B', 'C', 'D', 'E'];
  const visualAlternativesMatch = text.match(/^(.*?)(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s+(?:\*?[A-Z0-9]{6,}\*?.*|ENEM\d{4}.*))?$/i)
    || textWithoutTrailingNoise.match(/^(.*?)(?:^|\s)A\s+B\s+C\s+D\s+E$/i);
  if (visualAlternativesMatch) {
    const statement = stripTrailingExamNoise(String(visualAlternativesMatch[1] || '').trim());
    if (statement && looksLikeOptionCueBefore(text, statement.length + 1)) {
      return {
        statement,
        options: labels.map((label) => `Alternativa visual ${label}`),
      };
    }
  }

  const groups = candidates
    .map((start, startIndex) => {
      const seen = new Set<string>();
      const group = [];
      for (let index = startIndex; index < candidates.length && group.length < labels.length; index += 1) {
        const candidate = candidates[index];
        if (seen.has(candidate.label)) {
          if (!candidate.structured) {
            continue;
          }
          break;
        }
        if (!candidate.structured && group.length > 0 && group.every((marker) => marker.structured)) {
          continue;
        }
        seen.add(candidate.label);
        group.push(candidate);
      }
      return group;
    })
    .filter((group) => {
      if (group.length < 2 || group[0]?.label !== 'A') {
        return false;
      }

      const firstMarker = [...group].sort((left, right) => left.index - right.index)[0];
      const orderedLabels = [...group].sort((left, right) => left.index - right.index).map((marker) => marker.label).join('');
      const isNaturalOptionRun = orderedLabels === labels.slice(0, group.length).join('');
      const isLateInQuestion = firstMarker.index > Math.max(120, effectiveTextLength * 0.42);
      if (
        firstMarker.label === 'A'
        && !looksLikeOptionCueBefore(text, firstMarker.index)
        && !(isNaturalOptionRun && group.length >= 4 && isLateInQuestion)
      ) {
        return false;
      }

      return true;
    });

  const rankGroup = (group: typeof candidates) => {
    const chronologicalGroup = [...group].sort((left, right) => left.index - right.index);
    const orderedLabels = group.map((marker) => marker.label).join('');
    const optionLengths = chronologicalGroup
      .map((marker, index) => {
        const next = chronologicalGroup[index + 1];
        return text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim().length;
      })
      .filter((length) => length > 0);
    const otherMax = Math.max(1, ...optionLengths.slice(1));
    const firstOptionTooLarge = optionLengths[0] > Math.max(80, otherMax * 2.5);
    const firstMarker = chronologicalGroup[0];
    const emptyStatementPenalty = firstMarker.index < 8 && !firstMarker.structured ? 650 : 0;
    const imbalancePenalty = firstOptionTooLarge ? 750 : 0;
    const structuredScore = group.filter((marker) => marker.structured).length * 35;
    const fullGroupScore = group.length === 5 ? 500 : 0;
    const naturalOrderScore = orderedLabels === labels.slice(0, group.length).join('') ? 120 : 0;
    const hasStatementScore = firstMarker.index > 20 ? 120 : 0;
    return (group.length * 1000) + structuredScore + fullGroupScore + naturalOrderScore + hasStatementScore - emptyStatementPenalty - imbalancePenalty;
  };

  const markers = groups.sort((left, right) => rankGroup(right) - rankGroup(left))[0] || [];
  if (markers.length < 2) {
    const fragments = extractOptionFragmentsFromText(text);
    if (fragments.optionsByLabel.size > 1) {
      return {
        statement: fragments.statement,
        options: labels.map((label) => fragments.optionsByLabel.get(label) || '').filter(Boolean),
      };
    }
    return { statement: text, options: [] as string[] };
  }

  const chronologicalMarkers = [...markers].sort((left, right) => left.index - right.index);
  const optionByLabel = new Map<string, string>();
  chronologicalMarkers
    .map((marker, index) => {
      const next = chronologicalMarkers[index + 1];
      optionByLabel.set(marker.label, trimExtractedOptionText(text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim()));
      return marker;
    })
    .filter(Boolean);

  const options = labels.map((label) => optionByLabel.get(label) || '').filter(Boolean);
  const firstMarker = chronologicalMarkers[0];
  const statement = stripTrailingExamNoise(text.slice(0, firstMarker.index).replace(/\s+/g, ' ').trim());
  const fullVisualAlternativeSet = chronologicalMarkers.length >= 5
    && labels.every((label) => optionByLabel.has(label))
    && labels.every((label) => {
      const option = optionByLabel.get(label) || '';
      return option === '' || /^[A-E]$/i.test(option) || /^ENEM\d+/i.test(option);
    });

  if (fullVisualAlternativeSet) {
    return {
      statement,
      options: labels.map((label) => `Alternativa visual ${label}`),
    };
  }

  return { statement, options };
};

const isTrivialVisualOption = (option: string, label: string) => {
  const normalized = String(option || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.toUpperCase() === label
    || new RegExp(`^alternativa\\s+visual\\s+${label}$`, 'i').test(normalized)
    || new RegExp(`^op[cç][aã]o\\s+${label}$`, 'i').test(normalized);
};

const normalizeVisualOptions = (options: string[]) => {
  const labels = ['A', 'B', 'C', 'D', 'E'];
  const hasTrivialVisualSet = options.length >= 2
    && options.every((option, index) => isTrivialVisualOption(option, labels[index] || String(index + 1)));

  return hasTrivialVisualSet
    ? options.map((_, index) => `Alternativa visual ${labels[index] || index + 1}`)
    : options;
};

const shouldUseExtractedStatement = (rawText: string, extractedStatement: string, extractedOptionsCount: number) => {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  const statement = String(extractedStatement || '').replace(/\s+/g, ' ').trim();
  if (!statement || statement.length >= text.length) {
    return false;
  }

  return extractedOptionsCount >= 2
    || /(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s|$)/i.test(text)
    || readOptionMarkers(text).length >= 2;
};

const normalizeImportedOptions = (rawOptions: unknown, rawText: string, modality?: string) => {
  const extracted = extractOptionsFromText(rawText);
  const options = Array.isArray(rawOptions)
    ? normalizeVisualOptions(rawOptions.map((option) => stripOptionLabel(String(option))).filter(Boolean))
    : [];
  if (options.length >= 2) {
    return {
      statement: shouldUseExtractedStatement(rawText, extracted.statement, extracted.options.length)
        ? extracted.statement
        : rawText,
      options,
    };
  }
  if (String(modality || '').toLowerCase().includes('certo')) {
    return { statement: rawText, options: ['Certo', 'Errado'] };
  }
  return extracted;
};

const splitSupportContextFromStatement = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!/^TEXTOS?\s+(?:[IVXLC]+|\d+)\b/i.test(text)) {
    return { supportText: '', statement: text };
  }

  const questionStartPattern = /\b(Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|No texto|Na situa[cç][aã]o|Assinale|Marque|Qual|Quais|Infere-se|Conclui-se)\b/i;
  const searchStart = Math.max(
    0,
    ...Array.from(text.matchAll(/\bTEXTOS?\s+(?:[IVXLC]+|\d+)\b/gi)).map((match) => (match.index || 0) + match[0].length),
  );
  const searchArea = text.slice(searchStart);
  const questionMatch = searchArea.match(questionStartPattern);
  if (!questionMatch || questionMatch.index === undefined) {
    return { supportText: '', statement: text };
  }

  const questionIndex = searchStart + questionMatch.index;
  const supportText = sanitizeSupportContextText(text.slice(0, questionIndex).trim());
  const statement = text.slice(questionIndex).trim();

  if (!supportText || statement.length < 20 || !(questionStartPattern.test(statement) || questionCommandPattern.test(statement))) {
    return { supportText: '', statement: text };
  }

  const splitReference = splitQuestionSupportReference(supportText);
  return { ...splitReference, statement };
};

const splitInlineSupportContextFromStatement = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 220) {
    return { supportText: '', statement: text };
  }

  const supportEvidencePattern = /\b(dispon[ií]vel em|acesso em|adaptad[ao]|fonte|fragmento|figura|imagem|gr[aá]fico|tabela|esquema|tirinha|charge|texto\s+[IVXLC]+)\b/i;
  const referenceEndPattern = /(?:\((?:adaptad[ao]|fragmento)\)\.?|Acesso em:\s*[^.]{2,180}\.\s*|Dispon[ií]vel em:\s*[^.]{2,180}\.\s*)/gi;
  const statementAfterReferencePattern = /\b(?:A\s+(?:perda|massa|quantidade|figura|alternativa|relacao|rela[cç][aã]o|distancia|dist[aâ]ncia|producao|produ[cç][aã]o|probabilidade|agua|[áa]gua|radiacao|radia[cç][aã]o|funcao|fun[cç][aã]o|medida|area|[áa]rea|adesao|ades[aã]o)|O\s+(?:processo|fen[oô]meno|comportamento|[áa]cido|valor|diagrama|gr[aá]fico|resultado|n[uú]mero|total|produto|emprego|desenvolvimento)|Os\s+(?:espectros|dados|valores|sapinhos)|As\s+(?:informacoes|informa[cç][oõ]es|figuras|alternativas)|Esse|Essa|Esses|Essas|Ness[ea]\s+contexto|Nest[ea]\s+contexto|Qual|Quais|Dar\s+destino|Considerando|Em\s+\d{4}|Para\s+[oa])\b/i;
  const commandPattern = /\b(Qual(?:\s+[eé]\s+)?|Quais|Esse|Essa|Esses|Essas|O fenômeno|A característica|Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|Diante disso|Assinale|Marque|Infere-se|Conclui-se)\b/gi;
  const inlineCommandPattern = /\b(Qual(?:\s+[eé]\s+)?|Quais|Esse|Essa|Esses|Essas|O fenômeno|A característica|Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|Diante disso|Assinale|Marque|Infere-se|Conclui-se)\b/i;

  const referenceMatches = Array.from(text.matchAll(referenceEndPattern));
  for (let cursor = referenceMatches.length - 1; cursor >= 0; cursor -= 1) {
    const referenceMatch = referenceMatches[cursor];
    const referenceEnd = (referenceMatch.index ?? 0) + referenceMatch[0].length;
    const afterReference = text.slice(referenceEnd);
    const statementMatch = afterReference.match(statementAfterReferencePattern);
    if (!statementMatch || statementMatch.index === undefined || statementMatch.index > 80) {
      continue;
    }

    const questionIndex = referenceEnd + statementMatch.index;
    const supportCandidate = text.slice(0, questionIndex).trim();
    const statementCandidate = text.slice(questionIndex).trim();
    const splitReference = splitQuestionSupportReference(supportCandidate);

    if (
      splitReference.supportText
      && statementCandidate.length >= 25
      && statementCandidate.length <= 900
      && !isLikelyInstructionText(splitReference.supportText)
      && !isLikelyPageBookletHeader(splitReference.supportText)
    ) {
      return {
        ...splitReference,
        statement: statementCandidate,
      };
    }
  }

  const candidates = Array.from(text.matchAll(commandPattern))
    .map((match) => match.index ?? -1)
    .filter((index) => index > 120 && index < text.length - 20);

  for (let cursor = candidates.length - 1; cursor >= 0; cursor -= 1) {
    const index = candidates[cursor];
    const supportCandidate = text.slice(0, index).trim();
    const statementCandidate = text.slice(index).trim();
    const hasQuestionEnding = /[?!.,:]$/.test(statementCandidate) || /\?/.test(statementCandidate) || /respectivamente[,.:;]?$/i.test(statementCandidate);
    const hasSupportEvidence = supportEvidencePattern.test(supportCandidate) || supportCandidate.length >= 380;
    const statementLooksValid = (questionCommandPattern.test(statementCandidate) || inlineCommandPattern.test(statementCandidate))
      && statementCandidate.length >= 35
      && statementCandidate.length <= 700;

    if (hasSupportEvidence && statementLooksValid && hasQuestionEnding) {
      const splitReference = splitQuestionSupportReference(supportCandidate);
      if (splitReference.supportText && !isLikelyInstructionText(splitReference.supportText) && !isLikelyPageBookletHeader(splitReference.supportText)) {
        return { ...splitReference, statement: statementCandidate };
      }
    }
  }

  return { supportText: '', statement: text };
};

const normalizeExpectedOptionsCount = (value: unknown) => {
  const count = Number(String(value ?? '').match(/[2-5]/)?.[0] || 0);
  return Number.isFinite(count) && count >= 2 && count <= 5 ? count : 0;
};

const inferExpectedOptionsCountFromText = (...values: unknown[]) => {
  const text = values.map((value) => String(value || '')).filter(Boolean).join(' ');
  const normalized = normalizeComparisonText(text);
  if (!normalized) {
    return 0;
  }

  if (normalized.includes('IBFC')) {
    return 4;
  }

  const labels = new Set(readOptionMarkers(text).map((marker) => marker.label));
  if (['A', 'B', 'C', 'D'].every((label) => labels.has(label)) && !labels.has('E')) {
    return 4;
  }
  if (['A', 'B', 'C', 'D', 'E'].every((label) => labels.has(label))) {
    return 5;
  }

  return 0;
};

const getExpectedOptionsCount = (modality?: unknown, explicitCount?: unknown) => {
  const explicit = normalizeExpectedOptionsCount(explicitCount);
  if (explicit) {
    return explicit;
  }

  const modalityText = String(modality || '').toLowerCase();
  if (modalityText.includes('certo')) {
    return 2;
  }

  return normalizeExpectedOptionsCount(modalityText) || 5;
};

const getQuestionExpectedOptionsCount = (question: Question) => {
  const record = question as unknown as {
    tipo?: unknown;
    modality?: unknown;
    expectedOptionsCount?: unknown;
    expected_options_count?: unknown;
  };
  return getExpectedOptionsCount(record.tipo || record.modality, record.expectedOptionsCount ?? record.expected_options_count);
};

const getQuestionIntroText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { intro_text?: string };
  return String(draft.introText || draft.intro_text || '').trim();
};

const getQuestionReferenceText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { reference_text?: string };
  return String(draft.referenceText || draft.reference_text || '').trim();
};

const getQuestionStatementText = (question: Question) => (
  String(question.enunciado || (question as unknown as { text?: string }).text || '').trim()
);

const getQuestionOptionTexts = (question: Question) => (
  Array.isArray(question.itens)
    ? question.itens.map((item) => String(item.corpo || '').trim()).filter(Boolean)
    : []
);

const hasVisualOptionPayload = (question: Question) => (
  (Array.isArray(question.itens) ? question.itens : []).some((item) => {
    const record = item as unknown as { imageData?: unknown; pageImageData?: unknown };
    const body = String(item.corpo || '');
    return Boolean(record.imageData || record.pageImageData || /<img\b|data:image\/|Alternativa visual/i.test(body));
  })
);

const buildFinalQuestionReviewRawText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft;
  const parts = [
    String(draft.text || '').trim(),
    getQuestionIntroText(question),
    getQuestionReferenceText(question),
    getQuestionStatementText(question),
    getQuestionOptionTexts(question).map((option, index) => `${String.fromCharCode(65 + index)}) ${stripHtml(option)}`).join('\n'),
  ];
  const seen = new Set<string>();
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeComparisonText(part);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join('\n\n');
};

const shouldRunFinalQuestionPartsReview = (question: Question) => {
  const statement = stripHtml(getQuestionStatementText(question)).replace(/\s+/g, ' ').trim();
  const introText = stripHtml(getQuestionIntroText(question)).replace(/\s+/g, ' ').trim();
  const referenceText = stripHtml(getQuestionReferenceText(question)).replace(/\s+/g, ' ').trim();
  const options = getQuestionOptionTexts(question);
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const optionMarkers = readOptionMarkers(statement);
  const hasReferenceInsideStatement = /\b(?:Dispon[ií]vel em|Acesso em|Fonte|et al\.|Revista|Journal|adaptad[ao]|fragmento)\b/i
    .test(statement);
  const hasDuplicatedSupport = Boolean(introText) && hasMeaningfulTextOverlap(statement, introText);
  const hasDuplicatedReference = Boolean(referenceText) && hasMeaningfulTextOverlap(statement, referenceText);
  const hasOptionsInsideStatement = optionMarkers.length >= Math.min(3, expectedOptionsCount)
    && options.length < expectedOptionsCount;
  const hasSuspiciousLongStatement = statement.length > 850 && options.length < expectedOptionsCount;

  return Boolean(statement)
    && (
      hasReferenceInsideStatement
      || hasDuplicatedSupport
      || hasDuplicatedReference
      || hasOptionsInsideStatement
      || hasSuspiciousLongStatement
    );
};

const getImportedQuestionNumber = (question: Question, fallback: number): number => {
  const draft = question as unknown as ImportedQuestionDraft;
  const rawNumber = draft.questionNumber ?? draft.number ?? (question as unknown as { question_number?: unknown }).question_number;
  const numericNumber = Number(rawNumber);
  return Number.isFinite(numericNumber) && numericNumber > 0 ? numericNumber : fallback;
};

const completeQuestionOptionsFromPrefix = (question: Question, prefixText: string) => {
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const currentItems = Array.isArray(question.itens) ? question.itens : [];
  if (currentItems.length >= expectedOptionsCount) {
    return null;
  }

  const fragments = extractOptionFragmentsFromText(prefixText);
  if (fragments.optionsByLabel.size === 0) {
    return null;
  }

  const labels = ['A', 'B', 'C', 'D', 'E'];
  const itemByLabel = new Map<string, NonNullable<Question['itens']>[number]>();
  currentItems.forEach((item, index) => {
    const label = String(item.rotulo || labels[index] || '').toUpperCase();
    if (label) {
      itemByLabel.set(label, item);
    }
  });

  labels.slice(0, expectedOptionsCount).forEach((label, index) => {
    if (!itemByLabel.has(label) && fragments.optionsByLabel.has(label)) {
      const option = fragments.optionsByLabel.get(label) || '';
      itemByLabel.set(label, {
        id: index + 1,
        ordem: index + 1,
        rotulo: label,
        corpo: option,
        corpo_clean: stripHtml(option),
      });
    }
  });

  const nextItems = labels
    .slice(0, expectedOptionsCount)
    .map((label, index) => {
      const item = itemByLabel.get(label);
      return item ? { ...item, id: index + 1, ordem: index + 1, rotulo: label } : null;
    })
    .filter(Boolean) as NonNullable<Question['itens']>;

  if (nextItems.length <= currentItems.length) {
    return null;
  }

  return {
    ...question,
    itens: nextItems,
    needsImportReview: nextItems.length < expectedOptionsCount,
  } as Question;
};

const answerLetterToIndex = (value: string) => {
  const letter = String(value || '').trim().toUpperCase();
  const index = ['A', 'B', 'C', 'D', 'E'].indexOf(letter);
  return index >= 0 ? index : null;
};

const normalizeComparableText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const normalizeAnswerKeyRoleTargets = (targetRole: string | string[] = '') => {
  const roleCandidates = normalizeRoleList(targetRole);
  const rawCandidates = Array.isArray(targetRole) ? targetRole : [targetRole];
  const candidates = roleCandidates.length > 0 ? roleCandidates : rawCandidates;

  return candidates
    .map((role) => normalizeComparableText(String(role || '')))
    .filter((role, index, list) => role.length > 0 && list.indexOf(role) === index);
};

const pickAnswerKeySection = (text: string, targetRole: string | string[] = '') => {
  const roles = normalizeAnswerKeyRoleTargets(targetRole);
  if (roles.length === 0) {
    return text;
  }

  const cargoMatches = Array.from(text.matchAll(/\bCARGO\s*:\s*/gi));
  if (cargoMatches.length === 0) {
    return text;
  }

  const sections = cargoMatches.map((match, index) => {
    const start = match.index ?? 0;
    const next = cargoMatches[index + 1];
    const end = next?.index ?? text.length;
    const section = text.slice(start, end);
    const firstAnswer = section.search(/\b\d{1,3}\s*(?:[A-E]|\*|ANULAD[OA])\b/i);
    const title = firstAnswer > 0 ? section.slice(0, firstAnswer) : section.slice(0, 140);
    return { title, section };
  });

  const exact = sections.find((section) => {
    const title = normalizeComparableText(section.title);
    return roles.some((role) => title.includes(role));
  });
  if (exact) {
    return exact.section;
  }

  const scored = sections
    .map((section) => {
      const title = normalizeComparableText(section.title);
      const scores = roles.map((role) => {
        const roleWords = role.split(' ').filter((word) => word.length > 2);
        const score = roleWords.filter((word) => title.includes(word)).length;
        const requiredScore = roleWords.length > 1 ? Math.max(2, roleWords.length) : 1;
        return { score, requiredScore };
      });
      const best = scores.sort((left, right) => right.score - left.score)[0] || { score: 0, requiredScore: 1 };
      return {
        ...section,
        score: best.score,
        requiredScore: best.requiredScore,
      };
    })
    .sort((left, right) => right.score - left.score);

  const bestSection = scored[0];
  return bestSection && bestSection.score >= bestSection.requiredScore ? bestSection.section : '';
};

const shouldUseAnswerKeyPage = (text: string, targetRole: string | string[] = '') => {
  const roles = normalizeAnswerKeyRoleTargets(targetRole);
  if (roles.length === 0) {
    return true;
  }

  const normalized = normalizeComparableText(text);
  const hasRoleMatch = roles.some((role) => {
    const roleWords = role.split(' ').filter((word) => word.length > 2);
    const matchedRoleWords = roleWords.filter((word) => normalized.includes(word)).length;
    const requiredRoleScore = roleWords.length > 1 ? Math.max(2, Math.ceil(roleWords.length * 0.6)) : 1;

    return matchedRoleWords >= requiredRoleScore;
  });

  if (hasRoleMatch) {
    return true;
  }

  if (
    normalized.includes('CONHECIMENTOS GERAIS')
    && normalized.includes('NIVEL SUPERIOR')
    && roles.some((role) => role.includes('TENENTE') || role.includes('SUPERIOR') || role.includes('CIRURGIAO') || role.includes('MEDICO'))
  ) {
    return true;
  }

  if (
    normalized.includes('CONHECIMENTOS GERAIS')
    && normalized.includes('NIVEL MEDIO')
    && roles.some((role) => role.includes('SOLDADO') || role.includes('MEDIO'))
  ) {
    return true;
  }

  if (/\bCARGO\s+\d+\b/.test(normalized) || /\bCARGO\s*:/.test(normalized)) {
    return false;
  }

  return !normalized.includes('GABARITOS OFICIAIS');
};

const convertAnswerTokenToIndex = (value: string, trueFalseMode: boolean) => {
  const rawAnswer = String(value || '').toUpperCase();
  if (rawAnswer === '*' || rawAnswer.startsWith('ANULAD')) {
    return -1;
  }
  if (trueFalseMode) {
    if (rawAnswer === 'C') return 0;
    if (rawAnswer === 'E') return 1;
    return null;
  }
  return answerLetterToIndex(rawAnswer);
};

const parseAnswerEntries = (text: string) => {
  const normalizedText = text
    .replace(/\b(\d{2})\s+(\d)\s+(?=[A-E]|\*|Anulad)/gi, '$1$2 ');
  const directEntries = Array.from(normalizedText.matchAll(/(?:quest[aã]o\s*)?(\d{1,3})\s*(?:[-.:)]\s*)?([A-E]|ANULAD[OA]|\*)(?=\s|$)/gi))
    .map((entry) => ({ number: Number(entry[1]), answer: String(entry[2] || '').toUpperCase() }));

  const tokens = Array.from(normalizedText.matchAll(/\d{1,3}|ANULAD[OA]|\*|[A-E]/gi)).map((match) => String(match[0]).toUpperCase());
  const tableEntries: Array<{ number: number; answer: string }> = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const firstNumber = Number(tokens[index]);
    if (!Number.isFinite(firstNumber) || firstNumber <= 0 || firstNumber >= 500) {
      continue;
    }

    const numbers = [firstNumber];
    let cursor = index + 1;
    while (cursor < tokens.length) {
      const nextNumber = Number(tokens[cursor]);
      if (!Number.isFinite(nextNumber) || nextNumber !== numbers[numbers.length - 1] + 1) {
        break;
      }
      numbers.push(nextNumber);
      cursor += 1;
    }

    if (numbers.length < 5) {
      continue;
    }

    const answers: string[] = [];
    while (cursor < tokens.length && answers.length < numbers.length && /^(?:[A-E]|\*|ANULAD[OA])$/i.test(tokens[cursor])) {
      answers.push(tokens[cursor]);
      cursor += 1;
    }

    if (answers.length >= numbers.length) {
      numbers.forEach((number, numberIndex) => {
        tableEntries.push({ number, answer: answers[numberIndex] });
      });
      index = cursor - 1;
    }
  }

  return [...directEntries, ...tableEntries]
    .filter((entry) => Number.isFinite(entry.number) && entry.number > 0 && entry.number < 500);
};

const parseAnswerKeyFromText = (value: string, targetRole: string | string[] = ''): Record<number, number> => {
  const text = pickAnswerKeySection(String(value || '').replace(/\s+/g, ' ').trim(), targetRole);
  const entries = parseAnswerEntries(text);
  const trueFalseMode = entries.length >= 20
    && entries.every((entry) => ['C', 'E', '*', 'ANULADA', 'ANULADO'].includes(entry.answer));
  const result: Record<number, number> = {};

  entries.forEach((entry) => {
    const number = Number(entry.number);
    const index = convertAnswerTokenToIndex(entry.answer, trueFalseMode);
    if (!Number.isFinite(number) || number <= 0 || number >= 500 || index === null) {
      return;
    }
    if (result[number] === undefined) {
      result[number] = index;
    }
  });

  return result;
};

const BOOKLET_COLOR_LABELS: Array<[RegExp, string]> = [
  [/\bamarel[oa]\b/, 'Amarelo'],
  [/\bazul\b/, 'Azul'],
  [/\brosa\b/, 'Rosa'],
  [/\bbranc[oa]\b/, 'Branco'],
  [/\bcinza\b/, 'Cinza'],
  [/\bverde\b/, 'Verde'],
  [/\blaranja\b/, 'Laranja'],
  [/\brox[oa]\b/, 'Roxo'],
  [/\bpret[oa]\b/, 'Preto'],
];

const normalizeBookletType = (value: unknown) => {
  const clean = String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }

  const letter = clean.match(/^(?:tipo\s*)?([A-Z])$/i)?.[1];
  if (letter) {
    return `Tipo ${letter.toUpperCase()}`;
  }

  const number = clean.match(/^(?:caderno\s*)?(\d{1,2})$/i)?.[1];
  if (number) {
    return `Caderno ${number}`;
  }

  return clean;
};

const normalizeBookletColor = (value: unknown) => {
  const normalized = normalizeComparisonText(String(value || ''));
  if (!normalized) {
    return '';
  }

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

const inferStandaloneBookletColor = (...values: unknown[]) => {
  const shortSignal = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0 && value.length <= 180)
    .join(' ');
  const normalized = normalizeComparisonText(shortSignal);

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

const inferBookletMetadataFromText = (...values: unknown[]) => {
  const normalized = normalizeComparisonText(values.map((value) => String(value || '')).filter(Boolean).join(' '));
  if (!normalized) {
    return { bookletType: '', bookletColor: '' };
  }

  const colorContextMatch = normalized.match(
    /\b(?:caderno|prova|gabarito|cartao resposta|cartao resposta oficial|versao)\s*(?:\d{1,2}\s*)?(amarel[oa]|azul|rosa|branc[oa]|cinza|verde|laranja|rox[oa]|pret[oa])\b|\b(amarel[oa]|azul|rosa|branc[oa]|cinza|verde|laranja|rox[oa]|pret[oa])\s*(?:caderno|prova|gabarito|cartao resposta|versao)\b/,
  );
  const bookletColor = normalizeBookletColor(colorContextMatch?.[1] || colorContextMatch?.[2])
    || inferStandaloneBookletColor(...values);
  const letterType = normalized.match(/\b(?:tipo|versao|caderno tipo|prova tipo)\s*([a-e])\b/)?.[1];
  const numberedBooklet = normalized.match(/\bcaderno\s*(?:n(?:o|umero)?\s*)?(\d{1,2})\b/)?.[1];
  const bookletType = normalizeBookletType(letterType || numberedBooklet);

  return { bookletType, bookletColor };
};

const buildBookletMetadata = (metadata: ImportMetadata | null, ...signals: unknown[]): Partial<ImportMetadata> => {
  const inferred = inferBookletMetadataFromText(
    metadata?.caderno,
    metadata?.booklet,
    metadata?.tipoCaderno,
    metadata?.bookletType,
    metadata?.cadernoTipo,
    metadata?.corCaderno,
    metadata?.bookletColor,
    metadata?.cadernoCor,
    ...signals,
  );
  const tipoCaderno = normalizeBookletType(
    metadata?.tipoCaderno || metadata?.bookletType || metadata?.cadernoTipo || inferred.bookletType,
  );
  const corCaderno = normalizeBookletColor(
    metadata?.corCaderno || metadata?.bookletColor || metadata?.cadernoCor || inferred.bookletColor,
  );
  const caderno = String(metadata?.caderno || metadata?.booklet || '').trim()
    || [tipoCaderno, corCaderno].filter(Boolean).join(' - ');

  return {
    ...(caderno ? { caderno, booklet: caderno } : {}),
    ...(tipoCaderno ? { tipoCaderno, bookletType: tipoCaderno, cadernoTipo: tipoCaderno } : {}),
    ...(corCaderno ? { corCaderno, bookletColor: corCaderno, cadernoCor: corCaderno } : {}),
  };
};

const inferMetadataFromText = (value: string, fileName = ''): ImportMetadata => {
  const text = String(value || '');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = `${normalized} ${fileName}`.toLowerCase();
  const year = (normalized.match(/\b(20\d{2}|19\d{2})\b/) || fileName.match(/\b(20\d{2}|19\d{2})\b/))?.[1] || '';
  const bookletMetadata = buildBookletMetadata(null, normalized, fileName);
  const readField = (labels: string[]) => {
    for (const label of labels) {
      const match = normalized.match(new RegExp(`${label}\\s*[:\\-]\\s*([^|\\n\\r]{2,80})`, 'i'));
      if (match?.[1]) {
        return match[1].replace(/\s{2,}/g, ' ').trim();
      }
    }
    return '';
  };

  if (lower.includes('enem') || lower.includes('exame nacional do ensino medio') || lower.includes('inep')) {
    return {
      agency: 'INEP',
      source: 'INEP',
      year,
      role: 'ENEM',
      level: 'Superior',
      examType: 'ENEM',
      ...bookletMetadata,
      title: year ? `ENEM - INEP (${year})` : 'ENEM - INEP',
      examTitle: year ? `ENEM - INEP (${year})` : 'ENEM - INEP',
    };
  }

  const agency = readField(['Banca', 'Organizadora', 'Instituicao organizadora']);
  const source = readField(['Orgao', 'Orgao/Fonte', 'Fonte']);
  const explicitRole = readField(['Cargo', 'Prova', 'Cargo/Prova']) || inferRoleFromFileName(fileName);
  const roleList = normalizeRoleList(inferRolesFromText(text, fileName), explicitRole);
  const role = summarizeRoleList(roleList, explicitRole);
  const level = readField(['Nivel', 'Escolaridade'])
    || (lower.includes('nivel superior') || lower.includes('nível superior') || lower.includes('tenente') ? 'Superior' : '')
    || (lower.includes('nivel medio') || lower.includes('nível médio') || lower.includes('soldado') ? 'Médio' : '');
  const inferredAgency = agency || (lower.includes('ibfc') ? 'IBFC' : lower.includes('cebraspe') ? 'CEBRASPE' : lower.includes('cespe') ? 'CESPE' : '');
  const inferredSource = source
    || (lower.includes('policia militar') && lower.includes('corpo de bombeiros') && lower.includes('paraiba') ? 'PM/PB / CBM/PB' : '')
    || (lower.includes('pm/pb') || lower.includes('policia militar da paraiba') || lower.includes('polícia militar da paraíba') ? 'PM/PB' : '')
    || (lower.includes('pm/ma') || lower.includes('policia militar do maranhao') || lower.includes('polícia militar do maranhão') ? 'PM/MA' : '');

  return {
    ...(inferredAgency ? { agency: inferredAgency } : {}),
    ...(inferredSource ? { source: inferredSource } : {}),
    ...(role ? { role } : {}),
    ...(roleList.length > 0 ? { roles: roleList, cargos: roleList } : {}),
    ...(level ? { level } : {}),
    ...(year ? { year } : {}),
    ...bookletMetadata,
    examType: lower.includes('concurso') ? 'Concurso' : undefined,
  };
};

const extractMechanicalOptionsFromText = (value: string) => {
  return extractOptionsFromText(value);
};

const findQuestionMarkers = (value: string) => {
  const text = normalizeQuestionMarkerText(value);
  const wordMarkers = Array.from(text.matchAll(/\b(?:quest[aã]o|questao|q\.?)\s*(?:n[ºo]\s*)?(\d{1,3})\b/gi))
    .map((match) => ({
      number: Number(match[1]),
      index: match.index ?? 0,
      raw: match[0],
      source: 'word',
    }));
  const numberedMarkers = Array.from(text.matchAll(/(^|\s)(\d{1,3})\s*\)\s/g))
    .map((match) => ({
      number: Number(match[2]),
      index: (match.index ?? 0) + match[1].length,
      raw: match[0].slice(match[1].length),
      source: 'numbered',
    }));
  const plainTrueFalseMarkers = isTrueFalseExamText(text) ? findPlainTrueFalseMarkers(text) : [];

  return [...wordMarkers, ...numberedMarkers, ...plainTrueFalseMarkers]
    .filter((marker) => Number.isFinite(marker.number) && marker.number > 0 && marker.number < 500)
    .sort((left, right) => left.index - right.index)
    .filter((marker, index, list) => (
      list.findIndex((item) => item.number === marker.number && Math.abs(item.index - marker.index) < 12) === index
    ))
    .filter((marker, index, list) => (
      marker.source === 'word'
      || marker.source === 'plain-true-false'
      || index === 0
      || marker.number > list.slice(0, index).reduce((highest, item) => Math.max(highest, item.number), 0)
    ));
};

const createMechanicalExtractionFromText = (
  pageText: string,
  pageIndex: number,
  fileName: string,
): PageExtractionResult => {
  const normalizedText = normalizeQuestionMarkerText(pageText).replace(/\s+/g, ' ').trim();
  const markers = findQuestionMarkers(normalizedText);
  const metadata = inferMetadataFromText(normalizedText, fileName);
  const trueFalseMode = isTrueFalseExamText(normalizedText);
  if (markers.length === 0) {
    return { metadata, pageContexts: [], questions: [] };
  }

  const contextPrefix = sanitizeSupportContextText(normalizedText.slice(0, markers[0].index).trim());
  const hasContinuationOptions = extractOptionFragmentsFromText(contextPrefix).optionsByLabel.size >= 2;
  const hasSharedContext = shouldPromoteAsSupportContext(contextPrefix) && !hasContinuationOptions;
  const contextKey = hasSharedContext ? `pag-${pageIndex}-contexto-textual` : '';
  const questions = markers.map((marker, index) => {
    const next = markers[index + 1];
    const segment = normalizedText.slice(marker.index + marker.raw.length, next?.index ?? normalizedText.length).trim();
    const { statement, options } = extractMechanicalOptionsFromText(segment);
    const expectedOptionsCount = trueFalseMode
      ? 2
      : inferExpectedOptionsCountFromText(segment, normalizedText, fileName) || getExpectedOptionsCount('multipla escolha');
    const modality: ImportedQuestionDraft['modality'] = trueFalseMode ? 'certo ou errado' : 'multipla escolha';
    const questionOptions = trueFalseMode ? ['Certo', 'Errado'] : options;

    return {
      number: String(marker.number),
      questionNumber: marker.number,
      isQuestion: true,
      text: trueFalseMode ? segment : statement || (options.length > 0 ? '' : segment),
      options: questionOptions,
      expectedOptionsCount,
      expected_options_count: expectedOptionsCount,
      contextKey,
      contextTitle: contextKey ? `Texto de apoio - pagina ${pageIndex}` : '',
      modality,
      subject: '',
      topic: '',
      specificSubject: '',
      level: metadata.level || 'Superior',
      difficulty: 'Média',
      page: pageIndex,
    };
  });

  return {
    metadata,
    pageContexts: contextKey
      ? [{
        contextKey,
        title: `Texto de apoio - pagina ${pageIndex}`,
        text: contextPrefix,
        appliesToQuestionNumbers: markers.map((marker) => marker.number),
        hasFigure: false,
        figureDescription: '',
      }]
      : [],
    questions,
  };
};

const pageLikelyHasFigure = (value: string) => /\b(figura|imagem|gr[aá]fico|tabela|tirinha|charge|mapa|cartum|esquema|diagrama|ilustra[cç][aã]o|infogr[aá]fico)\b/i.test(value);

const questionLikelyHasVisualAlternatives = (
  rawText: string,
  pageText: string,
  modality?: string,
) => {
  if (String(modality || '').toLowerCase().includes('certo')) {
    return false;
  }

  const clean = stripHtml(rawText).replace(/\s+/g, ' ').trim();
  const pageHasVisualMaterial = pageLikelyHasFigure(`${clean} ${pageText}`);
  const hasChoiceCue = /\b(?:alternativas?|op[cç][oõ]es|gr[aá]ficos?|figuras?|imagens?|esbo[cç]ad[ao]s?|representa(?:m)?|mostra(?:m)?|indica(?:m)?|corresponde(?:m)?|assinale|qual|quais|a seguir|abaixo)\b/i
    .test(clean);
  const hasLooseVisualLabels = /(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s|$)/i.test(clean);

  return pageHasVisualMaterial && (hasChoiceCue || hasLooseVisualLabels);
};

const extractionNeedsAi = (
  pageText: string,
  extraction: PageExtractionResult,
  includeTeacherComment: boolean,
  hasPageHighlights = false,
) => {
  if (!pageText || stripHtml(pageText).replace(/\s+/g, ' ').trim().length < 40) {
    return true;
  }
  if (includeTeacherComment) {
    return true;
  }
  if (hasPageHighlights) {
    return true;
  }
  if (!extraction.questions.length && extractQuestionNumbersFromText(pageText).length > 0) {
    return true;
  }
  const questionsMissingOptions = extraction.questions.filter((question) => {
    const draft = question as ImportedQuestionDraft;
    const questionText = String(draft.text || question.enunciado || '');
    const expectedOptionsCount = inferExpectedOptionsCountFromText(questionText, pageText)
      || getExpectedOptionsCount(draft.modality, draft.expectedOptionsCount ?? draft.expected_options_count);
    return normalizeImportedOptions(draft.options, questionText, draft.modality).options.length < expectedOptionsCount;
  });
  if (questionsMissingOptions.length > 0) {
    const lastQuestion = extraction.questions[extraction.questions.length - 1] as ImportedQuestionDraft | undefined;
    const lastQuestionNumber = normalizeQuestionNumber(lastQuestion?.number || lastQuestion?.questionNumber, 0);
    const onlyLastQuestionIsIncomplete = lastQuestionNumber > 0 && questionsMissingOptions.every((question) => {
      const draft = question as ImportedQuestionDraft;
      return normalizeQuestionNumber(draft.number || draft.questionNumber, 0) === lastQuestionNumber;
    });
    if (onlyLastQuestionIsIncomplete) {
      return false;
    }
    return true;
  }
  return extraction.questions.length > 0 && pageLikelyHasFigure(pageText);
};

const mergeExtractionText = (...values: Array<unknown>) => {
  const parts = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join('\n\n');
};

const normalizeExtractionFigureBox = (box?: FigureBox) => {
  if (!box) {
    return undefined;
  }

  const normalized = {
    x: Number(box.x),
    y: Number(box.y),
    width: Number(box.width),
    height: Number(box.height),
  };

  return Object.values(normalized).every((value) => Number.isFinite(value))
    ? normalized
    : undefined;
};

const normalizeExtractionFigureBoxes = (...values: Array<FigureBox | FigureBox[] | undefined>) => (
  values
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .map((box) => normalizeExtractionFigureBox(box))
    .filter(Boolean)
    .filter((box, index, list) => {
      const signature = [box?.x, box?.y, box?.width, box?.height]
        .map((value) => Math.round(Number(value) || 0))
        .join(':');
      return list.findIndex((item) => [item?.x, item?.y, item?.width, item?.height]
        .map((value) => Math.round(Number(value) || 0))
        .join(':') === signature) === index;
    }) as FigureBox[]
);

const mergeFigureBoxes = (boxes: FigureBox[]) => {
  const normalizedBoxes = boxes
    .map((box) => normalizeExtractionFigureBox(box))
    .filter(Boolean) as FigureBox[];
  if (normalizedBoxes.length === 0) {
    return undefined;
  }

  const bounds = normalizedBoxes.map((box) => ({
    x: Number(box.x),
    y: Number(box.y),
    right: Number(box.x) + Number(box.width),
    bottom: Number(box.y) + Number(box.height),
  }));
  const x = Math.max(0, Math.min(...bounds.map((box) => box.x)));
  const y = Math.max(0, Math.min(...bounds.map((box) => box.y)));
  const right = Math.min(1000, Math.max(...bounds.map((box) => box.right)));
  const bottom = Math.min(1000, Math.max(...bounds.map((box) => box.bottom)));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
};

const mergeQuestionExtractionDraft = (
  previous: PageExtractionResult['questions'][number],
  next: PageExtractionResult['questions'][number],
): PageExtractionResult['questions'][number] => {
  const previousDraft = previous as ImportedQuestionDraft;
  const nextDraft = next as ImportedQuestionDraft;
  const previousNormalized = normalizeImportedOptions(
    previousDraft.options,
    String(previousDraft.text || previous.enunciado || ''),
    previousDraft.modality,
  );
  const nextNormalized = normalizeImportedOptions(
    nextDraft.options,
    String(nextDraft.text || next.enunciado || ''),
    nextDraft.modality,
  );
  const previousOptionsCount = previousNormalized.options.length;
  const nextOptionsCount = nextNormalized.options.length;
  const preferNextCore = nextOptionsCount > previousOptionsCount
    || (
      nextOptionsCount === previousOptionsCount
      && String(nextDraft.text || next.enunciado || '').length > String(previousDraft.text || previous.enunciado || '').length
      && nextOptionsCount > 0
    );
  const base = preferNextCore ? next : previous;
  const supplement = preferNextCore ? previous : next;
  const baseDraft = base as ImportedQuestionDraft;
  const supplementDraft = supplement as ImportedQuestionDraft;
  const mergedFigureDescription = mergeExtractionText(baseDraft.figureDescription, supplementDraft.figureDescription);
  const mergedImageDescriptions = [
    ...(Array.isArray(baseDraft.imageDescriptions) ? baseDraft.imageDescriptions : []),
    ...(Array.isArray(supplementDraft.imageDescriptions) ? supplementDraft.imageDescriptions : []),
  ].filter(Boolean);

  return {
    ...base,
    subject: baseDraft.subject || supplementDraft.subject,
    topic: baseDraft.topic || supplementDraft.topic,
    specificSubject: baseDraft.specificSubject || supplementDraft.specificSubject,
    difficulty: baseDraft.difficulty || supplementDraft.difficulty,
    level: baseDraft.level || supplementDraft.level,
    teacherComment: (base as { teacherComment?: string }).teacherComment || (supplement as { teacherComment?: string }).teacherComment,
    detailedComment: (base as { detailedComment?: string }).detailedComment || (supplement as { detailedComment?: string }).detailedComment,
    contextKey: baseDraft.contextKey || supplementDraft.contextKey,
    contextTitle: baseDraft.contextTitle || supplementDraft.contextTitle,
    contextScope: baseDraft.contextScope || supplementDraft.contextScope,
    supportText: baseDraft.supportText || supplementDraft.supportText,
    hasFigure: Boolean(baseDraft.hasFigure || supplementDraft.hasFigure),
    figureDescription: mergedFigureDescription,
    figureBox: normalizeExtractionFigureBox(baseDraft.figureBox || supplementDraft.figureBox),
    supportFigureBox: normalizeExtractionFigureBox(baseDraft.supportFigureBox || supplementDraft.supportFigureBox),
    supportFigureBoxes: normalizeExtractionFigureBoxes(
      baseDraft.supportFigureBoxes,
      supplementDraft.supportFigureBoxes,
      baseDraft.supportFigureBox || supplementDraft.supportFigureBox,
    ) as unknown as PageExtractionResult['questions'][number]['supportFigureBoxes'],
    optionFigureBox: normalizeExtractionFigureBox(baseDraft.optionFigureBox || supplementDraft.optionFigureBox),
    optionFigureBoxes: normalizeExtractionFigureBoxes(
      baseDraft.optionFigureBoxes,
      supplementDraft.optionFigureBoxes,
      baseDraft.optionFigureBox || supplementDraft.optionFigureBox,
    ) as unknown as PageExtractionResult['questions'][number]['optionFigureBoxes'],
    imageDescriptions: Array.from(new Set(mergedImageDescriptions)),
  };
};

const mergeQuestionEditorialPatch = (current: Question, patch: Partial<Question>): Question => ({
  ...current,
  ...patch,
  teacherComment: String(patch.teacherComment || '').trim()
    ? patch.teacherComment
    : current.teacherComment,
  detailedComment: String(patch.detailedComment || '').trim()
    ? patch.detailedComment
    : current.detailedComment,
});

const mergePageExtractionResults = (
  mechanical: PageExtractionResult,
  aiResult: PageExtractionResult,
): PageExtractionResult => {
  const byNumber = new Map<string, PageExtractionResult['questions'][number]>();
  [...(mechanical.questions || []), ...(aiResult.questions || [])].forEach((question) => {
    const number = String(question.number || question.questionNumber || '').trim();
    if (!number) {
      byNumber.set(`item-${byNumber.size}`, question);
      return;
    }

    const previous = byNumber.get(number);
    if (!previous) {
      byNumber.set(number, question);
      return;
    }

    const previousDraft = previous as ImportedQuestionDraft;
    const nextDraft = question as ImportedQuestionDraft;
    const previousOptions = normalizeImportedOptions(previousDraft.options, String(previousDraft.text || previous.enunciado || ''), previousDraft.modality).options.length;
    const nextOptions = normalizeImportedOptions(nextDraft.options, String(nextDraft.text || question.enunciado || ''), nextDraft.modality).options.length;
    byNumber.set(number, nextOptions >= previousOptions
      ? mergeQuestionExtractionDraft(previous, question)
      : mergeQuestionExtractionDraft(question, previous));
  });

  return {
    metadata: {
      ...(mechanical.metadata || {}),
      ...(aiResult.metadata || {}),
    },
    pageContexts: [
      ...(mechanical.pageContexts || []),
      ...(aiResult.pageContexts || []),
    ],
    questions: Array.from(byNumber.values()),
  };
};

const normalizeDifficulty = (value: string | number | undefined | null) => {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('facil') || normalized === '1') return 1;
  if (normalized.includes('dificil') || normalized === '3') return 3;
  return 2;
};

const createTaxonomyLabel = (name: string, extras: Record<string, unknown> = {}) => ({
  id: undefined,
  name,
  nome: name,
  slug: slugify(name),
  ...extras,
});

const getTaxonomyText = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }
  return String(item.name || item.nome || item.descricao || item.sigla || '').trim();
};

const getQuestionTaxonomyParts = (question: Question) => {
  const subjects = Array.isArray(question.assuntos) ? question.assuntos : [];
  const subject = subjects.find((item) => Boolean(item.materia));
  const nonSubjects = subjects.filter((item) => !item.materia);

  return {
    subject: getTaxonomyText(subject as unknown as QuestionTaxonomyLabel),
    topic: getTaxonomyText(nonSubjects[0] as unknown as QuestionTaxonomyLabel),
    specificSubject: getTaxonomyText(nonSubjects[1] as unknown as QuestionTaxonomyLabel),
  };
};

const uniqueTextList = (values: unknown[]) => values
  .map((value) => {
    if (value && typeof value === 'object') {
      return getTaxonomyText(value as QuestionTaxonomyLabel);
    }
    return String(value || '').trim();
  })
  .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);

const getRootFocusText = (value: string) => (
  String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0]
  || String(value || '').trim()
);

const getFocusSelectValue = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    const value = getRootFocusText(String(item).trim());
    return value ? `name:${slugify(value)}` : '';
  }

  const id = String(item.id ?? '').trim();
  if (id) {
    return `id:${id}`;
  }
  const slug = String(item.slug ?? '').trim();
  if (slug) {
    return `slug:${slug}`;
  }
  const label = getTaxonomyText(item);
  return label ? `name:${slugify(getRootFocusText(label))}` : '';
};

const getExtractedQuestionNumber = (question: Question, fallback: number) => {
  const record = question as Question & {
    questionNumber?: number | string;
    question_number?: number | string;
  };
  return normalizeQuestionNumber(record.questionNumber ?? record.question_number, fallback);
};

const appendExamYear = (title: string, year: string | number | undefined | null) => {
  const cleanTitle = String(title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const cleanYear = String(year || '').match(/\d{4}/)?.[0] || '';
  return cleanYear ? `${cleanTitle} (${cleanYear})` : cleanTitle;
};

const buildExamTitle = (metadata: ImportMetadata | null, fallback = 'Prova importada') => {
  const explicitTitle = String(metadata?.title || metadata?.examTitle || metadata?.name || metadata?.nome || '').trim();
  const roles = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role);
  const role = summarizeRoleList(roles, String(metadata?.role || metadata?.examName || metadata?.contestName || '').trim());
  const source = String(metadata?.source || metadata?.agency || '').trim();
  const year = metadata?.year || metadata?.ano || new Date().getFullYear();
  const baseTitle = explicitTitle || (role && source ? `${role} - ${source}` : fallback);
  return appendExamYear(baseTitle, year) || fallback;
};

const broaderTopicForSpecificSubject = (specificSubject: string, subject: string, fallbackTopic = '') => {
  const normalizedSpecific = normalizeComparisonText(specificSubject);
  const normalizedSubject = normalizeComparisonText(subject);
  const normalizedFallback = normalizeComparisonText(fallbackTopic);
  const languageSubject = /portugues|lingua portuguesa|gramatica|linguagens/.test(normalizedSubject);

  if (normalizedSpecific === 'crase') return 'Regência';
  if (/concordancia/.test(normalizedSpecific)) return 'Sintaxe';
  if (/regencia/.test(normalizedSpecific)) return 'Sintaxe';
  if (/pontuacao/.test(normalizedSpecific)) return languageSubject ? 'Sintaxe' : fallbackTopic;
  if (/acentuacao|ortografia/.test(normalizedSpecific)) return 'Fonologia e Ortografia';
  if (/ressonancia|frequencia|comprimento de onda|amplitude|interferencia|reflexao|refracao|difracao/.test(normalizedSpecific)) return 'Ondulatória';
  if (/calculo estequiometrico|mol|massa molar|balanceamento/.test(normalizedSpecific)) return 'Estequiometria';
  if (/area|perimetro|triangulo|circunferencia|poligono/.test(normalizedSpecific) && /geometria/.test(normalizedFallback)) return fallbackTopic;
  if (/inferencia|coesao|coerencia|sentido|referencia/.test(normalizedSpecific)) return 'Interpretação de texto';

  return fallbackTopic;
};

const findEnemAreaLabel = (...values: unknown[]) => {
  const normalizedValues = values.map((value) => normalizeComparisonText(String(value || ''))).filter(Boolean);
  return ENEM_SUBJECT_AREA_OPTIONS.find((areaName) => {
    const normalizedArea = normalizeComparisonText(areaName);
    return normalizedValues.some((value) => value === normalizedArea || value.includes(normalizedArea));
  }) || '';
};

const isEnemAreaLabel = (value: string) => ENEM_AREA_NORMALIZED_NAMES.has(normalizeComparisonText(value));

const findEnemDisciplineLabel = (values: unknown[], areaLabel = '') => {
  const normalizedValues = values.map((value) => normalizeComparisonText(String(value || ''))).filter(Boolean);
  if (normalizedValues.length === 0) {
    return '';
  }

  const allowedLabels = areaLabel
    ? ENEM_SUBJECT_AREA_DESCRIPTIONS[areaLabel as keyof typeof ENEM_SUBJECT_AREA_DESCRIPTIONS] || ENEM_DISCIPLINE_LABELS
    : ENEM_DISCIPLINE_LABELS;
  const allowedNormalized = new Set(allowedLabels.map((label) => normalizeComparisonText(label)));

  for (const label of allowedLabels) {
    const normalizedLabel = normalizeComparisonText(label);
    const baseLabel = normalizeComparisonText(String(label).replace(/\s*\([^)]*\)\s*/g, ' '));
    if (normalizedValues.some((value) => value === normalizedLabel || value === baseLabel)) {
      return label;
    }
  }

  const keywordMatch = ENEM_DISCIPLINE_KEYWORDS.find(({ label, keywords }) => (
    allowedNormalized.has(normalizeComparisonText(label))
    && keywords.some((keyword) => normalizedValues.some((value) => value.includes(normalizeComparisonText(keyword))))
  ));

  return keywordMatch?.label || '';
};

const isEnemImportSignal = (...values: unknown[]) => {
  const normalized = normalizeComparisonText(values.map((value) => String(value || '')).join(' '));
  return normalized.includes(normalizeComparisonText(ENEM_FOCUS_NAME))
    || normalized.includes('inep')
    || normalized.includes('exame nacional do ensino medio');
};

const normalizeEnemTaxonomyHierarchy = (
  subject: string,
  topic: string,
  specificSubject: string,
  textSignals: unknown[] = [],
) => {
  const areaLabel = findEnemAreaLabel(subject, topic, specificSubject, ...textSignals);
  const subjectIsArea = isEnemAreaLabel(subject);
  const topicIsArea = isEnemAreaLabel(topic);

  if (!areaLabel && !subjectIsArea && !topicIsArea) {
    return { subject, topic, specificSubject };
  }

  const discipline = findEnemDisciplineLabel(
    [subject, topic, specificSubject, ...textSignals],
    areaLabel,
  );
  if (!discipline) {
    return { subject, topic, specificSubject };
  }

  const normalizedDiscipline = normalizeComparisonText(discipline);
  const nextTopic = topicIsArea || normalizeComparisonText(topic) === normalizedDiscipline
    ? broaderTopicForSpecificSubject(specificSubject, discipline, '')
    : topic;

  return {
    subject: discipline,
    topic: nextTopic,
    specificSubject,
  };
};

const resolveTaxonomyHierarchy = (subject: string, topic: string, specificSubject: string) => {
  const normalizedTopic = normalizeComparisonText(topic);
  const normalizedSpecific = normalizeComparisonText(specificSubject);
  if (!normalizedSpecific || normalizedTopic !== normalizedSpecific) {
    return { subject, topic, specificSubject };
  }

  const broaderTopic = broaderTopicForSpecificSubject(specificSubject, subject, topic);
  return {
    subject,
    topic: broaderTopic && normalizeComparisonText(broaderTopic) !== normalizedSpecific ? broaderTopic : topic,
    specificSubject,
  };
};

const parseSubjectsInput = (value: string) => String(value || '')
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);

const deriveQuestionSubjects = (questions: Question[]) => questions
  .flatMap((question) => (question.assuntos || [])
    .filter((subject) => Boolean(subject.materia))
    .map((subject) => getTaxonomyText(subject as unknown as QuestionTaxonomyLabel)))
  .filter((subject, index, list) => subject.length > 0 && list.indexOf(subject) === index);

const applySharedExamMetadataToQuestion = (
  question: Question,
  field: ImportMetadataField,
  value: string,
): Question => {
  if (field === 'agency') {
    return {
      ...question,
      bancas: value ? [createTaxonomyLabel(value, { sigla: value })] : [],
    } as Question;
  }

  if (field === 'source') {
    return {
      ...question,
      orgaos: value ? [createTaxonomyLabel(value)] : [],
    } as Question;
  }

  if (field === 'role') {
    const roles = normalizeRoleList(value);
    return {
      ...question,
      cargos: roles.map((role) => createTaxonomyLabel(role, { descricao: role })),
    } as unknown as Question;
  }

  if (field === 'year') {
    const parsedYear = Number(String(value).replace(/\D/g, ''));
    return {
      ...question,
      anos: Number.isFinite(parsedYear) && parsedYear > 0 ? [parsedYear] : [],
    } as Question;
  }

  if (field === 'level') {
    return {
      ...question,
      nivel: value || null,
      level: value || null,
      niveis: value ? [createTaxonomyLabel(value)] : [],
    } as Question & { niveis?: QuestionTaxonomyLabel[] };
  }

  if (field === 'examType') {
    return {
      ...question,
      tiposProva: value ? [createTaxonomyLabel(value)] : [],
    } as unknown as Question;
  }

  return question;
};

export const useAdminImportWorkflow = ({
  systemSettings,
  addToast,
  onImportedQuestionsSaved,
  updateSystemSettings,
  saveSystemSettingsNow,
}: UseAdminImportWorkflowOptions) => {
  const [qFile, setQFile] = useState<File | null>(null);
  const [kFile, setKFile] = useState<File | null>(null);
  const [selectedFocusId, setSelectedFocusId] = useState('');
  const [manualFocusName, setManualFocusName] = useState('');
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | null>(null);
  const [extractedContexts, setExtractedContexts] = useState<ImportedContextDraft[]>([]);
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostics>({
    expectedQuestionNumbers: [],
    extractedQuestionNumbers: [],
    missingQuestionNumbers: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractWithComment, setExtractWithComment] = useState(false);
  const [extractWithDetailedAnalysis, setExtractWithDetailedAnalysis] = useState(false);
  const [examProgress, setExamProgress] = useState(0);
  const [keyProgress, setKeyProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isRetryingMissingQuestions, setIsRetryingMissingQuestions] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [generatingSpecific, setGeneratingSpecific] = useState<{ index: number; type: GenerateSpecificType } | null>(null);
  const [publishedExam, setPublishedExam] = useState<Record<string, unknown> | null>(null);
  const [publishedQuestionNumbers, setPublishedQuestionNumbers] = useState<number[]>([]);
  const [publishingAction, setPublishingAction] = useState<ImportPublishAction | null>(null);

  const addLog = (message: string) => {
    setLogs((previous) => [`> ${message}`, ...previous].slice(0, 50));
  };

  const resolveSelectedFocus = (): QuestionTaxonomyLabel | null => {
    const manualName = manualFocusName.trim();
    if (manualName) {
      return createTaxonomyLabel(manualName);
    }

    const focus = (systemSettings.taxonomies?.careers || [])
      .find((item) => getFocusSelectValue(item as QuestionTaxonomyLabel) === selectedFocusId);
    const focusName = getRootFocusText(getTaxonomyText(focus as QuestionTaxonomyLabel | undefined));
    return focusName ? { ...(focus as QuestionTaxonomyLabel), name: focusName, nome: focusName } : null;
  };

  const getTaxonomyReferenceNames = () => {
    const taxonomies = systemSettings.taxonomies;
    return {
      subjects: uniqueTextList(taxonomies?.subjects || []),
      topics: uniqueTextList([
        ...(taxonomies?.subjectTopics || []),
        ...(taxonomies?.topics || []),
      ]),
      specificSubjects: uniqueTextList(taxonomies?.specificSubjects || []),
    };
  };

  const getTaxonomyReferenceItems = () => {
    const taxonomies = systemSettings.taxonomies;
    return {
      subjects: (taxonomies?.subjects || []) as unknown as QuestionTaxonomyLabel[],
      topics: [
        ...((taxonomies?.subjectTopics || []) as unknown as QuestionTaxonomyLabel[]),
        ...((taxonomies?.topics || []) as unknown as QuestionTaxonomyLabel[]),
      ],
      specificSubjects: (taxonomies?.specificSubjects || []) as unknown as QuestionTaxonomyLabel[],
    };
  };

  const isAiConfigured = () => Boolean(
    systemSettings.hasGeminiApiKeyConfigured
    || systemSettings.hasOpenAiApiKeyConfigured
    || systemSettings.geminiApiKey
    || systemSettings.openaiApiKey,
  );

  const isCurrentImportEnem = (...values: unknown[]) => isEnemImportSignal(
    importMetadata?.examType,
    importMetadata?.role,
    importMetadata?.roles,
    importMetadata?.cargos,
    importMetadata?.title,
    importMetadata?.examTitle,
    importMetadata?.source,
    importMetadata?.agency,
    getTaxonomyText(resolveSelectedFocus()),
    ...values,
  );

  const normalizeTaxonomyForCurrentImport = (
    subject: string,
    topic: string,
    specificSubject: string,
    textSignals: unknown[] = [],
  ) => {
    const initial = isCurrentImportEnem(subject, topic, specificSubject, ...textSignals)
      ? normalizeEnemTaxonomyHierarchy(subject, topic, specificSubject, textSignals)
      : { subject, topic, specificSubject };

    return resolveTaxonomyHierarchy(initial.subject, initial.topic, initial.specificSubject);
  };

  const findExistingTaxonomyByName = (
    items: QuestionTaxonomyLabel[],
    name: string,
    parentName = '',
  ) => {
    const normalizedName = normalizeComparisonText(name);
    const normalizedParent = normalizeComparisonText(parentName);
    if (!normalizedName) {
      return null;
    }

    const matches = items.filter((item) => {
      const itemName = normalizeComparisonText(getTaxonomyText(item));
      const itemSlug = normalizeComparisonText(String(item.slug || '').replace(/-/g, ' '));
      const itemCleanName = normalizeComparisonText(String(item.nome_clean || ''));
      return itemName === normalizedName || itemSlug === normalizedName || itemCleanName === normalizedName;
    });

    if (matches.length <= 1 || !normalizedParent) {
      return matches[0] || null;
    }

    return matches.find((item) => [
      item.parentName,
      item.parent_name,
      item.parent,
      item.paiNome,
      item.pai_nome,
      item.rootSubjectName,
      item.root_subject_name,
    ].some((value) => normalizeComparisonText(String(value || '')) === normalizedParent)) || matches[0] || null;
  };

  const createResolvedTaxonomyLabel = (
    name: string,
    items: QuestionTaxonomyLabel[],
    extras: Record<string, unknown> = {},
    parentName = '',
  ) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return null;
    }

    const existing = findExistingTaxonomyByName(items, cleanName, parentName);
    if (existing) {
      const existingName = getTaxonomyText(existing) || cleanName;
      return {
        ...existing,
        ...extras,
        id: existing.id,
        name: existingName,
        nome: existingName,
        slug: existing.slug || slugify(existingName),
      } as QuestionTaxonomyLabel;
    }

    return createTaxonomyLabel(cleanName, extras) as QuestionTaxonomyLabel;
  };

  const buildResolvedSubjectTaxonomies = (
    question: Question,
    updates: Partial<Record<'subject' | 'topic' | 'specificSubject', string>>,
  ) => {
    const current = getQuestionTaxonomyParts(question);
    const draft = question as unknown as ImportedQuestionDraft;
    const hierarchy = normalizeTaxonomyForCurrentImport(
      updates.subject ?? current.subject,
      updates.topic ?? current.topic,
      updates.specificSubject ?? current.specificSubject,
      [
        question.enunciado,
        draft.text,
        draft.introText,
        draft.supportText,
        draft.referenceText,
        ...(Array.isArray(question.itens) ? question.itens.map((item) => item.corpo) : []),
      ],
    );
    const references = getTaxonomyReferenceItems();
    const subject = createResolvedTaxonomyLabel(hierarchy.subject, references.subjects, { materia: true });
    const topic = createResolvedTaxonomyLabel(
      hierarchy.topic,
      references.topics,
      { materia: false },
      hierarchy.subject,
    );
    const specificSubject = createResolvedTaxonomyLabel(
      hierarchy.specificSubject,
      references.specificSubjects,
      { materia: false, parentName: hierarchy.topic || hierarchy.subject },
      hierarchy.topic || hierarchy.subject,
    );

    return [subject, topic, specificSubject].filter(Boolean) as unknown as Question['assuntos'];
  };

  const applyTaxonomyClassificationToQuestion = (
    question: Question,
    classification: {
      subject?: string;
      topic?: string;
      specificSubject?: string;
      difficulty?: string;
    },
  ) => {
    const current = getQuestionTaxonomyParts(question);
    const nextSubject = String(classification.subject || current.subject || '').trim();
    const nextTopic = String(classification.topic || current.topic || '').trim();
    const nextSpecificSubject = String(classification.specificSubject || current.specificSubject || '').trim();
    const hierarchy = resolveTaxonomyHierarchy(nextSubject, nextTopic, nextSpecificSubject);

    if (!nextSpecificSubject && !nextSubject && !nextTopic) {
      return question;
    }

    return {
      ...question,
      assuntos: buildResolvedSubjectTaxonomies(question, {
        subject: hierarchy.subject,
        topic: hierarchy.topic,
        specificSubject: hierarchy.specificSubject,
      }),
      ...(classification.difficulty
        ? {
          dificuldade: normalizeDifficulty(classification.difficulty),
          difficulty: classification.difficulty,
        }
        : {}),
    } as Question;
  };

  const shouldReclassifyQuestionTaxonomy = (taxonomy: {
    subject: string;
    topic: string;
    specificSubject: string;
  }) => {
    const subject = normalizeComparisonText(taxonomy.subject);
    const topic = normalizeComparisonText(taxonomy.topic);
    const specificSubject = normalizeComparisonText(taxonomy.specificSubject);
    const weakLabels = new Set(['', 'geral', 'generico', 'diversos', 'diverso', 'outros', 'outras']);

    if (
      weakLabels.has(subject)
      || weakLabels.has(topic)
      || weakLabels.has(specificSubject)
      || ENEM_AREA_NORMALIZED_NAMES.has(subject)
      || ENEM_AREA_NORMALIZED_NAMES.has(topic)
    ) {
      return true;
    }

    return topic === specificSubject
      || subject === topic
      || subject === specificSubject;
  };

  const classifyMissingQuestionSubjects = async (questions: Question[], pageIndex: number | string) => {
    const logScope = typeof pageIndex === 'number' ? `Pag ${pageIndex}` : pageIndex;
    const pending = questions
      .map((question, index) => {
        const taxonomy = getQuestionTaxonomyParts(question);
        return { question, index, taxonomy };
      })
      .filter(({ taxonomy }) => shouldReclassifyQuestionTaxonomy(taxonomy));

    if (pending.length === 0) {
      return questions;
    }

    if (!isAiConfigured()) {
      addLog(`${logScope}: filtros incompletos/suspeitos em ${pending.length} questao(oes); IA nao configurada.`);
      return questions;
    }

    const references = getTaxonomyReferenceNames();
    const nextQuestions = [...questions];
    const chunkSize = 10;
    let filledCount = 0;

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const classifications = await aiService.classifyImportedQuestionTaxonomies({
          ...references,
          questions: chunk.map(({ question, index, taxonomy }) => ({
            localId: String(index),
            number: getExtractedQuestionNumber(question, index + 1),
            text: String(question.enunciado || ''),
            options: (question.itens || []).map((item) => String(item.corpo || '')).filter(Boolean),
            currentSubject: taxonomy.subject,
            currentTopic: taxonomy.topic,
            currentSpecificSubject: taxonomy.specificSubject,
          })),
        });
        const classificationsById = new Map(
          classifications.map((classification) => [String(classification.localId), classification]),
        );

        chunk.forEach(({ question, index }) => {
          const classification = classificationsById.get(String(index));
          if (!classification?.specificSubject) {
            return;
          }
          nextQuestions[index] = applyTaxonomyClassificationToQuestion(question, classification);
          filledCount += 1;
        });
      } catch (error) {
        addLog(`${logScope}: IA nao conseguiu classificar filtros do lote (${readErrorMessage(error)}).`);
      }
    }

    if (filledCount > 0) {
      addLog(`${logScope}: IA revisou filtros de ${filledCount} questao(oes).`);
    }

    return nextQuestions;
  };

  const applyQuestionPartsRepair = (
    question: Question,
    repairedParts: Awaited<ReturnType<typeof aiService.repairImportedQuestionParts>>,
  ) => {
    const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
    const supportParts = splitQuestionSupportReference(String(repairedParts.supportText || '').trim());
    const repairedSupportText = sanitizeSupportContextText(supportParts.supportText || String(repairedParts.supportText || '').trim());
    const repairedReferenceText = mergeReferenceText(
      String(repairedParts.referenceText || '').trim(),
      supportParts.referenceText,
    );
    const repairedStatement = stripTrailingExamNoise(
      String(repairedParts.statement || '').replace(/\s+/g, ' ').trim(),
    );
    const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
    const currentOptions = getQuestionOptionTexts(question);
    const canReplaceOptions = !hasVisualOptionPayload(question)
      && repairedOptions.length >= 2
      && (
        currentOptions.length < expectedOptionsCount
        || readOptionMarkers(stripHtml(getQuestionStatementText(question))).length >= Math.min(3, expectedOptionsCount)
      );
    const nextItems = canReplaceOptions
      ? repairedOptions.map((option, optionIndex) => {
        const previous = question.itens?.[optionIndex];
        const label = previous?.rotulo || String.fromCharCode(65 + optionIndex);
        return {
          ...(previous || {}),
          id: previous?.id || optionIndex + 1,
          ordem: optionIndex + 1,
          rotulo: label,
          corpo: option,
          corpo_clean: stripHtml(option),
        };
      })
      : question.itens;
    const introText = repairedSupportText || getQuestionIntroText(question);
    const referenceText = repairedReferenceText || getQuestionReferenceText(question);

    return {
      ...question,
      ...(repairedStatement ? {
        enunciado: repairedStatement,
        enunciado_clean: stripHtml(repairedStatement),
      } : {}),
      introText,
      intro_text: introText,
      referenceText,
      reference_text: referenceText,
      itens: nextItems,
      needsImportReview: canReplaceOptions
        ? nextItems.length < expectedOptionsCount
        : Boolean((question as unknown as { needsImportReview?: boolean }).needsImportReview),
    } as unknown as Question;
  };

  const reviewQuestionPartsAfterExtraction = async (questions: Question[]) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => shouldRunFinalQuestionPartsReview(question));

    if (pending.length === 0) {
      return questions;
    }

    if (!isAiConfigured()) {
      addLog(`Revisao final: ${pending.length} questao(oes) com separacao suspeita; IA nao configurada.`);
      return questions;
    }

    addLog(`Revisao final: IA conferindo texto de apoio, referencia, enunciado e alternativas em ${pending.length} questao(oes) suspeita(s).`);
    const nextQuestions = [...questions];

    for (const { question, index } of pending) {
      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const expectedOptionsCount = getQuestionExpectedOptionsCount(question);

      try {
        const repairedParts = await aiService.repairImportedQuestionParts({
          rawText: buildFinalQuestionReviewRawText(question),
          supportText: getQuestionIntroText(question),
          referenceText: getQuestionReferenceText(question),
          statement: getQuestionStatementText(question),
          options: getQuestionOptionTexts(question),
          modality: String((question as unknown as { modality?: unknown }).modality || question.tipo || ''),
        });
        const confidence = Number(repairedParts.confidence ?? 0);
        const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
        const hasUsefulRepair = Boolean(
          String(repairedParts.statement || '').trim()
          || String(repairedParts.supportText || '').trim()
          || String(repairedParts.referenceText || '').trim()
          || repairedOptions.length >= 2,
        );

        if (!hasUsefulRepair || confidence < 0.45) {
          addLog(`Questao #${questionNumber}: IA nao teve seguranca para revisar a separacao automaticamente.`);
          continue;
        }

        nextQuestions[index] = applyQuestionPartsRepair(question, repairedParts);
        addLog(`Questao #${questionNumber}: separacao final revisada por IA.`);
      } catch (error) {
        addLog(`Questao #${questionNumber}: revisao final por IA falhou (${readErrorMessage(error)}).`);
      }
    }

    return nextQuestions;
  };

  const generateDetailedAnalysesForQuestions = async (
    questions: Question[],
    options: { updateLiveState?: boolean; logLabel?: string } = {},
  ) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !String(question.detailedComment || '').trim());

    if (pending.length === 0) {
      return questions;
    }

    const updatedQuestions = [...questions];
    const chunkSize = 5;
    let processed = 0;

    addLog(options.logLabel || `Gerando analise detalhada em lote para ${pending.length} questao(oes)...`);

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const analyses = await aiService.generateDetailedAnalysesBatch(chunk.map(({ question, index }) => ({
          localId: String(index),
          question,
        })));

        chunk.forEach(({ question, index }) => {
          const markdown = analyses[String(index)];
          if (markdown) {
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              detailedComment: markdown,
            });
          }
        });
      } catch (error) {
        addLog(`Lote de analise detalhada falhou (${readErrorMessage(error)}). Tentando questoes do lote individualmente.`);
        for (const { question, index } of chunk) {
          try {
            const detail = await aiService.generateDetailedAnalysis(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              detailedComment: detail,
            });
          } catch {
            addLog(`Erro ao gerar detalhado para questao ${index + 1}.`);
          }
        }
      }

      processed += chunk.length;
      setBulkProgress(Math.round((processed / pending.length) * 100));
      if (options.updateLiveState) {
        setExtractedQuestions((current) => current.map((question, index) => (
          updatedQuestions[index]
            ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
            : question
        )));
      }
    }

    return updatedQuestions;
  };

  const generateTeacherCommentsForQuestions = async (
    questions: Question[],
    options: { updateLiveState?: boolean; logLabel?: string } = {},
  ) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !String(question.teacherComment || '').trim());

    if (pending.length === 0) {
      return questions;
    }

    const updatedQuestions = [...questions];
    const chunkSize = 8;
    let processed = 0;

    if (options.logLabel) {
      addLog(options.logLabel);
    }

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const comments = await aiService.generateTeacherCommentsBatch(chunk.map(({ question, index }) => ({
          localId: String(index),
          question,
        })));

        chunk.forEach(({ question, index }) => {
          const comment = comments[String(index)];
          if (comment) {
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              teacherComment: comment,
            });
          }
        });
      } catch (error) {
        addLog(`Lote de comentarios do professor falhou (${readErrorMessage(error)}). Tentando questoes do lote individualmente.`);
        for (const { question, index } of chunk) {
          try {
            const comment = await aiService.generateTeacherComment(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              teacherComment: comment,
            });
          } catch {
            addLog(`Erro ao gerar comentario do professor para questao ${index + 1}.`);
          }
        }
      }

      processed += chunk.length;
      setBulkProgress(Math.round((processed / pending.length) * 100));
      if (options.updateLiveState) {
        setExtractedQuestions((current) => current.map((question, index) => (
          updatedQuestions[index]
            ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
            : question
        )));
      }
    }

    return updatedQuestions;
  };

  const mergeMetadata = (current: ImportMetadata | null, next: PageExtractionResult['metadata']) => {
    const normalizedNext = toImportMetadata(next);
    if (!normalizedNext) {
      return current;
    }

    const merged = {
      ...(current || {}),
      ...Object.fromEntries(
        Object.entries(normalizedNext).filter(([, value]) => String(value ?? '').trim() !== ''),
      ),
    } as ImportMetadata;
    const roles = normalizeRoleList(current?.roles, current?.cargos, current?.role, normalizedNext.roles, normalizedNext.cargos, normalizedNext.role);
    const role = summarizeRoleList(roles, merged.role || merged.examName || merged.contestName || '');

    return {
      ...merged,
      ...(role ? { role } : {}),
      ...(roles.length > 0 ? { roles, cargos: roles } : {}),
      ...buildBookletMetadata(merged),
    } as ImportMetadata;
  };

  const getContextFigureSignature = (context: Partial<ImportedContextDraft>) => {
    if (!context.hasFigure || !context.figureBox || !context.page) {
      return '';
    }

    const box = context.figureBox;
    const snap = (value: unknown) => Math.round((Number(value) || 0) / 12) * 12;
    const values = [box.x, box.y, box.width, box.height].map(snap);
    if (values.some((value) => value <= 0) || values[2] <= 0 || values[3] <= 0) {
      return '';
    }

    return `pag-${context.page}:figura:${values.join(':')}`;
  };

  const mergeContextText = (...values: Array<string | undefined>) => {
    const parts = values
      .flatMap((value) => String(value || '').split(/\n{2,}/))
      .map((value) => value.trim())
      .filter(Boolean);

    const kept: string[] = [];
    parts.forEach((part) => {
      const normalizedPart = normalizeComparisonText(part);
      if (!normalizedPart) {
        return;
      }

      const containedIndex = kept.findIndex((item) => normalizeComparisonText(item).includes(normalizedPart));
      if (containedIndex >= 0) {
        return;
      }

      for (let index = kept.length - 1; index >= 0; index -= 1) {
        const normalizedExisting = normalizeComparisonText(kept[index]);
        if (normalizedPart.includes(normalizedExisting)) {
          kept.splice(index, 1);
        }
      }

      kept.push(part);
    });

    return kept.join('\n\n');
  };

  const removeContainedPartialContextsForQuestion = (
    contextMap: Map<string, ImportedContextDraft>,
    questionNumber: number,
    fullSupportText: string,
  ) => {
    const normalizedFullText = normalizeComparisonText(fullSupportText);
    if (!questionNumber || normalizedFullText.length < 80) {
      return;
    }

    Array.from(contextMap.entries()).forEach(([tempId, context]) => {
      if (!context.questionNumbers.includes(questionNumber) || context.hasFigure) {
        return;
      }

      const normalizedContextText = normalizeComparisonText(context.text);
      if (
        normalizedContextText
        && normalizedContextText.length < normalizedFullText.length
        && normalizedFullText.includes(normalizedContextText)
      ) {
        contextMap.delete(tempId);
      }
    });
  };

  const isTextOnlyContextDraft = (context: ImportedContextDraft) => (
    Boolean(context.text)
    && !context.hasFigure
    && !context.figureDescription
    && !context.imageData
  );

  const clearQuestionContextLink = (question: Question, contextTempId: string) => {
    const draft = question as Question & {
      contextKey?: string;
      grupoQuestaoTempId?: string | number;
      contextTempId?: string | number;
      grupoQuestaoId?: string | number | null;
      grupo_questao_id?: string | number | null;
    };

    if (
      String(draft.contextKey || '') !== contextTempId
      && String(draft.grupoQuestaoTempId || '') !== contextTempId
      && String(draft.contextTempId || '') !== contextTempId
    ) {
      return question;
    }

    return {
      ...question,
      contextKey: '',
      grupoQuestaoTempId: undefined,
      contextTempId: undefined,
      grupoQuestaoId: null,
      grupo_questao_id: null,
    } as Question;
  };

  const attachQuestionContextLink = (question: Question, contextTempId: string) => ({
    ...question,
    introText: '',
    intro_text: '',
    contextKey: contextTempId,
    grupoQuestaoTempId: contextTempId,
    contextTempId,
  } as Question);

  const normalizeQuestionContextUsage = (
    questions: Question[],
    contextMap: Map<string, ImportedContextDraft>,
  ) => {
    let nextQuestions = questions.map((question) => ({ ...question }));

    Array.from(contextMap.entries()).forEach(([tempId, context]) => {
      const questionNumbers = Array.from(new Set(context.questionNumbers.filter((number) => number > 0)));
      if (questionNumbers.length !== 1 || !isTextOnlyContextDraft(context)) {
        return;
      }

      const questionNumber = questionNumbers[0];
      nextQuestions = nextQuestions.map((question, index) => {
        if (getExtractedQuestionNumber(question, index + 1) !== questionNumber) {
          return question;
        }

        const mergedIntroText = mergeContextText((question as { introText?: string }).introText, context.text);
        return {
          ...clearQuestionContextLink(question, tempId),
          introText: mergedIntroText,
          intro_text: mergedIntroText,
        } as Question;
      });
      contextMap.delete(tempId);
    });

    const introTextGroups = new Map<string, { text: string; questionNumbers: number[] }>();
    nextQuestions.forEach((question, index) => {
      const introText = String((question as { introText?: string; intro_text?: string }).introText || (question as { intro_text?: string }).intro_text || '').trim();
      const normalizedIntroText = normalizeComparisonText(introText);
      if (normalizedIntroText.length < 80) {
        return;
      }

      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const group = introTextGroups.get(normalizedIntroText) || { text: introText, questionNumbers: [] };
      group.questionNumbers.push(questionNumber);
      introTextGroups.set(normalizedIntroText, group);
    });

    introTextGroups.forEach((group, normalizedIntroText) => {
      const questionNumbers = Array.from(new Set(group.questionNumbers)).sort((a, b) => a - b);
      const matchingSharedContext = Array.from(contextMap.entries()).find(([, context]) => (
        isTextOnlyContextDraft(context)
        && context.questionNumbers.length > 1
        && normalizeComparisonText(context.text) === normalizedIntroText
      ));

      if (matchingSharedContext) {
        const [tempId, context] = matchingSharedContext;
        context.questionNumbers = Array.from(new Set([...context.questionNumbers, ...questionNumbers])).sort((a, b) => a - b);
        contextMap.set(tempId, context);
        nextQuestions = nextQuestions.map((question, index) => (
          questionNumbers.includes(getExtractedQuestionNumber(question, index + 1))
            ? attachQuestionContextLink(question, tempId)
            : question
        ));
        return;
      }

      if (questionNumbers.length < 2) {
        return;
      }

      const tempId = `contexto-compartilhado-${slugify(normalizedIntroText.slice(0, 72))}`;
      upsertContextDraft(contextMap, {
        tempId,
        title: `Texto de apoio compartilhado (${questionNumbers.join(', ')})`,
        text: group.text,
        questionNumbers,
        hasFigure: false,
        figureDescription: '',
        page: 0,
      });

      nextQuestions = nextQuestions.map((question, index) => (
        questionNumbers.includes(getExtractedQuestionNumber(question, index + 1))
          ? attachQuestionContextLink(question, tempId)
          : question
      ));
    });

    return {
      questions: nextQuestions,
      contexts: Array.from(contextMap.values()),
    };
  };

  const upsertContextDraft = (
    contextMap: Map<string, ImportedContextDraft>,
    context: Partial<ImportedContextDraft>,
  ) => {
    const tempId = String(context.tempId || '').trim();
    if (!tempId) {
      return '';
    }

    const incomingText = sanitizeSupportContextText(context.text || '');
    const signature = getContextFigureSignature(context);
    const matchingContext = signature
      ? Array.from(contextMap.values()).find((item) => getContextFigureSignature(item) === signature)
      : null;
    const targetTempId = matchingContext?.tempId || tempId;
    const previous = contextMap.get(targetTempId);
    const isOnlyBookletHeader = !previous
      && !context.hasFigure
      && !context.figureDescription
      && isLikelyPageBookletHeader(incomingText);
    if (isOnlyBookletHeader) {
      return '';
    }

    const questionNumbers = [
      ...(previous?.questionNumbers || []),
      ...(context.questionNumbers || []),
    ].filter((value, index, list) => list.indexOf(value) === index);

    contextMap.set(targetTempId, {
      tempId: targetTempId,
      title: context.title || previous?.title || 'Contexto da prova',
      text: mergeContextText(previous?.text, incomingText),
      questionNumbers,
      hasFigure: Boolean(previous?.hasFigure || context.hasFigure),
      figureDescription: mergeContextText(previous?.figureDescription, context.figureDescription),
      page: context.page || previous?.page || 0,
      imageData: context.imageData || previous?.imageData,
      pageImageData: context.pageImageData || previous?.pageImageData,
      figureBox: context.figureBox || previous?.figureBox,
      manualCropApplied: Boolean(previous?.manualCropApplied || context.manualCropApplied),
    });
    return targetTempId;
  };

  const pdfToImage = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (context) {
      await page.render({ canvasContext: context, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }

    throw new Error('Falha ao renderizar PDF');
  };

  const cropFigureImage = async (
    pageImageBase64: string,
    figureBox?: FigureBox,
    options: { manual?: boolean } = {},
  ): Promise<string | undefined> => {
    if (!figureBox) {
      return undefined;
    }

    const box = {
      x: Number(figureBox.x),
      y: Number(figureBox.y),
      width: Number(figureBox.width),
      height: Number(figureBox.height),
    };

    const values = [box.x, box.y, box.width, box.height];
    if (values.some((value) => !Number.isFinite(value)) || box.width <= 0 || box.height <= 0) {
      return undefined;
    }

    const normalizedArea = (box.width * box.height) / 1_000_000;
    if (!options.manual && (normalizedArea > 0.7 || box.width > 920 || box.height > 920)) {
      addLog('Figura ignorada: a caixa retornada pela IA parecia abranger a pagina inteira.');
      return undefined;
    }

    const image = new Image();
    const dataUrl = pageImageBase64.startsWith('data:')
      ? pageImageBase64
      : `data:image/jpeg;base64,${pageImageBase64}`;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Falha ao carregar imagem para recorte.'));
      image.src = dataUrl;
    });

    const boxPixelWidth = Math.round((box.width / 1000) * image.naturalWidth);
    const boxPixelHeight = Math.round((box.height / 1000) * image.naturalHeight);
    const clampPadding = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const paddingX = options.manual ? 0 : clampPadding(Math.round(boxPixelWidth * 0.055), 16, 46);
    const paddingY = options.manual ? 0 : clampPadding(Math.round(boxPixelHeight * 0.065), 16, 54);
    const boxLeft = Math.round((box.x / 1000) * image.naturalWidth);
    const boxTop = Math.round((box.y / 1000) * image.naturalHeight);
    const boxRight = Math.round(((box.x + box.width) / 1000) * image.naturalWidth);
    const boxBottom = Math.round(((box.y + box.height) / 1000) * image.naturalHeight);
    const sourceX = Math.max(0, boxLeft - paddingX);
    const sourceY = Math.max(0, boxTop - paddingY);
    const sourceRight = Math.min(image.naturalWidth, boxRight + paddingX);
    const sourceBottom = Math.min(image.naturalHeight, boxBottom + paddingY);
    const sourceWidth = sourceRight - sourceX;
    const sourceHeight = sourceBottom - sourceY;

    if (sourceWidth <= 20 || sourceHeight <= 20) {
      return undefined;
    }

    const croppedAreaRatio = (sourceWidth * sourceHeight) / (image.naturalWidth * image.naturalHeight);
    if (!options.manual && croppedAreaRatio > 0.82) {
      addLog('Figura ignorada: mesmo apos o ajuste, o recorte ficou grande demais para ser uma figura isolada.');
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  };

  const createVisualOptionHtml = (label: string, imageBase64: string) => (
    `<img src="${imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}" alt="Alternativa ${label}" loading="lazy" />`
  );

  const extractFirstInlineImageData = (html?: string) => {
    const match = String(html || '').match(/<img\b[^>]*\bsrc\s*=\s*["'](data:image\/[^"']+)["'][^>]*>/i);
    return match?.[1] || '';
  };

  const createSupportImageHtml = (image: ImportedQuestionImageDraft, fallbackIndex: number) => {
    if (!image.imageData) {
      return '';
    }

    const title = image.title || `Figura ${fallbackIndex + 1}`;
    const description = image.description || '';
    return [
      '<figure class="question-support-figure">',
      `<img src="data:image/jpeg;base64,${image.imageData}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy" />`,
      description ? `<figcaption>${description}</figcaption>` : '',
      '</figure>',
    ].filter(Boolean).join('');
  };

  const buildIntroTextWithSupportImages = (question: Question) => {
    const draft = question as unknown as ImportedQuestionDraft;
    const introText = formatStructuredSupportHtml(String(draft.introText || (question as { intro_text?: string }).intro_text || '').trim());
    const supportImages = Array.isArray(draft.supportImages) ? draft.supportImages : [];
    const imageHtml = supportImages
      .map((image, index) => createSupportImageHtml(image, index))
      .filter(Boolean)
      .join('\n\n');

    if (!imageHtml) {
      if (!introText || introText === String(draft.introText || (question as { intro_text?: string }).intro_text || '').trim()) {
        return question;
      }

      return {
        ...question,
        introText,
        intro_text: introText,
      } as Question;
    }

    const nextIntroText = [introText, imageHtml].filter(Boolean).join('\n\n');
    return {
      ...question,
      introText: nextIntroText,
      intro_text: nextIntroText,
    } as Question;
  };

  type CroppedOptionImage = {
    imageData: string;
    figureBox: FigureBox;
  };

  const cropVisualOptionImages = async (
    pageImageBase64: string,
    figureBox: FigureBox | undefined,
    optionCount: number,
  ): Promise<CroppedOptionImage[]> => {
    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!pageImageBase64 || !normalizedBox || optionCount < 2) {
      return [];
    }

    const area = (Number(normalizedBox.width) * Number(normalizedBox.height)) / 1_000_000;
    if (area > 0.78 || Number(normalizedBox.width) > 960 || Number(normalizedBox.height) > 960) {
      addLog('Alternativas visuais mantidas para revisao: a caixa retornada pela IA ficou grande demais.');
      return [];
    }

    const box = {
      x: Number(normalizedBox.x),
      y: Number(normalizedBox.y),
      width: Number(normalizedBox.width),
      height: Number(normalizedBox.height),
    };
    const splitHorizontally = box.width > box.height * 1.35;
    const segmentSize = splitHorizontally ? box.width / optionCount : box.height / optionCount;
    const overlap = Math.max(0, Math.min(10, Math.round(segmentSize * 0.035)));
    const croppedImages: CroppedOptionImage[] = [];

    for (let index = 0; index < optionCount; index += 1) {
      const optionBox = splitHorizontally
        ? {
            x: Math.max(0, box.x + (segmentSize * index) - (index > 0 ? overlap : 0)),
            y: box.y,
            width: Math.min(1000, segmentSize + (index > 0 ? overlap : 0) + (index < optionCount - 1 ? overlap : 0)),
            height: box.height,
          }
        : {
            x: box.x,
            y: Math.max(0, box.y + (segmentSize * index) - (index > 0 ? overlap : 0)),
            width: box.width,
            height: Math.min(1000, segmentSize + (index > 0 ? overlap : 0) + (index < optionCount - 1 ? overlap : 0)),
          };

      const cropped = await cropFigureImage(pageImageBase64, optionBox, { manual: true });
      if (!cropped) {
        return [];
      }
      croppedImages.push({ imageData: cropped, figureBox: optionBox });
    }

    return croppedImages;
  };

  const pdfPageToRichText = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<PdfPageRichText> => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const contentRecord = content as unknown as { items?: unknown[]; styles?: Record<string, unknown> };
      const styles = contentRecord.styles || {};
      const rawItems = (contentRecord.items || [])
        .map((item) => {
          const record = toLooseRecord(item);
          const text = normalizeInlineText(String(record?.str || ''));
          if (!text) {
            return null;
          }

          const styleText = readPdfTextStyle(item, styles);
          const transform = Array.isArray(record?.transform) ? record.transform : [];
          const y = Number(transform[5]);
          const height = Number(record?.height || transform[3] || 0);
          return {
            text,
            bold: isBoldPdfTextStyle(styleText),
            italic: isItalicPdfTextStyle(styleText),
            underline: isUnderlinePdfTextStyle(styleText),
            hasEOL: record?.hasEOL === true,
            y: Number.isFinite(y) ? y : null,
            height: Number.isFinite(height) && height > 0 ? height : 10,
          };
        })
        .filter(Boolean) as Array<PdfTextSegment & { hasEOL: boolean; y: number | null; height: number }>;
      const rawItemsWithBreaks = rawItems.map((item, index) => {
        const next = rawItems[index + 1];
        const yDelta = item.y !== null && next?.y !== null ? Math.abs(item.y - next.y) : 0;
        const lineThreshold = Math.max(3, Math.min(item.height, 14) * 0.45);
        const blockThreshold = Math.max(13, item.height * 1.65);
        const lineBreakAfter = Boolean(item.hasEOL || (next && yDelta > lineThreshold));
        const blockBreakAfter = Boolean(lineBreakAfter && next && yDelta > blockThreshold);
        return {
          ...item,
          lineBreakAfter,
          blockBreakAfter,
        };
      });
      const ignoreBold = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'bold');
      const ignoreItalic = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'italic');
      const ignoreUnderline = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'underline');
      const normalizedItems = rawItemsWithBreaks.map((item) => ({
        ...item,
        bold: ignoreBold ? false : item.bold,
        italic: ignoreItalic ? false : item.italic,
        underline: ignoreUnderline ? false : item.underline,
      }));
      const plainText = buildPlainPdfText(normalizedItems);
      const highlights = mergeAdjacentHighlights(
        normalizedItems.filter((item) => item.bold || item.italic || item.underline),
      );

      return {
        plainText,
        richText: highlights.length > 0 ? buildHighlightedPdfTextHtml(normalizedItems) : plainText,
        highlights,
        hasHighlights: highlights.length > 0,
      };
    } catch {
      return {
        plainText: '',
        richText: '',
        highlights: [],
        hasHighlights: false,
      };
    }
  };

  const pdfPageToText = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<string> => (
    (await pdfPageToRichText(pdfDoc, pageNum)).plainText
  );

  const buildTargetAnswerKeySignal = (metadata: ImportMetadata | null) => {
    const targetRoles = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role);
    return targetRoles.length > 0
      ? targetRoles
      : String(metadata?.examTitle || metadata?.title || '').trim();
  };

  const readCurrentAnswerKeyMap = async (pdfjs: PdfJsModule): Promise<Record<number, number>> => {
    if (!kFile) {
      return {};
    }

    const keyBuffer = await kFile.arrayBuffer();
    const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
    const keyMap: Record<number, number> = {};
    const targetAnswerKeySignal = buildTargetAnswerKeySignal(importMetadata);

    for (let pageIndex = 1; pageIndex <= keyPdf.numPages; pageIndex += 1) {
      const keyText = await pdfPageToText(keyPdf, pageIndex);
      if (!shouldUseAnswerKeyPage(keyText, targetAnswerKeySignal)) {
        continue;
      }

      Object.assign(keyMap, parseAnswerKeyFromText(keyText, targetAnswerKeySignal));
    }

    return keyMap;
  };

  const updateDiagnosticsForQuestionList = (questions: Question[]) => {
    const extractedQuestionNumbers = questions
      .map((question, index) => getExtractedQuestionNumber(question, index + 1))
      .filter((number, index, list) => Number.isFinite(number) && number > 0 && list.indexOf(number) === index)
      .sort((a, b) => a - b);

    setImportDiagnostics((previous) => ({
      expectedQuestionNumbers: previous.expectedQuestionNumbers,
      extractedQuestionNumbers,
      missingQuestionNumbers: previous.expectedQuestionNumbers.filter((number) => !extractedQuestionNumbers.includes(number)),
    }));
  };

  const inferRetryPagesForMissingQuestions = (
    missingNumbers: number[],
    pagesCount: number,
    questions: Question[],
    pageNumbersByPage: Map<number, number[]>,
  ) => {
    const targetsByPage = new Map<number, Set<number>>();
    const remaining = new Set(missingNumbers);
    const addTarget = (pageIndex: number, questionNumber: number) => {
      if (pageIndex < 1 || pageIndex > pagesCount) {
        return;
      }
      const targets = targetsByPage.get(pageIndex) || new Set<number>();
      targets.add(questionNumber);
      targetsByPage.set(pageIndex, targets);
    };

    pageNumbersByPage.forEach((pageQuestionNumbers, pageIndex) => {
      pageQuestionNumbers
        .filter((questionNumber) => remaining.has(questionNumber))
        .forEach((questionNumber) => {
          addTarget(pageIndex, questionNumber);
          remaining.delete(questionNumber);
        });
    });

    const extractedByNumber = questions
      .map((question, index) => ({
        number: getExtractedQuestionNumber(question, index + 1),
        page: Number((question as unknown as ImportedQuestionDraft).sourcePage || 0),
      }))
      .filter((item) => Number.isFinite(item.number) && item.number > 0 && Number.isFinite(item.page) && item.page > 0)
      .sort((left, right) => left.number - right.number);

    Array.from(remaining).forEach((questionNumber) => {
      const previous = [...extractedByNumber].reverse().find((item) => item.number < questionNumber);
      const next = extractedByNumber.find((item) => item.number > questionNumber);
      const startPage = Math.max(1, Math.min(previous?.page || next?.page || 1, pagesCount));
      const endPage = Math.max(startPage, Math.min(next?.page || pagesCount, pagesCount));

      for (let pageIndex = startPage; pageIndex <= endPage; pageIndex += 1) {
        addTarget(pageIndex, questionNumber);
      }
    });

    return Array.from(targetsByPage.entries())
      .map(([pageIndex, targets]) => ({
        pageIndex,
        targets: Array.from(targets).sort((a, b) => a - b),
      }))
      .sort((left, right) => left.pageIndex - right.pageIndex);
  };

  const mapRetriedAiQuestions = ({
    result,
    pageIndex,
    pageRichText,
    pageText,
    targetNumbers,
    keyMap,
    selectedFocus,
  }: {
    result: PageExtractionResult;
    pageIndex: number;
    pageRichText: PdfPageRichText;
    pageText: string;
    targetNumbers: number[];
    keyMap: Record<number, number>;
    selectedFocus: QuestionTaxonomyLabel;
  }) => {
    const targetSet = new Set(targetNumbers);
    const nextMetadata = mergeMetadata(importMetadata, result.metadata);
    const contextByKey = new Map<string, NonNullable<PageExtractionResult['pageContexts']>[number]>();
    (result.pageContexts || []).forEach((context) => {
      const key = String(context.contextKey || '').trim();
      if (key) {
        contextByKey.set(key, context);
      }
    });

    return (result.questions || [])
      .map((question) => {
        const rawQuestion = toImportedQuestionDraft(question);
        const questionNumber = normalizeQuestionNumber(rawQuestion.number || rawQuestion.questionNumber, 0);
        if (!targetSet.has(questionNumber)) {
          return null;
        }

        const rawText = String(rawQuestion.text || question.enunciado || '').trim();
        const normalizedOptions = normalizeImportedOptions(rawQuestion.options, rawText, rawQuestion.modality);
        const context = rawQuestion.contextKey ? contextByKey.get(String(rawQuestion.contextKey)) : undefined;
        const rawSupport = String(
          rawQuestion.supportText
          || (rawQuestion as ImportedQuestionDraft & { introText?: string; intro_text?: string }).introText
          || (rawQuestion as ImportedQuestionDraft & { intro_text?: string }).intro_text
          || context?.text
          || '',
        ).trim();
        const splitStatement = splitSupportContextFromStatement(normalizedOptions.statement || rawText);
        const rawSupportParts = splitQuestionSupportReference(sanitizeSupportContextText(rawSupport));
        const supportText = formatStructuredSupportHtml(applyPdfHighlightsToHtml(
          rawSupportParts.supportText || splitStatement.supportText || rawSupport,
          pageRichText.highlights,
        ));
        const questionText = applyPdfHighlightsToHtml(
          splitStatement.statement || normalizedOptions.statement || rawText,
          pageRichText.highlights,
        );
        const referenceText = applyPdfHighlightsToHtml(mergeReferenceText(
          String((rawQuestion as ImportedQuestionDraft & { reference_text?: string }).referenceText || '').trim(),
          String((rawQuestion as ImportedQuestionDraft & { reference_text?: string }).reference_text || '').trim(),
          rawSupportParts.referenceText,
        ), pageRichText.highlights);
        const optionsForItems = normalizedOptions.options.map((option) => (
          /<img\b|data:image\//i.test(option)
            ? option
            : applyPdfHighlightsToHtml(option, pageRichText.highlights)
        ));
        const expectedOptionsCount = inferExpectedOptionsCountFromText(rawText, pageText)
          || getExpectedOptionsCount(
            rawQuestion.modality || question.tipo,
            rawQuestion.expectedOptionsCount ?? rawQuestion.expected_options_count,
          );
        const correctIndex = keyMap[questionNumber] !== undefined
          ? keyMap[questionNumber]
          : Number.isInteger(rawQuestion.correctOptionIndex)
            ? Number(rawQuestion.correctOptionIndex)
            : 0;
        const isCanceledQuestion = correctIndex < 0 || Boolean(rawQuestion.anulada || rawQuestion.isCanceled);
        const agencyLabel = String(nextMetadata?.agency || result.metadata?.agency || '').trim();
        const organizationLabel = String(nextMetadata?.source || result.metadata?.source || '').trim();
        const roleLabels = normalizeRoleList(
          nextMetadata?.roles,
          nextMetadata?.cargos,
          nextMetadata?.role,
          result.metadata?.roles,
          result.metadata?.cargos,
          result.metadata?.role,
        );
        const levelLabel = String(rawQuestion.level || nextMetadata?.level || result.metadata?.level || '').trim();
        const taxonomy = normalizeTaxonomyForCurrentImport(
          String(rawQuestion.subject || '').trim(),
          String(rawQuestion.topic || '').trim(),
          String(rawQuestion.specificSubject || '').trim(),
          [rawText, questionText, supportText, referenceText, ...optionsForItems, pageText],
        );
        const mappedQuestion = {
          ...question,
          questionNumber,
          question_number: questionNumber,
          sourcePage: pageIndex,
          source_page: pageIndex,
          introText: supportText,
          intro_text: supportText,
          referenceText,
          reference_text: referenceText,
          enunciado: questionText,
          enunciado_clean: stripHtml(questionText),
          bancas: agencyLabel
            ? [{ sigla: agencyLabel, name: agencyLabel, id: null, slug: slugify(agencyLabel) }]
            : [],
          orgaos: organizationLabel
            ? [{ name: organizationLabel, id: null, slug: slugify(organizationLabel) }]
            : [],
          cargos: roleLabels.map((roleLabel) => createTaxonomyLabel(roleLabel, { descricao: roleLabel })),
          assuntos: buildResolvedSubjectTaxonomies(question as Question, taxonomy),
          carreiras: [selectedFocus],
          anos: nextMetadata?.year ? [Number(nextMetadata.year)] : [new Date().getFullYear()],
          niveis: levelLabel ? [createTaxonomyLabel(levelLabel)] : [],
          tiposProva: nextMetadata?.examType ? [createTaxonomyLabel(nextMetadata.examType)] : [],
          expectedOptionsCount,
          expected_options_count: expectedOptionsCount,
          tipo: optionsForItems.length === 2 ? 'certo ou errado' : 'multipla escolha',
          dificuldade: normalizeDifficulty(rawQuestion.difficulty),
          correctOptionIndex: isCanceledQuestion ? 0 : correctIndex,
          anulada: isCanceledQuestion,
          isCanceled: isCanceledQuestion,
          needsImportReview: optionsForItems.length < expectedOptionsCount,
          itens: optionsForItems.map((option, optionIndex) => ({
            id: optionIndex + 1,
            ordem: optionIndex + 1,
            rotulo: String.fromCharCode(65 + optionIndex),
            corpo: option,
            corpo_clean: stripHtml(option).trim(),
          })),
          resposta: isCanceledQuestion ? 0 : correctIndex + 1,
          questionOrigin: 'exam',
          question_origin: 'exam',
          stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
          comments: [],
        } as unknown as Question;

        addLog(`Questao #${questionNumber}: recuperada na tentativa focada pela pag ${pageIndex}.`);
        return mappedQuestion;
      })
      .filter(Boolean) as Question[];
  };

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      addToast('`Arquivos de prova e gabarito sao obrigatorios para este processo.', 'error');
      return;
    }
    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de importar a prova.', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExtractedContexts([]);
    setPublishedExam(null);
    setPublishedQuestionNumbers([]);
    setPublishingAction(null);
    setImportDiagnostics({
      expectedQuestionNumbers: [],
      extractedQuestionNumbers: [],
      missingQuestionNumbers: [],
    });
    setImportMetadata(null);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      const pdfjs = await loadPdfJsModule();
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const firstQuestionPageText = questionPdf.numPages > 0 ? await pdfPageToText(questionPdf, 1) : '';
      const initialMetadata = inferMetadataFromText(firstQuestionPageText, qFile.name);
      if (initialMetadata && Object.keys(initialMetadata).length > 0) {
        setImportMetadata(initialMetadata);
      }
      const targetAnswerRole = normalizeRoleList(initialMetadata.roles, initialMetadata.cargos, initialMetadata.role);
      const targetAnswerKeySignal = targetAnswerRole.length > 0
        ? targetAnswerRole
        : String(initialMetadata.examTitle || initialMetadata.title || '').trim();

      addLog('Iniciando leitura do gabarito...');
      const keyBuffer = await kFile.arrayBuffer();
      const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
      const keyMap: Record<number, number> = {};
      for (let pageIndex = 1; pageIndex <= keyPdf.numPages; pageIndex += 1) {
        const keyText = await pdfPageToText(keyPdf, pageIndex);
        if (!shouldUseAnswerKeyPage(keyText, targetAnswerKeySignal)) {
          addLog(`Gabarito pag ${pageIndex}: pagina ignorada por nao corresponder ao cargo/prova selecionado.`);
          setKeyProgress(Math.round((pageIndex / keyPdf.numPages) * 100));
          continue;
        }
        const mechanicalKeyMap = parseAnswerKeyFromText(keyText, targetAnswerKeySignal);
        if (Object.keys(mechanicalKeyMap).length >= 5) {
          Object.assign(keyMap, mechanicalKeyMap);
          addLog(`Gabarito pag ${pageIndex}: ${Object.keys(mechanicalKeyMap).length} respostas extraidas mecanicamente.`);
        } else {
          try {
            const keyImage = await pdfToImage(keyPdf, pageIndex);
            Object.assign(keyMap, await aiService.extractAnswerKeyMapping(keyImage));
            addLog(`Gabarito pag ${pageIndex}: parser local nao encontrou respostas; IA usada como fallback.`);
          } catch (error) {
            addLog(`Gabarito pag ${pageIndex}: IA indisponivel (${readErrorMessage(error)}). Pagina mantida sem respostas automaticas.`);
          }
        }
        setKeyProgress(Math.round((pageIndex / keyPdf.numPages) * 100));
      }
      setKeyProgress(100);
      addLog('Gabarito oficial mapeado.');
      const expectedQuestionNumbers = Object.keys(keyMap)
        .map((key) => Number(key))
        .filter((number) => Number.isFinite(number) && number > 0)
        .sort((a, b) => a - b);
      if (expectedQuestionNumbers.length > 0) {
        setImportDiagnostics({
          expectedQuestionNumbers,
          extractedQuestionNumbers: [],
          missingQuestionNumbers: expectedQuestionNumbers,
        });
        addLog(`Gabarito indica ${expectedQuestionNumbers.length} questoes esperadas.`);
      }

      addLog('Iniciando motor de extracao IA (prova)...');
      const pagesCount = questionPdf.numPages;
      addLog(`Arquivo de prova identificado: ${pagesCount} paginas.`);

      let allFoundQuestions: Question[] = [];
      let currentMetadata: ImportMetadata | null = initialMetadata;
      const expectedQuestionSet = new Set<number>(expectedQuestionNumbers);
      const contextMap = new Map<string, ImportedContextDraft>();

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        addLog(`Lendo pag ${pageIndex}/${pagesCount}...`);

        const pageRichText = await pdfPageToRichText(questionPdf, pageIndex);
        const pageText = pageRichText.plainText;
        const normalizedPageText = normalizeQuestionMarkerText(pageText).replace(/\s+/g, ' ').trim();
        const currentPageMarkers = findQuestionMarkers(normalizedPageText);
        const pagePrefix = currentPageMarkers[0]
          ? normalizedPageText.slice(0, currentPageMarkers[0].index).trim()
          : '';
        if (pagePrefix && allFoundQuestions.length > 0) {
          const lastQuestion = allFoundQuestions[allFoundQuestions.length - 1];
          const completedQuestion = completeQuestionOptionsFromPrefix(lastQuestion, pagePrefix);
          if (completedQuestion) {
            allFoundQuestions = [
              ...allFoundQuestions.slice(0, -1),
              completedQuestion,
            ];
            setExtractedQuestions([...allFoundQuestions]);
            addLog(`Questao #${getExtractedQuestionNumber(completedQuestion, allFoundQuestions.length)} completada com alternativas que continuavam na pag ${pageIndex}.`);
          }
        }
        const pageQuestionNumbers = extractQuestionNumbersFromText(pageText);
        if (expectedQuestionNumbers.length === 0) {
          pageQuestionNumbers.forEach((number) => expectedQuestionSet.add(number));
        }
        if (expectedQuestionNumbers.length === 0 && pageQuestionNumbers.length > 0) {
          const expectedFromPdf = Array.from(expectedQuestionSet).sort((a, b) => a - b);
          setImportDiagnostics((previous) => ({
            expectedQuestionNumbers: expectedFromPdf.length > previous.expectedQuestionNumbers.length
              ? expectedFromPdf
              : previous.expectedQuestionNumbers,
            extractedQuestionNumbers: previous.extractedQuestionNumbers,
            missingQuestionNumbers: (expectedFromPdf.length > previous.expectedQuestionNumbers.length
              ? expectedFromPdf
              : previous.expectedQuestionNumbers).filter((number) => !previous.extractedQuestionNumbers.includes(number)),
          }));
        }
        const mechanicalResult = createMechanicalExtractionFromText(pageText, pageIndex, qFile.name);
        let pageImage: string | null = null;
        const ensurePageImage = async () => {
          if (!pageImage) {
            pageImage = await pdfToImage(questionPdf, pageIndex);
          }
          return pageImage;
        };
        let result = mechanicalResult;
        if (mechanicalResult.questions.length > 0) {
          addLog(`Pag ${pageIndex}: ${mechanicalResult.questions.length} questao(oes) extraida(s) mecanicamente.`);
        }

        if (extractionNeedsAi(pageText, mechanicalResult, extractWithComment, pageRichText.hasHighlights)) {
          try {
            const pageImageBase64 = await ensurePageImage();
            const aiResult = await aiService.extractQuestionsFromPage(
              pageImageBase64,
              extractWithComment,
              pageText,
              pageQuestionNumbers,
              pageRichText.richText,
            );
            result = mergePageExtractionResults(mechanicalResult, aiResult);
            addLog(`Pag ${pageIndex}: IA usada apenas como complemento/fallback.`);
          } catch (error) {
            result = mechanicalResult;
            addLog(`Pag ${pageIndex}: IA indisponivel (${readErrorMessage(error)}). Mantida extracao mecanica para revisao.`);
          }
        }

        currentMetadata = mergeMetadata(currentMetadata, result.metadata);
        setImportMetadata(currentMetadata);
        const extractionMetadata = currentMetadata;

        for (let contextIndex = 0; contextIndex < (result.pageContexts || []).length; contextIndex += 1) {
          const context = (result.pageContexts || [])[contextIndex];
          const tempId = String(context.contextKey || `pag-${pageIndex}-contexto-${contextIndex + 1}`);
          const questionNumbers = Array.isArray(context.appliesToQuestionNumbers)
            ? context.appliesToQuestionNumbers.map((value) => normalizeQuestionNumber(value, 0)).filter(Boolean)
            : [];
          const contextPageImage = context.hasFigure ? await ensurePageImage() : undefined;
          const croppedImageData = context.hasFigure
            ? await cropFigureImage(contextPageImage || '', context.figureBox)
            : undefined;
          if (context.hasFigure && !croppedImageData) {
            addLog(`Figura do contexto ${tempId} mantida apenas como descricao: recorte ausente ou invalido.`);
          }
          upsertContextDraft(contextMap, {
            tempId,
            title: context.title || `Texto de apoio - pagina ${pageIndex}`,
            text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(context.text || '', pageRichText.highlights)),
            questionNumbers,
            hasFigure: Boolean(context.hasFigure),
            figureDescription: context.figureDescription || '',
            page: pageIndex,
            imageData: croppedImageData,
            pageImageData: contextPageImage,
            figureBox: context.figureBox,
          });
        }

        if (result.questions && result.questions.length > 0) {
          const validPageQuestions = result.questions.filter((question, questionIndex) => {
            const rawQuestion = toImportedQuestionDraft(question);
            const inferredQuestionNumber = rawQuestion.number || rawQuestion.questionNumber || pageQuestionNumbers[questionIndex];
            const hasOriginalNumber = String(inferredQuestionNumber || '').trim() !== '';
            const questionNumber = normalizeQuestionNumber(
              inferredQuestionNumber,
              allFoundQuestions.length + questionIndex + 1,
            );
            const rawText = String(rawQuestion.text || question.enunciado || '').trim();
            const { statement, options } = normalizeImportedOptions(rawQuestion.options, rawText, rawQuestion.modality);
            const questionTextForSignals = statement || rawText;
            const hasQuestionShape = hasOriginalNumber
              && questionCommandPattern.test(questionTextForSignals);
            const looksLikeNumberedQuestion = hasOriginalNumber
              && rawQuestion.isQuestion === true
              && stripHtml(questionTextForSignals).replace(/\s+/g, ' ').trim().length >= 20;
            const isQuestion = rawQuestion.isQuestion !== false
              && !isLikelyInstructionText(questionTextForSignals)
              && (options.length >= 2 || hasQuestionShape || looksLikeNumberedQuestion);

            if (!isQuestion) {
              addLog(`Ignorado na pag ${pageIndex}: trecho sem formato de questao real${questionNumber ? ` (#${questionNumber})` : ''}.`);
            } else if (options.length < 2) {
              addLog(`Questao #${questionNumber} mantida para revisao, mas alternativas precisam ser conferidas.`);
            }

            return isQuestion;
          });

          addLog(`${validPageQuestions.length}/${result.questions.length} questoes reais encontradas na pag ${pageIndex}.`);

          const mappedQuestions: Question[] = [];
          for (let questionIndex = 0; questionIndex < validPageQuestions.length; questionIndex += 1) {
            const question = validPageQuestions[questionIndex];
            const rawQuestion = toImportedQuestionDraft(question);
            const questionNumber = normalizeQuestionNumber(
              rawQuestion.number || rawQuestion.questionNumber || pageQuestionNumbers[questionIndex],
              allFoundQuestions.length + questionIndex + 1,
            );
            const rawText = String(rawQuestion.text || question.enunciado || '').trim();
            const normalizedOptions = normalizeImportedOptions(rawQuestion.options, rawText, rawQuestion.modality);
            let options = normalizedOptions.options;
            const correctIndex = keyMap[questionNumber] !== undefined
              ? keyMap[questionNumber]
              : Number.isInteger(rawQuestion.correctOptionIndex)
                ? Number(rawQuestion.correctOptionIndex)
                : 0;
            const optionFigureBoxes = normalizeExtractionFigureBoxes(
              rawQuestion.optionFigureBoxes,
              rawQuestion.optionFigureBox,
            );
            const optionFigureBox = normalizeExtractionFigureBox(
              rawQuestion.optionFigureBox
              || mergeFigureBoxes(optionFigureBoxes)
              || (options.some((option) => visualOptionPlaceholderPattern.test(option)) ? rawQuestion.figureBox : undefined),
            );
            const likelyVisualChoiceQuestion = questionLikelyHasVisualAlternatives(
              rawText,
              pageText,
              rawQuestion.modality,
            );
            const expectedOptionsCount = inferExpectedOptionsCountFromText(rawText, pageText, qFile.name)
              || getExpectedOptionsCount(
                rawQuestion.modality || question.tipo,
                rawQuestion.expectedOptionsCount ?? rawQuestion.expected_options_count,
              );
            const expectedOptionsForVisualChoice = expectedOptionsCount;
            let hasVisualOptions = options.some((option) => visualOptionPlaceholderPattern.test(option))
              || Boolean(optionFigureBox && optionFigureBoxes.length > 0)
              || Boolean(optionFigureBox && options.length < 2 && !String(rawQuestion.modality || '').toLowerCase().includes('certo'))
              || (options.length < expectedOptionsForVisualChoice && likelyVisualChoiceQuestion);
            if (hasVisualOptions && options.length < expectedOptionsForVisualChoice) {
              options = ['A', 'B', 'C', 'D', 'E']
                .slice(0, expectedOptionsForVisualChoice)
                .map((label) => `Alternativa visual ${label}`);
              hasVisualOptions = true;
              addLog(`Questao #${questionNumber}: alternativas visuais detectadas na imagem; placeholders A-E criados para recorte.`);
            }
            const supportFigureBox = normalizeExtractionFigureBox(
              rawQuestion.supportFigureBox || (!hasVisualOptions ? rawQuestion.figureBox : undefined),
            );
            const supportFigureBoxes = normalizeExtractionFigureBoxes(
              rawQuestion.supportFigureBoxes,
              supportFigureBox,
            );
            let visualOptionPageImage = '';
            let visualOptionImages: CroppedOptionImage[] = [];
            if (hasVisualOptions && options.length >= 2) {
              visualOptionPageImage = await ensurePageImage();
              if (optionFigureBox) {
                visualOptionImages = optionFigureBoxes.length === options.length
                  ? (await Promise.all(optionFigureBoxes.map(async (box) => {
                      const cropped = await cropFigureImage(visualOptionPageImage, box, { manual: true });
                      return cropped ? { imageData: cropped, figureBox: box } : null;
                    }))).filter(Boolean) as CroppedOptionImage[]
                  : await cropVisualOptionImages(visualOptionPageImage, optionFigureBox, options.length);
                if (visualOptionImages.length === options.length) {
                  addLog(`Questao #${questionNumber}: alternativas visuais recortadas individualmente.`);
                } else {
                  addLog(`Questao #${questionNumber}: alternativas visuais precisam de revisao; o recorte individual nao foi possivel.`);
                }
              } else {
                addLog(`Questao #${questionNumber}: alternativas visuais provaveis, mas sem caixa confiavel. A pagina ficou disponivel para recorte manual de A-E.`);
              }
            }
            let optionsForItems = visualOptionImages.length === options.length
              ? options.map((_, optionIndex) => (
                  createVisualOptionHtml(String.fromCharCode(65 + optionIndex), visualOptionImages[optionIndex].imageData)
                ))
              : options;
            const isCanceledQuestion = correctIndex < 0 || Boolean(rawQuestion.anulada || rawQuestion.isCanceled);
            const splitStatement = splitSupportContextFromStatement(normalizedOptions.statement || rawText);
            const rawExplicitSupportText = sanitizeSupportContextText(String(rawQuestion.supportText || rawQuestion.introText || '').trim());
            const rawExplicitSupportParts = splitQuestionSupportReference(rawExplicitSupportText);
            const rawExplicitSupportBody = rawExplicitSupportParts.supportText || rawExplicitSupportText;
            const explicitSupportLooksLikeTail = /^(?:dispon[ií]vel em|acesso em|fonte|adaptad[ao]|esse|essa|esses|essas|qual|quais|nesse|neste|com base|considerando|a partir|de acordo)/i
              .test(rawExplicitSupportText);
            const combinedSplitStatement = explicitSupportLooksLikeTail
              ? splitInlineSupportContextFromStatement(`${splitStatement.statement} ${rawExplicitSupportText}`)
              : { supportText: '', statement: '' };
            const inlineSplitStatement = combinedSplitStatement.supportText
              ? combinedSplitStatement
              : splitInlineSupportContextFromStatement(splitStatement.statement);
            let questionText = inlineSplitStatement.statement || splitStatement.statement || normalizedOptions.statement || rawText;
            let referenceText = mergeReferenceText(
              String(rawQuestion.referenceText || '').trim(),
              rawExplicitSupportParts.referenceText,
              'referenceText' in inlineSplitStatement ? String(inlineSplitStatement.referenceText || '').trim() : '',
              'referenceText' in combinedSplitStatement ? String(combinedSplitStatement.referenceText || '').trim() : '',
              'referenceText' in splitStatement ? String(splitStatement.referenceText || '').trim() : '',
            );
            const subjectLabel = String(rawQuestion.subject || '').trim();
            const topicLabel = String(rawQuestion.topic || '').trim();
            const specificSubjectLabel = String(rawQuestion.specificSubject || '').trim();
            const roleLabels = normalizeRoleList(
              extractionMetadata?.roles,
              extractionMetadata?.cargos,
              result.metadata?.roles,
              result.metadata?.cargos,
              extractionMetadata?.role,
              result.metadata?.role,
            );
            const agencyLabel = String(extractionMetadata?.agency || result.metadata?.agency || '').trim();
            const organizationLabel = String(extractionMetadata?.source || result.metadata?.source || '').trim();
            const levelLabel = String(rawQuestion.level || extractionMetadata?.level || result.metadata?.level || '').trim();
            const explicitSupportText = combinedSplitStatement.supportText ? '' : rawExplicitSupportBody;
            const splitSupportText = mergeContextText(splitStatement.supportText, inlineSplitStatement.supportText);
            let supportText = explicitSupportText || splitSupportText;
            if (shouldRepairQuestionPartsWithAi({
              rawText,
              supportText,
              referenceText,
              statement: questionText,
              options,
              expectedOptionsCount,
            })) {
              try {
                const repairedParts = await aiService.repairImportedQuestionParts({
                  rawText,
                  supportText,
                  referenceText,
                  statement: questionText,
                  options,
                  modality: rawQuestion.modality || question.tipo,
                });
                const repairedSupportText = sanitizeSupportContextText(String(repairedParts.supportText || '').trim());
                const repairedReferenceText = String(repairedParts.referenceText || '').trim();
                const repairedStatement = String(repairedParts.statement || '').replace(/\s+/g, ' ').trim();
                const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
                const confidence = Number(repairedParts.confidence ?? 0);

                if (confidence >= 0.55 || repairedStatement || repairedOptions.length >= 2) {
                  supportText = repairedSupportText || supportText;
                  referenceText = repairedReferenceText
                    ? mergeReferenceText(repairedReferenceText)
                    : referenceText;
                  questionText = repairedStatement || questionText;

                  if (!hasVisualOptions && repairedOptions.length >= Math.max(2, options.length)) {
                    options = repairedOptions;
                    optionsForItems = repairedOptions;
                  }

                  addLog(`Questao #${questionNumber}: texto de apoio/referencia/enunciado revisado por IA por ambiguidade no OCR.`);
                }
              } catch (error) {
                addLog(`Questao #${questionNumber}: reparo por IA indisponivel; mantida separacao mecanica (${readErrorMessage(error)}).`);
              }
            }
            const resolvedTaxonomy = normalizeTaxonomyForCurrentImport(
              subjectLabel,
              topicLabel,
              specificSubjectLabel,
              [
                rawText,
                questionText,
                supportText,
                referenceText,
                ...options,
              ],
            );
            const resolvedAssuntos = buildResolvedSubjectTaxonomies(question as Question, resolvedTaxonomy);
            const hasUnresolvedVisualOptions = optionsForItems.some((option) => visualOptionPlaceholderPattern.test(option));
            const figureDescription = [
              rawQuestion.figureDescription,
              ...(Array.isArray(rawQuestion.imageDescriptions) ? rawQuestion.imageDescriptions : []),
            ].filter(Boolean).join('\n');
            const contextFigureBox = hasUnresolvedVisualOptions ? optionFigureBox : undefined;
            const hasQuestionFigureContext = Boolean(contextFigureBox && (rawQuestion.hasFigure || hasUnresolvedVisualOptions));
            const contextFigureDescription = hasVisualOptions && !hasUnresolvedVisualOptions && !supportFigureBox
              ? ''
              : figureDescription;
            const hasOnlyHeaderSupportText = Boolean(supportText)
              && isLikelyPageBookletHeader(supportText)
              && !figureDescription
              && !hasQuestionFigureContext;
            const hasQuestionContextPayload = Boolean(
              (supportText && !hasOnlyHeaderSupportText)
              || contextFigureDescription
              || hasQuestionFigureContext,
            );
            const referencedContextKey = String(rawQuestion.contextKey || '').trim();
            const referencedContext = referencedContextKey ? contextMap.get(referencedContextKey) : undefined;
            const referencedContextQuestionNumbers = referencedContext
              ? Array.from(new Set(referencedContext.questionNumbers.filter((number) => number > 0)))
              : [];
            const referencedContextIsShared = referencedContextQuestionNumbers.length > 1;
            const hasSupportFigurePayload = supportFigureBoxes.length > 0;
            const hasVisualContextPayload = Boolean(hasQuestionFigureContext || contextFigureDescription);
            const shouldStoreSupportAsIntroText = Boolean(supportText || hasSupportFigurePayload)
              && !hasOnlyHeaderSupportText
              && (!hasVisualContextPayload || hasSupportFigurePayload)
              && !referencedContextIsShared;
            const splitContextKey = splitSupportText
              && !shouldStoreSupportAsIntroText
              ? `pag-${pageIndex}-q-${questionNumber}-contexto-textual`
              : '';
            const contextKey = shouldStoreSupportAsIntroText
              ? ''
              : splitContextKey
                || referencedContextKey
                || (hasQuestionContextPayload ? `pag-${pageIndex}-q-${questionNumber}-contexto` : '');
            let linkedContextKey = contextKey;

            if (contextKey && hasQuestionContextPayload) {
              if (splitSupportText) {
                removeContainedPartialContextsForQuestion(contextMap, questionNumber, supportText);
              }
              const questionPageImage = hasQuestionFigureContext ? await ensurePageImage() : undefined;
              const croppedImageData = hasQuestionFigureContext
                ? await cropFigureImage(questionPageImage || '', contextFigureBox)
                : undefined;
              if (hasQuestionFigureContext && !croppedImageData) {
                addLog(`Figura da questao ${questionNumber} mantida apenas como descricao: recorte ausente ou invalido.`);
              }
              linkedContextKey = upsertContextDraft(contextMap, {
                tempId: contextKey,
                title: rawQuestion.contextTitle || `Texto de apoio da questao ${questionNumber}`,
                text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(supportText, pageRichText.highlights)),
                questionNumbers: [questionNumber],
                hasFigure: Boolean(hasQuestionFigureContext || contextFigureDescription),
                figureDescription: contextFigureDescription,
                page: pageIndex,
                imageData: croppedImageData,
                pageImageData: questionPageImage,
                figureBox: contextFigureBox,
              }) || '';
            }

            let supportImages: ImportedQuestionImageDraft[] = [];
            if (shouldStoreSupportAsIntroText && supportFigureBoxes.length > 0) {
              const questionPageImage = await ensurePageImage();
              supportImages = (await Promise.all(supportFigureBoxes.map(async (box, supportImageIndex) => {
                const croppedImageData = await cropFigureImage(questionPageImage, box);
                if (!croppedImageData) {
                  return null;
                }

                return {
                  tempId: `q-${questionNumber}-support-${supportImageIndex + 1}`,
                  title: `Figura de apoio ${supportImageIndex + 1}`,
                  description: rawQuestion.imageDescriptions?.[supportImageIndex] || figureDescription || '',
                  imageData: croppedImageData,
                  pageImageData: questionPageImage,
                  figureBox: box,
                  page: pageIndex,
                } satisfies ImportedQuestionImageDraft;
              }))).filter(Boolean) as ImportedQuestionImageDraft[];

              if (supportFigureBoxes.length > 0 && supportImages.length === 0) {
                addLog(`Questao #${questionNumber}: figura(s) de apoio precisam de revisao; o recorte automatico nao foi confiavel.`);
              }
            }

            questionText = applyPdfHighlightsToHtml(questionText, pageRichText.highlights);
            supportText = formatStructuredSupportHtml(applyPdfHighlightsToHtml(supportText, pageRichText.highlights));
            referenceText = applyPdfHighlightsToHtml(referenceText, pageRichText.highlights);
            optionsForItems = optionsForItems.map((option) => (
              /<img\b|data:image\//i.test(option)
                ? option
                : applyPdfHighlightsToHtml(option, pageRichText.highlights)
            ));

            const mappedQuestion = {
              ...question,
              hashId: extractionMetadata?.hash_id,
              questionNumber,
              question_number: questionNumber,
              sourcePage: pageIndex,
              source_page: pageIndex,
              contextKey: linkedContextKey,
              grupoQuestaoTempId: linkedContextKey || undefined,
              figureDescription,
              introText: shouldStoreSupportAsIntroText ? supportText : String(rawQuestion.introText || '').trim(),
              intro_text: shouldStoreSupportAsIntroText ? supportText : String(rawQuestion.introText || '').trim(),
              supportImages,
              referenceText,
              reference_text: referenceText,
              enunciado: questionText,
              enunciado_clean: stripHtml(questionText),
              bancas: agencyLabel
                ? [{ sigla: agencyLabel, name: agencyLabel, id: null, slug: agencyLabel.toLowerCase() }]
                : [],
              orgaos: organizationLabel
                ? [{ name: organizationLabel, id: null, slug: organizationLabel.toLowerCase() }]
                : [],
              cargos: roleLabels.map((roleLabel) => ({
                id: null,
                slug: slugify(roleLabel),
                descricao: roleLabel,
              })),
              assuntos: resolvedAssuntos,
              carreiras: [selectedFocus],
              anos: extractionMetadata?.year ? [Number(extractionMetadata.year)] : [new Date().getFullYear()],
              niveis: levelLabel ? [createTaxonomyLabel(levelLabel)] : [],
              tiposProva: extractionMetadata?.examType ? [createTaxonomyLabel(extractionMetadata.examType)] : [],
              expectedOptionsCount,
              expected_options_count: expectedOptionsCount,
              tipo: optionsForItems.length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: normalizeDifficulty(rawQuestion.difficulty),
              correctOptionIndex: isCanceledQuestion ? 0 : correctIndex,
              anulada: isCanceledQuestion,
              isCanceled: isCanceledQuestion,
              needsImportReview: optionsForItems.length < expectedOptionsCount || hasUnresolvedVisualOptions,
              hasImageItens: (visualOptionImages.length > 0 && visualOptionImages.length === options.length) || (hasUnresolvedVisualOptions && Boolean(visualOptionPageImage)),
              itens: optionsForItems.map((option, optionIndex) => {
                const optionLabel = String.fromCharCode(65 + optionIndex);
                const cleanOption = stripHtml(option).trim();
                const visualOptionImage = visualOptionImages[optionIndex];
                return {
                  id: optionIndex + 1,
                  ordem: optionIndex + 1,
                  rotulo: optionLabel,
                  corpo: option,
                  corpo_clean: cleanOption || `Alternativa visual ${optionLabel}`,
                  imageData: visualOptionImage?.imageData,
                  pageImageData: visualOptionImage || hasUnresolvedVisualOptions ? visualOptionPageImage : undefined,
                  figureBox: visualOptionImage?.figureBox || (hasUnresolvedVisualOptions ? optionFigureBox : undefined),
                };
              }),
              resposta: isCanceledQuestion ? 0 : correctIndex + 1,
              questionOrigin: 'exam',
              question_origin: 'exam',
              stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
              comments: [],
            } as unknown as Question;
            mappedQuestions.push(mappedQuestion);
          }

          const classifiedMappedQuestions = await classifyMissingQuestionSubjects(mappedQuestions, pageIndex);
          allFoundQuestions = [...allFoundQuestions, ...classifiedMappedQuestions];
          const normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
          allFoundQuestions = normalizedImportState.questions;
          setExtractedQuestions([...allFoundQuestions]);
          setExtractedContexts(normalizedImportState.contexts);
          setImportMetadata((previous) => ({
            ...(previous || {}),
            subjects: deriveQuestionSubjects(allFoundQuestions),
          } as ImportMetadata));
          const extractedQuestionNumbers = allFoundQuestions
            .map((question, extractedIndex) => getExtractedQuestionNumber(question, extractedIndex + 1))
            .filter((number, extractedIndex, list) => list.indexOf(number) === extractedIndex)
            .sort((a, b) => a - b);
          setImportDiagnostics((previous) => ({
            expectedQuestionNumbers: previous.expectedQuestionNumbers,
            extractedQuestionNumbers,
            missingQuestionNumbers: previous.expectedQuestionNumbers.filter((number) => !extractedQuestionNumbers.includes(number)),
          }));
        }

        setExamProgress(Math.round((pageIndex / pagesCount) * 100));
      }

      let normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
      allFoundQuestions = normalizedImportState.questions;
      allFoundQuestions = await reviewQuestionPartsAfterExtraction(allFoundQuestions);
      allFoundQuestions = await classifyMissingQuestionSubjects(allFoundQuestions, 'Revisao final');
      normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
      allFoundQuestions = normalizedImportState.questions;
      setExtractedQuestions([...allFoundQuestions]);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata((previous) => ({
        ...(previous || {}),
        subjects: deriveQuestionSubjects(allFoundQuestions),
      } as ImportMetadata));
      const extractedQuestionNumbers = allFoundQuestions
        .map((question, extractedIndex) => getExtractedQuestionNumber(question, extractedIndex + 1))
        .filter((number, extractedIndex, list) => list.indexOf(number) === extractedIndex)
        .sort((a, b) => a - b);
      const finalExpectedQuestionNumbers = Array.from(expectedQuestionSet).sort((a, b) => a - b);
      setImportDiagnostics((previous) => ({
        expectedQuestionNumbers: finalExpectedQuestionNumbers.length > previous.expectedQuestionNumbers.length
          ? finalExpectedQuestionNumbers
          : previous.expectedQuestionNumbers,
        extractedQuestionNumbers,
        missingQuestionNumbers: (finalExpectedQuestionNumbers.length > previous.expectedQuestionNumbers.length
          ? finalExpectedQuestionNumbers
          : previous.expectedQuestionNumbers).filter((number) => !extractedQuestionNumbers.includes(number)),
      }));
      const missingCount = finalExpectedQuestionNumbers.filter((number) => !extractedQuestionNumbers.includes(number)).length;
      if (missingCount > 0) {
        addLog(`Atencao: ${missingCount} questoes do gabarito nao foram encontradas na extracao.`);
      }
      if (extractWithDetailedAnalysis && allFoundQuestions.length > 0) {
        setIsBulkGenerating(true);
        setBulkProgress(0);
        allFoundQuestions = await generateDetailedAnalysesForQuestions(allFoundQuestions, {
          updateLiveState: true,
          logLabel: 'Gerando analise detalhada em lote apos a extracao...',
        });
        setExtractedQuestions([...allFoundQuestions]);
        setIsBulkGenerating(false);
      }
      addLog(`IMPORTACAO CONCLUIDA! ${allFoundQuestions.length} questoes e ${contextMap.size} contexto(s) extraidos para revisao.`);
    } catch (error) {
      addLog(`ERRO CRITICO: ${readErrorMessage(error)}`);
      setIsBulkGenerating(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryMissingQuestions = async () => {
    const missingNumbers = (importDiagnostics.missingQuestionNumbers || [])
      .filter((number, index, list) => Number.isFinite(number) && number > 0 && list.indexOf(number) === index)
      .sort((a, b) => a - b);

    if (missingNumbers.length === 0) {
      addToast('Nao ha questoes faltantes para tentar novamente.', 'info');
      return;
    }

    if (!qFile) {
      addToast('Selecione novamente o PDF da prova antes de tentar recuperar as faltantes.', 'error');
      return;
    }

    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de tentar recuperar as faltantes.', 'error');
      return;
    }

    if (!isAiConfigured()) {
      addToast('Configure uma IA antes de tentar recuperar as questoes faltantes.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de tentar novamente.', 'info');
      return;
    }

    setIsRetryingMissingQuestions(true);
    setBulkProgress(0);

    try {
      const pdfjs = await loadPdfJsModule();
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const pagesCount = questionPdf.numPages;
      const keyMap = await readCurrentAnswerKeyMap(pdfjs);
      const pageRichTextByPage = new Map<number, PdfPageRichText>();
      const pageNumbersByPage = new Map<number, number[]>();

      addLog(`Tentativa focada: buscando ${missingNumbers.length} questao(oes) faltante(s) no PDF da prova.`);

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        const pageRichText = await pdfPageToRichText(questionPdf, pageIndex);
        pageRichTextByPage.set(pageIndex, pageRichText);
        pageNumbersByPage.set(pageIndex, extractQuestionNumbersFromText(pageRichText.plainText));
      }

      const retryPlan = inferRetryPagesForMissingQuestions(
        missingNumbers,
        pagesCount,
        extractedQuestions,
        pageNumbersByPage,
      );

      if (retryPlan.length === 0) {
        addToast('Nao encontrei paginas candidatas para as questoes faltantes.', 'warning');
        addLog('Tentativa focada encerrada: nenhuma pagina candidata foi encontrada.');
        return;
      }

      addLog(`Tentativa focada: ${retryPlan.length} pagina(s) candidata(s) serao reprocessadas.`);
      const remainingNumbers = new Set(missingNumbers);
      const recoveredQuestions: Question[] = [];
      let retryMetadata = importMetadata;

      for (let planIndex = 0; planIndex < retryPlan.length; planIndex += 1) {
        const { pageIndex, targets } = retryPlan[planIndex];
        const activeTargets = targets.filter((questionNumber) => remainingNumbers.has(questionNumber));
        if (activeTargets.length === 0) {
          setBulkProgress(Math.round(((planIndex + 1) / retryPlan.length) * 100));
          continue;
        }

        const pageRichText = pageRichTextByPage.get(pageIndex) || await pdfPageToRichText(questionPdf, pageIndex);
        const pageText = pageRichText.plainText;
        const pageImageBase64 = await pdfToImage(questionPdf, pageIndex);

        try {
          const aiResult = await aiService.extractQuestionsFromPage(
            pageImageBase64,
            extractWithComment,
            pageText,
            activeTargets,
            pageRichText.richText,
          );
          retryMetadata = mergeMetadata(retryMetadata, aiResult.metadata);
          const mappedQuestions = mapRetriedAiQuestions({
            result: aiResult,
            pageIndex,
            pageRichText,
            pageText,
            targetNumbers: activeTargets,
            keyMap,
            selectedFocus,
          });
          const usefulQuestions = mappedQuestions.filter((question) => {
            const questionNumber = getExtractedQuestionNumber(question, 0);
            return remainingNumbers.has(questionNumber);
          });

          usefulQuestions.forEach((question) => {
            const questionNumber = getExtractedQuestionNumber(question, 0);
            remainingNumbers.delete(questionNumber);
            recoveredQuestions.push(question);
          });

          if (usefulQuestions.length === 0) {
            addLog(`Pag ${pageIndex}: IA nao recuperou nenhuma das faltantes (${activeTargets.join(', ')}).`);
          }
        } catch (error) {
          addLog(`Pag ${pageIndex}: tentativa focada falhou (${readErrorMessage(error)}).`);
        }

        setBulkProgress(Math.round(((planIndex + 1) / retryPlan.length) * 100));
      }

      if (recoveredQuestions.length === 0) {
        addToast('Nenhuma questao faltante foi recuperada nesta tentativa.', 'warning');
        addLog('Tentativa focada concluida sem novas questoes recuperadas.');
        return;
      }

      const questionsByNumber = new Map<number, Question>();
      extractedQuestions.forEach((question, index) => {
        questionsByNumber.set(getExtractedQuestionNumber(question, index + 1), question);
      });
      recoveredQuestions.forEach((question) => {
        const questionNumber = getExtractedQuestionNumber(question, 0);
        if (questionNumber > 0) {
          questionsByNumber.set(questionNumber, question);
        }
      });

      let nextQuestions = Array.from(questionsByNumber.entries())
        .sort(([leftNumber], [rightNumber]) => leftNumber - rightNumber)
        .map(([, question]) => question);
      nextQuestions = await reviewQuestionPartsAfterExtraction(nextQuestions);
      nextQuestions = await classifyMissingQuestionSubjects(nextQuestions, 'Tentativa faltantes');

      const contextMap = new Map<string, ImportedContextDraft>();
      extractedContexts.forEach((context) => {
        contextMap.set(context.tempId, { ...context });
      });
      const normalizedImportState = normalizeQuestionContextUsage(nextQuestions, contextMap);
      nextQuestions = normalizedImportState.questions;

      setExtractedQuestions(nextQuestions);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata({
        ...(retryMetadata || {}),
        subjects: deriveQuestionSubjects(nextQuestions),
      } as ImportMetadata);
      updateDiagnosticsForQuestionList(nextQuestions);

      const stillMissing = missingNumbers.filter((questionNumber) => (
        !nextQuestions.some((question, index) => getExtractedQuestionNumber(question, index + 1) === questionNumber)
      ));
      addToast(
        `${recoveredQuestions.length} questao(oes) recuperada(s).${stillMissing.length > 0 ? ` Ainda faltam ${stillMissing.length}.` : ''}`,
        recoveredQuestions.length > 0 ? 'success' : 'warning',
      );
      addLog(`Tentativa focada concluida: ${recoveredQuestions.length} recuperada(s), ${stillMissing.length} ainda faltante(s).`);
    } catch (error) {
      addToast(`Erro ao tentar recuperar questoes faltantes: ${readErrorMessage(error)}`, 'error');
      addLog(`Tentativa focada interrompida: ${readErrorMessage(error)}`);
    } finally {
      setIsRetryingMissingQuestions(false);
      setBulkProgress(0);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) {
      return;
    }

    setIsBulkGenerating(true);
    setBulkProgress(0);
    try {
      const updatedQuestions = await generateDetailedAnalysesForQuestions(extractedQuestions, {
        updateLiveState: true,
        logLabel: 'Iniciando geracao em lote de analises detalhadas...',
      });
      setExtractedQuestions((current) => current.map((question, index) => (
        updatedQuestions[index]
          ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
          : question
      )));
      addLog('Geracao em massa concluida!');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleBulkGenerateTeacher = async () => {
    if (extractedQuestions.length === 0) {
      return;
    }

    setIsBulkGenerating(true);
    setBulkProgress(0);
    try {
      const updatedQuestions = await generateTeacherCommentsForQuestions(extractedQuestions, {
        updateLiveState: true,
        logLabel: 'Iniciando geracao em lote de comentarios do professor...',
      });
      setExtractedQuestions((current) => current.map((question, index) => (
        updatedQuestions[index]
          ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
          : question
      )));
      addLog('Geracao em massa de comentarios do professor concluida!');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleGenerateSpecific = async (index: number, type: GenerateSpecificType) => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    if (!question) {
      setGeneratingSpecific(null);
      return;
    }

    try {
      const fieldPatch = type === 'teacher'
        ? { teacherComment: await aiService.generateTeacherComment(question) }
        : { detailedComment: await aiService.generateDetailedAnalysis(question) };

      setExtractedQuestions((previous) => {
        const next = [...previous];
        next[index] = mergeQuestionEditorialPatch(next[index] || question, fieldPatch);
        return next;
      });
    } catch {
      addToast('Erro ao gerar comentario. Tente novamente.', 'error');
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const readRequiredExamMetadata = () => {
    const roles = normalizeRoleList(importMetadata?.roles, importMetadata?.cargos, importMetadata?.role);
    const role = summarizeRoleList(roles, String(importMetadata?.role || importMetadata?.examName || importMetadata?.contestName || '').trim());
    const source = String(importMetadata?.source || importMetadata?.agency || '').trim();
    const year = String(importMetadata?.year || importMetadata?.ano || '').trim();

    return { role, roles, source, year };
  };

  const buildImportExamPayload = (questionsForSubjects: Question[]) => {
    const examName = buildExamTitle(importMetadata, qFile?.name?.replace(/\.pdf$/i, '') || 'Prova importada');
    const roleLabels = normalizeRoleList(importMetadata?.roles, importMetadata?.cargos, importMetadata?.role);
    const roleSummary = summarizeRoleList(roleLabels, importMetadata?.role || '');
    const metadataSubjects = Array.isArray(importMetadata?.subjects) && importMetadata.subjects.length > 0
      ? importMetadata.subjects
      : deriveQuestionSubjects(questionsForSubjects.length > 0 ? questionsForSubjects : extractedQuestions);
    const bookletMetadata = buildBookletMetadata(importMetadata, qFile?.name, examName);

    return {
      examName,
      exam: {
        ...importMetadata,
        ...bookletMetadata,
        subjects: metadataSubjects,
        title: examName,
        examTitle: examName,
        name: examName,
        nome: examName,
        agency: importMetadata?.agency || '',
        source: importMetadata?.source || '',
        role: roleSummary,
        roles: roleLabels,
        cargos: roleLabels,
        year: importMetadata?.year || new Date().getFullYear(),
        level: importMetadata?.level || '',
        examType: importMetadata?.examType || 'Concurso',
      },
    };
  };

  const syncPublishedExam = async (exam: Record<string, unknown> | undefined, examName: string) => {
    const examRecord: Record<string, unknown> = exam && typeof exam === 'object' ? exam : {};
    const bookletMetadata = buildBookletMetadata(importMetadata, qFile?.name, examName);
    const roleLabels = normalizeRoleList(importMetadata?.roles, importMetadata?.cargos, importMetadata?.role);
    const primaryRole = roleLabels[0] || importMetadata?.role || '';
    const normalizedExam = normalizeProvaRecord({
      ...examRecord,
      ...bookletMetadata,
      roles: roleLabels,
      cargos: roleLabels,
      id: examRecord.id ?? examRecord.provaId ?? examRecord.prova_id ?? examRecord.exam_id ?? examRecord.publishedExamId,
      nome: String(examRecord.nome || examRecord.name || examRecord.title || examRecord.examTitle || examName),
      slug: String(examRecord.slug || slugify(examName)),
      ano: Number(examRecord.ano || examRecord.year || importMetadata?.year || new Date().getFullYear()),
      tipo: Number(examRecord.tipo || 0),
      index: String(examRecord.index || ''),
      nivel: String(examRecord.nivel || examRecord.level || importMetadata?.level || ''),
      examType: importMetadata?.examType || examRecord.examType || examRecord.exam_type || 'Concurso',
      banca: {
        id: Number(((examRecord as { banca?: { id?: unknown } }).banca?.id) || 0),
        sigla: importMetadata?.agency || '',
        nome: importMetadata?.agency || '',
        slug: slugify(importMetadata?.agency || 'banca'),
      },
      orgao: {
        id: Number(((examRecord as { orgao?: { id?: unknown } }).orgao?.id) || 0),
        sigla: importMetadata?.source || '',
        nome: importMetadata?.source || '',
        slug: slugify(importMetadata?.source || 'orgao'),
      },
      cargo: {
        id: Number(((examRecord as { cargo?: { id?: unknown } }).cargo?.id) || 0),
        descricao: primaryRole,
        ['descrição']: primaryRole,
        slug: slugify(primaryRole || 'cargo'),
      },
    });
    const savedExam = normalizedExam
      ? { ...normalizedExam, ...bookletMetadata }
      : { ...examRecord, ...bookletMetadata, nome: examName, title: examName, examTitle: examName };
    setPublishedExam(savedExam as Record<string, unknown>);

    if (!normalizedExam || !updateSystemSettings || !saveSystemSettingsNow) {
      return normalizedExam;
    }

    const previousExamBank = systemSettings.examBank || [];
    const nextSettings = {
      ...systemSettings,
      examBank: [
        normalizedExam,
        ...previousExamBank.filter((item) => String(item.id) !== String(normalizedExam.id)),
      ],
    };
    updateSystemSettings(nextSettings);
    await saveSystemSettingsNow(nextSettings);
    return normalizedExam;
  };

  const buildQuestionPublishPayload = (entries: Array<{ question: Question; index: number }>) => {
    const contextTempIdByQuestionNumber = new Map<number, string>();
    extractedContexts.forEach((context) => {
      context.questionNumbers.forEach((questionNumber) => {
        if (Number.isFinite(questionNumber) && questionNumber > 0) {
          contextTempIdByQuestionNumber.set(questionNumber, context.tempId);
        }
      });
    });

    const questionsForPublish = entries.map(({ question, index }) => {
      const questionNumber = getImportedQuestionNumber(question, index + 1);
      const contextTempId = contextTempIdByQuestionNumber.get(questionNumber);
      const questionWithSupportImages = buildIntroTextWithSupportImages(question);
      const draft = questionWithSupportImages as unknown as ImportedQuestionDraft;

      if (!contextTempId) {
        return {
          ...questionWithSupportImages,
          questionNumber,
          question_number: questionNumber,
          contextKey: draft.contextKey || '',
          grupoQuestaoTempId: draft.contextKey || undefined,
          contextTempId: draft.contextKey || undefined,
        } as Question;
      }

      return {
        ...questionWithSupportImages,
        questionNumber,
        question_number: questionNumber,
        contextKey: contextTempId,
        grupoQuestaoTempId: contextTempId,
        contextTempId,
      } as Question;
    });
    const selectedQuestionNumbers = new Set(
      questionsForPublish.map((question, index) => getImportedQuestionNumber(question, entries[index]?.index + 1)),
    );
    const contextsForPublish = extractedContexts
      .map((context) => ({
        ...context,
        questionNumbers: context.questionNumbers.filter((questionNumber) => selectedQuestionNumbers.has(questionNumber)),
      }))
      .filter((context) => context.questionNumbers.length > 0);

    return {
      questionsForPublish,
      contextsForPublish,
      questionNumbers: Array.from(selectedQuestionNumbers),
    };
  };

  const validateExamBeforePublish = () => {
    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de publicar.', 'error');
      return null;
    }

    const { role, source, year } = readRequiredExamMetadata();
    if (!role || !source || !year) {
      addToast('Preencha Cargo/Prova, Orgao/Fonte e Ano antes de publicar a prova.', 'error');
      return null;
    }

    return selectedFocus;
  };

  const handlePublishExamOnly = async () => {
    const selectedFocus = validateExamBeforePublish();
    if (!selectedFocus) {
      return;
    }
    setPublishingAction('exam');
    try {
      const { examName, exam } = buildImportExamPayload(extractedQuestions);
      const response = await questionService.createImportedExam({
        exam,
        focus: selectedFocus as Record<string, unknown>,
      });

      if (!response.success) {
        throw new Error(response.message || 'Falha ao salvar a prova importada.');
      }

      const syncedExam = await syncPublishedExam(response.exam, examName);
      if (!syncedExam) {
        throw new Error('A API salvou a prova, mas nao retornou um ID valido para o banco de provas.');
      }
      addToast('Prova publicada. Agora voce pode publicar as questoes vinculadas.', 'success');
    } catch (error) {
      addToast(`Erro ao publicar prova: ${readErrorMessage(error)}`, 'error');
    } finally {
      setPublishingAction(null);
    }
  };

  const publishQuestionEntries = async (
    entries: Array<{ question: Question; index: number }>,
    action: ImportPublishAction,
  ) => {
    const selectedFocus = validateExamBeforePublish();
    if (!selectedFocus) {
      return;
    }
    if (!publishedExam) {
      addToast('Publique a prova antes de publicar questoes.', 'error');
      return;
    }
    const publishedExamId = publishedExam.id ?? publishedExam.provaId ?? publishedExam.prova_id ?? publishedExam.exam_id ?? publishedExam.publishedExamId;
    if (!publishedExamId) {
      addToast('A prova publicada nao retornou ID valido. Publique a prova novamente antes das questoes.', 'error');
      return;
    }
    if (entries.length === 0) {
      addToast('Nenhuma questao pendente para publicar.', 'info');
      return;
    }

    const missingAlternatives = entries.filter(({ question }) => {
      const filledOptionsCount = Array.isArray(question.itens)
        ? question.itens.filter((item) => String(item.corpo || '').trim()).length
        : 0;
      return filledOptionsCount < getQuestionExpectedOptionsCount(question);
    });
    if (missingAlternatives.length > 0) {
      addToast(`${missingAlternatives.length} questao(oes) precisam de alternativas antes da publicacao.`, 'error');
      return;
    }

    setPublishingAction(action);
    try {
      const { questionsForPublish, contextsForPublish, questionNumbers } = buildQuestionPublishPayload(entries);
      const { examName, exam } = buildImportExamPayload(questionsForPublish);
      const response = await questionService.createImportedQuestionBatch({
        exam: {
          ...exam,
          publishedExamId,
          provaId: publishedExamId,
          prova_id: publishedExamId,
        },
        focus: selectedFocus as Record<string, unknown>,
        contexts: contextsForPublish.map((context) => ({
          tempId: context.tempId,
          contextKey: context.tempId,
          statement: context.title,
          text: formatStructuredSupportHtml([
            context.text,
            context.figureDescription ? `Figura/Imagem: ${context.figureDescription}` : '',
          ].filter(Boolean).join('\n\n')),
          questionNumbers: context.questionNumbers,
          imageData: context.imageData,
        })),
        questions: questionsForPublish,
        requireExistingExam: true,
      }, null);

      if (!response.success) {
        throw new Error(response.message || 'Falha ao salvar as questoes importadas.');
      }

      await syncPublishedExam((response.exam || publishedExam) as Record<string, unknown>, examName);
      if (response.created && response.created.length > 0) {
        onImportedQuestionsSaved?.(response.created);
      }
      setPublishedQuestionNumbers((previous) => (
        Array.from(new Set([...previous, ...questionNumbers])).sort((left, right) => left - right)
      ));

      let message = entries.length === 1 ? 'Questao publicada.' : `${entries.length} questao(oes) enviadas para publicacao.`;
      if (response.skippedDuplicateCount && response.skippedDuplicateCount > 0) {
        message += `\n\n${response.skippedDuplicateCount} questao(oes) duplicada(s) ignorada(s).`;
      }
      if (response.newTaxonomies?.length) {
        const createdTaxonomies = response.newTaxonomies
          .map((taxonomy) => [taxonomy.type, taxonomy.name].filter(Boolean).join(': '))
          .filter(Boolean);

        if (createdTaxonomies.length > 0) {
          message += `\n\nNovos itens criados: ${createdTaxonomies.join(', ')}`;
        }
      }

      addToast(message, 'success');
    } catch (error) {
      addToast(`Erro ao publicar questoes: ${readErrorMessage(error)}`, 'error');
    } finally {
      setPublishingAction(null);
    }
  };

  const handlePublishAllQuestions = async () => {
    const publishedSet = new Set(publishedQuestionNumbers);
    const entries = extractedQuestions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => !publishedSet.has(getImportedQuestionNumber(question, index + 1)));
    const missingByQuantity = importDiagnostics.missingQuestionNumbers.length;
    if (missingByQuantity > 0) {
      addLog(`${missingByQuantity} questao(oes) esperadas pelo gabarito ainda nao apareceram; publicacao seguira apenas com o lote revisado.`);
    }

    await publishQuestionEntries(entries, 'questions');
  };

  const handlePublishSingleQuestion = async (index: number) => {
    const question = extractedQuestions[index];
    if (!question) {
      addToast('Questao nao encontrada na revisao.', 'error');
      return;
    }

    const questionNumber = getImportedQuestionNumber(question, index + 1);
    if (publishedQuestionNumbers.includes(questionNumber)) {
      addToast('Esta questao ja foi publicada.', 'info');
      return;
    }

    await publishQuestionEntries([{ question, index }], `question:${questionNumber}`);
  };

  const replaceExtractedQuestion = (index: number, question: Question) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      next[index] = question;
      return next;
    });
  };

  const updateImportMetadataField = (field: ImportMetadataField, value: string) => {
    const metadataValue = field === 'subjects' ? parseSubjectsInput(value) : value;
    setImportMetadata((previous) => {
      const roleListPatch = field === 'role'
        ? {
          roles: normalizeRoleList(value),
          cargos: normalizeRoleList(value),
        }
        : {};
      const nextMetadata = {
        ...(previous || {}),
        [field]: metadataValue,
        ...roleListPatch,
      } as ImportMetadata;

      return {
        ...nextMetadata,
        ...buildBookletMetadata(nextMetadata),
      } as ImportMetadata;
    });

    if (['agency', 'source', 'role', 'year', 'level', 'examType'].includes(field)) {
      setExtractedQuestions((previous) => previous.map((question) => (
        applySharedExamMetadataToQuestion(question, field, value)
      )));
    }
  };

  const updateExtractedQuestionField = (
    index: number,
    field: ExtractedQuestionEditableField,
    value: string,
  ) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      if (field === 'subject' || field === 'topic' || field === 'specificSubject') {
        const current = getQuestionTaxonomyParts(question);
        const hierarchy = resolveTaxonomyHierarchy(
          field === 'subject' ? value : current.subject,
          field === 'topic' ? value : current.topic,
          field === 'specificSubject' ? value : current.specificSubject,
        );
        next[index] = {
          ...question,
          assuntos: buildResolvedSubjectTaxonomies(question, hierarchy),
        } as Question;
        return next;
      }

      if (field === 'agency') {
        next[index] = {
          ...question,
          bancas: value ? [createTaxonomyLabel(value, { sigla: value })] : [],
        } as Question;
        return next;
      }

      if (field === 'organization') {
        next[index] = {
          ...question,
          orgaos: value ? [createTaxonomyLabel(value)] : [],
        } as Question;
        return next;
      }

      if (field === 'role') {
        const roles = normalizeRoleList(value);
        next[index] = {
          ...question,
          cargos: roles.map((role) => createTaxonomyLabel(role, { descricao: role })),
        } as unknown as Question;
        return next;
      }

      if (field === 'year') {
        const parsedYear = Number(String(value).replace(/\D/g, ''));
        next[index] = {
          ...question,
          anos: Number.isFinite(parsedYear) && parsedYear > 0 ? [parsedYear] : [],
        } as Question;
        return next;
      }

      if (field === 'level') {
        next[index] = {
          ...question,
          nivel: value || null,
          level: value || null,
          niveis: value ? [createTaxonomyLabel(value)] : [],
        } as Question & { niveis?: QuestionTaxonomyLabel[] };
        return next;
      }

      if (field === 'difficulty') {
        next[index] = {
          ...question,
          dificuldade: normalizeDifficulty(value),
          difficulty: value,
        } as Question;
        return next;
      }

      if (field === 'modality') {
        next[index] = {
          ...question,
          tipo: value,
          modality: value,
        } as Question;
        return next;
      }

      return next;
    });
  };

  const updateExtractedQuestionStatement = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = {
        ...question,
        enunciado: value,
        enunciado_clean: stripHtml(value),
      } as Question;
      return next;
    });
  };

  const updateExtractedQuestionIntroText = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = {
        ...question,
        introText: value,
        intro_text: value,
      } as Question;
      return next;
    });
  };

  const updateExtractedQuestionReferenceText = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = {
        ...question,
        referenceText: value,
        reference_text: value,
      } as unknown as Question;
      return next;
    });
  };

  const updateExtractedQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question || !Array.isArray(question.itens)) {
        return previous;
      }

      next[questionIndex] = {
        ...question,
        itens: question.itens.map((item, index) => (
          index === optionIndex
            ? {
              ...item,
              corpo: value,
              corpo_clean: stripHtml(value),
            }
            : item
        )),
      } as Question;
      return next;
    });
  };

  const addExtractedQuestionOption = (questionIndex: number) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question) {
        return previous;
      }

      const currentItems = Array.isArray(question.itens) ? question.itens : [];
      const nextIndex = currentItems.length;
      if (nextIndex >= 10) {
        addToast('Limite de 10 alternativas por questao atingido.', 'error');
        return previous;
      }

      next[questionIndex] = {
        ...question,
        itens: [
          ...currentItems,
          {
            id: nextIndex + 1,
            ordem: nextIndex + 1,
            rotulo: String.fromCharCode(65 + nextIndex),
            corpo: '',
            corpo_clean: '',
          },
        ],
        needsImportReview: true,
      } as Question;
      return next;
    });
  };

  const addExtractedQuestionSupportImage = (questionIndex: number, imageData: string, fileName = '') => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex] as unknown as ImportedQuestionDraft | undefined;
      if (!question) {
        return previous;
      }

      const questionNumber = getExtractedQuestionNumber(question as Question, questionIndex + 1);
      const supportImages = Array.isArray(question.supportImages) ? question.supportImages : [];
      next[questionIndex] = {
        ...(next[questionIndex] as Question),
        supportImages: [
          ...supportImages,
          {
            tempId: `manual-q-${questionNumber}-fig-${Date.now()}`,
            title: fileName || `Figura de apoio da questao ${questionNumber}`,
            imageData: cleanImageData,
            pageImageData: cleanImageData,
            manualCropApplied: true,
          },
        ],
        needsImportReview: true,
      } as unknown as Question;
      return next;
    });
  };

  const updateExtractedQuestionOptionImage = (
    questionIndex: number,
    optionIndex: number,
    imageData: string,
  ) => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex || !Array.isArray(currentQuestion.itens)) {
        return currentQuestion;
      }

      return {
        ...currentQuestion,
        hasImageItens: true,
        needsImportReview: true,
        itens: currentQuestion.itens.map((item, currentOptionIndex) => {
          if (currentOptionIndex !== optionIndex) {
            return item;
          }

          const label = item.rotulo || String.fromCharCode(65 + optionIndex);
          return {
            ...item,
            corpo: createVisualOptionHtml(label, cleanImageData),
            corpo_clean: stripHtml(item.corpo || '') || `Alternativa visual ${label}`,
            imageData: cleanImageData,
            pageImageData: cleanImageData,
            figureBox: { x: 0, y: 0, width: 1000, height: 1000 },
          };
        }),
      } as unknown as Question;
    }));
  };

  const removeExtractedQuestionOption = (questionIndex: number, optionIndex: number) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question || !Array.isArray(question.itens)) {
        return previous;
      }

      const currentItems = question.itens;
      if (currentItems.length <= 1) {
        addToast('A questao precisa manter pelo menos uma alternativa.', 'error');
        return previous;
      }

      const nextItems = currentItems
        .filter((_, index) => index !== optionIndex)
        .map((item, index) => ({
          ...item,
          id: index + 1,
          ordem: index + 1,
          rotulo: String.fromCharCode(65 + index),
        }));
      const currentCorrectIndex = Number((question as { correctOptionIndex?: unknown }).correctOptionIndex);
      const nextCorrectIndex = Number.isFinite(currentCorrectIndex)
        ? Math.max(0, Math.min(
          nextItems.length - 1,
          currentCorrectIndex > optionIndex ? currentCorrectIndex - 1 : currentCorrectIndex,
        ))
        : 0;

      next[questionIndex] = {
        ...question,
        itens: nextItems,
        correctOptionIndex: nextCorrectIndex,
        resposta: nextCorrectIndex + 1,
        needsImportReview: true,
      } as Question;
      return next;
    });
  };

  const updateExtractedContextContent = (tempId: string, value: string) => {
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          text: value,
        }
        : context
    )));
  };

  const updateExtractedContextField = (
    tempId: string,
    field: 'title' | 'text' | 'figureDescription',
    value: string,
  ) => {
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          [field]: value,
        }
        : context
    )));
  };

  const updateExtractedContextQuestionNumbers = (tempId: string, questionNumbers: number[]) => {
    const uniqueNumbers = Array.from(new Set(
      questionNumbers
        .map((number) => Number(number))
        .filter((number) => Number.isFinite(number) && number > 0),
    )).sort((a, b) => a - b);

    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          questionNumbers: uniqueNumbers,
        }
        : context
    )));
  };

  const updateExtractedContextImage = (tempId: string, imageData: string, fileName = '') => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          hasFigure: true,
          figureDescription: context.figureDescription || fileName || context.title || 'Figura vinculada ao contexto',
          imageData: cleanImageData,
          pageImageData: cleanImageData,
          figureBox: { x: 0, y: 0, width: 1000, height: 1000 },
          manualCropApplied: true,
        }
        : context
    )));
    addToast('Figura adicionada ao contexto.', 'success');
  };

  const addExtractedContextForQuestion = (questionIndex: number) => {
    const question = extractedQuestions[questionIndex];
    if (!question) {
      addToast('Questao nao encontrada para vincular contexto.', 'error');
      return;
    }

    const questionNumber = getExtractedQuestionNumber(question, questionIndex + 1);
    const tempId = `manual-q-${questionNumber}-context-${Date.now()}`;
    setExtractedContexts((previous) => [
      ...previous,
      {
        tempId,
        title: `Texto de apoio da questao ${questionNumber}`,
        text: '',
        questionNumbers: [questionNumber],
        hasFigure: false,
        figureDescription: '',
        page: Number((question as ImportedQuestionDraft).sourcePage || 0),
      },
    ]);
    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => (
      currentIndex === questionIndex
        ? {
          ...currentQuestion,
          contextKey: tempId,
          grupoQuestaoTempId: tempId,
          needsImportReview: true,
        } as Question
        : currentQuestion
    )));
    addToast('Contexto criado e vinculado a questao.', 'success');
  };

  const removeExtractedContext = (tempId: string) => {
    setExtractedContexts((previous) => previous.filter((context) => context.tempId !== tempId));
    setExtractedQuestions((previous) => previous.map((question) => {
      const draft = question as ImportedQuestionDraft;
      if (String(draft.contextKey || draft.grupoQuestaoTempId || '') !== tempId) {
        return question;
      }

      const next = { ...question } as ImportedQuestionDraft;
      delete next.contextKey;
      delete next.grupoQuestaoTempId;
      return next as Question;
    }));
    addToast('Contexto removido do lote.', 'success');
  };

  const updateExtractedQuestionSupportImageCrop = async (
    questionIndex: number,
    imageTempId: string,
    figureBox: FigureBox,
  ) => {
    const question = extractedQuestions[questionIndex] as unknown as ImportedQuestionDraft | undefined;
    const supportImages = Array.isArray(question?.supportImages) ? question.supportImages : [];
    const supportImage = supportImages.find((image) => image.tempId === imageTempId);
    if (!supportImage) {
      addToast('Figura de apoio nao encontrada nesta questao.', 'error');
      return;
    }
    if (!supportImage.pageImageData) {
      addToast('Pagina original desta figura nao esta disponivel para recorte.', 'error');
      return;
    }

    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!normalizedBox) {
      addToast('Recorte invalido.', 'error');
      return;
    }

    const imageData = await cropFigureImage(supportImage.pageImageData, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte.', 'error');
      return;
    }

    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex) {
        return currentQuestion;
      }

      const draft = currentQuestion as unknown as ImportedQuestionDraft;
      return {
        ...currentQuestion,
        supportImages: (draft.supportImages || []).map((image) => (
          image.tempId === imageTempId
            ? {
              ...image,
              imageData,
              figureBox: normalizedBox,
              manualCropApplied: true,
            }
            : image
        )),
      } as unknown as Question;
    }));
    addToast('Recorte da figura de apoio aplicado.', 'success');
  };

  const removeExtractedQuestionSupportImage = (questionIndex: number, imageTempId: string) => {
    setExtractedQuestions((previous) => previous.map((question, currentIndex) => {
      if (currentIndex !== questionIndex) {
        return question;
      }

      const draft = question as unknown as ImportedQuestionDraft;
      return {
        ...question,
        supportImages: (draft.supportImages || []).filter((image) => image.tempId !== imageTempId),
      } as unknown as Question;
    }));
  };

  const updateExtractedQuestionOptionImageCrop = async (
    questionIndex: number,
    optionIndex: number,
    figureBox: FigureBox,
  ) => {
    const question = extractedQuestions[questionIndex];
    const option = question?.itens?.[optionIndex] as (
      | (NonNullable<Question['itens']>[number] & { pageImageData?: string; imageData?: string; figureBox?: FigureBox })
      | undefined
    );
    if (!question || !option) {
      addToast('Alternativa nao encontrada.', 'error');
      return;
    }
    const cropSourceImage = option.pageImageData || option.imageData || extractFirstInlineImageData(option.corpo);
    if (!cropSourceImage) {
      addToast('Imagem desta alternativa nao esta disponivel para recorte.', 'error');
      return;
    }

    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!normalizedBox) {
      addToast('Recorte invalido.', 'error');
      return;
    }

    const imageData = await cropFigureImage(cropSourceImage, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte.', 'error');
      return;
    }

    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex || !Array.isArray(currentQuestion.itens)) {
        return currentQuestion;
      }

      return {
        ...currentQuestion,
        hasImageItens: true,
        itens: currentQuestion.itens.map((item, currentOptionIndex) => {
          if (currentOptionIndex !== optionIndex) {
            return item;
          }

          const label = item.rotulo || String.fromCharCode(65 + optionIndex);
          return {
            ...item,
            corpo: createVisualOptionHtml(label, imageData),
            corpo_clean: `Alternativa visual ${label}`,
            imageData,
            pageImageData: option.pageImageData || cropSourceImage,
            figureBox: normalizedBox,
          };
        }),
      } as unknown as Question;
    }));
    addToast('Recorte da alternativa aplicado.', 'success');
  };

  const removeExtractedQuestion = (index: number) => {
    setExtractedQuestions((previous) => {
      const question = previous[index];
      if (!question) {
        return previous;
      }

      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      setExtractedContexts((contexts) => contexts
        .flatMap((context) => {
          if (!context.questionNumbers.includes(questionNumber)) {
            return [context];
          }

          const questionNumbers = context.questionNumbers.filter((number) => number !== questionNumber);
          return questionNumbers.length > 0 ? [{ ...context, questionNumbers }] : [];
        }));

      addToast(`Questao ${questionNumber} removida do lote de importacao.`, 'success');
      return previous.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const updateContextFigureCrop = async (tempId: string, figureBox: FigureBox) => {
    const context = extractedContexts.find((item) => item.tempId === tempId);
    if (!context) {
      addToast('Contexto da figura nao encontrado.', 'error');
      return;
    }
    if (!context.pageImageData) {
      addToast('A pagina original desta figura nao esta disponivel para recorte manual.', 'error');
      return;
    }

    const normalizedBox = {
      x: Math.max(0, Math.min(1000, Number(figureBox.x) || 0)),
      y: Math.max(0, Math.min(1000, Number(figureBox.y) || 0)),
      width: Math.max(10, Math.min(1000, Number(figureBox.width) || 0)),
      height: Math.max(10, Math.min(1000, Number(figureBox.height) || 0)),
    };
    normalizedBox.width = Math.min(normalizedBox.width, 1000 - normalizedBox.x);
    normalizedBox.height = Math.min(normalizedBox.height, 1000 - normalizedBox.y);

    const imageData = await cropFigureImage(context.pageImageData, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte. Ajuste a area e tente novamente.', 'error');
      return;
    }

    setExtractedContexts((previous) => previous.map((item) => (
      item.tempId === tempId
        ? {
          ...item,
          imageData,
          figureBox: normalizedBox,
          hasFigure: true,
          manualCropApplied: true,
        }
        : item
    )));
    addLog(`Recorte da figura "${context.title}" atualizado manualmente.`);
    addToast('Recorte aplicado ao contexto. Confira o preview antes de publicar.', 'success');
  };

  return {
    qFile,
    setQFile,
    kFile,
    setKFile,
    selectedFocusId,
    setSelectedFocusId,
    manualFocusName,
    setManualFocusName,
    importMetadata,
    importDiagnostics,
    extractedContexts,
    isProcessing,
    extractWithComment,
    setExtractWithComment,
    extractWithDetailedAnalysis,
    setExtractWithDetailedAnalysis,
    examProgress,
    keyProgress,
    logs,
    extractedQuestions,
    isBulkGenerating,
    isRetryingMissingQuestions,
    bulkProgress,
    publishedExam,
    publishedQuestionNumbers,
    publishingAction,
    generatingSpecific,
    handleImportProcess,
    handleBulkGenerateDetailed,
    handleBulkGenerateTeacher,
    handleRetryMissingQuestions,
    handleGenerateSpecific,
    handlePublishExamOnly,
    handlePublishAllQuestions,
    handlePublishSingleQuestion,
    updateImportMetadataField,
    updateExtractedQuestionField,
    updateExtractedQuestionStatement,
    updateExtractedQuestionIntroText,
    updateExtractedQuestionReferenceText,
    updateExtractedQuestionOption,
    addExtractedQuestionOption,
    removeExtractedQuestionOption,
    addExtractedQuestionSupportImage,
    updateExtractedQuestionOptionImage,
    addExtractedContextForQuestion,
    removeExtractedContext,
    updateExtractedContextContent,
    updateExtractedContextField,
    updateExtractedContextQuestionNumbers,
    updateExtractedContextImage,
    updateExtractedQuestionSupportImageCrop,
    removeExtractedQuestionSupportImage,
    updateExtractedQuestionOptionImageCrop,
    replaceExtractedQuestion,
    removeExtractedQuestion,
    updateContextFigureCrop,
  };
};

