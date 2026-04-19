'use client';

import React from 'react';
import { useData } from '@providers/DataProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { seoService, type SitemapStatusPayload } from '@services/seo';
import { AdminDataPanel, AdminStatusPill } from '../../design-system';
import AdminShellFrame from '../../shell/AdminShellFrame';
import AdminOverviewBlueprint from './AdminOverviewBlueprint';

const calculateSitemapCoveragePercent = (payload: SitemapStatusPayload | null): number | null => {
  if (!payload) {
    return null;
  }

  const dynamicTotal = payload.coverage.questions.total
    + payload.coverage.rankings.total
    + payload.coverage.materials.total;
  const dynamicIndexed = payload.coverage.questions.indexed
    + payload.coverage.rankings.indexed
    + payload.coverage.materials.indexed;

  if (dynamicTotal <= 0) {
    return payload.coverage.institutional.total > 0 ? 100 : null;
  }

  return Math.round((dynamicIndexed / dynamicTotal) * 100);
};

export default function AdminOverviewScreen() {
  const {
    reports,
    systemSettings,
    ensureReportsLoaded,
    isReportsLoaded,
    isSystemSettingsLoaded,
  } = useData();
  const {
    materials,
    transactions,
    isLoadingMaterials,
    isLoadingTransactions,
  } = useMarketplace();
  const [sitemapStatus, setSitemapStatus] = React.useState<SitemapStatusPayload | null>(null);
  const [isLoadingSitemap, setIsLoadingSitemap] = React.useState(true);

  React.useEffect(() => {
    void ensureReportsLoaded();
  }, [ensureReportsLoaded]);

  React.useEffect(() => {
    let isMounted = true;

    seoService.getSitemapStatus()
      .then((payload) => {
        if (isMounted) {
          setSitemapStatus(payload);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSitemap(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const sitemapCoveragePercent = React.useMemo(
    () => calculateSitemapCoveragePercent(sitemapStatus),
    [sitemapStatus],
  );
  const isLoadingOperationalData = !isReportsLoaded
    || !isSystemSettingsLoaded
    || isLoadingMaterials
    || isLoadingTransactions
    || isLoadingSitemap;

  return (
    <AdminShellFrame activeDomain="overview">
      <div className="space-y-6">
        <AdminOverviewBlueprint
          transactions={transactions}
          reports={reports}
          materials={materials}
          systemSettings={systemSettings}
          sitemapCoveragePercent={sitemapCoveragePercent}
        />

        <AdminDataPanel
          title="Fontes conectadas"
          description="Esta tela ja le os providers atuais na fronteira da nova arquitetura, sem reaproveitar a UI antiga."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isReportsLoaded ? 'healthy' : 'medium'} label={isReportsLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Denuncias</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{reports.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!isLoadingTransactions ? 'healthy' : 'medium'} label={!isLoadingTransactions ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Transacoes</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{transactions.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!isLoadingMaterials ? 'healthy' : 'medium'} label={!isLoadingMaterials ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Materiais</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{materials.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!isLoadingOperationalData ? 'healthy' : 'medium'} label={!isLoadingOperationalData ? 'Pronto' : 'Sincronizando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">SEO</p>
              <p className="mt-1 text-sm text-[#5f6f68]">
                {sitemapCoveragePercent === null ? 'sem prova local' : `${sitemapCoveragePercent}% dinamico`}
              </p>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </AdminShellFrame>
  );
}
