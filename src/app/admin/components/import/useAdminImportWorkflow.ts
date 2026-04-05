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
import * as pdfjs from 'pdfjs-dist';
import type { Question, SystemSettings } from '@types';
import { aiService } from '@services/questions';

pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

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
      addToast('`Arquivos de Prova e Gabarito sÃ£o obrigatÃ³rios para este processo.', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      addLog('Iniciando leitura do Gabarito...');
      const keyBuffer = await kFile.arrayBuffer();
      const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
      const keyImage = await pdfToImage(keyPdf, 1);
      setKeyProgress(50);
      const keyMap = await aiService.extractAnswerKeyMapping(systemSettings.geminiApiKey || '', keyImage);
      setKeyProgress(100);
      addLog('Gabarito oficial mapeado pela IA.');

      addLog('Iniciando motor de extraÃ§Ã£o IA (Prova)...');
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const pagesCount = questionPdf.numPages;
      addLog(`Arquivo de prova identificado: ${pagesCount} pÃ¡ginas.`);

      let allFoundQuestions: Question[] = [];

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        addLog(`Lendo pÃ¡g ${pageIndex}/${pagesCount}...`);

        const pageImage = await pdfToImage(questionPdf, pageIndex);
        const result = await aiService.extractQuestionsFromPage(
          systemSettings.geminiApiKey || '',
          pageImage,
          extractWithComment,
        );

        if (result.questions && result.questions.length > 0) {
          addLog(`${result.questions.length} questÃµes encontradas na pÃ¡g ${pageIndex}.`);

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
                ? [{ id: null, slug: result.metadata.role.toLowerCase(), descricao: result.metadata.role }]
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
              dificuldade: rawQuestion.difficulty === 'FÃ¡cil' ? 1 : rawQuestion.difficulty === 'DifÃ­cil' ? 3 : 2,
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

      addLog('IMPORTAÃ‡ÃƒO CONCLUÃDA! Revise as questÃµes.');
    } catch (error: any) {
      addLog(`ERRO CRÃTICO: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) return;

    setIsBulkGenerating(true);
    setBulkProgress(0);
    addLog('Iniciando geraÃ§Ã£o em massa de comentÃ¡rios detalhados...');

    const updatedQuestions = [...extractedQuestions];
    const totalQuestions = updatedQuestions.length;

    for (let index = 0; index < totalQuestions; index += 1) {
      if (!updatedQuestions[index].detailedComment) {
        try {
          const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', updatedQuestions[index]);
          updatedQuestions[index] = { ...updatedQuestions[index], detailedComment: detail };
          setExtractedQuestions([...updatedQuestions]);
        } catch (error) {
          addLog(`Erro ao gerar detalhado para questÃ£o ${index + 1}`);
        }
      }

      setBulkProgress(Math.round(((index + 1) / totalQuestions) * 100));
    }

    addLog('GeraÃ§Ã£o em massa concluÃ­da!');
    setIsBulkGenerating(false);
  };

  const handleGenerateSpecific = async (index: number, type: GenerateSpecificType) => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    try {
      let updatedQuestion = { ...question };
      if (type === 'teacher') {
        const comment = await aiService.generateTeacherComment(systemSettings.geminiApiKey || '', question);
        updatedQuestion.teacherComment = comment;
      } else {
        const detail = await aiService.generateDetailedAnalysis(systemSettings.geminiApiKey || '', question);
        updatedQuestion.detailedComment = detail;
      }

      setExtractedQuestions((previous) => {
        const next = [...previous];
        next[index] = updatedQuestion;
        return next;
      });
    } catch (error) {
      addToast('`Erro ao gerar comentÃ¡rio. Tente novamente.', 'error');
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
