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

import type { ErrorReport } from '@types';

export interface ReportModerationTemplate {
  label: string;
  message: string;
}

export interface GroupedReport {
  id: string;
  targetId: string | number;
  targetType: ErrorReport['targetType'];
  reports: ErrorReport[];
  lastReport: ErrorReport;
}

export const getReportTargetId = (report: ErrorReport): string | number | undefined => {
  if (report.targetType === 'question') return report.questionId;
  if (report.targetType === 'material') return report.materialId;
  return report.commentId;
};

export const getReportTargetLabel = (targetType: ErrorReport['targetType']) => {
  if (targetType === 'question') return 'Questao';
  if (targetType === 'material') return 'Material';
  return 'Comentario';
};

export const getReportTargetBadgeClass = (targetType: ErrorReport['targetType']) => {
  if (targetType === 'question') {
    return 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400';
  }
  if (targetType === 'material') {
    return 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
  }
  return 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400';
};

export const getReportModerationTemplates = (report: ErrorReport | null): ReportModerationTemplate[] => {
  if (!report) return [];

  if (report.targetType === 'question') {
    return [
      {
        label: 'Questao corrigida',
        message: 'Obrigado pela denuncia. A questao foi revisada pela moderacao e o conteudo ja foi ajustado para refletir o problema identificado.',
      },
      {
        label: 'Questao mantida',
        message: 'A questao foi revisada pela equipe e, no momento, o conteudo foi mantido ativo porque a denuncia nao apontou erro material confirmado.',
      },
      {
        label: 'Aguardando evidencias',
        message: 'A denuncia esta em analise, mas precisamos de mais contexto para confirmar o problema na questao. Se houver prova complementar, ela pode ser anexada a este caso.',
      },
    ];
  }

  if (report.targetType === 'material') {
    return [
      {
        label: 'Material ocultado',
        message: 'O material foi removido temporariamente da vitrine enquanto a equipe conclui a revisao do conteudo denunciado.',
      },
      {
        label: 'Material mantido',
        message: 'O material foi revisado pela moderacao e permanece ativo porque nao encontramos violacao confirmada nas evidencias atuais.',
      },
      {
        label: 'Ajuste solicitado',
        message: 'A moderacao contatou o autor e solicitou adequacoes no material para corrigir o ponto denunciado antes de uma nova liberacao.',
      },
    ];
  }

  return [
    {
      label: 'Comentario removido',
      message: 'O comentario denunciado foi analisado pela moderacao e a equipe aplicou a medida cabivel para preservar as diretrizes da comunidade.',
    },
    {
      label: 'Comentario mantido',
      message: 'O comentario denunciado foi revisado pela moderacao e nao identificamos violacao confirmada nas diretrizes da comunidade.',
    },
    {
      label: 'Comentario em revisao',
      message: 'A denuncia sobre o comentario foi recebida e esta em revisao. Se necessario, a equipe podera solicitar contexto adicional para concluir a analise.',
    },
  ];
};

export const getQuickReportResolutionReason = (report: ErrorReport) => {
  if (report.targetType === 'question') {
    return 'A denuncia da questao foi analisada pelo dashboard administrativo e recebeu tratamento da moderacao.';
  }

  if (report.targetType === 'material') {
    return 'A denuncia do material foi analisada pelo dashboard administrativo e recebeu tratamento da moderacao.';
  }

  return 'A denuncia do comentario foi analisada pelo dashboard administrativo e recebeu tratamento da moderacao.';
};

export const groupPendingReports = (reports: ErrorReport[]): GroupedReport[] => {
  const groups: Record<string, GroupedReport> = {};

  reports
    .filter((report) => report.status === 'pending')
    .forEach((report) => {
      const targetId = getReportTargetId(report);
      if (!targetId) return;

      const key = `${report.targetType}-${targetId}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          targetId,
          targetType: report.targetType,
          reports: [],
          lastReport: report,
        };
      }

      groups[key].reports.push(report);
      if (report.timestamp > groups[key].lastReport.timestamp) {
        groups[key].lastReport = report;
      }
    });

  return Object.values(groups);
};
