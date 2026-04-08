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
import { Edit3, FileText, Link2, Trash2 } from 'lucide-react';
import type { Prova } from '@types';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface ExamDraftState {
  id: string;
  nome: string;
  ano: string;
  nivel: string;
  index: string;
  bancaSigla: string;
  bancaNome: string;
  orgaoSigla: string;
  orgaoNome: string;
  cargoDescricao: string;
}

interface AdminExamBankSectionProps {
  exams: Prova[];
  totalExams: number;
  linkedCountByExamId: Map<string, number>;
  editingExamId: string | null;
  examDraft: ExamDraftState | null;
  onExamDraftChange: (nextDraft: ExamDraftState | null) => void;
  onStartEdit: (exam: Prova) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  deletingExam: Prova | null;
  onRequestDelete: (exam: Prova) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  actionLoading: 'save' | 'delete' | null;
}

const DraftInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</label>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
  </div>
);

/**
 * Lista e edita o banco de provas da operacao.
 * A secao centraliza os vinculos usados no modal de questoes.
 *
 * @since 1.0.0
 */
const AdminExamBankSection = ({
  exams,
  totalExams,
  linkedCountByExamId,
  editingExamId,
  examDraft,
  onExamDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  deletingExam,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  actionLoading,
}: AdminExamBankSectionProps) => {
  const totalLinkedQuestions = Array.from(linkedCountByExamId.values()).reduce((sum, current) => sum + current, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Banco de provas</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{totalExams}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Questoes vinculadas</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{totalLinkedQuestions}</p>
        </div>
        <div className="rounded-[2rem] border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900/30 dark:bg-indigo-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Uso principal</p>
          <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Vinculo rapido no editar questao</p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">A busca de prova usa este mesmo cadastro.</p>
        </div>
      </div>

      {examDraft ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Editar prova</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">Atualize os metadados do banco de provas</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
                disabled={actionLoading === 'save'}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
              >
                {actionLoading === 'save' ? 'Salvando...' : 'Salvar prova'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DraftInput label="ID" value={examDraft.id} onChange={(value) => onExamDraftChange({ ...examDraft, id: value })} placeholder="54321" />
            <DraftInput label="Nome" value={examDraft.nome} onChange={(value) => onExamDraftChange({ ...examDraft, nome: value })} placeholder="Nome da prova" />
            <DraftInput label="Ano" value={examDraft.ano} onChange={(value) => onExamDraftChange({ ...examDraft, ano: value })} placeholder="2025" />
            <DraftInput label="Nivel" value={examDraft.nivel} onChange={(value) => onExamDraftChange({ ...examDraft, nivel: value })} placeholder="Superior" />
            <DraftInput label="Indice" value={examDraft.index} onChange={(value) => onExamDraftChange({ ...examDraft, index: value })} placeholder="TJSP-2025-01" />
            <DraftInput label="Banca sigla" value={examDraft.bancaSigla} onChange={(value) => onExamDraftChange({ ...examDraft, bancaSigla: value })} placeholder="FGV" />
            <DraftInput label="Banca nome" value={examDraft.bancaNome} onChange={(value) => onExamDraftChange({ ...examDraft, bancaNome: value })} placeholder="Fundacao Getulio Vargas" />
            <DraftInput label="Orgao sigla" value={examDraft.orgaoSigla} onChange={(value) => onExamDraftChange({ ...examDraft, orgaoSigla: value })} placeholder="TJ-SP" />
            <DraftInput label="Orgao nome" value={examDraft.orgaoNome} onChange={(value) => onExamDraftChange({ ...examDraft, orgaoNome: value })} placeholder="Tribunal de Justica de Sao Paulo" />
            <div className="md:col-span-2 xl:col-span-3">
              <DraftInput label="Cargo" value={examDraft.cargoDescricao} onChange={(value) => onExamDraftChange({ ...examDraft, cargoDescricao: value })} placeholder="Analista Judiciario" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-sm font-black text-slate-900 dark:text-slate-100">Lista de provas cadastradas</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Use editar para ajustar o cadastro e deletar para remover o vinculo do banco global.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Prova</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Banca</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Orgao</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Cargo</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vinculos</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {exams.map((exam) => (
                <tr key={exam.id} className={editingExamId === String(exam.id) ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : ''}>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{exam.nome}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        #{exam.id} {exam.ano ? `- ${exam.ano}` : ''} {exam.nivel ? `- ${exam.nivel}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.banca?.sigla || exam.banca?.nome || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.orgao?.sigla || exam.orgao?.nome || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{exam.cargo?.descricao || exam.cargo?.['descrição'] || '-'}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <Link2 size={12} />
                      {linkedCountByExamId.get(String(exam.id)) || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onStartEdit(exam)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300"
                      >
                        <Edit3 size={12} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestDelete(exam)}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-600 transition-all hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                      >
                        <Trash2 size={12} />
                        Deletar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                      <FileText size={20} />
                      <p className="text-sm font-black">Nenhuma prova encontrada</p>
                      <p className="text-xs font-medium">As provas vinculadas nas questoes passarao a aparecer aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={Boolean(deletingExam)}
        title="Remover prova do banco"
        description={`A prova "${deletingExam?.nome || ''}" sera removida do cadastro global e o vinculo sera limpo das questoes que usam este ID.`}
        confirmLabel="Remover prova"
        loading={actionLoading === 'delete'}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </div>
  );
};

export default AdminExamBankSection;
