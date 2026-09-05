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
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import { AdminButton, AdminDataTable, AdminRowActions } from '../shared/AdminDesignSystem';

interface BlockedMaterialsSectionProps {
  materials: Material[];
  onReanalyze: (material: Material) => void;
}

const BlockedMaterialsSection = ({
  materials,
  onReanalyze,
}: BlockedMaterialsSectionProps) => {
  return (
    <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden animate-slide-up transition-colors duration-300`}>
      <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-center gap-2 text-red-700 dark:text-red-400`}>
        <ShieldAlert size={16} /> Materiais Bloqueados / Rejeitados
      </div>
      <AdminDataTable label="Materiais bloqueados">
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
                <AdminRowActions label={`Ações do material ${material.title}`}>
                  <AdminButton type="button" variant="secondary" onClick={() => onReanalyze(material)}>Reanalisar</AdminButton>
                </AdminRowActions>
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
      </AdminDataTable>
    </div>
  );
};

export default BlockedMaterialsSection;
