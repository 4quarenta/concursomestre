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

'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { adminService, type AdminLaunchMode, type AdminLaunchModeStatus } from '@services/admin/adminService';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

const MODES: AdminLaunchMode[] = ['PRELAUNCH', 'GO_CANDIDATE', 'PRODUCTION'];
const fallbackStatus: AdminLaunchModeStatus = {
  runtimeEnvironment: 'unknown',
  actualLaunchMode: 'PRELAUNCH',
  publicIndexingState: 'NOINDEX',
  technicalReadiness: 'NOT_READY',
  releaseRecommendation: 'NO_GO_RECOMMENDED',
  ownerProductionDecision: 'NOT_MADE_BY_CODEX',
};

interface Props {
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function AdminLaunchModeControl({ addToast }: Props) {
  const [status, setStatus] = useState<AdminLaunchModeStatus>(fallbackStatus);
  const [selectedMode, setSelectedMode] = useState<AdminLaunchMode>('PRELAUNCH');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    adminService.getLaunchModeStatus()
      .then((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        setSelectedMode(nextStatus.actualLaunchMode);
      })
      .catch(() => addToast('Não foi possível carregar o launch mode.', 'error'))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [addToast]);

  const requestChange = () => {
    if (selectedMode === status.actualLaunchMode) {
      addToast('Selecione um launch mode diferente do atual.', 'warning');
      return;
    }
    setIsConfirmOpen(true);
  };

  const confirmChange = async () => {
    setIsSaving(true);
    try {
      const nextStatus = await adminService.updateLaunchMode(
        selectedMode,
        `CHANGE LAUNCH MODE TO ${selectedMode}`,
        reason.trim(),
      );
      setStatus(nextStatus);
      setReason('');
      setIsConfirmOpen(false);
      addToast('Launch mode atualizado com trilha de auditoria.', 'success');
    } catch {
      addToast('Não foi possível atualizar o launch mode.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`} aria-labelledby="admin-launch-mode-title">
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 md:flex-row md:items-start md:justify-between`}>
          <div>
            <h3 id="admin-launch-mode-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-300" />
              Controle de lançamento
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">O ambiente e o lançamento público são estados diferentes.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={15} /> Fonte canônica ativa
          </div>
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          <div className={`space-y-2 ${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado atual</p>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">{isLoading ? 'Carregando...' : status.actualLaunchMode}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Runtime: {status.runtimeEnvironment} · Indexação: {status.publicIndexingState}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Readiness: {status.technicalReadiness} · Recomendação: {status.releaseRecommendation} · Decisão: {status.ownerProductionDecision}</p>
          </div>
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400" htmlFor="admin-launch-mode-select">Alterar modo</label>
            <select id="admin-launch-mode-select" value={selectedMode} onChange={(event) => setSelectedMode(event.target.value as AdminLaunchMode)} className={`w-full ${ADMIN_FIELD_CLASS}`} disabled={isLoading || isSaving}>
              {MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} className={`w-full ${ADMIN_FIELD_CLASS}`} placeholder="Motivo da transição (opcional)" disabled={isLoading || isSaving} />
            <button type="button" onClick={requestChange} disabled={isLoading || isSaving} className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full justify-center`}>
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : null}
              Confirmar transição
            </button>
          </div>
        </div>
      </section>
      <AdminConfirmDialog
        isOpen={isConfirmOpen}
        title={`Alterar para ${selectedMode}?`}
        description={`Digite a confirmação operacional exigida para registrar a transição de ${status.actualLaunchMode} para ${selectedMode}. O modo PRODUCTION pode permitir indexação pública quando os demais gates passarem.`}
        confirmLabel="Confirmar transição"
        tone="primary"
        loading={isSaving}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => void confirmChange()}
      />
    </>
  );
}
