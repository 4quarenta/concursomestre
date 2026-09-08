import React from 'react';

export interface RetentionOfferDraft {
  offeredDays: string;
  expiresAt: string;
  userNote: string;
  internalNote: string;
}

export const EMPTY_RETENTION_OFFER_DRAFT: RetentionOfferDraft = {
  offeredDays: '',
  expiresAt: '',
  userNote: '',
  internalNote: '',
};

export const isRetentionOfferDraftValid = (draft: RetentionOfferDraft): boolean => {
  const offeredDays = Number(draft.offeredDays);
  return Number.isInteger(offeredDays)
    && offeredDays >= 1
    && offeredDays <= 366
    && Boolean(draft.expiresAt);
};

export const serializeRetentionOfferDraft = (draft: RetentionOfferDraft) => ({
  offeredDays: Number(draft.offeredDays),
  expiresAt: new Date(draft.expiresAt).toISOString(),
  userNote: draft.userNote,
  internalNote: draft.internalNote,
});

interface RefundRetentionOfferFieldsProps {
  draft: RetentionOfferDraft;
  onChange: (draft: RetentionOfferDraft) => void;
}

export const RefundRetentionOfferFields = ({ draft, onChange }: RefundRetentionOfferFieldsProps) => {
  const update = (field: keyof RetentionOfferDraft, value: string) => onChange({ ...draft, [field]: value });
  return (
    <div className="space-y-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
        Dias gratuitos oferecidos
        <input type="number" min={1} max={366} value={draft.offeredDays} onChange={(event) => update('offeredDays', event.target.value)} className="mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" placeholder="Informe N" required />
      </label>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
        Oferta válida até
        <input type="datetime-local" value={draft.expiresAt} onChange={(event) => update('expiresAt', event.target.value)} className="mt-1 h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" required />
      </label>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
        Nota para o usuário (opcional)
        <textarea value={draft.userNote} onChange={(event) => update('userNote', event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
      </label>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
        Nota interna (opcional)
        <textarea value={draft.internalNote} onChange={(event) => update('internalNote', event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
      </label>
    </div>
  );
};

export default RefundRetentionOfferFields;
