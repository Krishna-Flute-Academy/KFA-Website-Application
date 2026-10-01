'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AtSign, Loader2, Sparkles } from 'lucide-react';
import { MentionSuggestion, searchCommunityMentionUsers } from '../../lib/community';

interface MentionTextareaProps {
    value: string;
    onChange: (val: string) => void;
    onMentionsChange?: (mentions: MentionSuggestion[]) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    id?: string;
    required?: boolean;
}

export default function MentionTextarea({
    value,
    onChange,
    onMentionsChange,
    placeholder = 'Type your message... use @ to mention someone',
    rows = 4,
    className = '',
    id,
    required
}: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionMatchStart, setMentionMatchStart] = useState<number>(-1);

    // Track users who have been selected
    const selectedUsersMapRef = useRef<Map<string, MentionSuggestion>>(new Map());

    // Synchronize parent on mentions change if mentioned names were deleted
    const syncMentionsToParent = useCallback(() => {
        if (!onMentionsChange) return;
        const validMentions: MentionSuggestion[] = [];
        selectedUsersMapRef.current.forEach(u => {
            if (value.includes(`@${u.displayName}`)) {
                validMentions.push(u);
            }
        });
        onMentionsChange(validMentions);
    }, [value, onMentionsChange]);

    useEffect(() => {
        syncMentionsToParent();
    }, [value, syncMentionsToParent]);

    // Debounced query execution
    useEffect(() => {
        if (!showSuggestions) return;

        let isCancelled = false;
        setIsSearching(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchCommunityMentionUsers(mentionQuery);
                if (!isCancelled) {
                    setSuggestions(results);
                    setSelectedIndex(0);
                }
            } catch (err) {
                if (!isCancelled) setSuggestions([]);
            } finally {
                if (!isCancelled) setIsSearching(false);
            }
        }, 220);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [mentionQuery, showSuggestions]);

    // Check cursor position for @ trigger
    const detectMentionTrigger = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionEnd;
        const textBeforeCursor = value.slice(0, cursorPos);

        // Matches @query at start of input or after whitespace
        // Query can contain letters, numbers, underscores, and single spaces up to 25 chars
        const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\s]{0,25})$/);

        if (match) {
            const query = match[1];
            // If the query has multiple spaces, do not trigger
            if ((query.match(/\s/g) || []).length > 1) {
                setShowSuggestions(false);
                return;
            }

            const matchStart = cursorPos - query.length - 1; // index of '@'
            setMentionMatchStart(matchStart);
            setMentionQuery(query);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setTimeout(detectMentionTrigger, 0);
    };

    const handleSelectUser = (user: MentionSuggestion) => {
        const textarea = textareaRef.current;
        if (!textarea || mentionMatchStart < 0) return;

        const cursorPos = textarea.selectionEnd;
        const textBefore = value.slice(0, mentionMatchStart);
        const textAfter = value.slice(cursorPos);

        const replacement = `@${user.displayName} `;
        const newValue = textBefore + replacement + textAfter;

        selectedUsersMapRef.current.set(user.id, user);
        onChange(newValue);
        setShowSuggestions(false);

        // Put cursor immediately after mention replacement
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = mentionMatchStart + replacement.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
            syncMentionsToParent();
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Escape') setShowSuggestions(false);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (suggestions[selectedIndex]) {
                e.preventDefault();
                handleSelectUser(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowSuggestions(false);
        }
    };

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current && 
                !popoverRef.current.contains(e.target as Node) &&
                textareaRef.current &&
                !textareaRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                id={id}
                rows={rows}
                value={value}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onClick={detectMentionTrigger}
                onKeyUp={detectMentionTrigger}
                placeholder={placeholder}
                required={required}
                className={className}
            />

            {/* Mention Suggestions Popover */}
            {showSuggestions && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 right-0 sm:right-auto sm:w-80 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-[#1f1710] border border-amber-900/15 dark:border-amber-500/20 rounded-2xl shadow-xl z-50 divide-y divide-amber-900/5 dark:divide-amber-500/10 animate-in fade-in zoom-in-95 duration-100"
                    role="listbox"
                    aria-label="Member suggestions"
                >
                    <div className="px-3 py-1.5 bg-amber-50/70 dark:bg-amber-950/40 text-[10px] font-bold tracking-wide uppercase text-amber-800 dark:text-amber-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                            <AtSign className="w-3 h-3 text-amber-600" /> Mention Member
                        </span>
                        {isSearching && (
                            <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                        )}
                    </div>

                    {isSearching && suggestions.length === 0 ? (
                        <div className="px-4 py-4 text-center text-xs text-slate-400">
                            Searching members...
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="px-4 py-4 text-center text-xs text-slate-400">
                            No community members found matching &quot;{mentionQuery}&quot;
                        </div>
                    ) : (
                        suggestions.map((user, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div
                                    key={user.id}
                                    onClick={() => handleSelectUser(user)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-amber-100/70 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100' : 'hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-800 dark:text-slate-200'}`}
                                >
                                    {/* Avatar */}
                                    {user.avatarUrl ? (
                                        <img
                                            src={user.avatarUrl}
                                            alt={user.displayName}
                                            className="w-7 h-7 rounded-full object-cover border border-amber-300 dark:border-amber-700 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                            {user.displayName.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    {/* Name and Badge */}
                                    <div className="flex-1 min-w-0 flex flex-col text-left">
                                        <span className="text-xs font-bold truncate">
                                            {user.displayName}
                                        </span>
                                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                            {user.badge === 'Admin' || user.badge === 'Teacher' ? (
                                                <Sparkles className="w-2.5 h-2.5" />
                                            ) : null}
                                            {user.badge}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
