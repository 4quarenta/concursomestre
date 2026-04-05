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

import React, { useState, useMemo } from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import { Subject, Material } from '@types';
import { Search, Filter, BookOpen, Star, ArrowRight, Shield, CheckCircle, Lock, CreditCard, Layout, Book, FileText, ShoppingBag, X, ChevronRight, Tag, History, Clock, AlertTriangle, Package, TrendingUp, Download, RefreshCcw, ShieldCheck, Eye, MessageSquare, Send, Check, Flag, Store, List, Grid, ShieldAlert, XCircle, GraduationCap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import AuthModal from '../../components/shared/overlays/AuthModal';
import PdfViewer from '../../components/shared/overlays/PdfViewer';
import CommentsSection from '../../components/shared/feedback/CommentsSection';
import AdBanner from '../../components/shared/feedback/AdBanner';
// Removed Stripe imports
import { PaymentModal } from './components/PaymentModal';
import { SuccessModal } from '../../components/shared/overlays/SuccessModal';
import {
    apiClient,
    ENDPOINTS,
    getAssetUrl,
    buildMaterialDownloadEndpoint,
    downloadAuthenticatedFile,
} from '@services/api';
import { AdPlaceholder } from '../../components/shared/ui/AdPlaceholder';

interface MaterialDetailModalProps {
    material: Material;
    isPurchased: boolean;
    currentUser: any;
    onClose: () => void;
    onBuy: () => void;
    onRead: () => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    initialTab?: 'overview' | 'reviews' | 'qa';
}

const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({
    material, isPurchased, currentUser, onClose, onBuy, onRead, addToast, initialTab = 'overview'
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'qa'>(initialTab);
    const [userRating, setUserRating] = useState<number>(0);
    const [hoverRating, setHoverRating] = useState<number>(0);
    const [submittingRating, setSubmittingRating] = useState(false);
    const [currentAvgRating, setCurrentAvgRating] = useState(material.rating || 0);
    const [totalRatings, setTotalRatings] = useState(material.salesCount || 0); // Simplified for UI

    // ComentÃ¡rios States
    const [reviews, setReviews] = useState<any[]>([]);
    const [qaComments, setQaComments] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [loadingQa, setLoadingQa] = useState(false);

    // Buscar rating existente do usuÃ¡rio
    React.useEffect(() => {
        if (!currentUser || !isPurchased) return;
        const fetchUserRating = async () => {
            try {
                const res = await apiClient.get<any>(ENDPOINTS.materials.rate, {
                    params: { material_id: material.id, user_id: currentUser.id }
                });
                const data = (res as any).data || res;
                if (data.success && data.userRating) {
                    setUserRating(data.userRating);
                }
            } catch (err) {
                console.error("Failed to fetch user rating", err);
            }
        };
        fetchUserRating();
    }, [material.id, currentUser, isPurchased]);

    // Buscar ComentÃ¡rios (Reviews e QA)
    React.useEffect(() => {
        if (!currentUser) return;

        const fetchCommentsTarget = async (targetId: string, setter: any, loader: any) => {
            loader(true);
            try {
                const res = await apiClient.get<any>(ENDPOINTS.comments.list, {
                    params: { target_id: targetId, user_id: currentUser.id, _t: Date.now() }
                });
                const payload = res as any;
                if (payload && payload.success && Array.isArray(payload.data)) {
                    setter(payload.data);
                } else if (Array.isArray(payload)) {
                    setter(payload);
                } else if (payload && Array.isArray(payload.data)) {
                    setter(payload.data);
                }
            } catch (err) {
                console.error(`Falha ao carregar comentÃ¡rios ${targetId}:`, err);
            } finally {
                loader(false);
            }
        };

        if (activeTab === 'reviews') {
            fetchCommentsTarget(`${material.id}-reviews`, setReviews, setLoadingReviews);
            fetchCommentsTarget(`${material.id}-qa`, setQaComments, setLoadingQa);
        } else if (activeTab === 'qa') {
            fetchCommentsTarget(`${material.id}-qa`, setQaComments, setLoadingQa);
        }
    }, [material.id, currentUser, activeTab]);

    const handleRate = async (stars: number) => {
        if (!isPurchased || !currentUser) return;
        setSubmittingRating(true);
        try {
            const res = await apiClient.post<any>(ENDPOINTS.materials.rate, {
                materialId: material.id,
                userId: currentUser.id,
                rating: stars
            });
            const data = (res as any).data || res;
            if (data.success) {
                setUserRating(stars);
                if (data.newRating) setCurrentAvgRating(data.newRating);
                if (data.totalRatings) setTotalRatings(data.totalRatings);
                addToast(`âœ… VocÃª avaliou com ${stars} estrela${stars > 1 ? 's' : ''}! Obrigado pelo feedback.`, 'success');
            } else {
                addToast('âš ï¸ ' + data.message, 'warning');
            }
        } catch (error: any) {
            console.error('Rating error:', error);
            addToast('âŒ Erro ao enviar avaliaÃ§Ã£o: ' + (error.response?.data?.message || 'Tente novamente.'), 'error');
        } finally {
            setSubmittingRating(false);
        }
    };

    // Generic Handlers for CommentsSection
    const handleAddComment = async (targetId: string, text: string, parentId?: string) => {
        if (!currentUser) {
            addToast("VocÃª precisa estar logado para comentar.", "warning");
            return;
        }

        const isReview = targetId.endsWith('-reviews');
        const setter = isReview ? setReviews : setQaComments;

        // Otimista
        const tempId = `temp-${Date.now()}`;
        const newTempComment = {
            id: tempId,
            userId: currentUser.id,
            userName: currentUser.name,
            text,
            date: 'Agora mesmo',
            likes: 0,
            isLiked: false,
            replies: [],
            parentId
        };

        setter(prev => {
            if (parentId) {
                return prev.map(c => c.id === parentId ? { ...c, replies: [...(c.replies || []), newTempComment] } : c);
            }
            return [newTempComment, ...prev];
        });

        try {
            const res = await apiClient.post<any>(ENDPOINTS.comments.add, {
                action: 'add',
                targetType: 'material',
                question_id: targetId,
                user_id: currentUser.id,
                text,
                parent_id: parentId || null
            });
            // res is expected to be { success: true, data: { id: ... } }
            const payload: any = res;
            if (payload && payload.success) {
                const realId = payload.data?.id || payload.id || tempId;
                // Atualiza ID real
                setter(prev => {
                    const updateId = (list: any[]) => list.map(c => {
                        if (c.id === tempId) return { ...c, id: realId };
                        if (c.replies) return { ...c, replies: updateId(c.replies) };
                        return c;
                    });
                    return updateId(prev);
                });
                addToast("Mensagem enviada!", "success");
            } else {
                throw new Error("Erro na resposta");
            }
        } catch (err) {
            console.error("Falha ao adicionar comentÃ¡rio:", err);
            addToast("Erro ao enviar mensagem.", "error");
            // Remove temp (rollback)
            setter(prev => {
                const removeTemp = (list: any[]) => list.filter(c => c.id !== tempId).map(c => ({ ...c, replies: c.replies ? removeTemp(c.replies) : [] }));
                return removeTemp(prev);
            });
        }
    };

    const handleLikeComment = async (targetId: string, commentId: string) => {
        if (!currentUser) return;
        const setter = targetId.endsWith('-reviews') ? setReviews : setQaComments;

        // Optimistic toggle
        setter(prev => {
            const toggleLike = (list: any[]) => list.map(c => {
                if (c.id === commentId) {
                    return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
                }
                if (c.replies) return { ...c, replies: toggleLike(c.replies) };
                return c;
            });
            return toggleLike(prev);
        });

        try {
            await apiClient.post(ENDPOINTS.comments.like, {
                action: 'like',
                comment_id: commentId,
                user_id: currentUser.id
            });
        } catch (err) {
            console.error("Error liking comment", err);
            // Ignore rollback for simplicity unless needed
        }
    };

    const handleDeleteComment = async (targetId: string, commentId: string) => {
        if (!currentUser) return;
        const setter = targetId.endsWith('-reviews') ? setReviews : setQaComments;

        try {
            const res = await apiClient.delete<any>(ENDPOINTS.comments.delete, {
                data: { action: 'delete', comment_id: commentId, user_id: currentUser.id }
            });
            const data = (res as any).data || res;
            if (data && data.success) {
                setter(prev => {
                    const remove = (list: any[]) => list.filter(c => c.id !== commentId).map(c => ({ ...c, replies: c.replies ? remove(c.replies) : [] }));
                    return remove(prev);
                });
                addToast("ComentÃ¡rio excluÃ­do", "success");
            }
        } catch (err) {
            addToast("Erro ao excluir", "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center animate-in fade-in duration-300">
            {/* Modal Container with scroll */}
            <div className="w-full h-full md:h-[90vh] md:w-[90vw] md:max-w-6xl bg-slate-50 dark:bg-slate-900 md:rounded-3xl md:my-auto flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-in relative">

                {/* Header (Sticky) */}
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 shrink-0">
                            <X size={24} />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">{material.title}</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate hidden md:block">Por {material.authorName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">


                        {isPurchased ? (
                            <button onClick={onRead} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                                <BookOpen size={16} /> Ler
                            </button>
                        ) : (
                            <button onClick={onBuy} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                                <ShoppingBag size={16} /> {material.price === 0 ? 'Obter GrÃ¡tis' : `Comprar R$ ${material.price.toFixed(2)}`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Hero Section */}
                    <div className="bg-white dark:bg-slate-900/50 p-6 md:p-10 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Cover */}
                            <div className="w-40 md:w-56 shrink-0 aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-xl overflow-hidden self-center md:self-auto border border-slate-200 dark:border-slate-700">
                                {material.coverUrl ? (
                                    <img src={getAssetUrl(material.coverUrl)} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><FileText size={64} /></div>
                                )}
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 space-y-4">
                                <div className="flex gap-2 flex-wrap">
                                    <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">{material.type}</span>
                                    {material.subjectText && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg">{material.subjectText}</span>}
                                    {material.year && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg">{material.year}</span>}
                                </div>
                                <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                                    {material.title}
                                </h1>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                                    Criado por <span className="text-indigo-600 dark:text-indigo-400">{material.authorName}</span>
                                </p>

                                <div className="flex items-center gap-6 pt-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <Star className="fill-yellow-400 text-yellow-400" size={20} />
                                            <span className="text-xl font-black text-slate-900 dark:text-slate-100">{currentAvgRating.toFixed(1)}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{totalRatings} avaliaÃ§Ãµes</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
                                    <div className="flex flex-col">
                                        <span className="text-xl font-black text-slate-900 dark:text-slate-100">{material.pageCount || '-'}</span>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PÃ¡ginas</span>
                                    </div>
                                    {!isPurchased && (
                                        <>
                                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
                                            <div className="flex flex-col">
                                                <span className="text-xl font-black text-slate-900 dark:text-slate-100">{material.price === 0 ? 'GrÃ¡tis' : `R$ ${material.price.toFixed(2)}`}</span>
                                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Valor</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 px-6">
                        <div className="flex gap-8 overflow-x-auto hide-scrollbar">
                            <button onClick={() => setActiveTab('overview')} className={`py-4 font-black uppercase tracking-widest text-xs whitespace-nowrap transition-colors relative ${activeTab === 'overview' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
                                VisÃ£o Geral
                                {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
                            </button>
                            <button onClick={() => setActiveTab('reviews')} className={`py-4 font-black uppercase tracking-widest text-xs whitespace-nowrap transition-colors relative ${activeTab === 'reviews' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
                                AvaliaÃ§Ãµes
                                {activeTab === 'reviews' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6 md:p-10 pb-32">
                        {activeTab === 'overview' && (
                            <div className="max-w-3xl space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">Sobre o Material</h3>
                                    <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                                        {material.description.split('\n').map((paragraph, i) => (
                                            <p key={i} className="mb-4 leading-relaxed">{paragraph}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                                {/* Rating Input Section */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-2">
                                        <div className="text-5xl font-black text-slate-900 dark:text-slate-100">{currentAvgRating.toFixed(1)}</div>
                                        <div className="flex justify-center gap-1">
                                            {[1, 2, 3, 4, 5].map(star => {
                                                const fillPercentage = Math.min(Math.max(currentAvgRating - (star - 1), 0), 1) * 100;
                                                return (
                                                    <div key={star} className="relative">
                                                        {/* Base Star (Empty) */}
                                                        <Star size={20} className="text-slate-200 dark:text-slate-700" />
                                                        {/* Filled Star overlay with clipping */}
                                                        <div
                                                            className="absolute top-0 left-0 overflow-hidden"
                                                            style={{ width: `${fillPercentage}%` }}
                                                        >
                                                            <Star size={20} className="fill-yellow-400 text-yellow-400" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest pt-2">{totalRatings} avaliaÃ§Ãµes</p>
                                    </div>

                                    {isPurchased ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 text-center space-y-4">
                                            <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">
                                                {userRating > 0 ? `Sua AvaliaÃ§Ã£o (${userRating.toFixed(1)})` : 'Avaliar Material'}
                                            </h4>
                                            <div
                                                className="flex justify-center gap-1 cursor-pointer"
                                                onMouseLeave={() => setHoverRating(0)}
                                            >
                                                {[1, 2, 3, 4, 5].map(star => {
                                                    const currentDisplay = hoverRating > 0 ? hoverRating : userRating;
                                                    const fillPercentage = Math.min(Math.max(currentDisplay - (star - 1), 0), 1) * 100;

                                                    return (
                                                        <div
                                                            key={star}
                                                            className="relative"
                                                            onMouseMove={(e) => {
                                                                if (submittingRating) return;
                                                                // Calcula se o mouse estÃ¡ na metade esquerda ou direita da estrela
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const isHalf = (e.clientX - rect.left) < (rect.width / 2);
                                                                setHoverRating(isHalf ? star - 0.5 : star);
                                                            }}
                                                            onClick={() => {
                                                                if (!submittingRating && hoverRating > 0) {
                                                                    handleRate(hoverRating);
                                                                }
                                                            }}
                                                        >
                                                            {/* Empty Base Star */}
                                                            <Star size={32} className="text-slate-300 dark:text-slate-600 transition-transform hover:scale-110" />
                                                            {/* Filled Overlay */}
                                                            <div
                                                                className="absolute top-0 left-0 overflow-hidden pointer-events-none transition-transform hover:scale-110"
                                                                style={{ width: `${fillPercentage}%` }}
                                                            >
                                                                <Star size={32} className="fill-yellow-400 text-yellow-400" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase">
                                                {userRating > 0 ? 'Obrigado por avaliar!' : 'Clique nas estrelas para avaliar'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                                            <Lock size={24} className="mx-auto mb-3 text-slate-400" />
                                            <p className="text-xs font-bold text-slate-500">Adquira o material para deixar sua avaliaÃ§Ã£o.</p>
                                        </div>
                                    )}
                                </div>

                                {/* DÃºvidas com o Autor (Moved to Reviews tab) */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center shrink-0">
                                            <Store className="text-indigo-600 dark:text-indigo-400" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-widest mb-1">DÃºvidas com o Autor</h3>
                                            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">FaÃ§a perguntas diretamente para <strong>{material.authorName}</strong>. Outros estudantes tambÃ©m podem responder e interagir.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <CommentsSection
                                            targetId={`${material.id}-qa`}
                                            title="FaÃ§a sua Pergunta"
                                            comments={qaComments}
                                            onAddComment={(text, parentId) => handleAddComment(`${material.id}-qa`, text, parentId)}
                                            onLikeComment={(commentId) => handleLikeComment(`${material.id}-qa`, commentId)}
                                            onDeleteComment={(commentId) => handleDeleteComment(`${material.id}-qa`, commentId)}
                                            onReportComment={() => { }}
                                            restrictedReplies={true}
                                            ownerId={material.authorId}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const Marketplace: React.FC = () => {
    const { materials, transactions, purchaseMaterial, requestRefund, fetchUserTransactions } = useMarketplace();
    const { currentUser } = useAuth();
    const { reportError, reports, systemSettings, ensureTaxonomiesLoaded } = useData();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'browse' | 'orders'>('browse');
    const [filter, setFilter] = useState<{ keyword: string; subject: string; type: string; price: string; authorId: string | null }>({ keyword: '', subject: 'All', type: 'All', price: 'All', authorId: null });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [showKYCWarning, setShowKYCWarning] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '', actionSource: 'marketplace' });
    const [initialModalTab, setInitialModalTab] = useState<'overview' | 'reviews' | 'qa'>('overview');

    // Handle deep linking from notifications
    React.useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.includes('/marketplace') && hash.includes('openMaterial=')) {
                try {
                    const urlStr = hash.replace('#', '');
                    const url = new URL(urlStr, window.location.origin);
                    const openMaterialId = url.searchParams.get('openMaterial');
                    const hasComment = url.searchParams.get('comment');

                    if (openMaterialId && materials.length > 0) {
                        const targetMaterial = materials.find(m => String(m.id) === openMaterialId);
                        if (targetMaterial && !selectedMaterial) {
                            setSelectedMaterial(targetMaterial);
                            if (hasComment) {
                                setInitialModalTab('reviews'); // DÃºvidas are inside reviews tab now
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error parsing URL hash for deep linking", e);
                }
            }
        };

        handleHashChange(); // Check on mount
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [materials, selectedMaterial]);

    React.useEffect(() => {
        ensureTaxonomiesLoaded();
    }, [ensureTaxonomiesLoaded]);

    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(9);
    const [currentPage, setCurrentPage] = useState(1);

    // Refund/Report States
    const [isReporting, setIsReporting] = useState(false);
    const [reportDetails, setReportDetails] = useState({ reason: 'PlÃ¡gio', details: '' });
    const [reportEvidence, setReportEvidence] = useState<string | null>(null);
    const [refundReason, setRefundReason] = useState('');
    const [refundTxId, setRefundTxId] = useState<string | null>(null);

    // Stripe states
    // Stripe states removed
    const [showStripeCheckout, setShowStripeCheckout] = useState(false);
    const [checkoutMaterial, setCheckoutMaterial] = useState<Material | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

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
        return transactions
            .filter(t => String(t.buyerId) === String(currentUser.id) && t.type !== 'plan')
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [transactions, currentUser]);


    // Helper Functions
    const isPurchased = (id: string) => {
        // Robust check strictly relying on verified transaction statuses
        const transactionOwns = transactions.some(t => String(t.materialId) === String(id) && String(t.buyerId) === String(currentUser?.id) && (t.status === 'completed' || t.status === 'approved'));
        return transactionOwns;
    };

    const getDownloadStatus = (materialId: string) => {
        const transaction = transactions.find(t => String(t.materialId) === String(materialId) && String(t.buyerId) === String(currentUser?.id) && (t.status === 'completed' || t.status === 'approved'));
        if (!transaction) return { canDownload: false, daysRemaining: 7 };

        const daysSincePurchase = (Date.now() - transaction.timestamp) / (1000 * 60 * 60 * 24);
        return {
            canDownload: daysSincePurchase >= 7,
            daysRemaining: Math.ceil(7 - daysSincePurchase)
        };
    };

    const handleBuy = async (material: Material) => {
        if (!currentUser) {
            setAuthModalConfig({
                title: "Adquira Material",
                description: "Para comprar ou baixar materiais de alta qualidade, vocÃª precisa acessar sua conta.",
                actionSource: 'marketplace_buy'
            });
            setShowAuthModal(true);
            return;
        }

        // Check for KYC data (CPF and ZipCode are required for billing)
        if (!currentUser.cpf || !currentUser.address?.zipCode) {
            setShowKYCWarning(true);
            return;
        }

        if (currentUser.purchasedMaterialIds?.includes(material.id)) {
            addToast('VocÃª jÃ¡ possui este material!', 'info');
            return;
        }

        // Free materials - direct purchase
        if (material.price === 0) {
            purchaseMaterial(material);
            return;
        }

        // Open Payment Modal
        setCheckoutMaterial(material);
        setShowStripeCheckout(true);
    };

    const handleReport = () => {
        if (!selectedMaterial) return;

        if (!reportDetails.details.trim()) {
            addToast('Por favor, descreva o problema. A justificativa Ã© obrigatÃ³ria.', 'info');
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
            addToast('VocÃª jÃ¡ enviou uma denÃºncia para este material. Aguarde a anÃ¡lise da moderaÃ§Ã£o.', 'info');
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
            evidenceUrl: reportEvidence || undefined,
            plan: currentUser.plan || 'Gratuito',
            email: currentUser.email,
            role: currentUser.role === 'user' ? 'student' : currentUser.role,
            level: currentUser.level || 0
        });
        setIsReporting(false);
        setReportEvidence(null);
        setReportDetails({ reason: 'PlÃ¡gio', details: '' });
    };

    const handleRefundRequest = () => {
        if (refundTxId && refundReason) {
            requestRefund(refundTxId, refundReason);
            setRefundTxId(null);
            setRefundReason('');
        }
    };

    const [showCancelRefundModal, setShowCancelRefundModal] = useState(false);
    const [cancelRefundTxId, setCancelRefundTxId] = useState<string | number | null>(null);

    const handleCancelRefundClick = (txId: string | number) => {
        setCancelRefundTxId(txId);
        setShowCancelRefundModal(true);
    };

    const confirmCancelRefund = async () => {
        if (!cancelRefundTxId) return;

        try {
            await apiClient.delete(ENDPOINTS.transactions.refund, {
                data: { transaction_id: cancelRefundTxId }
            });
            addToast('SolicitaÃ§Ã£o cancelada com sucesso.', 'success');
            fetchUserTransactions();
            setShowCancelRefundModal(false);
            setCancelRefundTxId(null);
        } catch (error) {
            console.error('Erro ao cancelar reembolso:', error);
            addToast('Erro ao cancelar solicitaÃ§Ã£o.', 'error');
        }
    };

    const handleAccessMaterial = (material: Material, type: 'download' | 'read') => {
        // Find transaction
        const transaction = transactions.find(t => String(t.materialId) === String(material.id) && String(t.buyerId) === String(currentUser?.id) && (t.status === 'completed' || t.status === 'approved'));

        if (!transaction) return;

        const purchaseDate = new Date(transaction.timestamp);
        const daysSincePurchase = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const canDownload = daysSincePurchase >= 7;

        if (type === 'download') {
            if (canDownload) {
                // Abre o endpoint de download que estampa os dados do usuÃ¡rio no PDF
                void downloadAuthenticatedFile(buildMaterialDownloadEndpoint(material.id)).catch((error: any) => {
                    addToast(error?.message || 'Nao foi possivel baixar o material agora.', 'error');
                });
            } else {
                addToast(`O download serÃ¡ liberado em ${Math.ceil(7 - daysSincePurchase)} dia(s) para garantir a conformidade com as polÃ­ticas de reembolso.`, 'info');
            }
        } else {
            // Read Online - Redirect to Full Screen Reader
            if (material.fileUrl) {
                navigate(`/read/${material.id}`);
            } else {
                addToast('Erro: Arquivo nÃ£o disponÃ­vel para visualizaÃ§Ã£o.', 'error');
            }
        }
    };

    // Components
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
                    <span className="text-sm font-black tracking-tight">{price === 0 ? 'GRÃTIS' : `R$ ${price.toFixed(2)}`}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                title={authModalConfig.title}
                description={authModalConfig.description}
            />

            {/* Aviso de KYC */}
            {showKYCWarning && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-[2rem] p-8 text-center space-y-5 shadow-2xl animate-scale-in border border-slate-200 dark:border-slate-800 transition-colors">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-800/30">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 transition-colors">Perfil Incompleto</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium transition-colors">
                                Para realizar compras, precisamos do seu <strong>CPF e EndereÃ§o</strong> para emissÃ£o da Nota Fiscal.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <button onClick={() => navigate('/profile?tab=personal')} className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all">Completar Agora</button>
                            <button onClick={() => setShowKYCWarning(false)} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-2 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                        <ShoppingBag className="text-indigo-600 dark:text-indigo-400" size={24} /> Materiais
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors">ConteÃºdos premium criados por especialistas.</p>
                </div>
                <div className="flex gap-3">
                    {(currentUser?.isPartner || systemSettings.features.partnerRegistrationEnabled === true || String(systemSettings.features.partnerRegistrationEnabled) === 'true') && (
                        <button
                            onClick={() => {
                                if (!currentUser) {
                                    setAuthModalConfig({
                                        title: "Torne-se Parceiro",
                                        description: "Para vender seus prÃ³prios materiais e monetizar seu conhecimento, faÃ§a login primeiro.",
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
                    )}
                </div>
            </header>

            {/* Tabs */}
            <div className="flex flex-col gap-6">
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
                                        placeholder="O que vocÃª procura?"
                                        value={filter.keyword}
                                        onChange={e => setFilter({ ...filter, keyword: e.target.value })}
                                        className="w-full h-10 pl-9 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-bold text-xs transition-all"
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="flex-1 md:flex-none h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-600 dark:text-slate-300 cursor-pointer transition-colors">
                                        <option value={9}>9 por pÃ¡gina</option>
                                        <option value={18}>18 por pÃ¡gina</option>
                                        <option value={27}>27 por pÃ¡gina</option>
                                        <option value={50}>50 por pÃ¡gina</option>
                                    </select>
                                    <select value={filter.subject} onChange={e => setFilter({ ...filter, subject: e.target.value })} className="flex-1 md:flex-none h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-600 dark:text-slate-300 w-full md:w-auto cursor-pointer transition-colors">
                                        <option value="All">Todas as MatÃ©rias</option>
                                        {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><Grid size={16} /></button>
                                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}><List size={16} /></button>
                                </div>
                            </div>

                            <AdBanner type="sidebar" className="mb-6" />

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
                                                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-600 transition-colors flex-shrink-0 overflow-hidden">
                                                    {item.coverUrl ? (
                                                        <img src={getAssetUrl(item.coverUrl)} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <FileText size={18} />
                                                    )}
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
                                            {item.coverUrl ? <img src={getAssetUrl(item.coverUrl)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><FileText size={40} /></div>}
                                            <div className="absolute top-3 left-3"><span className="px-2 py-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-md shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">{item.type}</span></div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-1 line-clamp-2 transition-colors">{item.title}</h3>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase transition-colors">{item.authorName}</p>
                                                {(item.topic || item.subjectText) && (
                                                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase">
                                                        â€¢ {item.topic || item.subjectText}
                                                    </span>
                                                )}
                                                {item.year && (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                                                        â€¢ {item.year}
                                                    </span>
                                                )}
                                            </div>
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
                                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">PrÃ³xima</button>
                            </div>
                        )}
                    </>
                ) : (
                    /* ABA MEUS PEDIDOS */
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between transition-colors">
                            <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors"><History size={18} className="text-indigo-600 dark:text-indigo-400" /> HistÃ³rico de Compras</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{myOrders.length} Pedidos</span>
                        </div>
                        {myOrders.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 dark:text-slate-600 transition-colors">
                                <Package size={40} className="mx-auto mb-3 opacity-50" />
                                <p className="text-sm font-medium">VocÃª ainda nÃ£o comprou nenhum material.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Material</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Protocolo</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Data</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Valor</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Status</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">AÃ§Ãµes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {myOrders.map(order => {
                                            const isSuccess = order.status === 'completed' || order.status === 'approved';
                                            const daysSince = (Date.now() - new Date(order.timestamp).getTime()) / (1000 * 60 * 60 * 24);
                                            const canRefund = daysSince <= 7 && isSuccess;
                                            const canDownload = daysSince > 7 && isSuccess;

                                            return (
                                                <tr key={order.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${order.status === 'refunded' ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                                                    <td className="p-4">
                                                        <div className={`flex flex-col ${order.status === 'refunded' ? 'line-through' : ''}`}>
                                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{order.materialTitle}</span>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-tighter">ID: {order.materialId}</span>
                                                        </div>
                                                    </td>
                                                    <td className={`p-4 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 ${order.status === 'refunded' ? 'line-through' : ''}`}>#{String(order.id).slice(0, 8)}</td>
                                                    <td className={`p-4 text-xs font-medium text-slate-600 dark:text-slate-400 ${order.status === 'refunded' ? 'line-through' : ''}`}>{new Date(order.timestamp).toLocaleDateString()}</td>
                                                    <td className={`p-4 font-black text-slate-900 dark:text-slate-100 text-sm ${order.status === 'refunded' ? 'line-through' : ''}`}>R$ {order.amount.toFixed(2)}</td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest transition-colors inline-flex items-center gap-1 ${isSuccess ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                                            order.status === 'refunded' ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 line-through' :
                                                                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                            }`}>
                                                            {isSuccess ? 'ConcluÃ­do' : order.status === 'refund_requested' ? (
                                                                <>
                                                                    <Clock size={12} /> Reembolso Solicitado
                                                                </>
                                                            ) : order.status === 'refunded' ? 'Reembolsado' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isSuccess && (
                                                                <>
                                                                    <button
                                                                        onClick={() => navigate(`/read/${order.materialId}`)}
                                                                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                                                        title="Ler Agora"
                                                                    >
                                                                        <BookOpen size={16} />
                                                                    </button>

                                                                    {canDownload ? (
                                                                        <button
                                                                            onClick={() => handleAccessMaterial(materials.find(m => m.id === order.materialId)!, 'download')}
                                                                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                                                            title="Baixar PDF"
                                                                        >
                                                                            <Download size={16} />
                                                                        </button>
                                                                    ) : (
                                                                        <div className="group/tooltip relative">
                                                                            <button
                                                                                disabled
                                                                                className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                                                                title={`Download liberado em ${Math.ceil(7 - daysSince)} dias`}
                                                                            >
                                                                                <Download size={16} />
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {canRefund && (
                                                                        <button
                                                                            onClick={() => { setRefundTxId(order.id); setRefundReason(''); }}
                                                                            className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                                            title="Solicitar Reembolso"
                                                                        >
                                                                            <RefreshCcw size={16} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {order.status === 'refund_requested' && (
                                                                <button
                                                                    onClick={() => handleCancelRefundClick(order.id)}
                                                                    className="p-1.5 text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                                                                    title="Cancelar SolicitaÃ§Ã£o"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Modal de Cancelamento de Reembolso */}
                        {showCancelRefundModal && createPortal(
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in transition-all">
                                <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-scale-in border border-slate-200 dark:border-slate-800 text-center space-y-4">
                                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-800/30">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Cancelar SolicitaÃ§Ã£o?</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                                            Ao cancelar, sua compra voltarÃ¡ a ser processada normalmente e vocÃª manterÃ¡ o acesso ao material.
                                        </p>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setShowCancelRefundModal(false)}
                                            className="flex-1 h-10 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Voltar
                                        </button>
                                        <button
                                            onClick={confirmCancelRefund}
                                            className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-200 dark:shadow-none transition-all"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}

                        {/* Ãrea de Pedido de Reembolso Modal/Overlay */}
                        {refundTxId && createPortal(
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in transition-all">
                                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 animate-scale-in border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <RefreshCcw className="text-red-500" /> Solicitar Reembolso
                                        </h3>
                                        <button onClick={() => setRefundTxId(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50 mb-6">
                                        <p className="text-xs text-red-700 dark:text-red-400 font-bold leading-relaxed">
                                            De acordo com a Lei vigente, vocÃª tem atÃ© 7 dias para desistir da compra.
                                            Ao confirmar, seu acesso serÃ¡ revogado e o valor estornado.
                                        </p>
                                    </div>

                                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Motivo do Reembolso</label>
                                    <textarea
                                        value={refundReason}
                                        onChange={e => setRefundReason(e.target.value)}
                                        placeholder="Explique por que deseja o reembolso..."
                                        className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-red-500/20 transition-all mb-6 text-slate-900 dark:text-slate-100"
                                    />

                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setRefundTxId(null)}
                                            className="flex-1 h-12 rounded-xl text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleRefundRequest}
                                            disabled={!refundReason.trim()}
                                            className="flex-1 h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none transition-all"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>
                )
                }
            </div>

            {/* Modal de Detalhe do Material */}
            {selectedMaterial && createPortal(
                <MaterialDetailModal
                    material={selectedMaterial}
                    isPurchased={isPurchased(selectedMaterial.id)}
                    currentUser={currentUser}
                    onClose={() => {
                        setSelectedMaterial(null);
                        setInitialModalTab('overview');
                        // Clean up URL to prevent reopening on reload if desired, but for now just close it.
                        if (window.location.hash.includes('openMaterial=')) {
                            window.location.hash = '/marketplace';
                        }
                    }}
                    onBuy={() => handleBuy(selectedMaterial)}
                    onRead={() => handleAccessMaterial(selectedMaterial, 'read')}
                    addToast={addToast}
                    initialTab={initialModalTab}
                />,
                document.body
            )}

            {/* Checkout Modal */}

            {/* Checkout Modal - Portal for z-index safety */}
            {
                showStripeCheckout && checkoutMaterial && (
                    <PaymentModal
                        material={checkoutMaterial}
                        currentUser={currentUser}
                        onClose={() => {
                            setShowStripeCheckout(false);
                            setCheckoutMaterial(null);
                        }}
                        onSuccess={() => {
                            setShowStripeCheckout(false);
                            fetchUserTransactions(); // Refresh transactions

                            // Optimistic update
                            if (currentUser && checkoutMaterial) {
                                if (!currentUser.purchasedMaterialIds) currentUser.purchasedMaterialIds = [];
                                if (!currentUser.purchasedMaterialIds.includes(checkoutMaterial.id)) {
                                    currentUser.purchasedMaterialIds.push(checkoutMaterial.id);
                                }
                            }
                            setShowSuccessModal(true);
                        }}
                    />
                )
            }

            {/* Success Modal */}
            {
                showSuccessModal && checkoutMaterial && (
                    <SuccessModal
                        material={checkoutMaterial}
                        onClose={() => {
                            setShowSuccessModal(false);
                            setCheckoutMaterial(null);
                        }}
                        onAccess={() => {
                            setShowSuccessModal(false);
                            setCheckoutMaterial(null);
                            // Navigate to "My Materials" tab or filter
                            setActiveTab('orders');
                            setViewMode('list');
                        }}
                    />
                )
            }
        </div >
    );
};

export default Marketplace;
