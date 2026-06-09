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

import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  Pilcrow,
  Quote,
  RotateCcw,
  Type,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';

const FLOATING_TOOLBAR_TOP_OFFSET = 10;

interface RichTextEditorProps {
  initialValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  stickyToolbar?: boolean;
  allowImages?: boolean;
  contentClassName?: string;
}

type ToolbarButtonProps = {
  icon: LucideIcon;
  command: string;
  value?: string;
  active?: boolean;
  title: string;
  disabled?: boolean;
  onCommand: (command: string, value?: string) => void;
};

const ToolbarButton = ({
  icon: Icon,
  command,
  value,
  active = false,
  title,
  disabled = false,
  onCommand,
}: ToolbarButtonProps) => (
  <button
    type="button"
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
      if (!disabled) {
        onCommand(command, value);
      }
    }}
    title={title}
    aria-label={title}
    className={`shrink-0 rounded-lg p-1 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800 sm:p-1.5 ${
      active
        ? 'bg-slate-200 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400'
        : 'text-slate-500 dark:text-slate-400'
    }`}
  >
    <Icon size={16} />
  </button>
);

const escapeHtmlAttribute = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const readImageFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'));
  reader.readAsDataURL(file);
});

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialValue = '',
  onChange,
  placeholder,
  disabled = false,
  stickyToolbar = true,
  allowImages = false,
  contentClassName = '',
}) => {
  const editorShellRef = useRef<HTMLDivElement>(null);
  const toolbarAnchorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const lastSyncedHtmlRef = useRef('');
  const [color, setColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('#fef08a');
  const [floatingToolbar, setFloatingToolbar] = useState<{
    active: boolean;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [activeCommands, setActiveCommands] = useState({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
  });
  const [activeBlock, setActiveBlock] = useState('P');

  const saveCurrentSelection = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const editor = contentRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container instanceof Element ? container : container.parentElement;
    if (!element || !editor.contains(element)) {
      return;
    }

    selectionRangeRef.current = range.cloneRange();
  }, []);

  const restoreSavedSelection = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const editor = contentRef.current;
    const range = selectionRangeRef.current;
    if (!editor || !range) {
      editor?.focus();
      return;
    }

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const refreshToolbarState = React.useCallback(() => {
    if (disabled || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const editor = contentRef.current;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
    if (!editor || !anchorElement || !editor.contains(anchorElement)) {
      return;
    }

    saveCurrentSelection();
    const blockElement = anchorElement.closest('h1,h2,h3,h4,h5,h6,p,blockquote,li,div');
    const blockTag = blockElement?.tagName?.toUpperCase() || 'P';
    setActiveBlock(blockTag === 'DIV' || blockTag === 'LI' ? 'P' : blockTag);
    setActiveCommands({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  }, [disabled, saveCurrentSelection]);

  const emitSanitizedChange = React.useCallback(() => {
    const editor = contentRef.current;
    if (!editor) {
      return;
    }

    const sanitizedHtml = normalizeQuestionRichHtml(editor.innerHTML);
    lastSyncedHtmlRef.current = sanitizedHtml;
    onChange(sanitizedHtml);
  }, [onChange]);

  const execCommand = React.useCallback((command: string, value: string | undefined = undefined) => {
    if (disabled || typeof document === 'undefined') {
      return;
    }

    restoreSavedSelection();
    document.execCommand(command, false, value);
    emitSanitizedChange();
    window.requestAnimationFrame(refreshToolbarState);
  }, [disabled, emitSanitizedChange, refreshToolbarState, restoreSavedSelection]);

  const insertHtmlAtSelection = React.useCallback((html: string) => {
    if (disabled || typeof document === 'undefined') {
      return;
    }

    restoreSavedSelection();
    document.execCommand('insertHTML', false, html);
    emitSanitizedChange();
    window.requestAnimationFrame(refreshToolbarState);
  }, [disabled, emitSanitizedChange, refreshToolbarState, restoreSavedSelection]);

  const handleImageInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const dataUrl = await readImageFileAsDataUrl(file);
    const imageHtml = [
      '<figure class="cm-editor-image">',
      `<img src="${escapeHtmlAttribute(dataUrl)}" alt="${escapeHtmlAttribute(file.name || 'Figura de apoio')}" loading="lazy" />`,
      '</figure>',
      '<p><br /></p>',
    ].join('');
    insertHtmlAtSelection(imageHtml);
  };

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setColor(event.target.value);
    execCommand('foreColor', event.target.value);
  };

  const handleHighlightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightColor(event.target.value);
    execCommand('hiliteColor', event.target.value);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || typeof document === 'undefined') {
      return;
    }

    const plainText = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, plainText);
    emitSanitizedChange();
  };

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const normalizedInitialValue = normalizeQuestionRichHtml(initialValue);
    if (normalizedInitialValue === lastSyncedHtmlRef.current) {
      return;
    }

    contentRef.current.innerHTML = normalizedInitialValue;
    lastSyncedHtmlRef.current = normalizedInitialValue;
  }, [initialValue]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    document.addEventListener('selectionchange', refreshToolbarState);
    return () => document.removeEventListener('selectionchange', refreshToolbarState);
  }, [refreshToolbarState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    if (!stickyToolbar) {
      frameId = window.requestAnimationFrame(() => setFloatingToolbar(null));
      return () => window.cancelAnimationFrame(frameId);
    }

    const updateToolbarPosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const editorShell = editorShellRef.current;
        const anchor = toolbarAnchorRef.current;
        const toolbar = toolbarRef.current;
        if (!editorShell || !anchor || !toolbar) {
          setFloatingToolbar(null);
          return;
        }

        const shellRect = editorShell.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const toolbarHeight = toolbar.offsetHeight || anchorRect.height;
        const shouldFloat = anchorRect.top <= FLOATING_TOOLBAR_TOP_OFFSET && shellRect.bottom > toolbarHeight + FLOATING_TOOLBAR_TOP_OFFSET;

        if (!shouldFloat) {
          setFloatingToolbar(null);
          return;
        }

        setFloatingToolbar((current) => {
          const next = {
            active: true,
            left: anchorRect.left,
            width: anchorRect.width,
            height: toolbarHeight,
          };

          if (
            current?.active
            && Math.abs(current.left - next.left) < 0.5
            && Math.abs(current.width - next.width) < 0.5
            && Math.abs(current.height - next.height) < 0.5
          ) {
            return current;
          }

          return next;
        });
      });
    };

    updateToolbarPosition();
    window.addEventListener('scroll', updateToolbarPosition, true);
    window.addEventListener('resize', updateToolbarPosition);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', updateToolbarPosition, true);
      window.removeEventListener('resize', updateToolbarPosition);
    };
  }, [stickyToolbar]);

  return (
    <div ref={editorShellRef} className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900">
      <div ref={toolbarAnchorRef} style={floatingToolbar?.active ? { height: floatingToolbar.height } : undefined}>
      <div
        ref={toolbarRef}
        className={`z-50 flex flex-nowrap items-center gap-0.5 overflow-x-auto rounded-t-xl border-b border-slate-100 bg-slate-50/95 p-1.5 shadow-sm backdrop-blur transition-colors dark:border-slate-800 dark:bg-slate-900/95 sm:flex-wrap sm:gap-1 sm:p-2 ${
          floatingToolbar?.active ? 'fixed rounded-xl border border-slate-200 dark:border-slate-700' : ''
        }`}
        style={floatingToolbar?.active ? {
          top: FLOATING_TOOLBAR_TOP_OFFSET,
          left: floatingToolbar.left,
          width: floatingToolbar.width,
        } : undefined}
      >
        <ToolbarButton icon={Bold} command="bold" title="Negrito" active={activeCommands.bold} disabled={disabled} onCommand={execCommand} />
        <ToolbarButton icon={Italic} command="italic" title="Itálico" active={activeCommands.italic} disabled={disabled} onCommand={execCommand} />
        <ToolbarButton icon={Underline} command="underline" title="Sublinhado" active={activeCommands.underline} disabled={disabled} onCommand={execCommand} />

        <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-300 transition-colors dark:bg-slate-700 sm:mx-1" />

        <ToolbarButton icon={Pilcrow} command="formatBlock" value="P" title="Paragrafo" active={activeBlock === 'P'} disabled={disabled} onCommand={execCommand} />
        <ToolbarButton icon={Heading1} command="formatBlock" value="H3" title="Titulo" active={activeBlock === 'H3'} disabled={disabled} onCommand={execCommand} />
        <ToolbarButton icon={Heading2} command="formatBlock" value="H4" title="Subtitulo" active={activeBlock === 'H4'} disabled={disabled} onCommand={execCommand} />
        <ToolbarButton icon={Quote} command="formatBlock" value="BLOCKQUOTE" title="Citacao" active={activeBlock === 'BLOCKQUOTE'} disabled={disabled} onCommand={execCommand} />

        <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-300 transition-colors dark:bg-slate-700 sm:mx-1" />

        <ToolbarButton icon={List} command="insertUnorderedList" title="Lista" active={activeCommands.insertUnorderedList} disabled={disabled} onCommand={execCommand} />

        <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-300 transition-colors dark:bg-slate-700 sm:mx-1" />

        {allowImages && (
          <>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
                saveCurrentSelection();
              }}
              onClick={() => imageInputRef.current?.click()}
              title="Inserir imagem no texto"
              aria-label="Inserir imagem no texto"
              className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 sm:p-1.5"
            >
              <ImagePlus size={16} />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageInputChange}
            />
            <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-300 transition-colors dark:bg-slate-700 sm:mx-1" />
          </>
        )}

        <div className={`group relative flex shrink-0 items-center gap-1 rounded-lg px-0.5 py-0.5 transition-colors sm:px-1 ${
          color !== '#000000' ? 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30' : ''
        }`}>
          <Type size={16} className="ml-1 text-slate-500 transition-colors dark:text-slate-400" />
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            disabled={disabled}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
            title="Cor do texto"
            aria-label="Cor do texto"
          />
        </div>

        <div className={`group relative flex shrink-0 items-center gap-1 rounded-lg px-0.5 py-0.5 transition-colors sm:px-1 ${
          highlightColor !== '#fef08a' ? 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30' : ''
        }`}>
          <Highlighter size={16} className="ml-1 text-slate-500 transition-colors dark:text-slate-400" />
          <input
            type="color"
            value={highlightColor}
            onChange={handleHighlightChange}
            disabled={disabled}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
            title="Marca-texto"
            aria-label="Marca-texto"
          />
        </div>

        <ToolbarButton icon={Eraser} command="removeFormat" title="Limpar formatação" disabled={disabled} onCommand={execCommand} />

        <div className="min-w-2 flex-1" />

        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            if (!contentRef.current || disabled) {
              return;
            }

            contentRef.current.innerHTML = '';
            lastSyncedHtmlRef.current = '';
            onChange('');
          }}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 sm:p-1.5"
          title="Limpar tudo"
          aria-label="Limpar tudo"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      </div>

      <div
        ref={contentRef}
        contentEditable={!disabled}
        data-placeholder={placeholder || ''}
        onInput={emitSanitizedChange}
        onFocus={refreshToolbarState}
        onKeyUp={refreshToolbarState}
        onMouseUp={refreshToolbarState}
        onPaste={handlePaste}
        aria-disabled={disabled}
        className={`rich-text-editor-content question-rich-html max-h-64 min-h-[96px] overflow-y-auto p-3 text-sm text-slate-700 outline-none transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-70 dark:text-slate-300 sm:min-h-[112px] sm:p-4 ${contentClassName}`}
        style={{ whiteSpace: 'pre-wrap' }}
      />

      <style>{`
        .rich-text-editor-content:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          opacity: 0.6;
          pointer-events: none;
        }
        .dark .rich-text-editor-content:empty:before {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default React.memo(RichTextEditor);
