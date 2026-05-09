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
import type { Question } from '@types';
import { aiService, type PageExtractionResult } from '@services/questions';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

export type GenerateSpecificType = 'teacher' | 'detailed';

interface ImportedQuestionDraft extends Partial<Question> {
  text?: string;
  subject?: string;
  topic?: string;
  options?: string[];
  difficulty?: string;
}

interface ImportMetadata extends NonNullable<PageExtractionResult['metadata']> {
  hash_id?: string;
}

interface AddedTaxonomySummary {
  type?: string;
  name?: string;
}

interface AddQuestionsResponse {
  newTaxonomies?: AddedTaxonomySummary[];
}

type AddQuestionsHandlerResult = AddQuestionsResponse | void | null | undefined;

interface UseAdminImportWorkflowOptions {
  addToast: (message: string, type?: string) => void;
  onAddQuestions: (questions: Question[]) => Promise<AddQuestionsHandlerResult> | AddQuestionsHandlerResult;
}

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

const toImportMetadata = (metadata: PageExtractionResult['metadata']) => (
  (metadata && typeof metadata === 'object' ? metadata : null) as ImportMetadata | null
);

const toImportedQuestionDraft = (question: Partial<Question>) => question as ImportedQuestionDraft;

const toPublishResult = (value: unknown) => (
  value && typeof value === 'object' ? value as AddQuestionsResponse : null
);

export const useAdminImportWorkflow = ({
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

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      addToast('`Arquivos de prova e gabarito sao obrigatorios para este processo.', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      const pdfjs = await loadPdfJsModule();
      addLog('Iniciando leitura do gabarito...');
      const keyBuffer = await kFile.arrayBuffer();
      const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
      const keyImage = await pdfToImage(keyPdf, 1);
      setKeyProgress(50);
      const keyMap = await aiService.extractAnswerKeyMapping(keyImage);
      setKeyProgress(100);
      addLog('Gabarito oficial mapeado pela IA.');

      addLog('Iniciando motor de extracao IA (prova)...');
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const pagesCount = questionPdf.numPages;
      addLog(`Arquivo de prova identificado: ${pagesCount} paginas.`);

      let allFoundQuestions: Question[] = [];

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        addLog(`Lendo pag ${pageIndex}/${pagesCount}...`);

        const pageImage = await pdfToImage(questionPdf, pageIndex);
        const result = await aiService.extractQuestionsFromPage(pageImage, extractWithComment);
        const extractionMetadata = toImportMetadata(result.metadata);

        if (result.questions && result.questions.length > 0) {
          addLog(`${result.questions.length} questoes encontradas na pag ${pageIndex}.`);

          const mappedQuestions: Question[] = result.questions.map((question, questionIndex) => {
            const questionNumber = allFoundQuestions.length + questionIndex + 1;
            const rawQuestion = toImportedQuestionDraft(question);
            const options = Array.isArray(rawQuestion.options) ? rawQuestion.options : [];
            const questionText = String(rawQuestion.text || question.enunciado || '').trim();
            const subjectLabel = String(rawQuestion.subject || '').trim();
            const topicLabel = String(rawQuestion.topic || '').trim();
            const roleLabel = String(result.metadata?.role || '').trim();
            const agencyLabel = String(result.metadata?.agency || '').trim();
            const organizationLabel = String(result.metadata?.source || '').trim();

            return {
              ...question,
              hashId: extractionMetadata?.hash_id,
              enunciado: questionText,
              enunciado_clean: stripHtml(questionText),
              bancas: agencyLabel
                ? [{ sigla: agencyLabel, name: agencyLabel, id: null, slug: agencyLabel.toLowerCase() }]
                : [],
              orgaos: organizationLabel
                ? [{ name: organizationLabel, id: null, slug: organizationLabel.toLowerCase() }]
                : [],
              cargos: roleLabel
                ? [{ id: null, slug: roleLabel.toLowerCase(), descricao: roleLabel }]
                : [],
              assuntos: [
                ...(subjectLabel
                  ? [{ id: null, name: subjectLabel, slug: subjectLabel.toLowerCase(), materia: true }]
                  : []),
                ...(topicLabel
                  ? [{ id: null, name: topicLabel, slug: topicLabel.toLowerCase(), materia: false }]
                  : []),
              ],
              anos: result.metadata?.year ? [Number(result.metadata.year)] : [new Date().getFullYear()],
              tipo: options.length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: rawQuestion.difficulty === 'Fácil' ? 1 : rawQuestion.difficulty === 'Difícil' ? 3 : 2,
              itens: options.map((option, optionIndex) => ({
                id: optionIndex + 1,
                ordem: optionIndex + 1,
                rotulo: String.fromCharCode(65 + optionIndex),
                corpo: option,
                corpo_clean: stripHtml(option),
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

      addLog('IMPORTACAO CONCLUIDA! Revise as questoes.');
    } catch (error) {
      addLog(`ERRO CRITICO: ${readErrorMessage(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) {
      return;
    }

    setIsBulkGenerating(true);
    setBulkProgress(0);
    addLog('Iniciando geracao em massa de comentarios detalhados...');

    const updatedQuestions = [...extractedQuestions];
    const totalQuestions = updatedQuestions.length;

    for (let index = 0; index < totalQuestions; index += 1) {
      if (!updatedQuestions[index].detailedComment) {
        try {
          const detail = await aiService.generateDetailedAnalysis(updatedQuestions[index]);
          updatedQuestions[index] = { ...updatedQuestions[index], detailedComment: detail };
          setExtractedQuestions([...updatedQuestions]);
        } catch {
          addLog(`Erro ao gerar detalhado para questao ${index + 1}`);
        }
      }

      setBulkProgress(Math.round(((index + 1) / totalQuestions) * 100));
    }

    addLog('Geracao em massa concluida!');
    setIsBulkGenerating(false);
  };

  const handleGenerateSpecific = async (index: number, type: GenerateSpecificType) => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    if (!question) {
      setGeneratingSpecific(null);
      return;
    }

    try {
      const updatedQuestion = type === 'teacher'
        ? { ...question, teacherComment: await aiService.generateTeacherComment(question) }
        : { ...question, detailedComment: await aiService.generateDetailedAnalysis(question) };

      setExtractedQuestions((previous) => {
        const next = [...previous];
        next[index] = updatedQuestion;
        return next;
      });
    } catch {
      addToast('`Erro ao gerar comentario. Tente novamente.', 'error');
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const handlePublishAllExtracted = async () => {
    try {
      const response = await onAddQuestions(extractedQuestions);
      setExtractedQuestions([]);

      let message = 'Banco atualizado!';
      const publishResult = toPublishResult(response);
      if (publishResult?.newTaxonomies?.length) {
        const createdTaxonomies = publishResult.newTaxonomies
          .map((taxonomy) => [taxonomy.type, taxonomy.name].filter(Boolean).join(': '))
          .filter(Boolean);

        if (createdTaxonomies.length > 0) {
          message += `\n\nNovos itens criados: ${createdTaxonomies.join(', ')}`;
        }
      }

      addToast(message, 'success');
    } catch (error) {
      addToast(`Erro ao publicar questoes: ${readErrorMessage(error)}`, 'error');
    }
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

