'use client';

import dynamic from 'next/dynamic';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const AdminSectionLoading = () => <RouteContentSkeleton variant="admin" />;

export const AdminDatabaseManager = dynamic(() => import('./database/AdminDatabaseManager'), { loading: AdminSectionLoading });
export const AdminFinanceSection = dynamic(() => import('./finance/AdminFinance'), { loading: AdminSectionLoading });
export const AdminMarketingSection = dynamic(() => import('./marketing/AdminMarketingSection'), { loading: AdminSectionLoading });
export const AdminPanelSection = dynamic(() => import('./panel/AdminPanelSection'), { loading: AdminSectionLoading });
export const AdminSettingsSection = dynamic(() => import('./settings/AdminSettings'), { loading: AdminSectionLoading });
export const AdminSupportSection = dynamic(() => import('./support/AdminSupportSection'), { loading: AdminSectionLoading });
