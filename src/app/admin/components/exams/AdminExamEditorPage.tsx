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
import { CalendarClock, ChevronDown, ChevronRight, Download, FileCheck2, FileText, Link2, Loader2, Pencil, PlusCircle, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { ExamFileAttachment, ExamFileKind, Prova, Question } from '@types';
import { fetchAuthenticatedResource } from '@services/api';
import { adminService } from '@services/admin/adminService';
import { examService } from '@services/exams/examService';
import { clientLog } from '@services/monitoring/clientLog';
import { aiService, type ExtractedExamNoticeAiResult } from '@services/questions/aiService';
import { questionService } from '@services/questions/questionService';
import type { ExamDraftState } from './useAdminExamBankWorkflow';
import { extractExamNoticeMetadata } from './examNoticeExtractor';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';
import { SmartTagSelector } from '../database/SmartTagSelector';

interface AdminExamEditorPageProps {
  draft: ExamDraftState;
  setDraft: React.Dispatch<React.SetStateAction<ExamDraftState>>;
  linkedQuestionsCount: number;
  examPreview: Prova | null;
  agencyOptions?: ExamTaxonomyOption[];
  organizationOptions?: ExamTaxonomyOption[];
  roleOptions?: ExamTaxonomyOption[];
  focusOptions?: ExamTaxonomyOption[];
  subjectOptions?: ExamTaxonomyOption[];
  topicOptions?: ExamTaxonomyOption[];
  specificSubjectOptions?: ExamTaxonomyOption[];
  yearOptions?: Array<string | number>;
  levelOptions?: string[];
  isNew: boolean;
  isSaving: boolean;
  isDeleting?: boolean;
  onUploadExamFile?: (file: File, kind: ExamFileKind) => Promise<ExamFileAttachment>;
  onSave: () => void;
  onDelete?: () => void;
}

interface ExamTaxonomyOption {
  id?: string | number;
  name?: string;
  nome?: string;
  sigla?: string;
  slug?: string;
  parentId?: string | number;
  parent_id?: string | number;
}

type ExamQuestionEditorialSuggestion = NonNullable<ExtractedExamNoticeAiResult['questionEditorialSuggestions']>[number];
type ExternalExamNoticeMetadata = ExtractedExamNoticeAiResult & {
  examTitle?: string;
  level?: string;
  examType?: string;
  bookletType?: string;
  bookletColor?: string;
  focuses?: string[];
  platformQuestionIds?: string[];
};

const EditorPanel = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const MetaBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{children}</label>
);

const TextInput = ({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}) => (
  <input
    type={type}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
  />
);

const TextAreaInput = ({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) => (
  <textarea
    value={value}
    rows={rows}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={`box-border min-h-24 w-full max-w-full resize-y py-2 ${ADMIN_FIELD_CLASS}`}
  />
);

const SelectInput = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
  >
    {children}
  </select>
);

const EXAM_FILE_CONFIG: Array<{ kind: ExamFileKind; label: string; description: string }> = [
  { kind: 'prova', label: 'Prova', description: 'Arquivo principal do caderno de questões.' },
  { kind: 'gabarito', label: 'Gabarito', description: 'Gabarito oficial, definitivo ou preliminar.' },
  { kind: 'edital', label: 'Edital', description: 'Edital, retificação ou documento do certame.' },
];

const formatFileSize = (size?: number) => {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTaxonomyName = (item?: ExamTaxonomyOption | null) => String(item?.name || item?.nome || item?.sigla || '').trim();
const getTaxonomySigla = (item?: ExamTaxonomyOption | null) => String(item?.sigla || item?.name || item?.nome || '').trim();
const getTaxonomyLabel = (item: ExamTaxonomyOption) => {
  const sigla = getTaxonomySigla(item);
  const name = getTaxonomyName(item);
  return sigla && name && sigla !== name ? `${sigla} - ${name}` : name || sigla || String(item.id || '');
};

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const splitTaxonomyValues = (value: string) => Array.from(new Set(
  String(value || '')
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean),
));

const normalizeOrganizationCandidate = (value: string) => {
  const cleanValue = String(value || '').replace(/\s+/g, ' ').trim();
  const normalized = normalizeSearchText(cleanValue).replace(/[^a-z0-9-]/g, '');
  if (normalized === 'pmpb') return 'PM-PB';
  if (normalized === 'cbmpb') return 'CBM-PB';
  return cleanValue;
};

const isLikelyExamOrganization = (value: string) => {
  const label = normalizeOrganizationCandidate(value);
  const normalized = normalizeSearchText(label);
  if (!normalized || normalized.length < 3 || normalized.length > 120) {
    return false;
  }
  if (/\b(aditivo|edital|candidato|candidatos|comissao|comissoes|coordenadoras|diario oficial|enderecos|eletronicos|www|http|lei|artigo|inciso|constituicao|constitucional|cumprimento|disposto|harmonia|publique-se|vaga|vagas|cargo|cargos|requisito|requisitos|inscricao|inscricoes|remuneracao|anexo|conteudo programatico|defesa social|seguranca)\b/.test(normalized)) {
    return false;
  }

  return /\b(policia|corpo de bombeiros|bombeiros militar|tribunal|ministerio publico|defensoria|secretaria de estado|prefeitura|camara municipal|assembleia legislativa)\b/.test(normalized)
    || /\b(pm-?[a-z]{2}|cbm-?[a-z]{2}|pc-?[a-z]{2}|tj-?[a-z]{2}|trt-?\d{1,2}|tre-?[a-z]{2}|tce-?[a-z]{2}|mp-?[a-z]{2}|dpe-?[a-z]{2}|sefaz-?[a-z]{2}|seduc-?[a-z]{2}|see-?[a-z]{2}|seap-?[a-z]{2}|sejusp-?[a-z]{2}|prf|pf|pcdf|pmdf)\b/.test(normalized);
};

const sanitizeExtractedOrganizations = (values: string[]) => Array.from(new Set(
  values
    .map(normalizeOrganizationCandidate)
    .filter(isLikelyExamOrganization),
));

const getTaxonomyParentId = (item?: ExamTaxonomyOption | null) => String(
  item?.parentId || item?.parent_id || '',
);

const findSelectedTaxonomyId = (options: ExamTaxonomyOption[], id: string, sigla: string, name: string) => {
  const normalizedId = String(id || '');
  if (normalizedId && options.some((item) => String(item.id || '') === normalizedId)) {
    return normalizedId;
  }

  const normalizedSigla = String(sigla || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  const selected = options.find((item) => {
    const itemSigla = getTaxonomySigla(item).toLowerCase();
    const itemName = getTaxonomyName(item).toLowerCase();
    return Boolean(
      (normalizedSigla && (itemSigla === normalizedSigla || itemName === normalizedSigla))
      || (normalizedName && (itemName === normalizedName || itemSigla === normalizedName)),
    );
  });

  return selected?.id ? String(selected.id) : '';
};

type ExamScopedDraftItem = {
  id: string;
  scopeType: 'geral' | 'orgao' | 'cargo' | 'foco';
  scope: string;
  orgao?: string;
  chave: string;
  texto: string;
};

const fileToBase64 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

type ExamProgrammaticDraftItem = {
  id: string;
  materiaId?: string;
  materia: string;
  topicoId?: string;
  topico: string;
  assuntoId?: string;
  assunto: string;
  questoes: string;
  orgao: string;
  cargo: string;
  foco: string;
};

type ExamStageDraftItem = {
  id: string;
  nome: string;
  criterio: 'eliminatorio' | 'classificatorio' | 'eliminatorio_classificatorio';
  data: string;
  descricao: string;
};

type ExamRoleFocusDraftItem = {
  id: string;
  foco: string;
  cargos: string[];
};

const newDraftRowId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const safeParseArray = <T,>(value: string): T[] => {
  if (!String(value || '').trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const serializeDraftArray = (items: unknown[]) => JSON.stringify(items, null, 2);

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const pickRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
};

const readTextValue = (record: Record<string, unknown>, keys: string[]) => String(pickRecordValue(record, keys) || '').trim();

const readTextListValue = (record: Record<string, unknown>, keys: string[]) => {
  const value = pickRecordValue(record, keys);
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).trim();
        }
        const itemRecord = asRecord(item);
        return readTextValue(itemRecord, ['nome', 'name', 'sigla', 'label', 'titulo', 'title', 'texto', 'text', 'value']);
      })
      .filter(Boolean)));
  }
  if (typeof value === 'string') {
    return Array.from(new Set(value.split(/\n|;/).map((item) => item.trim()).filter(Boolean)));
  }
  return [];
};

const extractJsonObjectText = (value: string) => {
  let text = String(value || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  return firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text;
};

const normalizeExternalScopedItems = (value: unknown): NonNullable<ExtractedExamNoticeAiResult['requirementsDetailed']> => {
  const entries = Array.isArray(value)
    ? value
    : Object.entries(asRecord(value)).map(([chave, texto]) => ({ chave, texto }));

  return entries
    .map((entry) => {
      const item = asRecord(entry);
      const scopeType = String(readTextValue(item, ['scopeType', 'tipoEscopo', 'escopoTipo', 'tipo']) || 'geral');
      const normalizedScopeType: 'geral' | 'orgao' | 'cargo' | 'foco' = ['orgao', 'cargo', 'foco'].includes(scopeType)
        ? scopeType as 'orgao' | 'cargo' | 'foco'
        : 'geral';
      return {
        scopeType: normalizedScopeType,
        scope: readTextValue(item, ['scope', 'escopo', 'aplicarA', 'aplicar_a', 'orgao', 'órgão', 'cargo', 'foco']) || 'Todos',
        chave: readTextValue(item, ['chave', 'key', 'label', 'titulo', 'title', 'nome']),
        texto: readTextValue(item, ['texto', 'text', 'valor', 'value', 'descricao', 'description']),
      };
    })
    .filter((item) => item.chave || item.texto);
};

const normalizeExternalProgrammaticItems = (value: unknown): NonNullable<ExtractedExamNoticeAiResult['programmaticContentDetailed']> => {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((entry) => {
      const item = asRecord(entry);
      return {
        materia: readTextValue(item, ['materia', 'matéria', 'subject', 'disciplina']),
        topico: readTextValue(item, ['topico', 'tópico', 'topic']),
        assunto: readTextValue(item, ['assunto', 'specificSubject', 'specific_subject']),
        questoes: readTextValue(item, ['questoes', 'questões', 'questions', 'totalQuestoes', 'total_questoes']),
        orgao: readTextValue(item, ['orgao', 'órgão', 'organization']),
        cargo: readTextValue(item, ['cargo', 'role']),
        foco: readTextValue(item, ['foco', 'focus', 'area', 'área']),
      };
    })
    .filter((item) => item.materia || item.topico || item.assunto);
};

const normalizeExternalStageItems = (value: unknown): NonNullable<ExtractedExamNoticeAiResult['stages']> => {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((entry) => {
      const item = asRecord(entry);
      const rawCriterion = normalizeSearchText(readTextValue(item, ['criterio', 'critério', 'criterion', 'tipo']));
      const criterio: 'eliminatorio' | 'classificatorio' | 'eliminatorio_classificatorio' = rawCriterion.includes('eliminatorio') && rawCriterion.includes('classificatorio')
        ? 'eliminatorio_classificatorio'
        : rawCriterion.includes('eliminatorio')
          ? 'eliminatorio'
          : 'classificatorio';
      return {
        nome: readTextValue(item, ['nome', 'name', 'etapa', 'stage']),
        criterio,
        data: readTextValue(item, ['data', 'date']),
        descricao: readTextValue(item, ['descricao', 'descrição', 'description', 'observacao', 'observação']),
      };
    })
    .filter((item) => item.nome || item.descricao);
};

const normalizeExamTitlePart = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s+-\s+/g, ' - ')
  .trim();

const compactExamOrganization = (value: string) => {
  const text = normalizeExamTitlePart(value);
  const normalized = normalizeSearchText(text);
  const parenthetical = text.match(/\(([A-Z]{2,}(?:[-/][A-Z]{2,})?)\)/);

  if (/pm[-\s]?pb|pmpb|policia militar.*paraiba/.test(normalized)) {
    return 'PM-PB';
  }
  if (/cbm[-\s]?pb|cbmpb|bombeiros?.*paraiba/.test(normalized)) {
    return 'CBM-PB';
  }
  if (parenthetical?.[1]) {
    return parenthetical[1].replace(/([A-Z]{2,})([A-Z]{2})$/, '$1-$2');
  }
  if (/tribunal de justica.*sao paulo|tj[-\s]?sp/.test(normalized)) {
    return 'TJ-SP';
  }
  if (/policia civil.*sao paulo|pc[-\s]?sp/.test(normalized)) {
    return 'PC-SP';
  }

  return text.length > 36 ? text.slice(0, 36).trim() : text;
};

const compactExamRole = (value: string) => {
  const text = normalizeExamTitlePart(value)
    .replace(/^curso de formacao de\s+/i, '')
    .replace(/^curso de formação de\s+/i, '')
    .replace(/^cargo de\s+/i, '');
  const normalized = normalizeSearchText(text);

  if (/soldado.*policia militar|soldado.*pm/.test(normalized)) {
    return /combatente/.test(normalized) ? 'Soldado PM - Combatente' : 'Soldado PM';
  }
  if (/soldado.*bombeiro|soldado.*bm/.test(normalized)) {
    return /combatente/.test(normalized) ? 'Soldado BM - Combatente' : 'Soldado BM';
  }
  if (/soldados? da policia militar e do corpo de bombeiros|soldados? da policia militar.*bombeiros/.test(normalized)) {
    return 'Soldado';
  }

  return text.length > 42 ? text.slice(0, 42).trim() : text;
};

const joinExamTitleParts = (values: string[]) => Array.from(new Set(values.map(normalizeExamTitlePart).filter(Boolean))).join(' / ');

const buildExternalExamDisplayTitle = (metadata: ExternalExamNoticeMetadata, fallback = '') => {
  const agency = normalizeExamTitlePart(metadata.agency || metadata.agencyName || '');
  const year = normalizeExamTitlePart(metadata.year || '');
  const organizations = sanitizeExtractedOrganizations(metadata.organizations || [])
    .map(compactExamOrganization)
    .filter(Boolean);
  const roles = (metadata.roles || [])
    .map((item) => compactExamRole(String(item || '')))
    .filter(Boolean);
  const organizationPart = joinExamTitleParts(organizations);
  const rolePart = joinExamTitleParts(roles);
  const parts = [agency, year, organizationPart, rolePart].filter(Boolean);

  return parts.length >= 3 ? parts.join(' - ') : normalizeExamTitlePart(fallback);
};

const normalizeExternalExamNoticeJson = (payload: unknown): ExternalExamNoticeMetadata => {
  const root = asRecord(payload);
  const metadata = asRecord(root.metadata || root.metadados || root.exam || root.prova);
  const source = Object.keys(metadata).length > 0 ? { ...root, ...metadata } : root;

  return {
    examTitle: readTextValue(source, ['examTitle', 'titulo', 'título', 'nome', 'nomeProva']),
    agency: readTextValue(source, ['agency', 'banca', 'bancaSigla', 'banca_sigla']),
    agencyName: readTextValue(source, ['agencyName', 'bancaNome', 'banca_nome', 'nomeBanca']),
    year: readTextValue(source, ['year', 'ano']),
    level: readTextValue(source, ['level', 'nivel', 'nível']),
    examType: readTextValue(source, ['examType', 'tipoProva', 'tipo_prova', 'caderno']),
    bookletType: readTextValue(source, ['bookletType', 'tipoCaderno', 'tipo_caderno']),
    bookletColor: readTextValue(source, ['bookletColor', 'corCaderno', 'cor_caderno']),
    organizations: readTextListValue(source, ['organizations', 'orgaos', 'órgãos', 'orgaosVinculados', 'orgaos_vinculados']),
    roles: readTextListValue(source, ['roles', 'cargos', 'cargosVinculados', 'cargos_vinculados']),
    focuses: readTextListValue(source, ['focuses', 'focos', 'areas', 'áreas']),
    requirementsDetailed: normalizeExternalScopedItems(pickRecordValue(source, ['requirementsDetailed', 'requisitosDetalhados', 'requisitos_detalhados', 'requirements'])),
    remunerationsDetailed: normalizeExternalScopedItems(pickRecordValue(source, ['remunerationsDetailed', 'remuneracoesDetalhadas', 'remuneraçõesDetalhadas', 'remuneracoes_detalhadas', 'remunerations', 'remuneracao'])),
    vacanciesDetailed: normalizeExternalScopedItems(pickRecordValue(source, ['vacanciesDetailed', 'vagasDetalhadas', 'vagas_detalhadas', 'vacancies', 'vagas'])),
    programmaticContentDetailed: normalizeExternalProgrammaticItems(pickRecordValue(source, ['programmaticContentDetailed', 'conteudoProgramaticoDetalhado', 'conteudo_programatico_detalhado', 'programmaticContent', 'conteudoProgramatico'])),
    stages: normalizeExternalStageItems(pickRecordValue(source, ['stages', 'etapas'])),
    registrationStart: readTextValue(source, ['registrationStart', 'inscricaoInicio', 'inscriçãoInício', 'dataInscricaoInicio', 'data_inscricao_inicio']),
    registrationEnd: readTextValue(source, ['registrationEnd', 'inscricaoFim', 'inscriçãoFim', 'dataInscricaoFim', 'data_inscricao_fim']),
    examDate: readTextValue(source, ['examDate', 'dataProva', 'data_prova']),
    registrationFee: readTextValue(source, ['registrationFee', 'valorInscricao', 'valor_inscricao', 'taxaInscricao', 'taxa_inscricao']),
    totalQuestions: readTextValue(source, ['totalQuestions', 'totalQuestoes', 'total_questoes']),
    platformQuestionIds: readTextListValue(source, ['platformQuestionIds', 'questoesVinculadas', 'questõesVinculadas', 'questionIds']),
    evidence: readTextListValue(source, ['evidence', 'evidencias', 'evidências']),
  };
};

const createEmptyScopedItem = (): ExamScopedDraftItem => ({
  id: newDraftRowId(),
  scopeType: 'geral',
  scope: 'Todos',
  chave: '',
  texto: '',
});

const isScopedItemFilled = (item: ExamScopedDraftItem) => Boolean(
  item.chave.trim() || item.texto.trim(),
);

const getScopeTypeLabel = (scopeType: ExamScopedDraftItem['scopeType']) => {
  if (scopeType === 'orgao') return 'Órgão';
  if (scopeType === 'cargo') return 'Cargo';
  if (scopeType === 'foco') return 'Foco';
  return 'Todos';
};

const createEmptyProgrammaticItem = (): ExamProgrammaticDraftItem => ({
  id: newDraftRowId(),
  materiaId: '',
  materia: '',
  topicoId: '',
  topico: '',
  assuntoId: '',
  assunto: '',
  questoes: '',
  orgao: '',
  cargo: '',
  foco: '',
});

const isProgrammaticItemFilled = (item: ExamProgrammaticDraftItem) => Boolean(
  item.materia.trim()
  || item.topico.trim()
  || item.assunto.trim()
  || item.questoes.trim()
  || item.orgao.trim()
  || item.cargo.trim()
  || item.foco.trim(),
);

const cleanupProgrammaticSubjectText = (value: string) => String(value || '')
  .replace(/^\s*assunto\s*:\s*/i, '')
  .replace(/\s+/g, ' ')
  .replace(/[.;]\s*$/, '')
  .trim();

const splitProgrammaticSubjectText = (value: string): string[] => {
  const cleanValue = cleanupProgrammaticSubjectText(value);
  if (!cleanValue) {
    return [];
  }

  const semicolonParts = cleanValue.includes(';')
    ? cleanValue.split(/\s*;\s*/).map(cleanupProgrammaticSubjectText).filter((item) => item.length >= 3)
    : [];

  if (semicolonParts.length > 1) {
    return semicolonParts;
  }

  const numberedMarkers = Array.from(cleanValue.matchAll(/(?:^|\s)(\d{1,3})\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g));
  if (numberedMarkers.length > 1) {
    return cleanValue
      .split(/(?=(?:^|\s)\d{1,3}\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ]))/g)
      .map((item) => cleanupProgrammaticSubjectText(item.trim().replace(/^\d{1,3}\.\s*/, '')))
      .filter((item) => item.length >= 3);
  }

  return [cleanValue];
};

const expandProgrammaticSubjectItems = (items: ExamProgrammaticDraftItem[]) => {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const subjects = splitProgrammaticSubjectText(item.assunto);
    const expanded = subjects.length > 1
      ? subjects.map((subject, index) => ({
        ...item,
        id: index === 0 ? item.id : newDraftRowId(),
        assunto: subject,
        assuntoId: index === 0 ? item.assuntoId : '',
        questoes: index === 0 ? item.questoes : '',
      }))
      : [{ ...item, assunto: cleanupProgrammaticSubjectText(item.assunto) }];

    return expanded.filter((entry) => {
      const key = normalizeSearchText([
        entry.materia,
        entry.topico,
        entry.assunto,
        entry.orgao,
        entry.cargo,
        entry.foco,
      ].join('|'));
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  });
};

const createEmptyStageItem = (): ExamStageDraftItem => ({
  id: newDraftRowId(),
  nome: '',
  criterio: 'classificatorio',
  data: '',
  descricao: '',
});

const isStageItemFilled = (item: ExamStageDraftItem) => Boolean(
  item.nome.trim() || item.data.trim() || item.descricao.trim(),
);

const parseQuestionIdsText = (value: string) => Array.from(new Set(
  String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item)),
));

const legacyTextToScopedItems = (value: string): ExamScopedDraftItem[] => (
  String(value || '')
    .split(/\n/)
    .map((texto) => texto.trim())
    .filter(Boolean)
    .map((texto) => {
      const keyValueMatch = texto.match(/^([^:]{2,80}):\s*(.+)$/);
      return {
        id: newDraftRowId(),
        scopeType: 'geral' as const,
        scope: 'Todos',
        chave: keyValueMatch ? keyValueMatch[1].trim() : '',
        texto: keyValueMatch ? keyValueMatch[2].trim() : texto,
      };
    })
);

const normalizeScopedItems = (jsonText: string, legacyText = ''): ExamScopedDraftItem[] => {
  const hasStructuredDraft = String(jsonText || '').trim().startsWith('[');
  const parsed = safeParseArray<Partial<ExamScopedDraftItem> & Record<string, unknown>>(jsonText)
    .map((item) => ({
      id: String(item.id || newDraftRowId()),
      scopeType: (['geral', 'orgao', 'cargo', 'foco'].includes(String(item.scopeType)) ? item.scopeType : 'geral') as ExamScopedDraftItem['scopeType'],
      scope: String(item.scope || item.orgao || item.cargo || item.foco || 'Todos'),
      orgao: String(item.orgao || item.organization || ''),
      chave: String(item.chave || item.key || item.label || item.titulo || item.title || ''),
      texto: String(item.texto || item.text || item.value || item.description || ''),
    }));

  if (hasStructuredDraft) {
    return parsed;
  }

  return parsed.some((item) => item.chave.trim() || item.texto.trim()) ? parsed : legacyTextToScopedItems(legacyText);
};

const normalizeProgrammaticItems = (jsonText: string, legacyText = ''): ExamProgrammaticDraftItem[] => {
  const hasStructuredDraft = String(jsonText || '').trim().startsWith('[');
  const parsed = safeParseArray<Partial<ExamProgrammaticDraftItem> & Record<string, unknown>>(jsonText)
    .map((item) => ({
      id: String(item.id || newDraftRowId()),
      materiaId: String(item.materiaId || item.subjectId || ''),
      materia: String(item.materia || item.subject || ''),
      topicoId: String(item.topicoId || item.topicId || ''),
      topico: String(item.topico || item.topic || ''),
      assuntoId: String(item.assuntoId || item.specificSubjectId || ''),
      assunto: String(item.assunto || item.specificSubject || ''),
      questoes: String(item.questoes || item.questions || ''),
      orgao: String(item.orgao || ''),
      cargo: String(item.cargo || ''),
      foco: String(item.foco || ''),
    }));

  if (hasStructuredDraft || parsed.some((item) => item.materia || item.topico || item.assunto || item.questoes)) {
    return expandProgrammaticSubjectItems(parsed);
  }

  return expandProgrammaticSubjectItems(String(legacyText || '')
    .split(/\n/)
    .map((materia) => materia.trim())
    .filter(Boolean)
    .map((materia) => ({
      id: newDraftRowId(),
      materia,
      topico: '',
      assunto: '',
      questoes: '',
      orgao: '',
      cargo: '',
      foco: '',
    })));
};

const normalizeStageItems = (jsonText: string): ExamStageDraftItem[] => {
  const hasStructuredDraft = String(jsonText || '').trim().startsWith('[');
  const parsed = safeParseArray<Partial<ExamStageDraftItem> & Record<string, unknown>>(jsonText)
    .map((item) => ({
    id: String(item.id || newDraftRowId()),
    nome: String(item.nome || item.name || ''),
    criterio: (['eliminatorio', 'classificatorio', 'eliminatorio_classificatorio'].includes(String(item.criterio || item.criterion))
      ? String(item.criterio || item.criterion)
      : 'classificatorio') as ExamStageDraftItem['criterio'],
    data: String(item.data || item.date || ''),
    descricao: String(item.descricao || item.description || ''),
  }));

  return hasStructuredDraft ? parsed : parsed.filter((item) => item.nome || item.descricao);
};

const normalizeRoleFocusItems = (
  jsonText: string,
  legacyFocusText = '',
  legacyRoleText = '',
): ExamRoleFocusDraftItem[] => {
  const parsed = safeParseArray<Record<string, unknown>>(jsonText)
    .map((item) => {
      const rawRoles = Array.isArray(item.cargos)
        ? item.cargos
        : [item.cargo ?? item.role].filter(Boolean);

      return {
        id: String(item.id || newDraftRowId()),
        foco: String(item.foco || item.focus || ''),
        cargos: Array.from(new Set(rawRoles.map((role) => String(role || '').trim()).filter(Boolean))),
      };
    })
    .filter((item) => item.foco || item.cargos.length > 0);

  if (parsed.length > 0) {
    const grouped = new Map<string, ExamRoleFocusDraftItem>();
    parsed.forEach((item) => {
      const key = normalizeSearchText(item.foco) || item.id;
      const current = grouped.get(key);
      if (current) {
        current.cargos = Array.from(new Set([...current.cargos, ...item.cargos]));
      } else {
        grouped.set(key, { ...item });
      }
    });
    return Array.from(grouped.values());
  }

  const focuses = splitTaxonomyValues(legacyFocusText);
  const roles = splitTaxonomyValues(legacyRoleText);
  if (focuses.length === 0 && roles.length === 0) {
    return [];
  }

  return focuses.map((foco, index) => ({
    id: newDraftRowId(),
    foco,
    cargos: index === 0 ? roles : [],
  }));
};

const RoleFocusArrayEditor = ({
  items,
  focusOptions,
  roleOptions,
  onChange,
}: {
  items: ExamRoleFocusDraftItem[];
  focusOptions: ExamTaxonomyOption[];
  roleOptions: ExamTaxonomyOption[];
  onChange: (items: ExamRoleFocusDraftItem[]) => void;
}) => {
  const rows = items.length > 0
    ? items
    : [{ id: newDraftRowId(), foco: '', cargos: [] }];

  const rolesForFocus = (focusName: string) => {
    const selectedFocus = focusOptions.find((item) => (
      normalizeSearchText(getTaxonomyName(item)) === normalizeSearchText(focusName)
    ));
    const focusId = String(selectedFocus?.id || '');

    return roleOptions.filter((item) => {
      const parentId = getTaxonomyParentId(item);
      return !parentId || !focusId || parentId === focusId;
    });
  };

  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <FieldLabel>Áreas, focos e cargos</FieldLabel>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Cada grupo representa uma área/foco. Os cargos selecionados serão vinculados como subitens dessa área.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, { id: newDraftRowId(), foco: '', cargos: [] }])}
          className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-9 px-3 py-2 text-xs`}
        >
          <PlusCircle size={14} />
          Adicionar área/cargos
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[minmax(220px,0.75fr)_minmax(320px,1.25fr)_auto]"
          >
            <SmartTagSelector
              label="Área / foco"
              options={focusOptions}
              selected={item.foco ? [item.foco] : []}
              onChange={(values) => {
                const next = [...rows];
                next[index] = { ...item, foco: values[0] || '', cargos: [] };
                onChange(next);
              }}
              placeholder="Ex.: Policial"
              multiple={false}
            />
            <SmartTagSelector
              label="Cargos vinculados"
              options={rolesForFocus(item.foco)}
              selected={item.cargos}
              onChange={(values) => {
                const next = [...rows];
                next[index] = { ...item, cargos: values };
                onChange(next);
              }}
              placeholder={item.foco ? 'Selecione ou cadastre cargos' : 'Selecione primeiro a área / foco'}
              disabled={!item.foco}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onChange(rows.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label="Remover grupo de área e cargos"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScopedArrayEditor = ({
  title,
  description,
  items,
  organizationOptions,
  roleOptions,
  placeholder,
  keyValue = false,
  keyPlaceholder = 'Ex.: Escolaridade',
  valueLabel = 'Informação',
  onChange,
}: {
  title: string;
  description: string;
  items: ExamScopedDraftItem[];
  organizationOptions: string[];
  roleOptions: string[];
  placeholder: string;
  keyValue?: boolean;
  keyPlaceholder?: string;
  valueLabel?: string;
  onChange: (items: ExamScopedDraftItem[]) => void;
}) => {
  const [draftItem, setDraftItem] = React.useState<ExamScopedDraftItem>(() => createEmptyScopedItem());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const listItems = items.filter(isScopedItemFilled);
  const rows = listItems;
  const shouldRenderLegacyRows = false;
  const formGridClass = 'md:grid-cols-2 lg:grid-cols-12';

  const commit = (next: ExamScopedDraftItem[]) => onChange(next.filter(isScopedItemFilled));
  const clearDraft = () => {
    setDraftItem(createEmptyScopedItem());
    setEditingId(null);
  };
  const normalizeDraftScope = (item: ExamScopedDraftItem): ExamScopedDraftItem => {
    const hasRole = item.scope && item.scope !== 'Todos';
    return {
      ...item,
      scopeType: hasRole ? 'cargo' : 'orgao',
      scope: hasRole ? item.scope : 'Todos',
    };
  };
  const saveDraftItem = () => {
    if (!isScopedItemFilled(draftItem)) {
      return;
    }

    const scopedItem = normalizeDraftScope(draftItem);
    const normalizedItem: ExamScopedDraftItem = {
      ...scopedItem,
      id: editingId || scopedItem.id || newDraftRowId(),
      scope: scopedItem.scope.trim() || 'Todos',
      chave: scopedItem.chave.trim(),
      texto: scopedItem.texto.trim(),
    };

    if (editingId) {
      commit(listItems.map((item) => (item.id === editingId ? normalizedItem : item)));
    } else {
      commit([...listItems, { ...normalizedItem, id: newDraftRowId() }]);
    }
    clearDraft();
  };

  return (
    <div className="w-full min-w-0 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <FieldLabel>{title}</FieldLabel>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div
          className={`grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${formGridClass}`}
        >
          <div className={keyValue ? 'min-w-0 lg:col-span-2' : 'min-w-0 lg:col-span-3'}>
            <FieldLabel>Órgão</FieldLabel>
            <SelectInput
              value={draftItem.orgao || 'Todos'}
              onChange={(value) => setDraftItem((current) => ({
                ...current,
                orgao: value === 'Todos' ? '' : value,
              }))}
            >
              <option value="Todos">Todos</option>
              {organizationOptions.map((option) => <option key={option} value={option}>{option}</option>) }
            </SelectInput>
          </div>
          <div className={keyValue ? 'min-w-0 lg:col-span-2' : 'min-w-0 lg:col-span-3'}>
            <FieldLabel>Cargo</FieldLabel>
            <SelectInput
              value={draftItem.scope || 'Todos'}
              onChange={(value) => setDraftItem((current) => ({ ...current, scope: value }))}
            >
              <option value="Todos">Todos</option>
              {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectInput>
          </div>
          {keyValue ? (
            <div className="min-w-0 lg:col-span-2">
              <FieldLabel>Chave</FieldLabel>
              <TextInput
                value={draftItem.chave}
                onChange={(value) => setDraftItem((current) => ({ ...current, chave: value }))}
                placeholder={keyPlaceholder}
              />
            </div>
          ) : null}
          <div className="min-w-0 lg:col-span-4">
            <FieldLabel>{valueLabel}</FieldLabel>
            <TextInput
              value={draftItem.texto}
              onChange={(value) => setDraftItem((current) => ({ ...current, texto: value }))}
              placeholder={placeholder}
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 content-end gap-2 lg:col-span-2 lg:self-end">
            {editingId ? (
              <button
                type="button"
                onClick={clearDraft}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 w-full justify-center px-3 py-2 text-xs`}
              >
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveDraftItem}
              disabled={!isScopedItemFilled(draftItem)}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-10 w-full min-w-0 justify-center whitespace-nowrap px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>

        {listItems.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhum item adicionado ainda.
          </div>
        ) : listItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Órgão: {item.orgao || 'Todos'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Cargo: {item.scope || 'Todos'}
                </span>
                {item.chave ? <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.chave}</span> : null}
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.texto || 'Sem descrição'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftItem(item);
                  setEditingId(item.id);
                }}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 py-2 text-xs`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => commit(listItems.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label="Remover item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {shouldRenderLegacyRows && rows.map((item, index) => (
          <div
            key={item.id}
            className={`grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ${
              keyValue
                ? 'lg:grid-cols-[150px_minmax(160px,220px)_minmax(180px,260px)_1fr_auto]'
                : 'lg:grid-cols-[160px_minmax(180px,240px)_1fr_auto]'
            }`}
          >
            <div>
              <FieldLabel>Escopo</FieldLabel>
              <SelectInput
                value={item.scopeType}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, scopeType: value as ExamScopedDraftItem['scopeType'], scope: value === 'geral' ? 'Todos' : item.scope };
                  commit(next);
                }}
              >
                <option value="geral">Todos</option>
                <option value="orgao">Órgão</option>
                <option value="cargo">Cargo</option>
                <option value="foco">Foco</option>
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Aplicar a</FieldLabel>
              <input
                list={`scope-options-${title}-${index}`}
                value={item.scope}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...item, scope: event.target.value };
                  commit(next);
                }}
                placeholder="Todos"
                className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
              />
              <datalist id={`scope-options-${title}-${index}`}>
                {roleOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </div>
            {keyValue ? (
              <div>
                <FieldLabel>Chave</FieldLabel>
                <TextInput
                  value={item.chave}
                  onChange={(value) => {
                    const next = [...rows];
                    next[index] = { ...item, chave: value };
                    commit(next);
                  }}
                  placeholder={keyPlaceholder}
                />
              </div>
            ) : null}
            <div>
              <FieldLabel>{valueLabel}</FieldLabel>
              <TextAreaInput
                value={item.texto}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, texto: value };
                  commit(next);
                }}
                placeholder={placeholder}
                rows={2}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => commit(rows.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label="Remover linha"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProgrammaticArrayEditor = ({
  items,
  subjectOptions,
  topicOptions,
  specificSubjectOptions,
  organizationOptions,
  roleOptions,
  focusOptions,
  onChange,
}: {
  items: ExamProgrammaticDraftItem[];
  subjectOptions: ExamTaxonomyOption[];
  topicOptions: ExamTaxonomyOption[];
  specificSubjectOptions: ExamTaxonomyOption[];
  organizationOptions: string[];
  roleOptions: string[];
  focusOptions: string[];
  onChange: (items: ExamProgrammaticDraftItem[]) => void;
}) => {
  const [draftItem, setDraftItem] = React.useState<ExamProgrammaticDraftItem>(() => createEmptyProgrammaticItem());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [collapsedMatters, setCollapsedMatters] = React.useState<Set<string>>(() => new Set());
  const [collapsedTopics, setCollapsedTopics] = React.useState<Set<string>>(() => new Set());
  const [editingMatterKey, setEditingMatterKey] = React.useState<string | null>(null);
  const [editingMatterLabel, setEditingMatterLabel] = React.useState('');
  const [editingTopicKey, setEditingTopicKey] = React.useState<string | null>(null);
  const [editingTopicLabel, setEditingTopicLabel] = React.useState('');
  const listItems = items.filter(isProgrammaticItemFilled);
  const subjectLabels = React.useMemo(() => subjectOptions.map(getTaxonomyName).filter(Boolean), [subjectOptions]);
  const topicLabels = React.useMemo(() => topicOptions.map(getTaxonomyName).filter(Boolean), [topicOptions]);
  const specificSubjectLabels = React.useMemo(() => specificSubjectOptions.map(getTaxonomyName).filter(Boolean), [specificSubjectOptions]);
  const resolveTaxonomyId = (options: ExamTaxonomyOption[], label: string) => {
    const key = normalizeSearchText(label);
    const match = options.find((option) => normalizeSearchText(getTaxonomyName(option)) === key);
    return match?.id ? String(match.id) : '';
  };
  const mergeHierarchyOptions = (...groups: string[][]) => {
    const unique = new Map<string, string>();
    groups.flat().forEach((value) => {
      const label = String(value || '').trim();
      const key = normalizeSearchText(label);
      if (key && !unique.has(key)) {
        unique.set(key, label);
      }
    });
    return Array.from(unique.values());
  };
  const selectedMatterKey = normalizeSearchText(draftItem.materia);
  const selectedTopicKey = normalizeSearchText(draftItem.topico);
  const hierarchyMatterOptions = mergeHierarchyOptions(
    listItems.map((item) => item.materia),
    subjectLabels,
  );
  const hierarchyTopicOptions = mergeHierarchyOptions(
    listItems
      .filter((item) => !selectedMatterKey || normalizeSearchText(item.materia) === selectedMatterKey)
      .map((item) => item.topico),
    topicLabels,
  );
  const hierarchySubjectOptions = mergeHierarchyOptions(
    listItems
      .filter((item) => (
        (!selectedMatterKey || normalizeSearchText(item.materia) === selectedMatterKey)
        && (!selectedTopicKey || normalizeSearchText(item.topico) === selectedTopicKey)
      ))
      .map((item) => item.assunto),
    specificSubjectLabels,
  );
  const hierarchyItems = [...listItems].sort((left, right) => (
    [left.materia, left.topico, left.assunto]
      .map((value) => normalizeSearchText(value))
      .join('\u0000')
      .localeCompare(
        [right.materia, right.topico, right.assunto]
          .map((value) => normalizeSearchText(value))
          .join('\u0000'),
        'pt-BR',
      )
  ));
  const hierarchyGroups = hierarchyItems.reduce((matters, item) => {
    const matterKey = normalizeSearchText(item.materia) || 'sem-materia';
    const topicKey = normalizeSearchText(item.topico) || 'sem-topico';
    let matter = matters.find((entry) => entry.key === matterKey);

    if (!matter) {
      matter = {
        key: matterKey,
        label: item.materia || 'Sem matéria',
        questoes: item.questoes || '',
        topics: [],
      };
      matters.push(matter);
    } else if (!matter.questoes && item.questoes) {
      matter.questoes = item.questoes;
    }

    let topic = matter.topics.find((entry) => entry.key === topicKey);
    if (!topic) {
      topic = {
        key: topicKey,
        label: item.topico || 'Sem tópico',
        items: [],
      };
      matter.topics.push(topic);
    }

    topic.items.push(item);
    return matters;
  }, [] as Array<{
    key: string;
    label: string;
    questoes: string;
    topics: Array<{
      key: string;
      label: string;
      items: ExamProgrammaticDraftItem[];
    }>;
  }>);
  const rows = listItems;
  const shouldRenderLegacyRows = false;
  const commit = (next: ExamProgrammaticDraftItem[]) => onChange(next.filter(isProgrammaticItemFilled));
  const clearDraft = () => {
    setDraftItem(createEmptyProgrammaticItem());
    setEditingId(null);
  };
  const saveDraftItem = () => {
    if (!isProgrammaticItemFilled(draftItem)) {
      return;
    }
    const existingMatterQuestions = listItems.find((item) => (
      normalizeSearchText(item.materia) === normalizeSearchText(draftItem.materia)
      && String(item.questoes || '').trim()
    ))?.questoes || '';
    const normalizedItem = {
      ...draftItem,
      id: editingId || draftItem.id || newDraftRowId(),
      materiaId: resolveTaxonomyId(subjectOptions, draftItem.materia),
      topicoId: resolveTaxonomyId(topicOptions, draftItem.topico),
      assuntoId: resolveTaxonomyId(specificSubjectOptions, draftItem.assunto),
      questoes: draftItem.questoes || existingMatterQuestions,
    };
    const nextItems = editingId
      ? listItems.map((item) => (item.id === editingId ? normalizedItem : item))
      : [...listItems, { ...normalizedItem, id: newDraftRowId() }];
    const normalizedMatterKey = normalizeSearchText(normalizedItem.materia);
    const syncedItems = normalizedMatterKey && normalizedItem.questoes
      ? nextItems.map((item) => (
        normalizeSearchText(item.materia) === normalizedMatterKey
          ? { ...item, questoes: normalizedItem.questoes }
          : item
      ))
      : nextItems;
    if (editingId) {
      commit(syncedItems);
    } else {
      commit(syncedItems);
    }
    clearDraft();
  };
  const toggleSetKey = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) => setter((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const renameMatter = (matterKey: string) => {
    const label = editingMatterLabel.trim();
    if (!label) return;
    commit(listItems.map((item) => (
      normalizeSearchText(item.materia) === matterKey
        ? { ...item, materia: label, materiaId: resolveTaxonomyId(subjectOptions, label) }
        : item
    )));
    setEditingMatterKey(null);
    setEditingMatterLabel('');
  };
  const renameTopic = (matterKey: string, topicKey: string) => {
    const label = editingTopicLabel.trim();
    if (!label) return;
    commit(listItems.map((item) => (
      normalizeSearchText(item.materia) === matterKey && normalizeSearchText(item.topico) === topicKey
        ? { ...item, topico: label, topicoId: resolveTaxonomyId(topicOptions, label) }
        : item
    )));
    setEditingTopicKey(null);
    setEditingTopicLabel('');
  };

  return (
    <div className="w-full min-w-0 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <FieldLabel>Conteúdo programático</FieldLabel>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Use matéria, tópico e assunto reais das taxonomias. Informe também a quantidade de questões quando o edital trouxer a distribuição.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[1fr_1fr_1fr_110px]">
          {[
            ['Matéria', 'materia', hierarchyMatterOptions],
            ['Tópico', 'topico', hierarchyTopicOptions],
            ['Assunto', 'assunto', hierarchySubjectOptions],
          ].map(([label, key, options]) => (
            <div key={String(key)}>
              <FieldLabel>{String(label)}</FieldLabel>
              <input
                list={`programmatic-draft-${key}`}
                value={String(draftItem[key as keyof ExamProgrammaticDraftItem] || '')}
                onChange={(event) => setDraftItem((current) => ({ ...current, [key as string]: event.target.value }))}
                className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
              />
              <datalist id={`programmatic-draft-${key}`}>
                {(options as string[]).map((option) => <option key={option} value={option} />)}
              </datalist>
            </div>
          ))}
          <div>
            <FieldLabel>Questões</FieldLabel>
            <TextInput
              type="number"
              value={draftItem.questoes}
              onChange={(value) => setDraftItem((current) => ({ ...current, questoes: value }))}
              placeholder="10"
            />
          </div>
          <div className="xl:col-span-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            {[
              ['Órgão', 'orgao', organizationOptions],
              ['Cargo', 'cargo', roleOptions],
              ['Foco', 'foco', focusOptions],
            ].map(([label, key, options]) => (
              <div key={String(key)}>
                <FieldLabel>{String(label)} opcional</FieldLabel>
                <input
                  list={`programmatic-draft-scope-${key}`}
                  value={String(draftItem[key as keyof ExamProgrammaticDraftItem] || '')}
                  onChange={(event) => setDraftItem((current) => ({ ...current, [key as string]: event.target.value }))}
                  className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
                  placeholder="Todos"
                />
                <datalist id={`programmatic-draft-scope-${key}`}>
                  {(options as string[]).map((option) => <option key={option} value={option} />)}
                </datalist>
              </div>
            ))}
            <div className="flex items-end gap-2">
              {editingId ? (
                <button
                  type="button"
                  onClick={clearDraft}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 px-3 py-2 text-xs`}
                >
                  Cancelar
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveDraftItem}
                disabled={!isProgrammaticItemFilled(draftItem)}
                className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-10 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>

        {listItems.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma disciplina adicionada ainda.
          </div>
        ) : hierarchyGroups.map((matter) => {
          const matterCollapsed = collapsedMatters.has(matter.key);
          return (
          <div key={matter.key} className="space-y-3 rounded-sm border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSetKey(setCollapsedMatters, matter.key)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200"
                  aria-label={matterCollapsed ? 'Expandir matéria' : 'Ocultar matéria'}
                  title={matterCollapsed ? 'Expandir matéria' : 'Ocultar matéria'}
                >
                  {matterCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </button>
                {editingMatterKey === matter.key ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editingMatterLabel}
                      onChange={(event) => setEditingMatterLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') renameMatter(matter.key);
                        if (event.key === 'Escape') setEditingMatterKey(null);
                      }}
                      className={`h-9 min-w-0 flex-1 ${ADMIN_FIELD_CLASS}`}
                      aria-label="Nome da matéria"
                    />
                    <button type="button" onClick={() => renameMatter(matter.key)} className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-9 px-3 py-2 text-xs`}>Salvar</button>
                    <button type="button" onClick={() => setEditingMatterKey(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" aria-label="Cancelar edição"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="truncate text-xs font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-200">
                    Matéria: {matter.label}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {matter.questoes ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-200">
                    {matter.questoes} questões esperadas
                  </span>
                ) : null}
                {editingMatterKey !== matter.key ? (
                  <button type="button" onClick={() => { setEditingMatterKey(matter.key); setEditingMatterLabel(matter.label); }} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" aria-label="Editar matéria" title="Editar matéria"><Pencil size={14} /></button>
                ) : null}
                <button type="button" onClick={() => commit(listItems.filter((item) => normalizeSearchText(item.materia) !== matter.key))} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300" aria-label="Remover matéria" title="Remover matéria e seus tópicos"><Trash2 size={14} /></button>
              </div>
            </div>

            {!matterCollapsed ? <div className="space-y-2">
              {matter.topics.map((topic) => {
                const compoundTopicKey = `${matter.key}:${topic.key}`;
                const topicCollapsed = collapsedTopics.has(compoundTopicKey);
                return (
                <div key={`${matter.key}-${topic.key}`} className="rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className={`${topicCollapsed ? '' : 'mb-2'} flex flex-wrap items-center justify-between gap-2`}>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button type="button" onClick={() => toggleSetKey(setCollapsedTopics, compoundTopicKey)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label={topicCollapsed ? 'Expandir tópico' : 'Ocultar tópico'} title={topicCollapsed ? 'Expandir tópico' : 'Ocultar tópico'}>{topicCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                      {editingTopicKey === compoundTopicKey ? (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <input autoFocus value={editingTopicLabel} onChange={(event) => setEditingTopicLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameTopic(matter.key, topic.key); if (event.key === 'Escape') setEditingTopicKey(null); }} className={`h-8 min-w-0 flex-1 ${ADMIN_FIELD_CLASS}`} aria-label="Nome do tópico" />
                          <button type="button" onClick={() => renameTopic(matter.key, topic.key)} className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-8 px-3 py-1.5 text-xs`}>Salvar</button>
                          <button type="button" onClick={() => setEditingTopicKey(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label="Cancelar edição"><X size={14} /></button>
                        </div>
                      ) : (
                        <span className="truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Tópico: {topic.label}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {editingTopicKey !== compoundTopicKey ? <button type="button" onClick={() => { setEditingTopicKey(compoundTopicKey); setEditingTopicLabel(topic.label); }} className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" aria-label="Editar tópico" title="Editar tópico"><Pencil size={13} /></button> : null}
                      <button type="button" onClick={() => commit(listItems.filter((item) => !(normalizeSearchText(item.materia) === matter.key && normalizeSearchText(item.topico) === topic.key)))} className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-950 dark:text-red-300" aria-label="Remover tópico" title="Remover tópico e seus assuntos"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  {!topicCollapsed ? <div className="space-y-2">
                    {topic.items.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 rounded-sm border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {item.assunto ? `Assunto: ${item.assunto}` : 'Sem assunto específico'}
                          </div>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {[
                              item.orgao ? `Órgão: ${item.orgao}` : '',
                              item.cargo ? `Cargo: ${item.cargo}` : '',
                              item.foco ? `Foco: ${item.foco}` : '',
                            ].filter(Boolean).join(' · ') || 'Todos os escopos'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftItem(item);
                              setEditingId(item.id);
                            }}
                            className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 py-2 text-xs`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => commit(listItems.filter((entry) => entry.id !== item.id))}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                            aria-label="Remover disciplina"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div> : null}
                </div>
              );})}
            </div> : null}
          </div>
        );})}

        {shouldRenderLegacyRows && rows.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[1fr_1fr_1fr_110px]">
            {[
              ['Matéria', 'materia', subjectOptions],
              ['Tópico', 'topico', topicOptions],
              ['Assunto', 'assunto', specificSubjectOptions],
            ].map(([label, key, options]) => (
              <div key={String(key)}>
                <FieldLabel>{String(label)}</FieldLabel>
                <input
                  list={`programmatic-${key}-${index}`}
                  value={String(item[key as keyof ExamProgrammaticDraftItem] || '')}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...item, [key as string]: event.target.value };
                    commit(next);
                  }}
                  className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
                />
                <datalist id={`programmatic-${key}-${index}`}>
                  {(options as string[]).map((option) => <option key={option} value={option} />)}
                </datalist>
              </div>
            ))}
            <div>
              <FieldLabel>Questões</FieldLabel>
              <TextInput
                type="number"
                value={item.questoes}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, questoes: value };
                  commit(next);
                }}
                placeholder="10"
              />
            </div>
            <div className="xl:col-span-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              {[
                ['Órgão', 'orgao', organizationOptions],
                ['Cargo', 'cargo', roleOptions],
                ['Foco', 'foco', focusOptions],
              ].map(([label, key, options]) => (
                <div key={String(key)}>
                  <FieldLabel>{String(label)} opcional</FieldLabel>
                  <input
                    list={`programmatic-scope-${key}-${index}`}
                    value={String(item[key as keyof ExamProgrammaticDraftItem] || '')}
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...item, [key as string]: event.target.value };
                      commit(next);
                    }}
                    className={`h-10 w-full ${ADMIN_FIELD_CLASS}`}
                    placeholder="Todos"
                  />
                  <datalist id={`programmatic-scope-${key}-${index}`}>
                    {(options as string[]).map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
              ))}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => commit(rows.filter((entry) => entry.id !== item.id))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                  aria-label="Remover disciplina"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StagesArrayEditor = ({
  items,
  onChange,
}: {
  items: ExamStageDraftItem[];
  onChange: (items: ExamStageDraftItem[]) => void;
}) => {
  const [draftItem, setDraftItem] = React.useState<ExamStageDraftItem>(() => createEmptyStageItem());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const listItems = items.filter(isStageItemFilled);
  const rows = listItems;
  const shouldRenderLegacyRows = false;
  const commit = (next: ExamStageDraftItem[]) => onChange(next.filter(isStageItemFilled));
  const clearDraft = () => {
    setDraftItem(createEmptyStageItem());
    setEditingId(null);
  };
  const saveDraftItem = () => {
    if (!isStageItemFilled(draftItem)) {
      return;
    }
    const normalizedItem = {
      ...draftItem,
      id: editingId || draftItem.id || newDraftRowId(),
      nome: draftItem.nome.trim(),
      descricao: draftItem.descricao.trim(),
    };
    if (editingId) {
      commit(listItems.map((item) => (item.id === editingId ? normalizedItem : item)));
    } else {
      commit([...listItems, { ...normalizedItem, id: newDraftRowId() }]);
    }
    clearDraft();
  };

  return (
    <div className="w-full min-w-0 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <FieldLabel>Etapas</FieldLabel>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Cadastre cada etapa do edital e indique se ela é eliminatória, classificatória ou ambas.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_220px_180px_auto]">
          <div>
            <FieldLabel>Nome da etapa</FieldLabel>
            <TextInput
              value={draftItem.nome}
              onChange={(value) => setDraftItem((current) => ({ ...current, nome: value }))}
              placeholder="Prova objetiva"
            />
          </div>
          <div>
            <FieldLabel>Critério</FieldLabel>
            <SelectInput
              value={draftItem.criterio}
              onChange={(value) => setDraftItem((current) => ({ ...current, criterio: value as ExamStageDraftItem['criterio'] }))}
            >
              <option value="eliminatorio">Eliminatório</option>
              <option value="classificatorio">Classificatório</option>
              <option value="eliminatorio_classificatorio">Eliminatório e classificatório</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Data</FieldLabel>
            <TextInput
              type="date"
              value={draftItem.data}
              onChange={(value) => setDraftItem((current) => ({ ...current, data: value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            {editingId ? (
              <button
                type="button"
                onClick={clearDraft}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 px-3 py-2 text-xs`}
              >
                Cancelar
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveDraftItem}
              disabled={!isStageItemFilled(draftItem)}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-10 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
          <div className="lg:col-span-4">
            <FieldLabel>Observação</FieldLabel>
            <TextAreaInput
              value={draftItem.descricao}
              onChange={(value) => setDraftItem((current) => ({ ...current, descricao: value }))}
              placeholder="Critérios, peso, nota mínima ou observações do edital."
              rows={2}
            />
          </div>
        </div>

        {listItems.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Nenhuma etapa adicionada ainda.
          </div>
        ) : listItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {item.nome || 'Etapa'}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {item.criterio.replaceAll('_', ' ')}
                </span>
                {item.data ? (
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.data}</span>
                ) : null}
              </div>
              {item.descricao ? (
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.descricao}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftItem(item);
                  setEditingId(item.id);
                }}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 py-2 text-xs`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => commit(listItems.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label="Remover etapa"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {shouldRenderLegacyRows && rows.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_220px_180px_auto]">
            <div>
              <FieldLabel>Nome da etapa</FieldLabel>
              <TextInput
                value={item.nome}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, nome: value };
                  commit(next);
                }}
                placeholder="Prova objetiva"
              />
            </div>
            <div>
              <FieldLabel>Critério</FieldLabel>
              <SelectInput
                value={item.criterio}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, criterio: value as ExamStageDraftItem['criterio'] };
                  commit(next);
                }}
              >
                <option value="eliminatorio">Eliminatório</option>
                <option value="classificatorio">Classificatório</option>
                <option value="eliminatorio_classificatorio">Eliminatório e classificatório</option>
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Data</FieldLabel>
              <TextInput
                type="date"
                value={item.data}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, data: value };
                  commit(next);
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => commit(rows.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label="Remover etapa"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="lg:col-span-4">
              <FieldLabel>Observação</FieldLabel>
              <TextAreaInput
                value={item.descricao}
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...item, descricao: value };
                  commit(next);
                }}
                placeholder="Critérios, peso, nota mínima ou observações do edital."
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LinkedQuestionsEditor = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const selectedIds = parseQuestionIdsText(value);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [manualId, setManualId] = React.useState('');
  const [results, setResults] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [knownLabels, setKnownLabels] = React.useState<Record<string, string>>({});
  const requestedPreviewIdsRef = React.useRef<Set<string>>(new Set());
  const [unavailablePreviewIds, setUnavailablePreviewIds] = React.useState<Record<string, boolean>>({});

  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const selectedIdsKey = selectedIds.join('|');

  const getQuestionPreviewLabel = React.useCallback((question: Partial<Question>) => {
    const questionRecord = question as Partial<Question> & Record<string, unknown>;

    return String(
      questionRecord.enunciado
      || questionRecord.enunciado_clean
      || questionRecord.text
      || questionRecord.statement
      || '',
    )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  React.useEffect(() => {
    const keyword = deferredSearchTerm.trim();
    if (keyword.length < 2) {
      React.startTransition(() => {
        setResults([]);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    React.startTransition(() => {
      setLoading(true);
    });

    adminService.getQuestions({ page: 1, keyword })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const nextRows = Array.isArray(payload.rows) ? payload.rows.slice(0, 8) : [];
        setResults(nextRows);
        setKnownLabels((current) => {
          const next = { ...current };
          nextRows.forEach((row) => {
            const id = String(row.id || '');
            const label = getQuestionPreviewLabel(row);
            if (id && label) {
              next[id] = label;
            }
          });
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSearchTerm, getQuestionPreviewLabel]);

  React.useEffect(() => {
    const missingIds = selectedIds.filter((id) => !knownLabels[id] && !requestedPreviewIdsRef.current.has(id));
    if (missingIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    missingIds.forEach((id) => {
      requestedPreviewIdsRef.current.add(id);
    });

    Promise.allSettled(
      missingIds.map(async (id) => {
        const question = await questionService.getQuestionForAdminEdit(id);
        return { id, label: getQuestionPreviewLabel(question) };
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setKnownLabels((current) => {
          const next = { ...current };
          entries.forEach((entry) => {
            if (entry.status === 'fulfilled' && entry.value.label) {
              next[entry.value.id] = entry.value.label;
            }
          });
          return next;
        });

        setUnavailablePreviewIds((current) => {
          const next = { ...current };
          entries.forEach((entry, index) => {
            const id = missingIds[index];
            if (entry.status === 'fulfilled' && entry.value.label) {
              delete next[id];
            } else {
              next[id] = true;
            }
          });
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [getQuestionPreviewLabel, knownLabels, selectedIds, selectedIdsKey]);

  const commitIds = (ids: string[]) => onChange(ids.join(', '));
  const addQuestionId = (id: string, label = '') => {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) {
      return;
    }
    if (label.trim()) {
      setKnownLabels((current) => ({ ...current, [normalizedId]: label.trim() }));
    }
    commitIds(Array.from(new Set([...selectedIds, normalizedId])));
  };
  const removeQuestionId = (id: string) => {
    commitIds(selectedIds.filter((item) => item !== id));
  };

  return (
    <div className="w-full min-w-0 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3">
        <FieldLabel>Questões da plataforma incluídas</FieldLabel>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Busque a questão pelo enunciado ou adicione direto pelo ID. Os itens entram na lista abaixo.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <div>
          <FieldLabel>Buscar questão</FieldLabel>
          <TextInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Digite parte do enunciado"
          />
        </div>
        <div>
          <FieldLabel>Adicionar por ID</FieldLabel>
          <div className="flex gap-2">
            <TextInput
              value={manualId}
              onChange={setManualId}
              placeholder="Ex.: 152"
            />
            <button
              type="button"
              onClick={() => {
                addQuestionId(manualId);
                setManualId('');
              }}
              disabled={!/^\d+$/.test(manualId.trim())}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-10 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
      {searchTerm.trim().length >= 2 ? (
        <div className="mt-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <FieldLabel>Resultados da busca</FieldLabel>
          <div className="mt-2 space-y-2">
            {loading ? (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Buscando questões...</p>
            ) : results.length === 0 ? (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma questão encontrada.</p>
            ) : results.map((question) => {
              const questionId = String(question.id || '');
              const label = getQuestionPreviewLabel(question);
              const alreadySelected = selectedIds.includes(questionId);
              return (
                <div key={questionId} className="flex flex-col gap-2 rounded-sm border border-slate-200 px-3 py-2 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Questao #{questionId}</p>
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{label || 'Sem enunciado disponível'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addQuestionId(questionId, label)}
                    disabled={alreadySelected}
                    className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {alreadySelected ? 'Adicionada' : 'Adicionar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <FieldLabel>Questões adicionadas</FieldLabel>
        <div className="mt-2 space-y-2">
          {selectedIds.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Nenhuma questão vinculada ainda.
            </div>
          ) : selectedIds.map((id) => (
            <div key={id} className="flex flex-col gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Questao #{id}</p>
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {knownLabels[id] || (unavailablePreviewIds[id] ? 'Prévia do enunciado indisponível' : 'Carregando prévia do enunciado...')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeQuestionId(id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300"
                aria-label={`Remover questão ${id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminExamEditorPage = ({
  draft,
  setDraft,
  linkedQuestionsCount,
  examPreview,
  agencyOptions = [],
  organizationOptions = [],
  roleOptions = [],
  focusOptions = [],
  subjectOptions = [],
  topicOptions = [],
  specificSubjectOptions = [],
  yearOptions = [],
  levelOptions = [],
  isNew,
  isSaving,
  isDeleting = false,
  onUploadExamFile,
  onSave,
  onDelete,
}: AdminExamEditorPageProps) => {
  const [uploadingFileKind, setUploadingFileKind] = React.useState<ExamFileKind | null>(null);
  const [extractingNotice, setExtractingNotice] = React.useState(false);
  const [noticeExtractionMessage, setNoticeExtractionMessage] = React.useState('');
  const [localExamFiles, setLocalExamFiles] = React.useState<Partial<Record<ExamFileKind, File>>>({});
  const [externalNoticePromptOpen, setExternalNoticePromptOpen] = React.useState(false);
  const [externalNoticeJsonText, setExternalNoticeJsonText] = React.useState('');
  const [applyingExternalNoticeJson, setApplyingExternalNoticeJson] = React.useState(false);
  const [externalNoticePromptCopied, setExternalNoticePromptCopied] = React.useState(false);

  const updateDraft = (patch: Partial<ExamDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateDraftFiles = (updater: (files: ExamFileAttachment[]) => ExamFileAttachment[]) => {
    setDraft((current) => ({
      ...current,
      files: updater(current.files || []),
    }));
  };

  const mergeTextList = (current: string, next: string[]) => {
    const seen = new Set<string>();

    return [
      ...String(current || '').split(/\n|;/),
      ...next,
    ]
      .map((item) => item.trim())
      .filter((item) => {
        const key = item.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .join('\n');
  };

  const mergeDraftArrayText = (current: string, next: unknown[]) => {
    if (!Array.isArray(next) || next.length === 0) {
      return current;
    }

    const currentItems = safeParseArray<Record<string, unknown>>(current);
    const seen = new Set<string>();
    const normalizeItemKey = (item: Record<string, unknown>) => JSON.stringify({
      scopeType: item.scopeType || '',
      scope: item.scope || '',
      chave: item.chave || '',
      texto: item.texto || '',
      materia: item.materia || '',
      topico: item.topico || '',
      assunto: item.assunto || '',
      questoes: item.questoes || '',
      orgao: item.orgao || '',
      cargo: item.cargo || '',
      foco: item.foco || '',
      nome: item.nome || '',
      criterio: item.criterio || '',
      data: item.data || '',
      descricao: item.descricao || '',
    }).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const merged = [...currentItems, ...(next as Record<string, unknown>[])]
      .filter((item) => {
        const key = normalizeItemKey(item);
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

    return serializeDraftArray(merged);
  };

  const handlePersistWithPatch = (patch: Partial<ExamDraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    requestAnimationFrame(() => {
      onSave();
    });
  };

  const previewFocusLabels = splitTaxonomyValues(draft.focosText || draft.focoNome);
  const previewQuestionIds = String(draft.questoesVinculadasText || '')
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const previewScopedRequirements = normalizeScopedItems(draft.requisitosDetalhadosText, draft.requisitosText);
  const previewScopedRemunerations = normalizeScopedItems(draft.remuneracoesDetalhadasText, draft.remuneracaoText);
  const previewScopedVacancies = normalizeScopedItems(draft.vagasDetalhadasText, draft.vagasText);
  const previewProgrammaticContent = normalizeProgrammaticItems(draft.conteudoProgramaticoDetalhadoText, draft.conteudoProgramaticoText);
  const previewStages = normalizeStageItems(draft.etapasText);

  const publishPreview = examPreview || ({
    id: Number(draft.id || 0),
    nome: draft.nome,
    slug: '',
    ano: Number(draft.ano || 0),
    tipo: 0,
    index: draft.index,
    nivel: draft.nivel,
    caderno: draft.caderno,
    tipoCaderno: draft.tipoCaderno,
    corCaderno: draft.corCaderno,
    bookletType: draft.tipoCaderno,
    bookletColor: draft.corCaderno,
    files: draft.files,
    examFiles: draft.files,
    publishStatus: draft.publishStatus,
    visibilityStatus: draft.visibilityStatus,
    scheduledAt: draft.scheduledAt,
    banca: { id: Number(draft.bancaId || 0), nome: draft.bancaNome, name: draft.bancaNome, sigla: draft.bancaSigla },
    orgao: { id: Number(draft.orgaoId || 0), nome: draft.orgaoNome, name: draft.orgaoNome, sigla: draft.orgaoSigla },
    orgaos: (draft.orgaosText || '')
      .split(/\n|;/)
      .map((value, index) => ({ id: index === 0 ? Number(draft.orgaoId || 0) : 0, nome: value.trim(), name: value.trim(), sigla: value.trim() }))
      .filter((item) => item.nome),
    foco: previewFocusLabels[0] ? { id: Number(draft.focoId || 0), nome: previewFocusLabels[0], name: previewFocusLabels[0] } : undefined,
    focos: previewFocusLabels.map((value, index) => ({ id: index === 0 ? Number(draft.focoId || 0) : 0, nome: value, name: value })),
    carreira: previewFocusLabels[0] ? { id: Number(draft.focoId || 0), nome: previewFocusLabels[0], name: previewFocusLabels[0] } : undefined,
    carreiras: previewFocusLabels.map((value, index) => ({ id: index === 0 ? Number(draft.focoId || 0) : 0, nome: value, name: value })),
    cargo: {
      id: 0,
      descricao: draft.cargoDescricao,
      name: draft.cargoDescricao,
      parentId: draft.focoId || undefined,
      parent_id: draft.focoId || undefined,
    },
    cargos: (draft.cargosText || '')
      .split(/\n|;/)
      .map((value) => ({
        id: 0,
        descricao: value.trim(),
        name: value.trim(),
        parentId: draft.focoId || undefined,
        parent_id: draft.focoId || undefined,
      }))
      .filter((item) => item.descricao),
    dataInscricaoInicio: draft.dataInscricaoInicio,
    dataInscricaoFim: draft.dataInscricaoFim,
    dataProva: draft.dataProva,
    valorInscricao: draft.valorInscricao,
    totalQuestoes: draft.totalQuestoes,
    etapas: previewStages,
    requisitos: (draft.requisitosText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    requirements: (draft.requisitosText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    requisitosDetalhados: previewScopedRequirements,
    requirementsDetailed: previewScopedRequirements,
    remuneracoes: (draft.remuneracaoText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    remunerations: (draft.remuneracaoText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    remuneracoesDetalhadas: previewScopedRemunerations,
    remunerationsDetailed: previewScopedRemunerations,
    vagas: (draft.vagasText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    vacancies: (draft.vagasText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    vagasDetalhadas: previewScopedVacancies,
    vacanciesDetailed: previewScopedVacancies,
    conteudoProgramatico: (draft.conteudoProgramaticoText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    programmaticContent: (draft.conteudoProgramaticoText || '').split(/\n/).map((value) => value.trim()).filter(Boolean),
    conteudoProgramaticoDetalhado: previewProgrammaticContent,
    programmaticContentDetailed: previewProgrammaticContent,
    questoesVinculadas: previewQuestionIds,
    platformQuestionIds: previewQuestionIds,
  } as unknown as Prova);

  const publishState = resolveAdminPublishState(publishPreview as unknown as Record<string, unknown>);
  const publishActionLabel = publishState === 'scheduled'
    ? 'Programar prova'
    : isNew
      ? 'Publicar prova'
      : 'Atualizar prova';

  const selectedAgencyId = findSelectedTaxonomyId(agencyOptions, draft.bancaId, draft.bancaSigla, draft.bancaNome);
  const selectedAgency = agencyOptions.find((item) => String(item.id || '') === selectedAgencyId) || null;
  const selectedAgencyLabels = React.useMemo(() => {
    if (selectedAgency) {
      return [getTaxonomyLabel(selectedAgency)];
    }

    const sigla = String(draft.bancaSigla || '').trim();
    const name = String(draft.bancaNome || '').trim();
    if (sigla && name && normalizeSearchText(sigla) !== normalizeSearchText(name)) {
      return [`${sigla} - ${name}`];
    }
    return splitTaxonomyValues(sigla || name);
  }, [draft.bancaNome, draft.bancaSigla, selectedAgency]);
  const selectedOrganizationLabels = React.useMemo(
    () => splitTaxonomyValues(draft.orgaosText || draft.orgaoSigla || draft.orgaoNome),
    [draft.orgaoNome, draft.orgaoSigla, draft.orgaosText],
  );
  const selectedRoleLabels = React.useMemo(
    () => splitTaxonomyValues(draft.cargosText || draft.cargoDescricao),
    [draft.cargoDescricao, draft.cargosText],
  );
  const selectedFocusLabels = React.useMemo(
    () => splitTaxonomyValues(draft.focosText || draft.focoNome),
    [draft.focoNome, draft.focosText],
  );
  const roleFocusItems = React.useMemo(
    () => normalizeRoleFocusItems(
      draft.cargosPorFocoText,
      draft.focosText || draft.focoNome,
      draft.cargosText || draft.cargoDescricao,
    ),
    [draft.cargoDescricao, draft.cargosPorFocoText, draft.cargosText, draft.focoNome, draft.focosText],
  );
  const normalizedYearOptions = React.useMemo(
    () => Array.from(new Set((yearOptions || []).map(String).filter(Boolean))).sort((a, b) => Number(b) - Number(a)),
    [yearOptions],
  );
  const normalizedLevelOptions = React.useMemo(
    () => Array.from(new Set([
      ...(levelOptions || []),
      'Superior',
      'Médio',
      'Fundamental',
    ].map(String).map((value) => value.trim()).filter(Boolean))),
    [levelOptions],
  );
  const scopedOrganizationOptions = React.useMemo(
    () => Array.from(new Set(selectedOrganizationLabels.filter(Boolean))),
    [selectedOrganizationLabels],
  );
  const scopedRoleOptions = React.useMemo(
    () => Array.from(new Set([
      ...selectedRoleLabels,
      ...roleFocusItems.flatMap((item) => item.cargos),
    ].filter(Boolean))),
    [roleFocusItems, selectedRoleLabels],
  );
  const organizationLabels = React.useMemo(() => organizationOptions.map(getTaxonomyLabel).filter(Boolean), [organizationOptions]);
  const roleLabels = React.useMemo(() => roleOptions.map(getTaxonomyName).filter(Boolean), [roleOptions]);
  const focusLabels = React.useMemo(() => focusOptions.map(getTaxonomyName).filter(Boolean), [focusOptions]);
  const externalNoticePrompt = React.useMemo(() => `Você é o extrator editorial de editais de concursos públicos do ConcursoMestre.

Leia o edital/prova anexado e retorne UM ÚNICO JSON válido, sem markdown, sem comentários fora do JSON e sem inventar dados.

Voce deve GERAR o JSON final de metadados do Banco de Provas. Nao responda com explicacoes, plano de divisao, sugestao de partes, justificativa de limite ou orientacao para outra ferramenta. Se a interface permitir anexar/criar arquivo, gere um arquivo .json contendo o objeto completo. Se responder no chat, retorne somente o objeto JSON parseavel.

Objetivo: preencher o Banco de Provas do ConcursoMestre.

Regras:
- Extraia apenas informações comprovadas no documento.
- Datas devem vir em YYYY-MM-DD quando possível.
- Banca, órgãos e cargos devem ser os reais do edital. Não inclua frases soltas, leis, URLs, títulos de seção ou trechos que não sejam órgãos/cargos.
- Etapas devem vir da tabela/trecho oficial de etapas, com critério: eliminatorio, classificatorio ou eliminatorio_classificatorio.
- Vagas devem trazer literalmente a quantidade de vagas por órgão/cargo quando existir.
- Requisitos, remuneração e conteúdo programático devem vir estruturados para edição posterior.
- Conteúdo programático deve separar materia, topico e assunto. Se o anexo listar vários assuntos numerados, cada assunto deve virar um item separado.
- metadata.examTitle deve ser curto, comercial e parecido com os títulos da plataforma. Use o padrão "Banca - Ano - Órgão - Cargo/Prova". Exemplo: "IBFC - 2018 - PM-PB - Soldado PM". Não use o título completo do edital.
- Não gere questões. Aqui é somente metadados do Banco de Provas.

Taxonomias já existentes na plataforma para referência:
- Bancas: ${agencyOptions.map(getTaxonomyLabel).filter(Boolean).slice(0, 80).join('; ') || 'não informado'}
- Órgãos: ${organizationLabels.slice(0, 120).join('; ') || 'não informado'}
- Cargos: ${roleLabels.slice(0, 120).join('; ') || 'não informado'}
- Focos/áreas: ${focusLabels.slice(0, 80).join('; ') || 'não informado'}
- Matérias: ${subjectOptions.map(getTaxonomyName).filter(Boolean).slice(0, 120).join('; ') || 'não informado'}

Schema obrigatório:
{
  "metadata": {
    "examTitle": "",
    "banca": "",
    "bancaNome": "",
    "ano": "",
    "nivel": "",
    "tipoCaderno": "",
    "corCaderno": "",
    "orgaos": [],
    "cargos": [],
    "focos": [],
    "dataInscricaoInicio": "",
    "dataInscricaoFim": "",
    "dataProva": "",
    "valorInscricao": "",
    "totalQuestoes": ""
  },
  "etapas": [
    { "nome": "", "criterio": "eliminatorio", "data": "", "descricao": "" }
  ],
  "requisitosDetalhados": [
    { "scopeType": "cargo", "scope": "", "chave": "Escolaridade", "texto": "" }
  ],
  "remuneracoesDetalhadas": [
    { "scopeType": "cargo", "scope": "", "chave": "Remuneração", "texto": "" }
  ],
  "vagasDetalhadas": [
    { "scopeType": "cargo", "scope": "", "chave": "Vagas", "texto": "" }
  ],
  "conteudoProgramaticoDetalhado": [
    { "materia": "", "topico": "", "assunto": "", "questoes": "", "orgao": "", "cargo": "", "foco": "" }
  ],
  "evidence": []
}

Se algum campo não estiver no documento, deixe vazio ou array vazio.`, [
    agencyOptions,
    focusLabels,
    organizationLabels,
    roleLabels,
    subjectOptions,
  ]);
  const requisitoItems = React.useMemo(
    () => normalizeScopedItems(draft.requisitosDetalhadosText, draft.requisitosText),
    [draft.requisitosDetalhadosText, draft.requisitosText],
  );
  const remuneracaoItems = React.useMemo(
    () => normalizeScopedItems(draft.remuneracoesDetalhadasText, draft.remuneracaoText),
    [draft.remuneracaoText, draft.remuneracoesDetalhadasText],
  );
  const vagaItems = React.useMemo(
    () => normalizeScopedItems(draft.vagasDetalhadasText, draft.vagasText),
    [draft.vagasDetalhadasText, draft.vagasText],
  );
  const programmaticItems = React.useMemo(
    () => normalizeProgrammaticItems(draft.conteudoProgramaticoDetalhadoText, draft.conteudoProgramaticoText),
    [draft.conteudoProgramaticoDetalhadoText, draft.conteudoProgramaticoText],
  );
  const stageItems = React.useMemo(
    () => normalizeStageItems(draft.etapasText),
    [draft.etapasText],
  );

  const selectAgency = (labels: string[]) => {
    const label = labels[0] || '';
    const option = agencyOptions.find((item) => (
      normalizeSearchText(getTaxonomyLabel(item)) === normalizeSearchText(label)
      || normalizeSearchText(getTaxonomyName(item)) === normalizeSearchText(label)
      || normalizeSearchText(getTaxonomySigla(item)) === normalizeSearchText(label)
    ));
    const [possibleSigla, ...nameParts] = label.split(/\s+-\s+/);
    const parsedName = nameParts.join(' - ').trim();
    const freeSigla = parsedName && /^[A-Z0-9./-]{2,16}$/.test(possibleSigla.trim())
      ? possibleSigla.trim()
      : '';
    updateDraft({
      bancaId: option ? String(option.id || '') : '',
      bancaSigla: option ? getTaxonomySigla(option) : freeSigla,
      bancaNome: option ? getTaxonomyName(option) : (parsedName || label),
    });
  };

  const selectOrganizations = (labels: string[]) => {
    const firstLabel = labels[0] || '';
    const firstOption = organizationOptions.find((item) => (
      normalizeSearchText(getTaxonomyLabel(item)) === normalizeSearchText(firstLabel)
      || normalizeSearchText(getTaxonomyName(item)) === normalizeSearchText(firstLabel)
      || normalizeSearchText(getTaxonomySigla(item)) === normalizeSearchText(firstLabel)
    ));
    updateDraft({
      orgaoId: firstOption ? String(firstOption.id || '') : '',
      orgaoSigla: firstOption ? getTaxonomySigla(firstOption) : firstLabel,
      orgaoNome: firstOption ? getTaxonomyName(firstOption) : firstLabel,
      orgaosText: labels.join('\n'),
    });
  };

  const handleUploadExamFile = async (kind: ExamFileKind, file: File | null | undefined) => {
    if (!file || !onUploadExamFile) {
      return;
    }

    setUploadingFileKind(kind);
    setNoticeExtractionMessage('');
    try {
      const uploaded = await onUploadExamFile(file, kind);
      setLocalExamFiles((current) => ({ ...current, [kind]: file }));
      updateDraftFiles((files) => [
        ...files.filter((item) => item.kind !== kind),
        uploaded,
      ]);
    } catch {
      // O chamador mostra o feedback de erro.
    } finally {
      setUploadingFileKind(null);
    }
  };

  const removeExamFile = (kind: ExamFileKind) => {
    setLocalExamFiles((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
    updateDraftFiles((files) => files.filter((item) => item.kind !== kind));
  };

  const readNoticeFileForExtraction = async (attachedFile: ExamFileAttachment): Promise<File> => {
    const localFile = localExamFiles.edital;
    if (localFile) {
      return localFile;
    }

    const response = await fetchAuthenticatedResource(attachedFile.url);
    const blob = await response.blob();
    return new File([blob], attachedFile.name || 'edital.pdf', {
      type: attachedFile.mimeType || blob.type || 'application/pdf',
    });
  };

  const parseLinkedQuestionIds = (value: string) => String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item));

  const readSuggestionText = (
    suggestion: ExamQuestionEditorialSuggestion | undefined,
    keys: Array<keyof ExamQuestionEditorialSuggestion>,
  ) => {
    if (!suggestion) {
      return '';
    }

    for (const key of keys) {
      const value = String(suggestion[key] || '').trim();
      if (value) {
        return value;
      }
    }

    return '';
  };

  const findEditorialSuggestionForQuestion = (
    question: Question,
    suggestions: ExamQuestionEditorialSuggestion[] = [],
  ) => {
    const questionId = String(question.id || '').trim();
    const questionNumber = String(
      (question as Question & { number?: unknown; questionNumber?: unknown }).number
      || (question as Question & { questionNumber?: unknown }).questionNumber
      || question.rotulo
      || '',
    ).trim();

    return suggestions.find((suggestion) => {
      const suggestionId = String(suggestion.id || suggestion.questionId || '').trim();
      const suggestionNumber = String(suggestion.number || suggestion.questionNumber || '').trim();
      return Boolean(
        (questionId && suggestionId && questionId === suggestionId)
        || (questionNumber && suggestionNumber && questionNumber === suggestionNumber),
      );
    });
  };

  const enrichLinkedQuestionsEditorialContent = async (
    questionIds: string[],
    suggestions: ExamQuestionEditorialSuggestion[] = [],
  ) => {
    const ids = Array.from(new Set(questionIds)).slice(0, 12);
    if (ids.length === 0) {
      return { updated: 0, skipped: 0 };
    }

    const loadedQuestions = await Promise.allSettled(
      ids.map((id) => questionService.getQuestionForAdminEdit(id)),
    );
    const questions = loadedQuestions
      .filter((entry): entry is PromiseFulfilledResult<Question> => entry.status === 'fulfilled' && Boolean(entry.value?.id))
      .map((entry) => entry.value);

    if (questions.length === 0) {
      return { updated: 0, skipped: ids.length };
    }

    const updatesById = new Map<string, Partial<Question>>();
    const missingTeacher = questions.filter((question) => {
      const suggestion = findEditorialSuggestionForQuestion(question, suggestions);
      const teacherComment = readSuggestionText(suggestion, [
        'teacherComment',
        'professorComment',
        'comentarioProfessor',
      ]);
      if (teacherComment) {
        updatesById.set(String(question.id), {
          ...(updatesById.get(String(question.id)) || {}),
          teacherComment,
          hasTeacherComment: true,
        });
      }
      return !String(question.teacherComment || teacherComment || '').trim();
    });
    const missingDetailed = questions.filter((question) => {
      const suggestion = findEditorialSuggestionForQuestion(question, suggestions);
      const detailedComment = readSuggestionText(suggestion, [
        'detailedComment',
        'detailedAnalysis',
        'analiseDetalhada',
      ]);
      if (detailedComment) {
        updatesById.set(String(question.id), {
          ...(updatesById.get(String(question.id)) || {}),
          detailedComment,
          hasDetailedComment: true,
        });
      }
      return !String(question.detailedComment || detailedComment || '').trim();
    });

    try {
      const teacherComments = await aiService.generateTeacherCommentsBatch(
        missingTeacher.map((question) => ({ localId: String(question.id), question })),
      );
      Object.entries(teacherComments).forEach(([questionId, teacherComment]) => {
        if (!teacherComment.trim()) return;
        updatesById.set(questionId, {
          ...(updatesById.get(questionId) || {}),
          teacherComment,
          hasTeacherComment: true,
        });
      });
    } catch (error) {
      clientLog.warn('Error generating teacher comments for linked exam questions:', error);
    }

    try {
      const detailedComments = await aiService.generateDetailedAnalysesBatch(
        missingDetailed.map((question) => ({ localId: String(question.id), question })),
      );
      Object.entries(detailedComments).forEach(([questionId, detailedComment]) => {
        if (!detailedComment.trim()) return;
        updatesById.set(questionId, {
          ...(updatesById.get(questionId) || {}),
          detailedComment,
          hasDetailedComment: true,
        });
      });
    } catch (error) {
      clientLog.warn('Error generating detailed analyses for linked exam questions:', error);
    }

    let updated = 0;
    for (const question of questions) {
      const patch = updatesById.get(String(question.id));
      if (!patch || Object.keys(patch).length === 0) {
        continue;
      }

      const response = await questionService.updateQuestion(String(question.id), {
        ...question,
        ...patch,
      });
      if (response.success) {
        updated += 1;
      }
    }

    return { updated, skipped: Math.max(0, ids.length - questions.length) };
  };

  const applyNoticeMetadataToDraft = async (
    metadata: ExternalExamNoticeMetadata,
    message: string,
    editorialSuggestions: ExamQuestionEditorialSuggestion[] = [],
  ) => {
    const organizations = sanitizeExtractedOrganizations(metadata.organizations || []);
    const roles = (metadata.roles || []).map((item) => String(item || '').trim()).filter(Boolean);
    const focuses = (metadata.focuses || []).map((item) => String(item || '').trim()).filter(Boolean);
    const requirementsDetailed = normalizeExternalScopedItems(metadata.requirementsDetailed);
    const remunerationsDetailed = normalizeExternalScopedItems(metadata.remunerationsDetailed);
    const vacanciesDetailed = normalizeExternalScopedItems(metadata.vacanciesDetailed);
    const programmaticContentDetailed = expandProgrammaticSubjectItems((metadata.programmaticContentDetailed || [])
      .map((item) => ({
        id: newDraftRowId(),
        materia: String(item.materia || '').trim(),
        materiaId: '',
        topico: String(item.topico || '').trim(),
        topicoId: '',
        assunto: String(item.assunto || '').trim(),
        assuntoId: '',
        questoes: String(item.questoes || '').trim(),
        orgao: String(item.orgao || '').trim(),
        cargo: String(item.cargo || '').trim(),
        foco: String(item.foco || '').trim(),
      }))
      .filter((item) => item.materia || item.topico || item.assunto));
    const stages = normalizeExternalStageItems(metadata.stages)
      .map((item) => ({
        nome: String(item.nome || '').trim(),
        criterio: item.criterio || 'classificatorio',
        data: String(item.data || '').trim(),
        descricao: String(item.descricao || '').trim(),
      }));
    const summarizeScoped = (items: Array<{ chave?: string; texto?: string }>) => items
      .map((item) => [item.chave, item.texto].filter(Boolean).join(': '))
      .filter(Boolean);
    const programmaticContent = Array.from(new Set(programmaticContentDetailed
      .map((item) => [item.materia, item.topico, item.assunto].filter(Boolean).join(' > '))
      .filter(Boolean)));

    setDraft((current) => {
      const organizationsText = mergeTextList(current.orgaosText || current.orgaoSigla || current.orgaoNome, organizations);
      const rolesText = mergeTextList(current.cargosText || current.cargoDescricao, roles);
      const focusesText = mergeTextList(current.focosText || current.focoNome, focuses);
      const primaryOrganization = organizationsText.split(/\n/).find(Boolean) || '';
      const primaryRole = rolesText.split(/\n/).find(Boolean) || '';
      const primaryFocus = focusesText.split(/\n/).find(Boolean) || '';
      const displayTitle = buildExternalExamDisplayTitle(metadata, metadata.examTitle || current.nome);
      const linkedQuestionIds = Array.from(new Set([
        ...parseQuestionIdsText(current.questoesVinculadasText),
        ...(metadata.platformQuestionIds || []).map(String).filter((item) => /^\d+$/.test(item)),
      ])).join('\n');

      return {
        ...current,
        nome: displayTitle || current.nome,
        bancaId: metadata.agency ? '' : current.bancaId,
        bancaSigla: metadata.agency || current.bancaSigla,
        bancaNome: metadata.agencyName || current.bancaNome,
        ano: metadata.year || current.ano,
        nivel: metadata.level || current.nivel,
        caderno: metadata.examType || current.caderno,
        tipoCaderno: metadata.bookletType || metadata.examType || current.tipoCaderno,
        corCaderno: metadata.bookletColor || current.corCaderno,
        orgaoId: primaryOrganization !== (current.orgaoSigla || current.orgaoNome) ? '' : current.orgaoId,
        orgaoSigla: primaryOrganization || current.orgaoSigla,
        orgaoNome: primaryOrganization || current.orgaoNome,
        orgaosText: organizationsText,
        focoId: primaryFocus !== current.focoNome ? '' : current.focoId,
        focoNome: primaryFocus || current.focoNome,
        focosText: focusesText,
        cargoDescricao: primaryRole || current.cargoDescricao,
        cargosText: rolesText,
        requisitosText: mergeTextList(current.requisitosText, summarizeScoped(requirementsDetailed)),
        requisitosDetalhadosText: mergeDraftArrayText(current.requisitosDetalhadosText, requirementsDetailed),
        remuneracaoText: mergeTextList(current.remuneracaoText, summarizeScoped(remunerationsDetailed)),
        remuneracoesDetalhadasText: mergeDraftArrayText(current.remuneracoesDetalhadasText, remunerationsDetailed),
        vagasText: mergeTextList(current.vagasText, summarizeScoped(vacanciesDetailed)),
        vagasDetalhadasText: mergeDraftArrayText(current.vagasDetalhadasText, vacanciesDetailed),
        conteudoProgramaticoText: mergeTextList(current.conteudoProgramaticoText, programmaticContent),
        conteudoProgramaticoDetalhadoText: mergeDraftArrayText(current.conteudoProgramaticoDetalhadoText, programmaticContentDetailed),
        etapasText: mergeDraftArrayText(current.etapasText, stages),
        dataInscricaoInicio: current.dataInscricaoInicio || metadata.registrationStart || '',
        dataInscricaoFim: current.dataInscricaoFim || metadata.registrationEnd || '',
        dataProva: current.dataProva || metadata.examDate || '',
        valorInscricao: current.valorInscricao || metadata.registrationFee || '',
        totalQuestoes: current.totalQuestoes || metadata.totalQuestions || '',
        questoesVinculadasText: linkedQuestionIds || current.questoesVinculadasText,
      };
    });

    const linkedQuestionIds = parseLinkedQuestionIds(draft.questoesVinculadasText);
    let editorialMessage = '';
    if (linkedQuestionIds.length > 0) {
      const editorialResult = await enrichLinkedQuestionsEditorialContent(linkedQuestionIds, editorialSuggestions);
      if (editorialResult.updated > 0) {
        editorialMessage = ` ${editorialResult.updated} questao(oes) vinculada(s) receberam comentario do professor e/ou analise detalhada.`;
      }
    }
    setNoticeExtractionMessage(`${message}${editorialMessage}`);
  };

  const handleCopyExternalNoticePrompt = async () => {
    try {
      await navigator.clipboard.writeText(externalNoticePrompt);
      setExternalNoticePromptCopied(true);
      window.setTimeout(() => setExternalNoticePromptCopied(false), 1800);
    } catch {
      setNoticeExtractionMessage('Não foi possível copiar o prompt automaticamente. Selecione o texto e copie manualmente.');
    }
  };

  const handleApplyExternalNoticeJson = async () => {
    if (!externalNoticeJsonText.trim()) {
      setNoticeExtractionMessage('Cole o JSON retornado pela IA antes de aplicar os metadados.');
      return;
    }

    setApplyingExternalNoticeJson(true);
    setNoticeExtractionMessage('');
    try {
      const parsed = JSON.parse(extractJsonObjectText(externalNoticeJsonText));
      const metadata = normalizeExternalExamNoticeJson(parsed);
      await applyNoticeMetadataToDraft(metadata, 'JSON da IA aplicado ao Banco de Provas. Revise os campos antes de publicar.');
      void examService.startExtraction({
        exam_id: draft.id && /^\d+$/.test(String(draft.id)) ? Number(draft.id) : undefined,
        origem: 'edital',
        parserProfile: 'external-ai-json-edital',
        draft: metadata,
      }).catch((error) => {
        clientLog.warn('Error recording external exam notice JSON extraction:', error);
      });
    } catch (error) {
      clientLog.warn('Error applying external exam notice JSON:', error);
      setNoticeExtractionMessage('Não foi possível ler o JSON colado. Verifique se a resposta contém um objeto JSON válido.');
    } finally {
      setApplyingExternalNoticeJson(false);
    }
  };

  const handleExtractNoticeMetadata = async (attachedFile?: ExamFileAttachment) => {
    if (!attachedFile) {
      setNoticeExtractionMessage('Anexe o edital antes de extrair os dados do concurso.');
      return;
    }

    setExtractingNotice(true);
    setNoticeExtractionMessage('');
    try {
      const file = await readNoticeFileForExtraction(attachedFile);
      let metadata = await extractExamNoticeMetadata(file);
      let editorialSuggestions: ExamQuestionEditorialSuggestion[] = [];
      const localOrganizations = sanitizeExtractedOrganizations(metadata.organizations);
      try {
        const pdfBase64 = await fileToBase64(file);
        const aiMetadata = await aiService.extractExamNoticeMetadataFromPdf(
          pdfBase64,
          metadata.rawText,
          {
            subjects: subjectOptions.map(getTaxonomyName).filter(Boolean),
            topics: topicOptions.map(getTaxonomyName).filter(Boolean),
            specificSubjects: specificSubjectOptions.map(getTaxonomyName).filter(Boolean),
            focuses: focusOptions.map(getTaxonomyName).filter(Boolean),
            organizations: organizationOptions.map(getTaxonomyLabel).filter(Boolean),
            roles: roleOptions.map(getTaxonomyName).filter(Boolean),
          },
        );
        editorialSuggestions = Array.isArray(aiMetadata.questionEditorialSuggestions)
          ? aiMetadata.questionEditorialSuggestions
          : [];
        const aiOrganizations = sanitizeExtractedOrganizations(aiMetadata.organizations || []);
        const normalizeScopedAiItems = (items: typeof aiMetadata.requirementsDetailed) => (items || [])
          .filter((item) => String(item.texto || '').trim())
          .map((item) => ({
            scopeType: ['orgao', 'cargo', 'foco'].includes(String(item.scopeType))
              ? item.scopeType as 'orgao' | 'cargo' | 'foco'
              : 'geral' as const,
            scope: String(item.scope || 'Todos').trim() || 'Todos',
            chave: String(item.chave || '').trim(),
            texto: String(item.texto || '').trim(),
          }));
        const requirementsDetailed = normalizeScopedAiItems(aiMetadata.requirementsDetailed);
        const remunerationsDetailed = normalizeScopedAiItems(aiMetadata.remunerationsDetailed);
        const vacanciesDetailed = normalizeScopedAiItems(aiMetadata.vacanciesDetailed);
        const programmaticContentDetailed = expandProgrammaticSubjectItems((aiMetadata.programmaticContentDetailed || [])
          .map((item) => ({
            id: newDraftRowId(),
            materia: String(item.materia || '').trim(),
            materiaId: '',
            topico: String(item.topico || '').trim(),
            topicoId: '',
            assunto: String(item.assunto || '').trim(),
            assuntoId: '',
            questoes: String(item.questoes || '').trim(),
            orgao: String(item.orgao || '').trim(),
            cargo: String(item.cargo || '').trim(),
            foco: String(item.foco || '').trim(),
          }))
          .filter((item) => item.materia || item.topico || item.assunto));
        const stages = (aiMetadata.stages || [])
          .filter((item) => String(item.nome || '').trim())
          .map((item) => ({
            nome: String(item.nome || '').trim(),
            criterio: ['eliminatorio', 'classificatorio', 'eliminatorio_classificatorio'].includes(String(item.criterio))
              ? item.criterio as 'eliminatorio' | 'classificatorio' | 'eliminatorio_classificatorio'
              : 'eliminatorio',
            data: String(item.data || '').trim(),
            descricao: String(item.descricao || '').trim(),
          }));
        const summarizeScoped = (items: Array<{ chave?: string; texto: string }>) => items
          .map((item) => [item.chave, item.texto].filter(Boolean).join(': '))
          .filter(Boolean);
        const programmaticContent = Array.from(new Set(programmaticContentDetailed
          .map((item) => [item.materia, item.topico, item.assunto].filter(Boolean).join(' > '))
          .filter(Boolean)));

        metadata = {
          ...metadata,
          agency: aiMetadata.agency || metadata.agency,
          agencyName: aiMetadata.agencyName || metadata.agencyName,
          year: aiMetadata.year || metadata.year,
          organizations: aiOrganizations.length > 0 ? aiOrganizations : localOrganizations,
          roles: aiMetadata.roles?.filter(Boolean).length ? aiMetadata.roles.filter(Boolean) : metadata.roles,
          requirements: requirementsDetailed.length ? summarizeScoped(requirementsDetailed) : metadata.requirements,
          requirementsDetailed: requirementsDetailed.length ? requirementsDetailed : metadata.requirementsDetailed,
          remunerations: remunerationsDetailed.length ? summarizeScoped(remunerationsDetailed) : metadata.remunerations,
          remunerationsDetailed: remunerationsDetailed.length ? remunerationsDetailed : metadata.remunerationsDetailed,
          vacancies: vacanciesDetailed.length ? summarizeScoped(vacanciesDetailed) : metadata.vacancies,
          vacanciesDetailed: vacanciesDetailed.length ? vacanciesDetailed : metadata.vacanciesDetailed,
          programmaticContent: programmaticContent.length ? programmaticContent : metadata.programmaticContent,
          programmaticContentDetailed: programmaticContentDetailed.length ? programmaticContentDetailed : metadata.programmaticContentDetailed,
          stages: stages.length ? stages : metadata.stages,
          registrationStart: aiMetadata.registrationStart || metadata.registrationStart,
          registrationEnd: aiMetadata.registrationEnd || metadata.registrationEnd,
          examDate: aiMetadata.examDate || metadata.examDate,
          registrationFee: aiMetadata.registrationFee || metadata.registrationFee,
          totalQuestions: aiMetadata.totalQuestions || metadata.totalQuestions,
        };
      } catch (error) {
        clientLog.warn('Error extracting exam notice with AI; using local parser:', error);
        metadata.organizations = localOrganizations;
      }

      void examService.startExtraction({
        exam_id: draft.id && /^\d+$/.test(String(draft.id)) ? Number(draft.id) : undefined,
        file_id: attachedFile.id && /^\d+$/.test(String(attachedFile.id)) ? Number(attachedFile.id) : undefined,
        origem: 'edital',
        parserProfile: 'hybrid-ai-edital',
        draft: metadata,
      }).catch((error) => {
        clientLog.warn('Error recording exam notice extraction:', error);
      });
      setDraft((current) => {
        const organizationsText = mergeTextList(current.orgaosText || current.orgaoSigla || current.orgaoNome, metadata.organizations);
        const rolesText = mergeTextList(current.cargosText || current.cargoDescricao, metadata.roles);
        const primaryOrganization = organizationsText.split(/\n/).find(Boolean) || '';
        const primaryRole = rolesText.split(/\n/).find(Boolean) || '';
        const displayTitle = buildExternalExamDisplayTitle(metadata as ExternalExamNoticeMetadata, current.nome);

        return {
          ...current,
          nome: displayTitle || current.nome,
          bancaId: metadata.agency ? '' : current.bancaId,
          bancaSigla: metadata.agency || current.bancaSigla,
          bancaNome: metadata.agencyName || current.bancaNome,
          ano: metadata.year || current.ano,
          orgaoId: primaryOrganization !== (current.orgaoSigla || current.orgaoNome) ? '' : current.orgaoId,
          orgaoSigla: primaryOrganization || current.orgaoSigla,
          orgaoNome: primaryOrganization || current.orgaoNome,
          orgaosText: organizationsText,
          cargoDescricao: primaryRole || current.cargoDescricao,
          cargosText: rolesText,
          requisitosText: mergeTextList(current.requisitosText, metadata.requirements),
          requisitosDetalhadosText: mergeDraftArrayText(current.requisitosDetalhadosText, metadata.requirementsDetailed),
          remuneracaoText: mergeTextList(current.remuneracaoText, metadata.remunerations),
          remuneracoesDetalhadasText: mergeDraftArrayText(current.remuneracoesDetalhadasText, metadata.remunerationsDetailed),
          vagasText: mergeTextList(current.vagasText, metadata.vacancies),
          vagasDetalhadasText: mergeDraftArrayText(current.vagasDetalhadasText, metadata.vacanciesDetailed),
          conteudoProgramaticoText: mergeTextList(current.conteudoProgramaticoText, metadata.programmaticContent),
          conteudoProgramaticoDetalhadoText: mergeDraftArrayText(current.conteudoProgramaticoDetalhadoText, metadata.programmaticContentDetailed),
          etapasText: mergeDraftArrayText(current.etapasText, metadata.stages),
          dataInscricaoInicio: current.dataInscricaoInicio || metadata.registrationStart || '',
          dataInscricaoFim: current.dataInscricaoFim || metadata.registrationEnd || '',
          dataProva: current.dataProva || metadata.examDate || '',
          valorInscricao: current.valorInscricao || metadata.registrationFee || '',
          totalQuestoes: current.totalQuestoes || metadata.totalQuestions || '',
        };
      });
      const linkedQuestionIds = parseLinkedQuestionIds(draft.questoesVinculadasText);
      let editorialMessage = '';
      if (linkedQuestionIds.length > 0) {
        const editorialResult = await enrichLinkedQuestionsEditorialContent(linkedQuestionIds, editorialSuggestions);
        if (editorialResult.updated > 0) {
          editorialMessage = ` ${editorialResult.updated} questao(oes) vinculada(s) receberam comentario do professor e/ou analise detalhada.`;
        }
      }
      setNoticeExtractionMessage(`Edital lido por IA e parser local. Revise os campos antes de publicar.${editorialMessage}`);
    } catch {
      setNoticeExtractionMessage('Não foi possível extrair os dados do edital.');
    } finally {
      setExtractingNotice(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <EditorPanel
            title="Dados da prova"
            description="Identificação principal, banca, órgão e cargo usados pela plataforma."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Nome</FieldLabel>
                <TextInput value={draft.nome} onChange={(value) => updateDraft({ nome: value })} placeholder="Nome da prova" />
              </div>
              <div>
                <SmartTagSelector
                  label="Ano"
                  options={normalizedYearOptions}
                  selected={draft.ano ? [draft.ano] : []}
                  onChange={(values) => updateDraft({ ano: values[0] || '' })}
                  placeholder="2025"
                  multiple={false}
                />
              </div>
              <div>
                <SmartTagSelector
                  label="Nível"
                  options={normalizedLevelOptions}
                  selected={draft.nivel ? [draft.nivel] : []}
                  onChange={(values) => updateDraft({ nivel: values[0] || '' })}
                  placeholder="Superior"
                  multiple={false}
                />
              </div>
              <div>
                <FieldLabel>Tipo/Caderno</FieldLabel>
                <TextInput value={draft.tipoCaderno} onChange={(value) => updateDraft({ tipoCaderno: value })} placeholder="Tipo B, Caderno 1" />
              </div>
              <div>
                <FieldLabel>Cor do caderno</FieldLabel>
                <TextInput value={draft.corCaderno} onChange={(value) => updateDraft({ corCaderno: value })} placeholder="Amarelo, Azul" />
              </div>
              <div>
                <FieldLabel>Inscrição - início</FieldLabel>
                <TextInput type="date" value={draft.dataInscricaoInicio} onChange={(value) => updateDraft({ dataInscricaoInicio: value })} />
              </div>
              <div>
                <FieldLabel>Inscrição - fim</FieldLabel>
                <TextInput type="date" value={draft.dataInscricaoFim} onChange={(value) => updateDraft({ dataInscricaoFim: value })} />
              </div>
              <div>
                <FieldLabel>Data da prova</FieldLabel>
                <TextInput type="date" value={draft.dataProva} onChange={(value) => updateDraft({ dataProva: value })} />
              </div>
              <div>
                <FieldLabel>Valor da inscrição</FieldLabel>
                <TextInput value={draft.valorInscricao} onChange={(value) => updateDraft({ valorInscricao: value })} placeholder="R$ 120,00" />
              </div>
              <div>
                <FieldLabel>Total de questões</FieldLabel>
                <TextInput type="number" value={draft.totalQuestoes} onChange={(value) => updateDraft({ totalQuestoes: value })} placeholder="80" />
              </div>
              <div id="exam-taxonomies" className="scroll-mt-24 rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
                <div>
                  <div>
                    <SmartTagSelector
                      label="Banca vinculada"
                      options={agencyOptions}
                      selected={selectedAgencyLabels}
                      onChange={selectAgency}
                      placeholder="Selecione ou cadastre uma banca"
                      multiple={false}
                    />
                  </div>
                  <div className="hidden">
                    <FieldLabel>Banca nome</FieldLabel>
                    <TextInput
                      value={draft.bancaNome}
                      onChange={(value) => updateDraft({ bancaId: '', bancaNome: value })}
                      placeholder="Fundação Getulio Vargas"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Use uma banca existente ou cadastre a nova banca na taxonomia global.
                  </p>
                </div>
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
                <SmartTagSelector
                  label="Órgãos vinculados"
                  options={organizationOptions}
                  selected={selectedOrganizationLabels}
                  onChange={selectOrganizations}
                  placeholder="Selecione ou cadastre um órgão"
                />
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Os órgãos existentes serão vinculados. Novos órgãos serão criados automaticamente na taxonomia global ao salvar.
                </p>
              </div>
              <div id="exam-roles" className="scroll-mt-24 md:col-span-2 xl:col-span-3">
                <RoleFocusArrayEditor
                  items={roleFocusItems}
                  focusOptions={focusOptions}
                  roleOptions={roleOptions}
                  onChange={(items) => {
                    const focusNames = Array.from(new Set(items.map((item) => item.foco.trim()).filter(Boolean)));
                    const roleNames = Array.from(new Set(items.flatMap((item) => item.cargos).map((item) => item.trim()).filter(Boolean)));
                    updateDraft({
                      cargosPorFocoText: serializeDraftArray(items),
                      focoId: '',
                      focoNome: focusNames[0] || '',
                      focosText: focusNames.join('\n'),
                      cargoDescricao: roleNames[0] || '',
                      cargosText: roleNames.join('\n'),
                    });
                  }}
                />
              </div>
              <div className="hidden md:col-span-2">
                <FieldLabel>Requisitos extraídos do edital</FieldLabel>
                <TextAreaInput
                  value={draft.requisitosText}
                  onChange={(value) => updateDraft({ requisitosText: value })}
                  placeholder="Escolaridade, CNH, idade minima, registro profissional..."
                />
              </div>
              <div className="hidden">
                <FieldLabel>Remuneração</FieldLabel>
                <TextAreaInput
                  value={draft.remuneracaoText}
                  onChange={(value) => updateDraft({ remuneracaoText: value })}
                  placeholder={'R$ 3.500,00\nR$ 5.200,00'}
                />
              </div>
              <div className="hidden">
                <FieldLabel>Vagas / cadastro reserva</FieldLabel>
                <TextAreaInput
                  value={draft.vagasText}
                  onChange={(value) => updateDraft({ vagasText: value })}
                  placeholder={'Soldado PM: 900 vagas + CR\nSoldado BM: 100 vagas'}
                />
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Use uma linha por cargo quando o edital separar vagas por cargo ou órgão.
                </p>
              </div>
              <div className="hidden md:col-span-2 xl:col-span-3">
                <FieldLabel>Conteúdo programático</FieldLabel>
                <TextAreaInput
                  value={draft.conteudoProgramaticoText}
                  onChange={(value) => updateDraft({ conteudoProgramaticoText: value })}
                  placeholder="Disciplinas, tópicos e assuntos previstos no edital."
                  rows={6}
                />
              </div>
              <div className="hidden">
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <FieldLabel>Inscrição - início</FieldLabel>
                  <TextInput type="date" value={draft.dataInscricaoInicio} onChange={(value) => updateDraft({ dataInscricaoInicio: value })} />
                </div>
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <FieldLabel>Inscrição - fim</FieldLabel>
                  <TextInput type="date" value={draft.dataInscricaoFim} onChange={(value) => updateDraft({ dataInscricaoFim: value })} />
                </div>
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <FieldLabel>Data da prova</FieldLabel>
                  <TextInput type="date" value={draft.dataProva} onChange={(value) => updateDraft({ dataProva: value })} />
                </div>
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <FieldLabel>Valor da inscrição</FieldLabel>
                  <TextInput value={draft.valorInscricao} onChange={(value) => updateDraft({ valorInscricao: value })} placeholder="R$ 120,00" />
                </div>
                <div className="flex min-w-0 flex-col justify-end gap-1">
                  <FieldLabel>Total de questões</FieldLabel>
                  <TextInput type="number" value={draft.totalQuestoes} onChange={(value) => updateDraft({ totalQuestoes: value })} placeholder="80" />
                </div>
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <LinkedQuestionsEditor
                  value={draft.questoesVinculadasText}
                  onChange={(value) => updateDraft({ questoesVinculadasText: value })}
                />
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <StagesArrayEditor items={stageItems} onChange={(items) => updateDraft({ etapasText: serializeDraftArray(items) })} />
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <ScopedArrayEditor
                  title="Requisitos"
                  description="Adicione requisitos por órgão, cargo, foco ou para todos os cargos do edital."
                  items={requisitoItems}
                  organizationOptions={scopedOrganizationOptions}
                  roleOptions={scopedRoleOptions}
                  placeholder="Escolaridade, CNH, idade mínima, registro profissional..."
                  keyValue
                  keyPlaceholder="Ex.: Escolaridade"
                  valueLabel="Valor / descrição"
                  onChange={(items) => updateDraft({
                    requisitosDetalhadosText: serializeDraftArray(items),
                    requisitosText: items
                      .map((item) => {
                        const chave = item.chave.trim();
                        const texto = item.texto.trim();
                        return chave && texto ? `${chave}: ${texto}` : texto || chave;
                      })
                      .filter(Boolean)
                      .join('\n'),
                  })}
                />
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <ScopedArrayEditor
                  title="Remuneração"
                  description="Informe salários, adicionais e benefícios separados por órgão, cargo ou foco quando o edital trouxer diferenças."
                  items={remuneracaoItems}
                  organizationOptions={scopedOrganizationOptions}
                  roleOptions={scopedRoleOptions}
                  placeholder="R$ 3.500,00 + benefícios"
                  onChange={(items) => updateDraft({ remuneracoesDetalhadasText: serializeDraftArray(items), remuneracaoText: items.map((item) => item.texto).filter(Boolean).join('\n') })}
                />
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <ScopedArrayEditor
                  title="Vagas"
                  description="Cadastre vagas por órgão, cargo ou foco. Use linhas diferentes para ampla concorrência, cotas ou cadastro reserva."
                  items={vagaItems}
                  organizationOptions={scopedOrganizationOptions}
                  roleOptions={scopedRoleOptions}
                  placeholder="900 vagas + cadastro reserva"
                  onChange={(items) => updateDraft({ vagasDetalhadasText: serializeDraftArray(items), vagasText: items.map((item) => item.texto).filter(Boolean).join('\n') })}
                />
              </div>
              <div className="w-full min-w-0" style={{ gridColumn: '1 / -1' }}>
                <ProgrammaticArrayEditor
                  items={programmaticItems}
                  subjectOptions={subjectOptions}
                  topicOptions={topicOptions}
                  specificSubjectOptions={specificSubjectOptions}
                  organizationOptions={organizationLabels}
                  roleOptions={roleLabels}
                  focusOptions={focusLabels}
                  onChange={(items) => updateDraft({
                    conteudoProgramaticoDetalhadoText: serializeDraftArray(items),
                    conteudoProgramaticoText: items.map((item) => [item.materia, item.topico, item.assunto].filter(Boolean).join(' > ')).filter(Boolean).join('\n'),
                  })}
                />
              </div>
            </div>
          </EditorPanel>

          <EditorPanel
            title="Arquivos da prova"
            description="Anexe ou remova os documentos oficiais usados por esta prova."
          >
            {extractingNotice || noticeExtractionMessage ? (
              <div className="mb-4 rounded-sm border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                <span className="inline-flex items-center gap-2">
                  {extractingNotice ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                  {extractingNotice ? 'Extraindo dados do edital...' : noticeExtractionMessage}
                </span>
              </div>
            ) : null}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-900 dark:text-slate-100">
                  Importador de questões
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                  Abra o importador para extrair, revisar ou vincular questões a uma prova do Banco de Provas.
                </p>
              </div>
              <a
                href="/admin/operation/import"
                target="_blank"
                rel="noreferrer"
                className={`${ADMIN_PRIMARY_BUTTON_CLASS} min-h-10 px-4 py-2 text-sm`}
              >
                <Link2 size={16} />
                Abrir importador
              </a>
            </div>
            <div className="mb-4 rounded-sm border border-violet-200 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/20">
              <button
                type="button"
                onClick={() => setExternalNoticePromptOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-200">
                    <Sparkles size={15} />
                    Gerar metadados com IA externa
                  </span>
                  <span className="mt-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Copie o prompt, envie o edital/prova para a IA e peça para ela gerar o JSON; depois cole o retorno para preencher o Banco de Provas.
                  </span>
                </span>
                <ChevronDown size={18} className={`text-violet-600 transition-transform ${externalNoticePromptOpen ? 'rotate-180' : ''}`} />
              </button>

              {externalNoticePromptOpen ? (
                <div className="space-y-4 border-t border-violet-200 p-4 dark:border-violet-900/60">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FieldLabel>Prompt para a IA</FieldLabel>
                      <button
                        type="button"
                        onClick={() => void handleCopyExternalNoticePrompt()}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-9 px-3 py-2 text-xs`}
                      >
                        <FileText size={14} />
                        {externalNoticePromptCopied ? 'Copiado' : 'Copiar prompt'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={externalNoticePrompt}
                      rows={10}
                      className={`min-h-64 w-full resize-y ${ADMIN_FIELD_CLASS} font-mono text-xs leading-5`}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldLabel>JSON retornado pela IA</FieldLabel>
                    <textarea
                      value={externalNoticeJsonText}
                      onChange={(event) => setExternalNoticeJsonText(event.target.value)}
                      rows={8}
                      placeholder='Cole aqui o JSON com "metadata", "etapas", "requisitosDetalhados", "vagasDetalhadas" e "conteudoProgramaticoDetalhado"...'
                      className={`min-h-52 w-full resize-y ${ADMIN_FIELD_CLASS} font-mono text-xs leading-5`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      A aplicação não publica a prova. Ela apenas preenche os campos para revisão.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleApplyExternalNoticeJson()}
                      disabled={applyingExternalNoticeJson || !externalNoticeJsonText.trim()}
                      className={`${ADMIN_PRIMARY_BUTTON_CLASS} min-h-10 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {applyingExternalNoticeJson ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      Aplicar JSON
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {EXAM_FILE_CONFIG.map((config) => {
                const attachedFile = (draft.files || []).find((file) => file.kind === config.kind);
                const isUploading = uploadingFileKind === config.kind;
                const inputId = `exam-file-${config.kind}`;

                return (
                  <div
                    key={config.kind}
                    className="flex min-h-44 flex-col justify-between rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{config.label}</p>
                          <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{config.description}</p>
                        </div>
                        <FileCheck2 size={18} className={attachedFile ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-700'} />
                      </div>

                      {attachedFile ? (
                        <div className="rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{attachedFile.name}</p>
                          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {[attachedFile.mimeType || 'arquivo', formatFileSize(attachedFile.size)].filter(Boolean).join(' - ')}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-sm border border-dashed border-slate-300 bg-white p-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                          Nenhum arquivo anexado.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        id={inputId}
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={!onUploadExamFile || isUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = '';
                          void handleUploadExamFile(config.kind, file);
                        }}
                      />
                      <label
                        htmlFor={inputId}
                        className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300 ${(!onUploadExamFile || isUploading) ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                        {attachedFile ? 'Substituir' : 'Adicionar'}
                      </label>
                      {config.kind === 'edital' ? (
                        <button
                          type="button"
                          onClick={() => void handleExtractNoticeMetadata(attachedFile)}
                          disabled={isUploading || extractingNotice || !attachedFile}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950"
                        >
                          {extractingNotice ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          Extrair concurso
                        </button>
                      ) : null}
                      {attachedFile ? (
                        <>
                          <a
                            href={attachedFile.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`${ADMIN_SECONDARY_BUTTON_CLASS} min-h-9 px-3 py-2 text-xs`}
                          >
                            <Download size={14} />
                            Abrir
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExamFile(config.kind)}
                            disabled={isUploading}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-sm border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={14} />
                            Remover
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </EditorPanel>
        </main>

        <aside className="w-full space-y-5 xl:sticky xl:top-6 xl:w-[320px]">
          <MetaBox title="Publicar">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</span>
                <AdminPublishStateBadge state={publishState} />
              </div>

              <div>
                <FieldLabel>Estado editorial</FieldLabel>
                <SelectInput value={draft.publishStatus} onChange={(value) => updateDraft({ publishStatus: value as ExamDraftState['publishStatus'] })}>
                  <option value="published">Publicado</option>
                  <option value="draft">Rascunho</option>
                  <option value="scheduled">Programado</option>
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Visibilidade</FieldLabel>
                <SelectInput value={draft.visibilityStatus} onChange={(value) => updateDraft({ visibilityStatus: value as ExamDraftState['visibilityStatus'] })}>
                  <option value="public">Publico</option>
                  <option value="elite">Elite</option>
                  <option value="internal">Interno</option>
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Publicar em</FieldLabel>
                <TextInput type="datetime-local" value={draft.scheduledAt} onChange={(value) => updateDraft({ scheduledAt: value })} />
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Questões vinculadas</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
                    <Link2 size={13} />
                    {linkedQuestionsCount}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-slate-500 dark:text-slate-400">Agendamento</span>
                  <span className="inline-flex items-center gap-1 text-right font-semibold text-slate-900 dark:text-slate-100">
                    <CalendarClock size={13} />
                    {draft.scheduledAt ? 'Definido' : 'Imediato'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handlePersistWithPatch({ publishStatus: 'draft' })}
                  disabled={isSaving || isDeleting}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving || isDeleting}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  {isSaving ? 'Salvando...' : publishActionLabel}
                </button>
              </div>
            </div>
          </MetaBox>

          <MetaBox title="Resumo">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 text-slate-400 dark:text-slate-500" size={15} />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{draft.nome || 'Sem titulo'}</p>
                  <p className="text-slate-500 dark:text-slate-400">#{draft.id || 'novo'} {draft.ano ? `- ${draft.ano}` : ''}</p>
                </div>
              </div>
              <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                Banca: {draft.bancaSigla || draft.bancaNome || '-'}<br />
                Órgão: {draft.orgaoSigla || draft.orgaoNome || '-'}<br />
                Cargo: {draft.cargoDescricao || '-'}<br />
                Caderno: {draft.caderno || [draft.tipoCaderno, draft.corCaderno].filter(Boolean).join(' - ') || '-'}<br />
                Arquivos: {(draft.files || []).length}/3
              </div>
            </div>
          </MetaBox>

          {!isNew && onDelete ? (
            <MetaBox title="Excluir">
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving || isDeleting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                {isDeleting ? 'Excluindo...' : 'Excluir prova'}
              </button>
            </MetaBox>
          ) : null}
        </aside>
    </div>
  );
};

export default AdminExamEditorPage;

