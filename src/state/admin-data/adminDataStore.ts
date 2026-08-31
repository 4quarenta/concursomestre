'use client';

import { create } from 'zustand';
import type { ErrorReport, Ranking, RankingEntry, UserProfile } from '@types';

const REPORT_RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1000;

const sanitizeRankingsCollection = (payload: unknown): Ranking[] => (
  Array.isArray(payload) ? payload as Ranking[] : []
);

interface AdminDataState {
  users: UserProfile[];
  reports: ErrorReport[];
  rankings: Ranking[];
  isUsersLoaded: boolean;
  isReportsLoaded: boolean;
  isRankingsLoaded: boolean;
  replaceUsers: (users: UserProfile[]) => void;
  replaceReports: (reports: ErrorReport[]) => void;
  replaceRankings: (rankings: Ranking[]) => void;
  updateUserStatus: (userId: string, updates: Partial<UserProfile>) => void;
  addReport: (report: ErrorReport) => void;
  resolveReport: (id: string, action: 'resolved' | 'ignored', resolvedAt?: number) => void;
  cleanupOldReports: (now?: number) => void;
  prependRanking: (ranking: Ranking) => void;
  upsertRanking: (ranking: Ranking) => void;
  removeRanking: (rankingId: string) => void;
  appendRankingEntry: (rankingId: string, entry: RankingEntry) => void;
  moderateRanking: (rankingId: string, status: 'approved' | 'rejected') => void;
  resetAdminData: () => void;
}

export const useAdminDataStore = create<AdminDataState>((set) => ({
  users: [],
  reports: [],
  rankings: [],
  isUsersLoaded: false,
  isReportsLoaded: false,
  isRankingsLoaded: false,
  replaceUsers: (users) => set({
    users,
    isUsersLoaded: true,
  }),
  replaceReports: (reports) => set({
    reports,
    isReportsLoaded: true,
  }),
  replaceRankings: (rankings) => set({
    rankings: sanitizeRankingsCollection(rankings),
    isRankingsLoaded: true,
  }),
  updateUserStatus: (userId, updates) => set((state) => ({
    users: state.users.map((user) => (
      user.id === userId ? { ...user, ...updates } : user
    )),
  })),
  addReport: (report) => set((state) => ({
    reports: [report, ...state.reports],
  })),
  resolveReport: (id, action, resolvedAt = Date.now()) => set((state) => ({
    reports: state.reports.map((report) => (
      report.id === id ? { ...report, status: action, resolvedAt } : report
    )),
  })),
  cleanupOldReports: (now = Date.now()) => set((state) => ({
    reports: state.reports.filter((report) => {
      if (report.status === 'pending') {
        return true;
      }

      if (report.resolvedAt && now - report.resolvedAt > REPORT_RETENTION_PERIOD) {
        return false;
      }

      if (!report.resolvedAt && now - report.timestamp > REPORT_RETENTION_PERIOD) {
        return false;
      }

      return true;
    }),
  })),
  prependRanking: (ranking) => set((state) => ({
    rankings: [ranking, ...state.rankings],
  })),
  upsertRanking: (ranking) => set((state) => ({
    rankings: state.rankings.some((item) => item.id === ranking.id)
      ? state.rankings.map((item) => (item.id === ranking.id ? ranking : item))
      : [ranking, ...state.rankings],
  })),
  removeRanking: (rankingId) => set((state) => ({
    rankings: state.rankings.filter((ranking) => ranking.id !== rankingId),
  })),
  appendRankingEntry: (rankingId, entry) => set((state) => ({
    rankings: state.rankings.map((ranking) => (
      ranking.id === rankingId
        ? { ...ranking, entries: [...ranking.entries, entry] }
        : ranking
    )),
  })),
  moderateRanking: (rankingId, status) => set((state) => ({
    rankings: state.rankings.map((ranking) => (
      ranking.id === rankingId ? { ...ranking, status } : ranking
    )),
  })),
  resetAdminData: () => set({
    users: [],
    reports: [],
    rankings: [],
    isUsersLoaded: false,
    isReportsLoaded: false,
    isRankingsLoaded: false,
  }),
}));

export default useAdminDataStore;
