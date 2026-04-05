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
import { useParams, useNavigate } from 'react-router-dom';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useAuth } from '@providers/AuthProvider';
import PdfViewer from '../../components/shared/overlays/PdfViewer';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getAssetUrl } from '@services/api';

const ReaderPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { materials, transactions, isLoadingMaterials, isLoadingTransactions } = useMarketplace();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [materialUrl, setMaterialUrl] = useState<string>('');
    const [materialTitle, setMaterialTitle] = useState<string>('');

    useEffect(() => {
        if (!currentUser) {
            navigate('/auth');
            return;
        }

        if (!id) {
            setError("Material nÃ£o especificado.");
            setLoading(false);
            return;
        }

        if (isLoadingMaterials || isLoadingTransactions) {
            console.log('[ReaderPage] Waiting on loading flags', { isLoadingMaterials, isLoadingTransactions });
            return; // Aguarda carregamento global do marketplace
        }

        console.log('[ReaderPage] Evaluating access.', {
            id,
            userId: currentUser.id,
            transactionsCount: transactions.length,
            materialsCount: materials.length
        });

        // Check ownership
        const transaction = transactions.find(t => t.materialId === id && t.buyerId === currentUser.id && (t.status === 'completed' || t.status === 'approved'));
        const material = materials.find(m => m.id === id);

        const hasPurchasedId = currentUser.purchasedMaterialIds?.includes(id); // For legacy tracking
        const isAuthor = material?.authorId === currentUser.id;
        const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;

        console.log('[ReaderPage] Access evaluation result:', {
            foundTransaction: !!transaction,
            foundMaterial: !!material,
            hasInPurchasedIds: hasPurchasedId,
            isAuthor: isAuthor,
            isAdmin: isAdmin
        });

        if (!material) {
            console.warn('[ReaderPage] Material not found in database.');
            setError("Material nÃ£o encontrado.");
            setLoading(false);
            return;
        }

        // Removed hasPurchasedId because it bypasses refunds. Must have a valid transaction!
        const hasAccess = !!transaction || isAuthor || isAdmin;

        if (!hasAccess) {
            setError("VocÃª nÃ£o possui permissÃ£o para acessar este material ou ele nÃ£o existe.");
            setLoading(false);
            return;
        }

        if (!material.fileUrl) {
            setError("O arquivo deste material nÃ£o estÃ¡ disponÃ­vel.");
            setLoading(false);
            return;
        }

        setMaterialUrl(getAssetUrl(material.fileUrl));
        setMaterialTitle(material.title);
        // Using explicit material finding rather than a new state to avoid unneeded renders
        setLoading(false);

    }, [id, currentUser, transactions, materials, isLoadingMaterials, isLoadingTransactions, navigate]);

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
                    onClick={() => navigate('/marketplace')}
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
                onClose={() => navigate(-1)} // Go back on close
            />
        </div>
    );
};

export default ReaderPage;
