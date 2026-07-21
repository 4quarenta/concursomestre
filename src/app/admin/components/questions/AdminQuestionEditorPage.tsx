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
import { flushSync } from 'react-dom';
import { AlertCircle, AlertTriangle, Check, Image as ImageIcon, Loader2, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import type { GrupoQuestao, Prova, Question } from '@types';
import { resolveApiResourceUrl } from '@services/api';
import { adminService, type AdminQuestionGroupItem } from '@services/admin/adminService';
import MathRichText from '@/components/shared/math/MathRichText';
import { SmartTagSelector } from '../database/SmartTagSelector';
import { slugify } from '../database/slugify';
import { buildProvaSearchText, formatProvaLabel } from '../exams/examBankUtils';
import {
  getRoleDisplayLabel,
  createQuestionImageAsset,
  getQuestionAssetMarkerIds,
  isQuestionTaxonomyRecord,
  insertQuestionImageMarker,
  readQuestionImageFileAsDataUrl,
  removeQuestionImageMarker,
  type ManualQuestionItem,
  type ManualQuestionPatch,
  type ManualQuestionSetter,
  type ManualQuestionState,
  type QuestionTaxonomyOption,
  mergeProvaSources,
} from './questionEditorShared';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminQuestionEditorPageProps {
  manualQ: ManualQuestionState;
  setManualQ: ManualQuestionSetter;
  editingQuestion: Question | null;
  editingExtractedIndex: number | null;
  existingAgencies: string[];
  existingOrgaos: string[];
  existingSubjects: QuestionTaxonomyOption[];
  existingTopics: QuestionTaxonomyOption[];
  existingSubjectTopics?: QuestionTaxonomyOption[];
  existingSpecificSubjects?: QuestionTaxonomyOption[];
  existingYears: Array<string | number>;
  existingFocuses: QuestionTaxonomyOption[];
  existingRoles: QuestionTaxonomyOption[];
  existingProvas: Prova[];
  isGeneratingTeacher: boolean;
  isGeneratingDetailed: boolean;
  onGenerateTeacherComment: () => void;
  onGenerateDetailedComment: () => void;
  onClose: () => void;
  onSave: () => void;
  reportContext?: React.ReactNode;
}

type KnowledgeTaxonomyLevel = 'materia' | 'topico' | 'assunto';
type QuestionGroupSelection = Partial<AdminQuestionGroupItem> & Partial<GrupoQuestao> & { id: number | string };

const normalizeTaxonomyKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getTaxonomyLabel = (value: QuestionTaxonomyOption) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object') {
    return String(
      value.name
      ?? value.nome
      ?? value.descricao
      ?? value['descri\u00e7\u00e3o']
      ?? value.sigla
      ?? value.label
      ?? '',
    ).trim();
  }

  return '';
};

const getTaxonomyId = (value: QuestionTaxonomyOption) => {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const id = value.id ?? value.value ?? value.filterId ?? value.filter_id;
  return id === null || id === undefined || id === '' ? '' : String(id);
};

const getTaxonomyParentValues = (value: QuestionTaxonomyOption) => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const directValues = [
    value.parentId,
    value.parent_id,
    value.pai,
    value.assunto_raiz,
    value.rootSubjectId,
    value.root_subject_id,
    value.subjectId,
    value.subject_id,
    value.materiaId,
    value.materia_id,
    value.topicId,
    value.topic_id,
    value.parentName,
    value.parent_name,
  ];
  const parent = value.parent || value.paiItem || value.rootSubject;

  if (parent && typeof parent === 'object') {
    directValues.push(parent.id, parent.name, parent.nome, parent.slug);
  }

  return directValues
    .filter((item) => item !== null && item !== undefined && String(item).trim() !== '')
    .map(String);
};

const mergeTaxonomyOptionSources = (...sources: QuestionTaxonomyOption[][]) => {
  const optionMap = new Map<string, QuestionTaxonomyOption>();

  sources.flat().forEach((item) => {
    const label = getTaxonomyLabel(item);
    if (!label) {
      return;
    }

    const parentKey = getTaxonomyParentValues(item).map(normalizeTaxonomyKey).sort().join('|');
    const key = `${normalizeTaxonomyKey(label)}::${parentKey}`;
    const current = optionMap.get(key);
    if (!current || (typeof current !== 'object' && item && typeof item === 'object')) {
      optionMap.set(key, item);
    }
  });

  return Array.from(optionMap.values());
};

const findTaxonomyOptionByLabel = (options: QuestionTaxonomyOption[], label: string) => {
  const normalizedLabel = normalizeTaxonomyKey(label);
  return options.find((option) => normalizeTaxonomyKey(getTaxonomyLabel(option)) === normalizedLabel) || null;
};

const resolveSelectedTaxonomyOption = (
  selected: QuestionTaxonomyOption[],
  options: QuestionTaxonomyOption[],
) => {
  const selectedItem = selected?.[0];
  const selectedLabel = getTaxonomyLabel(selectedItem);

  if (!selectedLabel) {
    return null;
  }

  return findTaxonomyOptionByLabel(options, selectedLabel) || selectedItem;
};

const taxonomyOptionBelongsToParent = (
  option: QuestionTaxonomyOption,
  parent: QuestionTaxonomyOption | null,
) => {
  if (!parent) {
    return false;
  }

  const parentValues = [getTaxonomyId(parent), getTaxonomyLabel(parent)]
    .filter(Boolean)
    .map(normalizeTaxonomyKey);
  const optionParentValues = getTaxonomyParentValues(option).map(normalizeTaxonomyKey);

  if (optionParentValues.length === 0) {
    return true;
  }

  return optionParentValues.some((value) => parentValues.includes(value));
};

const buildQuestionTaxonomySelection = (
  label: string,
  options: QuestionTaxonomyOption[],
  taxonomyLevel: KnowledgeTaxonomyLevel,
  parent?: QuestionTaxonomyOption | null,
  rootSubject?: QuestionTaxonomyOption | null,
) => {
  const existing = findTaxonomyOptionByLabel(options, label);
  if (existing && typeof existing === 'object') {
    return existing;
  }

  const parentId = getTaxonomyId(parent);
  const parentLabel = getTaxonomyLabel(parent);
  const rootSubjectId = getTaxonomyId(rootSubject || parent);
  const rootSubjectLabel = getTaxonomyLabel(rootSubject || parent);

  return {
    id: null,
    name: label,
    nome: label,
    slug: slugify(label),
    materia: taxonomyLevel === 'materia',
    taxonomyLevel,
    taxonomy_level: taxonomyLevel,
    parentId: parentId || null,
    parent_id: parentId || null,
    parentName: parentLabel || undefined,
    parent_name: parentLabel || undefined,
    rootSubjectId: rootSubjectId || undefined,
    root_subject_id: rootSubjectId || undefined,
    rootSubjectName: rootSubjectLabel || undefined,
    root_subject_name: rootSubjectLabel || undefined,
  };
};

const normalizeDateTimeLocalValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    const timestamp = value > 9999999999 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const mysqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (mysqlDateTime) return `${mysqlDateTime[1]}T${mysqlDateTime[2]}`;

  const mysqlDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (mysqlDate) return `${mysqlDate[1]}T00:00`;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

const formatPublicationDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
};

const normalizeQuestionOrigin = (value: unknown, hasProva = false) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['exam', 'concurso', 'prova', 'retirada_de_prova'].includes(normalized)) {
    return 'exam';
  }

  if (['platform', 'inedita', 'inédita', 'generated', 'gerada'].includes(normalized)) {
    return 'platform';
  }

  return hasProva ? 'exam' : 'platform';
};

const getQuestionGroupId = (group: Partial<AdminQuestionGroupItem> | null | undefined) => {
  const id = group?.id;
  return id === null || id === undefined ? '' : String(id);
};

const getQuestionGroupTitle = (group: Partial<AdminQuestionGroupItem> | null | undefined) => {
  const raw = String(
    group?.enunciado_clean
    ?? group?.enunciadoClean
    ?? group?.texto
    ?? group?.enunciado
    ?? '',
  ).replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

  return raw || (getQuestionGroupId(group) ? `Contexto #${getQuestionGroupId(group)}` : '');
};

const stripOptionImages = (html: string): string => (
  String(html || '').replace(/<img\b[^>]*>/gi, '').trim()
);

const extractOptionImageSources = (html: string): string[] => {
  const sources: string[] = [];
  String(html || '').replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (_match, src: string) => {
    sources.push(src);
    return '';
  });
  return sources;
};

const normalizeQuestionGroupSelection = (
  group: Partial<AdminQuestionGroupItem> | Partial<GrupoQuestao> | null | undefined,
): QuestionGroupSelection | null => {
  const id = group?.id;
  if (id === null || id === undefined || String(id).trim() === '') {
    return null;
  }

  return { ...group, id };
};

const buildRoleSelection = (
  label: string,
  options: QuestionTaxonomyOption[],
  selectedFocus: QuestionTaxonomyOption | null,
) => {
  const existing = findTaxonomyOptionByLabel(options, label);
  if (existing && typeof existing === 'object') {
    return existing;
  }

  const focusId = getTaxonomyId(selectedFocus);
  const focusLabel = getTaxonomyLabel(selectedFocus);

  return {
    id: null,
    name: label,
    nome: label,
    descricao: label,
    ['descri\u00e7\u00e3o']: label,
    slug: slugify(label),
    parentId: focusId || null,
    parent_id: focusId || null,
    parentName: focusLabel || undefined,
    parent_name: focusLabel || undefined,
  };
};

const buildFocusSelection = (label: string, options: QuestionTaxonomyOption[]) => {
  const existing = findTaxonomyOptionByLabel(options, label);
  if (existing && typeof existing === 'object') {
    return existing;
  }

  return {
    id: null,
    name: label,
    nome: label,
    slug: slugify(label),
  };
};

const AdminQuestionEditorPage = ({
  manualQ,
  setManualQ,
  editingQuestion,
  editingExtractedIndex,
  existingAgencies,
  existingOrgaos,
  existingSubjects,
  existingTopics,
  existingSubjectTopics,
  existingSpecificSubjects,
  existingYears,
  existingFocuses,
  existingRoles,
  existingProvas,
  isGeneratingTeacher,
  isGeneratingDetailed,
  onGenerateTeacherComment,
  onGenerateDetailedComment,
  onClose,
  onSave,
  reportContext,
}: AdminQuestionEditorPageProps) => {
  const updateManualQ = (patch: ManualQuestionPatch) => {
    setManualQ((prev) => ({ ...prev, ...patch }));
  };

  const [provaSearch, setProvaSearch] = React.useState('');
  const [isProvaSearchOpen, setIsProvaSearchOpen] = React.useState(false);
  const [questionGroups, setQuestionGroups] = React.useState<AdminQuestionGroupItem[]>([]);
  const [groupSearch, setGroupSearch] = React.useState('');
  const [isGroupSearchOpen, setIsGroupSearchOpen] = React.useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = React.useState(false);
  const isMountedRef = React.useRef(true);
  const hasLoadedGroupsRef = React.useRef(false);
  const groupsRequestRef = React.useRef<Promise<void> | null>(null);
  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const MULTIPLE_CHOICE_LABEL = 'Múltipla Escolha';
  const MID_LEVEL_LABEL = 'Médio';
  const publishState = resolveAdminPublishState(manualQ as Record<string, unknown>);
  const visibilityValue = String(manualQ.visibilityStatus || 'public');
  const questionOrigin = normalizeQuestionOrigin(
    manualQ.questionOrigin || manualQ.question_origin || manualQ.sourceType || manualQ.source_type,
    Boolean(manualQ.provaId),
  );
  const publicationDateValue = normalizeDateTimeLocalValue(
    publishState === 'scheduled'
      ? manualQ.scheduledAt
      : manualQ.publishedAt || manualQ.createdAt || manualQ.scheduledAt,
  );
  const publicationDateLabel = formatPublicationDate(publicationDateValue);
  const subjectOptions = React.useMemo(
    () => mergeTaxonomyOptionSources(existingSubjects || [], manualQ.subjects || []),
    [existingSubjects, manualQ.subjects],
  );
  const rawTopicOptions = React.useMemo(
    () => mergeTaxonomyOptionSources(
      existingSubjectTopics?.length ? existingSubjectTopics : existingTopics,
      manualQ.topics || [],
    ),
    [existingSubjectTopics, existingTopics, manualQ.topics],
  );
  const rawAssuntoOptions = React.useMemo(
    () => mergeTaxonomyOptionSources(
      existingSpecificSubjects?.length ? existingSpecificSubjects : existingTopics,
      manualQ.assuntos || [],
    ),
    [existingSpecificSubjects, existingTopics, manualQ.assuntos],
  );
  const selectedSubjectOption = React.useMemo(
    () => resolveSelectedTaxonomyOption(manualQ.subjects || [], subjectOptions),
    [manualQ.subjects, subjectOptions],
  );
  const topicOptions = React.useMemo(
    () => rawTopicOptions.filter((option) => taxonomyOptionBelongsToParent(option, selectedSubjectOption)),
    [rawTopicOptions, selectedSubjectOption],
  );
  const selectedTopicOption = React.useMemo(
    () => resolveSelectedTaxonomyOption(manualQ.topics || [], rawTopicOptions),
    [manualQ.topics, rawTopicOptions],
  );
  const assuntoOptions = React.useMemo(
    () => rawAssuntoOptions.filter((option) => taxonomyOptionBelongsToParent(option, selectedTopicOption)),
    [rawAssuntoOptions, selectedTopicOption],
  );
  const focusOptions = React.useMemo(
    () => mergeTaxonomyOptionSources(existingFocuses || [], manualQ.focos || [], manualQ.focuses || [], manualQ.carreiras || []),
    [existingFocuses, manualQ.carreiras, manualQ.focos, manualQ.focuses],
  );
  const roleOptions = React.useMemo(
    () => mergeTaxonomyOptionSources(existingRoles || [], manualQ.cargos || []),
    [existingRoles, manualQ.cargos],
  );
  const selectedFocusOption = React.useMemo(
    () => resolveSelectedTaxonomyOption([
      ...(manualQ.focos || []),
      ...(manualQ.focuses || []),
      ...(manualQ.carreiras || []),
    ], focusOptions),
    [focusOptions, manualQ.carreiras, manualQ.focos, manualQ.focuses],
  );
  const filteredRoleOptions = React.useMemo(
    () => roleOptions.filter((option) => taxonomyOptionBelongsToParent(option, selectedFocusOption)),
    [roleOptions, selectedFocusOption],
  );
  const selectedGroupId = String(
    manualQ.grupoQuestaoId
    ?? manualQ.grupo_questao_id
    ?? manualQ.grupoQuestao?.id
    ?? '',
  );
  const selectedQuestionGroup = React.useMemo(() => {
    if (!selectedGroupId) {
      return null;
    }

    return questionGroups.find((group) => String(group.id) === selectedGroupId)
      || manualQ.grupoQuestao
      || null;
  }, [manualQ.grupoQuestao, questionGroups, selectedGroupId]);
  const manualItems = manualQ.itens || [];
  const manualTitle =
    editingExtractedIndex !== null
      ? `Revisar Questão Extraída #${editingExtractedIndex + 1}`
      : editingQuestion
        ? 'Editar questão'
        : 'Adicionar nova questão';

  const provaList = React.useMemo(
    () => mergeProvaSources(existingProvas || [], Array.isArray(manualQ.provas) ? manualQ.provas : []),
    [existingProvas, manualQ.provas],
  );

  const selectedProva = manualQ.provaId
    ? provaList.find((item) => String(item.id) === String(manualQ.provaId))
    : null;

  const filteredProvas = React.useMemo(() => {
    const normalizedSearch = provaSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return provaList.slice(0, 12);
    }

    return provaList
      .filter((item) => buildProvaSearchText(item).includes(normalizedSearch))
      .slice(0, 12);
  }, [provaList, provaSearch]);

  const filteredQuestionGroups = React.useMemo(() => {
    const normalizedSearch = groupSearch.trim().toLowerCase();
    const fallbackGroup = normalizeQuestionGroupSelection(manualQ.grupoQuestao);
    const source = questionGroups.length > 0 ? questionGroups : (fallbackGroup ? [fallbackGroup] : []);
    if (!normalizedSearch) {
      return source.slice(0, 12);
    }

    return source
      .filter((group) => [
        String(group?.id || ''),
        getQuestionGroupTitle(group),
        String(group?.enunciado || ''),
        String(group?.texto || ''),
        String(group?.image_url || group?.imageUrl || ''),
      ].join(' ').toLowerCase().includes(normalizedSearch))
      .slice(0, 12);
  }, [groupSearch, manualQ.grupoQuestao, questionGroups]);

  const loadQuestionGroups = React.useCallback((force = false) => {
    if (!force && hasLoadedGroupsRef.current) {
      return Promise.resolve();
    }

    if (groupsRequestRef.current) {
      return groupsRequestRef.current;
    }

    setIsLoadingGroups(true);
    const request = adminService.getQuestionGroups()
      .then((items) => {
        if (!isMountedRef.current) return;
        setQuestionGroups(items);
        hasLoadedGroupsRef.current = true;
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        setQuestionGroups([]);
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoadingGroups(false);
        }
        groupsRequestRef.current = null;
      });

    groupsRequestRef.current = request;
    return request;
  }, []);

  React.useEffect(() => {
    if (!isGroupSearchOpen && !selectedGroupId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void loadQuestionGroups();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isGroupSearchOpen, loadQuestionGroups, selectedGroupId]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (selectedProva) {
        setProvaSearch(formatProvaLabel(selectedProva));
        return;
      }

      if (!manualQ.provaId) {
        setProvaSearch('');
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [manualQ.provaId, selectedProva]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (selectedQuestionGroup) {
        setGroupSearch(getQuestionGroupTitle(selectedQuestionGroup));
        return;
      }

      if (!selectedGroupId) {
        setGroupSearch('');
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedGroupId, selectedQuestionGroup]);

  const handleTypeChange = (newType: string) => {
    setManualQ((prev) => {
      const currentItems = prev.itens || [];
      const newItens =
        newType === 'Certo/Errado'
          ? [
              { id: 1, rotulo: 'C', corpo: 'Certo', corpo_clean: 'Certo' },
              { id: 2, rotulo: 'E', corpo: 'Errado', corpo_clean: 'Errado' },
            ]
          : currentItems.length === 2 && currentItems[0]?.corpo === 'Certo'
            ? [
                { id: 1, rotulo: 'A', corpo: '', corpo_clean: '' },
                { id: 2, rotulo: 'B', corpo: '', corpo_clean: '' },
                { id: 3, rotulo: 'C', corpo: '', corpo_clean: '' },
                { id: 4, rotulo: 'D', corpo: '', corpo_clean: '' },
                { id: 5, rotulo: 'E', corpo: '', corpo_clean: '' },
              ]
            : currentItems;

      return {
        ...prev,
        modality: newType,
        itens: newItens,
        tipo: newType === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      };
    });
  };

  const handleImageSelected = async (file: File | null, usage: 'statement' | 'support' = 'statement') => {
    if (!file) return;

    let url = '';
    try {
      url = await readQuestionImageFileAsDataUrl(file);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel carregar a imagem.');
      return;
    }
    setManualQ((prev) => {
      const asset = createQuestionImageAsset({
        assets: prev.assets,
        usage,
        url,
        alt: usage === 'support' ? 'Imagem do texto de apoio.' : 'Imagem do enunciado.',
      });

      return {
        ...prev,
        assets: [...(prev.assets || []), asset],
        imageUrl: usage === 'statement' && !prev.imageUrl ? url : prev.imageUrl,
        enunciado: usage === 'statement' ? insertQuestionImageMarker(prev.enunciado || '', asset.id) : prev.enunciado,
        enunciado_clean: usage === 'statement'
          ? insertQuestionImageMarker(prev.enunciado_clean || '', asset.id)
          : prev.enunciado_clean,
        introText: usage === 'support' ? insertQuestionImageMarker(prev.introText || '', asset.id) : prev.introText,
      };
    });
  };

  const handleAddOption = () => {
    setManualQ((prev) => ({
      ...prev,
      itens: [
        ...(prev.itens || []),
        {
          id: Date.now(),
          rotulo: String.fromCharCode(65 + (prev.itens?.length || 0)),
          corpo: '',
          corpo_clean: '',
        },
      ],
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setManualQ((prev) => {
      const nextItems = [...(prev.itens || [])];
      nextItems[index] = {
        ...nextItems[index],
        corpo: value,
        corpo_clean: value.replace(/<[^>]*>?/gm, ''),
      };

      return { ...prev, itens: nextItems };
    });
  };

  const handleOptionImageSelected = async (index: number, file: File | null) => {
    if (!file) return;

    let url = '';
    try {
      url = await readQuestionImageFileAsDataUrl(file);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel carregar a imagem.');
      return;
    }

    setManualQ((prev) => {
      const nextItems = [...(prev.itens || [])];
      const current = nextItems[index];
      if (!current) {
        return prev;
      }

      const asset = createQuestionImageAsset({
        assets: prev.assets,
        usage: 'alternative',
        url,
        label: current.rotulo,
        alt: `Imagem da alternativa ${current.rotulo}.`,
      });
      const textWithoutImages = stripOptionImages(current.corpo);
      const nextBody = insertQuestionImageMarker(textWithoutImages, asset.id);
      nextItems[index] = {
        ...current,
        corpo: nextBody,
        corpo_clean: textWithoutImages.replace(/<[^>]*>?/gm, ''),
      };

      return { ...prev, assets: [...(prev.assets || []), asset], itens: nextItems };
    });
  };

  const handleOptionImageRemove = (index: number) => {
    setManualQ((prev) => {
      const nextItems = [...(prev.itens || [])];
      const current = nextItems[index];
      if (!current) {
        return prev;
      }

      const markerIds = getQuestionAssetMarkerIds(current.corpo || '');
      const nextBody = markerIds.reduce(
        (body, assetId) => removeQuestionImageMarker(body, assetId),
        stripOptionImages(current.corpo),
      );
      nextItems[index] = {
        ...current,
        corpo: nextBody,
        corpo_clean: nextBody.replace(/<[^>]*>?/gm, ''),
      };

      return {
        ...prev,
        assets: (prev.assets || []).filter((asset) => !markerIds.includes(asset.id)),
        itens: nextItems,
      };
    });
  };

  const handleOptionDelete = (index: number) => {
    setManualQ((prev) => ({
      ...prev,
      itens: (prev.itens || []).filter((_item: ManualQuestionItem, itemIndex: number) => itemIndex !== index),
    }));
  };

  const handleSelectProva = (prova: Prova) => {
    updateManualQ({
      questionOrigin: 'exam',
      question_origin: 'exam',
      provaId: prova.id,
      provas: [prova],
    });
    setProvaSearch(formatProvaLabel(prova));
    setIsProvaSearchOpen(false);
  };

  const handleClearProva = () => {
    updateManualQ({
      questionOrigin: 'platform',
      question_origin: 'platform',
      provaId: '',
      provas: [],
    });
    setProvaSearch('');
    setIsProvaSearchOpen(false);
  };

  const handleQuestionOriginChange = (value: 'platform' | 'exam') => {
    updateManualQ(value === 'platform'
      ? {
          questionOrigin: value,
          question_origin: value,
          provaId: '',
          provas: [],
        }
      : {
          questionOrigin: value,
          question_origin: value,
        });
  };

  const handleSelectQuestionGroup = (group: QuestionGroupSelection) => {
    updateManualQ({
      grupoQuestao: group,
      grupoQuestaoId: group.id,
      grupo_questao_id: group.id,
    });
    setGroupSearch(getQuestionGroupTitle(group));
    setIsGroupSearchOpen(false);
  };

  const handleClearQuestionGroup = () => {
    updateManualQ({
      grupoQuestao: null,
      grupoQuestaoId: null,
      grupo_questao_id: null,
    });
    setGroupSearch('');
    setIsGroupSearchOpen(false);
  };

  const handleSubjectChange = (values: string[]) => {
    const label = values.at(-1)?.trim() || '';
    updateManualQ({
      subjects: label ? [buildQuestionTaxonomySelection(label, subjectOptions, 'materia')] : [],
      topics: [],
      assuntos: [],
    });
  };

  const handleTopicChange = (values: string[]) => {
    const label = values.at(-1)?.trim() || '';
    updateManualQ({
      topics: label
        ? [buildQuestionTaxonomySelection(label, topicOptions, 'topico', selectedSubjectOption, selectedSubjectOption)]
        : [],
      assuntos: [],
    });
  };

  const handleAssuntoChange = (values: string[]) => {
    const label = values.at(-1)?.trim() || '';
    updateManualQ({
      assuntos: label
        ? [buildQuestionTaxonomySelection(label, assuntoOptions, 'assunto', selectedTopicOption, selectedSubjectOption)]
        : [],
    });
  };

  const handleFocusChange = (values: string[]) => {
    const label = values.at(-1)?.trim() || '';
    const focusSelection = label ? buildFocusSelection(label, focusOptions) : null;

    updateManualQ({
      focos: focusSelection ? [focusSelection] : [],
      focuses: focusSelection ? [focusSelection] : [],
      carreiras: focusSelection ? [focusSelection] : [],
      cargos: [],
    });
  };

  const handleRoleChange = (values: string[]) => {
    updateManualQ({
      cargos: values
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => buildRoleSelection(label, filteredRoleOptions, selectedFocusOption)),
    });
  };

  const handlePersistWithPatch = (patch: Record<string, unknown>) => {
    flushSync(() => {
      setManualQ((prev) => ({ ...prev, ...patch }));
    });
    onSave();
  };

  const publishActionLabel = publishState === 'scheduled'
    ? 'Programar questão'
    : editingQuestion
      ? 'Atualizar questão'
      : 'Publicar questão';
  const questionAssets = manualQ.assets || [];
  const getAssetImageUrl = (assetId: string) => {
    const asset = questionAssets.find((item) => item.id === assetId);
    return String(asset?.url || asset?.base64 || '').trim();
  };

  return (
    <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{manualTitle}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Estruture o conteúdo, contexto editorial e sinais de publicação da questão.
                </p>
              </div>

              <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                Voltar
              </button>
            </div>
          </div>

          {reportContext ? (
            <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
              <div className="p-5">{reportContext}</div>
            </div>
          ) : null}

          {(manualQ.anulada || manualQ.desatualizada) ? (
            <div className="space-y-2">
              {manualQ.anulada ? (
                <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle size={18} />
                  Esta questão será exibida como anulada.
                </div>
              ) : null}
              {manualQ.desatualizada ? (
                <div className="flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle size={18} />
                  Esta questão será exibida como desatualizada.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Classificação e contexto</p>
            </div>
            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
              <SmartTagSelector
                label="Banca(s)"
                options={existingAgencies}
                selected={(manualQ.bancas || [])
                  .map((item) => (isQuestionTaxonomyRecord(item) ? String(item.sigla ?? item.name ?? item.nome ?? '') : String(item ?? '').trim()))
                  .filter(Boolean)}
                onChange={(value) => updateManualQ({ bancas: value })}
                placeholder="Ex: Cebraspe, FGV..."
              />
              <SmartTagSelector
                label="Órgão(s)"
                options={existingOrgaos}
                selected={(manualQ.orgaos || []).map(getTaxonomyLabel).filter(Boolean)}
                onChange={(value) => updateManualQ({ orgaos: value })}
                placeholder="Ex: TJ-SP, PF..."
              />
              <SmartTagSelector
                label="Materia"
                options={subjectOptions}
                selected={(manualQ.subjects || []).slice(0, 1).map(getTaxonomyLabel).filter(Boolean)}
                onChange={handleSubjectChange}
                placeholder="Ex: Direito Administrativo..."
                multiple={false}
              />
              <SmartTagSelector
                label="Topico"
                options={topicOptions}
                selected={(manualQ.topics || []).slice(0, 1).map(getTaxonomyLabel).filter(Boolean)}
                onChange={handleTopicChange}
                placeholder={selectedSubjectOption ? 'Ex: Leis especiais...' : 'Selecione a materia primeiro'}
                multiple={false}
                disabled={!selectedSubjectOption}
              />
              <SmartTagSelector
                label="Assunto"
                options={assuntoOptions}
                selected={(manualQ.assuntos || []).slice(0, 1).map(getTaxonomyLabel).filter(Boolean)}
                onChange={handleAssuntoChange}
                placeholder={selectedTopicOption ? 'Ex: Lei Maria da Penha...' : 'Selecione o topico primeiro'}
                multiple={false}
                disabled={!selectedTopicOption}
              />
              <SmartTagSelector
                label="Ano"
                options={existingYears}
                selected={(manualQ.anos || []).map(String)}
                onChange={(value) => updateManualQ({ anos: value })}
                placeholder="2025"
                multiple
              />
              <SmartTagSelector
                label="Foco"
                options={focusOptions}
                selected={[
                  ...(manualQ.focos || []),
                  ...(manualQ.focuses || []),
                  ...(manualQ.carreiras || []),
                ].slice(0, 1).map(getTaxonomyLabel).filter(Boolean)}
                onChange={handleFocusChange}
                placeholder="Ex: Tribunais, Policial..."
                multiple={false}
              />
              <SmartTagSelector
                label="Cargo(s)"
                options={filteredRoleOptions}
                selected={(manualQ.cargos || []).map(getRoleDisplayLabel).filter(Boolean)}
                onChange={handleRoleChange}
                disabled={!selectedFocusOption}
                placeholder="Ex: Analista Judiciário..."
              />
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enunciado e alternativas</p>
            </div>
            <div className="space-y-6 p-5">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Contexto de questão vinculado</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
                    <input
                      type="search"
                      value={groupSearch}
                      onFocus={() => setIsGroupSearchOpen(true)}
                      onChange={(event) => {
                        setGroupSearch(event.target.value);
                        setIsGroupSearchOpen(true);
                      }}
                      placeholder={isLoadingGroups ? 'Carregando contextos...' : 'Pesquisar contexto de questão existente...'}
                      className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-9 pr-24`}
                    />
                    {selectedQuestionGroup ? (
                      <button
                        type="button"
                        onClick={handleClearQuestionGroup}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>

                  {isGroupSearchOpen ? (
                    <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-sm border border-slate-300 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950">
                      {filteredQuestionGroups.length > 0 ? filteredQuestionGroups.map((group) => {
                        const title = getQuestionGroupTitle(group);
                        const imageUrl = String(group.image_url || group.imageUrl || '').trim();
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => handleSelectQuestionGroup(group)}
                            className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                          >
                            <span className="mt-0.5 rounded-sm border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              #{group.id}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title || 'Contexto sem titulo'}</span>
                              <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                                {imageUrl ? `Imagem: ${imageUrl}` : String(group.texto || '').slice(0, 120)}
                              </span>
                            </span>
                          </button>
                        );
                      }) : (
                        <div className="px-3 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                          Nenhum contexto encontrado.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedQuestionGroup ? (
                  <div className="rounded-sm border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {String(selectedQuestionGroup.image_url || selectedQuestionGroup.imageUrl || '').trim() ? (
                        <Image
                          src={resolveApiResourceUrl(String(selectedQuestionGroup.image_url || selectedQuestionGroup.imageUrl))}
                          alt="Imagem do contexto da questão"
                          width={112}
                          height={80}
                          unoptimized
                          className="h-20 w-28 rounded-sm border border-slate-300 object-cover dark:border-slate-700"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contexto #{selectedQuestionGroup.id}</div>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {getQuestionGroupTitle(selectedQuestionGroup)}
                        </p>
                        {selectedQuestionGroup.texto ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{selectedQuestionGroup.texto}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Texto de apoio</label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <ImageIcon size={13} />
                    Imagem no apoio
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleImageSelected(event.target.files?.[0] || null, 'support');
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={manualQ.introText || ''}
                  onChange={(event) => updateManualQ({ introText: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[100px] font-medium`}
                  placeholder="Insira textos auxiliares aqui..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Enunciado principal (HTML)</label>
                <textarea
                  required
                  value={manualQ.enunciado || ''}
                  onChange={(event) => updateManualQ({
                    enunciado: event.target.value,
                    enunciado_clean: event.target.value.replace(/<[^>]*>?/gm, ''),
                  })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[180px] text-base font-semibold`}
                  placeholder="Qual o comando da questão? Aceita HTML."
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className={ADMIN_SECONDARY_BUTTON_CLASS}>
                  <ImageIcon size={16} />
                  Imagem no enunciado
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      handleImageSelected(event.target.files?.[0] || null, 'statement');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {questionAssets.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {questionAssets.map((asset) => (
                      <span
                        key={asset.id}
                        className="inline-flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                      >
                        <Check size={14} />
                        {asset.id}
                        <button
                          type="button"
                          onClick={() => {
                            setManualQ((prev) => ({
                              ...prev,
                              assets: (prev.assets || []).filter((item) => item.id !== asset.id),
                              imageUrl: asset.url === prev.imageUrl ? '' : prev.imageUrl,
                              enunciado: removeQuestionImageMarker(prev.enunciado || '', asset.id),
                              enunciado_clean: removeQuestionImageMarker(prev.enunciado_clean || '', asset.id),
                              introText: removeQuestionImageMarker(prev.introText || '', asset.id),
                              itens: (prev.itens || []).map((item) => {
                                const corpo = removeQuestionImageMarker(item.corpo || '', asset.id);
                                return { ...item, corpo, corpo_clean: corpo.replace(/<[^>]*>?/gm, '') };
                              }),
                            }));
                          }}
                          className="text-emerald-500 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Alternativas</label>
                  <button type="button" onClick={handleAddOption} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                    <Plus size={14} />
                    Adicionar alternativa
                  </button>
                </div>

                <div className="grid gap-3">
                  {manualItems.map((item: ManualQuestionItem, index: number) => {
                    const markerImageUrls = getQuestionAssetMarkerIds(item.corpo)
                      .map(getAssetImageUrl)
                      .filter(Boolean);
                    const optionImages = [...extractOptionImageSources(item.corpo), ...markerImageUrls];
                    const optionTextValue = stripOptionImages(item.corpo);

                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => updateManualQ({ resposta: index + 1 })}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border text-sm font-bold transition-colors ${
                            manualQ.resposta === index + 1
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white text-slate-500 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                          }`}
                        >
                          {item.rotulo}
                        </button>

                        <div className="min-w-0 flex-1 space-y-2">
                          <textarea
                            value={optionTextValue}
                            onChange={(event) => {
                              const imagesHtml = optionImages.map((src) => `<img src="${src}" alt="Imagem da alternativa ${item.rotulo}" />`).join('<br />');
                              handleOptionChange(index, [event.target.value, imagesHtml].filter(Boolean).join('<br />'));
                            }}
                            className={`${ADMIN_TEXTAREA_CLASS} min-h-[54px] font-medium`}
                            placeholder={`Corpo da alternativa ${item.rotulo}...`}
                          />

                          {optionImages.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/40">
                              {optionImages.map((src, imageIndex) => (
                                <Image
                                  key={`${src}-${imageIndex}`}
                                  src={src.startsWith('data:') ? src : resolveApiResourceUrl(src)}
                                  alt={`Imagem da alternativa ${item.rotulo}`}
                                  width={160}
                                  height={96}
                                  unoptimized
                                  className="max-h-24 w-auto rounded-sm border border-slate-200 bg-white object-contain p-1 dark:border-slate-700 dark:bg-slate-900"
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => handleOptionImageRemove(index)}
                                className="rounded-sm border border-rose-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-900/20"
                              >
                                Remover imagem
                              </button>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300">
                              <ImageIcon size={13} />
                              Imagem da alternativa
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  handleOptionImageSelected(index, event.target.files?.[0] || null);
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              A imagem será salva junto com a alternativa.
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOptionDelete(index)}
                          className="shrink-0 rounded-sm border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comentários editoriais</p>
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Comentário do professor</label>
                  <button
                    type="button"
                    onClick={onGenerateTeacherComment}
                    disabled={isGeneratingTeacher}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {isGeneratingTeacher ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.teacherComment || ''}
                  onChange={(event) => updateManualQ({ teacherComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[180px]`}
                  placeholder="Breve comentário ou dica do professor..."
                />
                {manualQ.teacherComment ? (
                  <MathRichText
                    content={manualQ.teacherComment}
                    className="rounded-sm border border-amber-200 bg-amber-50/50 p-3 text-sm leading-7 text-slate-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-slate-200"
                  />
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Análise detalhada</label>
                  <button
                    type="button"
                    onClick={onGenerateDetailedComment}
                    disabled={isGeneratingDetailed}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {isGeneratingDetailed ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.detailedComment || ''}
                  onChange={(event) => updateManualQ({ detailedComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[220px]`}
                  placeholder="Análise alternativa por alternativa..."
                />
                {manualQ.detailedComment ? (
                  <MathRichText
                    content={manualQ.detailedComment}
                    disableCallouts
                    className="rounded-sm border border-indigo-200 bg-indigo-50/40 p-3 text-sm leading-7 text-slate-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-slate-200"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-6 xl:sticky xl:top-6 xl:w-80">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Publicar</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handlePersistWithPatch({ publishStatus: 'draft' })}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  {publishActionLabel}
                </button>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Origem da questão</label>
                  <div className="grid gap-2">
                    {[
                      { value: 'platform', title: 'Inédita', detail: 'Gerada pela plataforma' },
                      { value: 'exam', title: 'De concurso', detail: 'Retirada de prova' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2.5 transition-colors ${
                          questionOrigin === option.value
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name="question-origin"
                          value={option.value}
                          checked={questionOrigin === option.value}
                          onChange={() => handleQuestionOriginChange(option.value as 'platform' | 'exam')}
                          className="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{option.title}</span>
                          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{option.detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</span>
                  <AdminPublishStateBadge state={publishState} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Estado editorial</label>
                  <select
                    value={manualQ.publishStatus || 'published'}
                    onChange={(event) => updateManualQ({ publishStatus: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Programado</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Visibilidade</label>
                  <select
                    value={visibilityValue}
                    onChange={(event) => updateManualQ({ visibilityStatus: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  >
                    <option value="public">Pública</option>
                    <option value="elite">Exclusiva Elite</option>
                    <option value="internal">Interna</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Publicação</label>
                  <input
                    type="datetime-local"
                    value={publicationDateValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateManualQ(
                        publishState === 'scheduled'
                          ? { scheduledAt: value }
                          : { publishedAt: value },
                      );
                    }}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {publicationDateLabel
                      ? `${publishState === 'scheduled' ? 'Programada para' : 'Publicada em'} ${publicationDateLabel}`
                      : editingQuestion
                        ? 'Ainda sem data de publicação registrada.'
                        : 'A data será registrada ao publicar.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => updateManualQ({ anulada: !manualQ.anulada })}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center ${manualQ.anulada ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300' : ''}`}
                >
                  {manualQ.anulada ? 'Questão anulada' : 'Marcar como anulada'}
                </button>
                <button
                  type="button"
                  onClick={() => updateManualQ({ desatualizada: !manualQ.desatualizada })}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center ${manualQ.desatualizada ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300' : ''}`}
                >
                  {manualQ.desatualizada ? 'Questão desatualizada' : 'Marcar como desatualizada'}
                </button>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Configuração rápida</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Tipo da questão</label>
                <select
                  value={manualQ.modality || (manualItems.length === 2 ? 'Certo/Errado' : MULTIPLE_CHOICE_LABEL)}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value={MULTIPLE_CHOICE_LABEL}>Múltipla escolha</option>
                  <option value="Certo/Errado">Certo/Errado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Dificuldade</label>
                <select
                  value={manualQ.difficulty}
                  onChange={(event) => updateManualQ({ difficulty: Number(event.target.value) })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value={1}>Fácil</option>
                  <option value={2}>Médio</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Escolaridade</label>
                <select
                  value={manualQ.level}
                  onChange={(event) => updateManualQ({ level: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value="Superior">Superior</option>
                  <option value={MID_LEVEL_LABEL}>Médio</option>
                  <option value="Fundamental">Fundamental</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prova vinculada</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input
                  type="text"
                  value={provaSearch}
                  onChange={(event) => {
                    setProvaSearch(event.target.value);
                    setIsProvaSearchOpen(true);
                  }}
                  onFocus={() => setIsProvaSearchOpen(true)}
                  placeholder="Busque por nome, banca, órgão ou ID"
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-10 pr-20`}
                />
                {manualQ.provaId ? (
                  <button
                    type="button"
                    onClick={handleClearProva}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Limpar
                  </button>
                ) : null}

                {isProvaSearchOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-h-72 overflow-y-auto">
                      {filteredProvas.map((prova) => (
                        <button
                          key={prova.id}
                          type="button"
                          onClick={() => handleSelectProva(prova)}
                          className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{prova.nome}</p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              #{prova.id} {prova.ano ? `- ${prova.ano}` : ''} {prova.banca?.sigla ? `- ${prova.banca.sigla}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}

                      {filteredProvas.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                          Nenhuma prova encontrada.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedProva ? (
                <div className="rounded-sm border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900/40 dark:bg-sky-900/20">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedProva.nome}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    #{selectedProva.id} {selectedProva.ano ? `- ${selectedProva.ano}` : ''} {selectedProva.banca?.sigla ? `- ${selectedProva.banca.sigla}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma prova vinculada no momento.
                </p>
              )}
            </div>
          </div>
        </aside>
    </div>
  );
};

export default AdminQuestionEditorPage;
