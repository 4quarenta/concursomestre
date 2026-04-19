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
import type { Question, SystemSettings } from '@types';
import { aiService } from '@services/questions';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

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

export type GenerateSpecificType = 'teacher' | 'detailed';

interface UseAdminImportWorkflowOptions {
  systemSettings: SystemSettings;
  addToast: (message: string, type?: string) => void;
  onAddQuestions: (questions: Question[]) => Promise<any> | any;
}

export const useAdminImportWorkflow = ({
  systemSettings,
  addToast,
  onAddQuestions,
}: UseAdminImportWorkflowOptions) => {
  const [qFile, setQFile] = useState<File | null>(null);
  const [kFile, setKFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractWithComment, setExtractWithComment] = useState(true);
  const [examProgress, setExamProgress] = useState(0);
  const [keyProgress, setKeyProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [generatingSpecific, setGeneratingSpecific] = useState<{ index: number; type: GenerateSpecificType } | null>(null);

  const addLog = (message: string) => {
    setLogs((previous) => [`> ${message}`, ...previous].slice(0, 50));
  };

  const pdfToImage = async (pdfDoc: any, pageNum: number): Promise<string> => {
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

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      addToast('`Arquivos de Prova e Gabarito são obrigatórios para este processo.', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      const pdfjs = await loadPdfJsModule();
      addLog('Iniciando leitura do Gabarito...');
      const keyBuffer = await kFile.arrayBuffer();
      const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
      const keyImage = await pdfToImage(keyPdf, 1);
      setKeyProgress(50);
      const keyMap = await aiService.extractAnswerKeyMapping(keyImage);
      setKeyProgress(100);
      addLog('Gabarito oficial mapeado pela IA.');

      addLog('Iniciando motor de extração IA (Prova)...');
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const pagesCount = questionPdf.numPages;
      addLog(`Arquivo de prova identificado: ${pagesCount} páginas.`);

      let allFoundQuestions: Question[] = [];

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        addLog(`Lendo pág ${pageIndex}/${pagesCount}...`);

        const pageImage = await pdfToImage(questionPdf, pageIndex);
        const result = await aiService.extractQuestionsFromPage(pageImage, extractWithComment);

        if (result.questions && result.questions.length > 0) {
          addLog(`${result.questions.length} questões encontradas na pág ${pageIndex}.`);

          const mappedQuestions = result.questions.map((question, questionIndex) => {
            const questionNumber = allFoundQuestions.length + questionIndex + 1;
            const rawQuestion = question as any;

            return {
              ...question,
              hashId: (result.metadata as any)?.hash_id,
              enunciado: rawQuestion.text || question.enunciado || '',
              enunciado_clean: (rawQuestion.text || question.enunciado || '').replace(/<[^>]*>?/gm, ''),
              bancas: result.metadata?.agency
                ? [{ sigla: result.metadata.agency, name: result.metadata.agency, id: null, slug: result.metadata.agency.toLowerCase() }]
                : [],
              orgaos: result.metadata?.source
                ? [{ name: result.metadata.source, id: null, slug: result.metadata.source.toLowerCase() }]
                : [],
              cargos: result.metadata?.role
                ? [{ id: null, slug: result.metadata.role.toLowerCase(), descrição: result.metadata.role }]
                : [],
              assuntos: [
                ...(rawQuestion.subject
                  ? [{ id: null, name: rawQuestion.subject, slug: rawQuestion.subject.toLowerCase(), materia: true }]
                  : []),
                ...(rawQuestion.topic
                  ? [{ id: null, name: rawQuestion.topic, slug: rawQuestion.topic.toLowerCase(), materia: false }]
                  : []),
              ],
              anos: result.metadata?.year ? [Number(result.metadata.year)] : [new Date().getFullYear()],
              tipo: (rawQuestion.options || []).length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: rawQuestion.difficulty === 'Fácil' ? 1 : rawQuestion.difficulty === 'Difícil' ? 3 : 2,
              itens: (rawQuestion.options || []).map((option: string, optionIndex: number) => ({
                id: optionIndex + 1,
                ordem: optionIndex + 1,
                rotulo: String.fromCharCode(65 + optionIndex),
                corpo: option,
                corpo_clean: option.replace(/<[^>]*>?/gm, ''),
              })),
              resposta: keyMap[questionNumber] !== undefined ? keyMap[questionNumber] + 1 : 1,
              stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
              comments: [],
            } as unknown as Question;
          });

          allFoundQuestions = [...allFoundQuestions, ...mappedQuestions];
          setExtractedQuestions([...allFoundQuestions]);
        }

        setExamProgress(Math.round((pageIndex / pagesCount) * 100));
      }

      addLog('IMPORTAÇÃO CONCLUÍDA! Revise as questões.');
    } catch (error: any) {
      addLog(`ERRO CRÍTICO: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) return;

    setIsBulkGenerating(true);
    setBulkProgress(0);
    addLog('Iniciando geração em massa de comentários detalhados...');

    const updatedQuestions = [...extractedQuestions];
    const totalQuestions = updatedQuestions.length;

    for (let index = 0; index < totalQuestions; index += 1) {
      if (!updatedQuestions[index].detailedComment) {
        try {
          const detail = await aiService.generateDetailedAnalysis(updatedQuestions[index]);
          updatedQuestions[index] = { ...updatedQuestions[index], detailedComment: detail };
          setExtractedQuestions([...updatedQuestions]);
        } catch (error) {
          addLog(`Erro ao gerar detalhado para questão ${index + 1}`);
        }
      }

      setBulkProgress(Math.round(((index + 1) / totalQuestions) * 100));
    }

    addLog('Geração em massa concluída!');
    setIsBulkGenerating(false);
  };

  const handleGenerateSpecific = async (index: number, type: GenerateSpecificType) => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    try {
      let updatedQuestion = { ...question };
      if (type === 'teacher') {
        const comment = await aiService.generateTeacherComment(question);
        updatedQuestion.teacherComment = comment;
      } else {
        const detail = await aiService.generateDetailedAnalysis(question);
        updatedQuestion.detailedComment = detail;
      }

      setExtractedQuestions((previous) => {
        const next = [...previous];
        next[index] = updatedQuestion;
        return next;
      });
    } catch (error) {
      addToast('`Erro ao gerar comentário. Tente novamente.', 'error');
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const handlePublishAllExtracted = async () => {
    const response = await onAddQuestions(extractedQuestions);
    setExtractedQuestions([]);

    let message = 'Banco atualizado!';
    if (response?.newTaxonomies?.length > 0) {
      message += `\n\nNovos itens criados: ${response.newTaxonomies.map((taxonomy: any) => `${taxonomy.type}: ${taxonomy.name}`).join(', ')}`;
    }
    addToast(message, 'success');
  };

  const replaceExtractedQuestion = (index: number, question: Question) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      next[index] = question;
      return next;
    });
  };

  return {
    qFile,
    setQFile,
    kFile,
    setKFile,
    isProcessing,
    extractWithComment,
    setExtractWithComment,
    examProgress,
    keyProgress,
    logs,
    extractedQuestions,
    isBulkGenerating,
    bulkProgress,
    generatingSpecific,
    handleImportProcess,
    handleBulkGenerateDetailed,
    handleGenerateSpecific,
    handlePublishAllExtracted,
    replaceExtractedQuestion,
  };
};
