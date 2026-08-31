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

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useAuth } from '@providers/AuthProvider';
import PdfViewer from '../../components/shared/overlays/PdfViewer';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getAssetUrl } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';

const ReaderPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { materials, transactions, isLoadingMaterials, isLoadingTransactions } = useMarketplace();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [materialUrl, setMaterialUrl] = useState<string>('');
    const [materialTitle, setMaterialTitle] = useState<string>('');

    useEffect(() => {
        let frameId: number | null = null;
        const scheduleState = (nextState: {
            error?: string | null;
            loading?: boolean;
            materialUrl?: string;
            materialTitle?: string;
        }) => {
            frameId = window.requestAnimationFrame(() => {
                if ('error' in nextState) setError(nextState.error ?? null);
                if ('loading' in nextState) setLoading(Boolean(nextState.loading));
                if ('materialUrl' in nextState) setMaterialUrl(nextState.materialUrl || '');
                if ('materialTitle' in nextState) setMaterialTitle(nextState.materialTitle || '');
            });
        };

        if (!currentUser) {
            router.push('/auth');
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            };
        }

        if (!id) {
            scheduleState({ error: "Material não especificado.", loading: false });
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            };
        }

        if (isLoadingMaterials || isLoadingTransactions) {
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            }; // Aguarda carregamento global do marketplace
        }


        // Check ownership
        const transaction = transactions.find(t => t.materialId === id && t.buyerId === currentUser.id && (t.status === 'completed' || t.status === 'approved'));
        const material = materials.find(m => m.id === id);

        const isAuthor = material?.authorId === currentUser.id;
        const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;


        if (!material) {
            clientLog.warn('[ReaderPage] Material not found in database.');
            scheduleState({ error: "Material não encontrado.", loading: false });
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            };
        }

        // Removed hasPurchasedId because it bypasses refunds. Must have a valid transaction!
        const hasAccess = !!transaction || isAuthor || isAdmin;

        if (!hasAccess) {
            scheduleState({ error: "Você não possui permissão para acessar este material ou ele não existe.", loading: false });
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            };
        }

        if (!material.fileUrl) {
            scheduleState({ error: "O arquivo deste material não está disponível.", loading: false });
            return () => {
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            };
        }

        scheduleState({
            error: null,
            loading: false,
            materialUrl: getAssetUrl(material.fileUrl),
            materialTitle: material.title,
        });

        return () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };

    }, [id, currentUser, transactions, materials, isLoadingMaterials, isLoadingTransactions, router]);

    if (loading || isLoadingMaterials || isLoadingTransactions) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={40} className="animate-spin mb-4 text-indigo-600" />
                <p>Carregando leitor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Acesso Negado</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">{error}</p>
                <button
                    onClick={() => router.push('/marketplace')}
                    className="px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all"
                >
                    <ArrowLeft size={18} /> Voltar para a Loja
                </button>
            </div>
        );
    }

    const targetMaterial = materials.find(m => m.id === id);

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-900">
            <PdfViewer
                isOpen={true}
                mode="embedded"
                url={materialUrl}
                title={materialTitle}
                materialId={id || ''}
                password={targetMaterial?.pdfPassword} // Passa a senha armazenada, se existir
                onClose={() => router.back()} // Go back on close
            />
        </div>
    );
};

export default ReaderPage;
