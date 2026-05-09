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

import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Type, List, RotateCcw, type LucideIcon } from 'lucide-react';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';

interface RichTextEditorProps {
  initialValue?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

type ToolbarButtonProps = {
  icon: LucideIcon;
  command: string;
  value?: string;
  active?: boolean;
  title: string;
  onCommand: (command: string, value?: string) => void;
};

const ToolbarButton = ({ icon: Icon, command, value, active = false, title, onCommand }: ToolbarButtonProps) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onCommand(command, value);
    }}
    title={title}
    className={`p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${active ? 'bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
  >
    <Icon size={16} />
  </button>
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialValue = '', onChange, placeholder }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#000000');

  const emitSanitizedChange = React.useCallback(() => {
    const editor = contentRef.current;
    if (!editor) {
      return;
    }

    const sanitizedHtml = normalizeQuestionRichHtml(editor.innerHTML);
    if (editor.innerHTML !== sanitizedHtml) {
      editor.innerHTML = sanitizedHtml;
    }

    onChange(sanitizedHtml);
  }, [onChange]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    emitSanitizedChange();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value);
    execCommand('foreColor', e.target.value);
  };

  const handleInput = () => {
    emitSanitizedChange();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const plainText = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, plainText);
    emitSanitizedChange();
  };

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    contentRef.current.innerHTML = normalizeQuestionRichHtml(initialValue);
  }, [initialValue]);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all transition-colors duration-300">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex-wrap transition-colors">
        <ToolbarButton icon={Bold} command="bold" title="Negrito" onCommand={execCommand} />
        <ToolbarButton icon={Italic} command="italic" title="Itálico" onCommand={execCommand} />
        <ToolbarButton icon={Underline} command="underline" title="Sublinhado" onCommand={execCommand} />

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 transition-colors" />

        <ToolbarButton icon={List} command="insertUnorderedList" title="Lista" onCommand={execCommand} />

        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 transition-colors" />

        <div className="flex items-center gap-1 group relative">
          <Type size={16} className="text-slate-500 dark:text-slate-400 ml-1 transition-colors" />
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
            title="Cor do Texto"
          />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (contentRef.current) {
              contentRef.current.innerHTML = '';
              onChange('');
            }
          }}
          className="text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Limpar tudo"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Editable Area */}
      <div
        ref={contentRef}
        contentEditable
        data-placeholder={placeholder || ''}
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-4 min-h-[100px] text-sm text-slate-700 dark:text-slate-300 outline-none max-h-64 overflow-y-auto transition-colors"
        style={{ whiteSpace: 'pre-wrap' }}
      />

      {/* Placeholder simulado via CSS se vazio */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          opacity: 0.6;
          pointer-events: none;
        }
        .dark [contenteditable]:empty:before {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default React.memo(RichTextEditor);
