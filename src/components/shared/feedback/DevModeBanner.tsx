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

import React, { useState } from 'react';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Zap,
  Mail,
  Database,
  Globe,
  X,
} from 'lucide-react';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

/**
 * DevModeBanner
 * Exibido globalmente quando appMode === 'development'.
 * Mostra o modo atual e informacoes de debug uteis para desenvolvimento.
 * Totalmente oculto em producao.
 */
const DevModeBanner: React.FC = () => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Oculta em producao ou se dispensado
  if (systemSettings?.appMode === 'production' || dismissed) return null;

  const smtpConfigured = !!(systemSettings?.smtpHost && systemSettings?.smtpUser);
  const apiKeySet = !!(
    systemSettings?.hasGeminiApiKeyConfigured
    || systemSettings?.geminiApiKey
    || systemSettings?.hasOpenAiApiKeyConfigured
    || systemSettings?.openaiApiKey
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-screen-2xl px-4 pb-4">
        <div className="overflow-hidden rounded-2xl border border-amber-400 bg-amber-500 text-amber-950 shadow-2xl dark:bg-amber-600">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Terminal size={16} className="flex-shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest">Modo Desenvolvimento</span>
              <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
                <span className="rounded-full bg-amber-400/60 px-2 py-0.5 font-mono text-[10px]">
                  e-mails: apenas log
                </span>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${smtpConfigured ? 'bg-emerald-200/60' : 'bg-red-200/60'}`}>
                  SMTP: {smtpConfigured ? 'configurado' : 'nao configurado'}
                </span>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${apiKeySet ? 'bg-emerald-200/60' : 'bg-red-200/60'}`}>
                  IA: {apiKeySet ? 'ativa' : 'sem chave'}
                </span>
              </span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => setExpanded((current) => !current)}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                {expanded ? 'Recolher' : 'Detalhes'}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="p-1 transition-opacity hover:opacity-70"
                title="Dispensar (sessao atual)"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {expanded && (
            <div className="border-t border-amber-400 bg-amber-400/30 px-4 py-3">
              <div className="grid grid-cols-2 gap-3 font-mono text-[11px] md:grid-cols-4">
                <div className="flex items-center gap-1.5">
                  <Globe size={12} />
                  <span>APP_ENV: <strong>development</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={12} />
                  <span>SMTP: {smtpConfigured ? systemSettings?.smtpHost : '?'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Database size={12} />
                  <span>PIX: {systemSettings?.pixKey ? 'configurado' : '?'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={12} />
                  <span>IA: {apiKeySet ? 'ok' : 'sem chave'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevModeBanner;
