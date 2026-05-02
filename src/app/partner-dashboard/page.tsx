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

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Material, BankAccount, Notification } from '../../types';
import {
  BarChart3, DollarSign, UploadCloud, FileText, CheckCircle2,
  AlertTriangle, ShieldCheck, TrendingUp, Package, Wallet, Eye,
  Landmark, Lock, Edit, X,
  Activity, Download, LayoutDashboard, ShoppingBag, ListChecks, Store,
  Sun, Moon, Bell, HelpCircle, ArrowRight, MessageSquare, Send, CornerDownRight, Star
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid
} from 'recharts';
import StableResponsiveContainer from '@/components/shared/charts/StableResponsiveContainer';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import AuthModal from '../../components/shared/overlays/AuthModal';
import { useToast } from '@providers/ToastProvider';
import ProgressBar from '../../components/shared/ui/ProgressBar';
import { useRouter } from 'next/navigation';
import { useTheme } from '@providers/ThemeProvider';
import { DashboardSidebar } from '../../components/shared/layout/DashboardSidebar';
import Footer from '../../components/shared/layout/Footer';
import { getAssetUrl } from '@services/api';

type FinanceSubTab = 'extrato' | 'pagamentos' | 'saque';

type PartnerBankForm = BankAccount & {
  pixKeyType: string;
  pixKey: string;
  birthDate: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isCnpj: boolean;
  cnpj: string;
  companyName: string;
  docPhotoUrl: string;
};

type PartnerNotificationDropdownProps = {
  notifications: Notification[];
  unreadCount: number;
  onNotificationClick: (notification: Notification) => void;
  onViewAll: () => void;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const createBankFormDefaults = (holderName = ''): PartnerBankForm => ({
  bankCode: '',
  bankName: '',
  agency: '',
  account: '',
  accountDigit: '',
  holderName,
  holderDocument: '',
  type: 'checking',
  pixKeyType: '',
  pixKey: '',
  birthDate: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  isCnpj: false,
  cnpj: '',
  companyName: '',
  docPhotoUrl: '',
});

const PartnerNotificationDropdown: React.FC<PartnerNotificationDropdownProps> = ({
  notifications,
  unreadCount,
  onNotificationClick,
  onViewAll,
}) => {
  const visibleNotifications = notifications.filter((notification) => !notification.deletedAt);

  return (
    <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-scale-in text-left">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Notificacoes</h3>
        {unreadCount > 0 && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{unreadCount} novas</span>}
      </div>
      <div className="max-h-80 overflow-y-auto no-scrollbar">
        {visibleNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Nenhuma notificacao.</div>
        ) : (
          visibleNotifications.slice(0, 5).map((notification) => (
            <div key={notification.id} onClick={() => onNotificationClick(notification)} className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' : notification.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>{notification.title}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{new Date(notification.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{notification.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onViewAll}
          className="w-full py-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          Ver Todas <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

const PartnerDashboard: React.FC = () => {
  const { materials, transactions, publishMaterial, updateMaterial, uploadFile, uploadProgress, addMaterialComment } = useMarketplace();
  const { currentUser, becomePartner, updateUser } = useAuth();
  const { systemSettings, notifications, markNotificationAsRead } = useData();
  const { addToast } = useToast();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'upload' | 'finance' | 'reviews'>('overview');
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTab>('extrato');
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ materialId: string, commentId: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [referenceTimeMs, setReferenceTimeMs] = useState(0);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReferenceTimeMs(Date.now());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    title: '', description: '', price: 0, type: 'PDF',
    subjectId: undefined, subjectText: '',
    topicId: undefined, topic: '',
    examTarget: '', previewUrl: '', details: '', pdfPassword: '',
    pageCount: 0, year: new Date().getFullYear()
  });
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const bankFormDefaults = useMemo(
    () => createBankFormDefaults(currentUser?.name || ''),
    [currentUser?.name]
  );

  // Mescla defaults com dados já salvos: campos existentes preenchem o form,
  // novos campos recebem o valor padrão
  const [bankForm, setBankForm] = useState<PartnerBankForm>(() => createBankFormDefaults());
  const [docFile, setDocFile] = useState<File | null>(null);
  const [savingBank, setSavingBank] = useState(false);
  const [bankAgeError, setBankAgeError] = useState('');

  // Sincroniza o formulário quando o usuário for carregado/atualizado do contexto
  React.useEffect(() => {
    if (currentUser?.bankAccount) {
      const frame = window.requestAnimationFrame(() => {
        setBankForm((prev) => ({
          ...bankFormDefaults,
          ...currentUser.bankAccount,
          // Mantem qualquer alteracao local ainda nao salva se o objeto for o mesmo.
          ...Object.fromEntries(
            Object.entries(prev).filter(([k]) => !(k in bankFormDefaults))
          ),
        }));
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [bankFormDefaults, currentUser?.bankAccount]);

  const myMaterials = useMemo(() => materials.filter(m => m.authorId === currentUser?.id), [materials, currentUser?.id]);
  const myTransactions = useMemo(() => transactions.filter(t => t.sellerId === currentUser?.id), [transactions, currentUser?.id]);

  const now = referenceTimeMs;

  const { availableBalance, heldBalance, totalRevenue } = useMemo(() => {
    return myTransactions.reduce((acc, curr) => {
      // Reembolsados não entram na contabilização de saldo.
      if (curr.status === 'refunded') return acc;

      const netAmount = curr.amount - curr.platformFee;
      const daysSincePurchase = now ? (now - curr.timestamp) / MS_PER_DAY : 0;
      const isRefundUnderReview = curr.status === 'refund_requested';

      acc.totalRevenue += netAmount;
      if (!isRefundUnderReview && daysSincePurchase >= 7) {
        acc.availableBalance += netAmount;
      } else {
        acc.heldBalance += netAmount;
      }
      return acc;
    }, { availableBalance: 0, heldBalance: 0, totalRevenue: 0 });
  }, [myTransactions, now]);

  // Vendas totais excluindo reembolsados
  const totalSales = myTransactions.filter(t => t.status !== 'refunded').length;
  const pendingMaterials = myMaterials.filter(m => m.status === 'pending').length;

  // Gráfico de Desempenho Mensal (últimas 4 semanas)
  const chartData = useMemo(() => {
    const semanas = [
      { name: 'Sem 4', start: 28, end: 22 },
      { name: 'Sem 3', start: 21, end: 15 },
      { name: 'Sem 2', start: 14, end: 8 },
      { name: 'Sem 1', start: 7, end: 1 },
    ];

    const data = semanas.map(s => ({
      name: s.name,
      vendas: 0,
      receita: 0,
      startDay: s.start,
      endDay: s.end,
    }));

    myTransactions.forEach(t => {
      // Ignorar reembolsados no gráfico
      if (t.status === 'refunded') return;
      const diasAtras = now ? (now - t.timestamp) / MS_PER_DAY : 0;
      const sem = data.find(s => diasAtras <= s.startDay && diasAtras >= s.endDay);
      if (sem) {
        sem.vendas += 1;
        sem.receita += (t.amount - t.platformFee);
      }
    });

    return data;
  }, [myTransactions, now]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        <AuthModal
          isOpen={!currentUser}
          onClose={() => { }}
          title="Acesso de Parceiros"
          description="Para acessar o painel de vendas, gerenciar produtos e financeiro, faça login na sua conta."
          actionSource="partner_dashboard"
        />
      </div>
    );
  }

  // ... (keeping methods below for briefly)
  // handlePublishSubmit, handleEditSubmit, handleSaveBank, isAlreadyPartner logic follows...


  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation just in case

    if (!newMaterial.title || !newMaterial.description) {
      addToast("Preencha todos os campos obrigatórios", "warning");
      return;
    }
    if (!fullFile) {
      addToast("Você precisa fazer o upload do material completo (PDF).", "warning");
      return;
    }

    setIsPublishing(true);

    try {
      let fileUrl = '';
      let coverUrl = '';
      let uploadedPageCount = newMaterial.pageCount || 0;

      if (fullFile) {
        const uploadResult = await uploadFile(fullFile, newMaterial.pdfPassword);
        if (!uploadResult) {
          setIsPublishing(false);
          return; // Stop if upload fails
        }
        fileUrl = uploadResult.url;
        uploadedPageCount = uploadResult.pageCount || 0;
      }

      // Upload Cover if exists
      if (coverFile) {
        const uploadResult = await uploadFile(coverFile);
        if (uploadResult) {
          coverUrl = uploadResult.url;
        }
      }

      const material: Material = {
        id: `mat-${Date.now()}`, // ID is ignored by backend but kept for type safety
        title: newMaterial.title!,
        description: newMaterial.description!,
        authorId: currentUser.id!,
        authorName: currentUser.name,
        price: Number(newMaterial.price),
        type: newMaterial.type || 'PDF',
        subject: newMaterial.subject || newMaterial.subjectText || '',
        subjectId: newMaterial.subjectId,
        subjectText: newMaterial.subjectText,
        topicId: newMaterial.topicId,
        topic: newMaterial.topic,
        pageCount: uploadedPageCount,
        year: newMaterial.year,
        examTarget: newMaterial.examTarget,
        previewUrl: newMaterial.previewUrl,
        coverUrl: coverUrl,
        fileUrl: fileUrl, // Real URL from server
        pdfPassword: newMaterial.pdfPassword,
        details: newMaterial.details,
        status: 'pending',
        salesCount: 0,
        rating: 0,
        createdAt: Date.now(),
        comments: []
      };

      const success = await publishMaterial(material);

      if (success) {
        setActiveTab('products');
        setNewMaterial({
          title: '', description: '', price: 0, type: 'PDF',
          subjectId: undefined, subjectText: '',
          topicId: undefined, topic: '',
          examTarget: '', previewUrl: '', details: '',
          pdfPassword: '', pageCount: 0, year: new Date().getFullYear()
        });
        setFullFile(null);
        setCoverFile(null);
        // Note: Toast is handled in context
      }
    } catch (err) {
      console.error(err);
      addToast("Ocorreu um erro inesperado ao enviar o formulário.", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    setIsPublishing(true);
    try {
      const updates: Partial<Material> = {
        title: editingMaterial.title,
        description: editingMaterial.description,
        price: editingMaterial.price,
        subject: editingMaterial.subject,
        subjectId: editingMaterial.subjectId,
        subjectText: editingMaterial.subjectText,
        topicId: editingMaterial.topicId,
        topic: editingMaterial.topic,
        pageCount: editingMaterial.pageCount,
        year: editingMaterial.year,
        examTarget: editingMaterial.examTarget,
        previewUrl: editingMaterial.previewUrl,
        pdfPassword: editingMaterial.pdfPassword
      };

      if (coverFile) {
        const uploadResult = await uploadFile(coverFile);
        if (uploadResult) {
          updates.coverUrl = uploadResult.url;
        }
      }

      // If there's a new file and material is not approved, upload it
      if (fullFile && editingMaterial.status !== 'approved') {
        const uploadResult = await uploadFile(fullFile, editingMaterial.pdfPassword);
        if (uploadResult) {
          updates.fileUrl = uploadResult.url;
          updates.pageCount = uploadResult.pageCount || 0;
        }
      }

      const success = await updateMaterial(editingMaterial.id, updates);
      if (success) {
        setEditingMaterial(null);
        setFullFile(null);
        setCoverFile(null);
      }
    } catch (err) {
      console.error(err);
      addToast("Erro ao atualizar material.", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de idade (mínimo 18 anos)
    if (bankForm.birthDate) {
      const birth = new Date(bankForm.birthDate);
      const hoje = new Date();
      const anos = hoje.getFullYear() - birth.getFullYear() -
        (hoje < new Date(hoje.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (anos < 18) {
        setBankAgeError('Você precisa ter 18 anos ou mais para vender na plataforma.');
        return;
      }
    }
    setBankAgeError('');

    setSavingBank(true);
    try {
      let docUrl = bankForm.docPhotoUrl || '';
      if (docFile) {
        // Fazer upload do documento usando o uploadFile do contexto
        const result = await uploadFile(docFile);
        if (result) docUrl = result.url;
      }

      const dataToSave = { ...bankForm, docPhotoUrl: docUrl };
      updateUser({ bankAccount: dataToSave });
      addToast('Dados bancários salvos! Seus recebimentos futuros cairão nesta conta.', 'success');
    } catch {
      addToast('Erro ao salvar dados bancários.', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleReplySubmit = async (materialId: string, parentId: string) => {
    if (!replyText.trim()) return;
    setIsReplying(true);
    try {
      const result = await addMaterialComment(materialId, replyText, parentId);
      if (result) {
        addToast("Resposta enviada com sucesso!", "success");
        setReplyingTo(null);
        setReplyText("");
      }
    } catch {
      addToast("Erro ao enviar resposta.", "error");
    } finally {
      setIsReplying(false);
    }
  };

  const isAlreadyPartner = currentUser.role === 'partner' || currentUser.role === 'admin' || currentUser.isPartner;

  const partnerTabs = [
    { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { key: 'products', label: 'Meus Materiais', icon: Package, badge: myMaterials.length },
    { key: 'reviews', label: 'Avaliações', icon: MessageSquare },
    { key: 'upload', label: 'Publicar Material', icon: UploadCloud },
    { key: 'finance', label: 'Financeiro', icon: Wallet },
  ];

  if (!isAlreadyPartner) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 animate-fade-in transition-colors">
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 md:p-20 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-10 transition-colors">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto shadow-inner transition-colors"><DollarSign size={40} className="text-indigo-600 dark:text-indigo-400" /></div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 transition-colors">Torne-se um Colaborador</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed font-bold transition-colors">Compartilhe seu conhecimento pedagógico com milhares de alunos e monetize sua expertise de forma segura e profissional.</p>
          </div>
          {systemSettings?.features?.partnerRegistrationEnabled !== false && (
            <button
              type="button"
              disabled={isPublishing}
              onClick={async (e) => {
                e.preventDefault();
                setIsPublishing(true);
                const success = await becomePartner();
                if (success) {
                  addToast("Parabéns! Agora você é um colaborador.", "success");
                } else {
                  addToast("Não foi possível ativar seu perfil de parceiro. Tente novamente.", "error");
                }
                setIsPublishing(false);
              }}
              className="px-12 py-5 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-50 disabled:cursor-wait"
            >
              {isPublishing ? 'Ativando...' : 'Aceitar e Começar Agora'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const unreadCount = (notifications || []).filter(n => !n.isRead && !n.deletedAt).length;

  const userInitials = currentUser?.name?.charAt(0) || 'A';
  const userLevel = currentUser?.level || 0;

  const handleNotificationClick = (n: Notification) => {
    markNotificationAsRead(n.id);
    if (n.link) router.push(n.link);
    setIsNotifOpen(false);
  };

  const handleViewAllNotifications = () => {
    setIsNotifOpen(false);
    router.push('/notifications');
  };

  return (
    <div className="flex h-[100dvh] max-h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <DashboardSidebar
        type="partner"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={partnerTabs}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-24 transition-colors duration-300 relative">
        {/* Top Bar - Replicating Layout features */}
        <div className="sticky top-0 z-30 flex justify-end items-center p-4 px-8 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <button
              onClick={() => router.push('/support')}
              className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
              title="Suporte e Feedback"
            >
              <HelpCircle size={20} />
            </button>

            {systemSettings?.features?.notificationsEnabled && (
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all relative"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950" />}
                </button>
                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-2">
                      <PartnerNotificationDropdown
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onNotificationClick={handleNotificationClick}
                        onViewAll={handleViewAllNotifications}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nível {userLevel}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                {userInitials}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-fade-in">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Store className="text-indigo-600" />
                  {partnerTabs.find(t => t.key === activeTab)?.label}
                </h1>
                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest border border-indigo-200 dark:border-indigo-800">Colaborador</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Gerencie suas publicações e ganhos.</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <TrendingUp size={16} className="text-emerald-500" />
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Vendido</p>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none transition-colors">R$ {totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </header>

          <div>
            {activeTab === 'overview' && (
              <div className="space-y-10 animate-slide-up">
                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      label: 'Receita Total',
                      value: `R$ ${totalRevenue.toFixed(2)}`,
                      sub: `R$ ${availableBalance.toFixed(2)} disponível`,
                      icon: DollarSign,
                      color: 'emerald',
                      gradient: 'from-emerald-500/20 to-teal-500/20'
                    },
                    {
                      label: 'Vendas Totais',
                      value: totalSales,
                      sub: 'Transações confirmadas',
                      icon: ShoppingBag,
                      color: 'indigo',
                      gradient: 'from-indigo-500/20 to-blue-500/20'
                    },
                    {
                      label: 'Em Moderação',
                      value: pendingMaterials,
                      sub: 'Aguardando validação',
                      icon: ListChecks,
                      color: 'amber',
                      gradient: 'from-amber-500/20 to-orange-500/20'
                    },
                    {
                      label: 'Sua Pontuação',
                      value: currentUser.reputation || 0,
                      sub: 'Baseado em avaliações',
                      icon: Activity,
                      color: 'purple',
                      gradient: 'from-purple-500/20 to-pink-500/20'
                    },
                  ].map((stat, i) => (
                    <div key={i} className="group relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-indigo-500/5 transition-all duration-500 overflow-hidden">
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50`}></div>
                      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400`}>
                          <stat.icon size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
                          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{stat.value}</h3>
                          <div className="relative group/tooltip">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 cursor-help">
                              {stat.sub} <HelpCircle size={10} className="text-slate-400" />
                            </p>
                            {stat.label === 'Sua Pontuação' && (
                              <div className="absolute top-full left-0 mt-2 w-48 p-3 bg-slate-900 dark:bg-slate-800 text-white text-[9px] font-medium rounded-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                Sua pontuação reflete a qualidade e o engajamento dos seus materiais. Você ganha pontos por vendas realizadas e avaliações positivas dos alunos.
                                <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart and Recent Sales */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Chart */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                        <BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400" />
                        Desempenho Mensal
                      </h3>
                    </div>
                    <div className="w-full h-[320px] min-w-0">
                      <StableResponsiveContainer height={320}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b820" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }}
                            tickFormatter={(value) => `R$${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '20px',
                              border: 'none',
                              backgroundColor: '#0f172a',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                              padding: '12px 16px'
                            }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px', fontWeight: 'black', textTransform: 'uppercase' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="receita"
                            stroke="#6366f1"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#colorReceita)"
                          />
                        </AreaChart>
                      </StableResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3 mb-8">
                      <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Últimas Vendas
                    </h3>
                    <div className="flex-1 space-y-6">
                      {myTransactions.slice(0, 5).map((t, idx) => (
                        <div key={idx} className="flex items-center gap-4 group cursor-default">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 transition-colors">
                              <ShoppingBag size={18} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.materialTitle}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Por <span className="text-indigo-500 font-bold">{t.buyerName || `Usuário #${t.buyerId.substring(0, 4)}`}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium line-through">
                              R${t.amount.toFixed(2)}
                            </p>
                            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              +R${(t.amount - t.platformFee).toFixed(2)}
                            </p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5" title="Taxa da Plataforma">
                              Taxa: -R${t.platformFee.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {myTransactions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                          <Package size={40} className="mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhuma venda ainda</p>
                        </div>
                      )}
                    </div>
                    {myTransactions.length > 5 && (
                      <button
                        onClick={() => setActiveTab('finance')}
                        className="mt-6 w-full py-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        Ver todos os lançamentos
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent Reviews and Questions */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3 mb-8">
                    <HelpCircle size={18} className="text-indigo-600 dark:text-indigo-400" />
                    Avaliações e Perguntas Recentes
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      // Coletar todos os comentários dos materiais do usuário
                      const allComments = myMaterials.flatMap(m =>
                        (m.comments || []).map(c => ({ ...c, materialTitle: m.title }))
                      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      if (allComments.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-10 opacity-40 gap-4">
                            <HelpCircle size={40} className="text-slate-400" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhuma avaliação ou pergunta ainda</p>
                          </div>
                        );
                      }

                      return allComments.slice(0, 5).map((c, idx) => (
                        <div key={idx} className="py-5 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{c.userName}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">? {new Date(c.date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold mb-2 uppercase tracking-wide">
                                Em: {c.materialTitle}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {c.text}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 whitespace-nowrap">
                              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                                {c.likes > 0 ? `${c.likes} Útil` : 'Nova'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-slide-up">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                      <MessageSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Avaliações e Perguntas
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase">
                      Gerencie e interaja com seus alunos
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      const allComments = myMaterials.flatMap(m =>
                        (m.comments || []).map(c => ({ ...c, materialId: m.id, materialTitle: m.title }))
                      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      if (allComments.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-20 opacity-40 gap-4">
                            <MessageSquare size={48} className="text-slate-400" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhuma avaliação recebida</p>
                          </div>
                        );
                      }

                      return allComments.map((c) => (
                        <div key={c.id} className="py-8 first:pt-4 last:pb-4">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold shrink-0">
                              {c.userName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{c.userName}</span>
                                    {c.userPlan && (
                                      <span className="text-[9px] font-black tracking-widest uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                        {c.userPlan}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                    {new Date(c.date).toLocaleString()}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-xl truncate max-w-[200px]" title={c.materialTitle}>
                                  {c.materialTitle}
                                </span>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 mb-4">
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                  {c.text}
                                </p>
                              </div>

                              <div className="flex items-center gap-4">
                                <button className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400" disabled>
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{c.likes || 0}</span> Útil
                                </button>
                                <button
                                  onClick={() => setReplyingTo({ materialId: c.materialId, commentId: c.id })}
                                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                >
                                  <CornerDownRight size={14} /> Responder
                                </button>
                              </div>

                              {/* Replies Rendering */}
                              {c.replies && c.replies.length > 0 && (
                                <div className="mt-4 space-y-4 pl-6 md:pl-8 border-l-2 border-slate-100 dark:border-slate-800">
                                  {c.replies.map(reply => (
                                    <div key={reply.id} className="flex items-start gap-4">
                                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                                        {reply.userName.charAt(0)}
                                      </div>
                                      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-bl-xl">
                                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Sua Resposta</span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{reply.userName}</span>
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500">{new Date(reply.date).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                          {reply.text}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Inline Reply Input */}
                              {replyingTo?.commentId === c.id && (
                                <div className="mt-4 pl-6 md:pl-8 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
                                  <div className="flex-1 relative">
                                    <textarea
                                      autoFocus
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder={`Respondendo a ${c.userName}...`}
                                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 pr-32 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-medium placeholder:text-slate-400"
                                      rows={2}
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                      <button
                                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => handleReplySubmit(c.materialId, c.id)}
                                        disabled={isReplying || !replyText.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                      >
                                        <Send size={12} /> {isReplying ? 'Enviando...' : 'Enviar'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-6 animate-slide-up">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                      <Package size={18} className="text-indigo-600 dark:text-indigo-400" />
                      Seus Materiais
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase">
                      {myMaterials.length} materiais cadastrados na plataforma
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                  >
                    <UploadCloud size={16} /> Novo Material
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-6">Material</th>
                        <th className="p-6">Preço</th>
                        <th className="p-6 text-center">Avaliação</th>
                        <th className="p-6 text-center">Vendas</th>
                        <th className="p-6 text-center">Status</th>
                        <th className="p-6 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {myMaterials.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 mb-0.5">#{m.id}</span>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{m.title}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{m.subject}</div>
                            </div>
                          </td>
                          <td className="p-6">
                            <span className="font-black text-slate-700 dark:text-slate-300">R$ {m.price.toFixed(2)}</span>
                          </td>
                          <td className="p-6 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                              <Star size={12} className="fill-current" /> {m.rating > 0 ? m.rating.toFixed(1) : 'N/A'}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px]">
                              <ShoppingBag size={12} /> {m.salesCount || 0}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${m.status === 'approved'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : m.status === 'pending'
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              }`}>
                              {m.status === 'approved' ? 'Ativo' : m.status === 'pending' ? 'Em Análise' : 'Rejeitado'}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setEditingMaterial(m)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"
                                title="Editar Material"
                              >
                                <Edit size={16} />
                              </button>
                              {m.fileUrl && (
                                <a
                                  href={m.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition-all"
                                  title="Baixar Arquivo"
                                >
                                  <Download size={16} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {myMaterials.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center">
                            <div className="flex flex-col items-center justify-center opacity-40 gap-4">
                              <Package size={48} className="text-slate-300 dark:text-slate-600" />
                              <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nenhum material cadastrado</p>
                              <button
                                onClick={() => setActiveTab('upload')}
                                className="px-6 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                Cadastrar Primeiro Produto
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}


            {activeTab === 'upload' && (
              <div className="w-full animate-slide-up">
                <form onSubmit={handlePublishSubmit} className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-10">
                  <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-8">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Publicar Novo Material</h3>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Siga as diretrizes para uma aprovação rápida</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Title & Description */}
                    <div className="space-y-6 md:col-span-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Título do Material</label>
                        <input
                          required
                          type="text"
                          value={newMaterial.title}
                          onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })}
                          className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          placeholder="Ex: Resumo de Direito Administrativo - 2024"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição do Conteúdo</label>
                        <textarea
                          required
                          rows={5}
                          value={newMaterial.description}
                          onChange={e => setNewMaterial({ ...newMaterial, description: e.target.value })}
                          className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-[2.5rem] text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                          placeholder="Descreva o que seu material aborda, para quem é indicado e seus diferenciais..."
                        />
                      </div>
                    </div>

                    {/* Metadata fields */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Preço Sugerido (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={newMaterial.price}
                          onChange={e => setNewMaterial({ ...newMaterial, price: Number(e.target.value) })}
                          className="w-full h-14 pl-12 pr-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Matéria Principal</label>
                      <select
                        value={newMaterial.subjectId || ''}
                        onChange={e => {
                          const id = Number(e.target.value);
                          const sub = systemSettings.taxonomies?.subjects.find(s => Number(s.id) === id);
                          setNewMaterial({
                            ...newMaterial,
                            subjectId: id,
                            subjectText: sub?.name || '',
                            topicId: undefined, // Reset topic on subject change
                            topic: ''
                          });
                        }}
                        className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer outline-none focus:ring-4 focus:ring-indigo-500/10"
                      >
                        <option value="">Selecionar Matéria</option>
                        {systemSettings.taxonomies?.subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Assunto / Tópico</label>
                      <select
                        disabled={!newMaterial.subjectId}
                        value={newMaterial.topicId || ''}
                        onChange={e => {
                          const id = Number(e.target.value);
                          const top = systemSettings.taxonomies?.topics.find(t => Number(t.id) === id);
                          setNewMaterial({ ...newMaterial, topicId: id, topic: top?.name || '' });
                        }}
                        className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">{newMaterial.subjectId ? "Selecionar Assunto" : "Selecione uma matéria primeiro"}</option>
                        {systemSettings.taxonomies?.topics
                          .filter(t => Number(t.parentId) === Number(newMaterial.subjectId))
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Concurso Alvo (Opcional)</label>
                      <input
                        type="text"
                        value={newMaterial.examTarget}
                        onChange={e => setNewMaterial({ ...newMaterial, examTarget: e.target.value })}
                        className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        placeholder="Ex: CNU, INSS, Receita Federal"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano</label>
                        <input
                          type="number"
                          value={newMaterial.year}
                          onChange={e => setNewMaterial({ ...newMaterial, year: Number(e.target.value) })}
                          className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="p-8 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-[3rem] space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* PDF Upload */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                          <FileText size={16} className="text-indigo-500" />
                          Arquivo Principal (PDF)
                        </label>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] cursor-pointer hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 group">
                          <input type="file" accept=".pdf" className="hidden" onChange={e => setFullFile(e.target.files?.[0] || null)} />
                          <div className="flex flex-col items-center gap-2">
                            <UploadCloud size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center px-4 truncate max-w-[200px]">
                              {fullFile ? fullFile.name : "Selecionar PDF"}
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Image Cover Upload */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                          <Eye size={16} className="text-indigo-500" />
                          Imagem de Capa (JPG/PNG)
                        </label>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] cursor-pointer hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 group overflow-hidden relative">
                          <input type="file" accept="image/*" className="hidden" onChange={e => setCoverFile(e.target.files?.[0] || null)} />
                          {coverFile ? (
                            <Image
                              src={URL.createObjectURL(coverFile)}
                              alt="Preview"
                              fill
                              unoptimized
                              sizes="320px"
                              className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                            />
                          ) : null}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <UploadCloud size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {coverFile ? "Trocar Imagem" : "Selecionar Capa"}
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          <span>Enviando arquivo...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <ProgressBar progress={uploadProgress} />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                          <Lock size={14} className="text-indigo-500" /> Senha (Opcional)
                        </label>
                        <input
                          type="text"
                          value={newMaterial.pdfPassword}
                          onChange={e => setNewMaterial({ ...newMaterial, pdfPassword: e.target.value })}
                          className="w-full h-12 px-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm outline-none focus:border-indigo-500 transition-all"
                          placeholder="Senha que protege o PDF"
                        />
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-bold">
                          A senha será liberada automaticamente para o comprador após o pagamento. Isso ajuda a evitar pirataria.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={20} className="text-indigo-600" />
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold max-w-[200px] leading-tight uppercase">
                        Ao publicar, você concorda com nossos Termos de Parceria e Uso.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={isPublishing}
                      className="w-full md:w-auto px-12 py-5 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-50 disabled:cursor-wait"
                    >
                      {isPublishing ? 'Enviando Material...' : 'Publicar Agora'}
                    </button>
                  </div>
                </form>
              </div>
            )}


            {activeTab === 'finance' && (
              <div className="space-y-10 animate-slide-up">
                {/* Painel de Saldo */}
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
                  <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                      <div>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Wallet size={12} /> Saldo Disponível p/ Saque
                        </p>
                        <h2 className="text-6xl font-black">R$ {availableBalance.toFixed(2)}</h2>
                        <p className="text-white/30 text-[10px] font-bold mt-2 uppercase tracking-widest">
                          Ciclo fecha dia 20 &nbsp;·&nbsp; Pagamento enviado dia 1 do mês seguinte &nbsp;·&nbsp; Erros vão para o próximo ciclo
                        </p>
                      </div>
                      <div className="flex items-center gap-8">
                        <div>
                          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                            <Lock size={12} /> Retido (7 dias)
                          </p>
                          <h3 className="text-2xl font-bold">R$ {heldBalance.toFixed(2)}</h3>
                        </div>
                        <div className="w-px h-10 bg-white/10"></div>
                        <p className="text-[10px] text-white/30 font-medium max-w-[180px] leading-tight uppercase">
                          Liberação automática após 7 dias da venda.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 flex flex-col justify-between gap-6">
                      <div>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-4">Conta de Recebimento</p>
                        <div className="flex items-center gap-4 mb-2">
                          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                            <Landmark size={24} />
                          </div>
                          <div>
                            <span className="font-black text-sm uppercase block">{currentUser.bankAccount?.bankName || 'Não configurada'}</span>
                            <span className="text-[10px] font-mono text-white/40">
                              {currentUser.bankAccount ? `${currentUser.bankAccount.agency} • ${currentUser.bankAccount.account}-${currentUser.bankAccount.accountDigit}` : 'Conta não cadastrada'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setBankForm({ ...bankFormDefaults, ...(currentUser.bankAccount || {}) });
                          setFinanceSubTab('saque');
                        }}
                        className="w-full py-3 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-50 transition-colors"
                      >
                        Alterar Dados Bancários
                      </button>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                </div>

                {/* Sub-abas: Extrato | Configuração de Saque */}
                <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
                  {[
                    { key: 'extrato', label: 'Vendas', icon: ListChecks },
                    { key: 'pagamentos', label: 'Repasses (Pagamentos)', icon: Landmark },
                    { key: 'saque', label: 'Configuração de Saque', icon: Wallet },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFinanceSubTab(tab.key as FinanceSubTab)}
                      className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all -mb-px ${financeSubTab === tab.key
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                      <tab.icon size={14} />{tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-aba: Extrato */}
                {financeSubTab === 'extrato' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-slide-up">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                        <ListChecks size={18} className="text-indigo-600" />
                        Extrato Detalhado
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{myTransactions.length} registros</span>
                    </div>

                    {myTransactions.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4">
                        <Package size={48} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma transação registrada</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="border-b border-slate-100 dark:border-slate-800">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <th className="pb-4 pt-1">Data</th>
                              <th className="pb-4 pt-1">ID do Pedido</th>
                              <th className="pb-4 pt-1">Comprador / Material</th>
                              <th className="pb-4 pt-1 text-center">Status</th>
                              <th className="pb-4 pt-1 text-right">Bruto</th>
                              <th className="pb-4 pt-1 text-right">Taxa (20%)</th>
                              <th className="pb-4 pt-1 text-right">Líquido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {myTransactions.map((t) => {
                              const isRefunded = t.status === 'refunded';
                              const fee = t.platformFee ?? (t.amount * 0.2);
                              const net = t.amount - fee;
                              return (
                                <tr
                                  key={t.id}
                                  className={`group transition-colors ${isRefunded
                                    ? 'opacity-40'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                  <td className={`py-5 text-[10px] font-mono text-slate-400 ${isRefunded ? 'line-through' : ''}`}>
                                    {new Date(t.timestamp).toLocaleDateString()}
                                  </td>
                                  <td className="py-5">
                                    <span className={`font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded ${isRefunded ? 'line-through' : ''}`}>
                                      #{t.id?.toString().slice(-8) || '---'}
                                    </span>
                                  </td>
                                  <td className="py-5">
                                    <div className="space-y-0.5">
                                      <p className={`text-xs font-black text-slate-900 dark:text-slate-100 ${isRefunded ? 'line-through' : ''}`}>{t.materialTitle}</p>
                                      <p className={`text-[10px] font-bold text-indigo-500 ${isRefunded ? 'line-through' : ''}`}>
                                        {t.buyerName} <span className="text-slate-400 font-medium">#{t.buyerId?.substring(0, 8)}</span>
                                      </p>
                                    </div>
                                  </td>
                                  <td className="py-5 text-center">
                                    {isRefunded ? (
                                      <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-red-200 dark:border-red-800">Reembolsado</span>
                                    ) : (
                                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black uppercase">Confirmado</span>
                                    )}
                                  </td>
                                  <td className={`py-5 text-right text-xs font-bold text-slate-600 dark:text-slate-400 ${isRefunded ? 'line-through' : ''}`}>
                                    R$ {t.amount?.toFixed(2)}
                                  </td>
                                  <td className={`py-5 text-right text-xs font-bold text-rose-500 dark:text-rose-400 ${isRefunded ? 'line-through' : ''}`}>
                                    - R$ {fee.toFixed(2)}
                                  </td>
                                  <td className={`py-5 text-right`}>
                                    <p className={`text-sm font-black ${isRefunded ? 'line-through text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      R$ {net.toFixed(2)}
                                    </p>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-aba: Repasses (Pagamentos) */}
                {financeSubTab === 'pagamentos' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-slide-up">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                        <Landmark size={18} className="text-indigo-600" />
                        Repasses da Plataforma
                      </h3>
                    </div>

                    <div className="py-20 flex flex-col items-center justify-center opacity-40 gap-4">
                      <Wallet size={48} className="text-slate-400 dark:text-slate-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center max-w-sm">
                        Nenhum repasse realizado ainda. <br /><br />
                        Os pagamentos são processados e enviados para a sua conta bancária configurada <br />
                        no dia 1º do mês seguinte ao ciclo fechado (dia 20).
                      </p>
                    </div>
                  </div>
                )}

                {/* Sub-aba: Configuração de Saque */}
                {financeSubTab === 'saque' && (
                  <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl animate-slide-up">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-6 mb-8">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Landmark size={18} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">Configuração de Saque</h3>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Preencha todos os dados para receber seus pagamentos corretamente.</p>
                      </div>
                    </div>

                    {bankAgeError && (
                      <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                        <p className="text-xs font-bold text-red-700 dark:text-red-400">{bankAgeError}</p>
                      </div>
                    )}

                    <form onSubmit={handleSaveBank} className="space-y-8">

                      {/* ── Tipo de Pessoa ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tipo de Pessoa</p>
                        <div className="flex gap-3">
                          {[{ val: false, label: 'Pessoa Física (CPF)' }, { val: true, label: 'Pessoa Jurídica (CNPJ)' }].map(opt => (
                            <button key={String(opt.val)} type="button"
                              onClick={() => setBankForm({ ...bankForm, isCnpj: opt.val })}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${bankForm.isCnpj === opt.val
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}>{opt.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* ── Dados Pessoais / Empresa ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Dados do Titular</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo do Titular</label>
                            <input required type="text" value={bankForm.holderName}
                              onChange={e => setBankForm({ ...bankForm, holderName: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="Exatamente como no documento" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              {bankForm.isCnpj ? 'CPF do Sócio Administrador' : 'CPF (deve ser o mesmo da conta)'}
                            </label>
                            <input required type="text" value={bankForm.holderDocument}
                              onChange={e => setBankForm({ ...bankForm, holderDocument: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="000.000.000-00" />
                          </div>

                          {/* Nascimento — obrigatório para PF */}
                          {!bankForm.isCnpj && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Nascimento (mín. 18 anos)</label>
                              <input required type="date" value={bankForm.birthDate}
                                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                onChange={e => { setBankForm({ ...bankForm, birthDate: e.target.value }); setBankAgeError(''); }}
                                className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                            </div>
                          )}

                          {/* CNPJ e Razão Social */}
                          {bankForm.isCnpj && (
                            <>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                                <input required type="text" value={bankForm.cnpj}
                                  onChange={e => setBankForm({ ...bankForm, cnpj: e.target.value })}
                                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                                  placeholder="00.000.000/0001-00" />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social / Nome da Empresa</label>
                                <input required type="text" value={bankForm.companyName}
                                  onChange={e => setBankForm({ ...bankForm, companyName: e.target.value })}
                                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ── Endereço ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Endereço</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1 col-span-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CEP</label>
                            <input required type="text" value={bankForm.zipCode}
                              onChange={e => setBankForm({ ...bankForm, zipCode: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="00000-000" />
                          </div>
                          <div className="space-y-1 col-span-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Logradouro</label>
                            <input required type="text" value={bankForm.street}
                              onChange={e => setBankForm({ ...bankForm, street: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="Rua, Avenida..." />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label>
                            <input required type="text" value={bankForm.number}
                              onChange={e => setBankForm({ ...bankForm, number: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Complemento</label>
                            <input type="text" value={bankForm.complement}
                              onChange={e => setBankForm({ ...bankForm, complement: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="Apto, sala..." />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                            <input required type="text" value={bankForm.neighborhood}
                              onChange={e => setBankForm({ ...bankForm, neighborhood: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                            <input required type="text" value={bankForm.city}
                              onChange={e => setBankForm({ ...bankForm, city: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">UF</label>
                            <select required value={bankForm.state} onChange={e => setBankForm({ ...bankForm, state: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all">
                              <option value="">---</option>
                              {['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'].map(uf => <option key={uf}>{uf}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* ── Dados Bancários ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Dados Bancários</p>
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">⚠ O CPF/CNPJ do titular deve ser o mesmo cadastrado na conta bancária.</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1 col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Banco / Instituição</label>
                            <input required type="text" value={bankForm.bankName}
                              onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="Ex: Nubank, Banco Inter, Caixa" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Agência (sem dígito)</label>
                            <input required type="text" value={bankForm.agency}
                              onChange={e => setBankForm({ ...bankForm, agency: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Conta (c/ dígito)</label>
                            <input required type="text"
                              value={`${bankForm.account}${bankForm.accountDigit ? '-' + bankForm.accountDigit : ''}`}
                              onChange={e => {
                                const parts = e.target.value.split('-');
                                setBankForm({ ...bankForm, account: parts[0], accountDigit: parts[1] || '' });
                              }}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                              placeholder="00000-0" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Conta</label>
                            <select value={bankForm.type} onChange={e => setBankForm({ ...bankForm, type: e.target.value as BankAccount['type'] })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all">
                              <option value="checking">Corrente</option>
                              <option value="savings">Poupança</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* ── Chave PIX (opcional) ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chave PIX <span className="font-normal normal-case opacity-60">(opcional, mas recomendado)</span></p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Chave</label>
                            <select value={bankForm.pixKeyType} onChange={e => setBankForm({ ...bankForm, pixKeyType: e.target.value })}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all">
                              <option value="">Selecionar</option>
                              <option value="cpf">CPF</option>
                              <option value="cnpj">CNPJ</option>
                              <option value="email">E-mail</option>
                              <option value="phone">Celular</option>
                              <option value="random">Chave Aleatória</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Chave PIX</label>
                            <input type="text" value={bankForm.pixKey}
                              onChange={e => setBankForm({ ...bankForm, pixKey: e.target.value })}
                              disabled={!bankForm.pixKeyType}
                              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all disabled:opacity-40"
                              placeholder={!bankForm.pixKeyType ? 'Selecione o tipo primeiro' : 'Informe a chave'} />
                          </div>
                        </div>
                      </div>

                      {/* ── Documento de Identidade ── */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Documento de Identidade</p>
                        <p className="text-[9px] text-slate-400 font-bold">Envie uma foto do RG, CNH ou Passaporte (frente e verso em uma única imagem). Necessário para autorizar os saques.</p>
                        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                          <input type="file" accept="image/*,application/pdf" className="hidden"
                            onChange={e => setDocFile(e.target.files?.[0] || null)} />
                          {docFile ? (
                            <div className="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400">
                              <CheckCircle2 size={28} />
                              <span className="text-xs font-bold">{docFile.name}</span>
                              <span className="text-[9px] text-slate-400">Clique para trocar</span>
                            </div>
                          ) : bankForm.docPhotoUrl ? (
                            <div className="flex flex-col items-center gap-2 text-emerald-600">
                              <CheckCircle2 size={28} />
                              <span className="text-xs font-bold">Documento já enviado</span>
                              <span className="text-[9px] text-slate-400">Clique para atualizar</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                              <UploadCloud size={28} />
                              <span className="text-xs font-bold">Clique para enviar documento</span>
                              <span className="text-[9px]">JPG, PNG ou PDF — máx. 5 MB</span>
                            </div>
                          )}
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={savingBank}
                        className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {savingBank ? 'Salvando...' : 'Salvar Dados'}
                      </button>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                          <ArrowRight size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 leading-relaxed">
                            O ciclo de pagamento <strong>fecha todo dia 20</strong> — apenas as vendas realizadas até essa data (incluindo saldos retidos já liberados) serão transferidas no <strong>dia 1 do mês seguinte</strong>. Vendas após o dia 20 entram no próximo ciclo.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 leading-relaxed">
                            Em caso de <strong>erro no processamento</strong> — dados bancários incorretos, incompletos, incompatíveis ou conta não encontrada — o pagamento <strong>não será perdido</strong>: ficará retido e será reenviado automaticamente no <strong>próximo ciclo (mês seguinte)</strong>. Mantenha seus dados sempre atualizados para evitar atrasos.
                          </p>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Edit Material Modal */}
          {editingMaterial && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl relative">
                <button
                  onClick={() => { setEditingMaterial(null); setFullFile(null); }}
                  className="absolute top-8 right-8 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all z-10"
                >
                  <X size={20} />
                </button>

                <div className="p-10 md:p-14 space-y-12">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <Edit size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">Editar Material</h3>
                  </div>

                  {editingMaterial.status === 'approved' && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/40 flex gap-4">
                      <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                      <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed uppercase">
                        Este material já foi aprovado. Alterações críticas (como o arquivo PDF) exigem uma nova solicitação caso queira mudar o conteúdo principal.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleEditSubmit} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Título</label>
                      <input
                        required
                        type="text"
                        value={editingMaterial.title}
                        onChange={e => setEditingMaterial({ ...editingMaterial, title: e.target.value })}
                        className="w-full h-14 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Descrição</label>
                      <textarea
                        required
                        rows={4}
                        value={editingMaterial.description}
                        onChange={e => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Preço (R$)</label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingMaterial.price}
                          onChange={e => setEditingMaterial({ ...editingMaterial, price: Number(e.target.value) })}
                          className="w-full h-12 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-800 dark:text-slate-200 outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Matéria Principal</label>
                        <select
                          value={editingMaterial.subjectId || ''}
                          onChange={e => {
                            const id = Number(e.target.value);
                            const sub = systemSettings.taxonomies?.subjects.find(s => Number(s.id) === id);
                            setEditingMaterial({
                              ...editingMaterial,
                              subjectId: id,
                              subjectText: sub?.name || '',
                              topicId: undefined,
                              topic: ''
                            });
                          }}
                          className="w-full h-12 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                        >
                          <option value="">Selecionar Matéria</option>
                          {systemSettings.taxonomies?.subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Assunto / Tópico</label>
                        <select
                          disabled={!editingMaterial.subjectId}
                          value={editingMaterial.topicId || ''}
                          onChange={e => {
                            const id = Number(e.target.value);
                            const top = systemSettings.taxonomies?.topics.find(t => Number(t.id) === id);
                            setEditingMaterial({ ...editingMaterial, topicId: id, topic: top?.name || '' });
                          }}
                          className="w-full h-12 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50"
                        >
                          <option value="">{editingMaterial.subjectId ? "Selecionar Assunto" : "Selecione uma matéria primeiro"}</option>
                          {systemSettings.taxonomies?.topics
                            .filter(t => Number(t.parentId) === Number(editingMaterial.subjectId))
                            .map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Ano</label>
                        <input
                          type="number"
                          value={editingMaterial.year || ''}
                          onChange={e => setEditingMaterial({ ...editingMaterial, year: Number(e.target.value) })}
                          className="w-full h-12 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Senha do PDF</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                          <input
                            type="password"
                            value={editingMaterial.pdfPassword || ''}
                            disabled={true}
                            className="w-full h-12 pl-10 pr-6 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed outline-none"
                            placeholder="Alteração não permitida"
                          />
                        </div>
                        <p className="text-[9px] font-medium text-slate-400 mt-1 ml-1">A senha é imutável após a criação para segurança do arquivo.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                        <Eye size={16} className="text-indigo-500" />
                        Alterar Imagem de Capa
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] cursor-pointer hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 group overflow-hidden relative">
                        <input type="file" accept="image/*" className="hidden" onChange={e => setCoverFile(e.target.files?.[0] || null)} />
                        {(coverFile || editingMaterial.coverUrl) ? (
                          <Image
                            src={coverFile ? URL.createObjectURL(coverFile) : getAssetUrl(editingMaterial.coverUrl)}
                            alt="Preview"
                            fill
                            unoptimized
                            sizes="320px"
                            className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                          />
                        ) : null}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <UploadCloud size={20} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {(coverFile || editingMaterial.coverUrl) ? "Trocar Imagem" : "Selecionar Capa"}
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => { setEditingMaterial(null); setFullFile(null); }}
                        className="h-14 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-200 transition-all"
                      >
                        Descartar
                      </button>
                      <button
                        type="submit"
                        disabled={isPublishing}
                        className="h-14 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:shadow-xl shadow-slate-200 dark:shadow-none transition-all disabled:opacity-50"
                      >
                        {isPublishing ? 'Salvando...' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          <Footer />
        </div>
      </main>
    </div>
  );
};

export default PartnerDashboard;
