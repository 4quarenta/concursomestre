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
  const rawReport = report as ErrorReport & {
    targetId?: string | number;
    question_id?: string | number;
    material_id?: string | number;
    comment_id?: string | number;
  };

  if (report.targetType === 'question') return report.questionId ?? rawReport.targetId ?? rawReport.question_id;
  if (report.targetType === 'material') return report.materialId ?? rawReport.targetId ?? rawReport.material_id;
  return report.commentId ?? rawReport.targetId ?? rawReport.comment_id;
};

export const getReportTargetLabel = (targetType: ErrorReport['targetType']) => {
  if (targetType === 'question') return 'Questão';
  if (targetType === 'material') return 'Material';
  return 'Comentário';
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
        label: 'Questão corrigida',
        message: 'Obrigado pela denúncia. A questão foi revisada pela moderação e o conteúdo já foi ajustado para refletir o problema identificado.',
      },
      {
        label: 'Questão mantida',
        message: 'A questão foi revisada pela equipe e, no momento, o conteúdo foi mantido ativo porque a denúncia não apontou erro material confirmado.',
      },
      {
        label: 'Aguardando evidencias',
        message: 'A denúncia esta em análise, mas precisamos de mais contexto para confirmar o problema na questão. Se houver prova complementar, ela pode ser anexada a este caso.',
      },
    ];
  }

  if (report.targetType === 'material') {
    return [
      {
        label: 'Material ocultado',
        message: 'O material foi removido temporariamente da vitrine enquanto a equipe conclui a revisao do conteúdo denunciado.',
      },
      {
        label: 'Material mantido',
        message: 'O material foi revisado pela moderação e permanece ativo porque não encontramos violacao confirmada nas evidencias atuais.',
      },
      {
        label: 'Ajuste solicitado',
        message: 'A moderação contatou o autor e solicitou adequacoes no material para corrigir o ponto denunciado antes de uma nova liberacao.',
      },
    ];
  }

  return [
    {
      label: 'Comentário removido',
      message: 'O comentário denunciado foi analisado pela moderação e a equipe aplicou a medida cabivel para preservar as diretrizes da comunidade.',
    },
    {
      label: 'Comentário mantido',
      message: 'O comentário denunciado foi revisado pela moderação e não identificamos violacao confirmada nas diretrizes da comunidade.',
    },
    {
      label: 'Comentário em revisao',
      message: 'A denúncia sobre o comentário foi recebida e esta em revisao. Se necessario, a equipe podera solicitar contexto adicional para concluir a análise.',
    },
  ];
};

export const getQuickReportResolutionReason = (report: ErrorReport) => {
  if (report.targetType === 'question') {
    return 'A denúncia da questão foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
  }

  if (report.targetType === 'material') {
    return 'A denúncia do material foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
  }

  return 'A denúncia do comentário foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
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
