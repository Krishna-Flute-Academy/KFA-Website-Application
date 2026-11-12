'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';

export interface StudentActionMenuStudent {
    id: string;
    name: string;
    status: string;
}

export interface StudentActionMenuProps {
    isOpen: boolean;
    triggerEl: HTMLElement | null;
    student: StudentActionMenuStudent | null;
    isAdmin: boolean;
    onClose: (restoreFocus?: boolean) => void;
    onSendMessage: (student: StudentActionMenuStudent) => void;
    onAddGuidance: (student: StudentActionMenuStudent) => void;
    onPause: (student: StudentActionMenuStudent) => void;
    onResume: (student: StudentActionMenuStudent) => void;
    onArchive: (student: StudentActionMenuStudent) => void;
    onReactivate: (student: StudentActionMenuStudent) => void;
    onDelete: (student: StudentActionMenuStudent) => void;
}

interface MenuCoords {
    top: number;
    left: number;
    maxHeight: number;
    placement: 'top' | 'bottom';
}

const MENU_WIDTH = 208; // w-52
const VIEWPORT_PADDING = 12;
const TRIGGER_GAP = 6;
const MIN_MENU_HEIGHT = 140;
const DEFAULT_ESTIMATED_HEIGHT = 304;

export const StudentActionMenu: React.FC<StudentActionMenuProps> = ({
    isOpen,
    triggerEl,
    student,
    isAdmin,
    onClose,
    onSendMessage,
    onAddGuidance,
    onPause,
    onResume,
    onArchive,
    onReactivate,
    onDelete,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<MenuCoords | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updatePosition = useCallback(() => {
        if (!triggerEl || typeof window === 'undefined') return;

        const rect = triggerEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Close if trigger scrolled completely out of the viewport
        if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
            onClose(false);
            return;
        }

        const menuEl = menuRef.current;
        const measuredHeight = menuEl
            ? Math.max(menuEl.scrollHeight, menuEl.offsetHeight, 120)
            : DEFAULT_ESTIMATED_HEIGHT;

        const spaceBelow = vh - rect.bottom - TRIGGER_GAP - VIEWPORT_PADDING;
        const spaceAbove = rect.top - TRIGGER_GAP - VIEWPORT_PADDING;

        let placement: 'top' | 'bottom' = 'bottom';
        let maxHeight: number;
        let top: number;

        if (spaceBelow >= measuredHeight || spaceBelow >= spaceAbove) {
            placement = 'bottom';
            maxHeight = Math.max(MIN_MENU_HEIGHT, spaceBelow);
            const renderedHeight = Math.min(measuredHeight, maxHeight);
            top = Math.min(
                vh - VIEWPORT_PADDING - renderedHeight,
                Math.max(VIEWPORT_PADDING, rect.bottom + TRIGGER_GAP)
            );
        } else {
            placement = 'top';
            maxHeight = Math.max(MIN_MENU_HEIGHT, spaceAbove);
            const renderedHeight = Math.min(measuredHeight, maxHeight);
            top = Math.max(VIEWPORT_PADDING, rect.top - renderedHeight - TRIGGER_GAP);
        }

        // Align right edge with trigger right edge, then shift inside viewport bounds
        let left = rect.right - MENU_WIDTH;
        if (left + MENU_WIDTH > vw - VIEWPORT_PADDING) {
            left = vw - MENU_WIDTH - VIEWPORT_PADDING;
        }
        if (left < VIEWPORT_PADDING) {
            left = VIEWPORT_PADDING;
        }

        setCoords({ top, left, maxHeight, placement });
    }, [triggerEl, onClose]);

    useLayoutEffect(() => {
        if (!isOpen || !triggerEl || !student) {
            setCoords(null);
            return;
        }
        updatePosition();
    }, [isOpen, triggerEl, student, updatePosition]);

    useEffect(() => {
        if (!isOpen || !triggerEl) return;

        // Focus menu container so keyboard navigation (ArrowDown/Up/Escape) works immediately
        const rafId = requestAnimationFrame(() => {
            menuRef.current?.focus({ preventScroll: true });
        });

        const handleScrollOrResize = () => updatePosition();

        const handlePointerDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current &&
                !menuRef.current.contains(target) &&
                !triggerEl.contains(target)
            ) {
                onClose(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose(true);
                return;
            }

            if (e.key === 'Tab') {
                onClose(false);
                return;
            }

            const menuEl = menuRef.current;
            if (!menuEl) return;

            const items = Array.from(
                menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]')
            );
            if (items.length === 0) return;

            const currentIndex = items.indexOf(document.activeElement as HTMLElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
                items[nextIndex]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex =
                    currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                items[prevIndex]?.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                items[0]?.focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                items[items.length - 1]?.focus();
            }
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, triggerEl, updatePosition, onClose]);

    if (!mounted || !isOpen || !student || !triggerEl) return null;

    const itemClass =
        'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 focus:outline-none transition-colors text-left cursor-pointer';

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            aria-label={`Actions for ${student.name}`}
            data-placement={coords?.placement ?? 'bottom'}
            style={{
                position: 'fixed',
                top: coords ? `${coords.top}px` : '-9999px',
                left: coords ? `${coords.left}px` : '-9999px',
                width: `${MENU_WIDTH}px`,
                maxHeight: coords ? `${coords.maxHeight}px` : `${DEFAULT_ESTIMATED_HEIGHT}px`,
                zIndex: 99999,
                opacity: coords ? 1 : 0,
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 overflow-y-auto focus:outline-none text-left pointer-events-auto"
        >
            <Link
                href={`/teacher-dashboard/students/${student.id}`}
                role="menuitem"
                tabIndex={-1}
                onClick={() => onClose(false)}
                className={itemClass}
            >
                <span className="material-symbols-outlined text-base text-slate-400">visibility</span>
                View Profile
            </Link>
            <Link
                href={`/teacher-dashboard/students/${student.id}/edit`}
                role="menuitem"
                tabIndex={-1}
                onClick={() => onClose(false)}
                className={itemClass}
            >
                <span className="material-symbols-outlined text-base text-slate-400">edit</span>
                Edit Student
            </Link>
            <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                    onClose(false);
                    onSendMessage(student);
                }}
                className={itemClass}
            >
                <span className="material-symbols-outlined text-base text-slate-400">chat</span>
                Send Message
            </button>
            <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                    onClose(false);
                    onAddGuidance(student);
                }}
                className={itemClass}
            >
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                Add Guidance Note
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" role="separator" />

            {student.status === 'Active' ? (
                <>
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => {
                            onClose(false);
                            onPause(student);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 focus:bg-amber-50 dark:focus:bg-amber-950/30 focus:outline-none transition-colors text-left cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">pause_circle</span>
                        Pause Learning
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => {
                            onClose(false);
                            onArchive(student);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 focus:outline-none transition-colors text-left cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">archive</span>
                        Archive Student
                    </button>
                </>
            ) : student.status === 'Inactive' ? (
                <>
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => {
                            onClose(false);
                            onResume(student);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 focus:outline-none transition-colors text-left cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">play_circle</span>
                        Resume Learning
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => {
                            onClose(false);
                            onArchive(student);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 focus:outline-none transition-colors text-left cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">archive</span>
                        Archive Student
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                        onClose(false);
                        onReactivate(student);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 focus:outline-none transition-colors text-left cursor-pointer"
                >
                    <span className="material-symbols-outlined text-base">unarchive</span>
                    Re-enroll Student
                </button>
            )}

            {isAdmin && (
                <>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" role="separator" />
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => {
                            onClose(false);
                            onDelete(student);
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 focus:bg-rose-50 dark:focus:bg-rose-950/30 focus:outline-none transition-colors text-left cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Delete Student
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};
