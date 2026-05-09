import { adminService } from '@services/admin/adminService';
import { rankingsService } from '@services/rankings';
import type { ErrorReport, Ranking, UserProfile } from '@types';

export const buildAdminUsersQueryKey = () => ['admin-users'] as const;
export const buildAdminReportsQueryKey = () => ['admin-reports'] as const;
export const buildRankingsListQueryKey = () => ['rankings-list'] as const;

export const fetchAdminUsersList = async (): Promise<UserProfile[]> => {
  const users = await adminService.getUsers();
  return Array.isArray(users) ? users : [];
};

export const fetchAdminReportsList = async (): Promise<ErrorReport[]> => {
  const reports = await adminService.getReports();
  return Array.isArray(reports) ? reports : [];
};

export const fetchRankingsList = async (): Promise<Ranking[]> => {
  const rankings = await rankingsService.list();
  return Array.isArray(rankings) ? rankings : [];
};

