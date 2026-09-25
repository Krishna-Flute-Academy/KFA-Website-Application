'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit3, Trash2, ShieldAlert } from 'lucide-react';

interface CommunityActionMenuProps {
    isAuthor: boolean;
    isAdmin: boolean;
    itemType: 'post' | 'reply';
    onEdit?: () => void;
    onDelete: (isAdminDelete: boolean) => void;
    className?: string;
}

export default function CommunityActionMenu({
    isAuthor,
    isAdmin,
    itemType,
    onEdit,
    onDelete,
    className = ''
}: CommunityActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // If not author and not admin, no actions to show
    if (!isAuthor && !isAdmin) {
        return null;
    }

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                aria-label="Actions"
                aria-expanded={isOpen}
            >
                <MoreVertical className="w-4 h-4" />
            </button>

            {isOpen && (
                <div 
                    className="absolute right-0 mt-1 w-44 rounded-2xl bg-white dark:bg-[#1f1710] border border-amber-900/10 dark:border-amber-500/20 shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100"
                    role="menu"
                >
                    {/* Author actions */}
                    {isAuthor && onEdit && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                onEdit();
                            }}
                            className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                            role="menuitem"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{itemType === 'reply' ? 'Edit Reply' : 'Edit'}</span>
                        </button>
                    )}

                    {isAuthor && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                onDelete(false);
                            }}
                            className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            role="menuitem"
                        >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>{itemType === 'reply' ? 'Delete Reply' : 'Delete'}</span>
                        </button>
                    )}

                    {/* Admin action: only when NOT author */}
                    {isAdmin && !isAuthor && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                onDelete(true);
                            }}
                            className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            role="menuitem"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                            <span>Delete as Admin</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
