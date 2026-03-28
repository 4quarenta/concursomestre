import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
   User, Mail, Star, Book, Settings, Shield,
   CreditCard, StickyNote, Zap, TrendingUp,
   ChevronRight, X, BarChart3, Target, Layout, 
   ShieldCheck, Bell, Info, Users, LogOut, Crown,
   Package, ExternalLink, BookOpen, Download, Trash2,
   AlertTriangle, XCircle, ArrowRight, CheckCircle2, Gift,
   Share2, Copy, Camera, Upload, AlertCircle, RotateCcw,
   Loader2, ShieldAlert, MousePointer2, Wallet
} from 'lucide-react';
import {
   AreaChart, Area, XAxis, YAxis, Tooltip,
   ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Subject } from '../types';
import AuthModal from '../components/AuthModal';
import { apiClient, ENDPOINTS, buildDownloadUrl } from '../src/core/api';
import { planService } from '../src/features/plans/services/planService';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';
type ProfileTab = 'evolution' | 'notebook' | 'materials' | 'personal' | 'billing' | 'billing-history' | 'security' | 'referral';

const Profile: React.FC = () => {
    const { currentUser, logout, login, refreshUser, updateUser } = useAuth();
    const { questions, userNotes, userAnswers, systemSettings } = useData();
    const { addToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<ProfileTab>('evolution');
    const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
    const [evolutionRange, setEvolutionRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Novos Estados para Funcionalidades Modernas
    const [userMaterials, setUserMaterials] = useState<any[]>([]);
    const [userCards, setUserCards] = useState<any[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState(false);
    const [userTransactions, setUserTransactions] = useState<any[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [referralStats, setReferralStats] = useState<any>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [isSavingCard, setIsSavingCard] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Sincronizar aba com parâmetro da URL (?tab=)
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam && ['evolution', 'notebook', 'materials', 'personal', 'billing', 'billing-history', 'security', 'referral'].includes(tabParam)) {
            setActiveTab(tabParam as ProfileTab);
        }
    }, [location.search]);

    // Handlers de API para Gerenciamento de Dados
    const fetchUserCards = async () => {
        if (!currentUser?.id) return;
        setIsLoadingCards(true);
        try {
            const res: any = await apiClient.post('users/list_cards.php', { user_id: currentUser.id });
            if (res.success) setUserCards(res.cards || []);
        } catch (err) {
            console.error('Failed to fetch cards', err);
        } finally {
            setIsLoadingCards(false);
        }
    };

    const handleRemoveCard = async (cardId: string) => {
        const card = userCards.find(c => c.id === cardId);
        if (card?.locked_by_recurring === 1) {
            return addToast('Este cartão não pode ser removido pois está vinculado a uma assinatura ativa.', 'warning');
        }

        if (!window.confirm('Tem certeza que deseja remover este cartão?')) return;
        try {
            const res: any = await apiClient.post('users/remove_card.php', { user_id: currentUser.id, card_id: cardId });
            if (res.success) {
                addToast('Cartão removido com sucesso!', 'success');
                fetchUserCards();
            } else {
                addToast(res.message || 'Erro ao remover cartão.', 'error');
            }
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Erro ao remover cartão.', 'error');
        }
    };

    const handleSetDefaultCard = async (cardId: string) => {
        try {
            const res: any = await apiClient.post('users/set_default_card.php', { user_id: currentUser.id, card_id: cardId });
            if (res.success) {
                addToast('Cartão padrão atualizado!', 'success');
                fetchUserCards();
            }
        } catch (err) {
            addToast('Erro ao definir cartão padrão.', 'error');
        }
    };

    const handleSaveCard = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentUser?.id) return;
        
        setIsSavingCard(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            user_id: currentUser.id,
            card_number: (formData.get('cardNumber') as string).replace(/\s/g, ''),
            card_name: formData.get('cardName'),
            card_expiry: formData.get('expiry'),
            brand: formData.get('brand') || 'outros'
        };

        try {
            const res: any = await apiClient.post('users/save_card.php', data);
            if (res.success) {
                addToast('Cartão salvo com sucesso!', 'success');
                setIsAddingCard(false);
                fetchUserCards();
            } else {
                addToast(res.message || 'Erro ao salvar cartão.', 'error');
            }
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Erro de rede ao salvar cartão.', 'error');
        } finally {
            setIsSavingCard(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!currentUser?.id || !currentUser.subscription) return;
        
        const start = new Date(currentUser.subscription.current_period_start).getTime();
        const now = new Date().getTime();
        const isRefundable = (now - start) < (7 * 24 * 60 * 60 * 1000);

        try {
            const res = await planService.cancelSubscription(
                currentUser.id, 
                isRefundable ? 'arrependimento' : (cancelReason || 'user_request')
            );
            if (res.success) {
                addToast(isRefundable ? 'Assinatura cancelada e reembolso solicitado!' : 'Assinatura cancelada com sucesso.', 'success');
                setShowCancelModal(false);
                await refreshUser();
            } else {
                addToast(res.message || 'Erro ao cancelar assinatura.', 'error');
            }
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Erro ao processar cancelamento.', 'error');
        }
    };

    const handleToggleAutoRenew = async () => {
        if (!currentUser?.id || !currentUser.subscription) return;
        
        const newValue = !currentUser.subscription.auto_renew;
        
        if (newValue && userCards.length === 0) {
            addToast('Você precisa de um cartão salvo para ativar a renovação automática.', 'warning');
            setIsAddingCard(true);
            setTimeout(() => {
                document.getElementById('save-card-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return;
        }

        try {
            const res: any = await planService.updateRenewal(newValue);
            if (res.success) {
                addToast(newValue ? 'Renovação automática ativada!' : 'Renovação automática desativada.', 'success');
                await refreshUser();
            } else {
                addToast(res.message || 'Erro ao atualizar renovação.', 'error');
            }
        } catch (err: any) {
            addToast(err.response?.data?.message || 'Erro ao processar solicitação.', 'error');
        }
    };

    const fetchUserTransactions = async () => {
        if (!currentUser?.id) return;
        setIsLoadingTransactions(true);
        try {
            const res: any = await apiClient.get(`transactions/list.php?user_id=${currentUser.id}&limit=50`);
            if (res.success) setUserTransactions(res.data?.rows || []);
        } catch (err) {
            console.error('Failed to fetch transactions', err);
            addToast('Erro ao carregar histórico de pagamentos.', 'error');
        } finally {
            setIsLoadingTransactions(false);
        }
    };

    const fetchUserMaterials = async () => {
        if (!currentUser?.id) return;
        try {
            const res: any = await apiClient.get(`users/materials.php?userId=${currentUser.id}`);
            if (res.success) setUserMaterials(res.materials || res.data?.materials || []);
        } catch (err) {
            console.error('Error fetching materials:', err);
        }
    };

    const fetchReferralStats = async () => {
        try {
            const res: any = await apiClient.get('referrals/stats.php');
            if (res.success) setReferralStats(res.data);
        } catch (err) {
            console.error('Failed to fetch referral stats', err);
        }
    };

    // Atualizar dados quando a aba mudar
    React.useEffect(() => {
        if (activeTab === 'billing') fetchUserCards();
        if (activeTab === 'billing-history') fetchUserTransactions();
        if (activeTab === 'materials') fetchUserMaterials();
        if (activeTab === 'referral') fetchReferralStats();
    }, [activeTab]);

   const EXAM_AREAS = [
      { group: 'Carreiras', areas: ['Policial', 'Fiscal', 'Tribunais', 'Jurídico', 'Educação', 'Militar', 'Saúde', 'TI', 'Diplomata'] },
      { group: 'Exames', areas: ['Residência em Saúde', 'CFC - Exame de Suficiência', 'OAB - Exame de Ordem'] }
   ];

   const timelineData = useMemo(() => {
      const data: Record<string, { date: string, taxa: number, total: number }> = {};
      const now = new Date();
      let steps = 30;
      let format: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

      if (evolutionRange === 'today') {
         steps = now.getHours() + 1;
         format = { hour: '2-digit', minute: '2-digit' };
      } else if (evolutionRange === 'year') {
         steps = 12;
         format = { month: 'short' };
      } else if (evolutionRange === 'week') {
         steps = 7;
      }

      for (let i = steps - 1; i >= 0; i--) {
         const d = new Date(now);
         if (evolutionRange === 'today') d.setHours(d.getHours() - i, 0, 0, 0);
         else if (evolutionRange === 'year') { d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0); }
         else { d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); }

         const label = evolutionRange === 'today'
            ? `${d.getHours().toString().padStart(2, '0')}:00`
            : d.toLocaleDateString('pt-BR', format);

         data[label] = { date: label, taxa: 0, total: 0 };
      }

      userAnswers.forEach(ans => {
         const d = new Date(ans.timestamp);
         const label = evolutionRange === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString('pt-BR', format);
         if (data[label]) {
            const periodEntries = userAnswers.filter(a => {
               const ad = new Date(a.timestamp);
               const al = evolutionRange === 'today' ? `${ad.getHours().toString().padStart(2, '0')}:00` : ad.toLocaleDateString('pt-BR', format);
               return al === label;
            });
            const correct = periodEntries.filter(a => a.isCorrect).length;
            data[label].taxa = Math.round((correct / periodEntries.length) * 100);
            data[label].total = periodEntries.length;
         }
      });
      return Object.values(data);
   }, [userAnswers, evolutionRange]);


   const generalStats = useMemo(() => {
      const total = userAnswers.length;
      const correct = userAnswers.filter(a => a.isCorrect).length;
      const wrong = total - correct;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      const diffStats = {
         'Fácil': { total: 0, correct: 0 },
         'Médio': { total: 0, correct: 0 },
         'Difícil': { total: 0, correct: 0 }
      };

      userAnswers.forEach(ans => {
         const q = questions.find(item => item.id === ans.questionId);
         if (q) {
            const label = q.difficulty === 'Fácil' ? 'Fácil' : q.difficulty === 'Médio' ? 'Médio' : 'Difícil';
            if (diffStats[label as keyof typeof diffStats]) {
               diffStats[label as keyof typeof diffStats].total++;
               if (ans.isCorrect) diffStats[label as keyof typeof diffStats].correct++;
            }
         }
      });

      // Topics progress
      const uniqueTopics = new Set(userAnswers.map(ans => questions.find(q => q.id === ans.questionId)?.topic).filter(Boolean));
      const allPossibleTopics = new Set(questions.map(q => q.topic).filter(Boolean));
      const topicsProgress = allPossibleTopics.size > 0 ? Math.round((uniqueTopics.size / allPossibleTopics.size) * 100) : 0;

      return { total, correct, wrong, accuracy, xp: total * 10, diffStats, topicsProgress };
   }, [userAnswers, questions]);

   if (!currentUser) {
      return (
         <div className="max-w-xl mx-auto pt-20 pb-20 px-6 text-center animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
               <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                  <User size={40} />
               </div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">Identifique-se</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                  Faça login para acompanhar seu desempenho, gerenciar sua assinatura e salvar seu progresso.
               </p>
               <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
               >
                  Entrar ou Criar Conta
               </button>
            </div>
            <AuthModal
               isOpen={showAuthModal}
               onClose={() => setShowAuthModal(false)}
               title="Acesse seu Perfil"
               description="Gerencie seus dados e acompanhe sua evolução detalhada."
            />
         </div>
      );
   }

    const SidebarItem = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => {
                setActiveTab(id);
                navigate(`?tab=${id}`, { replace: true });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}
        >
            <div className="flex items-center gap-3"><Icon size={16} /> {label}</div>
            {activeTab === id && <ChevronRight size={14} className="text-indigo-400 dark:text-indigo-500" />}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20 space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                    <User className="text-indigo-600 dark:text-indigo-400" /> Meu Perfil
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 transition-colors">Gerencie seus dados, assinatura e acompanhe sua evolução.</p>
            </header>

            {/* Banner: Conteúdo Incompleto */}
            {currentUser && (!currentUser.cpf || !currentUser.address?.zipCode) && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg animate-fade-in border border-indigo-400/30">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <User size={24} className="text-white" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Complete seu cadastro para facilitar suas compras</h4>
                            <p className="text-xs text-indigo-100 mt-0.5">Adicione seu CPF e endereço para agilizar o checkout de materiais e planos.</p>
                        </div>
                    </div>
                    <button onClick={() => setActiveTab('personal')} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 shrink-0 active:scale-95">
                        Completar Agora <ArrowRight size={14} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* SIDEBAR DE NAVEGAÇÃO */}
                <aside className="lg:col-span-3 space-y-6">
                    {/* Cartão do Usuário */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-3 transition-colors">
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = async (e: any) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const formData = new FormData();
                                        formData.append('photo', file);
                                        try {
                                            const res: any = await apiClient.post('users/upload_photo.php', formData);
                                            if (res.success) {
                                                addToast('Foto de perfil atualizada!', 'success');
                                                refreshUser();
                                            }
                                        } catch (err) {
                                            addToast('Erro ao enviar foto.', 'error');
                                        }
                                    }
                                };
                                input.click();
                            }}
                        >
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 transition-colors overflow-hidden relative">
                                {currentUser.photoUrl ? (
                                    <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-black">{currentUser.name?.charAt(0) || 'U'}</span>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={20} className="text-white" />
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                                LVL {currentUser.level}
                            </div>
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm transition-colors">{currentUser.name}</h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px] transition-colors">{currentUser.email}</p>
                        </div>
                        <div className="w-full pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-center transition-colors">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors ${(currentUser.plan && currentUser.plan.includes('Elite')) || (currentUser.subscription?.plan?.name && currentUser.subscription.plan.name.includes('Elite')) ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}>
                                Plano {currentUser.subscription?.plan?.name || currentUser.plan || 'Gratuito'}
                            </span>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 transition-colors">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Menu</div>
                        <SidebarItem id="evolution" label="Desempenho" icon={TrendingUp} />
                        <SidebarItem id="notebook" label="Minhas Anotações" icon={StickyNote} />
                        <SidebarItem id="materials" label="Meus Materiais" icon={Package} />
                        
                        <div className="h-px bg-slate-50 dark:bg-slate-800 my-2 transition-colors" />
                        
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Conta</div>
                        <SidebarItem id="personal" label="Dados Pessoais" icon={User} />
                        <SidebarItem id="billing" label="Assinatura" icon={CreditCard} />
                        <SidebarItem id="billing-history" label="Transações" icon={BarChart3} />
                        <SidebarItem id="referral" label="Indique e Ganhe" icon={Gift} />
                        <SidebarItem id="security" label="Privacidade" icon={ShieldCheck} />
                    </div>

                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3 text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-xs rounded-xl transition-all border border-red-100 dark:border-red-900/30">
                        <LogOut size={14} /> Sair da Conta
                    </button>
                </aside>

            {/* ÁREA DE CONTEÚDO */}
            <main className="lg:col-span-9 space-y-6">

               {activeTab === 'evolution' && (
                  <div className="space-y-6 animate-fade-in">
                     {/* NOVO CABEÇALHO DE ESTUDOS */}
                     <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
                        <div className="flex-1 space-y-3">
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estudando questões para</span>
                           </div>
                           <div className="flex flex-col md:flex-row md:items-center gap-4">
                              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight transition-colors">
                                 {currentUser.targetExam || 'Não selecionado'}
                              </h2>
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg transition-colors">Pré edital</span>
                                 <button
                                    onClick={() => setShowGoalModal(true)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                 >
                                    <TrendingUp size={12} /> Trocar guia
                                 </button>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 pl-6 border-l border-slate-100 dark:border-slate-800 transition-colors">
                           <div className="relative w-14 h-14">
                              <svg className="w-full h-full -rotate-90">
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" />
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - generalStats.topicsProgress / 100)} className="text-orange-500" strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-slate-100">{generalStats.topicsProgress}%</div>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 justify-end">Assuntos Concluídos <Info size={10} /></p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">Todos os assuntos</p>
                           </div>
                        </div>
                     </div>

                     {/* Stats Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><Target size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Geral</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.accuracy}%</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Taxa de Acertos</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Book size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.total}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Questões Respondidas</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><Zap size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Rank</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.xp}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Pontos de Experiência</p>
                        </div>
                     </div>

                     {/* RESUMO DO DESEMPENHO */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 uppercase tracking-wide">
                              <span className="w-2 h-5 bg-orange-500 rounded-sm" /> Resumo do meu desempenho
                           </h3>
                           <div className="flex items-center gap-3">
                              <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                                 {(['today', 'week', 'month', 'year'] as const).map(range => (
                                    <button
                                       key={range}
                                       onClick={() => setEvolutionRange(range)}
                                       className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${evolutionRange === range ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                                    >
                                       {range === 'today' ? 'Hoje' : range === 'week' ? 'Semana' : range === 'month' ? 'Mês' : 'Ano'}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                           {/* GERAL GAUGE */}
                           <div className="md:col-span-4 bg-orange-50/30 dark:bg-orange-900/5 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Geral <Info size={10} /></h4>
                              <div className="relative w-48 h-24 overflow-hidden">
                                 <svg className="w-full h-full">
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" className="dark:stroke-slate-800" />
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="url(#gradient)" strokeWidth="20" strokeLinecap="round" strokeDasharray="301" strokeDashoffset={301 * (1 - generalStats.accuracy / 100)} />
                                    <defs>
                                       <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                          <stop offset="0%" stopColor="#ef4444" />
                                          <stop offset="50%" stopColor="#f59e0b" />
                                          <stop offset="100%" stopColor="#10b981" />
                                       </linearGradient>
                                    </defs>
                                 </svg>
                                 <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-1">
                                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{generalStats.accuracy}%</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${generalStats.accuracy >= 75 ? 'bg-emerald-100 text-emerald-700' : generalStats.accuracy >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                       {generalStats.accuracy >= 75 ? 'ALTO' : generalStats.accuracy >= 50 ? 'MÉDIO' : 'BAIXO'}
                                    </span>
                                 </div>
                              </div>
                              <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 max-w-[200px]">
                                 Sua probabilidade de aprovação para este cargo é {' '}
                                 <span className="text-emerald-500 font-black">{generalStats.accuracy >= 70 ? 'Superior' : 'Crescente'}</span> em relação à concorrência.
                              </p>
                           </div>

                           {/* NÍVEL DE DIFICULDADE */}
                           <div className="md:col-span-4 space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Nível de dificuldade <Info size={10} /></h4>
                              <div className="space-y-4 pt-2">
                                 {Object.entries(generalStats.diffStats).map(([label, stats]) => {
                                    const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                                    return (
                                       <div key={label} className="grid grid-cols-12 items-center gap-3">
                                          <span className="col-span-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                                          <div className="col-span-7 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${acc}%` }} />
                                          </div>
                                          <span className="col-span-2 text-[10px] font-black text-slate-800 dark:text-slate-200 text-right">{acc}%</span>
                                       </div>
                                    )
                                 })}
                              </div>
                           </div>

                           {/* RESOLUÇÕES */}
                           <div className="md:col-span-4 space-y-3">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Resoluções <Info size={10} /></h4>
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex justify-between items-center transition-colors">
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-indigo-600 block">{generalStats.total}</span> Resoluções</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-emerald-600 block">{generalStats.correct}</span> Acertos</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-red-600 block">{generalStats.wrong}</span> Erros</span>
                              </div>
                              <div className="pt-4 space-y-2">
                                 <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-widest">Desempenho por Período</p>
                                 <div className="h-24 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={timelineData}>
                                          <defs>
                                             <linearGradient id="colorTotalProfile" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                             </linearGradient>
                                          </defs>
                                          <XAxis dataKey="date" hide />
                                          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={20} />
                                          <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#colorTotalProfile)" name="Quantidade" fillOpacity={1} />
                                          <Area type="monotone" dataKey="taxa" stroke="#6366f1" strokeWidth={1} fillOpacity={0} name="Precisão (%)" />
                                       </AreaChart>
                                    </ResponsiveContainer>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'notebook' && (
                  <div className="space-y-6 animate-fade-in">
                     <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Minhas Anotações</h2>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{userNotes.length} notas</span>
                     </div>
                     {userNotes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {userNotes.map(n => (
                              <div key={n.id} className="p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-2xl group relative hover:shadow-sm transition-all">
                                 <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium leading-relaxed whitespace-pre-wrap">{n.text}</p>
                                 <div className="mt-4 pt-3 border-t border-yellow-100/50 dark:border-yellow-900/30 flex justify-between items-center">
                                    <span className="text-[10px] text-yellow-600/60 dark:text-yellow-500/40 font-bold uppercase">{new Date(n.timestamp).toLocaleDateString()}</span>
                                    <button onClick={() => saveNote(n.questionId, '')} className="text-yellow-600/60 hover:text-red-500 transition-colors"><X size={14} /></button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <StickyNote size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhuma anotação encontrada.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Adicione notas nas questões durante seus estudos.</p>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'materials' && (
                   <div className="space-y-6 animate-fade-in">
                       <div className="flex justify-between items-center">
                           <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Meus Materiais</h2>
                           <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{userMaterials.length} itens</span>
                       </div>
                       
                       {userMaterials.length > 0 ? (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                               <table className="w-full text-left border-collapse">
                                   <thead>
                                       <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Material</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden md:table-cell">Aquirido em</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Ação</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                       {userMaterials.map((material: any) => {
                                           const daysSince = (Date.now() - new Date(material.purchasedAt).getTime()) / (1000 * 60 * 60 * 24);
                                           const canDownload = daysSince >= 7;
                                           
                                           return (
                                               <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                   <td className="p-4">
                                                       <div className="flex items-center gap-4">
                                                           <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0">
                                                               {material.coverUrl ? <img src={material.coverUrl} alt="" className="w-full h-full object-cover" /> : <Package size={20} />}
                                                           </div>
                                                           <div>
                                                               <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{material.title}</h3>
                                                               <p className="text-[10px] font-black uppercase text-indigo-500 mt-0.5 tracking-tight">{material.type === 'pdf' ? 'PDF Interativo' : 'Curso Completo'}</p>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="p-4 hidden md:table-cell">
                                                       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(material.purchasedAt).toLocaleDateString()}</span>
                                                   </td>
                                                   <td className="p-4 text-right">
                                                       <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                               onClick={() => navigate(`/read/${material.id}`)}
                                                               className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none"
                                                            >
                                                                <BookOpen size={14} /> Ler
                                                            </button>
                                                            
                                                            {canDownload ? (
                                                                <button 
                                                                    onClick={() => window.open(buildDownloadUrl(material.id), '_blank')}
                                                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 dark:shadow-none"
                                                                >
                                                                    <Download size={14} /> Baixar
                                                                </button>
                                                            ) : (
                                                                <div className="group/tooltip relative">
                                                                    <button disabled className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-not-allowed opacity-60">
                                                                        <Download size={14} /> Baixar
                                                                    </button>
                                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-medium">
                                                                        Download disponível em {Math.ceil(7 - daysSince)} dias (Política de Garantia).
                                                                    </div>
                                                                </div>
                                                            )}
                                                       </div>
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       ) : (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                               <Package size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhum material adquirido.</p>
                               <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Visite o Marketplace para encontrar materiais de estudo.</p>
                           </div>
                       )}
                   </div>
               )}

               {activeTab === 'personal' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in transition-colors">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 transition-colors">Dados Pessoais</h2>
                      <form
                        onSubmit={async (e) => {
                           e.preventDefault();
                           if (isUpdatingProfile) return;
                           
                           setIsUpdatingProfile(true);
                           const formData = new FormData(e.currentTarget);
                           
                           const getValue = (name: string) => (formData.get(name) as string) || '';
                           
                           const updates = {
                               name: getValue('name'),
                               cpf: getValue('cpf').replace(/\D/g, ''),
                               targetExam: getValue('targetExam'),
                               address: {
                                  zipCode: getValue('zipCode').replace(/\D/g, ''),
                                  street: getValue('street'),
                                  number: getValue('number'),
                                  complement: getValue('complement'),
                                  neighborhood: getValue('neighborhood'),
                                  city: getValue('city'),
                                  state: getValue('state')
                               }
                           };

                           // Manual Validation for better feedback
                           if (!updates.name) { addToast('Nome é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.cpf) { addToast('CPF é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.zipCode) { addToast('CEP é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.street) { addToast('Rua é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.number) { addToast('Número é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.neighborhood) { addToast('Bairro é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.city) { addToast('Cidade é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.state) { addToast('Estado (UF) é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }

                           try {
                               await updateUser(updates);
                               // Notification is handled by AuthContext
                           } catch (err: any) {
                               console.error('Profile update error:', err);
                               const msg = err.response?.data?.message || 'Erro ao sincronizar. Verifique sua conexão.';
                               addToast(msg, 'error');
                           } finally {
                               setIsUpdatingProfile(false);
                           }
                        }}
                        noValidate
                        className="space-y-6 max-w-2xl"
                     >
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Nome Completo</label>
                            <input name="name" type="text" defaultValue={currentUser.name} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">E-mail de Acesso</label>
                            <input name="email" type="email" defaultValue={currentUser.email} readOnly className="w-full h-11 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed transition-all font-sans" title="Não é possível alterar o email" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CPF</label>
                               <input name="cpf" type="text" defaultValue={currentUser.cpf || ''} placeholder="000.000.000-00" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors font-sans" />
                           </div>
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Foco de Estudo</label>
                               <div className="relative group/exam">
                                    <input name="targetExam" type="text" readOnly onClick={() => setShowGoalModal(true)} value={currentUser.targetExam || ''} placeholder="Selecione seu foco" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-900 transition-colors font-sans" />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover/exam:text-indigo-500 transition-colors">
                                        <ChevronRight size={16} />
                                    </div>
                               </div>
                           </div>
                        </div>

                         <div className="space-y-4 pt-2">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">Dados de Cobrança / Endereço</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">CEP</label>
                                   <input name="zipCode" type="text" defaultValue={currentUser.address?.zipCode || ''} placeholder="00000-000" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Logradouro / Rua</label>
                                   <input name="street" type="text" defaultValue={currentUser.address?.street || ''} placeholder="Ex: Av. Paulista" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Número</label>
                                   <input name="number" type="text" defaultValue={currentUser.address?.number || ''} placeholder="123" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Complemento (Opcional)</label>
                                     <input name="complement" type="text" defaultValue={currentUser.address?.complement || ''} placeholder="Ex: Apto 101, Bloco A" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Bairro</label>
                                     <input name="neighborhood" type="text" defaultValue={currentUser.address?.neighborhood || ''} placeholder="Ex: Centro" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                               <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Cidade</label>
                                   <input name="city" type="text" defaultValue={currentUser.address?.city || ''} placeholder="Ex: São Paulo" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Estado (UF)</label>
                                   <input name="state" type="text" defaultValue={currentUser.address?.state || ''} placeholder="SP" maxLength={2} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans uppercase" />
                               </div>
                            </div>
                         </div>

                         <div className="pt-4 flex items-center gap-4">
                            <button 
                                type="submit" 
                                disabled={isUpdatingProfile}
                                className={`px-10 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all flex items-center gap-2 ${isUpdatingProfile ? 'opacity-70 cursor-wait' : 'hover:-translate-y-1 active:scale-95'}`}
                            >
                               {isUpdatingProfile ? (
                                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                               ) : (
                                   <ShieldCheck size={16} />
                               )}
                               {isUpdatingProfile ? 'Sincronizando...' : 'Sincronizar Perfil'}
                            </button>
                         </div>
                     </form>
                  </div>
               )}

               {activeTab === 'billing' && (
                  <div className="space-y-6 animate-fade-in">
                     {/* Alerta de Problema de Pagamento */}
                     {currentUser.paymentIssue && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-5 rounded-2xl flex items-center gap-5 transition-all">
                           <div className="w-12 h-12 bg-rose-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                              <ShieldAlert size={24} className="text-white" />
                           </div>
                           <div className="flex-1 space-y-0.5">
                              <h3 className="text-sm font-black text-rose-600 dark:text-rose-500 uppercase tracking-tight">Pagamento Pendente</h3>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                                 {currentUser.paymentIssue.message || 'Atualize seus dados para evitar o bloqueio total da sua conta.'}
                              </p>
                           </div>
                           <button 
                              onClick={() => {
                                 const el = document.getElementById('save-card-section');
                                 el?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="px-4 py-2 bg-slate-900 dark:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all"
                           >
                              Resolver
                           </button>
                        </div>
                     )}

                     {/* Resumo da Assinatura */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <CreditCard size={120} className="text-indigo-600" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Assinatura Ativa</h4>
                                    {currentUser.subscription?.status === 'active' && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                                    Plano {currentUser.subscription?.plan?.name || currentUser.plan || 'Gratuito'}
                                    {((currentUser.plan && currentUser.plan.includes('Elite')) || (currentUser.subscription?.plan?.name && currentUser.subscription.plan.name.includes('Elite'))) && <Crown className="text-amber-500" size={20} />}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                    {currentUser.subscription?.current_period_end 
                                        ? `Sua assinatura renova automaticamente em ${new Date(currentUser.subscription.current_period_end).toLocaleDateString()}.`
                                        : 'Acesse recursos essenciais para sua aprovação.'}
                                </p>
                            </div>

                            {currentUser.subscription?.current_period_end && (
                                <div className="flex flex-col items-end gap-1 text-right animate-in fade-in duration-500">
                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Dias Restantes</div>
                                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                        {(() => {
                                            const diff = new Date(currentUser.subscription.current_period_end).getTime() - new Date().getTime();
                                            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                            return days > 0 ? days : 0;
                                        })()}
                                    </div>
                                    
                                    {currentUser.subscription?.status === 'active' && (
                                        <div className="flex flex-col items-end gap-2 mt-2">
                                            {userTransactions.some((t:any) => t.status === 'refund_requested') ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200/50">Reembolso em Análise</span>
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm('Deseja realmente cancelar sua solicitação de reembolso? Sua assinatura permanecerá ativa.')) {
                                                                try {
                                                                    const res: any = await apiClient.post('subscriptions/cancel_refund.php', { user_id: currentUser.id });
                                                                    if (res.success) {
                                                                        addToast(res.message, 'success');
                                                                        mutateUser();
                                                                        fetchUserTransactions();
                                                                    }
                                                                } catch (err: any) {
                                                                    addToast('Erro ao cancelar solicitação.', 'error');
                                                                }
                                                            }
                                                        }}
                                                        className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest underline underline-offset-2 transition-colors"
                                                    >
                                                        Cancelar Solicitação
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    {(() => {
                                                        if (!currentUser.subscription?.current_period_start) return null;
                                                        const start = new Date(currentUser.subscription.current_period_start).getTime();
                                                        const now = new Date().getTime();
                                                        const isWithinSevenDays = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                                        
                                                        if (isWithinSevenDays) {
                                                            return (
                                                                <button 
                                                                    onClick={() => setShowCancelModal(true)}
                                                                    className="text-[10px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 uppercase tracking-widest transition-colors"
                                                                >
                                                                    Cancelar e Solicitar Reembolso
                                                                </button>
                                                            );
                                                        } else {
                                                            return (
                                                                <div className="flex items-center gap-1.5 opacity-60">
                                                                    <ShieldCheck size={12} className="text-emerald-500" />
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compromisso Ativo</span>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Toggle de Renovação Automática */}
                        {currentUser.subscription && currentUser.subscription.status === 'active' && (
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${currentUser.subscription?.auto_renew ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                                        <RotateCcw size={18} className={currentUser.subscription?.auto_renew ? 'animate-spin-slow' : ''} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Renovação Automática</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {currentUser.subscription?.auto_renew 
                                                ? 'Seu plano será renovado automaticamente ao fim do ciclo.' 
                                                : 'Sua assinatura será encerrada ao final do período atual.'}
                                        </p>
                                    </div>
                                </div>
                                <div 
                                    onClick={handleToggleAutoRenew}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner ${currentUser.subscription?.auto_renew ? 'bg-emerald-500 shadow-emerald-600/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg ${currentUser.subscription?.auto_renew ? 'right-0.5' : 'left-0.5'}`} />
                                </div>
                            </div>
                        )}
                     </div>

                     {/* CTA Ver Planos (Atrativo) */}
                     {(!currentUser.subscription || currentUser.plan === 'Free' || (currentUser.subscription?.plan?.name && !currentUser.subscription.plan.name.includes('Elite'))) && (
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none animate-in fade-in zoom-in duration-700 transition-all hover:scale-[1.01]">
                             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                                 <Zap size={140} className="fill-current" />
                             </div>
                             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                                 <div className="space-y-1">
                                     <div className="flex items-center justify-center md:justify-start gap-2">
                                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">Upgrade Disponível</span>
                                        <Crown size={14} className="text-amber-300" />
                                     </div>
                                     <h3 className="text-xl font-black tracking-tight leading-tight italic">Torne-se Elite e acelere sua aprovação!</h3>
                                     <p className="text-[11px] font-medium text-indigo-100 max-w-sm opacity-80">Acesse simulados exclusivos, mentoria com IA e banco de questões ilimitado.</p>
                                 </div>
                                 <button 
                                    onClick={() => navigate('/plans')}
                                    className="px-8 py-3 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-black/10 flex items-center gap-2 shrink-0 group"
                                 >
                                    Ver Planos Premium <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                 </button>
                             </div>
                        </div>
                     )}

                     {/* Métodos de Pagamento */}
                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden">
                        <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Formas de Pagamento</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Gerencie seus cartões salvos para renovações automáticas.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingCard(!isAddingCard)}
                                className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isAddingCard ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {isAddingCard ? <X size={14} /> : <CreditCard size={14} />} {isAddingCard ? 'Cancelar' : 'Novo Cartão'}
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-4">
                            {isAddingCard && (
                                <form onSubmit={handleSaveCard} className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Número do Cartão</label>
                                            <input name="cardNumber" type="text" placeholder="0000 0000 0000 0000" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Nome no Cartão</label>
                                            <input name="cardName" type="text" placeholder="JOÃO SILVA" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Validade (MM/AA)</label>
                                                <input name="expiry" type="text" placeholder="12/30" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Bandeira</label>
                                                <select name="brand" className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none">
                                                    <option value="visa">Visa</option>
                                                    <option value="mastercard">Mastercard</option>
                                                    <option value="elo">Elo</option>
                                                    <option value="amex">Amex</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <button disabled={isSavingCard} type="submit" className="w-full h-10 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                                        {isSavingCard ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                                        {isSavingCard ? 'Salvando...' : 'Salvar Cartão com Segurança'}
                                    </button>
                                </form>
                            )}

                            {isLoadingCards ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>
                            ) : userCards.length > 0 ? (
                                userCards.map((card: any) => (
                                    <div key={card.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-8 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1 shadow-sm">
                                                <img src={`https://img.icons8.com/color/48/000000/${card.brand?.toLowerCase() || 'credit-card'}.png`} alt={card.brand} className="h-full object-contain" onError={(e:any) => e.target.src = 'https://img.icons8.com/color/48/000000/credit-card.png'} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                                                        •••• {card.last_four_digits || card.last4 || '****'}
                                                    </span>
                                                    {card.is_default === 1 && <span className="text-[8px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200/50">Padrão</span>}
                                                    {card.locked_by_recurring === 1 && (
                                                        <div className="group/lock relative">
                                                            <span className="text-[8px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-help shadow-sm">
                                                                <ShieldAlert size={8} /> Assinatura Ativa
                                                            </span>
                                                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/lock:opacity-100 pointer-events-none transition-opacity z-50 font-medium normal-case">
                                                                Este cartão é o método de pagamento da sua assinatura principal.
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(() => {
                                                        const now = new Date();
                                                        const isExpired = card.exp_year < now.getFullYear() || (card.exp_year === now.getFullYear() && card.exp_month < (now.getMonth() + 1));
                                                        if (isExpired) {
                                                            return (
                                                                <span className="text-[8px] font-black uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200/50 flex items-center gap-1 animate-pulse">
                                                                    <AlertTriangle size={8} /> Expirado
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">Vence em {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {card.is_default !== 1 && (
                                                <button onClick={() => handleSetDefaultCard(card.id)} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    Definir Padrão
                                                </button>
                                            )}
                                            {card.locked_by_recurring !== 1 && (
                                                <button onClick={() => handleRemoveCard(card.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle size={24} className="text-slate-300" />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nenhuma forma de pagamento cadastrada.</p>
                                </div>
                            )}
                        </div>
                        
                        <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                            <Info size={14} className="text-slate-400 shrink-0" />
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                SEUS DADOS DE PAGAMENTO SÃO PROCESSADOS COM SEGURANÇA PELO MERCADO PAGO E NÃO FICAM ARMAZENADOS INTEGRALMENTE EM NOSSOS SERVIDORES.
                            </p>
                        </footer>
                     </div>
                  </div>
               )}

               {activeTab === 'billing-history' && (
                  <div className="space-y-6 animate-fade-in">
                      <div className="flex justify-between items-center">
                          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Histórico de Transações</h2>
                          <button onClick={fetchUserTransactions} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><RotateCcw size={18} /></button>
                      </div>

                      {isLoadingTransactions ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-20 flex justify-center"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
                      ) : userTransactions.length > 0 ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                              <table className="w-full text-left">
                                  <thead>
                                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Data</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Status</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Valor</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {userTransactions.map((tx: any) => (
                                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                              <td className="p-4"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{tx.dateFormatted}</span></td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Package size={14} /></div>
                                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tx.description || 'Assinatura'}</span>
                                                  </div>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                      tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' :
                                                      tx.status === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                                                      tx.status === 'refunded' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' :
                                                      'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                                                  }`}>
                                                      {tx.status === 'approved' ? 'Aprovado' : tx.status === 'pending' ? 'Pendente' : tx.status === 'refunded' ? 'Estornado' : 'Cancelado'}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-right"><span className="text-xs font-black text-slate-900 dark:text-slate-100">R$ {parseFloat(tx.amount).toFixed(2)}</span></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      ) : (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                              <BarChart3 size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Nenhuma transação registrada.</p>
                          </div>
                      )}
                  </div>
               )}

               {activeTab === 'referral' && (
                   <div className="space-y-6 animate-fade-in">
                       {/* Banner do Programa */}
                       <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Gift size={160} />
                            </div>
                            <div className="max-w-md relative z-10 space-y-4">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">Programa de Parceria</span>
                                <h2 className="text-3xl font-black tracking-tight leading-tight">Indique amigos e ganhe 20% de comissão!</h2>
                                <p className="text-sm font-medium text-indigo-100 leading-relaxed">Compartilhe seu link exclusivo. Cada nova assinatura em planos Elite através do seu link gera créditos automáticos para você.</p>
                                
                                <div className="pt-4 flex items-center gap-3">
                                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center justify-between gap-4">
                                        <code className="text-xs font-black tracking-widest text-indigo-100 truncate">
                                            https://concursomestre.com/r/{currentUser.id}
                                        </code>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`https://concursomestre.com/r/${currentUser.id}`);
                                                setIsCopying(true);
                                                addToast('Link copiado para a área de transferência!', 'success');
                                                setTimeout(() => setIsCopying(false), 2000);
                                            }}
                                            className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 shrink-0"
                                        >
                                            {isCopying ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            {isCopying ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <button className="p-4 bg-indigo-500/30 hover:bg-indigo-500/40 rounded-2xl border border-white/20 transition-all">
                                        <Share2 size={20} />
                                    </button>
                                </div>
                            </div>
                       </div>

                       {/* Stats das Indicações */}
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {[
                               { label: 'Total de Cliques', value: referralStats?.clicks || 0, icon: MousePointer2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                               { label: 'Indicações Ativas', value: referralStats?.conversions || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                               { label: 'Saldo a Receber', value: `R$ ${(referralStats?.balance || 0).toFixed(2)}`, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' }
                           ].map((stat, i) => (
                               <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-xl ${stat.bg} dark:bg-slate-800 flex items-center justify-center ${stat.color} transition-colors`}>
                                           <stat.icon size={24} />
                                       </div>
                                       <div>
                                           <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{stat.label}</p>
                                           <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stat.value}</h4>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>

                       {/* Como funciona */}
                       <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Como funciona o programa?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {[
                                    { step: '01', title: 'Compartilhe o Link', desc: 'Envie para amigos ou em grupos de estudo.' },
                                    { step: '02', title: 'Amigo Assina', desc: 'Sua indicação ganha acesso ao melhor conteúdo.' },
                                    { step: '03', title: 'Você Ganha 20%', desc: 'Receba sua comissão sobre o valor da assinatura.' }
                                ].map((step, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="text-2xl font-black text-indigo-600/20 dark:text-indigo-500/10 italic leading-none">{step.step}</div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{step.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                       </div>
                   </div>
               )}

               {activeTab === 'security' && (
                  <div className="space-y-6 animate-fade-in">
                      {/* Alteração de Senha */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                          <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Shield size={20} /></div>
                              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Segurança da Conta</h2>
                          </div>
                          
                          <form 
                              onSubmit={async (e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  const current = formData.get('currentPassword') as string;
                                  const newPass = formData.get('newPassword') as string;
                                  const confirm = formData.get('confirmPassword') as string;
                                  
                                  if (newPass !== confirm) return addToast('As senhas não coincidem.', 'error');
                                  
                                  try {
                                      const res: any = await apiClient.post('users/change_password.php', { current, new: newPass });
                                      if (res.success) {
                                          addToast('Senha alterada com sucesso!', 'success');
                                          (e.target as HTMLFormElement).reset();
                                      } else {
                                          addToast(res.message || 'Erro ao alterar senha.', 'error');
                                      }
                                  } catch (err: any) {
                                      addToast(err.response?.data?.message || 'Falha na comunicação com o servidor.', 'error');
                                  }
                              }}
                              className="space-y-4 max-w-md"
                          >
                              <div className="space-y-1.5 font-sans">
                                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha Atual</label>
                                  <input name="currentPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nova Senha</label>
                                      <input name="newPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                                      <input name="confirmPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                              </div>
                              <button type="submit" className="px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md">
                                  Atualizar Senha
                              </button>
                          </form>
                      </div>

                      {/* Preferências de Privacidade */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                         <div className="flex justify-between items-center mb-6">
                             <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Privacidade e Preferências</h2>
                             <button onClick={() => addToast('Preferências salvas!', 'success')} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">Salvar Tudo</button>
                         </div>
                         <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                               { id: 'isPublic', label: 'Perfil Público (Ranking)', desc: 'Permite que seu nome apareça nos rankings de simulados.', checked: currentUser.preferences?.isPublic, icon: Users },
                               { id: 'notifications', label: 'Notificações por Email', desc: 'Receba alertas sobre novos simulados e promoções.', checked: currentUser.preferences?.notifications, icon: Bell },
                               { id: 'shareData', label: 'Compartilhar Dados de Estudo', desc: 'Sua atividade ajuda a IA a melhorar as recomendações (Anônimo).', checked: currentUser.preferences?.shareData, icon: Zap }
                            ].map((item, i) => (
                               <div key={i} className="flex items-center justify-between py-5 group">
                                  <div className="flex items-start gap-4">
                                     <div className="mt-1 text-slate-400 group-hover:text-indigo-500 transition-colors"><item.icon size={20} /></div>
                                     <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block transition-colors">{item.label}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 transition-colors">{item.desc}</span>
                                     </div>
                                  </div>
                                  <div 
                                    onClick={() => updateUser({ preferences: { ...currentUser.preferences, [item.id]: !item.checked } })}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 ${item.checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                                  >
                                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${item.checked ? 'right-1' : 'left-1'} shadow-sm`} />
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {/* Zona de Perigo */}
                      <div className="bg-rose-50/50 dark:bg-rose-950/10 p-8 rounded-2xl border border-rose-100 dark:border-rose-900/30 transition-colors">
                          <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">Excluir Conta</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">Esta ação é irreversível e excluirá todos os seus materiais, progresso e dados permanentemente.</p>
                          <button className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all">
                              <LogOut size={14} /> Solicitar Exclusão
                          </button>
                      </div>
                  </div>
               )}

            </main>
         </div>

         {/* Modal de Seleção de Meta */}
         {showGoalModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in transition-all">
               <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                  <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Escolha seu foco</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selecione a área para a qual você está estudando.</p>
                     </div>
                     <button onClick={() => setShowGoalModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"><X size={20} /></button>
                  </header>

                  <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-8">
                     {EXAM_AREAS.map(group => (
                        <div key={group.group} className="space-y-3">
                           <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{group.group}</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.areas.map(area => (
                                 <button
                                    key={area}
                                    onClick={() => {
                                       updateUser({ targetExam: area });
                                       setShowGoalModal(false);
                                    }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all group ${currentUser.targetExam === area ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-600' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                 >
                                    <span className={`text-sm font-bold ${currentUser.targetExam === area ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{area}</span>
                                    {currentUser.targetExam === area ? (
                                       <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"><ChevronRight size={12} className="text-white" /></div>
                                    ) : (
                                       <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ChevronRight size={12} className="text-slate-400" /></div>
                                    )}
                                 </button>
                              ))}
                           </div>
                        </div>
                     ))}
                  </div>

                  <footer className="p-6 bg-slate-50 dark:bg-slate-800/30 text-center">
                     <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">ISSO AJUDARÁ A PERSONALIZAR SUAS RECOMENDAÇÕES E RANKINGS.</p>
                  </footer>
               </div>
            </div>
         )}

         {/* Modal de Cancelamento de Assinatura (Portal) */}
         {createPortal(
            <AnimatePresence>
               {showCancelModal && currentUser.subscription && (
                  <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCancelModal(false)}
                        className="fixed inset-0 bg-slate-900/90 backdrop-blur-md"
                     />
                     
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-rose-100 dark:border-rose-900/20 relative z-10"
                     >
                        <div className="p-8 text-center space-y-6">
                             <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-rose-100 dark:border-rose-500/20">
                                 <ShieldAlert size={40} className="text-rose-600 dark:text-rose-500" />
                             </div>

                             <div className="space-y-4">
                                 <div className="space-y-2">
                                     <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">
                                         Já vai nos deixar, {currentUser.name?.split(' ')[0]}?
                                     </h3>
                                     <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                                         {(() => {
                                             const start = new Date(currentUser.subscription.current_period_start).getTime();
                                             const now = new Date().getTime();
                                             const isRefundable = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                             
                                             if (isRefundable) {
                                                 return "Você ainda está no período de garantia. Se cancelar agora, faremos seu reembolso total, mas sua jornada rumo à aprovação perderá o fôlego da nossa IA.";
                                             }
                                             return "Sua aprovação está cada dia mais próxima! Cancelando agora, você perderá acesso ao Banco de Questões mais completo do mercado ao fim do ciclo atual.";
                                         })()}
                                     </p>
                                 </div>

                                 {/* Banner de Garantia Movido para cá */}
                                 {(() => {
                                    const start = new Date(currentUser.subscription.current_period_start).getTime();
                                    const now = new Date().getTime();
                                    const isWithinSevenDays = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                    
                                    if (isWithinSevenDays) {
                                       return (
                                          <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 p-4 rounded-2xl flex items-center gap-4 text-left">
                                             <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 font-sans">
                                                <ShieldCheck size={20} className="text-white" />
                                             </div>
                                             <div className="flex-1">
                                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Garantia Legal de 7 Dias</h4>
                                                <p className="text-[11px] font-medium text-indigo-900/60 dark:text-indigo-300/60 leading-tight">
                                                   Sua satisfação é nossa prioridade. Cancele e receba 100% do valor de volta em até 7 dias após a contratação.
                                                </p>
                                             </div>
                                          </div>
                                       );
                                    }
                                    return null;
                                 })()}
                             </div>

                             <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl space-y-4 text-left border border-slate-100 dark:border-slate-800">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Qual o motivo principal?</label>
                                 <select 
                                     value={cancelReason}
                                     onChange={(e) => setCancelReason(e.target.value)}
                                     className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold highlight-none outline-none focus:ring-2 focus:ring-rose-500/10"
                                 >
                                     <option value="">Selecione uma opção...</option>
                                     <option value="price">Valor da assinatura</option>
                                     <option value="usage">Não estou usando o suficiente</option>
                                     <option value="technical">Problemas técnicos</option>
                                     <option value="content">Falta de conteúdos específicos</option>
                                     <option value="other">Outros motivos</option>
                                 </select>
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                  <button
                                     onClick={() => setShowCancelModal(false)}
                                     className="h-14 bg-indigo-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                                  >
                                     <Zap size={18} className="fill-current" />
                                     Manter Acesso VIP
                                  </button>
                                  <button
                                     onClick={() => {
                                         if (!cancelReason) return addToast('Por favor, selecione um motivo.', 'warning');
                                         handleCancelSubscription();
                                     }}
                                     className="h-14 bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                     Confirmar Cancelamento
                                  </button>
                             </div>
                             
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                                 VOCÊ MANTERÁ SEU ACESSO ATÉ O DIA {new Date(currentUser.subscription.current_period_end).toLocaleDateString()}
                             </p>
                        </div>
                     </motion.div>
                  </div>
               )}
            </AnimatePresence>,
            document.body
         )}
      </div>
   );
};

export default Profile;
