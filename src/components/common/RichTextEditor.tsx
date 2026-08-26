'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
    Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered, Link, Image as ImageIcon, Table as TableIcon,
    Palette, Highlighter, Minus, Quote, RemoveFormatting, Upload, X
} from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
}

const FONT_FAMILIES = [
    { name: 'Default (Sans)', value: 'sans-serif' },
    { name: 'Lexend / Modern', value: 'Lexend, sans-serif' },
    { name: 'Serif / Classic', value: 'Georgia, serif' },
    { name: 'Monospace / Code', value: 'monospace' },
    { name: 'Cursive / Handwriting', value: 'cursive' }
];

const FONT_SIZES = [
    { name: 'Small (12px)', value: '12px' },
    { name: 'Normal (14px)', value: '14px' },
    { name: 'Medium (16px)', value: '16px' },
    { name: 'Large (20px)', value: '20px' },
    { name: 'Extra Large (24px)', value: '24px' },
    { name: 'Huge (30px)', value: '30px' }
];

const TEXT_COLORS = [
    { name: 'Dark Slate', value: '#1e293b' },
    { name: 'KFA Amber', value: '#d97706' },
    { name: 'Emerald Green', value: '#059669' },
    { name: 'Deep Blue', value: '#2563eb' },
    { name: 'Rose Red', value: '#e11d48' },
    { name: 'Purple', value: '#7c3aed' },
    { name: 'Teal', value: '#0d9488' }
];

const HIGHLIGHT_COLORS = [
    { name: 'Transparent', value: 'transparent' },
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Orange', value: '#fed7aa' }
];

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write message content here...',
    minHeight = '180px'
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isInternalChange = useRef(false);

    const [showImageModal, setShowImageModal] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [imageCaption, setImageCaption] = useState('');

    const [showTableModal, setShowTableModal] = useState(false);
    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);

    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);

    // Initial content setup
    useEffect(() => {
        if (editorRef.current && !isInternalChange.current) {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value || '';
            }
        }
        isInternalChange.current = false;
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            isInternalChange.current = true;
            onChange(editorRef.current.innerHTML);
        }
    };

    const executeCmd = (command: string, valueArg: string | undefined = undefined) => {
        document.execCommand(command, false, valueArg);
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    const applyFontSize = (size: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const span = document.createElement('span');
        span.style.fontSize = size;
        span.appendChild(range.extractContents());
        range.insertNode(span);

        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    const applyFontFamily = (font: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const span = document.createElement('span');
        span.style.fontFamily = font;
        span.appendChild(range.extractContents());
        range.insertNode(span);

        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    const insertLink = () => {
        const url = prompt('Enter web link / URL:', 'https://');
        if (url && url !== 'https://') {
            executeCmd('createLink', url);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
                insertImageHtml(base64, file.name);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const insertImageHtml = (src: string, captionStr?: string) => {
        const imgHtml = `
            <figure style="margin: 14px 0; text-align: center; display: inline-block; max-width: 100%;">
                <img src="${src}" alt="Attachment" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: block;" />
                ${captionStr ? `<figcaption style="font-size: 11px; color: #64748b; margin-top: 6px; font-style: italic;">${captionStr}</figcaption>` : ''}
            </figure>
            <p><br/></p>
        `;
        executeCmd('insertHTML', imgHtml);
        setShowImageModal(false);
        setImageUrlInput('');
        setImageCaption('');
    };

    const confirmInsertTable = () => {
        const r = Math.max(1, Math.min(tableRows, 15));
        const c = Math.max(1, Math.min(tableCols, 10));

        let tableHtml = `<div style="overflow-x: auto; margin: 14px 0;"><table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 13px;">`;
        tableHtml += `<thead><tr style="background-color: #f1f5f9;">`;
        for (let j = 0; j < c; j++) {
            tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 700; color: #1e293b; text-align: left;">Header ${j + 1}</th>`;
        }
        tableHtml += `</tr></thead><tbody>`;
        for (let i = 0; i < r; i++) {
            tableHtml += `<tr>`;
            for (let j = 0; j < c; j++) {
                tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #334155;">Data ${i + 1}-${j + 1}</td>`;
            }
            tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table></div><p><br/></p>`;

        executeCmd('insertHTML', tableHtml);
        setShowTableModal(false);
    };

    const handlePasteCanvas = (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        if (imageItem) {
            e.preventDefault();
            const file = imageItem.getAsFile();
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    if (base64) {
                        insertImageHtml(base64, file.name);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleDropCanvas = (e: React.DragEvent) => {
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    if (base64) {
                        insertImageHtml(base64, file.name);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 shadow-2xs">
            {/* Toolbar */}
            <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300 text-xs select-none">
                
                {/* Font Family Dropdown */}
                <select
                    onChange={(e) => applyFontFamily(e.target.value)}
                    className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
                    defaultValue="sans-serif"
                    title="Font Family"
                >
                    {FONT_FAMILIES.map(f => (
                        <option key={f.value} value={f.value}>{f.name}</option>
                    ))}
                </select>

                {/* Font Size Dropdown */}
                <select
                    onChange={(e) => applyFontSize(e.target.value)}
                    className="h-8 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer"
                    defaultValue="14px"
                    title="Font Size"
                >
                    {FONT_SIZES.map(s => (
                        <option key={s.value} value={s.value}>{s.name}</option>
                    ))}
                </select>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Text Formatting */}
                <button
                    type="button"
                    onClick={() => executeCmd('bold')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('italic')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('underline')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Underline (Ctrl+U)"
                >
                    <Underline className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('strikeThrough')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Colors */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
                        className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-0.5"
                        title="Text Color"
                    >
                        <Palette className="w-4 h-4 text-amber-600" />
                    </button>

                    {showColorPicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 flex gap-1.5">
                            {TEXT_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => { executeCmd('foreColor', c.value); setShowColorPicker(false); }}
                                    className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
                        className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-0.5"
                        title="Highlight Color"
                    >
                        <Highlighter className="w-4 h-4 text-emerald-600" />
                    </button>

                    {showHighlightPicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 flex gap-1.5">
                            {HIGHLIGHT_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => { executeCmd('hiliteColor', c.value); setShowHighlightPicker(false); }}
                                    className="w-5 h-5 rounded-full border border-slate-300 hover:scale-110 transition-transform flex items-center justify-center text-[9px] font-bold"
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                >
                                    {c.value === 'transparent' ? '✕' : ''}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Alignments */}
                <button
                    type="button"
                    onClick={() => executeCmd('justifyLeft')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Align Left"
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('justifyCenter')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Align Center"
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('justifyRight')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Align Right"
                >
                    <AlignRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Lists & Quote */}
                <button
                    type="button"
                    onClick={() => executeCmd('insertUnorderedList')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('insertOrderedList')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => executeCmd('formatBlock', 'blockquote')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Quote Block"
                >
                    <Quote className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Rich Media Inserts */}
                <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    className="p-1.5 hover:bg-[#ecb613]/20 hover:text-[#ecb613] rounded-md transition-colors font-bold flex items-center gap-1"
                    title="Insert Image"
                >
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-bold">Image</span>
                </button>

                <button
                    type="button"
                    onClick={() => setShowTableModal(true)}
                    className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-600 rounded-md transition-colors font-bold flex items-center gap-1"
                    title="Insert Table"
                >
                    <TableIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-bold">Table</span>
                </button>

                <button
                    type="button"
                    onClick={insertLink}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Insert Link"
                >
                    <Link className="w-4 h-4 text-cyan-600" />
                </button>

                <button
                    type="button"
                    onClick={() => executeCmd('insertHorizontalRule')}
                    className="p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title="Horizontal Line"
                >
                    <Minus className="w-4 h-4" />
                </button>

                <button
                    type="button"
                    onClick={() => executeCmd('removeFormat')}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 rounded-md transition-colors"
                    title="Clear Formatting"
                >
                    <RemoveFormatting className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Hidden File Input for Image Upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
            />

            {/* Editable Canvas */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onPaste={handlePasteCanvas}
                onDrop={handleDropCanvas}
                className="p-4 text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-200 outline-none overflow-y-auto focus:ring-0 select-text"
                style={{ minHeight, fontFamily: 'Lexend, sans-serif' }}
                data-placeholder={placeholder}
            />

            {/* Image Modal */}
            {showImageModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-blue-600" />
                                Attach & Insert Image
                            </h4>
                            <button onClick={() => setShowImageModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">Upload Image File</label>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 transition-all font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4 text-blue-600" /> Choose Image from Device
                                </button>
                            </div>

                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                                <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase">OR Image URL</span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">Image Web Link (URL)</label>
                                <input
                                    type="url"
                                    placeholder="https://example.com/image.png"
                                    value={imageUrlInput}
                                    onChange={(e) => setImageUrlInput(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">Image Caption (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Flute Fingering Chart"
                                    value={imageCaption}
                                    onChange={(e) => setImageCaption(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowImageModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!imageUrlInput.trim()}
                                onClick={() => insertImageHtml(imageUrlInput, imageCaption)}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-40"
                            >
                                Insert Image
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Modal */}
            {showTableModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <TableIcon className="w-5 h-5 text-emerald-600" />
                                Insert Grid Table
                            </h4>
                            <button onClick={() => setShowTableModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">Number of Rows</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="15"
                                    value={tableRows}
                                    onChange={(e) => setTableRows(parseInt(e.target.value, 10) || 1)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none font-bold"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">Number of Columns</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={tableCols}
                                    onChange={(e) => setTableCols(parseInt(e.target.value, 10) || 1)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none font-bold"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowTableModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmInsertTable}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                            >
                                Insert Table
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
