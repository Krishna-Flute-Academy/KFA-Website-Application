'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import { LineHeight } from '../lib/tiptap-extensions';
import { supabaseAuth } from '../lib/supabase-auth';
import { 
    Bold, Italic, Underline as UnderlineIcon, Type,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Highlighter, Image as ImageIcon, Upload, X, Link as LinkIcon, Loader2
} from 'lucide-react';

const sanitizeFileName = (originalName: string): string => {
    return originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 40);
};

const getUniqueStoragePath = (file: File): string => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanName = sanitizeFileName(file.name) || 'image';
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    return `course-lessons/${uuid}-${cleanName}.${ext}`;
};

const uploadEditorImage = async (file: File): Promise<string> => {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Please upload a valid image file (PNG, JPG, WEBP, GIF, SVG).');
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
        throw new Error('Image size is too large (maximum allowed size is 10MB).');
    }

    const filePath = getUniqueStoragePath(file);
    let uploadBucket = 'inventory_materials';

    let { data, error } = await supabaseAuth.storage
        .from(uploadBucket)
        .upload(filePath, file, {
            contentType: file.type || 'image/jpeg',
            upsert: true
        });

    if (error) {
        console.warn(`[RichTextEditor] Upload to ${uploadBucket} failed:`, error.message, '- attempting fallback bucket');
        uploadBucket = 'curriculum-images';
        const fallbackRes = await supabaseAuth.storage
            .from(uploadBucket)
            .upload(filePath, file, {
                contentType: file.type || 'image/jpeg',
                upsert: true
            });

        if (fallbackRes.error) {
            throw new Error(`Failed to upload image to storage: ${error.message || fallbackRes.error.message}`);
        }
    }

    const { data: urlData } = supabaseAuth.storage
        .from(uploadBucket)
        .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
        throw new Error('Failed to retrieve public URL for uploaded image.');
    }

    return urlData.publicUrl;
};

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);

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
            ImageExtension.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-xl border border-slate-200 dark:border-slate-700 my-2 shadow-xs inline-block',
                },
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
            handlePaste: (view, event) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));
                if (imageItem) {
                    event.preventDefault();
                    const file = imageItem.getAsFile();
                    if (file && editor) {
                        setIsUploadingImage(true);
                        uploadEditorImage(file)
                            .then((url) => {
                                if (editor && !editor.isDestroyed) {
                                    editor.chain().focus().setImage({ src: url }).run();
                                }
                            })
                            .catch((err: any) => {
                                console.error('[RichTextEditor] Paste upload failed:', err);
                                alert(`Image upload failed: ${err.message || 'Unknown error'}`);
                            })
                            .finally(() => {
                                setIsUploadingImage(false);
                            });
                    }
                    return true;
                }
                return false;
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        if (editor) {
                            setIsUploadingImage(true);
                            uploadEditorImage(file)
                                .then((url) => {
                                    if (editor && !editor.isDestroyed) {
                                        editor.chain().focus().setImage({ src: url }).run();
                                    }
                                })
                                .catch((err: any) => {
                                    console.error('[RichTextEditor] Drop upload failed:', err);
                                    alert(`Image upload failed: ${err.message || 'Unknown error'}`);
                                })
                                .finally(() => {
                                    setIsUploadingImage(false);
                                });
                        }
                        return true;
                    }
                }
                return false;
            }
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [value, editor]);

    const getActiveFontSize = () => {
        if (!editor) return 14;
        const size = editor.getAttributes('textStyle').fontSize;
        if (size) {
            return parseInt(size, 10);
        }
        return 14;
    };

    const changeFontSize = (delta: number) => {
        if (!editor) return;
        const currentSize = getActiveFontSize();
        const newSize = Math.max(8, Math.min(72, currentSize + delta));
        editor.chain().focus().setFontSize(`${newSize}px`).run();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor) return;
        
        setIsUploadingImage(true);
        try {
            const url = await uploadEditorImage(file);
            if (editor && !editor.isDestroyed) {
                editor.chain().focus().setImage({ src: url }).run();
            }
            setShowImageModal(false);
        } catch (err: any) {
            console.error('[RichTextEditor] File upload error:', err);
            alert(`Image upload failed: ${err.message || 'Unknown error'}`);
        } finally {
            setIsUploadingImage(false);
            e.target.value = '';
        }
    };

    const insertImageUrl = () => {
        if (imageUrlInput.trim() && editor) {
            editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
            setImageUrlInput('');
            setShowImageModal(false);
        }
    };

    if (!editor) return null;

    const colors = ['#000000', '#EE4444', '#22AA55', '#3366FF', '#FF9900', '#9933FF'];

    return (
        <div className="flex flex-col rounded-xl overflow-hidden relative">
            {/* Hidden File Input for Image Upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
            />

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

                <div className="flex items-center gap-1 px-1 border-r border-slate-200 dark:border-slate-700">
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

                {/* Insert Image Button */}
                <div className="flex items-center gap-0.5 pl-1">
                    <button
                        type="button"
                        onClick={() => setShowImageModal(true)}
                        className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-slate-600 dark:text-slate-400`}
                        title="Insert Image (or paste with Ctrl+V / Cmd+V)"
                    >
                        <ImageIcon size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-bold">Image</span>
                    </button>
                </div>
            </div>

            {/* Editor Content Area */}
            <div className="relative">
                {isUploadingImage && (
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg animate-pulse pointer-events-none">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading Image to Storage...</span>
                    </div>
                )}
                <EditorContent editor={editor} />
            </div>

            {/* Image Upload/Link Modal */}
            {showImageModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm animate-in zoom-in-95 duration-200 text-left">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-amber-500" />
                                Insert Picture into Description
                            </h4>
                            <button 
                                type="button" 
                                disabled={isUploadingImage}
                                onClick={() => setShowImageModal(false)} 
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">1. Upload Image File</label>
                                <button
                                    type="button"
                                    disabled={isUploadingImage}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3 bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-amber-400 rounded-xl transition-all font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isUploadingImage ? (
                                        <>
                                            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" /> Uploading to Storage...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 text-amber-500" /> Pick Image from Computer
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                                <span className="flex-shrink mx-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">OR Paste Image URL</span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">2. Image Link (URL)</label>
                                <div className="relative">
                                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="url"
                                        disabled={isUploadingImage}
                                        placeholder="https://example.com/image.png"
                                        value={imageUrlInput}
                                        onChange={(e) => setImageUrlInput(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500/20 font-medium disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={isUploadingImage}
                                onClick={() => setShowImageModal(false)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!imageUrlInput.trim() || isUploadingImage}
                                onClick={insertImageUrl}
                                className="px-4 py-1.5 bg-[#ecb613] hover:bg-[#d8a310] text-slate-950 text-xs font-black rounded-xl transition-all shadow-xs disabled:opacity-40"
                            >
                                Insert Image
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
