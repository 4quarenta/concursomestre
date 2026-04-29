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

import { useEffect, useState } from 'react';
import type { Question, SystemSettings } from '@types';
import { readApiErrorMessage } from '@services/api';
import { aiService } from '@services/questions';
import {
  normalizeQuestionPublishStatus,
  normalizeQuestionVisibilityStatus,
  withQuestionPublicationAliases,
} from '@services/questions/questionPublication';
import { slugify } from '../database/slugify';
import { normalizeProvaRecord } from '../exams/examBankUtils';

type ToastHandler = (message: string, type?: string) => void;

interface UseManualQuestionWorkflowOptions {
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<any> | any;
  onUpdateQuestion: (question: Question) => Promise<any> | any;
  onRefreshQuestions: () => Promise<void> | void;
  replaceExtractedQuestion: (index: number, question: Question) => void;
}

/**
 * Normaliza o texto principal de entidades administrativas.
 * Evita acessar propriedades indefinidas durante a montagem do modal manual.
 *
 * @since 1.0.0
 */
const getEntityLabel = (value: any) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object') {
    return String(
      value.name
      ?? value.nome
      ?? value.sigla
      ?? value.descricao
      ?? value['descrição']
      ?? '',
    ).trim();
  }

  return '';
};

/**
 * Normaliza especificamente cargos, preservando compatibilidade com chaves legadas.
 *
 * @since 1.0.0
 */
const getRoleLabel = (value: any) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object') {
    return String(
      value.descricao
      ?? value['descrição']
      ?? value.name
      ?? value.nome
      ?? value.sigla
      ?? '',
    ).trim();
  }

  return '';
};

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

const resolveQuestionPublicationInput = (question: any) => {
  const publishStatus = String(question?.publishStatus || question?.publish_status || question?.status || '').toLowerCase();
  const scheduledValue = question?.scheduledAt
    || question?.scheduled_at
    || question?.publishAt
    || question?.publish_at;

  if (publishStatus === 'scheduled' || publishStatus === 'programado') {
    return normalizeDateTimeLocalValue(scheduledValue);
  }

  return normalizeDateTimeLocalValue(
    question?.publishedAt
    || question?.published_at
    || question?.published_on
    || question?.publicationDate
    || question?.publication_date
    || question?.data_publicacao
    || question?.publicado_em
    || question?.dataPublicacao
    || question?.createdAt
    || question?.created_at
    || question?.created
    || question?.data_criacao
    || question?.criado_em
    || question?.timestamp
    || scheduledValue,
  );
};

const resolveQuestionCreatedInput = (question: any) => normalizeDateTimeLocalValue(
  question?.createdAt
  || question?.created_at
  || question?.created
  || question?.data_criacao
  || question?.criado_em
  || question?.timestamp
  || question?.publishedAt
  || question?.published_at
  || question?.data_publicacao,
);

const getQuestionTaxonomyLevel = (item: any, taxonomies?: SystemSettings['taxonomies']) => {
  const rawLevel = String(item?.taxonomyLevel || item?.taxonomy_level || '').toLowerCase();
  if (rawLevel === 'topico' || rawLevel === 'assunto') {
    return rawLevel;
  }

  const itemName = getEntityLabel(item);
  const found = (taxonomies?.topics || []).find((taxonomy: any) => (
    String(taxonomy.id || '') === String(item?.id || '')
    || (itemName && taxonomy.name === itemName)
  ));
  const foundLevel = String(found?.taxonomyLevel || (found as any)?.taxonomy_level || '').toLowerCase();
  if (foundLevel === 'topico' || foundLevel === 'assunto') {
    return foundLevel;
  }

  if (found?.parentId) {
    const parentIsTopic = (taxonomies?.topics || []).some((taxonomy: any) => String(taxonomy.id) === String(found.parentId));
    return parentIsTopic ? 'assunto' : 'topico';
  }

  return 'topico';
};

const uniqueLabels = (values: any[]) => Array.from(new Set(values.map(getEntityLabel).filter(Boolean)));

const uniqueTaxonomyItems = (values: any[]) => {
  const itemMap = new Map<string, any>();

  values.forEach((value) => {
    const label = getEntityLabel(value);
    if (label && !itemMap.has(label)) {
      itemMap.set(label, value);
    }
  });

  return Array.from(itemMap.values());
};

const getTaxonomyParentId = (item: any) => (
  item?.parent_id
  ?? item?.parentId
  ?? item?.pai
  ?? item?.assunto_raiz
  ?? null
);

const getTaxonomyParentName = (item: any) => (
  item?.parent_name
  ?? item?.parentName
  ?? item?.root_subject_name
  ?? item?.rootSubjectName
  ?? ''
);

const getTaxonomyLevel = (item: any) => String(item?.taxonomy_level ?? item?.taxonomyLevel ?? '').trim();

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

const createEmptyManualQuestion = () => ({
  enunciado: '',
  enunciado_clean: '',
  introText: '',
  imageUrl: '',
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
  level: 'Superior',
  tipo: 'Multipla Escolha',
  anulada: false,
  desatualizada: false,
  text: '',
  agencies: [],
  years: [],
  topics: [],
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
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [isGeneratingDetailed, setIsGeneratingDetailed] = useState(false);
  const [isGeneratingTeacher, setIsGeneratingTeacher] = useState(false);
  const [manualQ, setManualQ] = useState<any>(createEmptyManualQuestion);

  useEffect(() => {
    const selectedCargos = manualQ.cargos || [];
    const currentOrgaos = manualQ.orgaos || [];
    const newOrgaos = [...currentOrgaos];
    let changed = false;

    selectedCargos.forEach((cargoName: any) => {
      const normalizedCargoName = getRoleLabel(cargoName);
      const cargo = systemSettings.taxonomies?.roles?.find((role: any) => getRoleLabel(role) === normalizedCargoName || role.sigla === normalizedCargoName);
      if (cargo && cargo.parentId) {
        const parentOrgao = systemSettings.taxonomies?.organizations?.find((organization: any) => organization.id === cargo.parentId);
        if (parentOrgao) {
          const orgaoName = getEntityLabel(parentOrgao);
          if (!newOrgaos.includes(orgaoName)) {
            newOrgaos.push(orgaoName);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      setManualQ((previous: any) => ({ ...previous, orgaos: newOrgaos }));
    }
  }, [manualQ.cargos, systemSettings.taxonomies]);

  useEffect(() => {
    const selectedTopics = [...(manualQ.topics || []), ...(manualQ.assuntos || [])];
    const currentSubjects = manualQ.subjects || [];
    const newSubjects = [...currentSubjects];
    let changed = false;

    selectedTopics.forEach((topicName: any) => {
      const topic = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => taxonomyTopic.name === topicName);
      if (topic && topic.parentId) {
        const parentSubject = systemSettings.taxonomies?.subjects?.find((subject: any) => (
          String(subject.id) === String(topic.parentId)
          || String(subject.id) === String(topic.rootSubjectId || '')
        ));
        if (parentSubject) {
          const subjectName = parentSubject.name;
          if (!newSubjects.includes(subjectName)) {
            newSubjects.push(subjectName);
            changed = true;
          }
        } else {
          const parentTopic = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => String(taxonomyTopic.id) === String(topic.parentId));
          if (parentTopic && parentTopic.parentId) {
            const rootSubject = systemSettings.taxonomies?.subjects?.find((subject: any) => String(subject.id) === String(parentTopic.parentId));
            if (rootSubject) {
              const subjectName = rootSubject.name;
              if (!newSubjects.includes(subjectName)) {
                newSubjects.push(subjectName);
                changed = true;
              }
            }
          }
        }
      }
    });

    if (changed) {
      setManualQ((previous: any) => ({ ...previous, subjects: newSubjects }));
    }
  }, [manualQ.assuntos, manualQ.topics, systemSettings.taxonomies]);

  useEffect(() => {
    const selectedAssuntos = manualQ.assuntos || [];
    const currentTopics = manualQ.topics || [];
    const nextTopics = [...currentTopics];
    let changed = false;

    selectedAssuntos.forEach((assuntoName: any) => {
      const assuntoLabel = getEntityLabel(assuntoName);
      const assunto = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => taxonomyTopic.name === assuntoLabel);
      if (!assunto || getQuestionTaxonomyLevel(assunto, systemSettings.taxonomies) !== 'assunto' || !assunto.parentId) {
        return;
      }

      const parentTopic = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => String(taxonomyTopic.id) === String(assunto.parentId));
      if (parentTopic?.name && !nextTopics.includes(parentTopic.name)) {
        nextTopics.push(parentTopic.name);
        changed = true;
      }
    });

    if (changed) {
      setManualQ((previous: any) => ({ ...previous, topics: nextTopics }));
    }
  }, [manualQ.assuntos, manualQ.topics, systemSettings.taxonomies]);

  const handleGenerateManualDetail = async () => {
    setIsGeneratingDetailed(true);
    try {
      const question = {
        ...manualQ,
        options: manualQ.itens.map((item: any) => item.corpo).filter((option: string) => option),
      } as Question;
      const detail = await aiService.generateDetailedAnalysis(question);
      setManualQ((previous: any) => ({ ...previous, detailedComment: detail }));
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
        ...manualQ,
        options: manualQ.itens.map((item: any) => item.corpo).filter((option: string) => option),
      } as Question;
      const comment = await aiService.generateTeacherComment(question);
      setManualQ((previous: any) => ({ ...previous, teacherComment: comment }));
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
      ? manualQ.publishedAt || (editingQuestion ? resolveQuestionPublicationInput(editingQuestion as any) : new Date().toISOString())
      : manualQ.publishedAt || '';
    const questionOrigin = normalizeQuestionOrigin(
      manualQ.questionOrigin || manualQ.question_origin || manualQ.sourceType || manualQ.source_type,
      Boolean(manualQ.provaId),
    );

    const newQuestion: Question = {
      id: editingQuestion?.id ? Number(editingQuestion.id) : null,
      enunciado: manualQ.enunciado || manualQ.text,
      enunciado_clean: manualQ.enunciado_clean || (manualQ.text ? manualQ.text.replace(/<[^>]*>?/gm, '') : ''),
      introText: manualQ.introText,
      imageUrl: manualQ.imageUrl,
      bancas: manualQ.bancas.map((banca: any) =>
        typeof banca === 'string'
          ? systemSettings.taxonomies?.agencies?.find((taxonomy: any) => taxonomy.sigla === banca || taxonomy.name === banca) || { id: null, sigla: banca, nome: banca, name: banca, slug: slugify(banca) }
          : { ...banca, name: banca.name || banca.nome || banca.sigla },
      ),
      orgaos: manualQ.orgaos.map((orgao: any) =>
        typeof orgao === 'string'
          ? systemSettings.taxonomies?.organizations?.find((taxonomy: any) => taxonomy.sigla === orgao || taxonomy.name === orgao) || { id: null, nome: orgao, sigla: orgao, name: orgao, slug: slugify(orgao) }
          : { ...orgao, name: orgao.name || orgao.nome || orgao.sigla },
      ),
      cargos: uniqueTaxonomyItems(manualQ.cargos || [])
        .map((cargo: any) => {
          const cargoName = getRoleLabel(cargo);
          const found = typeof cargo === 'string'
            ? systemSettings.taxonomies?.roles?.find((taxonomy: any) => getRoleLabel(taxonomy) === cargoName)
            : cargo;
          const parentId = getTaxonomyParentId(found);
          const parentName = getTaxonomyParentName(found);

          return found
            ? {
                ...found,
                name: found.name || found.nome || cargoName,
                nome: found.nome || found.name || cargoName,
                descricao: found.descricao || found['descrição'] || cargoName,
                ['descrição']: found['descrição'] || found.descricao || cargoName,
                slug: found.slug || slugify(cargoName),
                parentId,
                parent_id: parentId,
                parentName: parentName || undefined,
                parent_name: parentName || undefined,
              }
            : { id: null, slug: slugify(cargoName), descricao: cargoName, ['descrição']: cargoName, name: cargoName };
        })
        .filter((cargo: any) => getRoleLabel(cargo)),
      assuntos: [
        ...(manualQ.subjects || []).map((subject: any) => {
          const subjectName = getEntityLabel(subject);
          const found = typeof subject === 'string' ? systemSettings.taxonomies?.subjects?.find((taxonomy: any) => taxonomy.name === subject) : subject;
          return found
            ? { ...found, name: found.name || found.nome || subjectName, nome: found.nome || found.name || subjectName, materia: true }
            : { id: null, nome: subjectName, name: subjectName, slug: slugify(subjectName), materia: true };
        }),
        ...uniqueTaxonomyItems([...(manualQ.topics || []), ...(manualQ.assuntos || [])])
          .filter((topic: any) => {
            const topicName = getEntityLabel(topic);
            return !(manualQ.subjects || []).some((subject: any) => getEntityLabel(subject) === topicName);
          })
          .map((topic: any) => {
            const topicName = getEntityLabel(topic);
            const found = typeof topic === 'string'
              ? systemSettings.taxonomies?.topics?.find((taxonomy: any) => taxonomy.name === topicName)
              : topic;
            const parentId = getTaxonomyParentId(found);
            const parentName = getTaxonomyParentName(found);
            const taxonomyLevel = getTaxonomyLevel(found);
            const rootSubjectId = found?.root_subject_id ?? found?.rootSubjectId ?? null;
            const rootSubjectName = found?.root_subject_name ?? found?.rootSubjectName ?? '';

            return found
              ? {
                  ...found,
                  name: found.name || found.nome || topicName,
                  nome: found.nome || found.name || topicName,
                  slug: found.slug || slugify(topicName),
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
      anos: manualQ.anos.map((year: any) => (typeof year === 'string' ? { id: null, name: year, slug: year } : { id: null, name: String(year), slug: String(year) })),
      questionOrigin,
      question_origin: questionOrigin,
      grupoQuestao: manualQ.grupoQuestao || null,
      grupoQuestaoId: manualQ.grupoQuestaoId || manualQ.grupo_questao_id || null,
      grupo_questao_id: manualQ.grupoQuestaoId || manualQ.grupo_questao_id || null,
      provaId: manualQ.provaId || null,
      provas: (manualQ.provas || []).map((prova: any) => normalizeProvaRecord(prova)).filter(Boolean),
      tipo: manualQ.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      dificuldade: manualQ.difficulty,
      itens: manualQ.itens.filter((item: any) => item.corpo.trim()),
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
    } as Question;
    const questionPayload = withQuestionPublicationAliases(newQuestion);

    try {
      if (editingExtractedIndex !== null) {
        replaceExtractedQuestion(editingExtractedIndex, questionPayload);
        setEditingExtractedIndex(null);
        addToast('Questao extraida revisada com sucesso!', 'success');
      } else {
        let response;
        if (editingQuestion) {
          response = await onUpdateQuestion(questionPayload);
        } else {
          response = await onAddQuestion(questionPayload);
        }

        setEditingQuestion(null);
        await onRefreshQuestions();

        const newTaxonomies = Array.isArray(response?.newTaxonomies)
          ? response.newTaxonomies
          : Array.isArray(response?.new_taxonomies)
            ? response.new_taxonomies
            : [];

        if (newTaxonomies.length > 0) {
          addToast(
            `Novos itens criados: ${newTaxonomies.map((taxonomy: any) => `${taxonomy.type}: ${taxonomy.name}`).join(', ')}`,
            'info',
          );
        }
      }
      closeManualModal();
    } catch (error) {
      console.error('Error saving manual question:', error);
      addToast(readApiErrorMessage(error, 'Erro ao salvar questao. Revise os campos e tente novamente.'), 'error');
    }
  };

  const openManualModal = (question?: Question, extractedIndex?: number) => {
    if (question) {
      setEditingQuestion(question);
      setEditingExtractedIndex(extractedIndex !== undefined ? extractedIndex : null);

      const rawQuestion = question as any;
      const nonSubjectTaxonomies = question.assuntos?.filter((item: any) => !item?.materia) || [];
      const questionTopicLabels = uniqueLabels(
        nonSubjectTaxonomies.filter((item: any) => getQuestionTaxonomyLevel(item, systemSettings.taxonomies) === 'topico'),
      );
      const questionAssuntoLabels = uniqueLabels(
        nonSubjectTaxonomies.filter((item: any) => getQuestionTaxonomyLevel(item, systemSettings.taxonomies) === 'assunto'),
      );
      const questionFocuses = uniqueTaxonomyItems((question.cargos || []).map((cargo: any) => {
        const parentId = getTaxonomyParentId(cargo);
        const parentName = getTaxonomyParentName(cargo);
        const focusById = parentId
          ? systemSettings.taxonomies?.careers?.find((taxonomy: any) => String(taxonomy.id) === String(parentId))
          : null;
        const focusByName = parentName
          ? systemSettings.taxonomies?.careers?.find((taxonomy: any) => getEntityLabel(taxonomy) === parentName)
          : null;

        return focusById || focusByName || (parentName ? { id: parentId || null, name: parentName, nome: parentName, slug: slugify(parentName) } : null);
      }).filter(Boolean));
      setManualQ({
        ...question,
        enunciado: question.enunciado || rawQuestion.text || '',
        enunciado_clean: question.enunciado_clean || (rawQuestion.text ? rawQuestion.text.replace(/<[^>]*>?/gm, '') : ''),
        bancas: (question.bancas || []).map((item: any) => getEntityLabel(item)).filter(Boolean),
        orgaos: (question.orgaos || []).map((item: any) => getEntityLabel(item)).filter(Boolean),
        focos: questionFocuses,
        focuses: questionFocuses,
        carreiras: questionFocuses,
        cargos: question.cargos || [],
        subjects: (question.assuntos?.filter((item: any) => item?.materia) || []).map((item: any) => getEntityLabel(item) || item).filter(Boolean),
        topics: questionTopicLabels,
        assuntos: questionAssuntoLabels,
        anos: (question.anos || []).map((item: any) => (typeof item === 'number' ? String(item) : item)),
        dificuldade: question.dificuldade || rawQuestion.difficulty || 2,
        difficulty: question.dificuldade || rawQuestion.difficulty || 2,
        tipo: question.tipo || rawQuestion.modality || 'Multipla Escolha',
        level: rawQuestion.level || question.nivel || 'Superior',
        publishStatus: normalizeQuestionPublishStatus(rawQuestion),
        visibilityStatus: normalizeQuestionVisibilityStatus(rawQuestion),
        scheduledAt: normalizeDateTimeLocalValue(rawQuestion.scheduledAt || rawQuestion.scheduled_at || rawQuestion.publishAt || rawQuestion.publish_at),
        publishedAt: resolveQuestionPublicationInput(rawQuestion),
        createdAt: resolveQuestionCreatedInput(rawQuestion),
        questionOrigin: normalizeQuestionOrigin(
          rawQuestion.questionOrigin || rawQuestion.question_origin || rawQuestion.sourceType || rawQuestion.source_type,
          Boolean((question as any).prova_id || rawQuestion.provaId),
        ),
        question_origin: normalizeQuestionOrigin(
          rawQuestion.questionOrigin || rawQuestion.question_origin || rawQuestion.sourceType || rawQuestion.source_type,
          Boolean((question as any).prova_id || rawQuestion.provaId),
        ),
        itens:
          question.itens ||
          rawQuestion.options?.map((option: string, index: number) => ({
            id: index + 1,
            corpo: option,
            corpo_clean: option.replace(/<[^>]*>?/gm, ''),
            rotulo: String.fromCharCode(65 + index),
          })) ||
          [],
        resposta: question.resposta || (rawQuestion.correctOptionIndex !== undefined ? rawQuestion.correctOptionIndex + 1 : 1),
        anulada: question.anulada || rawQuestion.isCanceled || false,
        desatualizada: question.desatualizada || rawQuestion.isOutdated || false,
        detailedComment: question.detailedComment || '',
        grupoQuestao: (question as any).grupoQuestao || rawQuestion.grupoQuestao || null,
        grupoQuestaoId: (question as any).grupoQuestaoId || rawQuestion.grupoQuestaoId || rawQuestion.grupo_questao_id || null,
        grupo_questao_id: (question as any).grupo_questao_id || rawQuestion.grupo_questao_id || rawQuestion.grupoQuestaoId || null,
        provaId: (question as any).prova_id || rawQuestion.provaId || '',
        provas: question.provas || rawQuestion.provas || [],
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
