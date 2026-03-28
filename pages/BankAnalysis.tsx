
import React, { useState, useMemo, useEffect } from 'react';
import {
   Building2, Lock, PieChart as PieIcon, BarChart3,
   FileText, Zap, Crown, Check, Search, Briefcase, Target, Calendar,
   BrainCircuit, Database, Loader2, Globe, ExternalLink, Info, Activity, History
} from 'lucide-react';
import {
   BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
   PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CHART_COLORS } from '../constants';
import AuthModal from '../components/AuthModal';
import UpgradeModal from '../components/UpgradeModal';
import { apiClient, ENDPOINTS } from '@core/api';

const BankAnalysis: React.FC = () => {
   const { currentUser } = useAuth();
   const { systemSettings } = useData();

   const [selectedAgency, setSelectedAgency] = useState<string>('');
   const [selectedRole, setSelectedRole] = useState<string>('');
   const [selectedYear, setSelectedYear] = useState<string>('All');
   const [showAuthModal, setShowAuthModal] = useState(false);
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
   const [stats, setStats] = useState<any>(null);

   // Estados para animação de análise
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [loadingText, setLoadingText] = useState('');
   const [progress, setProgress] = useState(0);

   const [bankDetails, setBankDetails] = useState<{ description?: string, website?: string } | null>(null);
   const [bankScrapedInfo, setBankScrapedInfo] = useState<{ emAndamento: any[], realizados: any[] } | null>(null);
   const [isLoadingBankInfo, setIsLoadingBankInfo] = useState(false);

   const isElite = (currentUser?.subscription?.plan?.tier || 0) >= 4 || (currentUser?.plan || '').toLowerCase().includes('elite') || currentUser?.isAdmin;

   const agencies = useMemo(() => {
      const dbAgencies = systemSettings?.taxonomies?.agencies?.map(a => a.name) || [];
      return Array.from(new Set(dbAgencies)).sort();
   }, [systemSettings]);

   const roles = useMemo(() => {
      if (!selectedAgency) return [];
      return Array.from(new Set(systemSettings?.taxonomies?.roles?.map(r => r.name) || [])).sort();
   }, [systemSettings, selectedAgency]);

   const years = useMemo(() => {
      if (!selectedAgency) return [];
      return Array.from(new Set(systemSettings?.taxonomies?.years || [])).sort().reverse();
   }, [systemSettings, selectedAgency]);

   // Efeito para buscar os dados reais no backend
   useEffect(() => {
      if (selectedAgency && isElite) {
         setIsAnalyzing(true);
         setProgress(0);
         setLoadingText('Conectando à base neural...');
         setStats(null);

         const agencyData = systemSettings?.taxonomies?.agencies?.find(a => a.name === selectedAgency);
         setBankDetails(agencyData ? { description: agencyData.description, website: agencyData.website } : null);
         setBankScrapedInfo(null);

         if (agencyData?.website) {
            setIsLoadingBankInfo(true);
            apiClient.get(ENDPOINTS.statistics.bancaInfo, { params: { url: agencyData.website } })
               .then((res: any) => {
                  const data = res.data?.data || res.data;
                  if (data && !data.error) {
                     setBankScrapedInfo({ emAndamento: data.emAndamento || [], realizados: data.realizados || [] });
                  }
               })
               .catch(err => console.error("Failed fetching bank intel", err))
               .finally(() => setIsLoadingBankInfo(false));
         }

         const steps = [
            { pct: 20, text: 'Varrendo banco de questões...' },
            { pct: 45, text: 'Identificando padrões da banca...' },
            { pct: 70, text: 'Calculando incidência por tópico...' },
            { pct: 90, text: 'Gerando insights estratégicos...' }
         ];

         let currentStep = 0;

         const interval = setInterval(() => {
            if (currentStep < steps.length) {
               setProgress(steps[currentStep].pct);
               setLoadingText(steps[currentStep].text);
               currentStep++;
            }
         }, 450);

         apiClient.get(ENDPOINTS.statistics.xray, {
            params: {
               banca: selectedAgency,
               cargo: selectedRole || undefined,
               ano: selectedYear !== 'All' ? selectedYear : undefined
            }
         }).then((res: any) => {
            const data = res.data?.data || res.data;
            clearInterval(interval);
            setProgress(100);
            setLoadingText('Concluído!');
            setTimeout(() => {
               setStats(data);
               setIsAnalyzing(false);
            }, 400);
         }).catch(err => {
            console.error("Failed to fetch xray stats", err);
            clearInterval(interval);
            setLoadingText('Erro na análise.');
            setTimeout(() => setIsAnalyzing(false), 1000);
         });

         return () => clearInterval(interval);
      } else {
         setBankDetails(null);
         setBankScrapedInfo(null);
      }
   }, [selectedAgency, selectedRole, selectedYear, isElite, systemSettings]);

   // if (!currentUser) return null; // Removed to allow guest access

   if (!isElite) {
      return (
         <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <header>
               <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                  <Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca
               </h1>
               <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium transition-colors">Descubra os segredos da sua banca examinadora.</p>
            </header>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative min-h-[350px] flex items-center justify-center p-8 transition-colors">
               <div className="relative z-20 text-center max-w-md space-y-5">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200/50 transition-colors"><Lock size={32} /></div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight transition-colors">Recurso Exclusivo Elite</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed transition-colors">O Raio-X da Banca utiliza IA para analisar milhares de questões e te entregar o mapa da mina: o que cai, como cai e onde focar.</p>
                  <button
                     onClick={() => {
                        if (!currentUser) setShowAuthModal(true);
                        else setShowUpgradeModal(true);
                     }}
                     className="w-full py-3 bg-amber-500 dark:bg-amber-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-amber-600 dark:hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100 dark:shadow-none transition-all"
                  >
                     <Crown size={16} /> Quero ser Elite
                  </button>
               </div>
               <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 opacity-40 transition-colors" />
            </div>
            <AuthModal
               isOpen={showAuthModal}
               onClose={() => setShowAuthModal(false)}
               title="Desbloqueie o Raio-X"
               description="Acesse análises estratégicas e saia na frente da concorrência com o plano Elite."
            />
            <UpgradeModal
               isOpen={showUpgradeModal}
               onClose={() => setShowUpgradeModal(false)}
               requiredPlan="Elite"
               featureName="Raio-X da Banca"
            />
         </div>
      );
   }

   return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
         <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
               <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors"><Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca</h1>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-md border border-amber-200 dark:border-amber-800/50 transition-colors">Elite</span>
               </div>
               <p className="text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors">Inteligência de dados aplicada para hackear a sua aprovação.</p>
            </div>
         </header>

         <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 transition-colors">
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Search size={12} /> Selecione a Banca</label>
               <select value={selectedAgency} onChange={e => { setSelectedAgency(e.target.value); setSelectedRole(''); setSelectedYear('All'); }} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-all">
                  <option value="">Selecione...</option>
                  {agencies.map(a => <option key={a} value={a}>{a}</option>)}
               </select>
            </div>
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Briefcase size={12} /> Cargo (Opcional)</label>
               <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} disabled={!selectedAgency} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 cursor-pointer transition-all">
                  <option value="">Geral (Todos os Cargos)</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
            </div>
            <div className="md:col-span-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Calendar size={12} /> Período</label>
               <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} disabled={!selectedAgency} className="w-full h-11 px-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 cursor-pointer transition-all">
                  <option value="All">Todo o Período</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
         </div>

         {selectedAgency ? (
            isAnalyzing ? (
               <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] animate-fade-in shadow-xl transition-colors">
                  <div className="relative">
                     <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center animate-pulse transition-colors">
                        <BrainCircuit size={48} className="text-indigo-600 dark:text-indigo-400" />
                     </div>
                     <div className="absolute top-0 left-0 w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
                  </div>

                  <div className="w-full max-w-xs space-y-2">
                     <h3 className="text-lg font-black text-slate-900 dark:text-white animate-pulse transition-colors">{loadingText}</h3>
                     <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-colors">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                     </div>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right transition-colors">{progress}%</p>
                  </div>

                  <div className="flex gap-4 opacity-50">
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors"><Database size={12} /> Base Atualizada</div>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors"><Zap size={12} /> Processamento IA</div>
                  </div>
               </div>
            ) : (
               stats && (
                  <div className="space-y-6 animate-slide-up">

                     {/* Informações da Banca */}
                     {(bankDetails?.description || bankDetails?.website || bankScrapedInfo) && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                           <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
                              <div className="flex items-center gap-3">
                                 <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors">
                                    <Info size={20} />
                                 </div>
                                 <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide transition-colors">Sobre a Banca</h3>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors">{selectedAgency}</p>
                                 </div>
                              </div>
                              {bankDetails?.website && (
                                 <a href={bankDetails.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all w-fit">
                                    <Globe size={14} /> Site Oficial <ExternalLink size={12} />
                                 </a>
                              )}
                           </div>

                            <div className="p-6 space-y-8">
                              {bankDetails?.description && (
                                 <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors">
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium transition-colors">{bankDetails.description}</p>
                                 </div>
                              )}

                              {/* Lista de Provas Reais aplicadas pela Banca (New) */}
                              {stats.examList?.length > 0 && (
                                 <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                       <h4 className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.15em] transition-colors">
                                          <FileText size={14} /> Histórico de Provas Identificadas
                                       </h4>
                                       <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{stats.examList.length} Provas no Banco</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                       {stats.examList.map((exam: any) => (
                                          <div key={exam.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-850 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                                             <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">
                                                {exam.year}
                                             </div>
                                             <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate transition-colors leading-tight" title={exam.name}>{exam.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Prova de Concurso</p>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              )}

                              {(isLoadingBankInfo || bankScrapedInfo) && (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    {/* Andamento */}
                                    <div className="space-y-3">
                                       <h4 className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest transition-colors">
                                          <Activity size={14} /> Em Andamento
                                       </h4>
                                       {isLoadingBankInfo ? (
                                          <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-center justify-center gap-2 text-slate-400 transition-colors">
                                             <Loader2 size={16} className="animate-spin" /> <span className="text-xs font-bold">Buscando inteligência...</span>
                                          </div>
                                       ) : bankScrapedInfo?.emAndamento?.length ? (
                                          <div className="space-y-2">
                                             {bankScrapedInfo.emAndamento.map((item, i) => (
                                                <a key={i} href={item.url} target="_blank" rel="noreferrer" className="block p-3 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-sm group transition-all">
                                                   <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-tight transition-colors">{item.text}</p>
                                                </a>
                                             ))}
                                          </div>
                                       ) : (
                                          <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center transition-colors">
                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-colors">Nenhum concurso evidente encontrado.</p>
                                          </div>
                                       )}
                                    </div>

                                    {/* Realizados */}
                                    <div className="space-y-3">
                                       <h4 className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">
                                          <History size={14} /> Realizados ou Anteriores
                                       </h4>
                                       {isLoadingBankInfo ? (
                                          <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-center justify-center gap-2 text-slate-400 transition-colors">
                                             <Loader2 size={16} className="animate-spin" /> <span className="text-xs font-bold">Buscando inteligência...</span>
                                          </div>
                                       ) : bankScrapedInfo?.realizados?.length ? (
                                          <div className="space-y-2">
                                             {bankScrapedInfo.realizados.map((item, i) => (
                                                <a key={i} href={item.url} target="_blank" rel="noreferrer" className="block p-3 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm group transition-all">
                                                   <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 leading-tight transition-colors">{item.text}</p>
                                                </a>
                                             ))}
                                          </div>
                                       ) : (
                                          <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center transition-colors">
                                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-colors">Nenhum registro evidente encontrado.</p>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     )}

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-indigo-200 dark:hover:border-indigo-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase mb-2"><FileText size={14} /> Estilo da Prova</div>
                              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight transition-colors">{stats.textStyle}</h3>
                           </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-emerald-200 dark:hover:border-emerald-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase mb-2"><Building2 size={14} /> Contextualização</div>
                              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stats.contextUsage}%</h3>
                           </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full hover:border-amber-200 dark:hover:border-amber-600 transition-all">
                           <div>
                              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase mb-2"><BarChart3 size={14} /> Total Analisado</div>
                              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stats.total}</h3>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2 uppercase tracking-wide transition-colors"><PieIcon size={16} className="text-slate-400 dark:text-slate-500" /> Distribuição Geral</h3>
                           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.subjectData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{stats.subjectData.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}</Pie><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} /></PieChart></ResponsiveContainer></div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[300px] transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2 uppercase tracking-wide transition-colors"><BarChart3 size={16} className="text-slate-400 dark:text-slate-500" /> Nível de Dificuldade</h3>
                           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.difficultyData}><XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between transition-colors">
                           <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wide transition-colors">
                              <Target size={16} className="text-red-500 dark:text-red-400" /> Raio-X Temático: O que mais cai?
                           </h3>
                           <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Distribuição por Matéria e Assunto</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                           {stats.detailedBreakdown.map((item: any, index: number) => (
                              <div key={item.subject} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                 <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                       <div className={`w-3 h-3 rounded-full shadow-sm`} style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                       <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 transition-colors">
                                          {item.subject}
                                       </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded transition-colors">{item.total} Questões</span>
                                       <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{item.percent}%</span>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {item.topics.map((topic: any, tIdx: number) => (
                                       <div key={topic.topic} className="flex flex-col gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-xl shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-600 transition-all">
                                          <div className="flex items-center justify-between gap-2 overflow-hidden flex-1">
                                             <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-[10px] font-black text-slate-300 dark:text-slate-700 w-4 transition-colors">{(tIdx + 1).toString().padStart(2, '0')}</span>
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate transition-colors" title={topic.topic}>{topic.topic}</span>
                                             </div>
                                             <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">{topic.percent}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
                                             <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${topic.percent}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Recomendação IA (Elite) */}
                     {stats.recommendation && (
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-indigo-900 dark:to-purple-950 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 dark:shadow-none animate-slide-up">
                           <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                              <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center backdrop-blur-xl border border-white/20 flex-shrink-0">
                                 <BrainCircuit size={40} className="text-white" />
                              </div>
                              <div className="flex-1 space-y-4">
                                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <h3 className="text-xl font-black uppercase tracking-tight flex items-center justify-center md:justify-start gap-2">
                                       🎯 Recomendação Estratégica
                                    </h3>
                                    <span className="px-3 py-1 bg-amber-400 text-amber-900 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-300 w-fit mx-auto md:mx-0">
                                       Elite Intel
                                    </span>
                                 </div>
                                 <div className="text-sm font-medium leading-relaxed opacity-90 prose prose-invert max-w-none">
                                    <ReactMarkdown>{stats.recommendation}</ReactMarkdown>
                                 </div>
                                 <div className="pt-4 flex gap-4 justify-center md:justify-start">
                                    <div className="flex items-center gap-2 text-[10px] font-black opacity-60 uppercase tracking-widest">
                                       <History size={14} /> Dados Atualizados
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-black opacity-60 uppercase tracking-widest">
                                       <Zap size={14} /> Análise IA
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               )
            )
         ) : (
            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 border-dashed transition-colors shadow-inner">
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 transition-colors">
                  <Search className="text-slate-300 dark:text-slate-600" size={40} />
               </div>
               <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 transition-colors">Aguardando Seleção</h3>
               <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-2 transition-colors">Selecione uma banca examinadora acima para iniciar a análise.</p>
            </div>
         )}
      </div>
   );
};

export default BankAnalysis;
