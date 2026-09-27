import type { Question } from '@types';
import {
  getQuestionExpectedOptionsCount,
  getQuestionOptionTexts,
  getQuestionPublicationBlockReasons,
} from './adminImportWorkflowPublicationCore';

export const describeQuestionPublicationBlockers = (question: Question): string[] => {
  const optionCount = getQuestionOptionTexts(question).length;
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);

  return getQuestionPublicationBlockReasons(question).map((reason) => {
    const missingAnswerOption = reason.match(/^gabarito_alternativa_inexistente:(\d+)$/);
    if (missingAnswerOption) {
      const answerIndex = Number(missingAnswerOption[1]);
      const answerLabel = answerIndex < 26 ? String.fromCharCode(65 + answerIndex) : `nº ${answerIndex + 1}`;
      return `Gabarito ${answerLabel} informado, mas a alternativa correspondente não foi extraída ou está vazia.`;
    }

    switch (reason) {
      case 'enunciado_ausente':
        return 'Enunciado ausente ou curto demais (são necessários pelo menos 12 caracteres).';
      case 'tipo_indefinido':
        return 'Modalidade da questão não definida; selecione o tipo da questão.';
      case 'alternativas_ausentes':
        return `Nenhuma alternativa válida foi extraída; adicione pelo menos ${Math.max(expectedOptionsCount, 2)}.`;
      case 'alternativas_incompletas':
        return `Alternativas incompletas: ${optionCount} de ${expectedOptionsCount} preenchidas.`;
      case 'gabarito_ausente':
        return 'Gabarito ausente; marque a alternativa correta, ou indique se a questão foi anulada/atribuída a todos.';
      default:
        return `Pendência de publicação: ${reason.replace(/_/g, ' ')}.`;
    }
  });
};
