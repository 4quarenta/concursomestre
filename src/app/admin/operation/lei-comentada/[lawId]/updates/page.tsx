'use client';

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

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { ADMIN_SURFACE_CLASS } from '../../../../components/shared/adminPanelStyles';
import { buildAdminLawEditPath } from '../../../../config/adminPageNavigationConfig';

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const AdminLegalCommentaryUpdatesPage = () => {
  const params = useParams<{ lawId?: string | string[] }>();
  const router = useRouter();
  const lawId = normalizeParam(params.lawId);

  React.useEffect(() => {
    if (!lawId) {
      router.replace('/admin/operation/lei-comentada');
      return;
    }

    router.replace(`${buildAdminLawEditPath(lawId)}?updates=1`);
  }, [lawId, router]);

  return (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="lei-comentada"
      pageTitle="Lei Comentada"
      showPageHeader={false}
    >
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[260px] items-center justify-center p-8 text-sm font-medium text-slate-500 dark:text-slate-400`}>
        <Loader2 className="mr-2 animate-spin" size={16} />
        Abrindo o historico de atualizacoes...
      </div>
    </AdminStandaloneShell>
  );
};

export default AdminLegalCommentaryUpdatesPage;
