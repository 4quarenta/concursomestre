'use client';

import React from 'react';
import { useData } from '@providers/DataProvider';
import { adminService, type AdminFeedbackThread } from '@services/admin/adminService';
import { AdminDataPanel, AdminStatusPill } from '../../design-system';
import AdminShellFrame from '../../shell/AdminShellFrame';
import AdminSupportBlueprint from './AdminSupportBlueprint';

export default function AdminSupportScreen() {
  const {
    reports,
    ensureReportsLoaded,
    isReportsLoaded,
  } = useData();
  const [feedbackThreads, setFeedbackThreads] = React.useState<AdminFeedbackThread[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = React.useState(true);
  const [feedbackLoadFailed, setFeedbackLoadFailed] = React.useState(false);

  React.useEffect(() => {
    void ensureReportsLoaded();
  }, [ensureReportsLoaded]);

  React.useEffect(() => {
    let isMounted = true;

    adminService.getFeedbackThreads()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setFeedbackThreads(items);
        setFeedbackLoadFailed(false);
      })
      .catch(() => {
        if (isMounted) {
          setFeedbackThreads([]);
          setFeedbackLoadFailed(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingFeedback(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AdminShellFrame activeDomain="support">
      <div className="space-y-6">
        <AdminSupportBlueprint
          reports={reports}
          feedbackThreads={feedbackThreads}
        />

        <AdminDataPanel
          title="Fontes de suporte conectadas"
          description="Denuncias seguem pelo provider atual; feedbacks e threads usam o servico oficial de admin."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={isReportsLoaded ? 'healthy' : 'medium'} label={isReportsLoaded ? 'Carregado' : 'Carregando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Denuncias</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{reports.length} registro(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill
                severity={feedbackLoadFailed ? 'high' : isLoadingFeedback ? 'medium' : 'healthy'}
                label={feedbackLoadFailed ? 'Falhou' : isLoadingFeedback ? 'Carregando' : 'Carregado'}
              />
              <p className="mt-2 text-sm font-black text-[#16211d]">Feedbacks</p>
              <p className="mt-1 text-sm text-[#5f6f68]">{feedbackThreads.length} thread(s)</p>
            </div>
            <div className="rounded-lg border border-[#d8e2dc] bg-[#f8faf9] p-3">
              <AdminStatusPill severity={!feedbackLoadFailed && isReportsLoaded ? 'healthy' : 'medium'} label={!feedbackLoadFailed && isReportsLoaded ? 'Pronto' : 'Sincronizando'} />
              <p className="mt-2 text-sm font-black text-[#16211d]">Fila unica</p>
              <p className="mt-1 text-sm text-[#5f6f68]">denuncia + feedback + thread</p>
            </div>
          </div>
        </AdminDataPanel>
      </div>
    </AdminShellFrame>
  );
}
