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
import { Download, Edit3, Trash2 } from 'lucide-react';
import type { Material } from '@types';
import { useToast } from '@providers/ToastProvider';
import { buildMaterialAccessEndpoint, openAuthenticatedFile } from '@services/api';

interface AdminMaterialsSectionProps {
  materials: Material[];
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onModerate: (material: Material) => void;
  onDelete: (materialId: string) => void;
}

const AdminMaterialsSection = ({
  materials,
  renderSortableHeader,
  onModerate,
  onDelete,
}: AdminMaterialsSectionProps) => {
  const { addToast } = useToast();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            {renderSortableHeader('Material', 'title')}
            {renderSortableHeader('Autor/Preco', 'price')}
            {renderSortableHeader('Vendas', 'salesCount')}
            {renderSortableHeader('Status', 'status')}
            <th className="p-4 text-center">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {materials.map((material) => (
            <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{material.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{material.subject}</span>
                </div>
              </td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{material.authorName}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]">
                    R$ {material.price.toFixed(2)}
                  </span>
                </div>
              </td>
              <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{material.salesCount || 0}</td>
              <td className="p-4">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                    material.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : material.status === 'pending'
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}
                >
                  {material.status === 'approved'
                    ? 'Ativo'
                    : material.status === 'pending'
                      ? 'Pendente'
                      : 'Bloqueado'}
                </span>
              </td>
              <td className="p-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onModerate(material)}
                    className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"
                  >
                    <Edit3 size={14} /> Moderar
                  </button>
                  {material.fileUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        void openAuthenticatedFile(buildMaterialAccessEndpoint(material.id)).catch((error: any) => {
                          addToast(error?.message || 'Nao foi possivel abrir a visualizacao do material.', 'error');
                        });
                      }}
                      className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(material.id)}
                    className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {materials.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">
                Nenhum material encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminMaterialsSection;
