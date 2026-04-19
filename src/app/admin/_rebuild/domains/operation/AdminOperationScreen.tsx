'use client';

import React from 'react';
import { useData } from '@providers/DataProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { AdminDataPanel, AdminStatusPill } from '../../design-system';
import AdminShellFrame from '../../shell/AdminShellFrame';
import AdminOperationBlueprint from './AdminOperationBlueprint';

export default function AdminOperationScreen() {
  const {
    questions,
    totalQuestions,
    users,
    rankings,
    systemSettings,
    isUsersLoaded,
    isRankingsLoaded,
    isTaxonomiesLoaded,
    isSystemSettingsLoaded,
    ensureUsersLoaded,
    ensureRankingsLoaded,
    ensureTaxonomiesLoaded,
  } = useData();
  const {
    materials,
    isLoadingMaterials,
  } = useMarketplace();

  React.useEffect(() => {
    void ensureUsersLoaded();
    void ensureRankingsLoaded();
    void ensureTaxonomiesLoaded();
  }, [ensureRankingsLoaded, ensureTaxonomiesLoaded, ensureUsersLoaded]);

  return (
    <AdminShellFrame activeDomain="operation">
      <div className="space-y-6">
        <AdminOperationBlueprint
          questions={questions}
          totalQuestions={totalQuestions}
          users={users}
          materials={materials}
          rankings={rankings}
          systemSettings={systemSettings}
        />

        <AdminDataPanel
          title="Fontes operacionais conectadas"
          description="Esta tela usa providers atuais apenas na fronteira, mantendo o modelo Operation independente da UI legada."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity="healthy" label="Sessao" />
              <p className="mt-2 text-sm font-black text-[#16211d]">Questoes</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{questions.length} carregada(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isUsersLoaded ? 'healthy' : 'medium'} label={isUsersLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Usuarios</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{users.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!isLoadingMaterials ? 'healthy' : 'medium'} label={!isLoadingMaterials ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Materiais</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{materials.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isRankingsLoaded ? 'healthy' : 'medium'} label={isRankingsLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Rankings</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{rankings.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isTaxonomiesLoaded && isSystemSettingsLoaded ? 'healthy' : 'medium'} label={isTaxonomiesLoaded && isSystemSettingsLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Taxonomias</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{systemSettings.taxonomies?.subjects?.length || 0} materia(s)</p>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </AdminShellFrame>
  );
}
