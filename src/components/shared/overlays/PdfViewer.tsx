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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertTriangle, Maximize, FileText, Layout, List, StickyNote, Save, MessageSquare, Bookmark as BookmarkIcon, Clock, Trash2, GraduationCap } from 'lucide-react';
// import 'pdfjs-dist/web/pdf_viewer.css'; // Removed to prevent conflict
import { apiClient, ENDPOINTS } from '@services/api'; // Ensure this path is correct based on project structure
import { readerService } from '@services/materials';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import CommentsSection from '../feedback/CommentsSection';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

// Estilos para TextLayer
const styles = `
    .textLayer {
        position: absolute;
        text-align: initial;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        opacity: 1 !important;
        line-height: 1.0;
        pointer-events: auto !important;
        user-select: text !important;
        -webkit-user-select: text !important;
    }
    .textLayer > span {
        color: transparent;
        opacity: 1 !important;
        position: absolute;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
    }
    .textLayer ::selection {
        background: rgba(0, 100, 255, 0.3) !important;
        color: transparent;
    }
`;
// Inject styles
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    document.head.appendChild(styleEl);
}

const loadPdfJsModule = async (): Promise<PdfJsModule> => {
    if (!pdfJsModulePromise) {
        pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
            module.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
                import.meta.url,
            ).toString();
            return module;
        });
    }

    return pdfJsModulePromise;
};

interface PdfViewerProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    title: string;
    mode?: 'modal' | 'embedded';
    materialId?: string;
    password?: string;
}

interface Bookmark {
    id: number;
    page_num: number;
    label: string;
    created_at: string;
}

const StudyTimer: React.FC = () => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    return (
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
            <Clock size={14} className="text-indigo-500" />
            <span>{formatTime(seconds)}</span>
        </div>
    );
};

interface PdfPageProps {
    pdfDoc: PdfDocumentProxy;
    pdfjsModule: PdfJsModule;
    pageNum: number;
    scale: number;
}

const PdfPage: React.FC<PdfPageProps> = ({ pdfDoc, pdfjsModule, pageNum, scale }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        let isCancelled = false;

        const render = async () => {
            if (!canvasRef.current) return;

            // Cancelar render anterior e aguardar conclusão do cancelamento
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                    // Aguardar a promise do cancelamento para garantir que o canvas foi liberado
                    await renderTaskRef.current.promise;
                } catch (error) {
                    // RenderingCancelledException é esperado, ignorar
                }
                renderTaskRef.current = null;
            }

            // Checar se o componente foi desmontado durante o cancelamento
            if (isCancelled) return;

            // Limpar text layer antes de nova renderização para evitar spans acumulados
            if (textLayerRef.current) {
                textLayerRef.current.innerHTML = '';
            }

            try {
                const page = await pdfDoc.getPage(pageNum);
                if (isCancelled) return;

                // Respeitar rotação embutida no PDF (page.rotate pode ser 0, 90, 180, 270)
                const viewport = page.getViewport({ scale: scale * window.devicePixelRatio, rotation: page.rotate });
                const canvas = canvasRef.current;
                if (!canvas) return;
                const context = canvas.getContext('2d');

                if (!context) return;

                // Ajustar dimensões do canvas para device pixel ratio
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.height = `${viewport.height / window.devicePixelRatio}px`;
                canvas.style.width = `${viewport.width / window.devicePixelRatio}px`;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;

                await renderTask.promise;
                renderTaskRef.current = null;

                // Renderizar Text Layer
                if (textLayerRef.current && !isCancelled) {
                    const textContent = await page.getTextContent();

                    try {
                        const pdfjsAny = pdfjsModule as any;

                        if (false /* pdfjsAny.renderTextLayer */) {
                            await pdfjsAny.renderTextLayer({
                                textContentSource: textContent,
                                container: textLayerRef.current,
                                // Usar mesma rotação no text layer para alinhamento correto
                                viewport: page.getViewport({ scale: scale, rotation: page.rotate }),
                                textDivs: []
                            }).promise;
                        } else {
                            // Fallback manual — usar mesma rotação do canvas para alinhamento correto
                            textContent.items.forEach((item: any) => {
                                const tx = pdfjsModule.Util.transform(
                                    pdfjsModule.Util.transform(
                                        page.getViewport({ scale: scale, rotation: page.rotate }).transform, // Use same rotation as canvas
                                        item.transform
                                    ),
                                    [1, 0, 0, -1, 0, 0]
                                );
                                const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
                                const span = document.createElement('span');
                                span.textContent = item.str;
                                span.style.fontFamily = item.fontName;
                                span.style.fontSize = `${fontHeight}px`;
                                span.style.position = 'absolute';
                                span.style.left = `${tx[4]}px`;
                                span.style.top = `${tx[5] - fontHeight}px`;
                                // span.style.pointerEvents = 'none'; // Allow selection
                                textLayerRef.current?.appendChild(span);
                            });
                        }
                    } catch (e) {
                        console.warn("TextLayer render failed", e);
                    }
                }
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error(`Page ${pageNum} render error:`, err);
                }
            }
        };

        render();

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        };
    }, [pdfDoc, pageNum, pdfjsModule, scale]);


    return (
        <div className="relative isolate" style={{ width: 'fit-content', height: 'fit-content' }}>
            <canvas ref={canvasRef} key={`${pageNum}-${scale}`} className="shadow-lg bg-white relative z-0" />
            <div ref={textLayerRef} className="textLayer absolute inset-0 z-10" />
        </div>
    );
};

const PdfViewer: React.FC<PdfViewerProps> = ({ url, isOpen, onClose, title, mode = 'modal', materialId, password }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [pdfjsModule, setPdfjsModule] = useState<PdfJsModule | null>(null);
    const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [displayMode, setDisplayMode] = useState<'page' | 'scroll'>('page');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const { materials, addMaterialComment, likeMaterialComment, deleteMaterialComment } = useMarketplace();

    const material = materials.find(m => m.id === materialId);
    const materialSubject = material?.subjectText || (typeof material?.subject === 'string' ? material.subject : (material?.subject as any)?.name || '');

    // Estado local para comentários do material — carregado ao abrir o viewer
    const [localComments, setLocalComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [showComments, setShowComments] = useState(false);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [newBookmarkLabel, setNewBookmarkLabel] = useState('');

    // Notes State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [originalNoteText, setOriginalNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        if (isOpen && url) {
            // Resetar estado antes de carregar novo conteúdo
            setNoteText('');
            setOriginalNoteText('');
            setBookmarks([]);
            setLocalComments([]);

            loadPdf();
            if (materialId && currentUser) {
                fetchNote();
                fetchComments();
            }
        } else {
            setPdfjsModule(null);
            setPdfDoc(null);
            setPageNum(1);
            setScale(1.0);
            setLoading(false);
        }
    }, [isOpen, url, materialId, currentUser, password]);

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') {
            return;
        }

        let isMounted = true;

        loadPdfJsModule()
            .then((module) => {
                if (isMounted) {
                    setPdfjsModule(module);
                }
            })
            .catch((err) => {
                console.error('Failed to initialize PDF.js:', err);
                if (isMounted) {
                    setError('Nao foi possivel inicializar o leitor PDF.');
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    // Busca comentários do material no backend ao abrir o viewer
    const fetchComments = async () => {
        if (!materialId || !currentUser) return;
        setLoadingComments(true);
        try {
            // apiClient interceptor já retorna response.data, então res = { success, data: [...] }
            const res = await apiClient.get<any>(ENDPOINTS.comments.list, {
                params: { target_id: materialId, user_id: currentUser.id }
            }) as any;
            if (res && res.success && Array.isArray(res.data)) {
                setLocalComments(res.data);
            }
        } catch (err) {
            console.error('Falha ao carregar comentários:', err);
        } finally {
            setLoadingComments(false);
        }
    };

    // Recarregar comentários sempre que o sidebar de comentários for aberto
    useEffect(() => {
        if (showComments && materialId && currentUser) {
            fetchComments();
        }
    }, [showComments]);

    const loadPdf = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[PdfViewer] loadPdf start. url:', url, '| password:', password);
            const pdfjs = await loadPdfJsModule();
            setPdfjsModule(pdfjs);
            const getDocParams: any = { url };
            if (password) {
                getDocParams.password = password;
            }
            console.log('[PdfViewer] Passing to getDocument:', getDocParams);
            const loadingTask = pdfjs.getDocument(getDocParams);
            const doc = await loadingTask.promise;
            console.log('[PdfViewer] Document loaded successfully.');
            setPdfDoc(doc);
            setLoading(false);
        } catch (err) {
            console.error("Error loading PDF:", err);
            setError("Não foi possível carregar o documento PDF.");
            setLoading(false);
        }
    };

    const fetchNote = async () => {
        if (!materialId || !currentUser) return;
        try {
            const note = await readerService.getNote(materialId, currentUser.id);
            const nextNoteText = note?.note_text || '';
            setNoteText(nextNoteText);
            setOriginalNoteText(nextNoteText);
        } catch (err) {
            console.error("Failed to fetch note:", err);
        }
    };

    // Prevent browser zoom
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) {
                e.preventDefault();
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const fetchBookmarks = async () => {
        if (!materialId || !currentUser) return;
        try {
            const nextBookmarks = await readerService.getBookmarks(materialId, currentUser.id);
            setBookmarks(nextBookmarks);
        } catch (err) {
            console.error("Failed to fetch bookmarks:", err);
        }
    };

    const saveBookmark = async () => {
        if (!materialId || !currentUser) return;
        const label = newBookmarkLabel.trim() || `Página ${pageNum}`;
        try {
            const bookmark = await readerService.saveBookmark(materialId, pageNum, label, currentUser.id);
            setBookmarks(prev => [...prev, bookmark].sort((a, b) => a.page_num - b.page_num));
            addToast("Marcador salvo!", "success");
            setNewBookmarkLabel('');
        } catch (err) {
            console.error("Failed to save bookmark:", err);
            addToast("Erro ao salvar marcador.", "error");
        }
    };

    const deleteBookmark = async (id: number) => {
        try {
            await readerService.deleteBookmark(id);
            setBookmarks(prev => prev.filter(b => b.id !== id));
            addToast("Marcador removido.", "info");
        } catch (err) {
            console.error("Failed to delete bookmark:", err);
        }
    };

    const handleSaveNote = async () => {
        if (!materialId || !currentUser) return;
        setSavingNote(true);
        try {
            const note = await readerService.saveNote(materialId, noteText, currentUser.id);
            setOriginalNoteText(note.note_text || noteText);
            addToast("Anotação salva com sucesso!", "success");
            setIsNoteModalOpen(false);
        } catch (err) {
            console.error("Failed to save note:", err);
            addToast("Erro ao salvar anotação.", "error");
        } finally {
            setSavingNote(false);
        }
    };


    const changePage = (delta: number) => {
        if (!pdfDoc) return;
        const newPage = pageNum + delta;
        if (newPage >= 1 && newPage <= pdfDoc.numPages) {
            setPageNum(newPage);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
        }
    };

    const changeZoom = (delta: number) => {
        setScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
    };

    const toggleDisplayMode = () => {
        setDisplayMode(prev => prev === 'page' ? 'scroll' : 'page');
    };

    useEffect(() => {
        if (showBookmarks && materialId && currentUser) {
            fetchBookmarks();
        }
    }, [showBookmarks, materialId, currentUser]);

    if (!isOpen) return null;

    const content = (
        <div className={`flex flex-col h-full w-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative ${mode === 'modal' ? 'md:rounded-b-2xl' : ''}`}>
            {/* Toolbar */}
            <div className="flex-none flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <h3 className="hidden md:block font-bold text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={title}>{title}</h3>
                    <StudyTimer />
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        <button
                            onClick={() => setDisplayMode('page')}
                            className={`p-1.5 rounded-md transition-all ${displayMode === 'page' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            title="Modo Página"
                        >
                            <Layout size={18} />
                        </button>
                        <button
                            onClick={() => setDisplayMode('scroll')}
                            className={`p-1.5 rounded-md transition-all ${displayMode === 'scroll' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            title="Modo Rolagem"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    {/* Resolve Questions Button */}
                    {materialSubject && (
                        <button
                            onClick={() => {
                                const subjectParam = encodeURIComponent(materialSubject);
                                const topicParam = material?.topic ? `&topic=${encodeURIComponent(material.topic)}` : '';
                                window.open(`/practice?subject=${subjectParam}${topicParam}`, '_blank');
                            }}
                            className="p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            title="Resolver Questões"
                        >
                            <GraduationCap size={18} />
                            <span className="hidden md:inline">Resolver Questões</span>
                        </button>
                    )}
                    {/* Comments Button */}
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase ${showComments ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                        title="Comentários"
                    >
                        <div className="relative">
                            <MessageSquare size={18} />
                            {/* Contar todos os comentários e respostas a partir do estado local */}
                            {(localComments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0) + (c.replies?.reduce((subAcc: number, subC: any) => subAcc + (subC.replies?.length || 0), 0) || 0), 0) || 0) > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                    {localComments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0) + (c.replies?.reduce((subAcc: number, subC: any) => subAcc + (subC.replies?.length || 0), 0) || 0), 0)}
                                </span>
                            )}
                        </div>
                        <span className="hidden md:inline">Comentários</span>
                    </button>
                    {/* Notes Button */}
                    <button
                        onClick={() => setIsNoteModalOpen(true)}
                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase ${noteText ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                        title="Minhas Anotações"
                    >
                        <StickyNote size={18} />
                        <span className="hidden md:inline">{noteText ? 'Ver Nota' : 'Anotar'}</span>
                    </button>

                    <button
                        onClick={() => setShowBookmarks(!showBookmarks)}
                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase ${showBookmarks ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                        title="Marcadores"
                    >
                        <BookmarkIcon size={18} />
                        <span className="hidden md:inline">Marcadores</span>
                    </button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        <button onClick={() => changeZoom(-0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-400" title="Diminuir Zoom"><ZoomOut size={18} /></button>
                        <span className="text-xs font-bold w-12 text-center text-slate-600 dark:text-slate-400">{Math.round(scale * 100)}%</span>
                        <button onClick={() => changeZoom(0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-400" title="Aumentar Zoom"><ZoomIn size={18} /></button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-full transition-colors ml-1">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Document Area */}
            {/* The parent container (this div) must handle the overflow scrolling. */}
            <div ref={scrollContainerRef} className="flex-1 w-full overflow-auto bg-slate-200 dark:bg-slate-900 shadow-inner relative">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 z-20 bg-slate-100/80 dark:bg-slate-950/80">
                        <Loader2 size={40} className="animate-spin mb-2" />
                        <p className="font-bold text-sm">Carregando...</p>
                    </div>
                )}

                {/* Inner wrapper: 
                    - min-h-full ensures it takes full height of parent.
                    - flex items-center justify-center centers the PDF when it's smaller than viewport.
                    - When PDF is larger (Zoom), this wrapper expands, pushing the parent's scrollbars.
                */}
                {!loading && !error && pdfDoc && (
                    <div className={`min-h-full min-w-full flex ${displayMode === 'page' ? 'items-center justify-center py-8' : 'justify-center py-8'}`}>
                        {displayMode === 'page' ? (
                            <PdfPage
                                pdfDoc={pdfDoc}
                                pdfjsModule={pdfjsModule}
                                pageNum={pageNum}
                                scale={scale}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map(num => (
                                    <PdfPage
                                        key={num}
                                        pdfDoc={pdfDoc}
                                        pdfjsModule={pdfjsModule}
                                        pageNum={num}
                                        scale={scale}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pagination Controls (Visible only in page mode) */}
            {displayMode === 'page' && pdfDoc && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center items-center gap-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNum <= 1 || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>

                    <span className="font-bold text-xs text-slate-600 dark:text-slate-400">
                        Página {pageNum} de {pdfDoc.numPages}
                    </span>

                    <button
                        onClick={() => changePage(1)}
                        disabled={pageNum >= pdfDoc.numPages || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={20} className="text-slate-700 dark:text-slate-300" />
                    </button>
                </div>
            )}

            {/* Note Modal */}
            {isNoteModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-scale-in border border-slate-200 dark:border-slate-800">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/20">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest flex items-center gap-2">
                                <StickyNote size={16} className="text-yellow-600 dark:text-yellow-400" /> Minhas Anotações
                            </h3>
                            <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 flex-1">
                            <textarea
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                className="w-full h-48 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400/50 text-sm text-slate-700 dark:text-slate-300 resize-none transition-all placeholder-slate-400"
                                placeholder="Digite suas anotações sobre este material aqui..."
                                autoFocus
                            />
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
                            <button
                                onClick={() => {
                                    setNoteText(originalNoteText); // Reset changes if cancelled
                                    setIsNoteModalOpen(false);
                                }}
                                className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveNote}
                                disabled={savingNote || noteText === originalNoteText}
                                className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl text-xs font-black uppercase shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {savingNote ? 'Salvando...' : 'Salvar Nota'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comments Sidebar */}
            {showComments && (
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-40 flex flex-col animate-slide-in-right">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <List size={18} className="text-indigo-600 dark:text-indigo-400" /> Comentários
                        </h3>
                        <button onClick={() => setShowComments(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <CommentsSection
                            targetId={materialId || 'unknown'}
                            comments={localComments}
                            onAddComment={async (text, parentId) => {
                                if (!materialId) return;
                                // Salvar no backend e receber o comentário criado
                                const newComment = await addMaterialComment(materialId, text, parentId);
                                if (newComment) {
                                    // Atualização otimista: adicionar ao estado local imediatamente
                                    setLocalComments(prev => {
                                        if (parentId) {
                                            // Aninhar resposta no comentário pai correto
                                            const addReply = (list: any[]): any[] => list.map(c => {
                                                if (c.id === parentId) {
                                                    return { ...c, replies: [newComment, ...(c.replies || [])] };
                                                }
                                                if (c.replies?.length) {
                                                    return { ...c, replies: addReply(c.replies) };
                                                }
                                                return c;
                                            });
                                            return addReply(prev);
                                        }
                                        return [newComment, ...prev];
                                    });
                                }
                                // Recarregar em background para sincronizar dados reais do banco
                                fetchComments();
                            }}
                            onLikeComment={async (commentId) => {
                                if (!materialId) return;
                                // Atualização otimista: toggle isLiked e likes count em localComments
                                const toggleLike = (list: any[]): any[] => list.map(c => {
                                    if (c.id === commentId) {
                                        return {
                                            ...c,
                                            isLiked: !c.isLiked,
                                            likes: c.isLiked ? c.likes - 1 : c.likes + 1
                                        };
                                    }
                                    if (c.replies?.length) {
                                        return { ...c, replies: toggleLike(c.replies) };
                                    }
                                    return c;
                                });
                                setLocalComments(prev => toggleLike(prev));
                                // Persistir no backend
                                await likeMaterialComment(materialId, commentId);
                            }}
                            onReportComment={() => addToast("Reportado com sucesso.", "success")}
                            onDeleteComment={async (commentId) => {
                                if (!materialId) return;
                                // Filtro recursivo para remover comentário ou resposta aninhada
                                const deepFilter = (list: any[]): any[] =>
                                    list
                                        .filter(c => c.id !== commentId)
                                        .map(c => c.replies?.length
                                            ? { ...c, replies: deepFilter(c.replies) }
                                            : c
                                        );
                                setLocalComments(prev => deepFilter(prev));
                                // Persistir no backend em background
                                deleteMaterialComment(materialId, commentId);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Bookmarks Sidebar */}
            {showBookmarks && (
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-80 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-40 flex flex-col animate-slide-in-right">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BookmarkIcon size={18} className="text-indigo-600 dark:text-indigo-400" /> Marcadores
                        </h3>
                        <button onClick={() => setShowBookmarks(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newBookmarkLabel}
                                onChange={e => setNewBookmarkLabel(e.target.value)}
                                placeholder="Nome do marcador..."
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                onClick={saveBookmark}
                                className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold uppercase"
                                title="Salvar Marcador"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {bookmarks.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-48 text-center p-4 text-slate-400 dark:text-slate-600 space-y-2">
                                <BookmarkIcon size={32} className="opacity-20" />
                                <p className="text-sm font-medium">Nenhum marcador ainda</p>
                                <p className="text-xs">Navegue até uma página interessante e use o campo acima para salvá-la.</p>
                            </div>
                        )}
                        {bookmarks.map(b => (
                            <div key={b.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer" onClick={() => { setPageNum(b.page_num); }}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs w-8 h-8 flex items-center justify-center rounded-lg">
                                        {b.page_num}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{b.label}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(b.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteBookmark(b.id); }}
                                    className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Highlight Action Popup (Disabled) */}
            {/* {selectedText && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 animate-scale-in border border-slate-700">
                   ...
                </div>
            )} */}

        </div>
    );

    if (mode === 'embedded') return content;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-0 md:p-6">
            <div className="bg-white dark:bg-slate-900 w-full h-full md:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                {content}
            </div>
        </div>
    );
};

export default PdfViewer;
