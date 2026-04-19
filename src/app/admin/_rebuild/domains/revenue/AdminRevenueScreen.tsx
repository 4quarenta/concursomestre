'use client';

import React from 'react';
import { useData } from '@providers/DataProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { AdminDataPanel, AdminStatusPill } from '../../design-system';
import AdminShellFrame from '../../shell/AdminShellFrame';
import AdminRevenueBlueprint from './AdminRevenueBlueprint';

export default function AdminRevenueScreen() {
  const {
    users,
    ensureUsersLoaded,
    isUsersLoaded,
  } = useData();
  const {
    transactions,
    isLoadingTransactions,
  } = useMarketplace();

  React.useEffect(() => {
    void ensureUsersLoaded();
  }, [ensureUsersLoaded]);

  return (
    <AdminShellFrame activeDomain="revenue">
      <div className="space-y-6">
        <AdminRevenueBlueprint transactions={transactions} users={users} />

        <AdminDataPanel
          title="Fontes financeiras conectadas"
          description="Esta tela usa a mesma fronteira de dados que o admin atual, mas entrega para o modelo novo de Revenue."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!isLoadingTransactions ? 'healthy' : 'medium'} label={!isLoadingTransactions ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Transacoes</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{transactions.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isUsersLoaded ? 'healthy' : 'medium'} label={isUsersLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Usuarios</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{users.length} registro(s)</p>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </AdminShellFrame>
  );
}
