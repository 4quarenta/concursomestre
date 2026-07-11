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

import React, { useState } from 'react';
import type { Material } from '@types';
import { useToast } from '@providers/ToastProvider';
import { buildMaterialAccessEndpoint, openAuthenticatedFile } from '@services/api';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import { ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminMaterialsSectionProps {
  materials: Material[];
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onModerate: (material: Material) => void;
  onDelete: (materialId: string) => void;
}

/**
 * Lista os materiais do marketplace no admin com acoes de linha no padrao WordPress.
 * A secao conecta moderacao, visualizacao autenticada e remocao operacional.
 *
 * @since 1.0.0
 */
const AdminMaterialsSection = ({
  materials,
  filter,
  onFilterChange,
  renderSortableHeader,
  onModerate,
  onDelete,
}: AdminMaterialsSectionProps) => {
  const { addToast } = useToast();
  const [pendingDeleteMaterial, setPendingDeleteMaterial] = useState<Material | null>(null);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteMaterial || isDeletingMaterial) {
      return;
    }

    setIsDeletingMaterial(true);
    try {
      await onDelete(pendingDeleteMaterial.id);
      setPendingDeleteMaterial(null);
    } finally {
      setIsDeletingMaterial(false);
    }
  };

  return (
    <>
      <AdminConfirmDialog
        isOpen={pendingDeleteMaterial !== null}
        title="Excluir material"
        description={`O material "${pendingDeleteMaterial?.title || ''}" sera removido permanentemente da plataforma.`}
        confirmLabel="Excluir material"
        loading={isDeletingMaterial}
        onCancel={() => {
          if (!isDeletingMaterial) {
            setPendingDeleteMaterial(null);
          }
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <div className="space-y-4">
        <AdminCollectionToolbar
          title="Materiais"
          description="Conteudos do marketplace em fila editorial e acompanhamento comercial."
          itemCount={materials.length}
          itemCountLabel="materiais"
          searchValue={filter}
          onSearchChange={onFilterChange}
          searchPlaceholder="Buscar materiais..."
        />

        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden animate-slide-up transition-colors duration-300`}>
          <div className={ADMIN_SURFACE_HEADER_CLASS}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Materiais do marketplace</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                <tr>
                  {renderSortableHeader('Material', 'title')}
                  {renderSortableHeader('Autor/Preco', 'price')}
                  {renderSortableHeader('Vendas', 'salesCount')}
                  {renderSortableHeader('Status', 'status')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {materials.map((material) => (
                  <tr key={material.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{material.title}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{material.subject}</span>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => onModerate(material)}
                            className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            Moderar
                          </button>
                          {material.hasFile ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  void openAuthenticatedFile(buildMaterialAccessEndpoint(material.id)).catch((error: unknown) => {
                                    const message = error instanceof Error ? error.message : 'Nao foi possivel abrir a visualizacao do material.';
                                    addToast(message || 'Nao foi possivel abrir a visualizacao do material.', 'error');
                                  });
                                }}
                                className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                              >
                                Visualizar
                              </button>
                            </>
                          ) : null}
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteMaterial(material)}
                            className="font-medium text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                          >
                            Lixeira
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{material.authorName}</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">
                          R$ {material.price.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{material.salesCount || 0}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <AdminPublishStateBadge state={resolveAdminPublishState(material as unknown as Record<string, unknown>)} />
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {material.status === 'approved'
                            ? 'Moderacao aprovada'
                            : material.status === 'pending'
                              ? 'Aguardando moderacao'
                              : 'Bloqueado'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center italic text-slate-400 dark:text-slate-600">
                      Nenhum material encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminMaterialsSection;
