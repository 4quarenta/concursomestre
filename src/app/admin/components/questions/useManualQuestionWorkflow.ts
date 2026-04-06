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
import { aiService } from '@services/questions';
import { slugify } from '../database/slugify';

type ToastHandler = (message: string, type?: string) => void;

interface UseManualQuestionWorkflowOptions {
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<any> | any;
  onUpdateQuestion: (question: Question) => Promise<any> | any;
  onRefreshQuestions: () => Promise<void> | void;
  replaceExtractedQuestion: (index: number, question: Question) => void;
}

const createEmptyManualQuestion = () => ({
  enunciado: '',
  enunciado_clean: '',
  introText: '',
  imageUrl: '',
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
      const cargo = systemSettings.taxonomies?.roles?.find((role: any) => role.name === cargoName || role.sigla === cargoName);
      if (cargo && cargo.parentId) {
        const parentOrgao = systemSettings.taxonomies?.organizations?.find((organization: any) => organization.id === cargo.parentId);
        if (parentOrgao) {
          const orgaoName = parentOrgao.sigla || parentOrgao.name;
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
    const selectedTopics = manualQ.assuntos || [];
    const currentSubjects = manualQ.subjects || [];
    const newSubjects = [...currentSubjects];
    let changed = false;

    selectedTopics.forEach((topicName: any) => {
      const topic = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => taxonomyTopic.name === topicName);
      if (topic && topic.parentId) {
        const parentSubject = systemSettings.taxonomies?.subjects?.find((subject: any) => subject.id === topic.parentId);
        if (parentSubject) {
          const subjectName = parentSubject.name;
          if (!newSubjects.includes(subjectName)) {
            newSubjects.push(subjectName);
            changed = true;
          }
        } else {
          const parentTopic = systemSettings.taxonomies?.topics?.find((taxonomyTopic: any) => taxonomyTopic.id === topic.parentId);
          if (parentTopic && parentTopic.parentId) {
            const rootSubject = systemSettings.taxonomies?.subjects?.find((subject: any) => subject.id === parentTopic.parentId);
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
  }, [manualQ.assuntos, systemSettings.taxonomies]);

  const handleGenerateManualDetail = async () => {
    setIsGeneratingDetailed(true);
    try {
      const question = {
        ...manualQ,
        options: manualQ.itens.map((item: any) => item.corpo).filter((option: string) => option),
      } as Question;
      const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', question);
      setManualQ((previous: any) => ({ ...previous, detailedComment: detail }));
    } catch (error) {
      addToast('Erro ao gerar análise detalhada da questão.', 'error');
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
      const comment = await aiService.generateTeacherComment(systemSettings.geminiApiKey || '', question);
      setManualQ((previous: any) => ({ ...previous, teacherComment: comment }));
    } catch (error) {
      addToast('Erro ao gerar comentário do professor.', 'error');
    } finally {
      setIsGeneratingTeacher(false);
    }
  };

  const closeManualModal = () => {
    setShowAddManual(false);
    setEditingExtractedIndex(null);
  };

  const handleSaveManual = async () => {
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
      cargos: manualQ.cargos.map((cargo: any) =>
        typeof cargo === 'string'
          ? systemSettings.taxonomies?.roles?.find((taxonomy: any) => taxonomy.name === cargo) || { id: null, slug: slugify(cargo), descrição: cargo, name: cargo }
          : { ...cargo, name: cargo.name || cargo.descrição },
      ),
      assuntos: [
        ...manualQ.subjects.map((subject: any) => {
          const found = typeof subject === 'string' ? systemSettings.taxonomies?.subjects?.find((taxonomy: any) => taxonomy.name === subject) : subject;
          return found
            ? { ...found, name: found.name || found.nome || subject, materia: true }
            : { id: null, nome: subject, name: subject, slug: slugify(subject), materia: true };
        }),
        ...manualQ.assuntos
          .filter((topic: any) => {
            const topicName = typeof topic === 'string' ? topic : topic.name || topic.nome;
            return !manualQ.subjects.some((subject: any) => (typeof subject === 'string' ? subject : subject.name || subject.nome) === topicName);
          })
          .map((topic: any) => {
            const found = typeof topic === 'string' ? systemSettings.taxonomies?.topics?.find((taxonomy: any) => taxonomy.name === topic) : topic;
            return found
              ? { ...found, name: found.name || found.nome || topic, materia: false }
              : { id: null, nome: topic, name: topic, slug: slugify(topic), materia: false };
          }),
      ],
      anos: manualQ.anos.map((year: any) => (typeof year === 'string' ? { id: null, name: year, slug: year } : { id: null, name: String(year), slug: String(year) })),
      provaId: manualQ.provaId || null,
      tipo: manualQ.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      dificuldade: manualQ.difficulty,
      itens: manualQ.itens.filter((item: any) => item.corpo.trim()),
      resposta: manualQ.resposta,
      teacherComment: manualQ.teacherComment,
      detailedComment: manualQ.detailedComment,
      anulada: manualQ.anulada,
      desatualizada: manualQ.desatualizada,
      stats: editingQuestion?.stats || { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
      comments: editingQuestion?.comments || [],
      timestamp: new Date().toISOString(),
    } as Question;

    try {
      if (editingExtractedIndex !== null) {
        replaceExtractedQuestion(editingExtractedIndex, newQuestion);
        setEditingExtractedIndex(null);
        addToast('`Questão extraida revisada com sucesso!', 'success');
      } else {
        let response;
        if (editingQuestion) {
          response = await onUpdateQuestion(newQuestion);
        } else {
          response = await onAddQuestion(newQuestion);
        }

        setEditingQuestion(null);
        await onRefreshQuestions();

        let message = 'Questão salva com sucesso!';
        if (response?.newTaxonomies?.length > 0) {
          message += `\n\nNovos itens criados: ${response.newTaxonomies.map((taxonomy: any) => `${taxonomy.type}: ${taxonomy.name}`).join(', ')}`;
        }
        addToast(message, 'success');
      }
    } catch (error) {
      console.error('Error saving manual question:', error);
      addToast('`Erro ao salvar questão. Verifique o console para mais detalhes.', 'error');
    } finally {
      closeManualModal();
    }
  };

  const openManualModal = (question?: Question, extractedIndex?: number) => {
    if (question) {
      setEditingQuestion(question);
      setEditingExtractedIndex(extractedIndex !== undefined ? extractedIndex : null);

      const rawQuestion = question as any;
      setManualQ({
        ...question,
        enunciado: question.enunciado || rawQuestion.text || '',
        enunciado_clean: question.enunciado_clean || (rawQuestion.text ? rawQuestion.text.replace(/<[^>]*>?/gm, '') : ''),
        bancas: (question.bancas || []).map((item: any) => (typeof item === 'string' ? item : item.sigla || item.name)),
        orgaos: (question.orgaos || []).map((item: any) => (typeof item === 'string' ? item : item.name)),
        cargos: (question.cargos || []).map((item: any) => (typeof item === 'string' ? item : item.descrição || item.name)),
        subjects: (question.assuntos?.filter((item: any) => item.materia) || []).map((item: any) => item.nome || item.name || item),
        assuntos: (question.assuntos?.filter((item: any) => !item.materia) || []).map((item: any) => item.nome || item.name || item),
        anos: (question.anos || []).map((item: any) => (typeof item === 'number' ? String(item) : item)),
        dificuldade: question.dificuldade || rawQuestion.difficulty || 2,
        difficulty: question.dificuldade || rawQuestion.difficulty || 2,
        tipo: question.tipo || rawQuestion.modality || 'Multipla Escolha',
        level: rawQuestion.level || question.nivel || 'Superior',
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
