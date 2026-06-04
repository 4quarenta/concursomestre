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
import type { Question, SystemSettings } from '@types';
import MathRichText from '@/components/shared/math/MathRichText';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
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
  RefreshCw,
  Save,
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

type GenerateSpecificType = 'teacher' | 'detailed';
type ImportPublishAction = 'exam' | 'questions' | `question:${number}`;
type ImportMetadataField = 'agency' | 'source' | 'year' | 'role' | 'level' | 'title' | 'examTitle' | 'examName' | 'contestName' | 'examType' | 'caderno' | 'tipoCaderno' | 'corCaderno' | 'bookletType' | 'bookletColor' | 'subjects';
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
  sourcePage?: number | string;
  needsImportReview?: boolean;
  contextKey?: string;
  grupoQuestaoTempId?: string | number;
  figureDescription?: string;
  referenceText?: string;
  reference_text?: string;
  supportImages?: ExtractedQuestionImagePreview[];
  role?: string;
  year?: string | number;
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
  manualCropApplied?: boolean;
};

type ImportDiagnosticsPreview = {
  expectedQuestionNumbers: number[];
  extractedQuestionNumbers: number[];
  missingQuestionNumbers: number[];
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

const asTextList = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => asText(item)).filter(Boolean)
    : asText(value).split(/\s+\/\s+|[,;\n]/).map((item) => item.trim()).filter(Boolean)
);

const appendExamYear = (title: string, year: unknown) => {
  const cleanTitle = asText(title).replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const cleanYear = asText(year).match(/\d{4}/)?.[0] || '';
  return cleanYear ? `${cleanTitle} (${cleanYear})` : cleanTitle;
};

const buildExamTitlePreview = (metadata: Record<string, unknown>) => {
  const explicitTitle = asText(metadata.title || metadata.examTitle || metadata.name || metadata.nome);
  const roleList = asTextList(metadata.roles || metadata.cargos);
  const role = roleList.length > 0 ? roleList.join(' / ') : asText(metadata.role || metadata.examName || metadata.contestName);
  const source = asText(metadata.source || metadata.agency);
  const baseTitle = explicitTitle || (role && source ? `${role} - ${source}` : '');
  return baseTitle ? appendExamYear(baseTitle, metadata.year || metadata.ano) : '';
};

const getTaxonomyLabel = (item: unknown) => {
  if (!item || typeof item !== 'object') return asText(item);
  const record = item as Record<string, unknown>;
  return asText(record.name || record.nome || record.descricao || record.sigla || record.slug);
};

const getQuestionNumber = (question: ExtractedQuestionPreview, fallback: number) => {
  const match = asText(question.questionNumber ?? question.question_number ?? question.id ?? fallback).match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

const getQuestionSubject = (question: Question) => (
  (question.assuntos || []).find((subject) => Boolean(subject.materia))?.name || ''
);

const getQuestionTopic = (question: Question) => (
  (question.assuntos || []).filter((subject) => !subject.materia)[0]?.name || ''
);

const getQuestionSpecificSubject = (question: Question) => (
  (question.assuntos || []).filter((subject) => !subject.materia)[1]?.name || ''
);

const getQuestionIntroText = (question: Question) => {
  const record = question as unknown as { introText?: unknown; intro_text?: unknown };
  return asText(record.introText || record.intro_text);
};

const getQuestionReferenceText = (question: Question) => {
  const record = question as unknown as { referenceText?: unknown; reference_text?: unknown };
  return asText(record.referenceText || record.reference_text);
};

const getQuestionSupportImages = (question: Question) => {
  const record = question as unknown as { supportImages?: unknown };
  return Array.isArray(record.supportImages) ? record.supportImages as ExtractedQuestionImagePreview[] : [];
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
  Array.isArray(question.itens) ? question.itens : []
);

const getFilledQuestionOptionsCount = (question: Question) => (
  getQuestionOptions(question).filter((item) => asText(item.corpo)).length
);

const getQuestionExpectedOptionsCount = (question: Question) => {
  const record = question as unknown as {
    tipo?: unknown;
    modality?: unknown;
    expectedOptionsCount?: unknown;
    expected_options_count?: unknown;
  };
  const explicitCount = Number(asText(record.expectedOptionsCount ?? record.expected_options_count).match(/[2-5]/)?.[0] || 0);
  if (Number.isFinite(explicitCount) && explicitCount >= 2 && explicitCount <= 5) {
    return explicitCount;
  }
  const modalityText = asText(record.tipo || record.modality).toLowerCase();
  if (modalityText.includes('certo')) {
    return 2;
  }
  return Number(modalityText.match(/[2-5]/)?.[0] || 0) || 5;
};

const getCorrectOptionIndex = (question: ExtractedQuestionPreview) => {
  if (Number.isInteger(question.correctOptionIndex)) {
    return Number(question.correctOptionIndex);
  }
  const options = getQuestionOptions(question);
  const answerIndex = options.findIndex((item) => Number(item.id) === Number(question.resposta));
  return answerIndex >= 0 ? answerIndex : Math.max(0, Number(question.resposta || 1) - 1);
};

const getImageDataUri = (imageData?: string) => {
  const value = asText(imageData);
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
};

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
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => void;
  isSavingSettings?: boolean;
  qFile: File | null;
  onQFileChange: (file: File | null) => void;
  kFile: File | null;
  onKFileChange: (file: File | null) => void;
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
  isRetryingMissingQuestions: boolean;
  bulkProgress: number;
  publishedExam: Record<string, unknown> | null;
  publishedQuestionNumbers: number[];
  publishingAction: ImportPublishAction | null;
  onGenerateTeacherAll: () => void;
  onGenerateDetailedAll: () => void;
  onRetryMissingQuestions: () => void | Promise<void>;
  onPublishExam: () => void | Promise<void>;
  onPublishAllQuestions: () => void | Promise<void>;
  onPublishQuestion: (index: number) => void | Promise<void>;
  onEditExtractedQuestion: (question: Question, index: number) => void;
  onDeleteExtractedQuestion: (index: number) => void;
  onContextFigureCropChange: (tempId: string, figureBox: NonNullable<ExtractedContextPreview['figureBox']>) => void | Promise<void>;
  onExtractedQuestionFieldChange: (index: number, field: ExtractedQuestionEditableField, value: string) => void;
  onExtractedQuestionStatementChange: (index: number, value: string) => void;
  onExtractedQuestionIntroTextChange: (index: number, value: string) => void;
  onExtractedQuestionReferenceTextChange: (index: number, value: string) => void;
  onExtractedQuestionOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  onExtractedQuestionOptionAdd: (questionIndex: number) => void;
  onExtractedQuestionOptionRemove: (questionIndex: number, optionIndex: number) => void;
  onExtractedQuestionSupportImageAdd: (questionIndex: number, imageData: string, fileName?: string) => void;
  onExtractedQuestionOptionImageChange: (questionIndex: number, optionIndex: number, imageData: string) => void;
  onExtractedQuestionContextAdd: (questionIndex: number) => void;
  onExtractedContextRemove: (tempId: string) => void;
  onExtractedContextContentChange: (tempId: string, value: string) => void;
  onExtractedContextFieldChange: (tempId: string, field: 'title' | 'text' | 'figureDescription', value: string) => void;
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
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings = false,
  qFile,
  onQFileChange,
  kFile,
  onKFileChange,
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
  isRetryingMissingQuestions,
  bulkProgress,
  publishedExam,
  publishedQuestionNumbers,
  publishingAction,
  onGenerateTeacherAll,
  onGenerateDetailedAll,
  onRetryMissingQuestions,
  onPublishExam,
  onPublishAllQuestions,
  onPublishQuestion,
  onEditExtractedQuestion,
  onDeleteExtractedQuestion,
  onContextFigureCropChange,
  onExtractedQuestionFieldChange,
  onExtractedQuestionStatementChange,
  onExtractedQuestionIntroTextChange,
  onExtractedQuestionReferenceTextChange,
  onExtractedQuestionOptionChange,
  onExtractedQuestionOptionAdd,
  onExtractedQuestionOptionRemove,
  onExtractedQuestionSupportImageAdd,
  onExtractedQuestionOptionImageChange,
  onExtractedQuestionContextAdd,
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
  const metadata = importMetadata || {};
  const metadataRoleList = asTextList(metadata.roles || metadata.cargos);
  const metadataRole = metadataRoleList.length > 0 ? metadataRoleList.join(' / ') : asText(metadata.role || metadata.examName || metadata.contestName);
  const metadataSource = asText(metadata.source || metadata.agency);
  const metadataYear = asText(metadata.year || metadata.ano);
  const metadataTitle = asText(metadata.title || metadata.examTitle);
  const examTitlePreview = buildExamTitlePreview(metadata);
  const missingAlternativesCount = extractedQuestions.filter((question) => getFilledQuestionOptionsCount(question) < getQuestionExpectedOptionsCount(question)).length;
  const effectiveReviewTab = activeReviewTab === 'pending' && missingAlternativesCount === 0 ? 'questions' : activeReviewTab;
  const pendingAlternativeQuestions = React.useMemo(() => (
    (extractedQuestions as ExtractedQuestionPreview[])
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => getFilledQuestionOptionsCount(question) < getQuestionExpectedOptionsCount(question))
  ), [extractedQuestions]);
  const questionsForReview = effectiveReviewTab === 'pending'
    ? pendingAlternativeQuestions
    : (extractedQuestions as ExtractedQuestionPreview[]).map((question, index) => ({ question, index }));
  const missingQuestionNumbers = importDiagnostics.missingQuestionNumbers || [];
  const expectedTotal = importDiagnostics.expectedQuestionNumbers?.length || 0;
  const extractedUniqueTotal = importDiagnostics.extractedQuestionNumbers?.length || extractedQuestions.length;
  const missingByQuantity = missingQuestionNumbers.length;
  const publishedQuestionSet = React.useMemo(() => new Set(publishedQuestionNumbers), [publishedQuestionNumbers]);
  const unpublishedQuestionCount = extractedQuestions.filter((question, index) => (
    !publishedQuestionSet.has(getQuestionNumber(question as ExtractedQuestionPreview, index + 1))
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
  const retryMissingBlocked = isProcessing || importActionBusy || missingByQuantity === 0 || !qFile;
  const examPublishBlocked = isProcessing || importActionBusy || isPublishing || !metadataRole || !metadataSource || !metadataYear || (!selectedFocusId && !manualFocusName.trim());
  const questionsPublishBlocked = isProcessing || importActionBusy || isPublishing || !publishedExam || missingAlternativesCount > 0 || unpublishedQuestionCount === 0;
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

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-6 p-6 transition-colors duration-300`}>
            <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Database size={20} className="text-sky-700 dark:text-sky-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Extracao Inteligente</h3>
            </div>

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
                <Target size={12} className="text-sky-700 dark:text-sky-300" />
                Foco da prova <span className="font-black text-red-500">*</span>
              </label>
              <select
                value={selectedFocusId}
                onChange={(event) => {
                  onSelectedFocusIdChange(event.target.value);
                  if (event.target.value) onManualFocusNameChange('');
                }}
                className={`h-10 w-full min-w-0 max-w-full truncate text-xs font-bold ${ADMIN_FIELD_CLASS}`}
              >
                <option value="">Selecionar foco existente</option>
                {focusOptions.map((focus) => {
                  const value = getFocusSelectValue(focus);
                  const label = getRootFocusLabel(getFocusLabel(focus));
                  return (
                    <option key={value} value={value}>
                      {label || 'Foco sem nome'}
                    </option>
                  );
                })}
              </select>
              <input
                type="text"
                value={manualFocusName}
                onChange={(event) => {
                  onManualFocusNameChange(event.target.value);
                  if (event.target.value.trim()) onSelectedFocusIdChange('');
                }}
                placeholder="Ou adicionar novo foco. Ex.: ENEM, Policial, Tribunais"
                className={`h-10 text-xs font-bold ${ADMIN_FIELD_CLASS}`}
              />
              <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                O foco escolhido sera aplicado a prova e a todas as questoes importadas.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Arquivo da Prova <span className="font-black text-red-500">*</span>
                </label>
                <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${qFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onQFileChange(event.target.files?.[0] || null)} />
                  <UploadCloud size={24} className={qFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {qFile ? qFile.name : 'Selecionar Prova (PDF)'}
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Gabarito Oficial <span className="font-black text-red-500">*</span>
                </label>
                <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${kFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onKFileChange(event.target.files?.[0] || null)} />
                  <FileCheck size={24} className={kFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {kFile ? kFile.name : 'Selecionar Gabarito (PDF)'}
                  </span>
                </label>
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

          <div className="flex h-48 flex-col-reverse overflow-y-auto rounded-md border border-slate-800 bg-slate-900 p-6 font-mono text-[10px] text-emerald-400 shadow-inner transition-colors dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="animate-fade-in opacity-80">{log}</div>
              ))}
              {isProcessing && <div className="animate-pulse">_</div>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8">
          {extractedQuestions.length > 0 ? (
            <div className="flex flex-1 flex-col space-y-4 animate-slide-up">
              <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col justify-between gap-4 p-5 xl:flex-row xl:items-center`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle2 size={16} /> {expectedTotal > 0 ? `${extractedUniqueTotal}/${expectedTotal}` : extractedQuestions.length} Questoes Extraidas
                  </div>
                  {missingByQuantity > 0 && (
                    <div className="flex items-center gap-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">
                      <AlertTriangle size={16} /> Faltam {missingByQuantity}
                    </div>
                  )}
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-5">
                  <button
                    type="button"
                    onClick={onGenerateTeacherAll}
                    disabled={importActionBusy || isProcessing}
                    className="flex min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2.5 text-[10px] font-black uppercase text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                  >
                    {isBulkGenerating ? <Loader2 className="animate-spin" size={14} /> : <GraduationCap size={14} />} Gerar Professor (Todos)
                  </button>
                  <button
                    type="button"
                    onClick={onGenerateDetailedAll}
                    disabled={importActionBusy || isProcessing}
                    className="flex min-w-0 items-center justify-center gap-2 rounded-sm border border-sky-300 bg-sky-50 px-4 py-2.5 text-[10px] font-black uppercase text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                  >
                    {isBulkGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Gerar Analise Detalhada (Todas)
                  </button>
                  {missingByQuantity > 0 && (
                    <button
                      type="button"
                      onClick={onRetryMissingQuestions}
                      disabled={retryMissingBlocked}
                      className="flex min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-500 bg-amber-600 px-4 py-2.5 text-[10px] font-black uppercase text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-600/60 disabled:opacity-60"
                    >
                      {isRetryingMissingQuestions ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      Tentar Faltantes
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onPublishExam}
                    disabled={examPublishBlocked}
                    className="flex min-w-0 items-center justify-center gap-2 rounded-sm border border-sky-700 bg-sky-700 px-4 py-2.5 text-[10px] font-black uppercase text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-700/60 disabled:opacity-60"
                  >
                    {publishingAction === 'exam' ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
                    {publishedExam ? 'Atualizar Prova' : 'Publicar Prova'}
                  </button>
                  <button
                    type="button"
                    onClick={onPublishAllQuestions}
                    disabled={questionsPublishBlocked}
                    className="flex min-w-0 items-center justify-center gap-2 rounded-sm border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-[10px] font-black uppercase text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/60 disabled:opacity-60"
                  >
                    {publishingAction === 'questions' ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                    Publicar Todas
                  </button>
                </div>
                {(!metadataRole || !metadataSource || !metadataYear || !publishedExam || missingAlternativesCount > 0 || missingByQuantity > 0) && (
                  <div className="w-full rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                    {!metadataRole || !metadataSource || !metadataYear
                      ? 'Para publicar, preencha Cargo/Prova, Orgao/Fonte e Ano para formar o titulo Cargo/Prova - Orgao/Fonte (ano).'
                      : !publishedExam
                        ? 'Publique a prova primeiro. Depois publique todas as questoes ou apenas uma questao especifica.'
                        : missingAlternativesCount > 0
                          ? `${missingAlternativesCount} questao(oes) precisam de alternativas antes da publicacao.`
                          : `${missingByQuantity} questao(oes) ainda nao apareceram pela quantidade esperada do gabarito. Voce pode publicar apenas o lote revisado ou tentar reprocessar o PDF.`}
                  </div>
                )}
              </div>

              <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-wrap gap-2 p-2`}>
                {([
                  ['proof', 'Prova', `${subjectsForDisplay.length} materias`, Database],
                  ['contexts', 'Contextos', `${extractedContexts.length} ctx · ${figureContexts.length} fig`, BookOpen],
                  ...(missingAlternativesCount > 0
                    ? [['pending', 'Pendentes', `${missingAlternativesCount} sem alt.`, AlertTriangle] as const]
                    : []),
                  ['questions', 'Questoes', `${extractedQuestions.length} itens`, FileQuestion],
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

              {effectiveReviewTab === 'proof' && (
              <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-4 p-4 text-xs`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Metadados da prova</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      A prova e salva primeiro no banco; depois as questoes sao vinculadas a ela. O titulo deve seguir <strong>Cargo/Prova - Orgao/Fonte (ano)</strong>.
                    </p>
                  </div>
                  <span className="rounded-sm bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {examTitlePreview || 'Titulo pendente'}
                  </span>
                </div>
                <label className="block space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Titulo da prova</span>
                  <input
                    type="text"
                    value={metadataTitle || examTitlePreview}
                    onChange={(event) => onImportMetadataChange('title', event.target.value)}
                    placeholder="Ex.: ENEM - INEP (2025)"
                    className={`h-10 text-xs font-bold ${ADMIN_FIELD_CLASS}`}
                  />
                  <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Se ficar em branco, o sistema usa automaticamente Cargo/Prova - Orgao/Fonte (ano).
                  </span>
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    ['role', 'Cargo/Prova', 'Ex.: ENEM, Analista Judiciario'],
                    ['source', 'Orgao/Fonte', 'Ex.: INEP, TJ-SP'],
                    ['agency', 'Banca', 'Ex.: INEP, FGV'],
                    ['year', 'Ano', 'Ex.: 2025'],
                    ['level', 'Nivel', 'Ex.: Medio, Superior'],
                    ['examType', 'Categoria', 'Concurso ou ENEM'],
                    ['bookletType', 'Tipo/Caderno', 'Ex.: Tipo B, Caderno 1'],
                    ['bookletColor', 'Cor do caderno', 'Ex.: Amarelo, Azul'],
                    ['caderno', 'Resumo do caderno', 'Ex.: Tipo B - Azul'],
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
              </div>
              )}

              {effectiveReviewTab === 'contexts' && (
                <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-3 p-4`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Contextos e figuras extraidos
                    </p>
                    <span className="rounded-sm bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {figureContexts.length} figura(s)
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {extractedContexts.map((context) => (
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
                          </div>
                        </div>
                        <label className="mt-3 block space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Texto do contexto</span>
                          <textarea
                            value={context.text || ''}
                            onChange={(event) => onExtractedContextFieldChange(context.tempId, 'text', event.target.value)}
                            rows={Math.min(12, Math.max(4, Math.ceil(String(context.text || '').length / 130)))}
                            placeholder="Texto de apoio, comando compartilhado ou descricao complementar."
                            className={`${ADMIN_FIELD_CLASS} min-h-28 w-full resize-y whitespace-pre-wrap text-[11px] font-medium leading-relaxed`}
                          />
                        </label>
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
                        {getImageDataUri(context.imageData) && (
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
                    ))}
                    {extractedContexts.length === 0 && (
                      <div className="rounded-sm border border-dashed border-slate-300 p-4 text-center text-xs font-semibold text-slate-400 dark:border-slate-700">
                        Nenhum item extraido para este filtro.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {missingQuestionNumbers.length > 0 && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-black uppercase tracking-widest">Numeros do gabarito sem correspondencia exata</p>
                      <p className="mt-1 break-words font-semibold">{missingQuestionNumbers.slice(0, 80).join(', ')}{missingQuestionNumbers.length > 80 ? '...' : ''}</p>
                      <p className="mt-2 text-[11px] font-medium">
                        Este aviso pode incluir questoes extraidas sem numeracao original confiavel. A contagem de falta usada no botao e baseada em {extractedQuestions.length}/{expectedTotal || extractedQuestions.length}.
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
                      {isRetryingMissingQuestions ? 'Tentando Gerar Faltantes' : 'Gerando Comentarios em Massa'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{bulkProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-sky-700 transition-all duration-300 dark:bg-sky-500" style={{ width: `${bulkProgress}%` }} />
                  </div>
                </div>
              )}

              {(effectiveReviewTab === 'questions' || effectiveReviewTab === 'pending') && (
              <div className="no-scrollbar flex-1 max-h-[800px] space-y-4 overflow-y-auto pr-2">
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
                  const isQuestionPublished = publishedQuestionSet.has(questionNumber);
                  const publishQuestionAction = `question:${questionNumber}` as const;
                  const singlePublishBlocked = isPublishing || !publishedExam || hasMissingOptions || isQuestionPublished;
                  const introText = getQuestionIntroText(question);
                  const referenceText = getQuestionReferenceText(question);
                  const supportImages = getQuestionSupportImages(question);
                  const showIntroBlock = Boolean(introText) || supportImages.length > 0 || editingIntroTextIndex === index;
                  const showReferenceBlock = Boolean(referenceText) || editingReferenceTextIndex === index;

                  return (
                  <div key={index} className="group relative overflow-hidden rounded-sm border border-slate-300 bg-white p-6 transition-colors hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700">
                    <div className="absolute left-0 top-0 h-full w-1 bg-slate-200 transition-colors group-hover:bg-sky-700 dark:bg-slate-800 dark:group-hover:bg-sky-500" />
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900 text-xs font-black text-white dark:bg-sky-700">
                          {questionNumber}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {question.bancas?.map((banca) => banca.sigla || banca.name).join(' / ') || 'Banca N/I'}
                          </span>
                          <span className="rounded-sm bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            {question.assuntos?.filter((subject) => subject.materia).map((subject) => subject.name).join(', ') || 'Materia N/I'}
                          </span>
                          <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            {question.assuntos?.filter((subject) => !subject.materia).map((subject) => subject.name).join(', ') || 'Assunto N/I'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(question.anulada || question.isCanceled) && <span className="rounded bg-red-100 px-2 py-0.5 text-[8px] font-black uppercase text-red-700 dark:bg-red-900/40 dark:text-red-400">Anulada</span>}
                        {(question.desatualizada || question.isOutdated) && <span className="rounded bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Desat.</span>}
                        {isQuestionPublished && <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">Publicado</span>}
                        <div className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                          Gabarito: {String.fromCharCode(65 + correctIndex)}
                        </div>
                        {hasMissingOptions && (
                          <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300">
                            Revisar alternativas
                          </span>
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
                                  value={asText(value).toLowerCase().includes('certo') ? 'certo ou errado' : 'multipla escolha'}
                                  onChange={(event) => onExtractedQuestionFieldChange(index, field, event.target.value)}
                                  className={`h-9 text-[11px] font-bold ${ADMIN_FIELD_CLASS}`}
                                >
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
                          <textarea
                            value={introText}
                            onChange={(event) => onExtractedQuestionIntroTextChange(index, event.target.value)}
                            rows={Math.min(12, Math.max(4, Math.ceil(introText.length / 110)))}
                            className={`${ADMIN_FIELD_CLASS} min-h-28 w-full resize-y text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200`}
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
                                  onExtractedContextRemove(context.tempId);
                                }}
                                className="rounded-sm border border-red-200 bg-white px-2 py-1 text-[8px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-300"
                              >
                                Excluir
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
                                  <textarea
                                    value={context.text}
                                    onChange={(event) => onExtractedContextContentChange(context.tempId, event.target.value)}
                                    rows={Math.min(14, Math.max(5, Math.ceil(context.text.length / 120)))}
                                    className={`${ADMIN_FIELD_CLASS} min-h-36 w-full resize-y whitespace-pre-wrap text-[11px] font-medium leading-relaxed`}
                                  />
                                ) : (
                                  <p className="max-h-80 overflow-y-auto whitespace-pre-line rounded-sm border border-sky-100 bg-white p-3 text-[11px] font-medium leading-relaxed text-slate-600 dark:border-sky-900/30 dark:bg-slate-900 dark:text-slate-300">
                                    {context.text}
                                  </p>
                                )}
                              </div>
                            )}
                            {context.figureDescription && (
                              <p className="mt-2 rounded-sm border border-violet-200 bg-white p-2 text-[11px] font-semibold leading-relaxed text-violet-800 dark:border-violet-900/40 dark:bg-slate-900 dark:text-violet-200">
                                {context.figureDescription}
                              </p>
                            )}
                            {getImageDataUri(context.imageData) && (
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
                          value={question.enunciado || ''}
                          onChange={(event) => onExtractedQuestionStatementChange(index, event.target.value)}
                          rows={Math.min(12, Math.max(4, Math.ceil(String(question.enunciado || '').length / 110)))}
                          className={`${ADMIN_FIELD_CLASS} min-h-32 w-full resize-y text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-200`}
                        />
                      ) : (
                        <h4 className="rounded-sm border border-slate-200 bg-white p-3 text-sm font-bold leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200">
                          {question.enunciado}
                        </h4>
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
                        {question.teacherComment ? 'Regerar Professor' : 'Gerar Professor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateSpecific(index, 'detailed')}
                        disabled={!!generatingSpecific || isBulkGenerating}
                        className="flex items-center gap-1.5 rounded-sm border border-sky-300 bg-sky-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                      >
                        {generatingSpecific?.index === index && generatingSpecific.type === 'detailed' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        {question.detailedComment ? 'Regerar Detalhado' : 'Gerar Detalhado'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onPublishQuestion(index)}
                        disabled={singlePublishBlocked}
                        className="ml-auto flex items-center gap-1.5 rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        title={!publishedExam ? 'Publique a prova antes de publicar questoes.' : undefined}
                      >
                        {publishingAction === publishQuestionAction ? <Loader2 className="animate-spin" size={12} /> : <FileCheck size={12} />}
                        {isQuestionPublished ? 'Publicado' : 'Postar Questao'}
                      </button>
                    </div>

                    {question.teacherComment && (
                      <div className="mt-4 animate-fade-in space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 opacity-80 group-hover:opacity-100 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <BookOpen size={14} /> Comentario do Professor
                        </p>
                        <p className="font-medium italic leading-relaxed">{question.teacherComment}</p>
                      </div>
                    )}

                    {question.detailedComment && (
                      <div className="mt-2 animate-fade-in space-y-2 rounded-sm border border-sky-300 bg-sky-50 p-4 text-xs text-sky-800 opacity-80 group-hover:opacity-100 dark:border-sky-900/30 dark:bg-sky-900/10 dark:text-sky-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <Sparkles size={14} /> Analise Detalhada (IA)
                        </p>
                        <MathRichText content={question.detailedComment} disableCallouts className="max-h-72 overflow-y-auto rounded-sm bg-white/70 p-3 text-[11px] font-medium leading-relaxed text-slate-700 dark:bg-slate-950/20 dark:text-slate-200" />
                      </div>
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
                <FileText size={80} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Aguardando Arquivos</h3>
                <p className="mx-auto max-w-xs text-sm font-medium text-slate-400 dark:text-slate-500">
                  Faca o upload da Prova e do Gabarito para iniciar a extracao em massa com IA.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImportSection;
