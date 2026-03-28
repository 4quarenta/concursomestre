
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Difficulty, Subject, Question, ErrorReport, Material, UserProfile, SystemSettings, DiscountCode, AppPromotionTheme, GlobalTaxonomies } from '../types';
import {
  Search, Trash2, Plus, Edit3, X, XCircle, Flag, AlertTriangle, CheckCircle2, ShoppingBag, LayoutDashboard,
  DollarSign, Users, TrendingUp, Filter, Image as ImageIcon, FileCheck, Ban, MessageSquare, Clock, Eye,
  Settings, User, CreditCard, Megaphone, Palette, Lock, Download, Tag, Mail, Percent, BookOpen, Terminal,
  PlusCircle, Check, AlertCircle, Layers, Save, Database, UploadCloud, FileText, Loader2, PlayCircle,
  Briefcase, Calendar, Trophy, Sparkles, Shield, GraduationCap, ShieldAlert, ShoppingCart, Upload, Bell, ChevronUp, ChevronDown, Zap,
  Flame, Music, Gift, Star, Info
} from 'lucide-react';
import { extractQuestionsFromPage, extractAnswerKeyMapping, generateDetailedAnalysis, generateTeacherComment } from '../services/geminiService';
import * as pdfjs from 'pdfjs-dist';
import { useData } from '../context/DataContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { reputationService } from '../services/reputationService';
import { themeConfig } from '../ui/temas';
import { api } from '../data/api';

pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

// --- COMPONENTE DE SELEÇÃO INTELIGENTE (TAGS) ---

interface SmartTagSelectorProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

const SmartTagSelector: React.FC<SmartTagSelectorProps> = ({ label, options, selected, onChange, placeholder, multiple = true }) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(inputValue.toLowerCase()) && !selected.includes(opt)
  );

  const handleAdd = (val: string) => {
    if (!val.trim()) return;
    if (multiple) {
      if (!selected.includes(val)) onChange([...selected, val]);
    } else {
      onChange([val]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemove = (val: string) => {
    onChange(selected.filter(s => s !== val));
  };

  return (
    <div className="space-y-1.5 flex-1" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className="min-h-[44px] p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          {selected.map(s => (
            <span key={s} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100 dark:border-indigo-900/50">
              {s}
              <button onClick={() => handleRemove(s)} className="hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors"><X size={12} /></button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputValue) {
                e.preventDefault();
                handleAdd(inputValue);
              }
            }}
            placeholder={selected.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[80px] px-2"
          />
        </div>

        {isOpen && (inputValue || filteredOptions.length > 0) && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto no-scrollbar py-2">
            {filteredOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleAdd(opt)}
                className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {opt}
              </button>
            ))}
            {inputValue && !options.includes(inputValue) && (
              <button
                onClick={() => handleAdd(inputValue)}
                className="w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                <PlusCircle size={14} /> Adicionar "{inputValue}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ questions, allMaterials, allTransactions, allUsers }: any) => {
  const totalRevenue = allTransactions.reduce((acc: number, t: any) => acc + t.platformFee, 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receita Total</p>
        <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">R$ {totalRevenue.toFixed(2)}</h3>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Usuários</p>
        <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{allUsers ? allUsers.length : '1.243'}</h3>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Materiais</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{allMaterials.length}</h3>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Questões</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{questions.length}</h3>
      </div>
    </div>
  );
};

const AdminSettings = ({ systemSettings, updateSystemSettings }: any) => {
  const handleToggleFeature = (feature: string, value: boolean) => {
    updateSystemSettings({
      ...systemSettings,
      features: {
        ...systemSettings.features,
        [feature]: value
      }
    });
  };

  const [localApiKey, setLocalApiKey] = useState(systemSettings.geminiApiKey || '');
  const [localGaId, setLocalGaId] = useState(systemSettings.googleAnalyticsId || '');
  const [localPixelId, setLocalPixelId] = useState(systemSettings.metaPixelId || '');
  const [localPhone, setLocalPhone] = useState(systemSettings.supportPhone || '');

  useEffect(() => {
    setLocalApiKey(systemSettings.geminiApiKey || '');
    setLocalGaId(systemSettings.googleAnalyticsId || '');
    setLocalPixelId(systemSettings.metaPixelId || '');
    setLocalPhone(systemSettings.supportPhone || '');
  }, [systemSettings]);

  const handleSaveSettings = () => {
    updateSystemSettings({
      ...systemSettings,
      geminiApiKey: localApiKey,
      googleAnalyticsId: localGaId,
      metaPixelId: localPixelId,
      supportPhone: localPhone
    });
    alert('Configurações salvas com sucesso!');
  };

  const pageToggles = [
    { id: 'practiceEnabled', label: 'Página de Prática', description: 'Ativa o sistema de resolução de questões', icon: BookOpen },
    { id: 'marketplaceEnabled', label: 'Marketplace', description: 'Plataforma de compra e venda de materiais', icon: ShoppingCart },
    { id: 'rankingsEnabled', label: 'Rankings', description: 'Exibe classificações e desempenho de inscritos', icon: Trophy },
    { id: 'xRayEnabled', label: 'Raio-X da Banca', description: 'Análise estatística e perfil de bancas examinadoras', icon: Zap },
    { id: 'landingPagePromoEnabled', label: 'Promoção na Home', description: 'Exibe banner de campanha na landing page principal', icon: Megaphone },
  ];

  const featureToggles = [
    { id: 'communityEnabled', label: 'Comentários da Comunidade', description: 'Interação e fórum de debate em questões', icon: MessageSquare },
    { id: 'aiCommentsEnabled', label: 'Comentários com IA', description: 'Geração de análises via Gemini Pro 1.5/2.0', icon: Sparkles },
    { id: 'bulkImportEnabled', label: 'Importador em Massa', description: 'Ferramenta de processamento de PDFs/Imagens', icon: Upload },
    { id: 'reportsEnabled', label: 'Sistema de Denúncias', description: 'Ouvidoria e moderação de conteúdo', icon: Flag },
    { id: 'notificationsEnabled', label: 'Notificações Push', description: 'Alertas globais e interações sociais', icon: Bell },
  ];

  const criticalSettings = [
    { id: 'maintenanceMode', label: 'Aviso de Manutenção', description: 'Bloqueia o acesso ao site para manutenção técnica', icon: ShieldAlert },
    { id: 'registrationEnabled', label: 'Novos Cadastros', description: 'Controla a entrada de novos usuários na plataforma', icon: Users },
    { id: 'loginRequired', label: 'Login Obrigatório', description: 'Exige login para acessar qualquer conteúdo interno', icon: Lock },
  ];

  const SettingRow = ({ keyName, label, description, icon: Icon }: any) => (
    <div
      key={keyName}
      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition-colors">
          <Icon size={18} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">{label}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
      <button
        onClick={() => handleToggleFeature(keyName, !systemSettings.features[keyName])}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${systemSettings.features[keyName]
          ? keyName === 'maintenanceMode' ? 'bg-red-600' : 'bg-indigo-600 dark:bg-indigo-500'
          : 'bg-slate-300 dark:bg-slate-700'
          }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${systemSettings.features[keyName] ? 'right-1' : 'left-1'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Box: Configurações Gerais */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300 xl:col-span-2">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
                Configurações Gerais
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Definições globais da plataforma</p>
            </div>
            <button
              onClick={handleSaveSettings}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
            >
              <Save size={16} /> Salvar Alterações
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gemini API Key */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Gemini API Key</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Zap size={14} className={localApiKey ? 'text-emerald-500' : 'text-slate-400'} />
                </div>
                <input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="AIza..."
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-tight ml-1">Chave de API necessária para recursos de IA (Correção automáica, Comentários, etc).</p>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Google Analytics */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google Analytics ID</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <TrendingUp size={14} />
                  </div>
                  <input
                    type="text"
                    value={localGaId}
                    onChange={(e) => setLocalGaId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
              </div>

              {/* Meta Pixel */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Meta Pixel ID</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Eye size={14} />
                  </div>
                  <input
                    type="text"
                    value={localPixelId}
                    onChange={(e) => setLocalPixelId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="1234567890"
                  />
                </div>
              </div>

              {/* Suporte WhatsApp */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">WhatsApp Suporte</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <MessageSquare size={14} />
                  </div>
                  <input
                    type="text"
                    value={localPhone}
                    onChange={(e) => setLocalPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="5511999999999"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Box: Páginas e Acesso */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
          <div className="mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <LayoutDashboard size={20} className="text-indigo-600 dark:text-indigo-400" />
              Páginas e Acesso
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Controle a visibilidade dos módulos principais</p>
          </div>
          <div className="space-y-3">
            {pageToggles.map(f => <SettingRow key={f.id} keyName={f.id} {...f} />)}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50">
            <h3 className="text-sm font-black text-red-600 dark:text-red-400 flex items-center gap-2 mb-4 uppercase tracking-widest">
              Configurações Críticas
            </h3>
            <div className="space-y-3">
              {criticalSettings.map(f => <SettingRow key={f.id} keyName={f.id} {...f} />)}
            </div>
          </div>
        </div>

        {/* Box: Módulos e Inteligência Artificial */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
          <div className="mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              Módulos & I.A.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Personalize os recursos dinâmicos da plataforma</p>
          </div>
          <div className="space-y-3">
            {featureToggles.map(f => <SettingRow key={f.id} keyName={f.id} {...f} />)}
          </div>
        </div>

        {/* Box: Gerenciamento de Cache */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300 xl:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
              Gerenciamento de Cache
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Otimize a performance da API com cache inteligente</p>
          </div>

          <CacheManagement />
        </div>

      </div>
    </div>
  );
};

// Cache Management Component
const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('http://localhost/questao-pro-backend/api/cache/manage.php?action=stats');
      const data = await response.json();
      if (data.success) {
        setCacheStats(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas de cache:', error);
    }
  };

  useEffect(() => {
    fetchCacheStats();
  }, []);

  const handleToggleCache = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost/questao-pro-backend/api/cache/manage.php?action=settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !cacheStats?.enabled })
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao atualizar configurações');
    }
    setLoading(false);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o cache?')) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost/questao-pro-backend/api/cache/manage.php?action=clear');
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao limpar cache');
    }
    setLoading(false);
  };

  const handleCleanExpired = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost/questao-pro-backend/api/cache/manage.php?action=clean');
      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        fetchCacheStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Erro ao limpar cache expirado');
    }
    setLoading(false);
  };

  if (!cacheStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium animate-slide-up">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total de Arquivos</p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.total_files || 0}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Entradas Válidas</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{cacheStats.valid_entries || 0}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Entradas Expiradas</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{cacheStats.expired_entries || 0}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Tamanho Total</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{cacheStats.total_size_mb || 0} MB</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enable/Disable */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Status do Cache</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {cacheStats.enabled ? 'Cache ativo - Respostas em cache' : 'Cache desativado - Sem otimização'}
            </p>
          </div>
          <button
            onClick={handleToggleCache}
            disabled={loading}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${cacheStats.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${cacheStats.enabled ? 'right-1' : 'left-1'
                }`}
            />
          </button>
        </div>

        {/* TTL Setting */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Tempo de Vida (TTL)</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Duração padrão do cache</p>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cacheStats.default_ttl || 300} segundos</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCleanExpired}
          disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-200 dark:shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          Limpar Expirados
        </button>
        <button
          onClick={handleClearCache}
          disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 dark:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={16} />
          Limpar Todo Cache
        </button>
        <button
          onClick={fetchCacheStats}
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          Atualizar
        </button>
      </div>
    </div>
  );
};

const AdminFinance = ({ allTransactions, allUsers, systemSettings, updateSystemSettings }: any) => {
  const { generateMockTransactions } = useMarketplace();
  const [activeSection, setActiveSection] = useState<'balance' | 'refunds' | 'transactions' | 'prices'>('balance');

  // --- CALCULOS DE RECEITA ---
  const calculatePlanRevenue = () => {
    if (!allUsers) return 0;
    return allUsers.reduce((acc: number, user: any) => {
      const plan = user.billing?.plan || 'Gratuito';
      if (plan === 'Gratuito') return acc;

      const pricing = systemSettings.pricing[plan];
      if (!pricing) return acc;

      const cycle = user.billing?.billingCycle || 'monthly';
      // Calcula MRR (Monthly Recurring Revenue) estimado
      if (cycle === 'monthly') return acc + pricing.monthly;
      if (cycle === 'quarterly') return acc + (pricing.quarterly / 3);
      if (cycle === 'annual') return acc + (pricing.annual / 12);
      return acc;
    }, 0);
  };

  const calculateMaterialMetrics = () => {
    const metrics = {
      totalSales: 0,
      platformRevenue: 0, // 20%
      sellerPayout: 0,    // 80%
      heldBalance: 0,     // < 7 days
      availablePayout: 0  // >= 7 days
    };

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    allTransactions.forEach((t: any) => {
      if (t.status !== 'completed') return;

      metrics.totalSales += t.amount;
      metrics.platformRevenue += t.amount * 0.20;

      const sellerShare = t.amount * 0.80;
      metrics.sellerPayout += sellerShare;

      const isHeld = (now - t.timestamp) < SEVEN_DAYS_MS;
      if (isHeld) {
        metrics.heldBalance += sellerShare;
      } else {
        metrics.availablePayout += sellerShare;
      }
    });

    return metrics;
  };

  const planRevenue = calculatePlanRevenue();
  const matMetrics = calculateMaterialMetrics();
  const totalPlatformRevenue = planRevenue + matMetrics.platformRevenue;

  // --- NOVOS CALCULOS POR VENDEDOR ---
  const [sellersMetrics, setSellersMetrics] = useState<any[]>([]);
  const [viewingSellerDetails, setViewingSellerDetails] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'available_desc' | 'available_asc' | 'date_asc' | 'date_desc'>('available_desc');

  useEffect(() => {
    if (!allTransactions || !allUsers) return;

    const metricsBySeller: Record<string, any> = {};
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. Identificar todos os vendedores que têm transações
    allTransactions.forEach((t: any) => {
      if (!metricsBySeller[t.sellerId]) {
        const seller = allUsers.find((u: any) => u.id === t.sellerId);
        metricsBySeller[t.sellerId] = {
          id: t.sellerId,
          name: seller?.name || 'Desconhecido',
          email: seller?.email || '-',
          paymentDay: seller?.billing?.paymentDay || Math.floor(Math.random() * 28) + 1, // Mock se não existir
          totalSales: 0,
          heldBalance: 0,
          availablePayout: 0,
          transactions: []
        };
      }

      if (t.status === 'completed') {
        const sellerShare = t.amount * 0.80;
        metricsBySeller[t.sellerId].totalSales += t.amount;
        metricsBySeller[t.sellerId].transactions.push(t);

        const isHeld = (now - t.timestamp) < SEVEN_DAYS_MS;
        if (isHeld) {
          metricsBySeller[t.sellerId].heldBalance += sellerShare;
        } else {
          metricsBySeller[t.sellerId].availablePayout += sellerShare;
        }
      }
    });

    const metricsArray = Object.values(metricsBySeller);
    setSellersMetrics(metricsArray);
  }, [allTransactions, allUsers]);

  const sortedSellers = useMemo(() => {
    return [...sellersMetrics].sort((a, b) => {
      if (sortBy === 'available_desc') return b.availablePayout - a.availablePayout;
      if (sortBy === 'available_asc') return a.availablePayout - b.availablePayout;
      if (sortBy === 'date_asc') return a.paymentDay - b.paymentDay;
      if (sortBy === 'date_desc') return b.paymentDay - a.paymentDay;
      return 0;
    });
  }, [sellersMetrics, sortBy]);

  // --- HANDLERS EXISTENTES ---
  const handlePriceChange = (plan: string, monthlyValue: number) => {
    const updatedPricing = { ...systemSettings.pricing };
    const planConfig = updatedPricing[plan];
    planConfig.monthly = monthlyValue;
    const qDesc = planConfig.quarterlyDiscountPercent || 10;
    const aDesc = planConfig.annualDiscountPercent || 30;
    planConfig.quarterly = (monthlyValue * 3) * (1 - qDesc / 100);
    planConfig.annual = (monthlyValue * 12) * (1 - aDesc / 100);
    updateSystemSettings({ ...systemSettings, pricing: updatedPricing });
  };

  const handleDiscountPercentChange = (plan: string, type: 'quarterly' | 'annual', percent: number) => {
    const updatedPricing = { ...systemSettings.pricing };
    const planConfig = updatedPricing[plan];
    if (type === 'quarterly') planConfig.quarterlyDiscountPercent = percent;
    else planConfig.annualDiscountPercent = percent;
    planConfig.quarterly = (planConfig.monthly * 3) * (1 - (planConfig.quarterlyDiscountPercent || 0) / 100);
    planConfig.annual = (planConfig.monthly * 12) * (1 - (planConfig.annualDiscountPercent || 0) / 100);
    updateSystemSettings({ ...systemSettings, pricing: updatedPricing });
  };

  const handleTogglePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
    const planIndex = plans.indexOf(plan as any);
    const newValue = !updatedPlanDetails[plan as keyof typeof updatedPlanDetails].features[featureIndex].included;

    plans.forEach((p, i) => {
      // If turning ON: also turn ON for all planes above
      if (newValue && i >= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f: any, fi: number) =>
            fi === featureIndex ? { ...f, included: true } : f
          )
        };
      }
      // If turning OFF: also turn OFF for all planes below
      if (!newValue && i <= planIndex) {
        updatedPlanDetails[p] = {
          ...updatedPlanDetails[p],
          features: updatedPlanDetails[p].features.map((f: any, fi: number) =>
            fi === featureIndex ? { ...f, included: false } : f
          )
        };
      }
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleUpdatePlanFeatureText = (plan: string, featureIndex: number, text: string) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.map((f: any, i: number) =>
          i === featureIndex ? { ...f, text } : f
        )
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleAddPlanFeature = (plan: string) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;
    const planIndex = plans.indexOf(plan as any);
    const featureName = 'Novo Recurso';

    plans.forEach((p, i) => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: [...updatedPlanDetails[p].features, { text: featureName, included: i >= planIndex }]
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleRemovePlanFeature = (plan: string, featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    plans.forEach(p => {
      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: updatedPlanDetails[p].features.filter((_: any, i: number) => i !== featureIndex)
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  const handleMovePlanFeature = (direction: 'up' | 'down', featureIndex: number) => {
    const updatedPlanDetails = { ...systemSettings.planDetails };
    const plans = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

    const firstPlan = plans[0];
    const features = [...updatedPlanDetails[firstPlan].features];

    if (direction === 'up' && featureIndex > 0) {
      [features[featureIndex], features[featureIndex - 1]] = [features[featureIndex - 1], features[featureIndex]];
    } else if (direction === 'down' && featureIndex < features.length - 1) {
      [features[featureIndex], features[featureIndex + 1]] = [features[featureIndex + 1], features[featureIndex]];
    } else {
      return;
    }

    // Apply the new order to ALL plans
    plans.forEach(p => {
      // Re-map features to maintain 'included' state for each plan
      const currentPlanFeatures = updatedPlanDetails[p].features;
      const newPlanFeatures = features.map(f => {
        // Find the matching feature in the current plan to get its 'included' status
        const originalFeature = currentPlanFeatures.find((orig: any) => orig.text === f.text);
        return {
          text: f.text,
          included: originalFeature ? originalFeature.included : f.included
        };
      });

      updatedPlanDetails[p] = {
        ...updatedPlanDetails[p],
        features: newPlanFeatures
      };
    });

    updateSystemSettings({ ...systemSettings, planDetails: updatedPlanDetails });
  };

  // --- REEMBOLSOS ---
  const { resolveRefund } = useMarketplace();
  const refundRequests = allTransactions.filter((t: any) => t.status === 'refund_requested');
  const totalInDispute = refundRequests.reduce((acc: number, t: any) => acc + t.amount, 0);
  const totalRefunded = allTransactions
    .filter((t: any) => t.status === 'refunded')
    .reduce((acc: number, t: any) => acc + t.amount, 0);

  const handleResolveRefund = (transactionId: string, resolution: 'approved' | 'rejected') => {
    if (window.confirm(`Tem certeza que deseja ${resolution === 'approved' ? 'APROVAR' : 'REJEITAR'} este reembolso?`)) {
      resolveRefund(transactionId, resolution);
    }
  };

  const selectedSeller = viewingSellerDetails ? sellersMetrics.find(s => s.id === viewingSellerDetails) : null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSection('balance')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'balance' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><DollarSign size={14} /> Balanço Geral</div>
        </button>
        <button
          onClick={() => setActiveSection('refunds')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'refunds' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><ShieldAlert size={14} /> Reembolsos {refundRequests.length > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{refundRequests.length}</span>}</div>
        </button>
        <button
          onClick={() => setActiveSection('transactions')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'transactions' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><FileText size={14} /> Transações</div>
        </button>
        <button
          onClick={() => setActiveSection('prices')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSection === 'prices' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <div className="flex items-center gap-2"><Tag size={14} /> Preços & Planos</div>
        </button>
      </div>

      {activeSection === 'balance' && (
        <div className="space-y-6 animate-fade-in">
          {/* Cards Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={64} className="text-emerald-500" /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Receita da Plataforma (Total)</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">R$ {totalPlatformRevenue.toFixed(2)}</h3>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-bold">Planos: R$ {planRevenue.toFixed(2)}</span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded font-bold">Taxas: R$ {matMetrics.platformRevenue.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingBag size={64} className="text-indigo-500" /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Vendas Loja (Bruto)</p>
              <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {matMetrics.totalSales.toFixed(2)}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Movimentação total</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Lock size={64} className="text-amber-500" /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Saldo Preso (7 Dias)</p>
              <h3 className="text-2xl font-black text-amber-500 dark:text-amber-500">R$ {matMetrics.heldBalance.toFixed(2)}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Em quarentena (garantia)</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle2 size={64} className="text-blue-500" /></div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">A Repassar (Vendedores)</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">R$ {matMetrics.availablePayout.toFixed(2)}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Disponível para saque</p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
            <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4">
              <Info size={16} className="text-indigo-500" /> Detalhes do Modelo de Negócio
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <div className="space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100">Comissão da Plataforma</p>
                <p>A plataforma retém <strong className="text-emerald-600">20%</strong> de todas as vendas de materiais realizadas no Marketplace para cobrir custos operacionais e marketing.</p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100">Repasse aos Vendedores</p>
                <p>Os criadores de conteúdo recebem <strong className="text-blue-600">80%</strong> do valor de venda de seus materiais.</p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100">Política de Reembolso (Saldo Preso)</p>
                <p>Os valores de vendas ficam retidos por <strong className="text-amber-600">7 dias</strong> (prazo legal de arrependimento) antes de serem liberados para o saldo "A Repassar".</p>
              </div>
            </div>
          </div>

          {/* LISTA DE REPASSES A VENDEDORES */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><Users size={20} className="text-indigo-500" /> Repasses a Vendedores</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg py-1.5 pl-3 pr-8 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="available_desc">Maior Valor a Repassar</option>
                  <option value="available_asc">Menor Valor a Repassar</option>
                  <option value="date_asc">Data Próxima</option>
                  <option value="date_desc">Data Distante</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-6 pl-8">Vendedor</th>
                    <th className="p-6 text-right">Saldo Preso</th>
                    <th className="p-6 text-right">Disponível</th>
                    <th className="p-6 text-center">Dia Pagamento</th>
                    <th className="p-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {sortedSellers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhum vendedor com saldo encontrado.</td></tr>
                  ) : (
                    sortedSellers.map((seller: any) => (
                      <tr key={seller.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-6 pl-8">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{seller.name}</div>
                          <div className="text-[10px] text-slate-400">{seller.email}</div>
                        </td>
                        <td className="p-6 text-right font-medium text-amber-600 dark:text-amber-500">
                          R$ {seller.heldBalance.toFixed(2)}
                        </td>
                        <td className="p-6 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          R$ {seller.availablePayout.toFixed(2)}
                        </td>
                        <td className="p-6 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            <Calendar size={12} /> Dia {seller.paymentDay}
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          <button
                            onClick={() => setViewingSellerDetails(seller.id)}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 transition-all shadow-sm"
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO VENDEDOR */}
      {viewingSellerDetails && selectedSeller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl p-1 shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-t-[2.4rem] border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded mb-2 block w-fit">Extrato do Vendedor</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedSeller.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedSeller.email}</p>
              </div>
              <button onClick={() => setViewingSellerDetails(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-400"><X size={24} /></button>
            </div>
            <div className="p-8 grid grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-800">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">Disponível para Saque</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">R$ {selectedSeller.availablePayout.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-1">Saldo Preso</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">R$ {selectedSeller.heldBalance.toFixed(2)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-1">Próximo Pagamento</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200">Dia {selectedSeller.paymentDay}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-6">Data</th>
                    <th className="p-6">Protocolo</th>
                    <th className="p-6">Material</th>
                    <th className="p-6 text-right">Valor Venda</th>
                    <th className="p-6 text-right">Parte Vendedor (80%)</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedSeller.transactions.map((t: any) => {
                    const isHeld = (Date.now() - t.timestamp) < (7 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-6">{new Date(t.timestamp).toLocaleDateString()} <span className="text-[10px] text-slate-400 block">{new Date(t.timestamp).toLocaleTimeString()}</span></td>
                        <td className="p-6 font-mono text-[10px] text-slate-500">{t.id.substring(0, 12).toUpperCase()}...</td>
                        <td className="p-6 font-bold text-slate-800 dark:text-slate-200">{t.materialTitle}</td>
                        <td className="p-6 text-right">R$ {t.amount.toFixed(2)}</td>
                        <td className="p-6 text-right font-bold text-slate-900 dark:text-slate-100">R$ {(t.amount * 0.80).toFixed(2)}</td>
                        <td className="p-6 text-center">
                          {isHeld ? (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-[10px] font-black uppercase">Preso (7d)</span>
                          ) : (
                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">Liberado</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
              <button onClick={() => setViewingSellerDetails(null)} className="px-8 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'refunds' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30">
              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Em Disputa (Solicitados)</p>
              <h3 className="text-2xl font-black text-red-700 dark:text-red-300">R$ {totalInDispute.toFixed(2)}</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Devolvido</p>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-300">R$ {totalRefunded.toFixed(2)}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-500" /> Solicitações Pendentes
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-6 pl-8">Comprador</th>
                  <th className="p-6">Material / Produto</th>
                  <th className="p-6">Motivo</th>
                  <th className="p-6 text-right">Valor</th>
                  <th className="p-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {refundRequests.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma solicitação de reembolso pendente.</td></tr>
                ) : (
                  refundRequests.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-6 pl-8 font-bold">{t.buyerName}</td>
                      <td className="p-6">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{t.materialTitle}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.id.substring(0, 8)}...</div>
                      </td>
                      <td className="p-6">
                        <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded text-[10px] font-bold">
                          {t.refundReason || 'Não informado'}
                        </span>
                      </td>
                      <td className="p-6 text-right font-black">R$ {t.amount.toFixed(2)}</td>
                      <td className="p-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleResolveRefund(t.id, 'approved')}
                            className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                            title="Aprovar Devolução"
                          >
                            <Check size={16} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => handleResolveRefund(t.id, 'rejected')}
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                            title="Rejeitar (Manter Venda)"
                          >
                            <X size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'transactions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"><h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Transações Recentes</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800"><tr><th className="p-4">Data</th><th className="p-4">Material</th><th className="p-4">Comprador</th><th className="p-4 text-right">Avaliação (7d)</th><th className="p-4 text-right">Valor</th><th className="p-4 text-right">Taxa (20%)</th></tr></thead>
              <tbody className="text-slate-700 dark:text-slate-300 divide-y divide-slate-50 dark:divide-slate-800">
                {allTransactions.map((t: any) => {
                  const isHeld = (Date.now() - t.timestamp) < (7 * 24 * 60 * 60 * 1000);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4">{new Date(t.timestamp).toLocaleDateString()}</td>
                      <td className="p-4 font-bold">{t.materialTitle}</td>
                      <td className="p-4">{t.buyerName}</td>
                      <td className="p-4 text-right">
                        {isHeld ? (
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-black uppercase">Preso</span>
                        ) : (
                          <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black uppercase">Liberado</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold">R$ {t.amount.toFixed(2)}</td>
                      <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">+ R$ {(t.amount * 0.20).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'prices' && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
          <div className="mb-8 border-b border-slate-100 dark:border-slate-800/50 pb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">Configuração de Planos</h3>
            <p className="text-sm text-slate-500 font-medium">Defina os valores base e descontos cumulativos para cada nível de assinatura.</p>
          </div>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                updateSystemSettings(systemSettings);
                alert('Planos salvos com sucesso!');
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
            >
              <Save size={16} /> Salvar Planos
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Object.entries(systemSettings.pricing).map(([plan, config]: any) => (
              <div key={plan} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{plan}</h4>
                  <span className="text-[10px] font-black bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm text-slate-400 uppercase">Valores em Reais</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Mensal (Base)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        value={config.monthly}
                        onChange={e => handlePriceChange(plan, Number(e.target.value))}
                        className="w-full h-12 pl-12 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all text-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desconto Trimestral</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={config.quarterlyDiscountPercent || 0}
                          onChange={e => handleDiscountPercentChange(plan, 'quarterly', Number(e.target.value))}
                          className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desconto Anual</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={config.annualDiscountPercent || 0}
                          onChange={e => handleDiscountPercentChange(plan, 'annual', Number(e.target.value))}
                          className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Trimestral</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.quarterly.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.quarterly / 3).toFixed(2)}/mês</p>
                      <p className="text-[9px] text-emerald-500 font-bold">Economia de R$ {(config.monthly * 3 - config.quarterly).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Anual</p>
                      <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {config.annual.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">≈ R$ {(config.annual / 12).toFixed(2)}/mês</p>
                      <p className="text-[9px] text-indigo-500 font-bold">Economia de R$ {(config.monthly * 12 - config.annual).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Recursos do Plano</p>
                    {systemSettings.planDetails[plan].features.map((feature: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 group/feature">
                        <button
                          onClick={() => handleTogglePlanFeature(plan, idx)}
                          className={`p-1 rounded-md transition-colors ${feature.included ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-300 bg-slate-50 dark:bg-slate-800'}`}
                        >
                          {feature.included ? <Check size={12} /> : <X size={12} />}
                        </button>
                        <input
                          type="text"
                          value={feature.text}
                          onChange={(e) => handleUpdatePlanFeatureText(plan, idx, e.target.value)}
                          className="flex-1 bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:text-indigo-600 transition-colors"
                        />
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/feature:opacity-100 transition-all">
                          <button
                            onClick={() => handleMovePlanFeature('up', idx)}
                            disabled={idx === 0}
                            className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMovePlanFeature('down', idx)}
                            disabled={idx === systemSettings.planDetails[plan].features.length - 1}
                            className="p-1 text-slate-300 hover:text-indigo-500 disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button
                            onClick={() => handleRemovePlanFeature(plan, idx)}
                            className="p-1 text-slate-300 hover:text-red-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddPlanFeature(plan)}
                      className="w-full py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center justify-center gap-1 mt-2"
                    >
                      <Plus size={12} /> Adicionar Recurso
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminMarketing = ({ systemSettings, updateSystemSettings, addCoupon, deleteCoupon }: any) => {
  const [activeSection, setActiveSection] = useState<'coupons' | 'promo' | 'themes'>('coupons');
  const [newCoupon, setNewCoupon] = useState({ code: '', discountPercentage: 10, maxUses: 100 });

  const themes: { value: AppPromotionTheme; label: string }[] = [
    { value: 'default', label: 'Padrão (Azul/Slate)' },
    { value: 'black-friday', label: 'Black Friday (Preto/Roxo)' },
    { value: 'black-november', label: 'Black November' },
    { value: 'estudante', label: 'Dia do Estudante' },
    { value: 'sao-joao', label: 'São João' },
    { value: 'carnaval', label: 'Carnaval' },
    { value: 'ano-novo', label: 'Ano Novo' },
    { value: 'pascoa', label: 'Páscoa' },
    { value: 'consumidor', label: 'Semana do Consumidor' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-hidden no-scrollbar">
        <button
          onClick={() => setActiveSection('coupons')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'coupons' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Percent size={14} /> Cupons de Desconto
        </button>
        <button
          onClick={() => setActiveSection('promo')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'promo' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Megaphone size={14} /> Campanhas
        </button>
        <button
          onClick={() => setActiveSection('themes')}
          className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSection === 'themes' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Palette size={14} /> Temas Visuais
        </button>
      </div>

      {activeSection === 'coupons' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-end gap-4 transition-colors">
            <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Código</label><input type="text" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-black uppercase bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" placeholder="EX: APROVADO20" /></div>
            <div className="w-32 space-y-1"><label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Desconto (%)</label><input type="number" value={newCoupon.discountPercentage} onChange={e => setNewCoupon({ ...newCoupon, discountPercentage: Number(e.target.value) })} className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none focus:border-indigo-500 transition-colors" /></div>
            <button onClick={() => { addCoupon(newCoupon); setNewCoupon({ code: '', discountPercentage: 10, maxUses: 100 }); }} className="h-10 px-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all">Criar Cupom</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemSettings.coupons.map((coupon: any) => (
              <div key={coupon.code} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                <div><h4 className="font-black text-slate-900 dark:text-slate-100">{coupon.code}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{coupon.discountPercentage}% OFF • {coupon.uses} usos</p></div>
                <button onClick={() => deleteCoupon(coupon.code)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'promo' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Megaphone size={20} className="text-indigo-600 dark:text-indigo-400" /> Campanha Ativa
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configure a campanha promocional global da plataforma.</p>
              </div>
              <button
                onClick={() => updateSystemSettings({
                  ...systemSettings,
                  activePromotion: { ...systemSettings.activePromotion, isActive: !systemSettings.activePromotion.isActive }
                })}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${systemSettings.activePromotion.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}
              >
                {systemSettings.activePromotion.isActive ? 'Ativada' : 'Desativada'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Campanha</label>
                <input
                  type="text"
                  value={systemSettings.activePromotion.name}
                  onChange={e => updateSystemSettings({
                    ...systemSettings,
                    activePromotion: { ...systemSettings.activePromotion, name: e.target.value }
                  })}
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Texto do Banner</label>
                <input
                  type="text"
                  value={systemSettings.activePromotion.bannerText}
                  onChange={e => updateSystemSettings({
                    ...systemSettings,
                    activePromotion: { ...systemSettings.activePromotion, bannerText: e.target.value }
                  })}
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl space-y-4">
              <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} /> Preview da Notificação
              </h4>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{systemSettings.activePromotion.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{systemSettings.activePromotion.bannerText}</p>
              </div>
              <button
                onClick={() => alert("Notificação enviada!")}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all"
              >
                Disparar para todos os usuários
              </button>
            </div>
          </div>
        </div>
      )}

      {
        activeSection === 'themes' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Palette size={20} className="text-indigo-600 dark:text-indigo-400" /> Temas Promocionais
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Personalize a identidade visual da plataforma para eventos especiais.</p>
              </div>
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                Ativo: {systemSettings.activeTheme || 'default'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(themeConfig).map(([id, theme]) => (
                <button
                  key={id}
                  onClick={() => updateSystemSettings({ ...systemSettings, activeTheme: id as any })}
                  className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all relative overflow-hidden group ${systemSettings.activeTheme === id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700 hover:scale-[1.02]'}`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${id === 'default' ? 'text-slate-600 bg-slate-100 dark:bg-slate-800' : id === 'black-friday' ? 'text-white bg-black dark:bg-zinc-950' : id === 'black-november' ? 'text-amber-500 bg-zinc-900' : id === 'estudante' ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/30' : id === 'sao-joao' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' : id === 'carnaval' ? 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/30' : id === 'ano-novo' ? 'text-amber-500 bg-indigo-950' : id === 'pascoa' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30' : 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'}`}>
                    <theme.icon size={32} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                      {id === 'default' ? 'Padrão (Modern)' : id === 'black-friday' ? 'Black Friday' : id === 'black-november' ? 'Black November' : id === 'estudante' ? 'Dia do Estudante' : id === 'sao-joao' ? 'São João' : id === 'carnaval' ? 'Carnaval' : id === 'ano-novo' ? 'Ano Novo' : id === 'pascoa' ? 'Páscoa' : 'Semana do Consumidor'}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{id}</p>
                  </div>
                  {systemSettings.activeTheme === id && (
                    <div className="absolute top-4 right-4 text-indigo-600">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl flex items-start gap-4">
              <div className="p-2 bg-white dark:bg-amber-900/50 rounded-xl text-amber-600">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase">Impacto Visual Global</h4>
                <p className="text-xs text-amber-700 dark:text-amber-500/80 font-medium leading-relaxed mt-1">
                  A alteração do tema impacta imediatamente a Landing Page e elementos decorativos em toda a plataforma (banners, badges e destaques). O sistema de cores light/dark continua funcionando de forma complementar ao tema selecionado.
                </p>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

const AdminDatabaseManager = ({
  questions, allUsers, allMaterials, allReports, allTransactions,
  onDeleteQuestion, onAddQuestion, onAddQuestions, onUpdateQuestion, resolveReport,
  updateUserStatus, moderateMaterial, onDeleteMaterial, systemSettings
}: any) => {
  const { dispatch, updateSystemSettings } = useData();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [activeSubTab, setActiveSubTab] = useState<'questions' | 'users' | 'materials' | 'rankings' | 'import' | 'reports' | 'blocked' | 'filters'>('questions');
  const [pagination, setPagination] = useState({ total: 0, perPage: 20, pages: 1, page: 1 });

  // Filter Management State
  const [activeFilterType, setActiveFilterType] = useState<string>('banca');
  const [filterInput, setFilterInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingFilterItem, setEditingFilterItem] = useState<{ id?: number; item: any; originalName: string } | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  const filterTypes = [
    { key: 'banca', label: 'Bancas' },
    { key: 'orgao', label: 'Órgãos' },
    { key: 'cargo', label: 'Cargos' },
    { key: 'assunto', label: 'Assuntos (Matérias/Tópicos)', hierarchical: true },
    { key: 'ano', label: 'Anos' },
    { key: 'carreira', label: 'Carreiras' },
    { key: 'area', label: 'Áreas' },
    { key: 'nivel', label: 'Nível de Escolaridade' },
    { key: 'tipo_prova', label: 'Tipo de Prova (P1, P2...)' },
    { key: 'modalidade', label: 'Modalidades (A, B, C...)' }
  ];

  const fetchFilters = async () => {
    try {
      const res = await api.get<any>('api/filters/list.php');
      if (res.success) {
        updateSystemSettings({ ...systemSettings, taxonomies: res.data });
      }
    } catch (e) { console.error('Error fetching filters:', e); }
  };

  const handleSaveFilter = async () => {
    if (!filterInput.trim()) return;
    try {
      const res = await api.post<any>('api/filters/save.php', {
        id: editingFilterItem?.id,
        type: activeFilterType,
        name: filterInput.trim(),
        parent_id: selectedParentId,
        metadata: editingFilterItem?.item?.metadata || {}
      });
      if (res.success) {
        setFilterInput('');
        setEditingFilterItem(null);
        setSelectedParentId(null);
        fetchFilters();
      }
    } catch (e) { alert('Erro ao salvar filtro'); }
  };

  const handleDeleteFilter = async (id: number) => {
    if (!confirm('Tem certeza?')) return;
    try {
      const res = await api.get<any>('api/filters/delete.php', { id: id.toString() });
      if (res.success) fetchFilters();
    } catch (e) { alert('Erro ao deletar filtro'); }
  };

  const startEditingFilter = (item: any) => {
    setFilterInput(item.name);
    setEditingFilterItem({ id: item.id, item, originalName: item.name });
    setSelectedParentId(item.parent_id);
  };

  const cancelEditingFilter = () => {
    setFilterInput('');
    setEditingFilterItem(null);
    setSelectedParentId(null);
  };

  // Material Moderation State
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationEvidence, setModerationEvidence] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['questions', 'users', 'materials', 'rankings', 'import', 'reports', 'blocked', 'filters'].includes(tabParam)) {
      setActiveSubTab(tabParam as any);
      if (tabParam === 'filters') fetchFilters();
    }
  }, [searchParams]);

  // Handle Hash Scroll
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-indigo-50', 'ring-2', 'ring-indigo-500');
          setTimeout(() => element.classList.remove('bg-indigo-50', 'ring-2', 'ring-indigo-500'), 3000);
        }
      }, 800);
    }
  }, [location.hash, activeSubTab]);

  const [filter, setFilter] = useState('');

  // Modais
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [editingExtractedIndex, setEditingExtractedIndex] = useState<number | null>(null);
  const [isGeneratingDetailed, setIsGeneratingDetailed] = useState(false);

  // --- PDF IMPORTER STATE ---
  const [qFile, setQFile] = useState<File | null>(null);
  const [kFile, setKFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractWithComment, setExtractWithComment] = useState(true);
  const [examProgress, setExamProgress] = useState(0);
  const [keyProgress, setKeyProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);

  // Bulk Generation State
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);

  const [generatingSpecific, setGeneratingSpecific] = useState<{ index: number, type: 'teacher' | 'detailed' } | null>(null);

  const loadQuestions = async (page = 1) => {
    try {
      const res = await api.get<any>('api/questions/filter.php', {
        page: page.toString(),
        keyword: filter
      });
      if (res.success && res.data) {
        setAdminQuestions(res.data.rows);
        setPagination({
          total: res.data.total,
          perPage: res.data.perPage,
          pages: res.data.pages,
          page: res.data.page
        });
      }
    } catch (e) { console.error('Error loading questions:', e); }
  };

  useEffect(() => {
    if (activeSubTab === 'questions') loadQuestions(1);
  }, [activeSubTab, filter]);
  // Dados para os Seletores Inteligentes
  const existingAgencies = useMemo(() => {
    return (systemSettings.taxonomies?.['banca'] || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['banca']]);

  const existingOrgaos = useMemo(() => {
    return (systemSettings.taxonomies?.['orgao'] || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['orgao']]);

  const existingSubjects = useMemo(() => {
    return (systemSettings.taxonomies?.['assunto'] || []).filter((t: any) => t.materia || t.metadata?.materia).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['assunto']]);

  const existingTopics = useMemo(() => {
    return (systemSettings.taxonomies?.['assunto'] || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['assunto']]);

  const existingYears = useMemo(() => {
    return (systemSettings.taxonomies?.['ano'] || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['ano']]);

  const existingRoles = useMemo(() => {
    return (systemSettings.taxonomies?.['cargo'] || []).map((t: any) => t.name);
  }, [systemSettings.taxonomies?.['cargo']]);

  // Form Manual Questão
  const [manualQ, setManualQ] = useState<any>({
    enunciado: '', enunciado_clean: '', introText: '', imageUrl: '',
    bancas: [], subjects: [], dificuldade: 2,
    itens: [
      { id: 1, corpo: '', corpo_clean: '', rotulo: 'A' },
      { id: 2, corpo: '', corpo_clean: '', rotulo: 'B' },
      { id: 3, corpo: '', corpo_clean: '', rotulo: 'C' },
      { id: 4, corpo: '', corpo_clean: '', rotulo: 'D' },
      { id: 5, corpo: '', corpo_clean: '', rotulo: 'E' },
    ],
    resposta: 1, teacherComment: '', detailedComment: '',
    orgaos: [], anos: [], cargos: [], assuntos: [], level: 'Superior', tipo: 'Múltipla Escolha',
    anulada: false, desatualizada: false,
    text: '', // Legacy support
    agencies: [], years: [], topics: [], roles: []
  });

  const addLog = (msg: string) => setLogs(prev => [`> ${msg}`, ...prev].slice(0, 50));

  const pdfToImage = async (pdfDoc: any, pageNum: number): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
    throw new Error("Falha ao renderizar PDF");
  };

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      alert("Arquivos de Prova e Gabarito são obrigatórios para este processo.");
      return;
    }
    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExamProgress(0);
    setKeyProgress(0);

    try {
      // 1. Process Answer Key first
      addLog("Iniciando leitura do Gabarito...");
      const kBuffer = await kFile.arrayBuffer();
      const kPdf = await pdfjs.getDocument(kBuffer).promise;
      const kImg = await pdfToImage(kPdf, 1);
      setKeyProgress(50);
      const keyMap = await extractAnswerKeyMapping(systemSettings.geminiApiKey || '', kImg);
      setKeyProgress(100);
      addLog("Gabarito oficial mapeado pela IA.");

      // 2. Process Questions Page by Page
      addLog("Iniciando motor de extração IA (Prova)...");
      const qBuffer = await qFile.arrayBuffer();
      const qPdf = await pdfjs.getDocument(qBuffer).promise;
      const pagesCount = qPdf.numPages;
      setTotalPages(pagesCount);
      addLog(`Arquivo de prova identificado: ${pagesCount} páginas.`);

      let allFoundQuestions: Question[] = [];

      for (let i = 1; i <= pagesCount; i++) {
        setCurrentPage(i);
        addLog(`Lendo pág ${i}/${pagesCount}...`);

        const pageImg = await pdfToImage(qPdf, i);
        // Passando a opção de extrair com comentário ou não
        const result = await extractQuestionsFromPage(systemSettings.geminiApiKey || '', pageImg, extractWithComment);

        if (result.questions && result.questions.length > 0) {
          addLog(`${result.questions.length} questões encontradas na pág ${i}.`);

          const mappedQs = result.questions.map((q, idx) => {
            const questionNumber = allFoundQuestions.length + idx + 1;
            const qAny = q as any;
            return {
              ...q,
              // id will be generated by MySQL auto_increment
              hashId: result.metadata?.hash_id,
              enunciado: qAny.text || q.enunciado || '',
              enunciado_clean: (qAny.text || q.enunciado || '').replace(/<[^>]*>?/gm, ''),
              bancas: result.metadata?.agency ? [{ sigla: result.metadata.agency, name: result.metadata.agency, id: null, slug: result.metadata.agency.toLowerCase() }] : [],
              orgaos: result.metadata?.source ? [{ name: result.metadata.source, id: null, slug: result.metadata.source.toLowerCase() }] : [],
              cargos: result.metadata?.role ? [{ id: null, slug: result.metadata.role.toLowerCase(), descricao: result.metadata.role }] : [],
              assuntos: [
                ...(qAny.subject ? [{ id: null, name: qAny.subject, slug: qAny.subject.toLowerCase(), materia: true }] : []),
                ...(qAny.topic ? [{ id: null, name: qAny.topic, slug: qAny.topic.toLowerCase(), materia: false }] : [])
              ],
              anos: result.metadata?.year ? [Number(result.metadata.year)] : [new Date().getFullYear()],
              tipo: (qAny.options || []).length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: qAny.difficulty === 'Fácil' ? 1 : qAny.difficulty === 'Difícil' ? 3 : 2,
              itens: (qAny.options || []).map((o: string, i: number) => ({
                id: i + 1,
                ordem: i + 1,
                rotulo: String.fromCharCode(65 + i),
                corpo: o,
                corpo_clean: o.replace(/<[^>]*>?/gm, '')
              })),
              resposta: keyMap[questionNumber] !== undefined ? keyMap[questionNumber] + 1 : 1,
              stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
              comments: []
            } as unknown as Question;
          });

          allFoundQuestions = [...allFoundQuestions, ...mappedQs];
          setExtractedQuestions([...allFoundQuestions]);
        }

        setExamProgress(Math.round((i / pagesCount) * 100));
      }

      addLog("IMPORTAÇÃO CONCLUÍDA! Revise as questões.");
    } catch (e: any) {
      addLog(`ERRO CRÍTICO: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) return;
    setIsBulkGenerating(true);
    setBulkProgress(0);
    addLog("Iniciando geração em massa de comentários detalhados...");

    const updatedList = [...extractedQuestions];
    const total = updatedList.length;

    for (let i = 0; i < total; i++) {
      // Skip if already has detailed comment
      if (!updatedList[i].detailedComment) {
        try {
          const detail = await generateDetailedAnalysis(systemSettings.geminiApiKey || '', updatedList[i]);
          updatedList[i] = { ...updatedList[i], detailedComment: detail };
          setExtractedQuestions([...updatedList]); // Update UI incrementally
        } catch (e) {
          addLog(`Erro ao gerar detalhado para questão ${i + 1}`);
        }
      }
      setBulkProgress(Math.round(((i + 1) / total) * 100));
    }

    addLog("Geração em massa concluída!");
    setIsBulkGenerating(false);
  };

  const handleGenerateSpecific = async (index: number, type: 'teacher' | 'detailed') => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    try {
      let updatedQ = { ...question };
      if (type === 'teacher') {
        const comment = await generateTeacherComment(systemSettings.geminiApiKey || '', question);
        updatedQ.teacherComment = comment;
      } else {
        const detail = await generateDetailedAnalysis(systemSettings.geminiApiKey || '', question);
        updatedQ.detailedComment = detail;
      }

      const newList = [...extractedQuestions];
      newList[index] = updatedQ;
      setExtractedQuestions(newList);
    } catch (e) {
      alert("Erro ao gerar comentário. Tente novamente.");
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const handleGenerateManualDetail = async () => {
    setIsGeneratingDetailed(true);
    const q: Question = { ...manualQ, options: manualQ.options.filter((o: string) => o) } as Question;
    const detail = await generateDetailedAnalysis(systemSettings.geminiApiKey || '', q);
    setManualQ({ ...manualQ, detailedComment: detail });
    setIsGeneratingDetailed(false);
  };

  const handleSaveManual = async () => {
    const newQ: Question = {
      id: editingQuestion?.id ? Number(editingQuestion.id) : null,
      enunciado: manualQ.enunciado || manualQ.text,
      enunciado_clean: manualQ.enunciado_clean || (manualQ.text ? manualQ.text.replace(/<[^>]*>?/gm, '') : ''),
      introText: manualQ.introText,
      imageUrl: manualQ.imageUrl,

      // Map strings from selectors back to objects if they aren't already
      bancas: manualQ.bancas.map((b: any) => typeof b === 'string' ? (systemSettings.taxonomies?.['banca']?.find((t: any) => t.sigla === b || t.name === b) || { id: null, sigla: b, name: b, slug: b.toLowerCase() }) : b),
      orgaos: manualQ.orgaos.map((o: any) => typeof o === 'string' ? (systemSettings.taxonomies?.['orgao']?.find((t: any) => t.name === o) || { id: null, name: o, slug: o.toLowerCase() }) : o),
      cargos: manualQ.cargos.map((c: any) => typeof c === 'string' ? (systemSettings.taxonomies?.['cargo']?.find((t: any) => t.name === c) || { id: null, slug: c.toLowerCase(), name: c }) : c),
      assuntos: [
        ...manualQ.subjects.map((s: any) => typeof s === 'string' ? (systemSettings.taxonomies?.['assunto']?.find((t: any) => t.name === s) || { id: null, name: s, slug: s.toLowerCase(), materia: true }) : { ...s, materia: true }),
        ...manualQ.assuntos.map((a: any) => typeof a === 'string' ? (systemSettings.taxonomies?.['assunto']?.find((t: any) => t.name === a) || { id: null, name: a, slug: a.toLowerCase(), materia: false }) : { ...a, materia: false })
      ],
      anos: manualQ.anos.map((y: any) => Number(y)),

      tipo: manualQ.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      dificuldade: manualQ.difficulty,

      itens: manualQ.itens.filter((it: any) => it.corpo.trim()),
      resposta: manualQ.resposta,

      teacherComment: manualQ.teacherComment,
      detailedComment: manualQ.detailedComment,

      anulada: manualQ.anulada,
      desatualizada: manualQ.desatualizada,

      stats: editingQuestion?.stats || { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
      comments: editingQuestion?.comments || [],
      timestamp: new Date().toISOString()
    } as Question;

    try {
      // Se estivermos editando uma questão da extração temporária
      if (editingExtractedIndex !== null) {
        const updatedExtracted = [...extractedQuestions];
        updatedExtracted[editingExtractedIndex] = newQ;
        setExtractedQuestions(updatedExtracted);
        setEditingExtractedIndex(null);
        alert("Questão extraída revisada com sucesso!");
      } else {
        // Se for edição/criação direta no banco
        let res;
        if (editingQuestion) {
          res = await onUpdateQuestion(newQ);
        } else {
          res = await onAddQuestion(newQ);
        }
        setEditingQuestion(null);

        let msg = "Questão salva com sucesso!";
        if (res?.newTaxonomies?.length > 0) {
          msg += "\n\nNovos itens criados: " + res.newTaxonomies.map((t: any) => `${t.type}: ${t.name}`).join(", ");
        }
        alert(msg);
      }
    } catch (error) {
      console.error("Error saving manual question:", error);
      alert("Erro ao salvar questão. Verifique o console para mais detalhes.");
    } finally {
      setShowAddManual(false);
    }
  };

  const handleEditReportTarget = (report: ErrorReport) => {
    if (report.targetType === 'question' && report.questionId) {
      const q = questions.find((q: Question) => q.id === report.questionId);
      if (q) openManualModal(q);
      else alert("Questão não encontrada (pode ter sido excluída).");
    } else if (report.targetType === 'material') {
      if (!report.materialId) {
        alert("Erro: ID do material não encontrado na denúncia.");
        return;
      }
      const m = allMaterials.find((m: Material) => m.id === report.materialId);
      if (m) {
        setEditingMaterial(m);
        setSelectedReport(report);
        setModerationReason(m.rejectionReason || '');
      } else {
        alert(`Material não encontrado com ID: ${report.materialId}`);
      }
    }
  };

  const openManualModal = (q?: Question, extractedIndex?: number) => {
    if (q) {
      setEditingQuestion(q);
      setEditingExtractedIndex(extractedIndex !== undefined ? extractedIndex : null);

      const qAny = q as any;
      setManualQ({
        ...q,
        enunciado: q.enunciado || qAny.text || '',
        enunciado_clean: q.enunciado_clean || (qAny.text ? qAny.text.replace(/<[^>]*>?/gm, '') : ''),
        bancas: q.bancas || (qAny.agency ? [{ sigla: qAny.agency, name: qAny.agency }] : []),
        orgaos: q.orgaos || (qAny.organization ? [{ name: qAny.organization }] : []),
        cargos: q.cargos || (qAny.role ? [{ name: qAny.role }] : []),
        subjects: q.assuntos?.filter((a: any) => a.materia) || (qAny.subject ? [{ name: qAny.subject, materia: true }] : []),
        assuntos: q.assuntos?.filter((a: any) => !a.materia) || (qAny.topic ? [{ name: qAny.topic, materia: false }] : []),
        anos: q.anos || (qAny.year ? [Number(qAny.year)] : []),
        dificuldade: q.dificuldade || qAny.difficulty || 2,
        tipo: q.tipo || qAny.modality || 'Múltipla Escolha',
        itens: q.itens || qAny.options?.map((o: string, idx: number) => ({ id: idx + 1, corpo: o, corpo_clean: o.replace(/<[^>]*>?/gm, ''), rotulo: String.fromCharCode(65 + idx) })) || [],
        resposta: q.resposta || (qAny.correctOptionIndex !== undefined ? qAny.correctOptionIndex + 1 : 1),
        anulada: q.anulada || qAny.isCanceled || false,
        desatualizada: q.desatualizada || qAny.isOutdated || false,
        detailedComment: q.detailedComment || ''
      });
    } else {
      setEditingQuestion(null);
      setEditingExtractedIndex(null);
      setManualQ({
        enunciado: '', enunciado_clean: '', introText: '', imageUrl: '',
        bancas: [], orgaos: [], assuntos: [], anos: [], cargos: [],
        subjects: [], dificuldade: 2,
        itens: [
          { id: 1, corpo: '', corpo_clean: '', rotulo: 'A' },
          { id: 2, corpo: '', corpo_clean: '', rotulo: 'B' },
          { id: 3, corpo: '', corpo_clean: '', rotulo: 'C' },
          { id: 4, corpo: '', corpo_clean: '', rotulo: 'D' },
          { id: 5, corpo: '', corpo_clean: '', rotulo: 'E' },
        ],
        resposta: 1, teacherComment: '', detailedComment: '',
        nivel: 'Superior', tipo: 'Múltipla Escolha',
        anulada: false, desatualizada: false
      });
    }
    setShowAddManual(true);
  };

  return (
    <div className="space-y-6 animate-slide-up relative">
      {/* TABS DE GESTÃO */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
          {['questions', 'users', 'materials', 'rankings', 'import', 'reports', 'blocked', 'filters'].filter(tab => tab !== 'import' || systemSettings.features.bulkImportEnabled).map(tab => (
            <button key={tab} onClick={() => setActiveSubTab(tab as any)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${activeSubTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}>
              {tab === 'import' ? 'Importador em Massa' :
                tab === 'questions' ? 'Questões' :
                  tab === 'users' ? 'Usuários' :
                    tab === 'materials' ? 'Materiais' :
                      tab === 'rankings' ? 'Rankings' :
                        tab === 'reports' ? 'Denúncias' :
                          tab === 'blocked' ? 'Bloqueados' : 'Filtro'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input type="text" placeholder="Filtrar dados..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full h-10 pl-9 pr-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" />
          </div>
          {activeSubTab === 'questions' && (
            <div className="flex items-center gap-2">
              <button onClick={() => openManualModal()} className="h-10 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-md"><Plus size={16} /> Nova</button>
            </div>
          )}
        </div>
      </div>

      {activeSubTab === 'questions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr><th className="p-4">Questão</th><th className="p-4">Status</th><th className="p-4">Banca/Matéria</th><th className="p-4 text-center">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {adminQuestions.map((q: any) => (
                  <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 max-w-md truncate text-slate-900 dark:text-slate-100 font-medium">{q.enunciado_clean || q.text}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {q.anulada && <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Anulada</span>}
                        {q.desatualizada && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Desat.</span>}
                        {q.detailedComment && <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black uppercase" title="Possui Análise Detalhada">IA</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          {q.bancas?.map((b: any) => b.sigla).join(' / ') || 'Banca'}
                        </span>
                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">
                          {q.assuntos?.map((s: any) => s.materia ? s.nome : '').filter(Boolean).join(', ') || 'Matéria'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openManualModal(q)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => onDeleteQuestion(q.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {pagination.total}</span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => loadQuestions(pagination.page - 1)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30">Anterior</button>
              <span className="flex items-center px-4 text-[10px] font-black uppercase text-indigo-600">Página {pagination.page} de {pagination.pages}</span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => loadQuestions(pagination.page + 1)} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase disabled:opacity-30">Próxima</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr><th className="p-4">Usuário</th><th className="p-4">Cargo/Plano</th><th className="p-4">Estatísticas</th><th className="p-4 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {allUsers.filter((u: any) => (u.name || '').toLowerCase().includes(filter.toLowerCase()) || (u.email || '').toLowerCase().includes(filter.toLowerCase())).map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{u.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{u.email}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{u.targetExam || 'N/I'}</span>
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit">{u.billing?.plan || 'Gratuito'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Nível {u.level} • {u.xp} XP</div>
                    <div className="w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (u.xp % 1000) / 10)}%` }} />
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setViewingProfileId(u.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all" title="Ver Perfil Completo"><Eye size={16} /></button>
                      <button onClick={() => setEditingUser(u)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all"><Edit3 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'materials' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr><th className="p-4">Material</th><th className="p-4">Autor/Preço</th><th className="p-4">Vendas</th><th className="p-4">Status</th><th className="p-4 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {allMaterials.filter((m: any) => (m.title || '').toLowerCase().includes(filter.toLowerCase())).map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{m.title}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{m.subject}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{m.authorName}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-black text-[10px]">R$ {m.price.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{m.salesCount || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : m.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                      {m.status === 'approved' ? 'Ativo' : m.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditingMaterial(m); setModerationReason(m.rejectionReason || ''); }} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><Edit3 size={14} /> Moderar</button>
                      {m.fileUrl && (
                        <a href={m.fileUrl} download className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"><Download size={14} /></a>
                      )}
                      <button onClick={() => onDeleteMaterial(m.id)} className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4">Alvo</th>
                <th className="p-4">Motivo</th>
                <th className="p-4">Detalhes</th>
                <th className="p-4">Usuário</th>
                <th className="p-4">Prova</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {(allReports as ErrorReport[]).filter(r => r.status === 'pending').map(report => (
                <tr key={report.id} id={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-500">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${report.targetType === 'question' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'}`}>
                      {report.targetType === 'question' ? 'Questão' : 'Material'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{report.reason}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">{report.details}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{report.userName}</td>
                  <td className="p-4">
                    {report.evidenceUrl ? (
                      <a href={report.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                        <ImageIcon size={20} />
                      </a>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEditReportTarget(report)} className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><Edit3 size={14} /> Editar</button>
                      <button onClick={() => resolveReport(report.id, 'resolved')} className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><CheckCircle2 size={14} /> Resolver</button>
                      <button onClick={() => resolveReport(report.id, 'ignored')} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 font-bold text-[9px] uppercase"><XCircle size={14} /> Ignorar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(allReports as ErrorReport[]).filter(r => r.status === 'pending').length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-600 italic">Nenhuma denúncia pendente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'blocked' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-slide-up transition-colors duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10 flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-widest">
            <ShieldAlert size={16} /> Materiais Bloqueados / Rejeitados
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr><th className="p-4">Material</th><th className="p-4">Autor</th><th className="p-4">Motivo do Bloqueio</th><th className="p-4 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {allMaterials.filter((m: any) => m.status === 'rejected').map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{m.title}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{m.authorName}</td>
                  <td className="p-4 text-red-600/80 dark:text-red-400/80 italic max-w-md truncate">{m.rejectionReason || 'Sem motivo registrado'}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => { setEditingMaterial(m); setSelectedReport(null); setModerationReason(m.rejectionReason || '') }} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold uppercase text-[10px] transition-colors">Reanalisar</button>
                  </td>
                </tr>
              ))}
              {allMaterials.filter((m: any) => m.status === 'rejected').length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum material bloqueado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'filters' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
          {/* Categorias de Filtros */}
          <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm h-fit">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Tipos de Filtro</h3>
            <div className="space-y-1">
              {filterTypes.map(type => (
                <button
                  key={type.key}
                  onClick={() => setActiveFilterType(type.key)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${activeFilterType === type.key ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {type.label}
                  <ChevronDown size={14} className={activeFilterType === type.key ? 'rotate-[-90deg]' : 'opacity-0'} />
                </button>
              ))}
            </div>
          </div>

          {/* Gestão de Itens */}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  {editingFilterItem ? `Editando: ${editingFilterItem.originalName}` : `Adicionar ${filterTypes.find(t => t.key === activeFilterType)?.label}`}
                </label>
                <input
                  type="text"
                  value={filterInput}
                  onChange={e => setFilterInput(e.target.value)}
                  placeholder={`Nome do(a) ${activeFilterType}...`}
                  className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              {filterTypes.find(t => t.key === activeFilterType)?.hierarchical && (
                <div className="w-full md:w-64 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Pai (Opcional)</label>
                  <select
                    value={selectedParentId || ''}
                    onChange={e => setSelectedParentId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none"
                  >
                    <option value="">Nenhum (Raiz)</option>
                    {(systemSettings.taxonomies?.[activeFilterType] || []).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleSaveFilter} className="h-11 px-6 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <Save size={16} /> {editingFilterItem ? "Salvar" : "Adicionar"}
                </button>
                {editingFilterItem && (
                  <button onClick={cancelEditingFilter} className="h-11 px-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-xs font-black uppercase hover:bg-slate-200">Cancelar</button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                  <tr><th className="p-4">Nome</th><th className="p-4">Slug</th><th className="p-4 text-center">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {(systemSettings.taxonomies?.[activeFilterType] || [])
                    .filter((item: any) => item.name.toLowerCase().includes(filterSearch.toLowerCase()))
                    .map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                          {item.parent_id && (
                            <div className="text-[10px] text-slate-400 font-medium">Subitem de: {(systemSettings.taxonomies?.[activeFilterType] || []).find((p: any) => p.id === item.parent_id)?.name}</div>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{item.slug}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => startEditingFilter(item)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"><Edit3 size={14} /></button>
                            <button onClick={() => handleDeleteFilter(item.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="space-y-6 animate-slide-up">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors duration-300">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
                  <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-sm tracking-widest">Extração Inteligente</h3>
                </div>

                {/* --- API KEY CONFIGURATION --- */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Zap size={12} className={systemSettings.geminiApiKey?.startsWith('AIza') ? 'text-emerald-500' : 'text-slate-400'} />
                      Gemini API Key
                    </label>
                    {systemSettings.geminiApiKey?.startsWith('AIza') && <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Ativa</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={systemSettings.geminiApiKey || ''}
                      onChange={e => dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: { ...systemSettings, geminiApiKey: e.target.value } })}
                      placeholder="Cole sua API Key aqui (AIza...)"
                      className="flex-1 h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      onClick={() => updateSystemSettings(systemSettings)}
                      className="h-9 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  {!systemSettings.geminiApiKey && (
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium leading-tight">
                      <AlertTriangle size={10} className="inline mr-1" />
                      Necessário configurar uma chave válida para extrair questões.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">Arquivo da Prova <span className="text-red-500 font-black">*</span></label>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${qFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'}`}>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => setQFile(e.target.files?.[0] || null)} />
                      <UploadCloud size={24} className={qFile ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 px-4 text-center line-clamp-1">{qFile ? qFile.name : "Selecionar Prova (PDF)"}</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">Gabarito Oficial <span className="text-red-500 font-black">*</span></label>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${kFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'}`}>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => setKFile(e.target.files?.[0] || null)} />
                      <FileCheck size={24} className={kFile ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 px-4 text-center line-clamp-1">{kFile ? kFile.name : "Selecionar Gabarito (PDF)"}</span>
                    </label>
                  </div>

                  {/* Opção para extrair com comentário */}
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                    <input type="checkbox" checked={extractWithComment} onChange={e => setExtractWithComment(e.target.checked)} className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500" />
                    <label onClick={() => setExtractWithComment(!extractWithComment)} className="text-xs font-bold text-amber-800 dark:text-amber-200 cursor-pointer select-none">Extrair Comentário Resumido (Prof)</label>
                  </div>
                </div>

                {isProcessing ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Progresso da Prova</span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{examProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500" style={{ width: `${examProgress}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Progresso do Gabarito</span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{keyProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500" style={{ width: `${keyProgress}%` }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center animate-pulse italic">Processando...</p>
                  </div>
                ) : (
                  <button
                    onClick={handleImportProcess}
                    disabled={!qFile || !kFile}
                    className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none disabled:opacity-30 flex items-center justify-center gap-3"
                  >
                    <PlayCircle size={20} /> Iniciar Importação
                  </button>
                )}
              </div>

              <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 font-mono text-[10px] text-emerald-400 overflow-y-auto h-48 border border-slate-800 dark:border-slate-800 shadow-inner flex flex-col-reverse transition-colors">
                <div className="space-y-1">
                  {logs.map((log, i) => <div key={i} className="animate-fade-in opacity-80">{log}</div>)}
                  {isProcessing && <div className="animate-pulse">_</div>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col gap-6">
              {extractedQuestions.length > 0 ? (
                <div className="space-y-4 animate-slide-up flex-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 size={16} /> {extractedQuestions.length} Questões Extraídas
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={handleBulkGenerateDetailed}
                        disabled={isBulkGenerating || isProcessing}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black uppercase rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-[10px]"
                      >
                        {isBulkGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Gerar Análise Detalhada (Todas)
                      </button>
                      <button
                        onClick={async () => {
                          const res = await onAddQuestions(extractedQuestions);
                          setExtractedQuestions([]);

                          let msg = "Banco atualizado!";
                          if (res?.newTaxonomies?.length > 0) {
                            msg += "\n\nNovos itens criados: " + res.newTaxonomies.map((t: any) => `${t.type}: ${t.name}`).join(", ");
                          }
                          alert(msg);
                        }}
                        disabled={isProcessing || isBulkGenerating}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 text-white font-black uppercase rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-[10px]"
                      >
                        <CheckCircle2 size={16} /> Publicar Tudo
                      </button>
                    </div>
                  </div>

                  {isBulkGenerating && (
                    <div className="bg-white px-6 py-4 rounded-2xl border border-indigo-100 shadow-sm animate-fade-in">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2"><Sparkles size={12} /> Gerando Comentários em Massa</span>
                        <span className="text-[10px] font-bold text-slate-400">{bulkProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto max-h-[800px] pr-2 space-y-4 no-scrollbar">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-500 dark:group-hover:bg-indigo-600 transition-colors" />
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">{i + 1}</span>
                            <div className="flex flex-wrap gap-2">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.bancas?.map((b: any) => b.sigla || b.name).join(' / ') || 'Banca N/I'}
                              </span>
                              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.assuntos?.filter((a: any) => a.materia).map((a: any) => a.name).join(', ') || 'Matéria N/I'}
                              </span>
                              <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                {q.assuntos?.filter((a: any) => !a.materia).map((a: any) => a.name).join(', ') || 'Assunto N/I'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(q.anulada || (q as any).isCanceled) && <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Anulada</span>}
                            {(q.desatualizada || (q as any).isOutdated) && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Desat.</span>}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-100 dark:border-emerald-900/30">
                              Gabarito: {String.fromCharCode(65 + (q as any).correctOptionIndex)}
                            </div>
                            <button
                              onClick={() => openManualModal(q, i)}
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
                              title="Editar Questão Extraída"
                            >
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Listagem Detalhada de Metadados Extraídos */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Briefcase size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.cargos?.map((c: any) => c.descricao).join(', ') || (q as any).role || 'Cargo Geral'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Calendar size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.anos?.join(', ') || (q as any).year || '2024'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Layers size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.nivel || 'Superior'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <TrendingUp size={12} />
                            <span className="text-[10px] font-bold uppercase">{q.dificuldade === 1 ? 'Fácil' : q.dificuldade === 3 ? 'Difícil' : 'Média'}</span>
                          </div>
                        </div>

                        {q.introText && (
                          <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 border-l-2 border-slate-200 dark:border-slate-700 rounded-r-xl">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">Texto de Apoio</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed line-clamp-2">{q.introText}</p>
                          </div>
                        )}

                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-4 line-clamp-3 group-hover:line-clamp-none transition-all">{q.enunciado}</h4>

                        {/* BOTÕES DE GERAÇÃO PÓS-EXTRAÇÃO */}
                        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                          <button
                            onClick={() => handleGenerateSpecific(i, 'teacher')}
                            disabled={!!generatingSpecific || isBulkGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all disabled:opacity-50"
                          >
                            {generatingSpecific?.index === i && generatingSpecific.type === 'teacher' ? <Loader2 className="animate-spin" size={12} /> : <GraduationCap size={12} />}
                            {q.teacherComment ? 'Regerar Professor' : 'Gerar Professor'}
                          </button>
                          <button
                            onClick={() => handleGenerateSpecific(i, 'detailed')}
                            disabled={!!generatingSpecific || isBulkGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all disabled:opacity-50"
                          >
                            {generatingSpecific?.index === i && generatingSpecific.type === 'detailed' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                            {q.detailedComment ? 'Regerar Detalhado' : 'Gerar Detalhado'}
                          </button>
                        </div>

                        {q.teacherComment && (
                          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-200 space-y-2 animate-fade-in opacity-80 group-hover:opacity-100">
                            <p className="font-black uppercase tracking-widest text-[9px] flex items-center gap-2"><BookOpen size={14} /> Comentário do Professor</p>
                            <p className="font-medium leading-relaxed italic">{q.teacherComment}</p>
                          </div>
                        )}

                        {q.detailedComment && (
                          <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-800 dark:text-indigo-200 space-y-2 animate-fade-in opacity-80 group-hover:opacity-100">
                            <p className="font-black uppercase tracking-widest text-[9px] flex items-center gap-2"><Sparkles size={14} /> Análise Detalhada (IA)</p>
                            <p className="font-medium leading-relaxed italic line-clamp-3">{q.detailedComment}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-20 text-center space-y-4 flex-1 transition-colors">
                  <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300 dark:text-slate-700"><FileText size={80} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Aguardando Arquivos</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto font-medium">Faça o upload da Prova e do Gabarito para iniciar a extração em massa com IA.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ... (Modal de adicionar/editar questão e editar usuário mantidos) ... */}
      {showAddManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-50 rounded-[2.5rem] w-full max-w-4xl p-1 shadow-2xl animate-scale-in max-h-[95vh] overflow-hidden flex flex-col">
            <div className="bg-white rounded-t-[2.4rem] p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingExtractedIndex !== null ? `Revisar Questão Extraída #${editingExtractedIndex + 1}` : editingQuestion ? 'Editar Questão' : 'Adicionar Nova Questão'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">Gerencie o conteúdo e os filtros inteligentes para garantir a qualidade.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 mr-6">
                  <button onClick={() => setManualQ({ ...manualQ, anulada: !manualQ.anulada })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${manualQ.anulada ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-red-400'}`}>
                    {manualQ.anulada ? 'Questão Anulada' : 'Anular Questão'}
                  </button>
                  <button onClick={() => setManualQ({ ...manualQ, desatualizada: !manualQ.desatualizada })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${manualQ.desatualizada ? 'bg-amber-600 border-amber-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-amber-400'}`}>
                    {manualQ.desatualizada ? 'Desatualizada' : 'Marcar Desatualizada'}
                  </button>
                </div>
                <button onClick={() => { setShowAddManual(false); setEditingExtractedIndex(null); }} className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"><X size={24} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              {/* Alertas de Status */}
              {(manualQ.anulada || manualQ.desatualizada) && (
                <div className="flex flex-col gap-2">
                  {manualQ.anulada && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-3"><AlertCircle size={18} /> Esta questão será exibida como ANULADA para os alunos.</div>}
                  {manualQ.desatualizada && <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold flex items-center gap-3"><AlertTriangle size={18} /> Esta questão será exibida como DESATUALIZADA.</div>}
                </div>
              )}

              {/* Seletores de Metadados (Filtros) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <SmartTagSelector
                  label="Banca(s)"
                  options={existingAgencies}
                  selected={manualQ.bancas.map((b: any) => typeof b === 'string' ? b : b.sigla)}
                  onChange={v => setManualQ({ ...manualQ, bancas: v })}
                  placeholder="Ex: Cebraspe, FGV..."
                />
                <SmartTagSelector
                  label="Órgão(s)"
                  options={existingOrgaos}
                  selected={manualQ.orgaos.map((o: any) => typeof o === 'string' ? o : o.nome)}
                  onChange={v => setManualQ({ ...manualQ, orgaos: v })}
                  placeholder="Ex: TJ-SP, PF, Receita Federal..."
                />
                <SmartTagSelector
                  label="Matéria(s)"
                  options={existingSubjects}
                  selected={manualQ.subjects.map((s: any) => typeof s === 'string' ? s : s.nome)}
                  onChange={v => setManualQ({ ...manualQ, subjects: v })}
                  placeholder="Ex: Direito Administrativo..."
                />
                <SmartTagSelector
                  label="Assunto(s) / Tópicos"
                  options={existingTopics}
                  selected={manualQ.assuntos.map((a: any) => typeof a === 'string' ? a : a.nome)}
                  onChange={v => setManualQ({ ...manualQ, assuntos: v })}
                  placeholder="Ex: Crase, Atos..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <SmartTagSelector
                    label="Ano"
                    options={existingYears}
                    selected={manualQ.anos.map(String)}
                    onChange={v => setManualQ({ ...manualQ, anos: v })}
                    placeholder="2024"
                    multiple={true}
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Dificuldade</label>
                    <select value={manualQ.difficulty} onChange={e => setManualQ({ ...manualQ, difficulty: Number(e.target.value) })} className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value={1}>Fácil</option>
                      <option value={2}>Médio</option>
                      <option value={3}>Difícil</option>
                    </select>
                  </div>
                </div>
                <SmartTagSelector
                  label="Cargo(s)"
                  options={existingRoles}
                  selected={manualQ.cargos.map((c: any) => typeof c === 'string' ? c : c.descricao)}
                  onChange={v => setManualQ({ ...manualQ, cargos: v })}
                  placeholder="Ex: Analista Judiciário..."
                />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Escolaridade (Nível)</label>
                  <select value={manualQ.level} onChange={e => setManualQ({ ...manualQ, level: e.target.value })} className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20">
                    <option value="Superior">Superior</option>
                    <option value="Médio">Médio</option>
                    <option value="Fundamental">Fundamental</option>
                  </select>
                </div>
              </div>

              {/* Conteúdo da Questão */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Texto de Apoio (Opcional)</label>
                  <textarea value={manualQ.introText} onChange={e => setManualQ({ ...manualQ, introText: e.target.value })} className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 font-medium min-h-[100px] outline-none focus:border-indigo-500 transition-colors" placeholder="Insira textos auxiliares aqui..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Enunciado Principal (HTML)</label>
                  <textarea required value={manualQ.enunciado} onChange={e => setManualQ({ ...manualQ, enunciado: e.target.value, enunciado_clean: e.target.value.replace(/<[^>]*>?/gm, '') })} className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-base text-slate-900 dark:text-slate-100 font-bold min-h-[140px] outline-none focus:border-indigo-500 transition-colors" placeholder="Qual o comando da questão? Aceita HTML." />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-indigo-500 transition-all shadow-sm">
                    <ImageIcon size={18} className="text-indigo-500" /> Upload de Imagem
                    <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setManualQ({ ...manualQ, imageUrl: URL.createObjectURL(f) }); }} />
                  </label>
                  {manualQ.imageUrl && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 animate-fade-in">
                      <CheckCircle2 size={16} />
                      <span className="text-[10px] font-black uppercase">Imagem Anexada</span>
                      <button onClick={() => setManualQ({ ...manualQ, imageUrl: '' })} className="hover:text-red-500 ml-2"><X size={14} /></button>
                    </div>
                  )}
                </div>

                <div className="space-y-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Alternativas</label>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Marque a correta</span>
                  </div>
                  {manualQ.itens?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <label className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 ${manualQ.resposta === item.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-300'}`}>
                        <input type="radio" name="manualCorrect" checked={manualQ.resposta === item.id} onChange={() => setManualQ({ ...manualQ, resposta: item.id })} className="hidden" />
                        <span className="text-sm font-black">{item.rotulo || String.fromCharCode(65 + i)}</span>
                      </label>
                      <input
                        type="text"
                        value={item.corpo}
                        onChange={e => {
                          const newItens = [...manualQ.itens!];
                          newItens[i] = { ...newItens[i], corpo: e.target.value, corpo_clean: e.target.value.replace(/<[^>]*>?/gm, '') };
                          setManualQ({ ...manualQ, itens: newItens });
                        }}
                        className="flex-1 h-12 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                        placeholder={`Texto da Alternativa ${item.rotulo || String.fromCharCode(65 + i)}`}
                      />
                      <label className="w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-all">
                        <ImageIcon size={18} />
                        <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const newItens = [...manualQ.itens!]; newItens[i] = { ...newItens[i], corpo: URL.createObjectURL(f) }; setManualQ({ ...manualQ, itens: newItens }); } }} />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><BookOpen size={14} className="text-amber-500" /> Comentário do Professor (Resumo)</label>
                  <textarea value={manualQ.teacherComment} onChange={e => setManualQ({ ...manualQ, teacherComment: e.target.value })} className="w-full p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-3xl text-sm text-slate-800 dark:text-slate-200 font-medium min-h-[120px] outline-none focus:border-amber-400" placeholder="Explique didaticamente a resposta..." />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Sparkles size={14} className="text-indigo-500" /> Análise Detalhada (Elite)</label>
                    <button
                      type="button"
                      onClick={handleGenerateManualDetail}
                      disabled={isGeneratingDetailed || !manualQ.enunciado || manualQ.itens.filter((it: any) => it.corpo).length < 2 || manualQ.resposta === undefined}
                      className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingDetailed ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Gerar com IA
                    </button>
                  </div>
                  <textarea value={manualQ.detailedComment} onChange={e => setManualQ({ ...manualQ, detailedComment: e.target.value })} className="w-full p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl text-sm text-slate-800 dark:text-slate-200 font-medium min-h-[150px] outline-none focus:border-indigo-300" placeholder="Análise alternativa por alternativa (Markdown)..." />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 rounded-b-[2.4rem] transition-colors duration-300">
              <button onClick={() => { setShowAddManual(false); setEditingExtractedIndex(null); }} className="px-8 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Descartar</button>
              <button onClick={handleSaveManual} className="px-10 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2"><Save size={18} /> {editingExtractedIndex !== null ? 'Atualizar Revision' : 'Salvar Questão'}</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={(e) => { e.preventDefault(); updateUserStatus(editingUser.id, editingUser); setEditingUser(null); }} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-scale-in transition-colors duration-300">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-6 font-display">Editar Usuário</h3>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nome</label><input required type="text" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">E-mail</label><input required type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Plano</label><select value={editingUser.billing?.plan} onChange={e => setEditingUser({ ...editingUser, billing: { ...editingUser.billing!, plan: e.target.value as any } })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="Gratuito">Gratuito</option><option value="Essencial">Essencial</option><option value="Pro">Pro</option><option value="Elite">Elite</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nível</label><input type="number" value={editingUser.level} onChange={e => setEditingUser({ ...editingUser, level: Number(e.target.value) })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase hover:text-red-500 transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all">Salvar Alterações</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL MODERAÇÃO DE MATERIAL */}
      {/* MODAL MODERAÇÃO DE MATERIAL */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-scale-in space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar transition-colors duration-300">
            <header className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md mb-2 block w-fit">Moderação</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{editingMaterial.title}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Por: {editingMaterial.authorName}</p>
                  <button onClick={() => setViewingProfileId(editingMaterial.authorId)} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-all"><Eye size={10} /> Perfil Admin</button>
                </div>
              </div>
              <button onClick={() => setEditingMaterial(null)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle size={20} className="text-slate-400 dark:text-slate-500" /></button>
            </header>

            {/* Informações da Denúncia */}
            {selectedReport && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} /> Denúncia: {selectedReport.reason}
                </div>
                <p className="text-xs text-red-600/80 leading-relaxed italic">"{selectedReport.details}"</p>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-red-100/50 text-[10px] text-red-500 font-bold">
                  <div className="flex items-center gap-2">
                    <span>Reportado por: {selectedReport.userName}</span>
                    <button onClick={() => selectedReport.userId && setViewingProfileId(selectedReport.userId)} className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase hover:bg-red-200"><Eye size={8} /> Ver Perfil</button>
                  </div>
                  <span>•</span>
                  <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                </div>
                {selectedReport.evidenceUrl && (
                  <div className="mt-2 pt-2 border-t border-red-100/50">
                    <p className="text-[9px] font-black uppercase text-red-400 mb-1 flex items-center gap-1"><ImageIcon size={10} /> Prova do Usuário:</p>
                    <img src={selectedReport.evidenceUrl} alt="Prova do Usuário" className="rounded-xl border border-red-200 max-h-32 object-contain bg-white" />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Preço: R$ {editingMaterial.price.toFixed(2)}</span>
                  <span className="uppercase">{editingMaterial.type}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>Vendas: {editingMaterial.salesCount}</span>
                  <span>Rating: {editingMaterial.rating.toFixed(1)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{editingMaterial.description}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Mensagem ao Autor</label>
                  <textarea
                    value={moderationReason}
                    onChange={e => setModerationReason(e.target.value)}
                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none min-h-[100px] transition-all focus:border-indigo-500"
                    placeholder="Justificativa da decisão (Opcional - Valor padrão será aplicado se vazio)..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem de Prova / Evidência (Opcional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 hover:border-indigo-500 transition-all shadow-sm">
                      <ImageIcon size={18} className="text-indigo-500" /> Anexar Prova
                      <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setModerationEvidence(URL.createObjectURL(f)); }} />
                    </label>
                    {moderationEvidence && (
                      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 animate-fade-in">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-black uppercase">Prova Anexada</span>
                        <button onClick={() => setModerationEvidence(null)} className="hover:text-red-500 ml-2"><X size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const finalReason = moderationReason.trim() || "Conteúdo revisado e considerado adequado para a plataforma.";
                    moderateMaterial(editingMaterial.id, 'approved', finalReason, moderationEvidence || undefined);
                    if (selectedReport) resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
                    setEditingMaterial(null);
                    setModerationEvidence(null);
                  }}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all flex-1"
                >
                  Validar (Manter)
                </button>
                <button
                  onClick={() => {
                    const finalReason = moderationReason.trim() || "O conteúdo foi ocultado temporariamente por não atender às diretrizes da comunidade ou estar em revisão.";
                    if (!confirm('Ocultar este material da loja?')) return;
                    moderateMaterial(editingMaterial.id, 'rejected', finalReason, moderationEvidence || undefined);
                    if (selectedReport) resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
                    setEditingMaterial(null);
                    setModerationEvidence(null);
                  }}
                  className="px-6 py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all flex-1"
                >
                  Ocultar (Sem Punição)
                </button>
              </div>

              <button
                onClick={() => {
                  const blockReason = moderationReason.trim() || "Violação recorrente ou grave das diretrizes da plataforma.";
                  const blockMessage = `[CONTEÚDO BLOQUEADO] Seu material foi suspenso. Motivo: "${blockReason}". CASO DISCORDE, VOCÊ TEM 5 DIAS ÚTEIS PARA CONTESTAR. Envie sua justificativa para suporte@concursomestre.com informando o ID #${editingMaterial.id}.`;

                  if (confirm("Bloquear material permanentemente e solicitar contestação?")) {
                    moderateMaterial(editingMaterial.id, 'rejected', blockMessage, moderationEvidence || undefined);
                    if (selectedReport) resolveReport(selectedReport.id, 'resolved', blockReason, moderationEvidence || undefined);
                    setEditingMaterial(null);
                    setModerationEvidence(null);
                  }
                }}
                className="w-full py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase hover:bg-red-600 shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert size={16} /> Bloquear e Solicitar Contestação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERFIL ADMIN (VIEW) */}
      {
        viewingProfileId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] w-full max-w-5xl p-1 shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col transition-colors duration-300">
              <div className="bg-white dark:bg-slate-900 rounded-t-[2.4rem] p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">
                      {allUsers.find((u: any) => u.id === viewingProfileId)?.name || 'Usuário'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{allUsers.find((u: any) => u.id === viewingProfileId)?.email}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${allUsers.find((u: any) => u.id === viewingProfileId)?.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                        {allUsers.find((u: any) => u.id === viewingProfileId)?.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Reputação</p>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${(allUsers.find((u: any) => u.id === viewingProfileId)?.reputation ?? 0) > 70 ? 'bg-emerald-500' : (allUsers.find((u: any) => u.id === viewingProfileId)?.reputation ?? 0) > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${allUsers.find((u: any) => u.id === viewingProfileId)?.reputation ?? 0}%` }} />
                      </div>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{allUsers.find((u: any) => u.id === viewingProfileId)?.reputation ?? 0}%</span>
                    </div>
                  </div>
                  <button onClick={() => setViewingProfileId(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-2xl transition-all"><X size={24} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar bg-slate-50 dark:bg-slate-900">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Coluna 1: Dados da Conta */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3 font-display"><Settings size={14} /> Dados da Conta</h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Plano Atual</p>
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{allUsers.find((u: any) => u.id === viewingProfileId)?.billing.plan}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">CPF</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{allUsers.find((u: any) => u.id === viewingProfileId)?.cpf || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Concurso Alvo</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{allUsers.find((u: any) => u.id === viewingProfileId)?.targetExam || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Estatísticas de Estudo</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Level {allUsers.find((u: any) => u.id === viewingProfileId)?.level} • {allUsers.find((u: any) => u.id === viewingProfileId)?.xp} XP</p>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 2: Histórico de Vendas/Compras */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3 font-display"><ShoppingBag size={14} /> Transações</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {allTransactions.filter((t: any) => t.buyerId === viewingProfileId || t.sellerId === viewingProfileId).map((t: any) => (
                        <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{t.buyerId === viewingProfileId ? 'Compra' : 'Venda'}</span>
                            <span className={`text-[10px] font-bold ${t.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{t.status}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.materialTitle}</p>
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">R$ {t.amount.toFixed(2)}</p>
                        </div>
                      ))}
                      {allTransactions.filter((t: any) => t.buyerId === viewingProfileId || t.sellerId === viewingProfileId).length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma transação encontrada.</p>
                      )}
                    </div>
                  </div>

                  {/* Coluna 3: Histórico de Denúncias (REPUTAÇÃO) */}
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3 font-display"><AlertTriangle size={14} /> Histórico de Denúncias</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {allReports.filter((r: any) => r.userId === viewingProfileId || (r.targetType === 'material' && allMaterials.find((m: any) => m.id === r.materialId)?.authorId === viewingProfileId)).map((r: any) => (
                        <div key={r.id} className={`p-3 rounded-xl border ${r.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{r.userId === viewingProfileId ? 'Como Denunciante' : 'Como Alvo'}</span>
                            <span className={`text-[10px] font-bold ${r.status === 'resolved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{r.status}</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{r.reason}</p>
                          <p className="text-[10px] text-slate-500 italic mt-1 truncate">"{r.details}"</p>
                        </div>
                      ))}
                      {allReports.filter((r: any) => r.userId === viewingProfileId || (r.targetType === 'material' && allMaterials.find((m: any) => m.id === r.materialId)?.authorId === viewingProfileId)).length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma denúncia no histórico.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comentários Recentes do Usuário */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 pb-3 font-display"><MessageSquare size={14} /> Comentários Recentes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-xs text-slate-400 italic">Visualização de comentários em desenvolvimento (integração de busca global necessária).</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 transition-colors duration-300">
                <button onClick={() => setViewingProfileId(null)} className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all">Fechar Perfil</button>
              </div>
            </div>
          </div>
        )
      }


    </div>
  );
};

const Admin: React.FC = () => {
  const {
    questions, users, systemSettings, reports,
    addQuestion, addQuestions, updateQuestion, deleteQuestion, resolveReport,
    updateUserStatus, updateSystemSettings, addCoupon, deleteCoupon
  } = useData();

  const { materials, transactions, moderateMaterial, deleteMaterial } = useMarketplace();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'database' | 'finance' | 'marketing' | 'settings'>('dashboard');

  useEffect(() => {
    const section = searchParams.get('section');
    if (section && ['dashboard', 'database', 'finance', 'marketing', 'settings'].includes(section)) {
      setActiveTab(section as any);
    }
  }, [searchParams]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><Shield className="text-rose-600" /> Painel Administrativo</h1>
          <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest border border-rose-200 dark:border-rose-800">Admin</span>
        </div>
        <p className="text-slate-500 text-sm font-medium">Gestão completa da plataforma.</p>
      </header>

      {/* Main Tabs */}
      <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar transition-colors duration-300">
        <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><LayoutDashboard size={14} /> Dashboard</button>
        <button onClick={() => setActiveTab('database')} className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'database' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Database size={14} /> Base de Dados</button>
        <button onClick={() => setActiveTab('finance')} className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'finance' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><DollarSign size={14} /> Financeiro</button>
        <button onClick={() => setActiveTab('marketing')} className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'marketing' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Megaphone size={14} /> Marketing</button>
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Settings size={14} /> Configurações</button>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'dashboard' && <AdminDashboard questions={questions} allMaterials={materials} allTransactions={transactions} allUsers={users} />}
        {activeTab === 'database' && (
          <AdminDatabaseManager
            questions={questions} allUsers={users} allMaterials={materials} allReports={reports} allTransactions={transactions}
            onDeleteQuestion={deleteQuestion} onAddQuestion={addQuestion} onAddQuestions={addQuestions} onUpdateQuestion={updateQuestion}
            resolveReport={resolveReport} updateUserStatus={updateUserStatus} moderateMaterial={moderateMaterial}
            onDeleteMaterial={deleteMaterial} systemSettings={systemSettings}
          />
        )}
        {activeTab === 'finance' && (
          <AdminFinance
            allTransactions={transactions}
            allUsers={users}
            systemSettings={systemSettings}
            updateSystemSettings={updateSystemSettings}
          />
        )}
        {activeTab === 'marketing' && (
          <AdminMarketing
            systemSettings={systemSettings}
            updateSystemSettings={updateSystemSettings}
            addCoupon={addCoupon}
            deleteCoupon={deleteCoupon}
          />
        )}
        {activeTab === 'settings' && (
          <AdminSettings
            systemSettings={systemSettings}
            updateSystemSettings={updateSystemSettings}
          />
        )}
      </div>
    </div>
  );
};

export default Admin;
