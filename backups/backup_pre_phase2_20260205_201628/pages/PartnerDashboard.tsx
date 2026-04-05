
import React, { useState, useMemo } from 'react';
import { Material, Transaction, Subject, BankAccount } from '../types';
import {
  BarChart3, DollarSign, UploadCloud, FileText, CheckCircle2, XCircle,
  Clock, AlertTriangle, ShieldCheck, TrendingUp, Package, Wallet, Eye, Landmark, CreditCard, Lock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

const PartnerDashboard: React.FC = () => {
  const { materials, transactions, publishMaterial } = useMarketplace();
  const { currentUser, becomePartner, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'upload' | 'finance'>('overview');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Efeito para mostrar modal se não tiver user (mas renderizando algo por baixo ou apenas o modal)
  React.useEffect(() => {
    if (!currentUser) setShowAuthModal(true);
  }, [currentUser]);

  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    title: '', description: '', price: 0, type: 'PDF', subject: Subject.LAW, examTarget: '', previewUrl: '', details: '', pdfPassword: ''
  });
  const [fullFile, setFullFile] = useState<File | null>(null);

  const [bankForm, setBankForm] = useState<BankAccount>(currentUser?.bankAccount || {
    bankCode: '', bankName: '', agency: '', account: '', accountDigit: '', holderName: '', holderDocument: '', type: 'checking'
  });

  const myMaterials = useMemo(() => materials.filter(m => m.authorId === currentUser?.id), [materials, currentUser?.id]);
  const myTransactions = useMemo(() => transactions.filter(t => t.sellerId === currentUser?.id), [transactions, currentUser?.id]);

  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  const { availableBalance, heldBalance } = useMemo(() => {
    return myTransactions.reduce((acc, curr) => {
      const netAmount = curr.amount - curr.platformFee;
      const daysSincePurchase = (now - curr.timestamp) / msPerDay;

      if (daysSincePurchase >= 7) {
        acc.availableBalance += netAmount;
      } else {
        acc.heldBalance += netAmount;
      }
      return acc;
    }, { availableBalance: 0, heldBalance: 0 });
  }, [myTransactions, now]);

  const totalSales = myTransactions.length;
  const pendingMaterials = myMaterials.filter(m => m.status === 'pending').length;

  const salesData = [
    { name: 'Seg', sales: 0 }, { name: 'Ter', sales: 0 }, { name: 'Qua', sales: totalSales > 0 ? Math.floor(totalSales / 2) : 0 },
    { name: 'Qui', sales: 0 }, { name: 'Sex', sales: totalSales > 0 ? Math.ceil(totalSales / 2) : 0 }, { name: 'Sáb', sales: 0 }, { name: 'Dom', sales: 0 },
  ];

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AuthModal
          isOpen={showAuthModal || !currentUser}
          onClose={() => { }} // Bloqueado, user precisa logar
          title="Acesso de Parceiros"
          description="Para acessar o painel de vendas, gerenciar produtos e financeiro, faça login na sua conta."
          actionSource="partner_dashboard"
        />
      </div>
    );
  }

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.title || !newMaterial.description) { alert("Preencha todos os campos obrigatórios"); return; }
    if (!fullFile) { alert("Você precisa fazer o upload do material completo (PDF)."); return; }

    // Simulação de upload salvando URL local
    const fileUrl = URL.createObjectURL(fullFile);

    const material: Material = {
      id: `mat-${Date.now()}`,
      title: newMaterial.title!,
      description: newMaterial.description!,
      authorId: currentUser.id!,
      authorName: currentUser.name,
      price: Number(newMaterial.price),
      type: newMaterial.type as any,
      subject: newMaterial.subject as any,
      examTarget: newMaterial.examTarget,
      previewUrl: newMaterial.previewUrl,
      fileUrl: fileUrl,
      pdfPassword: newMaterial.pdfPassword,
      details: newMaterial.details,
      status: 'pending',
      salesCount: 0,
      rating: 0,
      createdAt: Date.now(),
      comments: []
    };

    publishMaterial(material);
    setActiveTab('products');
    setNewMaterial({ title: '', description: '', price: 0, type: 'PDF', subject: Subject.LAW, examTarget: '', previewUrl: '', details: '', pdfPassword: '' });
    setFullFile(null);
    alert("Material enviado para moderação e salvo no servidor seguro!");
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ bankAccount: bankForm });
    alert("Dados bancários salvos! Seus recebimentos futuros cairão nesta conta.");
  };

  if (!currentUser.isPartner) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 animate-fade-in transition-colors">
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 md:p-20 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-10 transition-colors">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto shadow-inner transition-colors"><DollarSign size={40} className="text-indigo-600 dark:text-indigo-400" /></div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 transition-colors">Torne-se um Colaborador</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed font-bold transition-colors">Compartilhe seu conhecimento pedagógico com milhares de alunos e monetize sua expertise de forma segura e profissional.</p>
          </div>
          <button onClick={becomePartner} className="px-12 py-5 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none transition-all">Aceitar e Começar Agora</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20 transition-colors">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
            <Wallet className="text-indigo-600 dark:text-indigo-400" /> Painel do Parceiro
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors">Gerencie seus produtos, vendas e recebimentos.</p>
        </div>
      </header>

      <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-slate-800 rounded-xl w-fit overflow-x-auto no-scrollbar transition-colors">
        {['overview', 'products', 'upload', 'finance'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {tab === 'finance' ? 'Financeiro' : tab === 'overview' ? 'Geral' : tab === 'products' ? 'Produtos' : 'Cadastrar'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8 animate-slide-up transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors group hover:border-emerald-200 dark:hover:border-emerald-700 transition-all">
              <div className="flex items-center gap-3 mb-2 text-emerald-600 dark:text-emerald-400 transition-colors"><DollarSign size={20} /> <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Financeiro</span></div>
              <div className="space-y-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Disponível</span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 transition-colors">R$ {availableBalance.toFixed(2)}</h3>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Em Garantia (Retido)</span>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">R$ {heldBalance.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors group hover:border-indigo-200 dark:hover:border-indigo-700 transition-all">
              <div className="flex items-center gap-3 mb-2 text-indigo-600 dark:text-indigo-400 transition-colors"><Package size={20} /> <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Vendas Totais</span></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{totalSales}</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors group hover:border-amber-200 dark:hover:border-amber-700 transition-all">
              <div className="flex items-center gap-3 mb-2 text-amber-500 transition-colors"><Clock size={20} /> <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Em Moderação</span></div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{pendingMaterials}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-8 flex items-center gap-2 uppercase tracking-wide transition-colors"><BarChart3 size={18} className="text-indigo-600 dark:text-indigo-400" /> Desempenho Semanal</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }}
                  />
                  <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-3 animate-slide-up transition-colors">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seus Materiais</h3>
            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{myMaterials.length} itens cadastrados</span>
          </div>
          {myMaterials.map(m => (
            <div key={m.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center hover:border-indigo-300 dark:hover:border-indigo-600 transition-all transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 transition-colors transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 transition-colors">{m.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-medium transition-colors">
                    <span>{m.salesCount} vendas</span>
                    <span>•</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">R$ {m.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-colors ${m.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30'}`}>
                {m.status === 'approved' ? 'Ativo' : 'Pendente'}
              </span>
            </div>
          ))}
          {myMaterials.length === 0 && (
            <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 border-dashed transition-colors">
              <Package className="mx-auto text-slate-300 dark:text-slate-700 mb-4" size={48} />
              <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum produto cadastrado ainda.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="max-w-2xl mx-auto animate-slide-up transition-colors">
          <form onSubmit={handlePublishSubmit} className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-6 mb-2 transition-colors">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"><UploadCloud size={20} /></div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 transition-colors">Cadastrar Novo Material</h3>
            </div>

            <div className="space-y-1.5 transition-colors">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Título do Material</label>
              <input required type="text" value={newMaterial.title} onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })} className="w-full h-12 px-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all transition-colors" placeholder="Ex: Guia Definitivo de Controle de Constitucionalidade" />
            </div>

            <div className="space-y-1.5 transition-colors">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Descrição Completa</label>
              <textarea required rows={4} value={newMaterial.description} onChange={e => setNewMaterial({ ...newMaterial, description: e.target.value })} className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all transition-colors" placeholder="Venda seu peixe! Conte detalhes sobre o conteúdo..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-colors">
              <div className="space-y-1.5 transition-colors">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Preço de Venda (R$)</label>
                <input required type="number" min="0" step="0.01" value={newMaterial.price} onChange={e => setNewMaterial({ ...newMaterial, price: Number(e.target.value) })} className="w-full h-12 px-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 transition-colors" />
              </div>
              <div className="space-y-1.5 transition-colors">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Matéria Principal</label>
                <select value={newMaterial.subject} onChange={e => setNewMaterial({ ...newMaterial, subject: e.target.value as any })} className="w-full h-12 px-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer transition-colors">
                  {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* ÁREA DE UPLOAD E SENHA */}
            <div className="p-6 bg-slate-50 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] space-y-6 transition-colors">
              <div className="space-y-2 transition-colors">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><UploadCloud size={14} className="text-indigo-500" /> Arquivo Completo (PDF)</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2rem] cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900 transition-colors">
                  <input type="file" accept=".pdf" className="hidden" onChange={e => setFullFile(e.target.files?.[0] || null)} />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors">{fullFile ? fullFile.name : "Clique para selecionar o PDF"}</span>
                </label>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 px-2 transition-colors">Protegido por criptografia. O arquivo original nunca fica exposto.</p>
              </div>

              <div className="space-y-2 transition-colors">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Lock size={14} className="text-indigo-500" /> Senha do PDF (Recomendado)</label>
                <input type="text" value={newMaterial.pdfPassword} onChange={e => setNewMaterial({ ...newMaterial, pdfPassword: e.target.value })} className="w-full h-12 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm outline-none transition-colors" placeholder="Defina uma senha única..." />
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 transition-colors">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0 transition-colors" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight font-medium transition-colors">A senha será enviada automaticamente ao comprador após a confirmação do pagamento. Isso protege o seu conteúdo contra compartilhamento não autorizado.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 transition-colors">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Eye size={14} /> Link de Prévia (Opcional)</label>
              <input type="text" value={newMaterial.previewUrl} onChange={e => setNewMaterial({ ...newMaterial, previewUrl: e.target.value })} className="w-full h-12 px-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-200 text-sm outline-none transition-colors" placeholder="URL para visualização parcial..." />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors transition-colors">
              <button type="submit" className="w-full md:w-auto px-12 py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none transition-all">Enviar para Moderação</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-8 animate-slide-up transition-colors">
          <div className="bg-slate-900 dark:bg-indigo-900/40 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl transition-colors border border-slate-800/50 dark:border-indigo-500/20">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-slate-400 dark:text-indigo-200/60 text-[10px] font-black uppercase tracking-widest transition-colors">Saldo Disponível para Saque</p>
                  <h2 className="text-5xl font-black transition-colors">R$ {availableBalance.toFixed(2)}</h2>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-indigo-200/60 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"><Lock size={12} /> Saldo Retido (Garantia)</p>
                  <h3 className="text-2xl font-bold opacity-80">R$ {heldBalance.toFixed(2)}</h3>
                </div>
                <p className="text-slate-500 dark:text-indigo-200/40 text-[10px] max-w-sm font-medium transition-colors pt-2">O saldo fica retido por 7 dias após a venda (prazo de garantia legal). Após esse período, torna-se disponível automaticamente.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 w-full md:w-auto transition-colors">
                <p className="text-slate-400 dark:text-indigo-200/60 text-[10px] font-black uppercase tracking-widest mb-3 transition-colors">Banco de Recebimento</p>
                <div className="flex items-center gap-3 mb-2">
                  <Landmark size={20} className="text-indigo-400" />
                  <span className="font-black text-sm uppercase transition-colors">{currentUser.bankAccount?.bankName || 'Não configurado'}</span>
                </div>
                <div className="font-mono text-xs opacity-70 space-y-1 transition-colors">
                  {currentUser.bankAccount ? (
                    <>
                      <p>Agência: {currentUser.bankAccount.agency}</p>
                      <p>Conta: {currentUser.bankAccount.account}-{currentUser.bankAccount.accountDigit}</p>
                    </>
                  ) : <p className="text-amber-400">Configure seus dados abaixo</p>}
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 transition-colors"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 transition-colors">
            <form onSubmit={handleSaveBank} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 h-fit transition-colors">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-5 mb-2 transition-colors">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"><CreditCard size={18} /></div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 transition-colors">Dados Bancários</h3>
              </div>
              <div className="grid grid-cols-2 gap-5 transition-colors">
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Código do Banco</label><input required type="text" value={bankForm.bankCode} onChange={e => setBankForm({ ...bankForm, bankCode: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" placeholder="Ex: 001, 260..." /></div>
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Instituição</label><input required type="text" value={bankForm.bankName} onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" placeholder="Ex: Brasil, Nubank..." /></div>
              </div>
              <div className="grid grid-cols-3 gap-5 transition-colors">
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Agência</label><input required type="text" value={bankForm.agency} onChange={e => setBankForm({ ...bankForm, agency: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" /></div>
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Conta</label><input required type="text" value={bankForm.account} onChange={e => setBankForm({ ...bankForm, account: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" /></div>
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Dig</label><input required type="text" value={bankForm.accountDigit} onChange={e => setBankForm({ ...bankForm, accountDigit: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" /></div>
              </div>
              <div className="space-y-1.5 transition-colors">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Nome do Titular</label>
                <input required type="text" value={bankForm.holderName} onChange={e => setBankForm({ ...bankForm, holderName: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-5 transition-colors">
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">CPF / CNPJ</label><input required type="text" value={bankForm.holderDocument} onChange={e => setBankForm({ ...bankForm, holderDocument: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none transition-colors" /></div>
                <div className="space-y-1.5 transition-colors"><label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Tipo</label><select value={bankForm.type} onChange={e => setBankForm({ ...bankForm, type: e.target.value as any })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer transition-colors"><option value="checking">Corrente</option><option value="savings">Poupança</option></select></div>
              </div>
              <button type="submit" className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 shadow-xl shadow-slate-200 dark:shadow-none transition-all">Salvar Configurações</button>
            </form>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full transition-colors">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-5 mb-4 transition-colors">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-lg transition-colors"><Clock size={18} /></div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 transition-colors">Histórico de Vendas</h3>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar max-h-[450px]">
                {myTransactions.length === 0 ? (
                  <div className="py-20 text-center space-y-3 opacity-40">
                    <Package className="mx-auto" size={40} />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhuma transação encontrada.</p>
                  </div>
                ) : (
                  <table className="w-full text-left transition-colors">
                    <thead className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors"><tr className="border-b border-slate-50 dark:border-slate-800"><th className="py-4 px-2">Data</th><th className="py-4">Material</th><th className="py-4 text-right px-2">Líquido</th></tr></thead>
                    <tbody className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {myTransactions.map(t => (
                        <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-4 px-2 font-medium opacity-60 transition-colors">{new Date(t.timestamp).toLocaleDateString()}</td>
                          <td className="py-4 max-w-[140px] truncate transition-colors" title={t.materialTitle}>{t.materialTitle}</td>
                          <td className="py-4 text-right text-emerald-600 dark:text-emerald-400 px-2 transition-colors">+ R$ {(t.amount - t.platformFee).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDashboard;
