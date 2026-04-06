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
import { ShieldAlert } from 'lucide-react';
import type { Material } from '@types';

interface BlockedMaterialsSectionProps {
  materials: Material[];
  onReanalyze: (material: Material) => void;
}

const BlockedMaterialsSection = ({
  materials,
  onReanalyze,
}: BlockedMaterialsSectionProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10 flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-widest">
        <ShieldAlert size={16} /> Materiais Bloqueados / Rejeitados
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="p-4">Material</th>
            <th className="p-4">Autor</th>
            <th className="p-4">Motivo do Bloqueio</th>
            <th className="p-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {materials.map((material) => (
            <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{material.title}</td>
              <td className="p-4 text-slate-500 dark:text-slate-400">{material.authorName}</td>
              <td className="p-4 text-red-600/80 dark:text-red-400/80 italic max-w-md truncate">
                {material.rejectionReason || 'Sem motivo registrado'}
              </td>
              <td className="p-4 text-center">
                <button
                  type="button"
                  onClick={() => onReanalyze(material)}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold uppercase text-[10px] transition-colors"
                >
                  Reanalisar
                </button>
              </td>
            </tr>
          ))}
          {materials.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-slate-400">
                Nenhum material bloqueado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default BlockedMaterialsSection;
