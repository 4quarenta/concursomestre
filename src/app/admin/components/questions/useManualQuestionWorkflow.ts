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

import { useEffect, useMemo, useState } from 'react';
import type { Question, SystemSettings } from '@types';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import { aiService } from '@services/questions';
import {
  normalizeQuestionPublishStatus,
  normalizeQuestionVisibilityStatus,
  withQuestionPublicationAliases,
} from '@services/questions/questionPublication';
import { slugify } from '../database/slugify';
import { normalizeProvaRecord } from '../exams/examBankUtils';
import {
  getQuestionOptionLabel,
  getRoleDisplayLabel,
  isQuestionTaxonomyRecord,
  type ManualQuestionState,
  type QuestionTaxonomyOption,
  type QuestionTaxonomyRecord,
} from './questionEditorShared';

type ToastHandler = (message: string, type?: string) => void;
type GenericRecord = Record<string, unknown>;

interface NewTaxonomyNotice {
  type?: string;
  name?: string;
}

interface SaveQuestionResponse extends GenericRecord {
  newTaxonomies?: NewTaxonomyNotice[];
  new_taxonomies?: NewTaxonomyNotice[];
}

interface UseManualQuestionWorkflowOptions {
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<unknown> | unknown;
  onUpdateQuestion: (question: Question) => Promise<unknown> | unknown;
  onRefreshQuestions: () => Promise<void> | void;
  replaceExtractedQuestion: (index: number, question: Question) => void;
}

const toRecord = (value: unknown): GenericRecord => (value && typeof value === 'object' ? value as GenericRecord : {});

const getRecordValue = (record: GenericRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const getEntityLabel = (value: QuestionTaxonomyOption) => getQuestionOptionLabel(value);
const getRoleLabel = (value: QuestionTaxonomyOption) => getRoleDisplayLabel(value);

const normalizeDateTimeLocalValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    const timestamp = value > 9999999999 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  const mysqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (mysqlDateTime) {
    return `${mysqlDateTime[1]}T${mysqlDateTime[2]}`;
  }

  const mysqlDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (mysqlDate) {
    return `${mysqlDate[1]}T00:00`;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

const resolveQuestionPublicationInput = (question: Question | GenericRecord | null | undefined) => {
  const record = toRecord(question);
  const publishStatus = String(
    getRecordValue(record, 'publishStatus', 'publish_status', 'status') || '',
  ).toLowerCase();
  const scheduledValue = getRecordValue(record, 'scheduledAt', 'scheduled_at', 'publishAt', 'publish_at');

  if (publishStatus === 'scheduled' || publishStatus === 'programado') {
    return normalizeDateTimeLocalValue(scheduledValue);
  }

  return normalizeDateTimeLocalValue(
    getRecordValue(
      record,
      'publishedAt',
      'published_at',
      'published_on',
      'publicationDate',
      'publication_date',
      'data_publicacao',
      'publicado_em',
      'dataPublicacao',
      'createdAt',
      'created_at',
      'created',
      'data_criacao',
      'criado_em',
      'timestamp',
    ) || scheduledValue,
  );
};

const resolveQuestionCreatedInput = (question: Question | GenericRecord | null | undefined) => {
  const record = toRecord(question);

  return normalizeDateTimeLocalValue(
    getRecordValue(
      record,
      'createdAt',
      'created_at',
      'created',
      'data_criacao',
      'criado_em',
      'timestamp',
      'publishedAt',
      'published_at',
      'data_publicacao',
    ),
  );
};

const getQuestionTaxonomyLevel = (
  item: QuestionTaxonomyOption,
  topicTaxonomies: QuestionTaxonomyRecord[] = [],
) => {
  const rawLevel = String(
    (isQuestionTaxonomyRecord(item) ? item.taxonomyLevel ?? item.taxonomy_level : '') || '',
  ).toLowerCase();
  if (rawLevel === 'topico' || rawLevel === 'assunto') {
    return rawLevel;
  }

  const itemName = getEntityLabel(item);
  const itemId = isQuestionTaxonomyRecord(item) ? item.id : null;
  const found = topicTaxonomies.find((taxonomy) => (
    String(taxonomy.id || '') === String(itemId || '')
    || (itemName && taxonomy.name === itemName)
  ));
  const foundLevel = String(found?.taxonomyLevel || found?.taxonomy_level || '').toLowerCase();
  if (foundLevel === 'topico' || foundLevel === 'assunto') {
    return foundLevel;
  }

  if (found?.parentId) {
    const parentIsTopic = topicTaxonomies.some((taxonomy) => String(taxonomy.id) === String(found.parentId));
    return parentIsTopic ? 'assunto' : 'topico';
  }

  return 'topico';
};

const uniqueLabels = (values: QuestionTaxonomyOption[]) => Array.from(new Set(values.map(getEntityLabel).filter(Boolean)));

const uniqueTaxonomyItems = (values: QuestionTaxonomyOption[]) => {
  const itemMap = new Map<string, QuestionTaxonomyOption>();

  values.forEach((value) => {
    const label = getEntityLabel(value);
    if (label && !itemMap.has(label)) {
      itemMap.set(label, value);
    }
  });

  return Array.from(itemMap.values());
};

const getTaxonomyParentId = (item: QuestionTaxonomyOption) => (
  isQuestionTaxonomyRecord(item)
    ? item.parent_id ?? item.parentId ?? item.pai ?? item.assunto_raiz ?? null
    : null
);

const getTaxonomyParentName = (item: QuestionTaxonomyOption) => (
  isQuestionTaxonomyRecord(item)
    ? String(item.parent_name ?? item.parentName ?? item.root_subject_name ?? item.rootSubjectName ?? '')
    : ''
);

const getTaxonomyLevel = (item: QuestionTaxonomyOption) => (
  isQuestionTaxonomyRecord(item)
    ? String(item.taxonomy_level ?? item.taxonomyLevel ?? '').trim()
    : ''
);

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

const normalizeEditorialComment = (value: unknown) => String(value || '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const extractOptionTexts = (manualQ: ManualQuestionState) => manualQ.itens
  .map((item) => item.corpo)
  .filter((option) => option);

const getSaveResponseTaxonomies = (response: unknown) => {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const responseRecord = response as SaveQuestionResponse;

  if (Array.isArray(responseRecord.newTaxonomies)) {
    return responseRecord.newTaxonomies;
  }

  if (Array.isArray(responseRecord.new_taxonomies)) {
    return responseRecord.new_taxonomies;
  }

  return [];
};

const asTaxonomyRecord = (value: QuestionTaxonomyOption): QuestionTaxonomyRecord | null =>
  (isQuestionTaxonomyRecord(value) ? value : null);

const createEmptyManualQuestion = (): ManualQuestionState => ({
  enunciado: '',
  enunciado_clean: '',
  introText: '',
  imageUrl: '',
  assets: [],
  publishStatus: 'published',
  visibilityStatus: 'public',
  scheduledAt: '',
  bancas: [],
  subjects: [],
  dificuldade: 2,
  difficulty: 2,
  itens: [
    { id: 1, corpo: '', corpo_clean: '', rotulo: 'A' },
    { id: 2, corpo: '', corpo_clean: '', rotulo: 'B' },
    { id: 3, corpo: '', corpo_clean: '', rotulo: 'C' },
    { id: 4, corpo: '', corpo_clean: '', rotulo: 'D' },
    { id: 5, corpo: '', corpo_clean: '', rotulo: 'E' },
  ],
  resposta: 1,
  teacherComment: '',
  detailedComment: '',
  orgaos: [],
  anos: [],
  focos: [],
  focuses: [],
  carreiras: [],
  cargos: [],
  assuntos: [],
  topics: [],
  level: 'Superior',
  tipo: 'Multipla Escolha',
  anulada: false,
  desatualizada: false,
  text: '',
  agencies: [],
  years: [],
  roles: [],
  questionOrigin: 'platform',
  question_origin: 'platform',
  grupoQuestao: null,
  grupoQuestaoId: null,
  grupo_questao_id: null,
  provaId: '',
  provas: [],
});

export const useManualQuestionWorkflow = ({
  systemSettings,
  addToast,
  onAddQuestion,
  onUpdateQuestion,
  onRefreshQuestions,
  replaceExtractedQuestion,
}: UseManualQuestionWorkflowOptions) => {
  const taxonomies = systemSettings.taxonomies;
  const agencyTaxonomies = useMemo(() => (taxonomies?.agencies ?? []) as QuestionTaxonomyRecord[], [taxonomies]);
  const organizationTaxonomies = useMemo(() => (taxonomies?.organizations ?? []) as QuestionTaxonomyRecord[], [taxonomies]);
  const roleTaxonomies = useMemo(() => (taxonomies?.roles ?? []) as QuestionTaxonomyRecord[], [taxonomies]);
  const subjectTaxonomies = useMemo(() => (taxonomies?.subjects ?? []) as QuestionTaxonomyRecord[], [taxonomies]);
  const topicTaxonomies = useMemo(() => (taxonomies?.topics ?? []) as QuestionTaxonomyRecord[], [taxonomies]);
  const careerTaxonomies = useMemo(() => (taxonomies?.careers ?? []) as QuestionTaxonomyRecord[], [taxonomies]);

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [isGeneratingDetailed, setIsGeneratingDetailed] = useState(false);
  const [isGeneratingTeacher, setIsGeneratingTeacher] = useState(false);
  const [manualQ, setManualQ] = useState<ManualQuestionState>(createEmptyManualQuestion);

  useEffect(() => {
    const selectedCargos = manualQ.cargos || [];
    const currentOrgaos = manualQ.orgaos || [];
    const newOrgaos = [...currentOrgaos];
    let changed = false;

    selectedCargos.forEach((cargoName) => {
      const normalizedCargoName = getRoleLabel(cargoName);
      const cargo = roleTaxonomies.find((role) => getRoleLabel(role) === normalizedCargoName || role.sigla === normalizedCargoName);
      if (cargo?.parentId) {
        const parentOrgao = organizationTaxonomies.find((organization) => String(organization.id) === String(cargo.parentId));
        if (parentOrgao) {
          const orgaoName = getEntityLabel(parentOrgao);
          if (!newOrgaos.includes(orgaoName)) {
            newOrgaos.push(orgaoName);
            changed = true;
          }
        }
      }
    });

    if (!changed) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      setManualQ((previous) => ({ ...previous, orgaos: newOrgaos }));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [manualQ.cargos, manualQ.orgaos, organizationTaxonomies, roleTaxonomies]);

  useEffect(() => {
    const selectedTopics = [...(manualQ.topics || []), ...(manualQ.assuntos || [])];
    const currentSubjects = manualQ.subjects || [];
    const newSubjects = [...currentSubjects];
    let changed = false;

    selectedTopics.forEach((topicName) => {
      const topicLabel = getEntityLabel(topicName);
      const topic = topicTaxonomies.find((taxonomyTopic) => taxonomyTopic.name === topicLabel);
      if (!topic?.parentId) {
        return;
      }

      const parentSubject = subjectTaxonomies.find((subject) => (
        String(subject.id) === String(topic.parentId)
        || String(subject.id) === String(topic.rootSubjectId || '')
      ));

      if (parentSubject) {
        const subjectName = parentSubject.name || parentSubject.nome || '';
        if (subjectName && !newSubjects.includes(subjectName)) {
          newSubjects.push(subjectName);
          changed = true;
        }
        return;
      }

      const parentTopic = topicTaxonomies.find((taxonomyTopic) => String(taxonomyTopic.id) === String(topic.parentId));
      if (parentTopic?.parentId) {
        const rootSubject = subjectTaxonomies.find((subject) => String(subject.id) === String(parentTopic.parentId));
        const subjectName = rootSubject?.name || rootSubject?.nome || '';
        if (subjectName && !newSubjects.includes(subjectName)) {
          newSubjects.push(subjectName);
          changed = true;
        }
      }
    });

    if (!changed) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      setManualQ((previous) => ({ ...previous, subjects: newSubjects }));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [manualQ.assuntos, manualQ.subjects, manualQ.topics, subjectTaxonomies, topicTaxonomies]);

  useEffect(() => {
    const selectedAssuntos = manualQ.assuntos || [];
    const currentTopics = manualQ.topics || [];
    const nextTopics = [...currentTopics];
    let changed = false;

    selectedAssuntos.forEach((assuntoName) => {
      const assuntoLabel = getEntityLabel(assuntoName);
      const assunto = topicTaxonomies.find((taxonomyTopic) => taxonomyTopic.name === assuntoLabel);
      if (!assunto || getQuestionTaxonomyLevel(assunto, topicTaxonomies) !== 'assunto' || !assunto.parentId) {
        return;
      }

      const parentTopic = topicTaxonomies.find((taxonomyTopic) => String(taxonomyTopic.id) === String(assunto.parentId));
      if (parentTopic?.name && !nextTopics.includes(parentTopic.name)) {
        nextTopics.push(parentTopic.name);
        changed = true;
      }
    });

    if (!changed) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      setManualQ((previous) => ({ ...previous, topics: nextTopics }));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [manualQ.assuntos, manualQ.topics, topicTaxonomies]);

  const handleGenerateManualDetail = async () => {
    setIsGeneratingDetailed(true);
    try {
      const question = {
        ...(manualQ as unknown as Question),
        options: extractOptionTexts(manualQ),
      } as Question;
      const detail = await aiService.generateDetailedAnalysis(question);
      setManualQ((previous) => ({ ...previous, detailedComment: detail }));
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao salvar questao. Revise os campos e tente novamente.'), 'error');
    } finally {
      setIsGeneratingDetailed(false);
    }
  };

  const handleGenerateManualTeacherComment = async () => {
    setIsGeneratingTeacher(true);
    try {
      const question = {
        ...(manualQ as unknown as Question),
        options: extractOptionTexts(manualQ),
      } as Question;
      const comment = await aiService.generateTeacherComment(question);
      setManualQ((previous) => ({ ...previous, teacherComment: comment }));
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao salvar questao. Revise os campos e tente novamente.'), 'error');
    } finally {
      setIsGeneratingTeacher(false);
    }
  };

  const closeManualModal = () => {
    setShowAddManual(false);
    setEditingExtractedIndex(null);
  };

  const handleSaveManual = async () => {
    const publishStatus = normalizeQuestionPublishStatus(manualQ);
    const visibilityStatus = normalizeQuestionVisibilityStatus(manualQ);
    const scheduledAt = publishStatus === 'scheduled' ? manualQ.scheduledAt || '' : '';
    const publishedAt = publishStatus === 'published'
      ? manualQ.publishedAt || (editingQuestion ? resolveQuestionPublicationInput(editingQuestion) : new Date().toISOString())
      : manualQ.publishedAt || '';
    const questionOrigin = normalizeQuestionOrigin(
      manualQ.questionOrigin || manualQ.question_origin || manualQ.sourceType || manualQ.source_type,
      Boolean(manualQ.provaId),
    );

    const newQuestion = {
      id: editingQuestion?.id ? Number(editingQuestion.id) : null,
      enunciado: manualQ.enunciado || manualQ.text,
      enunciado_clean: manualQ.enunciado_clean || (manualQ.text ? manualQ.text.replace(/<[^>]*>?/gm, '') : ''),
      introText: manualQ.introText,
      imageUrl: manualQ.imageUrl,
      content: {
        statement: manualQ.enunciado || manualQ.text,
        supportText: manualQ.introText,
        reference: '',
      },
      assets: manualQ.assets || [],
      bancas: manualQ.bancas.map((banca) =>
        typeof banca === 'string'
          ? agencyTaxonomies.find((taxonomy) => taxonomy.sigla === banca || taxonomy.name === banca)
            || { id: null, sigla: banca, nome: banca, name: banca, slug: slugify(banca) }
          : { ...(asTaxonomyRecord(banca) || {}), name: asTaxonomyRecord(banca)?.name || asTaxonomyRecord(banca)?.nome || asTaxonomyRecord(banca)?.sigla || '' },
      ),
      orgaos: manualQ.orgaos.map((orgao) =>
        typeof orgao === 'string'
          ? organizationTaxonomies.find((taxonomy) => taxonomy.sigla === orgao || taxonomy.name === orgao)
            || { id: null, nome: orgao, sigla: orgao, name: orgao, slug: slugify(orgao) }
          : { ...(asTaxonomyRecord(orgao) || {}), name: asTaxonomyRecord(orgao)?.name || asTaxonomyRecord(orgao)?.nome || asTaxonomyRecord(orgao)?.sigla || '' },
      ),
      cargos: uniqueTaxonomyItems(manualQ.cargos || [])
        .map((cargo) => {
          const cargoName = getRoleLabel(cargo);
          const found = typeof cargo === 'string'
            ? roleTaxonomies.find((taxonomy) => getRoleLabel(taxonomy) === cargoName)
            : cargo;
          const parentId = getTaxonomyParentId(found);
          const parentName = getTaxonomyParentName(found);

          const foundRecord = asTaxonomyRecord(found);

          return foundRecord
            ? {
                ...foundRecord,
                name: foundRecord.name || foundRecord.nome || cargoName,
                nome: foundRecord.nome || foundRecord.name || cargoName,
                descricao: foundRecord.descricao || foundRecord['descrição'] || cargoName,
                ['descrição']: foundRecord['descrição'] || foundRecord.descricao || cargoName,
                slug: foundRecord.slug || slugify(cargoName),
                parentId,
                parent_id: parentId,
                parentName: parentName || undefined,
                parent_name: parentName || undefined,
              }
            : { id: null, slug: slugify(cargoName), descricao: cargoName, ['descrição']: cargoName, name: cargoName };
        })
        .filter((cargo) => getRoleLabel(cargo)),
      assuntos: [
        ...(manualQ.subjects || []).map((subject) => {
          const subjectName = getEntityLabel(subject);
          const found = typeof subject === 'string'
            ? subjectTaxonomies.find((taxonomy) => taxonomy.name === subject)
            : subject;
          const foundRecord = asTaxonomyRecord(found);
          return foundRecord
            ? { ...foundRecord, name: foundRecord.name || foundRecord.nome || subjectName, nome: foundRecord.nome || foundRecord.name || subjectName, materia: true }
            : { id: null, nome: subjectName, name: subjectName, slug: slugify(subjectName), materia: true };
        }),
        ...uniqueTaxonomyItems([...(manualQ.topics || []), ...(manualQ.assuntos || [])])
          .filter((topic) => {
            const topicName = getEntityLabel(topic);
            return !(manualQ.subjects || []).some((subject) => getEntityLabel(subject) === topicName);
          })
          .map((topic) => {
            const topicName = getEntityLabel(topic);
            const found = typeof topic === 'string'
              ? topicTaxonomies.find((taxonomy) => taxonomy.name === topicName)
              : topic;
            const parentId = getTaxonomyParentId(found);
            const parentName = getTaxonomyParentName(found);
            const taxonomyLevel = getTaxonomyLevel(found);
            const rootSubjectId = isQuestionTaxonomyRecord(found) ? found.root_subject_id ?? found.rootSubjectId ?? null : null;
            const rootSubjectName = isQuestionTaxonomyRecord(found) ? String(found.root_subject_name ?? found.rootSubjectName ?? '') : '';
            const foundRecord = asTaxonomyRecord(found);

            return foundRecord
              ? {
                  ...foundRecord,
                  name: foundRecord.name || foundRecord.nome || topicName,
                  nome: foundRecord.nome || foundRecord.name || topicName,
                  slug: foundRecord.slug || slugify(topicName),
                  materia: false,
                  parentId,
                  parent_id: parentId,
                  parentName: parentName || undefined,
                  parent_name: parentName || undefined,
                  taxonomyLevel: taxonomyLevel || undefined,
                  taxonomy_level: taxonomyLevel || undefined,
                  rootSubjectId: rootSubjectId || undefined,
                  root_subject_id: rootSubjectId || undefined,
                  rootSubjectName: rootSubjectName || undefined,
                  root_subject_name: rootSubjectName || undefined,
                }
              : { id: null, nome: topicName, name: topicName, slug: slugify(topicName), materia: false };
          }),
      ],
      anos: manualQ.anos.map((year) => (
        typeof year === 'string'
          ? { id: null, name: year, slug: year }
          : { id: null, name: String(year), slug: String(year) }
      )),
      questionOrigin,
      question_origin: questionOrigin,
      grupoQuestao: manualQ.grupoQuestao || null,
      grupoQuestaoId: manualQ.grupoQuestaoId || manualQ.grupo_questao_id || null,
      grupo_questao_id: manualQ.grupoQuestaoId || manualQ.grupo_questao_id || null,
      provaId: manualQ.provaId || null,
      provas: (manualQ.provas || []).map((prova) => normalizeProvaRecord(prova)).filter(Boolean),
      tipo: manualQ.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      dificuldade: manualQ.difficulty,
      itens: manualQ.itens.filter((item) => item.corpo.trim()),
      resposta: manualQ.resposta,
      teacherComment: normalizeEditorialComment(manualQ.teacherComment),
      detailedComment: normalizeEditorialComment(manualQ.detailedComment),
      anulada: manualQ.anulada,
      desatualizada: manualQ.desatualizada,
      publishStatus,
      visibilityStatus,
      scheduledAt,
      publishedAt,
      stats: editingQuestion?.stats || { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
      comments: editingQuestion?.comments || [],
      timestamp: editingQuestion?.timestamp || publishedAt || new Date().toISOString(),
    } as unknown as Question;
    const questionPayload = withQuestionPublicationAliases(newQuestion);

    try {
      if (editingExtractedIndex !== null) {
        replaceExtractedQuestion(editingExtractedIndex, questionPayload);
        setEditingExtractedIndex(null);
        addToast('Questao extraida revisada com sucesso!', 'success');
      } else {
        const response = editingQuestion
          ? await onUpdateQuestion(questionPayload)
          : await onAddQuestion(questionPayload);

        setEditingQuestion(null);
        await onRefreshQuestions();

        const newTaxonomies = getSaveResponseTaxonomies(response);
        if (newTaxonomies.length > 0) {
          addToast(
            `Novos itens criados: ${newTaxonomies.map((taxonomy) => `${taxonomy.type}: ${taxonomy.name}`).join(', ')}`,
            'info',
          );
        }
      }
      closeManualModal();
    } catch (error) {
      clientLog.warn('Error saving manual question:', error);
      addToast(readApiErrorMessage(error, 'Erro ao salvar questao. Revise os campos e tente novamente.'), 'error');
    }
  };

  const openManualModal = (question?: Question, extractedIndex?: number) => {
    if (question) {
      setEditingQuestion(question);
      setEditingExtractedIndex(extractedIndex !== undefined ? extractedIndex : null);

      const rawQuestion = toRecord(question);
      const questionAssuntos = (question.assuntos || []) as QuestionTaxonomyRecord[];
      const nonSubjectTaxonomies = questionAssuntos.filter((item) => !item?.materia);
      const questionTopicLabels = uniqueLabels(
        nonSubjectTaxonomies.filter((item) => getQuestionTaxonomyLevel(item, topicTaxonomies) === 'topico'),
      );
      const questionAssuntoLabels = uniqueLabels(
        nonSubjectTaxonomies.filter((item) => getQuestionTaxonomyLevel(item, topicTaxonomies) === 'assunto'),
      );
      const questionFocuses = uniqueTaxonomyItems((question.cargos || []).map((cargo) => {
        const parentId = getTaxonomyParentId(cargo);
        const parentName = getTaxonomyParentName(cargo);
        const focusById = parentId
          ? careerTaxonomies.find((taxonomy) => String(taxonomy.id) === String(parentId))
          : null;
        const focusByName = parentName
          ? careerTaxonomies.find((taxonomy) => getEntityLabel(taxonomy) === parentName)
          : null;

        return focusById || focusByName || (parentName ? { id: parentId || null, name: parentName, nome: parentName, slug: slugify(parentName) } : null);
      }).filter(Boolean) as QuestionTaxonomyOption[]);
      const optionItems = Array.isArray(rawQuestion.options)
        ? rawQuestion.options.filter((option): option is string => typeof option === 'string')
        : [];

      setManualQ({
        ...createEmptyManualQuestion(),
        ...question,
        enunciado: question.enunciado || String(rawQuestion.text || ''),
        enunciado_clean: question.enunciado_clean || (String(rawQuestion.text || '') ? String(rawQuestion.text || '').replace(/<[^>]*>?/gm, '') : ''),
        bancas: (question.bancas || []).map((item) => getEntityLabel(item)).filter(Boolean),
        orgaos: (question.orgaos || []).map((item) => getEntityLabel(item)).filter(Boolean),
        focos: questionFocuses,
        focuses: questionFocuses,
        carreiras: questionFocuses,
        cargos: question.cargos || [],
        subjects: questionAssuntos.filter((item) => item?.materia).map((item) => getEntityLabel(item)).filter(Boolean),
        topics: questionTopicLabels,
        assuntos: questionAssuntoLabels,
        anos: (question.anos || []).map((item) => (typeof item === 'number' ? String(item) : item)),
        dificuldade: question.dificuldade || Number(rawQuestion.difficulty || 2),
        difficulty: question.dificuldade || Number(rawQuestion.difficulty || 2),
        tipo: question.tipo || String(rawQuestion.modality || 'Multipla Escolha'),
        modality: question.tipo === 'certo ou errado' ? 'Certo/Errado' : 'Múltipla Escolha',
        level: String(rawQuestion.level || question.nivel || 'Superior'),
        publishStatus: normalizeQuestionPublishStatus(rawQuestion),
        visibilityStatus: normalizeQuestionVisibilityStatus(rawQuestion),
        scheduledAt: normalizeDateTimeLocalValue(getRecordValue(rawQuestion, 'scheduledAt', 'scheduled_at', 'publishAt', 'publish_at')),
        publishedAt: resolveQuestionPublicationInput(rawQuestion),
        createdAt: resolveQuestionCreatedInput(rawQuestion),
        questionOrigin: normalizeQuestionOrigin(
          getRecordValue(rawQuestion, 'questionOrigin', 'question_origin', 'sourceType', 'source_type'),
          Boolean(getRecordValue(rawQuestion, 'prova_id', 'provaId')),
        ),
        question_origin: normalizeQuestionOrigin(
          getRecordValue(rawQuestion, 'questionOrigin', 'question_origin', 'sourceType', 'source_type'),
          Boolean(getRecordValue(rawQuestion, 'prova_id', 'provaId')),
        ),
        itens: (
          question.itens?.map((item, index) => ({
            id: Number(item.id || index + 1),
            corpo: item.corpo,
            corpo_clean: item.corpo_clean || item.corpo.replace(/<[^>]*>?/gm, ''),
            rotulo: item.rotulo || String.fromCharCode(65 + index),
          }))
          || optionItems.map((option, index) => ({
            id: index + 1,
            corpo: option,
            corpo_clean: option.replace(/<[^>]*>?/gm, ''),
            rotulo: String.fromCharCode(65 + index),
          }))
        ),
        resposta: question.resposta || (typeof rawQuestion.correctOptionIndex === 'number' ? rawQuestion.correctOptionIndex + 1 : 1),
        anulada: question.anulada || Boolean(rawQuestion.isCanceled) || false,
        desatualizada: question.desatualizada || Boolean(rawQuestion.isOutdated) || false,
        detailedComment: question.detailedComment || '',
        teacherComment: question.teacherComment || '',
        assets: Array.isArray(question.assets) ? question.assets : [],
        imageUrl: String(getRecordValue(rawQuestion, 'imageUrl', 'image_url') || question.imageUrl || ''),
        grupoQuestao: (getRecordValue(rawQuestion, 'grupoQuestao') as ManualQuestionState['grupoQuestao']) || null,
        grupoQuestaoId: (getRecordValue(rawQuestion, 'grupoQuestaoId', 'grupo_questao_id') as ManualQuestionState['grupoQuestaoId']) || null,
        grupo_questao_id: (getRecordValue(rawQuestion, 'grupo_questao_id', 'grupoQuestaoId') as ManualQuestionState['grupo_questao_id']) || null,
        provaId: (getRecordValue(rawQuestion, 'prova_id', 'provaId') as ManualQuestionState['provaId']) || '',
        provas: (question.provas || (Array.isArray(rawQuestion.provas) ? rawQuestion.provas as ManualQuestionState['provas'] : [])),
      });
    } else {
      setEditingQuestion(null);
      setEditingExtractedIndex(null);
      setManualQ(createEmptyManualQuestion());
    }

    setShowAddManual(true);
  };

  return {
    manualQ,
    setManualQ,
    editingQuestion,
    showAddManual,
    editingExtractedIndex,
    isGeneratingDetailed,
    isGeneratingTeacher,
    openManualModal,
    closeManualModal,
    handleSaveManual,
    handleGenerateManualDetail,
    handleGenerateManualTeacherComment,
  };
};
