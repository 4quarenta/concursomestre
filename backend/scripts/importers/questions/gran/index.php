<?php
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gran Questões Scraper - Revisão - ConcursoMestre</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .question-card.selected { border-color: #4f46e5; background-color: #f8fafc; }
        .question-card.exists { opacity: 0.6; border-color: #e2e8f0; background-color: #f1f5f9; }
        .alt-correct { background-color: #ecfdf5; border-color: #10b981; color: #065f46; }
    </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
    <div class="max-w-6xl mx-auto py-12 px-6">
        <header class="mb-10 flex justify-between items-end">
            <div>
                <h1 class="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Gran Scraper: Revisão</h1>
                <p class="text-slate-500 font-medium">Selecione as questões que deseja importar para sua plataforma</p>
            </div>
            <a href="../../../../" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest bg-white px-4 py-2 rounded-lg shadow-sm">Voltar ao Painel</a>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <!-- Sidebar: Configurações -->
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto custom-scrollbar">
                    <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Configuração da API</h3>
                    
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-500">Bearer Token</label>
                            <textarea id="token" rows="4" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-[10px]" placeholder="Token JWT..."></textarea>
                            <div id="tokenStatus" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500">
                                Cole um bearer valido da Gran para liberar a busca.
                            </div>
                        </div>

                        <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                            <div class="space-y-1">
                                <p class="text-[10px] font-black uppercase tracking-widest text-amber-700">Captura assistida do bearer</p>
                                <p class="text-[10px] font-medium leading-5 text-amber-900">
                                    Faça o login manual na Gran, resolva o reCAPTCHA e use o script abaixo para capturar o bearer já autenticado.
                                </p>
                            </div>

                            <div class="grid grid-cols-2 gap-2">
                                <a href="https://www.grancursosonline.com.br/identificacao" target="_blank" rel="noreferrer" class="flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 transition hover:bg-amber-100">
                                    Abrir Login
                                </a>
                                <a href="https://questoes.grancursosonline.com.br/" target="_blank" rel="noreferrer" class="flex items-center justify-center rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 transition hover:bg-amber-100">
                                    Abrir Questões
                                </a>
                            </div>

                            <div class="grid grid-cols-1 gap-2">
                                <button id="copyCaptureScriptBtn" type="button" class="w-full rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-amber-700">
                                    Copiar Script de Captura
                                </button>
                                <button id="pasteCaptureTokenBtn" type="button" class="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 transition hover:bg-amber-100">
                                    Colar Bearer da Área de Transferência
                                </button>
                            </div>

                            <details class="rounded-xl border border-amber-100 bg-white/80 p-3">
                                <summary class="cursor-pointer text-[10px] font-black uppercase tracking-widest text-amber-700">
                                    Como usar
                                </summary>
                                <ol class="mt-3 space-y-1 text-[10px] font-medium leading-5 text-amber-900">
                                    <li>1. Abra o login da Gran e resolva o reCAPTCHA.</li>
                                    <li>2. Entre na página de questões da Gran.</li>
                                    <li>3. Clique em <strong>Copiar Script de Captura</strong>.</li>
                                    <li>4. Cole o script no console do navegador da página da Gran e execute.</li>
                                    <li>5. Volte aqui e clique em <strong>Colar Bearer da Área de Transferência</strong>.</li>
                                </ol>
                            </details>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-500">Página</label>
                                <input type="number" id="page" value="1" min="1" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-500">Por Página</label>
                                <input type="number" id="perPage" value="20" min="1" max="50" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs">
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-500">Ano (Opcional)</label>
                            <input type="number" id="anoFilter" placeholder="Ex: 2024" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-500">URL Direta (Opcional)</label>
                            <textarea id="directUrl" rows="2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[9px]" placeholder="Link da API da Gran..."></textarea>
                        </div>

                        <button id="fetchBtn" class="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100 uppercase tracking-widest text-[10px]">
                            Carregar Questões
                        </button>

                        <div id="requestMessage" class="hidden rounded-xl border px-3 py-3 text-[10px] font-bold leading-5"></div>

                        <div class="pt-4 border-t border-slate-100 space-y-3">
                            <label class="flex items-center gap-3 cursor-pointer group">
                                <div class="relative w-10 h-5 bg-slate-200 rounded-full transition-colors group-hover:bg-slate-300 peer-checked:bg-indigo-600">
                                    <input type="checkbox" id="autoMode" class="sr-only peer">
                                    <div class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                                </div>
                                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600">Modo Automático</span>
                            </label>

                            <button id="stopBtn" class="hidden w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all uppercase tracking-widest text-[10px] border border-rose-100">
                                Parar Automação
                            </button>
                        </div>
                    </div>

                    <!-- Fetch Status -->
                    <div id="fetchStatusArea" class="hidden mt-6 pt-6 border-t border-slate-100 italic space-y-2">
                         <div class="flex justify-between items-center">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HTTP Status</span>
                            <span id="httpStatusBadge" class="px-2 py-0.5 rounded text-[10px] font-black font-mono">---</span>
                         </div>
                    </div>

                    <!-- Raw JSON Response -->
                    <div id="rawJsonArea" class="hidden mt-6 pt-6 border-t border-slate-100 space-y-2">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Raw JSON Response</label>
                        <textarea id="rawJsonResponse" readonly rows="8" class="w-full px-3 py-2 bg-slate-900 text-emerald-400 border border-slate-700 rounded-xl outline-none font-mono text-[9px] custom-scrollbar" placeholder="JSON aparecerá aqui..."></textarea>
                    </div>

                    <div id="statsArea" class="hidden mt-6 pt-6 border-t border-slate-100 space-y-4">
                        <div class="flex justify-between items-end">
                            <span class="text-[10px] font-bold text-slate-400 uppercase">Resumo da Sessão</span>
                            <span id="sessionStatus" class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase">Ativa</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span class="block text-[8px] font-black text-slate-400 uppercase">Importadas</span>
                                <span id="countImported" class="text-sm font-black text-emerald-600">0</span>
                            </div>
                            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span class="block text-[8px] font-black text-slate-400 uppercase">Puladas</span>
                                <span id="countSkipped" class="text-sm font-black text-slate-400">0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main: Lista de Questões -->
            <div class="lg:col-span-3 space-y-6">
                <div id="welcomeMessage" class="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-20 text-center">
                    <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800 mb-2">Pronto para importar?</h3>
                    <p class="text-slate-500 mb-6">Insira seu token ao lado e clique em carregar para começar a revisão.</p>
                </div>

                <div id="availableInfo" class="hidden bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center mb-6">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        </div>
                        <div>
                            <span class="block text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Disponibilidade na Gran</span>
                            <span id="availStats" class="text-xs font-bold text-indigo-700">Carregando estatísticas...</span>
                        </div>
                    </div>
                </div>

                <div id="questionListHeader" class="hidden flex justify-between items-center mb-4 px-2">
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" id="selectAll" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                            <span class="text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Selecionar Tudo</span>
                        </label>
                        <span id="selectionCount" class="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">0 Selecionadas</span>
                    </div>
                    <button id="importBtn" disabled class="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest text-[10px]">
                        Importar Selecionadas
                    </button>
                </div>

                <div id="questionContainer" class="space-y-6">
                    <!-- Questões serão injetadas aqui -->
                </div>

                <div id="paginationFooter" class="hidden flex justify-center py-10">
                    <button id="nextPageBtn" class="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                        Próxima Página <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal de Sucesso -->
    <div id="successModal" class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl animate-scale-in">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <h3 class="text-xl font-bold text-slate-900 mb-2">Sucesso!</h3>
            <p id="successMessage" class="text-slate-500 text-sm mb-6">Questões importadas com sucesso.</p>
            <button onclick="document.getElementById('successModal').classList.add('hidden')" class="w-full py-3 bg-slate-900 text-white font-bold rounded-xl uppercase tracking-widest text-[10px]">Fechar</button>
        </div>
    </div>

    <script>
        const tokenInput = document.getElementById('token');
        const pageInput = document.getElementById('page');
        const perPageInput = document.getElementById('perPage');
        const anoFilterInput = document.getElementById('anoFilter');
        const directUrlInput = document.getElementById('directUrl');
        const fetchBtn = document.getElementById('fetchBtn');
        const importBtn = document.getElementById('importBtn');
        const questionContainer = document.getElementById('questionContainer');
        const welcomeMessage = document.getElementById('welcomeMessage');
        const availableInfo = document.getElementById('availableInfo');
        const availStats = document.getElementById('availStats');
        const header = document.getElementById('questionListHeader');
        const footer = document.getElementById('paginationFooter');
        const selectAll = document.getElementById('selectAll');
        const selectionCountLabel = document.getElementById('selectionCount');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        const countImported = document.getElementById('countImported');
        const countSkipped = document.getElementById('countSkipped');
        const statsArea = document.getElementById('statsArea');
        const httpStatusBadge = document.getElementById('httpStatusBadge');
        const fetchStatusArea = document.getElementById('fetchStatusArea');
        const rawJsonArea = document.getElementById('rawJsonArea');
        const rawJsonResponse = document.getElementById('rawJsonResponse');
        const autoMode = document.getElementById('autoMode');
        const stopBtn = document.getElementById('stopBtn');
        const tokenStatus = document.getElementById('tokenStatus');
        const requestMessage = document.getElementById('requestMessage');
        const copyCaptureScriptBtn = document.getElementById('copyCaptureScriptBtn');
        const pasteCaptureTokenBtn = document.getElementById('pasteCaptureTokenBtn');

        const GRAN_STORAGE_KEY = 'concursomestre.gran.scraper';
        const GRAN_ASSET_BASE_URL = 'https://arquivos.infra-questoes.grancursosonline.com.br';

        let currentQuestions = [];
        let sessionStats = { imported: 0, skipped: 0 };
        let isAutoRunning = false;

        function decodeJwtPayload(token) {
            try {
                const [, payload] = String(token || '').split('.');
                if (!payload) return null;
                const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
                return JSON.parse(atob(padded));
            } catch {
                return null;
            }
        }

        function getTokenExpirationDate(token) {
            const payload = decodeJwtPayload(token);
            if (!payload || !payload.exp) return null;
            return new Date(payload.exp * 1000);
        }

        function isTokenExpired(token) {
            const expirationDate = getTokenExpirationDate(token);
            if (!expirationDate) return false;
            return expirationDate.getTime() <= Date.now();
        }

        function setRequestMessage(message, tone = 'info') {
            if (!message) {
                requestMessage.className = 'hidden rounded-xl border px-3 py-3 text-[10px] font-bold leading-5';
                requestMessage.textContent = '';
                return;
            }

            const tones = {
                info: 'border-slate-200 bg-slate-50 text-slate-600',
                success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                warning: 'border-amber-200 bg-amber-50 text-amber-700',
                error: 'border-rose-200 bg-rose-50 text-rose-700',
            };

            requestMessage.className = `rounded-xl border px-3 py-3 text-[10px] font-bold leading-5 ${tones[tone] || tones.info}`;
            requestMessage.textContent = message;
        }

        function extractJwtCandidatesFromText(text) {
            const normalizedText = String(text || '');
            const candidates = [];
            const regex = /(?:Bearer\s+)?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
            let match;

            while ((match = regex.exec(normalizedText)) !== null) {
                if (match[1]) {
                    candidates.push(match[1]);
                }
            }

            return candidates;
        }

        function normalizePotentialToken(value) {
            const rawValue = String(value || '').trim();
            if (!rawValue) return '';

            const directMatch = rawValue.match(/^(?:Bearer\s+)?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
            if (directMatch) {
                return directMatch[1];
            }

            const candidates = extractJwtCandidatesFromText(rawValue);
            return candidates[0] || '';
        }

        function applyCapturedToken(token, sourceLabel = 'captura assistida') {
            const normalizedToken = normalizePotentialToken(token);
            if (!normalizedToken) {
                setRequestMessage('Nenhum bearer válido foi encontrado no conteúdo informado.', 'error');
                return false;
            }

            tokenInput.value = normalizedToken;
            persistScraperState();
            updateTokenStatus();

            const expirationDate = getTokenExpirationDate(normalizedToken);
            const expirationLabel = expirationDate
                ? ` Expira em ${expirationDate.toLocaleString('pt-BR')}.`
                : '';

            setRequestMessage(`Bearer aplicado via ${sourceLabel}.${expirationLabel}`, 'success');
            return true;
        }

        function getGranBearerCaptureScript() {
            return `(async()=>{\n  const JWT_REGEX=/(?:Bearer\\\\s+)?(eyJ[A-Za-z0-9_-]+\\\\.[A-Za-z0-9_-]+\\\\.[A-Za-z0-9_-]+)/g;\n  const seen=new Set();\n  const candidates=[];\n  const now=Math.floor(Date.now()/1000);\n  const decodePayload=(token)=>{\n    try{\n      const parts=String(token||'').split('.');\n      if(parts.length<2)return null;\n      const normalized=parts[1].replace(/-/g,'+').replace(/_/g,'/');\n      const padded=normalized.padEnd(normalized.length+((4-(normalized.length%4))%4),'=');\n      return JSON.parse(atob(padded));\n    }catch(error){return null;}\n  };\n  const scoreToken=(token,source)=>{\n    const payload=decodePayload(token);\n    let score=0;\n    if(payload&&payload.exp&&payload.exp>now)score+=100;\n    if(payload&&typeof payload.iss==='string'&&payload.iss.toLowerCase().includes('gran'))score+=40;\n    if(payload&&Array.isArray(payload.roles)&&payload.roles.length)score+=20;\n    if(typeof source==='string'&&/(token|bearer|auth|access|jwt)/i.test(source))score+=10;\n    return { token, source, payload, score };\n  };\n  const pushCandidate=(token,source)=>{\n    if(!token||seen.has(token))return;\n    seen.add(token);\n    candidates.push(scoreToken(token,source));\n  };\n  const scan=(value,source,depth=0)=>{\n    if(depth>3||value==null)return;\n    if(typeof value==='string'){\n      let match;\n      while((match=JWT_REGEX.exec(value))!==null){\n        if(match[1])pushCandidate(match[1],source);\n      }\n      try{\n        const parsed=JSON.parse(value);\n        scan(parsed,source+':json',depth+1);\n      }catch(error){}\n      return;\n    }\n    if(Array.isArray(value)){\n      value.forEach((item,index)=>scan(item,source+'['+index+']',depth+1));\n      return;\n    }\n    if(typeof value==='object'){\n      Object.entries(value).forEach(([key,item])=>scan(item,source+'.'+key,depth+1));\n    }\n  };\n  try{\n    for(let i=0;i<localStorage.length;i++){\n      const key=localStorage.key(i);\n      scan(localStorage.getItem(key),'localStorage:'+key);\n    }\n  }catch(error){}\n  try{\n    for(let i=0;i<sessionStorage.length;i++){\n      const key=sessionStorage.key(i);\n      scan(sessionStorage.getItem(key),'sessionStorage:'+key);\n    }\n  }catch(error){}\n  try{scan(document.cookie,'cookie');}catch(error){}\n  const sorted=candidates.sort((a,b)=>b.score-a.score);\n  const best=sorted[0];\n  if(!best){\n    alert('Nenhum bearer JWT foi encontrado. Abra a área de questões da Gran antes de executar o script.');\n    return;\n  }\n  window.__GRAN_CAPTURED_BEARER__=best;\n  try{await navigator.clipboard.writeText(best.token);}catch(error){}\n  const expiration=best.payload&&best.payload.exp?new Date(best.payload.exp*1000).toLocaleString('pt-BR'):'não identificada';\n  console.log('Bearer Gran capturado:',best);\n  prompt('Bearer encontrado. Copie se a área de transferência falhar:',best.token);\n  alert('Bearer encontrado e copiado. Origem: '+best.source+' | Expira: '+expiration);\n})();`;
        }

        async function copyGranCaptureScript() {
            const script = getGranBearerCaptureScript();
            try {
                await navigator.clipboard.writeText(script);
                setRequestMessage('Script de captura copiado. Execute-o no console da página de questões da Gran.', 'success');
            } catch (error) {
                setRequestMessage('Não foi possível copiar o script automaticamente. Use o campo do token manualmente.', 'warning');
            }
        }

        async function pasteGranBearerFromClipboard() {
            if (!navigator.clipboard || !navigator.clipboard.readText) {
                setRequestMessage('Seu navegador não liberou a leitura da área de transferência. Cole o bearer manualmente no campo acima.', 'warning');
                return;
            }

            try {
                const clipboardText = await navigator.clipboard.readText();
                if (!applyCapturedToken(clipboardText, 'área de transferência')) {
                    setRequestMessage('A área de transferência não contém um bearer válido da Gran.', 'warning');
                }
            } catch (error) {
                setRequestMessage('Falha ao ler a área de transferência. Permita o acesso ou cole o bearer manualmente.', 'warning');
            }
        }

        function persistScraperState() {
            localStorage.setItem(GRAN_STORAGE_KEY, JSON.stringify({
                token: tokenInput.value.trim(),
                page: pageInput.value,
                perPage: perPageInput.value,
                ano: anoFilterInput.value,
                url: directUrlInput.value.trim(),
            }));
        }

        function restoreScraperState() {
            try {
                const raw = localStorage.getItem(GRAN_STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                tokenInput.value = parsed.token || '';
                pageInput.value = parsed.page || '1';
                perPageInput.value = parsed.perPage || '20';
                anoFilterInput.value = parsed.ano || '';
                directUrlInput.value = parsed.url || '';
            } catch {
                // noop
            }
        }

        function updateTokenStatus() {
            const token = tokenInput.value.trim();
            if (!token) {
                tokenStatus.className = 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500';
                tokenStatus.textContent = 'Cole um bearer valido da Gran para liberar a busca.';
                return;
            }

            const expirationDate = getTokenExpirationDate(token);
            if (!expirationDate) {
                tokenStatus.className = 'rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700';
                tokenStatus.textContent = 'Token preenchido. Nao foi possivel ler a expiracao localmente.';
                return;
            }

            if (expirationDate.getTime() <= Date.now()) {
                tokenStatus.className = 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700';
                tokenStatus.textContent = `Token expirado em ${expirationDate.toLocaleString('pt-BR')}. Gere um novo bearer na Gran.`;
                return;
            }

            tokenStatus.className = 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700';
            tokenStatus.textContent = `Token valido ate ${expirationDate.toLocaleString('pt-BR')}.`;
        }

        restoreScraperState();
        updateTokenStatus();
        tokenInput.addEventListener('input', () => {
            updateTokenStatus();
            persistScraperState();
        });
        pageInput.addEventListener('input', persistScraperState);
        perPageInput.addEventListener('input', persistScraperState);
        anoFilterInput.addEventListener('input', persistScraperState);
        directUrlInput.addEventListener('input', persistScraperState);

        async function fetchQuestions() {
            const btnText = fetchBtn.innerText;
            fetchBtn.innerText = 'Carregando...';
            fetchBtn.disabled = true;
            setRequestMessage('');

            const trimmedToken = tokenInput.value.trim();
            if (!trimmedToken) {
                setRequestMessage('Informe um bearer valido da Gran antes de buscar.', 'warning');
                fetchBtn.innerText = btnText;
                fetchBtn.disabled = false;
                updateTokenStatus();
                return;
            }

            if (isTokenExpired(trimmedToken)) {
                setRequestMessage('O bearer informado ja expirou. Gere um novo token antes de buscar.', 'error');
                fetchBtn.innerText = btnText;
                fetchBtn.disabled = false;
                updateTokenStatus();
                return;
            }
            
            try {
                persistScraperState();

                const payload = {
                    action: 'fetch',
                    token: trimmedToken,
                    page: pageInput.value,
                    perPage: perPageInput.value,
                    ano: anoFilterInput.value,
                    url: directUrlInput.value.trim()
                };

                const response = await fetch('import_worker.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                
                // Show HTTP Status
                fetchStatusArea.classList.remove('hidden');
                httpStatusBadge.innerText = result.http_code || 'Err';
                if (result.http_code === 200) {
                    httpStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black font-mono bg-emerald-100 text-emerald-700';
                } else {
                    httpStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black font-mono bg-red-100 text-red-700';
                }

                if (result.success) {
                    currentQuestions = result.questions;
                    rawJsonArea.classList.remove('hidden');
                    rawJsonResponse.value = JSON.stringify(result, null, 2);
                    renderQuestions();
                    welcomeMessage.classList.add('hidden');
                    header.classList.remove('hidden');
                    availableInfo.classList.remove('hidden');
                    availStats.innerText = `${result.totalQuestions} questoes encontradas (${result.totalPages} paginas)`;
                    footer.classList.remove('hidden');
                    statsArea.classList.remove('hidden');
                    setRequestMessage(`Busca concluida. ${result.totalInPage} questoes carregadas nesta pagina.`, 'success');
                    document.documentElement.scrollTop = 0;
                } else {
                    const backendMessage = typeof result.message === 'object'
                        ? (result.message.text || JSON.stringify(result.message))
                        : result.message;
                    setRequestMessage(backendMessage || 'Nao foi possivel buscar as questoes.', 'error');
                }
            } catch (e) {
                setRequestMessage('Erro na requisicao: ' + ((e && e.message) || e), 'error');
            } finally {
                fetchBtn.innerText = btnText;
                fetchBtn.disabled = false;
                updateTokenStatus();
            }

            if (isAutoRunning) {
                await processAutoPage();
            }
        }

        async function processAutoPage() {
            if (!isAutoRunning) return;

            const questionsToProcess = currentQuestions.filter(q => !q.exists);
            
            if (questionsToProcess.length === 0) {
                console.log("Nenhuma questão nova nesta página.");
            } else {
                for (let i = 0; i < questionsToProcess.length; i++) {
                    if (!isAutoRunning) return;
                    
                    const q = questionsToProcess[i];
                    const idx = currentQuestions.indexOf(q);
                    
                    console.log(`[Auto] Processando questão ${i + 1}/${questionsToProcess.length}`);
                    
                    // 1. Gerar IA se não tiver
                    if (!q.teacherComment && !q.detailedComment) {
                        try {
                            await generateAiContent(idx);
                        } catch (e) {
                            console.error("Erro na IA (Ignorado no Auto):", e);
                        }
                    }
                }

                // 2. Importar tudo da página que foi processado
                console.log("[Auto] Importando questões da página...");
                await importSelected(true); // true means auto mode (ignore checkboxes, use all new)
            }

            // 3. Resumo e Próxima página
            if (isAutoRunning) {
                console.log("[Auto] Aguardando 10 segundos para próxima página...");
                
                // Exibe contador visual no botão
                let timeLeft = 10;
                const originalStopText = stopBtn.innerText;
                
                const timer = setInterval(() => {
                    timeLeft--;
                    stopBtn.innerText = `Parar (${timeLeft}s)`;
                    if (timeLeft <= 0) clearInterval(timer);
                }, 1000);

                await new Promise(r => setTimeout(r, 10000));
                clearInterval(timer);
                stopBtn.innerText = originalStopText;

                if (isAutoRunning) {
                    pageInput.value = parseInt(pageInput.value) + 1;
                    await fetchQuestions();
                }
            }
        }

        function stopAuto() {
            isAutoRunning = false;
            stopBtn.classList.add('hidden');
            autoMode.checked = false;
            console.log("Automação parada pelo usuário.");
        }

        autoMode.onchange = () => {
            if (autoMode.checked) {
                if (confirm("Iniciar Modo Automático? Isso irá percorrer as páginas e importar questões usando IA.")) {
                    isAutoRunning = true;
                    stopBtn.classList.remove('hidden');
                    fetchQuestions();
                } else {
                    autoMode.checked = false;
                }
            } else {
                stopAuto();
            }
        };

        stopBtn.onclick = stopAuto;

        function renderQuestions() {
            questionContainer.innerHTML = '';
            selectAll.checked = false;
            updateSelectionCount();

            currentQuestions.forEach((q, idx) => {
                const card = document.createElement('div');
                card.className = `question-card bg-white rounded-2xl border p-8 transition-all shadow-sm hover:shadow-md ${q.exists ? 'exists' : 'border-slate-100'}`;
                card.id = `q-card-${idx}`;
                
                let grupoHtml = q.grupoQuestao ? `
                    <div class="mb-6 p-6 bg-slate-900 border-l-4 border-amber-500 rounded-r-xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                <span class="text-[10px] font-black uppercase tracking-widest text-amber-500">Contexto do Grupo</span>
                            </div>
                            <span class="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[8px] font-black uppercase tracking-widest border border-amber-500/20">Grupo ID: ${q.grupoQuestao.id}</span>
                        </div>
                        
                        ${q.grupoQuestao.enunciado ? `
                            <div class="text-sm text-slate-300 leading-relaxed font-medium mb-4 prose prose-invert max-w-none">
                                ${q.grupoQuestao.enunciado.replace(/src=([\'"])\/imagem\//g, `src=$1${GRAN_ASSET_BASE_URL}/imagem/`)}
                            </div>
                        ` : ''}

                        ${(q.grupoQuestao.texto && q.grupoQuestao.texto !== q.grupoQuestao.enunciado) ? `
                            <div class="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-400 leading-relaxed font-medium italic prose prose-invert max-w-none">
                                ${q.grupoQuestao.texto.replace(/src=([\'"])\/imagem\//g, `src=$1${GRAN_ASSET_BASE_URL}/imagem/`)}
                            </div>
                        ` : ''}

                        ${(q.grupoQuestao.arquivo || q.grupoQuestao.caminho_arquivo) ? `
                            <div class="mt-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-1">
                                <img src="${GRAN_ASSET_BASE_URL}${(q.grupoQuestao.arquivo ? (q.grupoQuestao.arquivo.caminho || q.grupoQuestao.arquivo) : q.grupoQuestao.caminho_arquivo)}" class="w-full h-auto max-h-[300px] object-contain" alt="Imagem do grupo">
                            </div>
                        ` : ''}
                    </div>
                ` : '';

                let introHtml = q.introText ? `
                    <div class="mb-4 p-3 bg-slate-50 border-l-4 border-slate-300 text-xs text-slate-600 italic leading-relaxed">
                        ${q.introText}
                    </div>
                ` : '';

                let filtersHtml = `
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest">ID: ${q.granId}</span>
                    <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase tracking-widest">Banca: ${q.banca}</span>
                    <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase tracking-widest">Órgão: ${q.orgao}</span>
                    <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase tracking-widest">Ano: ${q.ano}</span>
                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase tracking-widest">Matéria: ${q.materia}</span>
                    <span class="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[8px] font-black uppercase tracking-widest">Nível: ${q.nivel}</span>
                    <span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[8px] font-black uppercase tracking-widest">Área: ${q.area}</span>
                    <span class="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[8px] font-black uppercase tracking-widest">Modalidade: ${q.modalidade}</span>
                    <span class="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-[8px] font-black uppercase tracking-widest">Dificuldade: ${q.dificuldade}</span>
                    ${q.teacherComment ? `<span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[8px] font-black uppercase tracking-widest">Possui Comentário Prof.</span>` : ''}
                    ${q.detailedComment ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase tracking-widest">Possui Análise Detalhada</span>` : ''}
                `;
                
                (Array.isArray(q.areas) ? q.areas : []).forEach(a => {
                    filtersHtml += `<span class="px-2 py-0.5 bg-orange-50 text-orange-600 rounded text-[8px] font-black uppercase tracking-widest">Área Extra: ${a}</span>`;
                });

                (Array.isArray(q.carreiras) ? q.carreiras : []).forEach(c => {
                    filtersHtml += `<span class="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[8px] font-black uppercase tracking-widest">Carreira: ${c}</span>`;
                });

                (Array.isArray(q.cargos) ? q.cargos : []).forEach(c => {
                    filtersHtml += `<span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-widest">Cargo: ${c}</span>`;
                });
                
                (Array.isArray(q.assuntos) ? q.assuntos : []).forEach(a => {
                    filtersHtml += `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest">${a}</span>`;
                });
                
                // Debug raw for taxonomy mapping
                const debugRaw = `
                    <div class="mt-4 p-2 bg-slate-900 text-emerald-400 text-[9px] font-mono rounded overflow-auto max-h-40 hidden debug-info">
                        ${JSON.stringify(q.raw, null, 2)}
                    </div>
                `;

                card.innerHTML = `
                    <div class="flex gap-6">
                        <div class="pt-2">
                            <input type="checkbox" class="q-checkbox w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-sm" 
                                data-idx="${idx}" ${q.exists ? 'disabled' : ''}>
                        </div>
                        <div class="flex-1 space-y-6">
                            <div class="flex flex-wrap gap-2">
                                ${filtersHtml}
                                ${q.exists ? '<span class="px-3 py-1 bg-slate-400 text-white rounded-full text-[8px] font-black uppercase ml-auto tracking-widest">Já Existe no Banco</span>' : ''}
                            </div>
                            <div class="text-base text-slate-800 leading-relaxed font-semibold">
                                ${grupoHtml}
                                ${introHtml}
                                ${q.imageUrl ? `
                                    <div class="mb-6 rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                        <img src="${q.imageUrl}" class="w-full h-auto object-contain max-h-[400px]" alt="Imagem da questão">
                                    </div>
                                ` : ''}
                                ${q.enunciado}
                            </div>
                            <div class="space-y-3">
                                ${q.alternativas.map((alt, i) => {
                                    const texto = alt.texto_alternativa || alt.corpo || alt.texto || '...';
                                    const isCorrect = alt.is_correto || alt.gabarito || false;
                                    return `
                                        <div class="flex gap-4 p-4 rounded-xl border border-slate-100 items-start ${isCorrect ? 'alt-correct' : 'bg-slate-50/50'}">
                                            <div class="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center shrink-0 font-black text-xs ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-slate-400'}">
                                                ${String.fromCharCode(65 + i)}
                                            </div>
                                            <div class="text-sm font-medium ${isCorrect ? 'text-emerald-900' : 'text-slate-600'}">
                                                ${texto}
                                            </div>
                                            ${isCorrect ? '<span class="ml-auto text-[8px] font-black uppercase tracking-widest text-emerald-600 mt-1">Correta</span>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>

                            ${q.teacherComment ? `
                                <div class="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 shadow-sm">
                                    <div class="flex items-center gap-2 mb-2">
                                        <div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                        <span class="text-[9px] font-black uppercase tracking-widest text-rose-600">Comentário do Professor</span>
                                    </div>
                                    <div class="text-xs text-rose-900 leading-relaxed font-medium">
                                        ${q.teacherComment}
                                    </div>
                                </div>
                            ` : ''}

                            ${q.detailedComment ? `
                                <div class="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                    <div class="flex items-center gap-2 mb-2">
                                        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Análise Detalhada</span>
                                    </div>
                                    <div class="text-xs text-emerald-900 leading-relaxed font-medium">
                                        ${q.detailedComment}
                                    </div>
                                </div>
                            ` : ''}

                            ${(!q.teacherComment && !q.detailedComment) ? `
                                <div id="ai-placeholder-${idx}" class="mt-4 pt-4 border-t border-dashed border-slate-200">
                                    <button onclick="generateAiContent(${idx})" class="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                        Gerar Comentários com IA
                                    </button>
                                </div>
                            ` : ''}

                            <div class="pt-4 border-t border-slate-100 flex justify-end">
                                <button onclick="this.parentElement.nextElementSibling.classList.toggle('hidden')" class="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors">
                                    Debug Raw Data
                                </button>
                            </div>
                            ${debugRaw}
                        </div>
                    </div>
                `;

                card.onclick = (e) => {
                    if (q.exists) return;
                    if (e.target.tagName === 'INPUT' || e.target.closest('.q-checkbox')) return;
                    const cb = card.querySelector('.q-checkbox');
                    cb.checked = !cb.checked;
                    updateSelectionCount();
                };

                questionContainer.appendChild(card);
            });

            // Listen to checkboxes
            document.querySelectorAll('.q-checkbox').forEach(cb => {
                cb.onchange = updateSelectionCount;
            });
        }

        function updateSelectionCount() {
            const checkedBoxes = document.querySelectorAll('.q-checkbox:checked');
            const checkedCount = checkedBoxes.length;
            selectionCountLabel.innerText = `${checkedCount} Selecionadas`;
            importBtn.disabled = checkedCount === 0;
            
            // Sync Cards visual
            document.querySelectorAll('.q-checkbox').forEach(cb => {
                const card = document.getElementById(`q-card-${cb.dataset.idx}`);
                if (cb.checked) card.classList.add('selected');
                else card.classList.remove('selected');
            });
        }

        selectAll.onchange = () => {
            document.querySelectorAll('.q-checkbox:not(:disabled)').forEach(cb => {
                cb.checked = selectAll.checked;
            });
            updateSelectionCount();
        };

        async function importSelected(isAuto = false) {
            let selectedData = [];
            let selectedIdx = [];

            if (isAuto) {
                selectedIdx = currentQuestions.map((q, i) => i).filter(i => !currentQuestions[i].exists);
                selectedData = selectedIdx.map(idx => currentQuestions[idx].raw);
                
                // Update raw with AI content if generated
                selectedIdx.forEach((idx, i) => {
                    const q = currentQuestions[idx];
                    if (q.teacherComment) selectedData[i].comentario_professor = q.teacherComment;
                    if (q.detailedComment) selectedData[i].resolucao_texto = q.detailedComment;
                });

            } else {
                selectedIdx = Array.from(document.querySelectorAll('.q-checkbox:checked')).map(cb => parseInt(cb.dataset.idx));
                selectedData = selectedIdx.map(idx => currentQuestions[idx].raw);
                
                // Update with AI content
                selectedIdx.forEach((idx, i) => {
                    const q = currentQuestions[idx];
                    if (q.teacherComment) selectedData[i].comentario_professor = q.teacherComment;
                    if (q.detailedComment) selectedData[i].resolucao_texto = q.detailedComment;
                });
            }

            if (selectedData.length === 0) {
                if (!isAuto) alert("Nenhuma questão selecionada.");
                return;
            }

            importBtn.innerText = 'Importando...';
            importBtn.disabled = true;

            try {
                const response = await fetch('import_worker.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save',
                        questions: selectedData
                    })
                });

                const result = await response.json();
                if (result.success) {
                    sessionStats.imported += result.imported;
                    sessionStats.skipped += result.skipped;
                    countImported.innerText = sessionStats.imported;
                    countSkipped.innerText = sessionStats.skipped;

                    document.getElementById('successMessage').innerText = `${result.imported} questões foram adicionadas ao seu banco de dados.`;
                    document.getElementById('successModal').classList.remove('hidden');
                    
                    // Mark as exists in UI
                    selectedIdx.forEach(idx => {
                        currentQuestions[idx].exists = true;
                    });
                    renderQuestions();
                } else {
                    alert('Erro na importação: ' + result.message);
                }
            } catch (e) {
                alert('Erro: ' + e);
            } finally {
                importBtn.innerText = 'Importar Selecionadas';
                importBtn.disabled = false;
            }
        }

        async function generateAiContent(idx) {
            const q = currentQuestions[idx];
            const placeholder = document.getElementById(`ai-placeholder-${idx}`);
            const btn = placeholder.querySelector('button');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="flex items-center gap-2"><svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Gerando Inteligência...</span>';

            try {
                const response = await fetch('import_worker.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'generate_ai',
                        token: tokenInput.value,
                        enunciado: q.enunciado,
                        alternativas: q.alternativas
                    })
                });

                const result = await response.json();
                if (result.success) {
                    q.teacherComment = result.data.teacherComment;
                    q.detailedComment = result.data.detailedComment;
                    renderQuestions();
                } else {
                    alert('Erro na IA: ' + (result.message || 'Desconhecido'));
                    btn.disabled = false;
                    btn.innerHTML = 'Tentar Novamente com IA';
                }
            } catch (e) {
                console.error(e);
                alert('Erro ao conectar com o motor de IA.');
                btn.disabled = false;
                btn.innerHTML = 'Tentar Novamente';
            }
        }

        window.toggleSection = (id) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden');
        };

        fetchBtn.onclick = fetchQuestions;
        importBtn.onclick = importSelected;
        copyCaptureScriptBtn.onclick = copyGranCaptureScript;
        pasteCaptureTokenBtn.onclick = pasteGranBearerFromClipboard;
        nextPageBtn.onclick = () => {
             // Keep token and update page
            pageInput.value = parseInt(pageInput.value) + 1;
            fetchQuestions();
        };
    </script>
</body>
</html>


