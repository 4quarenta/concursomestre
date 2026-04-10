
import React, { useState, useMemo } from 'react';
import { Subject, Material } from '../types';
import { Search, ShoppingBag, Download, Star, FileText, Layout, Store, List, Grid, X, Eye, MessageSquare, Send, Lock, ShieldAlert, Tag, Check, Flag, AlertTriangle, Package, History, Clock, BookOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import AuthModal from '../components/AuthModal';
import PdfViewer from '../components/PdfViewer';

const Marketplace: React.FC = () => {
    const { materials, transactions, purchaseMaterial, requestRefund } = useMarketplace();
    const { currentUser } = useAuth();
    const { reportError, reports } = useData();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'browse' | 'orders'>('browse');
    const [filter, setFilter] = useState<{ keyword: string; subject: string; type: string; price: string; authorId: string | null }>({ keyword: '', subject: 'All', type: 'All', price: 'All', authorId: null });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [showKYCWarning, setShowKYCWarning] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '', actionSource: 'marketplace' });

    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(9);
    const [currentPage, setCurrentPage] = useState(1);

    // Refund/Report States
    const [isReporting, setIsReporting] = useState(false);
    const [reportDetails, setReportDetails] = useState({ reason: 'Plágio', details: '' });
    const [reportEvidence, setReportEvidence] = useState<string | null>(null);
    const [refundReason, setRefundReason] = useState('');
    const [refundTxId, setRefundTxId] = useState<string | null>(null);

    const activeMaterials = useMemo(() => {
        return materials.filter(m => {
            const isApproved = m.status === 'approved';
            const matchesKeyword = !filter.keyword || m.title.toLowerCase().includes(filter.keyword.toLowerCase());
            const matchesSubject = filter.subject === 'All' || m.subject === filter.subject;
            const matchesType = filter.type === 'All' || m.type === filter.type;
            const matchesPrice = filter.price === 'All' || (filter.price === 'Free' ? m.price === 0 : m.price > 0);
            const matchesAuthor = !filter.authorId || m.authorId === filter.authorId;
            return isApproved && matchesKeyword && matchesSubject && matchesType && matchesPrice && matchesAuthor;
        });
    }, [materials, filter]);

    // Handle Pagination Reset
    React.useEffect(() => { setCurrentPage(1); }, [filter, itemsPerPage]);

    const paginatedMaterials = activeMaterials.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    const totalPages = Math.ceil(activeMaterials.length / itemsPerPage);

    const myOrders = useMemo(() => {
        if (!currentUser) return [];
        return transactions.filter(t => t.buyerId === currentUser?.id).sort((a, b) => b.timestamp - a.timestamp);
    }, [transactions, currentUser]);

    // if (!currentUser) return null; // Removed to allow guest access

    const handleBuy = (material: Material) => {
        if (!currentUser) {
            setAuthModalConfig({
                title: "Adquira Material",
                description: "Para comprar ou baixar materiais de alta qualidade, você precisa acessar sua conta.",
                actionSource: 'marketplace_buy'
            });
            setShowAuthModal(true);
            return;
        }

        if (!currentUser.cpf || !currentUser.address?.zipCode) {
            setShowKYCWarning(true);
            return;
        }

        if (currentUser.purchasedMaterialIds?.includes(material.id)) {
            alert("Você já possui este material!");
            return;
        }

        if (material.price > 0) {
            if (confirm(`Confirmar compra por R$ ${material.price.toFixed(2)}?`)) {
                purchaseMaterial(material);
            }
        } else {
            purchaseMaterial(material);
        }
    };

    const handleReport = () => {
        if (!selectedMaterial) return;

        if (!reportDetails.details.trim()) {
            alert("Por favor, descreva o problema. A justificativa é obrigatória.");
            return;
        }

        // Check for duplicate reports
        const alreadyReported = reports.some(r =>
            r.targetType === 'material' &&
            r.materialId === selectedMaterial.id &&
            r.userName === currentUser.name &&
            r.status === 'pending'
        );

        if (alreadyReported) {
            alert("Você já enviou uma denúncia para este material. Aguarde a análise da moderação.");
            setIsReporting(false);
            return;
        }

        reportError({
            targetType: 'material',
            materialId: selectedMaterial.id,
            userName: currentUser.name,
            userId: currentUser.id,
            reason: reportDetails.reason,
            details: reportDetails.details,
            evidenceUrl: reportEvidence || undefined
        });
        setIsReporting(false);
        setReportEvidence(null);
        setReportDetails({ reason: 'Plágio', details: '' });
    };

    const handleRefundRequest = () => {
        if (refundTxId && refundReason) {
            requestRefund(refundTxId, refundReason);
            setRefundTxId(null);
            setRefundReason('');
        }
    };

    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string>('');
    const [viewerTitle, setViewerTitle] = useState<string>('');

    const handleAccessMaterial = (material: Material, type: 'download' | 'read') => {
        // Find transaction
        const transaction = transactions.find(t => t.materialId === material.id && t.buyerId === currentUser?.id && t.status === 'completed');

        if (!transaction) return;

        const purchaseDate = new Date(transaction.timestamp);
        const daysSincePurchase = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const canDownload = daysSincePurchase >= 7;

        if (type === 'download') {
            if (canDownload) {
                // Simulating download - normally this would trigger a file download from URL
                const link = document.createElement('a');
                link.href = material.fileUrl || '#';
                link.download = `${material.title}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert(`O download será liberado em ${Math.ceil(7 - daysSincePurchase)} dia(s) para garantir a conformidade com as políticas de reembolso.`);
            }
        } else {
            // Read Online - Redirect to Full Screen Reader
            if (material.fileUrl) {
                // setViewerUrl(material.fileUrl);
                // setViewerTitle(material.title);
                // setShowPdfViewer(true);
                navigate(`/read/${material.id}`);
            } else {
                alert("Erro: Arquivo não disponível para visualização.");
            }
        }
    };

    const isPurchased = (id: string) => currentUser.purchasedMaterialIds?.includes(id);

    // Check download availability for UI state
    const getDownloadStatus = (materialId: string) => {
        const transaction = transactions.find(t => t.materialId === materialId && t.buyerId === currentUser?.id && t.status === 'completed');
        if (!transaction) return { canDownload: false, daysRemaining: 7 };

        const daysSincePurchase = (Date.now() - transaction.timestamp) / (1000 * 60 * 60 * 24);
        return {
            canDownload: daysSincePurchase >= 7,
            daysRemaining: Math.ceil(7 - daysSincePurchase)
        };
    };

    const PriceTag = ({ price, purchased }: { price: number, purchased: boolean }) => {
        if (purchased) {
            return (
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1 transition-colors"><Check size={12} /> Adquirido</span>
                </div>
            );
        }
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${price === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100'}`}>
                <Tag size={14} className={price === 0 ? 'text-emerald-500' : 'text-indigo-500'} />
                <div className="flex flex-col leading-none">
                    <span className="text-[9px] font-bold uppercase opacity-60 tracking-wider">Valor</span>
                    <span className="text-sm font-black tracking-tight">{price === 0 ? 'GRÁTIS' : `R$ ${price.toFixed(2)}`}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* PdfViewer removed in favor of /read page */}

            {/* Aviso de KYC */}
            {showKYCWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-[2rem] p-8 text-center space-y-5 shadow-2xl animate-scale-in border border-slate-200 dark:border-slate-800 transition-colors">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-800/30">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 transition-colors">Perfil Incompleto</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium transition-colors">
                                Para realizar compras, precisamos do seu <strong>CPF e Endereço</strong> para emissão da Nota Fiscal.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <button onClick={() => navigate('/profile')} className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all">Completar Agora</button>
                            <button onClick={() => setShowKYCWarning(false)} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-2 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                        <ShoppingBag className="text-indigo-600 dark:text-indigo-400" size={24} /> Materiais
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors">Conteúdos premium criados por especialistas.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            if (!currentUser) {
                                setAuthModalConfig({
                                    title: "Torne-se Parceiro",
                                    description: "Para vender seus próprios materiais e monetizar seu conhecimento, faça login primeiro.",
                                    actionSource: 'partner_access'
                                });
                                setShowAuthModal(true);
                            } else {
                                navigate('/partner-dashboard');
                            }
                        }}
                        className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                    >
                        <Store size={14} /> {currentUser?.isPartner ? 'Painel do Parceiro' : 'Quero Vender'}
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit transition-colors">
                <button onClick={() => setActiveTab('browse')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'browse' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Loja</button>
                <button onClick={() => setActiveTab('orders')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Meus Pedidos</button>
            </div>

            {activeTab === 'browse' ? (
                <>
                    {/* Filters Compactos */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
                        <div className="flex flex-col md:flex-row gap-3 items-center">
                            <div className="flex-1 relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="O que você procura?"
                                    value={filter.keyword}
                                    onChange={e => setFilter({ ...filter, keyword: e.target.value })}
                                    className="w-full h-10 pl-9 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-bold text-xs transition-all"
                                />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="flex-1 md:flex-none h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
                                    <option value={9}>9 por página</option>
                                    <option value={18}>18 por página</option>
                                    <option value={27}>27 por página</option>
                                    <option value={50}>50 por página</option>
                                </select>
                                <select value={filter.subject} onChange={e => setFilter({ ...filter, subject: e.target.value })} className="flex-1 md:flex-none h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-600 dark:text-slate-300 w-full md:w-auto cursor-pointer transition-colors">
                                    <option value="All">Todas as Matérias</option>
                                    {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><Grid size={16} /></button>
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><List size={16} /></button>
                            </div>
                        </div>
                        {filter.authorId && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Filtrando por vendedor:</span>
                                <button
                                    onClick={() => setFilter(prev => ({ ...prev, authorId: null }))}
                                    className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors"
                                >
                                    Limpar Filtro <X size={12} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Grid vs List Rendering */}
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-2"}>
                        {paginatedMaterials.map(item => {
                            if (viewMode === 'list') {
                                return (
                                    <div key={item.id} onClick={() => setSelectedMaterial(item)} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex-shrink-0">
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pr-4 transition-colors">{item.title}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded transition-colors">{item.type}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate transition-colors">{item.authorName}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 pl-4 border-l border-slate-50 dark:border-slate-800 transition-colors">
                                            <PriceTag price={item.price} purchased={isPurchased(item.id) || false} />
                                            {isPurchased(item.id) ? (
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleAccessMaterial(item, 'read'); }} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                                                        Ler
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAccessMaterial(item, 'download'); }}
                                                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${getDownloadStatus(item.id).canDownload ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                                        title={getDownloadStatus(item.id).canDownload ? "Baixar PDF" : `Download liberado em ${getDownloadStatus(item.id).daysRemaining} dias`}
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); handleBuy(item); }} className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 shadow-md transition-all">
                                                    Comprar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-600 transition-all group flex flex-col h-full cursor-pointer" onClick={() => setSelectedMaterial(item)}>
                                    <div className="h-36 bg-slate-100 dark:bg-slate-800 relative overflow-hidden transition-colors">
                                        {item.coverUrl ? <img src={item.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><FileText size={40} /></div>}
                                        <div className="absolute top-3 left-3"><span className="px-2 py-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">{item.type}</span></div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-1 line-clamp-2 transition-colors">{item.title}</h3>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-4 transition-colors">{item.authorName}</p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 transition-colors">
                                            <PriceTag price={item.price} purchased={isPurchased(item.id) || false} />
                                            {isPurchased(item.id) ? (
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleAccessMaterial(item, 'read'); }} className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                                                        Ler
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAccessMaterial(item, 'download'); }}
                                                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${getDownloadStatus(item.id).canDownload ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                                        title={getDownloadStatus(item.id).canDownload ? "Baixar PDF" : `Download liberado em ${getDownloadStatus(item.id).daysRemaining} dias`}
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); handleBuy(item); }} className="px-3 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 shadow-md transition-all">
                                                    Comprar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Anterior</button>
                            <div className="flex gap-1">
                                {Array.from({ length: totalPages }).map((_, i) => (
                                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-colors ${currentPage === i + 1 ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{i + 1}</button>
                                ))}
                            </div>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Próxima</button>
                        </div>
                    )}
                </>
            ) : (
                /* ABA MEUS PEDIDOS */
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 transition-colors">
                        <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors"><History size={18} className="text-indigo-600 dark:text-indigo-400" /> Histórico de Compras</h3>
                    </div>
                    {myOrders.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 dark:text-slate-600 transition-colors">
                            <Package size={40} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm font-medium">Você ainda não comprou nenhum material.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors">
                            {myOrders.map(order => (
                                <div key={order.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1 transition-colors">{order.materialTitle}</h4>
                                        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-medium transition-colors">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(order.timestamp).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1 uppercase tracking-wider text-indigo-600 dark:text-indigo-400"><Tag size={10} /> Protocolo: {order.id.substring(0, 12)}...</span>
                                            <span className={`uppercase font-black px-2 py-0.5 rounded transition-colors ${order.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : order.status === 'refunded' ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 line-through' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                                                {order.status === 'completed' ? 'Concluído' : order.status === 'refund_requested' ? 'Reembolso Solicitado' : order.status === 'refunded' ? 'Reembolsado' : 'Cancelado'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-slate-900 dark:text-slate-100 transition-colors">R$ {order.amount.toFixed(2)}</span>
                                        {order.status === 'completed' && (
                                            <button
                                                onClick={() => setRefundTxId(refundTxId === order.id ? null : order.id)}
                                                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 underline uppercase tracking-wider transition-colors"
                                            >
                                                Pedir Reembolso
                                            </button>
                                        )}
                                    </div>

                                    {/* Área de Pedido de Reembolso Expandível */}
                                    {refundTxId === order.id && (
                                        <div className="w-full md:w-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-xl animate-slide-down mt-2 md:mt-0 md:absolute md:right-20 md:shadow-xl md:z-10 md:max-w-sm transition-colors">
                                            <h5 className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase mb-2 flex items-center gap-1">
                                                <AlertTriangle size={12} /> Solicitar Estorno
                                            </h5>
                                            <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mb-3 leading-tight transition-colors">O prazo legal é de 7 dias após a compra. O acesso ao material será revogado.</p>
                                            <textarea
                                                value={refundReason}
                                                onChange={e => setRefundReason(e.target.value)}
                                                placeholder="Motivo (ex: conteúdo diferente do anunciado)"
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg text-xs mb-2 outline-none text-slate-900 dark:text-slate-100 transition-colors"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setRefundTxId(null)} className="px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Cancelar</button>
                                                <button onClick={handleRefundRequest} className="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">Confirmar</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedMaterial(null)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row border border-slate-200 dark:border-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
                        <div className="md:w-5/12 bg-slate-50 dark:bg-slate-850 p-6 flex flex-col border-r border-slate-100 dark:border-slate-800 transition-colors">
                            <div className="aspect-[3/4] rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5 relative group transition-colors">
                                {selectedMaterial.coverUrl ? <img src={selectedMaterial.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><FileText size={50} /></div>}
                            </div>
                            <div className="mt-auto space-y-3">
                                <div className="flex justify-between items-center mb-1 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-colors">Preço</span>
                                        <span className="text-xl font-black text-slate-900 dark:text-slate-100 transition-colors">{selectedMaterial.price === 0 ? 'Grátis' : `R$ ${selectedMaterial.price.toFixed(2)}`}</span>
                                    </div>
                                    {selectedMaterial.price > 0 && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded transition-colors">Oferta</span>}
                                </div>
                                {isPurchased(selectedMaterial.id) ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => handleAccessMaterial(selectedMaterial, 'read')}
                                            className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                                        >
                                            <BookOpen size={16} /> Ler Agora
                                        </button>
                                        <button
                                            onClick={() => handleAccessMaterial(selectedMaterial, 'download')}
                                            disabled={!getDownloadStatus(selectedMaterial.id).canDownload}
                                            className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${getDownloadStatus(selectedMaterial.id).canDownload ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            <Download size={14} /> {getDownloadStatus(selectedMaterial.id).canDownload ? 'Baixar Arquivo PDF' : `Download em ${getDownloadStatus(selectedMaterial.id).daysRemaining} dias`}
                                        </button>
                                        {!getDownloadStatus(selectedMaterial.id).canDownload && (
                                            <p className="text-[10px] text-slate-400 text-center leading-tight">Para sua segurança e conformidade com a política de reembolso, o download do arquivo original é liberado após 7 dias.</p>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleBuy(selectedMaterial)}
                                        className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-700"
                                    >
                                        <ShoppingBag size={16} /> {selectedMaterial.price === 0 ? 'Adicionar à Biblioteca' : 'Comprar Agora'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="md:w-7/12 p-8 flex flex-col h-full overflow-y-auto no-scrollbar relative transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight pr-4 transition-colors">{selectedMaterial.title}</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const alreadyReported = reports.some(r => r.targetType === 'material' && r.materialId === selectedMaterial.id && r.userName === currentUser.name && r.status === 'pending');
                                            if (alreadyReported) {
                                                alert("Você já enviou uma denúncia para este material.");
                                            } else {
                                                setIsReporting(!isReporting);
                                            }
                                        }}
                                        className={`p-1.5 rounded-full transition-all ${isReporting ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                        title="Denunciar Material"
                                    >
                                        <Flag size={18} />
                                    </button>
                                    <button onClick={() => setSelectedMaterial(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} className="text-slate-400 dark:text-slate-500" /></button>
                                </div>
                            </div>

                            {/* Reporting UI */}
                            {isReporting && (
                                <div className="mb-6 p-5 bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-100 dark:border-red-900/30 animate-slide-down shadow-inner space-y-4 transition-colors">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-black text-[10px] uppercase">
                                        <AlertTriangle size={16} /> Denunciar Material Relevante
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase ml-1">Motivo da Denúncia</label>
                                            <select
                                                value={reportDetails.reason}
                                                onChange={e => setReportDetails({ ...reportDetails, reason: e.target.value })}
                                                className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/50 transition-colors"
                                            >
                                                <option>Plágio / Cópia de Terceiros</option>
                                                <option>Violação de Direito Autoral</option>
                                                <option>Conteúdo Inapropriado ou Ofensivo</option>
                                                <option>Material Incompleto / Enganoso</option>
                                                <option>Outro</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase">Detalhes do Problema {reportDetails.details.trim() === '' && <span className="text-[8px] italic">(OBRIGATÓRIO)</span>}</label>
                                            </div>
                                            <textarea
                                                placeholder="Por favor, explique por que este material deve ser moderado..."
                                                value={reportDetails.details}
                                                onChange={e => setReportDetails({ ...reportDetails, details: e.target.value })}
                                                className={`w-full p-4 bg-white dark:bg-slate-800 border ${reportDetails.details.trim() === '' ? 'border-red-200 dark:border-red-900/50 focus:border-red-400 dark:focus:border-red-700' : 'border-red-50 dark:border-slate-700 focus:border-red-400 dark:focus:border-red-700'} rounded-2xl text-xs font-medium outline-none h-28 resize-none transition-all focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/20 text-slate-900 dark:text-slate-100`}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-red-500 dark:text-red-400 uppercase ml-1">Evidência / Screenshot (Opcional)</label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-xl text-[10px] font-black text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm">
                                                    <Package size={14} /> {reportEvidence ? 'Mudar Arquivo' : 'Carregar Prova'}
                                                    <input type="file" className="hidden" accept="image/*" onChange={e => {
                                                        const f = e.target.files?.[0];
                                                        if (f) setReportEvidence(URL.createObjectURL(f));
                                                    }} />
                                                </label>
                                                {reportEvidence && (
                                                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1 pr-3 rounded-xl border border-red-100 dark:border-red-900/50 animate-fade-in transition-colors">
                                                        <img src={reportEvidence} alt="Prova" className="w-10 h-10 rounded-lg object-cover" />
                                                        <button onClick={() => setReportEvidence(null)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-2">
                                            <button onClick={() => { setIsReporting(false); setReportEvidence(null); }} className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase hover:text-slate-600 dark:hover:text-slate-300 transition-colors transition-colors">Cancelar</button>
                                            <button
                                                onClick={handleReport}
                                                disabled={!reportDetails.details.trim()}
                                                className="px-6 py-3 bg-red-600 dark:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 dark:hover:bg-red-600 transition-all disabled:opacity-50"
                                            >
                                                Enviar Denúncia
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 mb-6">
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md text-[9px] font-black uppercase transition-colors">{selectedMaterial.type}</span>
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md text-[9px] font-black uppercase transition-colors">{selectedMaterial.subject}</span>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-8 transition-colors">{selectedMaterial.description}</p>

                            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 transition-colors">
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 transition-colors">Sobre o Autor</h4>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-xs transition-colors">
                                        {selectedMaterial.authorName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 transition-colors">{selectedMaterial.authorName}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 transition-colors">Parceiro Verificado</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setFilter(prev => ({ ...prev, authorId: selectedMaterial.authorId, keyword: '' }));
                                            setSelectedMaterial(null);
                                        }}
                                        className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wide"
                                    >
                                        Ver mais produtos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                title={authModalConfig.title}
                description={authModalConfig.description}
                actionSource={authModalConfig.actionSource}
            />
        </div>
    );
};

export default Marketplace;
