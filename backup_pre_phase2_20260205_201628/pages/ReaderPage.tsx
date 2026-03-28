import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import PdfViewer from '../components/PdfViewer';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

const ReaderPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { materials, transactions } = useMarketplace();
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
            setError("Material não especificado.");
            setLoading(false);
            return;
        }

        // Check ownership
        const transaction = transactions.find(t => t.materialId === id && t.buyerId === currentUser.id && t.status === 'completed');
        const material = materials.find(m => m.id === id);

        if (!transaction || !material) {
            // Fallback check in case transaction hasn't synced but user has purchasedMaterialIds
            if (currentUser.purchasedMaterialIds?.includes(id) && material) {
                setMaterialUrl(material.fileUrl || '');
                setMaterialTitle(material.title);
                setLoading(false);
                return;
            }

            setError("Você não possui permissão para acessar este material ou ele não existe.");
            setLoading(false);
            return;
        }

        if (!material.fileUrl) {
            setError("O arquivo deste material não está disponível.");
            setLoading(false);
            return;
        }

        setMaterialUrl(material.fileUrl);
        setMaterialTitle(material.title);
        setLoading(false);

    }, [id, currentUser, transactions, materials, navigate]);

    if (loading) {
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

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-900">
            <PdfViewer
                isOpen={true}
                mode="embedded"
                url={materialUrl}
                title={materialTitle}
                onClose={() => navigate(-1)} // Go back on close
            />
        </div>
    );
};

export default ReaderPage;
