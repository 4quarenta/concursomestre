import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Configure worker - Ensure this matches the version used in Admin.tsx
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    title: string;
    mode?: 'modal' | 'embedded';
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, isOpen, onClose, title, mode = 'modal' }) => {
    const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [pageNum, setPageNum] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (isOpen && url) {
            loadPdf();
        } else {
            setPdfDoc(null);
            setPageNum(1);
            setScale(1.0);
            setLoading(false);
        }
    }, [isOpen, url]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNum);
        }
    }, [pdfDoc, pageNum, scale]);

    const loadPdf = async () => {
        setLoading(true);
        setError(null);
        try {
            const loadingTask = pdfjs.getDocument(url);
            const doc = await loadingTask.promise;
            setPdfDoc(doc);
            setLoading(false);
        } catch (err) {
            console.error("Error loading PDF:", err);
            setError("Não foi possível carregar o documento PDF.");
            setLoading(false);
        }
    };

    const renderPage = async (num: number) => {
        if (!pdfDoc || !canvasRef.current) return;

        // Cancel previous render if any
        if (renderTaskRef.current) {
            await renderTaskRef.current.cancel();
        }

        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
        } catch (err: any) {
            if (err.name !== 'RenderingCancelledException') {
                console.error("Render error:", err);
            }
        }
    };

    const changePage = (delta: number) => {
        if (!pdfDoc) return;
        const newPage = pageNum + delta;
        if (newPage >= 1 && newPage <= pdfDoc.numPages) {
            setPageNum(newPage);
        }
    };

    const changeZoom = (delta: number) => {
        setScale(prev => Math.max(0.5, Math.min(3.0, prev + delta)));
    };

    if (!isOpen) return null;

    if (mode === 'embedded') {
        return (
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate pr-4 max-w-[60%]">{title}</h3>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onClick={() => changeZoom(-0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors" title="Diminuir Zoom"><ZoomOut size={18} className="text-slate-600 dark:text-slate-300" /></button>
                            <span className="text-xs font-bold w-12 text-center text-slate-600 dark:text-slate-300">{Math.round(scale * 100)}%</span>
                            <button onClick={() => changeZoom(0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors" title="Aumentar Zoom"><ZoomIn size={18} className="text-slate-600 dark:text-slate-300" /></button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-full transition-colors" title="Fechar Leitor">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex justify-center p-4 relative">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 z-20 bg-slate-100/80 dark:bg-slate-950/80">
                            <Loader2 size={40} className="animate-spin mb-2" />
                            <p className="font-bold text-sm">Carregando documento...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center text-red-500 p-8 text-center h-full">
                            <AlertTriangle size={48} className="mb-4 opacity-50" />
                            <p className="font-bold mb-2">Erro ao carregar PDF</p>
                            <p className="text-sm opacity-80">{error}</p>
                        </div>
                    )}

                    <canvas ref={canvasRef} className="shadow-lg" />
                </div>

                {/* Footer Controls */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center items-center gap-4 z-10">
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNum <= 1 || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={24} className="text-slate-700 dark:text-slate-300" />
                    </button>

                    <span className="font-bold text-sm text-slate-600 dark:text-slate-400">
                        Página {pageNum} de {pdfDoc?.numPages || '--'}
                    </span>

                    <button
                        onClick={() => changePage(1)}
                        disabled={!pdfDoc || pageNum >= pdfDoc.numPages || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={24} className="text-slate-700 dark:text-slate-300" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full h-full md:w-[90vw] md:h-[90vh] md:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate pr-4 max-w-[60%]">{title}</h3>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onClick={() => changeZoom(-0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors" title="Diminuir Zoom"><ZoomOut size={18} className="text-slate-600 dark:text-slate-300" /></button>
                            <span className="text-xs font-bold w-12 text-center text-slate-600 dark:text-slate-300">{Math.round(scale * 100)}%</span>
                            <button onClick={() => changeZoom(0.25)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors" title="Aumentar Zoom"><ZoomIn size={18} className="text-slate-600 dark:text-slate-300" /></button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex justify-center p-4 relative">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 z-20 bg-slate-100/80 dark:bg-slate-950/80">
                            <Loader2 size={40} className="animate-spin mb-2" />
                            <p className="font-bold text-sm">Carregando documento...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center text-red-500 p-8 text-center h-full">
                            <AlertTriangle size={48} className="mb-4 opacity-50" />
                            <p className="font-bold mb-2">Erro ao carregar PDF</p>
                            <p className="text-sm opacity-80">{error}</p>
                        </div>
                    )}

                    <canvas ref={canvasRef} className="shadow-lg" />
                </div>

                {/* Footer Controls */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center items-center gap-4 z-10">
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNum <= 1 || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={24} className="text-slate-700 dark:text-slate-300" />
                    </button>

                    <span className="font-bold text-sm text-slate-600 dark:text-slate-400">
                        Página {pageNum} de {pdfDoc?.numPages || '--'}
                    </span>

                    <button
                        onClick={() => changePage(1)}
                        disabled={!pdfDoc || pageNum >= pdfDoc.numPages || loading}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={24} className="text-slate-700 dark:text-slate-300" />
                    </button>
                </div>
            </div>
        </div>
    );
};
import { AlertTriangle } from 'lucide-react'; // Added missing import

export default PdfViewer;
