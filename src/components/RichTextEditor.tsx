'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { LineHeight } from '../lib/tiptap-extensions';
import { 
    Bold, Italic, Underline as UnderlineIcon, Type,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Highlighter
} from 'lucide-react';

// Custom Font Size extension
const FontSize = Extension.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize || null,
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ commands }) => {
                return commands.setMark('textStyle', { fontSize });
            },
            unsetFontSize: () => ({ commands }) => {
                return commands.setMark('textStyle', { fontSize: null });
            },
        } as any;
    },
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
        lineHeight: {
            setLineHeight: (height: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

interface RichTextEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
                },
            }),
            FontSize.configure(),
            LineHeight.configure({
                types: ['heading', 'paragraph'],
                defaultLineHeight: 'normal',
            }),
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert focus:outline-none max-w-none p-4 min-h-[140px] max-h-[300px] overflow-y-auto leading-relaxed text-slate-800 dark:text-slate-200 text-xs md:text-sm font-medium border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-xl bg-white dark:bg-slate-950',
                placeholder: placeholder || '',
            },
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [value, editor]);

    const getActiveFontSize = () => {
        const size = editor.getAttributes('textStyle').fontSize;
        if (size) {
            return parseInt(size, 10);
        }
        return 14;
    };

    const changeFontSize = (delta: number) => {
        const currentSize = getActiveFontSize();
        const newSize = Math.max(8, Math.min(72, currentSize + delta));
        editor.chain().focus().setFontSize(`${newSize}px`).run();
    };

    if (!editor) return null;

    const colors = ['#000000', '#EE4444', '#22AA55', '#3366FF', '#FF9900', '#9933FF'];

    return (
        <div className="flex flex-col rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 rounded-t-xl select-none">
                <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        disabled={!editor.can().chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('bold') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Bold"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        disabled={!editor.can().chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('italic') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Italic"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('underline') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Underline"
                    >
                        <UnderlineIcon size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        disabled={!editor.can().chain().focus().toggleStrike().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('strike') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Strike"
                    >
                        <Type size={14} className="line-through" />
                    </button>
                </div>

                <div className="flex items-center gap-0.5 px-1 border-r border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1 px-1.5 text-xs font-bold rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Heading 2"
                    >
                        H2
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={`p-1 px-1.5 text-xs font-bold rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Heading 3"
                    >
                        H3
                    </button>
                </div>

                <div className="flex items-center gap-0.5 px-1 border-r border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => changeFontSize(-2)}
                        className="p-1 px-1.5 text-xs font-black rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Decrease Font Size"
                    >
                        A-
                    </button>
                    <input
                        type="number"
                        min={8}
                        max={72}
                        value={getActiveFontSize()}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 8 && val <= 72) {
                                editor.chain().focus().setFontSize(`${val}px`).run();
                            }
                        }}
                        className="w-8 text-center text-xs font-extrabold bg-transparent border-0 focus:ring-0 select-all p-0 text-slate-700 dark:text-slate-350"
                        title="Font Size (px)"
                    />
                    <button
                        type="button"
                        onClick={() => changeFontSize(2)}
                        className="p-1 px-1.5 text-xs font-black rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                        title="Increase Font Size"
                    >
                        A+
                    </button>
                </div>

                <div className="flex items-center gap-1 px-1 border-r border-slate-200 dark:border-slate-700">
                    <span className="text-[9px] font-black text-slate-400 uppercase mr-1 select-none">Line Spacing</span>
                    <select
                        onChange={e => editor.chain().focus().setLineHeight(e.target.value).run()}
                        value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || 'normal'}
                        className="bg-transparent border-0 text-[10px] font-bold text-slate-700 dark:text-slate-350 p-0 focus:ring-0 cursor-pointer outline-none bg-slate-50 dark:bg-slate-900 pr-4"
                    >
                        <option value="normal">Default</option>
                        <option value="1.0">Single (1.0)</option>
                        <option value="1.2">Tighter (1.2)</option>
                        <option value="1.4">Medium (1.4)</option>
                        <option value="1.6">Relaxed (1.6)</option>
                        <option value="2.0">Double (2.0)</option>
                    </select>
                </div>

                <div className="flex items-center gap-0.5 px-1 border-r border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('bulletList') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Bullet List"
                    >
                        <List size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('orderedList') ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Ordered List"
                    >
                        <ListOrdered size={14} />
                    </button>
                </div>

                <div className="flex items-center gap-0.5 px-1 border-r border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Align Left"
                    >
                        <AlignLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Align Center"
                    >
                        <AlignCenter size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-[#ecb613]/25 text-[#d8a310] dark:text-[#ecb613] font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Align Right"
                    >
                        <AlignRight size={14} />
                    </button>
                </div>

                <div className="flex items-center gap-1 pl-1.5">
                    {colors.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => editor.chain().focus().setColor(color).run()}
                            className="p-0.5 group relative"
                            title={`Color: ${color}`}
                        >
                            <div
                                className={`w-3 h-3 rounded-full border border-slate-300 dark:border-slate-700 transition-transform ${editor.getAttributes('textStyle').color === color ? 'scale-125 ring-2 ring-amber-300 dark:ring-amber-500' : 'hover:scale-110'}`}
                                style={{ backgroundColor: color }}
                            />
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${editor.isActive('highlight') ? 'bg-yellow-100 dark:bg-yellow-900/35 text-yellow-700 dark:text-yellow-300' : 'text-slate-600 dark:text-slate-400'}`}
                        title="Highlight"
                    >
                        <Highlighter size={13} />
                    </button>
                </div>
            </div>

            {/* Editor Content Area */}
            <EditorContent editor={editor} />
        </div>
    );
}
