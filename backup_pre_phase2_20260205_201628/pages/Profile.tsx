
import React, { useState, useMemo } from 'react';
import {
   User, Mail, Star, Book, Settings, Shield,
   CreditCard, StickyNote, Zap, TrendingUp,
   ChevronRight, X, BarChart3, Target, Layout, ShieldCheck, Bell, Info, Users, LogOut, Crown
} from 'lucide-react';
import {
   AreaChart, Area, XAxis, YAxis, Tooltip,
   ResponsiveContainer
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Subject } from '../types';
import AuthModal from '../components/AuthModal';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';
type ProfileTab = 'evolution' | 'notebook' | 'personal' | 'billing' | 'security';

const Profile: React.FC = () => {
   const { currentUser, updateUser, logout } = useAuth();
   const { questions, userNotes, saveNote, userAnswers, systemSettings } = useData();
   const [activeTab, setActiveTab] = useState<ProfileTab>('evolution');
   const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
   const [evolutionRange, setEvolutionRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
   const [showGoalModal, setShowGoalModal] = useState(false);
   const [showAuthModal, setShowAuthModal] = useState(false);

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
         onClick={() => setActiveTab(id)}
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

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* SIDEBAR DE NAVEGAÇÃO */}
            <aside className="lg:col-span-3 space-y-6">
               {/* Cartão do Usuário */}
               <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-3 transition-colors">
                  <div className="relative">
                     <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 transition-colors">
                        <span className="text-2xl font-black">{currentUser.name.charAt(0)}</span>
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
                     <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors ${currentUser.billing?.plan === 'Elite' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}>
                        Plano {currentUser.billing?.plan || 'Gratuito'}
                     </span>
                  </div>
               </div>

               {/* Menu */}
               <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 transition-colors">
                  <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Menu</div>
                  <SidebarItem id="evolution" label="Desempenho" icon={TrendingUp} />
                  <SidebarItem id="notebook" label="Caderno de Erros" icon={StickyNote} />
                  <div className="h-px bg-slate-50 dark:bg-slate-800 my-2 transition-colors" />
                  <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Conta</div>
                  <SidebarItem id="personal" label="Dados Pessoais" icon={User} />
                  <SidebarItem id="billing" label="Assinatura" icon={CreditCard} />
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
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Caderno de Notas</h2>
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

               {activeTab === 'personal' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in transition-colors">
                     <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 transition-colors">Dados Pessoais</h2>
                     <form
                        onSubmit={(e) => {
                           e.preventDefault();
                           const formData = new FormData(e.currentTarget);
                           updateUser({
                              name: formData.get('name') as string,
                              email: formData.get('email') as string, // Note: Email usually shouldn't be editable without verification
                              cpf: formData.get('cpf') as string,
                              targetExam: formData.get('targetExam') as string,
                              address: {
                                 street: formData.get('street') as string,
                                 city: (formData.get('cityState') as string).split('/')[0] || '',
                                 state: (formData.get('cityState') as string).split('/')[1] || '',
                                 zipCode: formData.get('zipCode') as string,
                                 number: '',
                                 neighborhood: ''
                              }
                           });
                           alert('Perfil atualizado com sucesso!');
                        }}
                        className="space-y-5 max-w-lg"
                     >
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Nome Completo</label><input name="name" type="text" defaultValue={currentUser.name} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">E-mail de Acesso</label><input name="email" type="email" defaultValue={currentUser.email} readOnly className="w-full h-11 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed transition-all" title="Não é possível alterar o email" /></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CPF</label><input name="cpf" type="text" defaultValue={currentUser.cpf || ''} placeholder="000.000.000-00" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors" /></div>
                           <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Foco</label><input name="targetExam" type="text" defaultValue={currentUser.targetExam} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors" /></div>
                        </div>

                        <div className="pt-4">
                           <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 transition-colors">Endereço</h3>
                           <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="col-span-1 space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CEP</label><input name="zipCode" type="text" defaultValue={currentUser.address?.zipCode || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" /></div>
                              <div className="col-span-2 space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Cidade/UF</label><input name="cityState" type="text" defaultValue={currentUser.address ? `${currentUser.address.city}/${currentUser.address.state}` : ''} placeholder="Cidade/UF" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" /></div>
                           </div>
                           <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Logradouro</label><input name="street" type="text" defaultValue={currentUser.address?.street || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" /></div>
                        </div>

                        <button type="submit" className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all mt-2">Salvar Alterações</button>
                     </form>
                  </div>
               )}

               {activeTab === 'billing' && (
                  <div className="space-y-6 animate-fade-in">
                     <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Planos de Assinatura</h2>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg transition-colors">
                           {(['monthly', 'quarterly', 'annual'] as BillingCycle[]).map(c => (
                              <button key={c} onClick={() => setSelectedCycle(c)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${selectedCycle === c ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
                                 {c === 'monthly' ? 'Mensal' : c === 'quarterly' ? `Trimestral (-${systemSettings.pricing.Essencial.quarterlyDiscountPercent}%)` : `Anual (-${systemSettings.pricing.Essencial.annualDiscountPercent}%)`}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(systemSettings.planDetails).filter(([n]) => n !== 'Gratuito').map(([name, details]) => {
                           const pricingConfig = systemSettings.pricing[name as keyof typeof systemSettings.pricing];
                           const price = selectedCycle === 'monthly' ? pricingConfig.monthly : selectedCycle === 'quarterly' ? pricingConfig.quarterly : pricingConfig.annual;
                           const isCurrent = currentUser.billing?.plan === name;
                           return (
                              <div key={name} className={`p-6 rounded-2xl border transition-all relative overflow-hidden bg-white dark:bg-slate-900 hover:shadow-md ${isCurrent ? 'border-indigo-600 ring-1 ring-indigo-600 dark:border-indigo-500 dark:ring-indigo-500' : 'border-slate-200 dark:border-slate-800'}`}>
                                 {name === 'Elite' && <div className="absolute top-0 right-0 bg-amber-400 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-sm">Recomendado</div>}
                                 <h4 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase mb-2 flex items-center gap-2 transition-colors">
                                    {name === 'Elite' && <Crown size={16} className="text-amber-500" />}
                                    {name}
                                 </h4>
                                 <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 transition-colors">R$</span>
                                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{(price / (selectedCycle === 'annual' ? 12 : selectedCycle === 'quarterly' ? 3 : 1)).toFixed(2)}</span>
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 transition-colors">/mês</span>
                                 </div>
                                 <ul className="space-y-2 mb-6">
                                    {details.features.map((feat: any, idx: number) => (
                                       <li key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 transition-colors">
                                          {feat.included ? <ShieldCheck size={14} className="text-emerald-500 dark:text-emerald-400" /> : <X size={14} className="text-slate-300 dark:text-slate-700" />}
                                          <span className={!feat.included ? 'opacity-50' : ''}>{feat.text}</span>
                                       </li>
                                    ))}
                                 </ul>
                                 <button className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 cursor-default' : 'bg-slate-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-700'}`}>
                                    {isCurrent ? 'Plano Atual' : 'Escolher Plano'}
                                 </button>
                              </div>
                           );
                        })}
                     </div>
                  </div>
               )}

               {activeTab === 'security' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in transition-colors">
                     <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 transition-colors">Privacidade e Preferências</h2>
                     <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[
                           { label: 'Perfil Público (Ranking)', desc: 'Permite que seu nome apareça nos rankings de simulados.', checked: currentUser.preferences?.isPublic, icon: Users },
                           { label: 'Notificações por Email', desc: 'Receba alertas sobre simulados e promoções.', checked: currentUser.preferences?.notifications, icon: Bell },
                           { label: 'Compartilhar Dados de Estudo', desc: 'Ajuda a IA a melhorar as recomendações (Anônimo).', checked: currentUser.preferences?.shareData, icon: Zap }
                        ].map((item, i) => (
                           <div key={i} className="flex items-center justify-between py-5">
                              <div className="flex items-start gap-4">
                                 <div className="mt-1 text-slate-400 dark:text-slate-500 transition-colors"><item.icon size={20} /></div>
                                 <div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block transition-colors">{item.label}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 transition-colors">{item.desc}</span>
                                 </div>
                              </div>
                              <div className={`w-11 h-6 rounded-full relative cursor-pointer transition-all ${item.checked ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.checked ? 'right-1' : 'left-1'} shadow-sm`} />
                              </div>
                           </div>
                        ))}
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
      </div>
   );
};

export default Profile;
