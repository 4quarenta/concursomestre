'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ErrorReport, Ranking, RankingEntry, UserProfile } from '@types';
import { useToast } from '@providers/ToastProvider';
import { adminService } from '@services/admin/adminService';
import { rankingsService } from '@services/rankings';
import { clientLog } from '@services/monitoring/clientLog';
import {
  buildAdminReportsQueryKey,
  buildAdminUsersQueryKey,
  buildRankingsListQueryKey,
  fetchAdminReportsList,
  fetchAdminUsersList,
  fetchRankingsList,
} from './adminDataQuery';
import { useAdminDataStore } from './adminDataStore';

type RankingModerationStatus = 'approved' | 'rejected';

const patchRankingEntries = (ranking: Ranking, nextEntry: RankingEntry): Ranking => {
  const hasExistingById = ranking.entries.some((entry) => String(entry.id) === String(nextEntry.id));
  const hasExistingByUserId = nextEntry.userId
    ? ranking.entries.some((entry) => String(entry.userId || '') === String(nextEntry.userId || ''))
    : false;

  if (!hasExistingById && !hasExistingByUserId) {
    return {
      ...ranking,
      entries: [...ranking.entries, nextEntry],
    };
  }

  return {
    ...ranking,
    entries: ranking.entries.map((entry) => {
      const sameId = String(entry.id) === String(nextEntry.id);
      const sameUser = nextEntry.userId && String(entry.userId || '') === String(nextEntry.userId || '');
      return sameId || sameUser ? nextEntry : entry;
    }),
  };
};

/**
 * Admin data actions backed by Zustand + TanStack Query.
 * This keeps ranking, user and report domains coordinated through one admin store.
 *
 * @since 1.0.0
 */
export const useAdminDataActions = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const users = useAdminDataStore((store) => store.users);
  const reports = useAdminDataStore((store) => store.reports);
  const rankings = useAdminDataStore((store) => store.rankings);
  const isUsersLoaded = useAdminDataStore((store) => store.isUsersLoaded);
  const isReportsLoaded = useAdminDataStore((store) => store.isReportsLoaded);
  const isRankingsLoaded = useAdminDataStore((store) => store.isRankingsLoaded);

  const replaceUsers = useAdminDataStore((store) => store.replaceUsers);
  const replaceReports = useAdminDataStore((store) => store.replaceReports);
  const replaceRankings = useAdminDataStore((store) => store.replaceRankings);
  const patchUserStatus = useAdminDataStore((store) => store.updateUserStatus);
  const resolveLocalReport = useAdminDataStore((store) => store.resolveReport);
  const prependRanking = useAdminDataStore((store) => store.prependRanking);
  const upsertRanking = useAdminDataStore((store) => store.upsertRanking);
  const removeRankingFromStore = useAdminDataStore((store) => store.removeRanking);
  const moderateRankingInStore = useAdminDataStore((store) => store.moderateRanking);

  const patchAdminUsersCache = useCallback(
    (updater: (current: UserProfile[]) => UserProfile[]) => {
      queryClient.setQueryData(buildAdminUsersQueryKey(), (current?: UserProfile[]) => (
        updater(Array.isArray(current) ? current : [])
      ));
    },
    [queryClient],
  );

  const patchRankingsCache = useCallback(
    (updater: (current: Ranking[]) => Ranking[]) => {
      queryClient.setQueryData(buildRankingsListQueryKey(), (current?: Ranking[]) => (
        updater(Array.isArray(current) ? current : [])
      ));
    },
    [queryClient],
  );

  const patchAdminReportsCache = useCallback(
    (updater: (current: ErrorReport[]) => ErrorReport[]) => {
      queryClient.setQueryData(buildAdminReportsQueryKey(), (current?: ErrorReport[]) => (
        updater(Array.isArray(current) ? current : [])
      ));
    },
    [queryClient],
  );

  const ensureUsersLoaded = useCallback(async (force = false) => {
    if (isUsersLoaded && !force) return;
    try {
      const nextUsers = await queryClient.fetchQuery({
        queryKey: buildAdminUsersQueryKey(),
        queryFn: fetchAdminUsersList,
        staleTime: force ? 0 : 60_000,
      });
      replaceUsers(nextUsers);
    } catch (error) {
      clientLog.warn('Failed to load users:', error);
    }
  }, [isUsersLoaded, queryClient, replaceUsers]);

  const ensureReportsLoaded = useCallback(async (force = false) => {
    if (isReportsLoaded && !force) return;
    try {
      const nextReports = await queryClient.fetchQuery({
        queryKey: buildAdminReportsQueryKey(),
        queryFn: fetchAdminReportsList,
        staleTime: force ? 0 : 60_000,
      });
      replaceReports(nextReports);
    } catch (error) {
      clientLog.warn('Failed to load reports:', error);
    }
  }, [isReportsLoaded, queryClient, replaceReports]);

  const resolveReport = useCallback(async (
    reportId: string,
    action: 'resolved' | 'ignored',
    adminReason: string,
    evidenceUrl?: string,
  ) => {
    if (!adminReason || adminReason.trim() === '') {
      addToast('A justificativa da decisao e obrigatoria.', 'warning');
      return;
    }

    try {
      await adminService.moderateReport(reportId, action, adminReason, evidenceUrl);
      const resolvedAt = Date.now();
      resolveLocalReport(reportId, action, resolvedAt);
      patchAdminReportsCache((current) => current.map((report) => (
        String(report.id) === String(reportId)
          ? { ...report, status: action, resolvedAt }
          : report
      )));
      addToast(`Denuncia ${action === 'resolved' ? 'resolvida' : 'ignorada'}.`, 'success');
    } catch (error) {
      clientLog.error('Failed to resolve report:', error);
      addToast('Erro ao atualizar a denuncia.', 'error');
      throw error;
    }
  }, [addToast, patchAdminReportsCache, resolveLocalReport]);

  const ensureRankingsLoaded = useCallback(async (force = false) => {
    if (isRankingsLoaded && !force) return;
    try {
      const nextRankings = await queryClient.fetchQuery({
        queryKey: buildRankingsListQueryKey(),
        queryFn: fetchRankingsList,
        staleTime: force ? 0 : 60_000,
      });
      replaceRankings(nextRankings);
    } catch (error) {
      clientLog.warn('Failed to load rankings:', error);
    }
  }, [isRankingsLoaded, queryClient, replaceRankings]);

  const updateUserStatus = useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await adminService.performUserAction({
        user_id: userId,
        action: 'update_user_status',
        status: updates.status,
        reputation: typeof updates.reputation === 'number' ? updates.reputation : undefined,
      });

      patchUserStatus(userId, updates);
      patchAdminUsersCache((current) => current.map((user) => (
        user.id === userId ? { ...user, ...updates } : user
      )));
      addToast('Dados do usuário atualizados.', 'success');
    } catch (error) {
      clientLog.error('Failed to update user:', error);
      addToast('Erro ao atualizar usuário no servidor.', 'error');
      throw error;
    }
  }, [addToast, patchAdminUsersCache, patchUserStatus]);

  const addRanking = useCallback(async (ranking: Ranking) => {
    prependRanking(ranking);
    patchRankingsCache((current) => [ranking, ...current]);

    try {
      await rankingsService.create(ranking);
      addToast('Ranking criado com sucesso!', 'success');
    } catch (error) {
      clientLog.error('Failed to create ranking:', error);
      removeRankingFromStore(ranking.id);
      patchRankingsCache((current) => current.filter((item) => item.id !== ranking.id));
      addToast('Erro ao criar ranking no servidor.', 'error');
      throw error;
    }
  }, [addToast, patchRankingsCache, prependRanking, removeRankingFromStore]);

  const updateRanking = useCallback(async (ranking: Ranking) => {
    try {
      await rankingsService.update(ranking);
      upsertRanking(ranking);
      patchRankingsCache((current) => current.map((item) => (
        item.id === ranking.id ? ranking : item
      )));
      addToast('Ranking atualizado com sucesso!', 'success');
    } catch (error) {
      clientLog.error('Failed to update ranking:', error);
      addToast('Erro ao atualizar ranking.', 'error');
      throw error;
    }
  }, [addToast, patchRankingsCache, upsertRanking]);

  const deleteRanking = useCallback(async (rankingId: string) => {
    try {
      await rankingsService.remove(rankingId);
      removeRankingFromStore(rankingId);
      patchRankingsCache((current) => current.filter((item) => item.id !== rankingId));
      addToast('Ranking excluído com sucesso!', 'success');
    } catch (error) {
      clientLog.error('Failed to delete ranking:', error);
      addToast('Erro ao excluir ranking.', 'error');
      throw error;
    }
  }, [addToast, patchRankingsCache, removeRankingFromStore]);

  const submitRankingEntry = useCallback(async (rankingId: string, entry: RankingEntry) => {
    const ranking = rankings.find((item) => String(item.id) === String(rankingId));
    if (ranking) {
      const nextRanking = patchRankingEntries(ranking, entry);
      upsertRanking(nextRanking);
      patchRankingsCache((current) => current.map((item) => (
        String(item.id) === String(rankingId) ? patchRankingEntries(item, entry) : item
      )));
    }

    if (!entry.userId) {
      return;
    }

    try {
      await rankingsService.join(rankingId, entry.userId, entry);
      addToast('Gabarito enviado!', 'success');
    } catch (error) {
      clientLog.error('Failed to submit ranking entry:', error);
      addToast('Falha de conexão ao enviar gabarito.', 'error');
      throw error;
    }
  }, [addToast, patchRankingsCache, rankings, upsertRanking]);

  const moderateRanking = useCallback(async (rankingId: string, status: RankingModerationStatus) => {
    try {
      await rankingsService.moderate(rankingId, status);
      moderateRankingInStore(rankingId, status);
      patchRankingsCache((current) => current.map((item) => (
        item.id === rankingId ? { ...item, status } : item
      )));
      addToast(`Ranking ${status === 'approved' ? 'aprovado' : 'rejeitado'}!`, 'success');
    } catch (error) {
      clientLog.error('Failed to moderate ranking:', error);
      addToast('Erro ao moderar ranking.', 'error');
      throw error;
    }
  }, [addToast, moderateRankingInStore, patchRankingsCache]);

  return {
    users,
    reports,
    rankings,
    ensureUsersLoaded,
    ensureReportsLoaded,
    ensureRankingsLoaded,
    resolveReport,
    updateUserStatus,
    addRanking,
    updateRanking,
    deleteRanking,
    submitRankingEntry,
    moderateRanking,
  };
};

export default useAdminDataActions;
