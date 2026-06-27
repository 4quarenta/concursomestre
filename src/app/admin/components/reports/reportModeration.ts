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

export type ReportModerationAction = 'resolved' | 'ignored';
export type ReportTargetModerationAction =
  | 'none'
  | 'comment_approved'
  | 'comment_pending'
  | 'comment_spam'
  | 'comment_trash'
  | 'question_teacher_comment'
  | 'question_detailed_analysis'
  | 'law_teacher_comment'
  | 'material_approved'
  | 'material_hidden'
  | 'material_blocked';

export interface ReportModerationTemplate {
  id: string;
  label: string;
  message: string;
  action: ReportModerationAction;
  targetAction?: ReportTargetModerationAction;
  helper?: string;
  userResponse: string;
  internalNote: string;
  resultPreview: string;
  contentAfter?: string;
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
    law_section_id?: string | number;
  };

  if (report.targetType === 'question') return report.questionId ?? rawReport.targetId ?? rawReport.question_id;
  if (report.targetType === 'material') return report.materialId ?? rawReport.targetId ?? rawReport.material_id;
  if (report.targetType === 'law_section') return report.lawSectionId ?? rawReport.targetId ?? rawReport.law_section_id;
  return report.commentId ?? rawReport.targetId ?? rawReport.comment_id;
};

export const getReportTargetLabel = (targetType: ErrorReport['targetType']) => {
  if (targetType === 'question') return 'Questão';
  if (targetType === 'material') return 'Material';
  if (targetType === 'law_section') return 'Lei comentada';
  return 'Comentário';
};

export const getReportTargetBadgeClass = (targetType: ErrorReport['targetType']) => {
  if (targetType === 'question') {
    return 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400';
  }
  if (targetType === 'material') {
    return 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
  }
  if (targetType === 'law_section') {
    return 'bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400';
  }
  return 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400';
};

const normalizeReason = (value: string) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const buildUserResponse = (targetLabel: string, actionText: string) => (
  `Olá, sua solicitação sobre ${targetLabel.toLowerCase()} foi analisada pela equipe ConcursoMestre. ${actionText} Agradecemos pela colaboração para manter a plataforma mais precisa e organizada.`
);

const buildTemplate = (input: ReportModerationTemplate): ReportModerationTemplate => input;

export const getReportModerationTemplates = (report: ErrorReport | null): ReportModerationTemplate[] => {
  if (!report) return [];

  const reason = normalizeReason(`${report.reason || ''} ${report.details || ''}`);
  const targetLabel = getReportTargetLabel(report.targetType);
  const isFormatting = reason.includes('format') || reason.includes('visual') || reason.includes('quebrad');
  const isTeacherRequest = reason.includes('solicitar comentario') || reason.includes('gerar comentario') || reason.includes('comentario do professor');
  const isDetailedRequest = reason.includes('analise detalhada') || reason.includes('aprofundamento');
  const isIncorrect = reason.includes('incorret') || reason.includes('errad') || reason.includes('gabarito') || reason.includes('desatualizad');
  const isSpam = reason.includes('spam') || reason.includes('publicidade');
  const currentContent = report.targetContent || report.details || '';

  if (report.targetType === 'question') {
    const templates = [
      buildTemplate({
        id: 'question_teacher_comment',
        label: 'Gerar comentário',
        message: 'A denúncia foi aceita. A moderação gerou um comentário do professor para reforçar a explicação da questão denunciada.',
        action: 'resolved',
        targetAction: 'question_teacher_comment',
        helper: 'Gera e salva o comentário do professor na questão.',
        userResponse: buildUserResponse(targetLabel, 'Geramos um comentário do professor para complementar a explicação da questão.'),
        internalNote: 'Ação real: gerar e salvar comentário do professor na questão denunciada.',
        resultPreview: 'O comentário será gerado pela IA e salvo diretamente no campo editorial da questão ao concluir a moderação.',
      }),
      buildTemplate({
        id: 'question_detailed_analysis',
        label: 'Gerar análise',
        message: 'A denúncia foi aceita. A moderação gerou a análise detalhada para aprofundar a explicação da questão denunciada.',
        action: 'resolved',
        targetAction: 'question_detailed_analysis',
        helper: 'Gera e salva a análise detalhada na questão.',
        userResponse: buildUserResponse(targetLabel, 'Geramos uma análise detalhada para aprofundar a resolução da questão.'),
        internalNote: 'Ação real: gerar e salvar análise detalhada na questão denunciada.',
        resultPreview: 'A análise detalhada será gerada pela IA e salva no campo editorial da questão ao concluir a moderação.',
      }),
      buildTemplate({
        id: 'question_reviewed',
        label: 'Questão corrigida',
        message: 'Obrigado pela denúncia. A questão foi revisada pela moderação e o conteúdo já foi ajustado para refletir o problema identificado.',
        action: 'resolved',
        userResponse: buildUserResponse(targetLabel, 'A questão foi revisada e o apontamento ficou registrado como corrigido pela moderação.'),
        internalNote: 'Revisão/correção manual registrada pela moderação.',
        resultPreview: isIncorrect
          ? 'Registre no campo interno qual gabarito, enunciado, mídia ou classificação foi corrigido.'
          : 'A decisão ficará registrada no histórico da denúncia.',
        contentAfter: currentContent,
      }),
      buildTemplate({
        id: 'question_kept',
        label: 'Questão mantida',
        message: 'A questão foi revisada pela equipe e, no momento, o conteúdo foi mantido ativo porque a denúncia não apontou erro material confirmado.',
        action: 'ignored',
        userResponse: buildUserResponse(targetLabel, 'Após revisão, não identificamos erro material confirmado e o conteúdo foi mantido.'),
        internalNote: 'Denúncia ignorada após revisão do alvo.',
        resultPreview: 'Nenhuma alteração será aplicada ao alvo; a denúncia será encerrada como ignorada.',
      }),
      buildTemplate({
        id: 'question_manual_review',
        label: 'Aguardando evidências',
        message: 'A denúncia está em análise, mas precisamos de mais contexto para confirmar o problema na questão. Se houver prova complementar, ela pode ser anexada a este caso.',
        action: 'resolved',
        userResponse: buildUserResponse(targetLabel, 'Registramos a necessidade de revisão manual porque o apontamento exige validação complementar.'),
        internalNote: 'Encaminhar para revisão editorial manual com evidências complementares.',
        resultPreview: 'O caso será marcado como resolvido no atendimento, com observação interna de revisão manual.',
      }),
    ];

    if (isDetailedRequest) return [templates[1], templates[0], ...templates.slice(2)];
    if (isTeacherRequest) return [templates[0], templates[1], ...templates.slice(2)];
    if (isIncorrect || isFormatting) return [templates[2], templates[3], templates[4], templates[0], templates[1]];
    return templates;
  }

  if (report.targetType === 'material') {
    return [
      buildTemplate({
        id: 'material_hidden',
        label: 'Material ocultado',
        message: 'O material foi removido temporariamente da vitrine enquanto a equipe conclui a revisão do conteúdo denunciado.',
        action: 'resolved',
        targetAction: 'material_hidden',
        helper: 'Oculta o material da vitrine pública.',
        userResponse: buildUserResponse(targetLabel, 'O material foi ocultado temporariamente enquanto a equipe revisa o conteúdo.'),
        internalNote: 'Ação real: ocultar material da vitrine pública.',
        resultPreview: 'O material será retirado da vitrine pública ao concluir a moderação.',
      }),
      buildTemplate({
        id: 'material_approved',
        label: 'Material mantido',
        message: 'O material foi revisado pela moderação e permanece ativo porque não encontramos violação confirmada nas evidências atuais.',
        action: 'ignored',
        targetAction: 'material_approved',
        helper: 'Mantém o material aprovado/publicado.',
        userResponse: buildUserResponse(targetLabel, 'Após revisão, não encontramos violação confirmada e o material foi mantido.'),
        internalNote: 'Ação real: manter material aprovado/publicado.',
        resultPreview: 'O material permanecerá aprovado e visível conforme status atual.',
      }),
      buildTemplate({
        id: 'material_blocked',
        label: 'Ajuste solicitado',
        message: 'A moderação contatou o autor e solicitou adequações no material para corrigir o ponto denunciado antes de uma nova liberação.',
        action: 'resolved',
        targetAction: 'material_blocked',
        helper: 'Bloqueia o material e registra orientação para correção.',
        userResponse: buildUserResponse(targetLabel, 'Solicitamos ajustes ao autor antes de liberar novamente o material.'),
        internalNote: 'Ação real: bloquear/rejeitar material com orientação de correção.',
        resultPreview: 'O material será bloqueado e a orientação ficará registrada para o autor.',
      }),
    ];
  }

  if (report.targetType === 'law_section') {
    const templates = [
      buildTemplate({
        id: 'law_teacher_comment',
        label: 'Gerar comentário',
        message: 'A solicitação foi aceita. A equipe vai complementar este item da Lei Comentada com comentário do professor.',
        action: 'resolved',
        targetAction: 'law_teacher_comment',
        helper: 'Registra o pedido editorial aceito para tratamento no item da Lei Comentada.',
        userResponse: buildUserResponse(targetLabel, 'Geramos um comentário do professor para complementar o item indicado.'),
        internalNote: 'Ação real: gerar e salvar comentário do professor no item da Lei Comentada.',
        resultPreview: 'O comentário será gerado pela IA e salvo no item vinculado da Lei Comentada ao concluir a moderação.',
      }),
      buildTemplate({
        id: 'law_error_fixed',
        label: 'Erro corrigido',
        message: 'Obrigado pela denúncia. O item da Lei Comentada foi revisado pela moderação e o conteúdo foi ajustado conforme o problema identificado.',
        action: 'resolved',
        userResponse: buildUserResponse(targetLabel, 'O item da Lei Comentada foi revisado e a correção ficou registrada pela equipe.'),
        internalNote: 'Correção/revisão manual registrada para o item da Lei Comentada.',
        resultPreview: isFormatting
          ? 'Revise a formatação no editor da Lei Comentada e registre aqui o ajuste aplicado.'
          : 'Registre no campo interno qual texto legal, comentário, doutrina, jurisprudência ou súmula foi corrigido.',
        contentAfter: currentContent,
      }),
      buildTemplate({
        id: 'law_content_kept',
        label: 'Conteúdo mantido',
        message: 'O item da Lei Comentada foi revisado pela equipe e, no momento, o conteúdo foi mantido porque a denúncia não apontou erro material confirmado.',
        action: 'ignored',
        userResponse: buildUserResponse(targetLabel, 'Após revisão, não identificamos erro material confirmado e o conteúdo foi mantido.'),
        internalNote: 'Denúncia ignorada após revisão do item da Lei Comentada.',
        resultPreview: 'Nenhuma alteração será aplicada ao item; a denúncia será encerrada como ignorada.',
      }),
    ];

    if (isTeacherRequest || isDetailedRequest) return [templates[0], templates[1], templates[2]];
    return [templates[1], templates[0], templates[2]];
  }

  const commentTemplates = [
    buildTemplate({
      id: 'comment_trash',
      label: 'Comentário removido',
      message: 'O comentário denunciado foi analisado pela moderação e a equipe aplicou a medida cabível para preservar as diretrizes da comunidade.',
      action: 'resolved',
      targetAction: 'comment_trash',
      helper: 'Move o comentário para a lixeira.',
      userResponse: buildUserResponse(targetLabel, 'O comentário denunciado foi removido por violar as diretrizes da comunidade.'),
      internalNote: 'Ação real: mover comentário para a lixeira.',
      resultPreview: 'O comentário será movido para a lixeira e deixará de aparecer publicamente.',
    }),
    buildTemplate({
      id: 'comment_spam',
      label: 'Mover para spam',
      message: 'O comentário denunciado foi classificado como spam/publicidade e retirado da discussão pública.',
      action: 'resolved',
      targetAction: 'comment_spam',
      helper: 'Marca o comentário como spam.',
      userResponse: buildUserResponse(targetLabel, 'O comentário denunciado foi classificado como spam/publicidade e retirado da discussão pública.'),
      internalNote: 'Ação real: marcar comentário como spam.',
      resultPreview: 'O comentário será marcado como spam e removido da discussão pública.',
    }),
    buildTemplate({
      id: 'comment_approved',
      label: 'Comentário mantido',
      message: 'O comentário denunciado foi revisado pela moderação e não identificamos violação confirmada nas diretrizes da comunidade.',
      action: 'ignored',
      targetAction: 'comment_approved',
      helper: 'Mantém o comentário aprovado.',
      userResponse: buildUserResponse(targetLabel, 'Após revisão, não identificamos violação confirmada e o comentário foi mantido.'),
      internalNote: 'Ação real: manter comentário aprovado.',
      resultPreview: 'O comentário permanecerá aprovado e visível na discussão.',
    }),
    buildTemplate({
      id: 'comment_pending',
      label: 'Comentário em revisão',
      message: 'A denúncia sobre o comentário foi recebida e está em revisão. Se necessário, a equipe poderá solicitar contexto adicional para concluir a análise.',
      action: 'resolved',
      targetAction: 'comment_pending',
      helper: 'Deixa o comentário pendente para revisão posterior.',
      userResponse: buildUserResponse(targetLabel, 'O comentário foi encaminhado para revisão editorial complementar.'),
      internalNote: 'Ação real: marcar comentário como pendente para revisão posterior.',
      resultPreview: 'O comentário ficará pendente e aguardará nova decisão editorial.',
    }),
  ];

  if (isSpam) return [commentTemplates[1], commentTemplates[0], commentTemplates[2], commentTemplates[3]];
  if (isIncorrect || isTeacherRequest) return [commentTemplates[3], commentTemplates[2], commentTemplates[0]];
  return commentTemplates;
};

export const getQuickReportResolutionReason = (report: ErrorReport) => {
  if (report.targetType === 'question') {
    return 'A denúncia da questão foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
  }

  if (report.targetType === 'material') {
    return 'A denúncia do material foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
  }

  if (report.targetType === 'law_section') {
    return 'A denúncia da Lei Comentada foi analisada pelo dashboard administrativo e recebeu tratamento da moderação.';
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

      const normalizedReason = String(report.reason || 'sem motivo')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      const key = `${report.targetType}-${targetId}-${normalizedReason}`;
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
