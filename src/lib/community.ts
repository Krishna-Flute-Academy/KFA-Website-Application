import { supabaseAuth } from './supabase-auth';
import { sanitizeHtml, htmlToPlainText, truncatePlainText } from './text-utils';

// The production schema may temporarily be behind the moderation migration.
// Remember the capability after the first response so a known-missing column
// does not add a failed request before every subsequent discussion query.
let supportsCommunityPostSoftDelete: boolean | null = null;

export type CommunityAccessScope = 'public' | 'students' | 'classroom';
export type CommunityPostType = 'question' | 'discussion';
export type CommunityBadge = 'Admin' | 'Teacher' | 'KFA Student' | 'Community Member';

export interface CommunityProfile {
    id: string;
    display_name: string;
    avatar_url: string | null;
    bio?: string | null;
    badge?: CommunityBadge;
    created_at?: string;
}

export interface ReactionUser {
    displayName: string;
    avatarUrl: string | null;
    badge: CommunityBadge;
    reactionType: string;
    createdAt: string;
}

export interface CommunityCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    access_scope: CommunityAccessScope;
    display_order: number;
    is_active: boolean;
    icon_name: string | null;
    created_at: string;
    post_count?: number;
}

export interface CommunityPost {
    id: string;
    category_id: string;
    author_id: string;
    title: string;
    slug: string;
    content: string;
    visibility: CommunityAccessScope;
    classroom_id: string | null;
    post_type: CommunityPostType;
    is_pinned: boolean;
    is_locked: boolean;
    accepted_reply_id: string | null;
    views_count: number;
    upvotes_count: number;
    replies_count: number;
    is_deleted?: boolean;
    deleted_at?: string | null;
    deleted_by?: string | null;
    deletion_reason?: string | null;
    created_at: string;
    updated_at: string;
    // Enriched fields
    category?: CommunityCategory;
    author?: CommunityProfile;
    has_upvoted?: boolean;
}

export interface CommunityReply {
    id: string;
    post_id: string;
    author_id: string;
    content: string;
    parent_reply_id: string | null;
    is_accepted: boolean;
    upvotes_count: number;
    is_deleted?: boolean;
    deleted_at?: string | null;
    deleted_by?: string | null;
    deletion_reason?: string | null;
    created_at: string;
    updated_at: string;
    // Enriched fields
    author?: CommunityProfile;
    has_upvoted?: boolean;
}

/**
 * Check if content has genuinely been modified after creation.
 * Compares created_at and updated_at with a 2-second tolerance for DB trigger execution.
 */
export function isContentEdited(createdAt?: string, updatedAt?: string): boolean {
    if (!createdAt || !updatedAt) return false;
    const c = new Date(createdAt).getTime();
    const u = new Date(updatedAt).getTime();
    if (isNaN(c) || isNaN(u)) return false;
    return u - c > 2000;
}

export interface CommunityFilterOptions {
    categorySlug?: string;
    tab?: 'recent' | 'popular' | 'unanswered' | 'solved' | 'teacher_answers';
    searchQuery?: string;
    page?: number;
    pageSize?: number;
}

/**
 * Generate a clean, SEO-friendly, unique URL slug for a post title
 */
export function generatePostSlug(title: string): string {
    const baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug || 'discussion'}-${randomSuffix}`;
}

/**
 * Canonical discussion URL generator ensuring consistent routing across KFA Community.
 * Safely handles slug generation, UUID fallback, reply anchor fragments, and prevents empty routes.
 */
export function getCommunityDiscussionUrl(
    post: { slug?: string | null; id?: string | null } | string,
    replyId?: string | null
): string {
    const identifier = typeof post === 'string'
        ? post.trim()
        : (post?.slug || post?.id || '').trim();

    if (!identifier) return '/community';
    const base = `/community/discussion/${encodeURIComponent(identifier)}`;
    return replyId ? `${base}#reply-${encodeURIComponent(replyId)}` : base;
}

/**
 * Helper to get user's display badge based on public.users role
 */
export function resolveUserBadge(role?: string | null): CommunityBadge {
    if (!role) return 'Community Member';
    const r = role.toLowerCase();
    if (r === 'admin') return 'Admin';
    if (r === 'teacher') return 'Teacher';
    if (r === 'student' || r === 'mentor') return 'KFA Student';
    return 'Community Member';
}

export interface MentionSuggestion {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    badge: CommunityBadge;
}

/**
 * Search community members for @mention tagging.
 * Fast, debounced, strictly batched, and protects private user data (zero email/phone/UUID leaks in UI).
 */
export async function searchCommunityMentionUsers(query: string): Promise<MentionSuggestion[]> {
    const cleanQuery = query.trim().replace(/^@/, '');
    if (!cleanQuery) return [];

    try {
        const { data: profiles, error } = await supabaseAuth
            .from('community_profiles')
            .select('id, display_name, avatar_url')
            .ilike('display_name', `%${cleanQuery}%`)
            .limit(8);

        if (error || !profiles || profiles.length === 0) return [];

        const userIds = profiles.map(p => p.id);
        const { data: users } = await supabaseAuth
            .from('users')
            .select('id, role')
            .in('id', userIds);

        const roleMap = new Map<string, string>();
        (users || []).forEach(u => roleMap.set(u.id, u.role));

        return profiles.map(p => ({
            id: p.id,
            displayName: p.display_name,
            avatarUrl: p.avatar_url || null,
            badge: resolveUserBadge(roleMap.get(p.id))
        }));
    } catch (err) {
        console.warn('[Community] searchCommunityMentionUsers error:', err);
        return [];
    }
}

/**
 * Formats @DisplayName mentions in content into a styled KFA pill
 */
export function formatContentWithMentions(content: string, mentions?: Array<{ displayName: string }>): string {
    if (!content) return '';
    let formatted = content;
    if (mentions && mentions.length > 0) {
        mentions.forEach(m => {
            const escaped = m.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escaped}(?=[\\s,.:;!?)]|$)`, 'g');
            formatted = formatted.replace(regex, `<span class="kfa-mention font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-md inline-flex items-center">@${m.displayName}</span>`);
        });
    }
    return formatted;
}

export function getSafeRedirectUrl(targetUrl: string | null | undefined, defaultUrl: string = '/community'): string {
    if (!targetUrl || typeof targetUrl !== 'string') return defaultUrl;
    const trimmed = targetUrl.trim();
    // Validate path starts with single / and not //, /\, or contains backslashes
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\') && !trimmed.includes('\\')) {
        return trimmed;
    }
    return defaultUrl;
}

/**
 * Fetch all available community categories
 */
export async function getCommunityCategories(): Promise<CommunityCategory[]> {
    try {
        const { data, error } = await supabaseAuth
            .from('community_categories')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) {
            console.warn('[Community] getCommunityCategories error:', error.message);
            return getFallbackCategories();
        }
        return data || [];
    } catch (err) {
        console.warn('[Community] Network error fetching categories:', err);
        return getFallbackCategories();
    }
}

/**
 * Fallback static categories in case DB tables are not yet provisioned
 */
export function getFallbackCategories(): CommunityCategory[] {
    return [
        {
            id: '1',
            name: 'Flute Questions',
            slug: 'flute-questions',
            description: 'General flute and bansuri questions, instrument guidance, maintenance, and acoustics.',
            access_scope: 'public',
            display_order: 1,
            is_active: true,
            icon_name: 'HelpCircle',
            created_at: new Date().toISOString()
        },
        {
            id: '2',
            name: 'Beginner Discussions',
            slug: 'beginner-discussions',
            description: 'Questions about starting flute, posture, blowing, fingering, lip placement, and breath control.',
            access_scope: 'public',
            display_order: 2,
            is_active: true,
            icon_name: 'GraduationCap',
            created_at: new Date().toISOString()
        },
        {
            id: '3',
            name: 'Raag & Music Discussions',
            slug: 'raag-and-music-discussions',
            description: 'Indian classical music, raag concepts, taal, aroha-avaroha, pakad, notation, and theory.',
            access_scope: 'public',
            display_order: 3,
            is_active: true,
            icon_name: 'Music',
            created_at: new Date().toISOString()
        },
        {
            id: '4',
            name: 'General Bansuri Discussion',
            slug: 'general-bansuri-discussion',
            description: 'Open discussion on bansuri artists, recordings, performances, and flute appreciation.',
            access_scope: 'public',
            display_order: 4,
            is_active: true,
            icon_name: 'MessageSquare',
            created_at: new Date().toISOString()
        },
        {
            id: '5',
            name: 'Practice Corner',
            slug: 'practice-corner',
            description: 'Practice-related discussions, daily riyaz difficulties, routine building, and personal tips.',
            access_scope: 'students',
            display_order: 5,
            is_active: true,
            icon_name: 'Clock',
            created_at: new Date().toISOString()
        },
        {
            id: '6',
            name: 'Learning Discussions',
            slug: 'learning-discussions',
            description: 'Questions and exchange related to Krishna Flute Academy curriculum and syllabus.',
            access_scope: 'students',
            display_order: 6,
            is_active: true,
            icon_name: 'BookOpen',
            created_at: new Date().toISOString()
        },
        {
            id: '7',
            name: 'Student Performances',
            slug: 'student-performances',
            description: 'KFA students share audio, video clips, progress recordings, and peer encouragement.',
            access_scope: 'students',
            display_order: 7,
            is_active: true,
            icon_name: 'PlayCircle',
            created_at: new Date().toISOString()
        },
        {
            id: '8',
            name: 'Ask Krishna Sir',
            slug: 'ask-krishna-sir',
            description: 'Direct musical and learning questions for Guru Krishna Gopal Bhaumik.',
            access_scope: 'students',
            display_order: 8,
            is_active: true,
            icon_name: 'Sparkles',
            created_at: new Date().toISOString()
        }
    ];
}

/**
 * Fetch discussions with pagination, category filter, sorting tabs, and search query.
 */
export async function getCommunityPosts(
    options: CommunityFilterOptions = {},
    currentUserId?: string | null
): Promise<{ posts: CommunityPost[]; totalCount: number; hasMore: boolean }> {
    const {
        categorySlug,
        tab = 'recent',
        searchQuery = '',
        page = 1,
        pageSize = 20
    } = options;

    try {
        let categoryId: string | null = null;
        if (categorySlug && categorySlug !== 'all') {
            const { data: cat } = await supabaseAuth
                .from('community_categories')
                .select('id')
                .eq('slug', categorySlug)
                .maybeSingle();
            if (cat) categoryId = cat.id;
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const buildQuery = (includeSoftDelete: boolean) => {
            const selectFields = includeSoftDelete
                ? 'id, category_id, author_id, title, slug, content, visibility, classroom_id, post_type, is_pinned, is_locked, accepted_reply_id, views_count, upvotes_count, replies_count, is_deleted, deleted_at, deleted_by, deletion_reason, created_at, updated_at, category:community_categories(id, name, slug, access_scope, icon_name)'
                : 'id, category_id, author_id, title, slug, content, visibility, classroom_id, post_type, is_pinned, is_locked, accepted_reply_id, views_count, upvotes_count, replies_count, created_at, updated_at, category:community_categories(id, name, slug, access_scope, icon_name)';

            let q = (supabaseAuth.from('community_posts') as any)
                .select(selectFields, { count: 'exact' });

            if (includeSoftDelete) {
                q = q.eq('is_deleted', false);
            }

            if (categoryId) {
                q = q.eq('category_id', categoryId);
            }

            if (searchQuery.trim()) {
                const cleanQuery = searchQuery.trim();
                // Use PostgreSQL ilike across title and content
                q = q.or(`title.ilike.%${cleanQuery}%,content.ilike.%${cleanQuery}%`);
            }

            // Apply Tab Filter
            if (tab === 'unanswered') {
                q = q.eq('replies_count', 0);
            } else if (tab === 'solved') {
                q = q.not('accepted_reply_id', 'is', null);
            }

            // Apply Sorting
            if (tab === 'popular') {
                q = q
                    .order('is_pinned', { ascending: false })
                    .order('upvotes_count', { ascending: false })
                    .order('replies_count', { ascending: false })
                    .order('created_at', { ascending: false });
            } else {
                // Default: recent (pinned first)
                q = q
                    .order('is_pinned', { ascending: false })
                    .order('created_at', { ascending: false });
            }

            // Range Pagination
            return q.range(from, to);
        };

        const includeSoftDelete = supportsCommunityPostSoftDelete !== false;
        let { data: posts, count, error } = await buildQuery(includeSoftDelete);
        if (includeSoftDelete && error && (error.code === '42703' || error.message?.includes('is_deleted'))) {
            supportsCommunityPostSoftDelete = false;
            const fallbackRes = await buildQuery(false);
            posts = fallbackRes.data;
            count = fallbackRes.count;
            error = fallbackRes.error;
        } else if (!error && includeSoftDelete) {
            supportsCommunityPostSoftDelete = true;
        }

        if (error) {
            console.warn('[Community] getCommunityPosts error:', error.message);
            return { posts: [], totalCount: 0, hasMore: false };
        }

        const totalCount = count || 0;
        const hasMore = totalCount > to + 1;

        if (!posts || posts.length === 0) {
            return { posts: [], totalCount: 0, hasMore: false };
        }

        // Fetch author profiles and user upvote reactions in parallel
        const authorIds = Array.from(new Set(posts.map(p => p.author_id)));
        const postIds = posts.map(p => p.id);

        const [profilesRes, rolesRes, reactionsRes] = await Promise.all([
            supabaseAuth
                .from('community_profiles')
                .select('id, display_name, avatar_url, bio')
                .in('id', authorIds),
            supabaseAuth
                .from('users')
                .select('id, role')
                .in('id', authorIds),
            currentUserId
                ? supabaseAuth
                    .from('community_reactions')
                    .select('post_id')
                    .eq('user_id', currentUserId)
                    .in('post_id', postIds)
                : Promise.resolve({ data: [] })
        ]);

        const profileMap = new Map<string, any>();
        (profilesRes.data || []).forEach(p => profileMap.set(p.id, p));

        const roleMap = new Map<string, string>();
        (rolesRes.data || []).forEach((u: any) => roleMap.set(u.id, u.role));

        const upvotedPostIds = new Set((reactionsRes.data || []).map((r: any) => r.post_id));

        const enrichedPosts: CommunityPost[] = posts.map((post: any) => {
            const authorProf = profileMap.get(post.author_id);
            const userRole = roleMap.get(post.author_id);

            return {
                ...post,
                category: post.category,
                author: {
                    id: post.author_id,
                    display_name: authorProf?.display_name || 'KFA Member',
                    avatar_url: authorProf?.avatar_url || null,
                    bio: authorProf?.bio || null,
                    badge: resolveUserBadge(userRole)
                },
                has_upvoted: upvotedPostIds.has(post.id)
            };
        });

        return {
            posts: enrichedPosts,
            totalCount,
            hasMore
        };
    } catch (err) {
        console.error('[Community] Exception in getCommunityPosts:', err);
        return { posts: [], totalCount: 0, hasMore: false };
    }
}

/**
 * Fetch a single discussion post by its unique slug or UUID id
 */
export async function getCommunityPostBySlug(
    slugOrId: string,
    currentUserId?: string | null
): Promise<CommunityPost | null> {
    try {
        const rawParam = (slugOrId || '').trim();
        if (!rawParam) return null;

        let cleanParam = rawParam;
        try {
            cleanParam = decodeURIComponent(rawParam).trim();
        } catch {
            cleanParam = rawParam;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanParam);

        const buildPostQuery = (includeSoftDelete: boolean) => {
            const selectFields = includeSoftDelete
                ? 'id, category_id, author_id, title, slug, content, visibility, classroom_id, post_type, is_pinned, is_locked, accepted_reply_id, views_count, upvotes_count, replies_count, is_deleted, deleted_at, deleted_by, deletion_reason, created_at, updated_at, category:community_categories(id, name, slug, access_scope, icon_name)'
                : 'id, category_id, author_id, title, slug, content, visibility, classroom_id, post_type, is_pinned, is_locked, accepted_reply_id, views_count, upvotes_count, replies_count, created_at, updated_at, category:community_categories(id, name, slug, access_scope, icon_name)';

            let q = (supabaseAuth.from('community_posts') as any).select(selectFields);
            if (isUuid) {
                q = q.or(`slug.eq.${cleanParam},id.eq.${cleanParam}`);
            } else {
                q = q.eq('slug', cleanParam);
            }
            return q.maybeSingle();
        };

        let { data: post, error } = await buildPostQuery(true);
        if (error && (error.code === '42703' || error.message?.includes('is_deleted'))) {
            const fallbackRes = await buildPostQuery(false);
            post = fallbackRes.data;
            error = fallbackRes.error;
        }

        if (error || !post) {
            console.warn('[Community] getCommunityPostBySlug not found or error:', error?.message);
            return null;
        }

        // If post has been soft-deleted
        if (post.is_deleted) {
            // Check if user is admin
            let isUserAdmin = false;
            if (currentUserId) {
                const { data: u } = await supabaseAuth.from('users').select('role').eq('id', currentUserId).maybeSingle();
                if (u?.role === 'admin') isUserAdmin = true;
            }
            if (!isUserAdmin) {
                // Do not expose original content or title to non-admins
                return {
                    ...post,
                    title: 'Discussion Removed',
                    content: '',
                    is_deleted: true,
                    category: (post as any).category
                };
            }
        }

        // Fetch author profile, role, and current user upvote
        const [profRes, roleRes, reactionRes] = await Promise.all([
            supabaseAuth
                .from('community_profiles')
                .select('id, display_name, avatar_url, bio')
                .eq('id', post.author_id)
                .maybeSingle(),
            supabaseAuth
                .from('users')
                .select('role')
                .eq('id', post.author_id)
                .maybeSingle(),
            currentUserId
                ? supabaseAuth
                    .from('community_reactions')
                    .select('id')
                    .eq('post_id', post.id)
                    .eq('user_id', currentUserId)
                    .maybeSingle()
                : Promise.resolve({ data: null })
        ]);

        return {
            ...post,
            category: (post as any).category,
            author: {
                id: post.author_id,
                display_name: profRes.data?.display_name || 'KFA Member',
                avatar_url: profRes.data?.avatar_url || null,
                bio: profRes.data?.bio || null,
                badge: resolveUserBadge(roleRes.data?.role)
            },
            has_upvoted: !!reactionRes.data
        };
    } catch (err) {
        console.error('[Community] Exception in getCommunityPostBySlug:', err);
        return null;
    }
}

/**
 * Increment view count for a post safely
 */
export async function incrementPostView(postId: string): Promise<boolean> {
    try {
        const { error } = await supabaseAuth.rpc('increment_community_post_view', { p_id: postId });
        if (error) {
            console.warn('[Community] Could not increment post view count:', error.message);
            return false;
        }
        return true;
    } catch (err) {
        // View count increment failures are non-blocking.
        console.warn('[Community] Could not increment post view count:', err);
        return false;
    }
}

/**
 * Fetch all replies for a given post
 */
export async function getCommunityReplies(
    postId: string,
    currentUserId?: string | null
): Promise<CommunityReply[]> {
    try {
        const buildRepliesQuery = (includeSoftDelete: boolean) => {
            const selectFields = includeSoftDelete
                ? 'id, post_id, author_id, content, parent_reply_id, is_accepted, upvotes_count, is_deleted, deleted_at, deleted_by, deletion_reason, created_at, updated_at'
                : 'id, post_id, author_id, content, parent_reply_id, is_accepted, upvotes_count, created_at, updated_at';

            return (supabaseAuth.from('community_replies') as any)
                .select(selectFields)
                .eq('post_id', postId)
                .order('is_accepted', { ascending: false })
                .order('created_at', { ascending: true });
        };

        let { data: replies, error } = await buildRepliesQuery(true);
        if (error && (error.code === '42703' || error.message?.includes('is_deleted'))) {
            const fallbackRes = await buildRepliesQuery(false);
            replies = fallbackRes.data;
            error = fallbackRes.error;
        }

        if (error || !replies) {
            console.warn('[Community] getCommunityReplies error:', error?.message);
            return [];
        }

        if (replies.length === 0) return [];

        const authorIds = Array.from(new Set(replies.map(r => r.author_id)));
        const replyIds = replies.map(r => r.id);

        const [profilesRes, rolesRes, reactionsRes, currentUserRoleRes] = await Promise.all([
            supabaseAuth
                .from('community_profiles')
                .select('id, display_name, avatar_url, bio')
                .in('id', authorIds),
            supabaseAuth
                .from('users')
                .select('id, role')
                .in('id', authorIds),
            currentUserId
                ? supabaseAuth
                    .from('community_reactions')
                    .select('reply_id')
                    .eq('user_id', currentUserId)
                    .in('reply_id', replyIds)
                : Promise.resolve({ data: [] }),
            currentUserId
                ? supabaseAuth
                    .from('users')
                    .select('role')
                    .eq('id', currentUserId)
                    .maybeSingle()
                : Promise.resolve({ data: null })
        ]);

        const profileMap = new Map<string, any>();
        (profilesRes.data || []).forEach(p => profileMap.set(p.id, p));

        const roleMap = new Map<string, string>();
        (rolesRes.data || []).forEach((u: any) => roleMap.set(u.id, u.role));

        const upvotedReplyIds = new Set((reactionsRes.data || []).map((r: any) => r.reply_id));
        const isUserAdmin = currentUserRoleRes?.data?.role === 'admin';

        return replies.map(r => {
            const isDel = Boolean(r.is_deleted);
            return {
                ...r,
                // Mask content for non-admins if deleted
                content: (isDel && !isUserAdmin) ? '' : r.content,
                author: {
                    id: r.author_id,
                    display_name: isDel ? 'Removed' : (profileMap.get(r.author_id)?.display_name || 'KFA Member'),
                    avatar_url: isDel ? null : (profileMap.get(r.author_id)?.avatar_url || null),
                    bio: isDel ? null : (profileMap.get(r.author_id)?.bio || null),
                    badge: isDel ? undefined : resolveUserBadge(roleMap.get(r.author_id))
                },
                has_upvoted: upvotedReplyIds.has(r.id)
            };
        });
    } catch (err) {
        console.error('[Community] Exception in getCommunityReplies:', err);
        return [];
    }
}

/**
 * Create a new discussion or question
 */
export async function createCommunityPost(params: {
    categoryId: string;
    title: string;
    content: string;
    postType?: CommunityPostType;
    authorId: string;
    authorName?: string;
    authorAvatar?: string | null;
    mentionedUserIds?: string[];
}): Promise<{ success: boolean; slug?: string; error?: string }> {
    try {
        const { categoryId, title, content, postType = 'question', authorId, authorName, authorAvatar, mentionedUserIds } = params;

        if (!title.trim()) return { success: false, error: 'Please enter a title for your discussion.' };
        if (!content.trim()) return { success: false, error: 'Please provide content for your discussion.' };

        // Ensure category exists and resolve visibility
        const { data: category, error: catError } = await supabaseAuth
            .from('community_categories')
            .select('access_scope')
            .eq('id', categoryId)
            .single();

        if (catError || !category) {
            return { success: false, error: 'Selected category was not found.' };
        }

        const visibility: CommunityAccessScope = category.access_scope;
        const slug = generatePostSlug(title);

        // Ensure community profile exists for author
        if (authorName) {
            try {
                await supabaseAuth
                    .from('community_profiles')
                    .upsert({
                        id: authorId,
                        display_name: authorName,
                        avatar_url: authorAvatar || null
                    });
            } catch (e) {}
        }

        const { data: post, error: insertError } = await supabaseAuth
            .from('community_posts')
            .insert({
                category_id: categoryId,
                author_id: authorId,
                title: title.trim(),
                slug,
                content: sanitizeHtml(content),
                visibility,
                post_type: postType
            })
            .select('id, slug')
            .single();

        if (insertError) {
            console.error('[Community] createCommunityPost error:', insertError);
            return { success: false, error: insertError.message };
        }

        // Process @mentions if any
        if (mentionedUserIds && mentionedUserIds.length > 0) {
            const uniqueMentionIds = Array.from(new Set(mentionedUserIds.filter(id => id && id !== authorId)));
            if (uniqueMentionIds.length > 0) {
                try {
                    const mentionRows = uniqueMentionIds.map(mId => ({
                        post_id: post.id,
                        reply_id: null,
                        mentioned_user_id: mId,
                        mentioned_by_user_id: authorId
                    }));
                    await supabaseAuth.from('community_mentions').insert(mentionRows);
                } catch (mErr) {
                    console.warn('[Community] Error recording post mentions:', mErr);
                }

                for (const mId of uniqueMentionIds) {
                    try {
                        await sendCommunityNotification({
                            recipientUserId: mId,
                            actorUserId: authorId,
                            actorName: authorName || 'Someone',
                            title: 'You were mentioned',
                            message: `${authorName || 'Someone'} mentioned you in a community discussion.`,
                            link: getCommunityDiscussionUrl(post),
                            metadata: {
                                type: 'post_mention',
                                post_id: post.id,
                                slug: post.slug,
                                actor_id: authorId
                            }
                        });
                    } catch (nErr) {
                        console.warn('[Community] Error sending post mention notification:', nErr);
                    }
                }
            }
        }

        return { success: true, slug: post.slug };
    } catch (err: any) {
        console.error('[Community] Exception in createCommunityPost:', err);
        return { success: false, error: err.message || 'Failed to create discussion.' };
    }
}

/**
 * Submit a reply to a discussion
 */
export async function createCommunityReply(params: {
    postId: string;
    content: string;
    authorId: string;
    authorName?: string;
    authorAvatar?: string | null;
    parentReplyId?: string | null;
    mentionedUserIds?: string[];
}): Promise<{ success: boolean; reply?: CommunityReply; error?: string }> {
    try {
        const { postId, content, authorId, authorName, authorAvatar, parentReplyId, mentionedUserIds } = params;

        if (!content.trim()) return { success: false, error: 'Reply cannot be empty.' };

        // Ensure community profile exists
        if (authorName) {
            try {
                await supabaseAuth
                    .from('community_profiles')
                    .upsert({
                        id: authorId,
                        display_name: authorName,
                        avatar_url: authorAvatar || null
                    });
            } catch (e) {}
        }

        const sanitized = sanitizeHtml(content);

        const { data: reply, error: insertError } = await supabaseAuth
            .from('community_replies')
            .insert({
                post_id: postId,
                author_id: authorId,
                content: sanitized,
                parent_reply_id: parentReplyId || null
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Community] createCommunityReply error:', insertError);
            return { success: false, error: insertError.message };
        }

        // Notify mentioned users and/or post/comment author with priority deduplication
        try {
            const { data: post } = await supabaseAuth
                .from('community_posts')
                .select('author_id, title, slug')
                .eq('id', postId)
                .single();

            if (post) {
                const actor = authorName || 'Someone';
                const cleanTitle = truncatePlainText(post.title, 50);
                const uniqueMentionIds = Array.from(new Set((mentionedUserIds || []).filter(id => id && id !== authorId)));
                const mentionedSet = new Set(uniqueMentionIds);

                // 1. Record @mentions in community_mentions and send priority notifications
                if (uniqueMentionIds.length > 0) {
                    try {
                        const mentionRows = uniqueMentionIds.map(mId => ({
                            post_id: null,
                            reply_id: reply.id,
                            mentioned_user_id: mId,
                            mentioned_by_user_id: authorId
                        }));
                        await supabaseAuth.from('community_mentions').insert(mentionRows);
                    } catch (mErr) {
                        console.warn('[Community] Error recording reply mentions:', mErr);
                    }

                    for (const mId of uniqueMentionIds) {
                        try {
                            await sendCommunityNotification({
                                recipientUserId: mId,
                                actorUserId: authorId,
                                actorName: actor,
                                title: 'You were mentioned',
                                message: `${actor} mentioned you in a reply.`,
                                link: getCommunityDiscussionUrl(post, reply.id),
                                metadata: {
                                    type: 'comment_mention',
                                    post_id: postId,
                                    reply_id: reply.id,
                                    slug: post.slug,
                                    actor_id: authorId
                                }
                            });
                        } catch (nErr) {
                            console.warn('[Community] Error sending reply mention notification:', nErr);
                        }
                    }
                }

                if (parentReplyId) {
                    // Check parent reply author
                    const { data: parentReply } = await supabaseAuth
                        .from('community_replies')
                        .select('author_id')
                        .eq('id', parentReplyId)
                        .maybeSingle();

                    // Mention notification takes priority! If parent author was already mentioned, do not send generic reply notification
                    if (parentReply && parentReply.author_id && parentReply.author_id !== authorId && !mentionedSet.has(parentReply.author_id)) {
                        await sendCommunityNotification({
                            recipientUserId: parentReply.author_id,
                            actorUserId: authorId,
                            actorName: actor,
                            title: 'New Reply to Your Comment',
                            message: `${actor} replied to your comment on "${cleanTitle}"`,
                            link: getCommunityDiscussionUrl(post, reply.id),
                            metadata: {
                                type: 'comment_reply',
                                post_id: postId,
                                reply_id: reply.id,
                                parent_reply_id: parentReplyId,
                                slug: post.slug
                            }
                        });
                    }

                    // If post author is different from parent reply author AND actor, notify post author as well (unless already mentioned!)
                    if (post.author_id !== authorId && (!parentReply || post.author_id !== parentReply.author_id) && !mentionedSet.has(post.author_id)) {
                        await sendCommunityNotification({
                            recipientUserId: post.author_id,
                            actorUserId: authorId,
                            actorName: actor,
                            title: 'New Community Reply',
                            message: `${actor} replied to your community post "${cleanTitle}"`,
                            link: getCommunityDiscussionUrl(post, reply.id),
                            metadata: {
                                type: 'post_reply',
                                post_id: postId,
                                reply_id: reply.id,
                                slug: post.slug
                            }
                        });
                    }
                } else if (post.author_id !== authorId && !mentionedSet.has(post.author_id)) {
                    // Mention notification takes priority! If post author was already mentioned, do not send generic reply notification
                    await sendCommunityNotification({
                        recipientUserId: post.author_id,
                        actorUserId: authorId,
                        actorName: actor,
                        title: 'New Community Reply',
                        message: `${actor} replied to your community post "${cleanTitle}"`,
                        link: getCommunityDiscussionUrl(post, reply.id),
                        metadata: {
                            type: 'post_reply',
                            post_id: postId,
                            reply_id: reply.id,
                            slug: post.slug
                        }
                    });
                }
            }
        } catch (notifErr) {
            // Notification failures are silent
        }

        return { success: true, reply };
    } catch (err: any) {
        console.error('[Community] Exception in createCommunityReply:', err);
        return { success: false, error: err.message || 'Failed to post reply.' };
    }
}

/**
 * Mark or unmark a reply as the accepted answer
 */
export async function toggleAcceptedAnswer(
    postId: string,
    replyId: string,
    currentStatus: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        const targetReplyId = currentStatus ? null : replyId;
        const { error } = await supabaseAuth.rpc('set_community_accepted_answer', {
            p_post_id: postId,
            p_reply_id: targetReplyId
        });

        if (error) {
            console.error('[Community] RPC set_community_accepted_answer error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[Community] Exception in toggleAcceptedAnswer:', err);
        return { success: false, error: err.message || 'Failed to update accepted answer.' };
    }
}

/**
 * Safely send an in-app community interaction notification with deduplication.
 * Prevents spamming on toggled likes and avoids self-notifications.
 */
export async function sendCommunityNotification(params: {
    recipientUserId: string;
    actorUserId: string;
    actorName?: string;
    title: string;
    message: string;
    link: string;
    metadata?: Record<string, any>;
    isReaction?: boolean;
    postId?: string;
}): Promise<boolean> {
    const { recipientUserId, actorUserId, actorName, title, message, link, metadata, isReaction, postId } = params;

    // Never notify user about their own action
    if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
        return false;
    }

    try {
        // 1. Try secure SECURITY DEFINER RPC first (handles foreign key to auth.users, permission boundaries, and anti-spam)
        try {
            const { data: rpcRes, error: rpcError } = await supabaseAuth.rpc('create_community_notification', {
                p_recipient_id: recipientUserId,
                p_title: title,
                p_message: message,
                p_link: link,
                p_metadata: metadata || null,
                p_is_reaction: isReaction || false,
                p_post_id: postId || null
            });

            if (!rpcError && rpcRes) {
                if (rpcRes.success) return true;
                if (rpcRes.error?.includes('deduplicated')) return false;
            } else if (rpcError) {
                // If RPC not found (code 42883) or specific RPC error, log and fall through to direct insert
                if (rpcError.code !== '42883') {
                    console.warn('[Community] RPC create_community_notification error:', rpcError.code, rpcError.message);
                }
            }
        } catch (rpcEx) {
            // Non-blocking fallback to direct insert
        }

        // 2. Fallback to direct client insert (for environments where RPC is not yet loaded)
        // If this is a reaction (like), check for existing recent or unread notification to avoid spam
        if (isReaction && postId) {
            // Check for unread notification for the same post within 24 hours
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: existing } = await supabaseAuth
                .from('notifications')
                .select('id, is_read, created_at')
                .eq('user_id', recipientUserId)
                .eq('type', 'community')
                .gte('created_at', twentyFourHoursAgo)
                .order('created_at', { ascending: false })
                .limit(10);

            if (existing && existing.length > 0) {
                const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
                const hasDuplicate = existing.some(n => {
                    const createdTime = new Date(n.created_at).getTime();
                    // If unread, don't spam another one
                    if (!n.is_read) return true;
                    // If read but within 2 hours, don't spam on repeated toggle
                    if (createdTime > twoHoursAgo) return true;
                    return false;
                });

                if (hasDuplicate) {
                    return false;
                }
            }
        }

        const basePayload: any = {
            user_id: recipientUserId,
            title,
            message,
            type: 'community',
            is_read: false
        };

        // Try insert with link and metadata first
        const fullPayload = {
            ...basePayload,
            link,
            metadata: metadata || null
        };

        const { error: insertError } = await supabaseAuth
            .from('notifications')
            .insert(fullPayload);

        if (insertError) {
            // Code 42703 means column 'link' or 'metadata' does not exist yet in live DB
            if (insertError.code === '42703' || insertError.message?.includes('link') || insertError.message?.includes('metadata')) {
                // Graceful fallback to standard notifications table schema
                const { error: fallbackError } = await supabaseAuth
                    .from('notifications')
                    .insert(basePayload);
                if (fallbackError) {
                    console.warn('[Community] Notification fallback insert error:', fallbackError.code, fallbackError.message);
                    return false;
                }
            } else {
                console.warn('[Community] Notification insert warning:', insertError.code, insertError.message);
                return false;
            }
        }

        return true;
    } catch (err: any) {
        console.warn('[Community] sendCommunityNotification exception:', err?.message || err);
        return false;
    }
}

/**
 * Toggle Upvote reaction for a post or reply.
 * Automatically notifies the author (deduplicated, non-self).
 */
export async function toggleCommunityReaction(params: {
    userId: string;
    postId?: string;
    replyId?: string;
    userName?: string;
}): Promise<{ success: boolean; hasUpvoted: boolean; error?: string }> {
    const { userId, postId, replyId, userName } = params;

    try {
        let checkQuery = supabaseAuth
            .from('community_reactions')
            .select('id')
            .eq('user_id', userId);

        if (postId) checkQuery = checkQuery.eq('post_id', postId);
        if (replyId) checkQuery = checkQuery.eq('reply_id', replyId);

        const { data: existing } = await checkQuery.maybeSingle();

        if (existing) {
            // Remove upvote
            const { error } = await supabaseAuth
                .from('community_reactions')
                .delete()
                .eq('id', existing.id);

            if (error) return { success: false, hasUpvoted: true, error: error.message };
            return { success: true, hasUpvoted: false };
        } else {
            // Add upvote
            const { error } = await supabaseAuth
                .from('community_reactions')
                .insert({
                    user_id: userId,
                    post_id: postId || null,
                    reply_id: replyId || null,
                    reaction_type: 'upvote'
                });

            if (error) return { success: false, hasUpvoted: false, error: error.message };

            // Trigger notification for the author (deduplicated, non-self)
            try {
                const actorName = userName || 'Someone';

                if (postId) {
                    const { data: post } = await supabaseAuth
                        .from('community_posts')
                        .select('author_id, title, slug')
                        .eq('id', postId)
                        .maybeSingle();

                    if (post && post.author_id !== userId) {
                        const cleanPostTitle = truncatePlainText(post.title, 50);
                        await sendCommunityNotification({
                            recipientUserId: post.author_id,
                            actorUserId: userId,
                            actorName,
                            title: 'New Reaction',
                            message: `${actorName} liked your community post "${cleanPostTitle}"`,
                            link: getCommunityDiscussionUrl(post),
                            metadata: {
                                type: 'post_reaction',
                                post_id: postId,
                                actor_id: userId,
                                slug: post.slug
                            },
                            isReaction: true,
                            postId
                        });
                    }
                } else if (replyId) {
                    const { data: reply } = await supabaseAuth
                        .from('community_replies')
                        .select('author_id, post_id')
                        .eq('id', replyId)
                        .maybeSingle();

                    if (reply && reply.author_id !== userId) {
                        const { data: post } = await supabaseAuth
                            .from('community_posts')
                            .select('id, title, slug')
                            .eq('id', reply.post_id)
                            .maybeSingle();

                        const postSlug = post?.slug || '';
                        const cleanPostTitle = post?.title ? truncatePlainText(post.title, 50) : 'Discussion';

                        await sendCommunityNotification({
                            recipientUserId: reply.author_id,
                            actorUserId: userId,
                            actorName,
                            title: 'New Reaction',
                            message: `${actorName} liked your comment on "${cleanPostTitle}"`,
                            link: getCommunityDiscussionUrl(post || { id: reply.post_id }, replyId),
                            metadata: {
                                type: 'reply_reaction',
                                reply_id: replyId,
                                post_id: reply.post_id,
                                actor_id: userId,
                                slug: postSlug
                            },
                            isReaction: true,
                            postId: reply.post_id
                        });
                    }
                }
            } catch (notifErr) {
                // Reaction notification errors should never fail the reaction itself
                console.warn('[Community] Reaction notification notice:', notifErr);
            }

            return { success: true, hasUpvoted: true };
        }
    } catch (err: any) {
        console.error('[Community] Exception in toggleCommunityReaction:', err);
        return { success: false, hasUpvoted: false, error: err.message };
    }
}

/**
 * Fetch users who reacted to a post or reply.
 * Strictly respects privacy: returns only safe display name, avatar, public badge, and reaction type.
 * Never exposes UUIDs, emails, or private phone numbers.
 * Batches profile lookups to avoid N+1 queries.
 */
export async function getCommunityReactionUsers(params: {
    postId?: string;
    replyId?: string;
    limit?: number;
    offset?: number;
}): Promise<{ users: ReactionUser[]; totalCount: number; hasMore: boolean }> {
    const { postId, replyId, limit = 20, offset = 0 } = params;

    if (!postId && !replyId) {
        return { users: [], totalCount: 0, hasMore: false };
    }

    try {
        let q = (supabaseAuth.from('community_reactions') as any)
            .select('user_id, reaction_type, created_at', { count: 'exact' });

        if (postId) q = q.eq('post_id', postId);
        if (replyId) q = q.eq('reply_id', replyId);

        const { data: reactions, count, error } = await q
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error || !reactions) {
            console.warn('[Community] getCommunityReactionUsers error:', error?.message);
            return { users: [], totalCount: 0, hasMore: false };
        }

        const totalCount = count || 0;
        const hasMore = totalCount > offset + limit;

        if (reactions.length === 0) {
            return { users: [], totalCount: 0, hasMore: false };
        }

        const userIds = Array.from(new Set(reactions.map((r: any) => r.user_id)));

        // Batch fetch public community profiles and roles
        const [profilesRes, rolesRes] = await Promise.all([
            supabaseAuth
                .from('community_profiles')
                .select('id, display_name, avatar_url')
                .in('id', userIds),
            supabaseAuth
                .from('users')
                .select('id, role')
                .in('id', userIds)
        ]);

        const profileMap = new Map<string, any>();
        (profilesRes.data || []).forEach(p => profileMap.set(p.id, p));

        const roleMap = new Map<string, string>();
        (rolesRes.data || []).forEach((u: any) => roleMap.set(u.id, u.role));

        const users: ReactionUser[] = reactions.map((r: any) => {
            const prof = profileMap.get(r.user_id);
            const userRole = roleMap.get(r.user_id);

            return {
                displayName: prof?.display_name || 'KFA Member',
                avatarUrl: prof?.avatar_url || null,
                badge: resolveUserBadge(userRole),
                reactionType: r.reaction_type || 'upvote',
                createdAt: r.created_at
            };
        });

        return { users, totalCount, hasMore };
    } catch (err: any) {
        console.error('[Community] Exception in getCommunityReactionUsers:', err);
        return { users: [], totalCount: 0, hasMore: false };
    }
}

/**
 * Admin / Teacher moderation actions
 */
export async function adminUpdatePost(
    postId: string,
    updates: {
        is_pinned?: boolean;
        is_locked?: boolean;
        category_id?: string;
        visibility?: CommunityAccessScope;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAuth
            .from('community_posts')
            .update(updates)
            .eq('id', postId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Author updates their own discussion post
 */
export async function updateCommunityPost(params: {
    postId: string;
    title: string;
    content: string;
    categoryId?: string;
    postType?: CommunityPostType;
    editorUserId?: string;
    editorName?: string;
    mentionedUserIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { postId, title, content, categoryId, postType, editorUserId, editorName, mentionedUserIds } = params;
        if (!title.trim() || title.trim().length < 5) {
            return { success: false, error: 'Please enter a title of at least 5 characters.' };
        }
        if (!content.trim() || content.trim().length < 10) {
            return { success: false, error: 'Please provide content of at least 10 characters.' };
        }

        const updates: any = {
            title: title.trim(),
            content: sanitizeHtml(content),
            updated_at: new Date().toISOString()
        };

        if (categoryId) updates.category_id = categoryId;
        if (postType) updates.post_type = postType;

        const { error } = await supabaseAuth
            .from('community_posts')
            .update(updates)
            .eq('id', postId);

        if (error) {
            console.error('[Community] updateCommunityPost error:', error);
            return { success: false, error: error.message };
        }

        // Check newly added mentions on edit (only notify users who were not already mentioned)
        if (mentionedUserIds && mentionedUserIds.length > 0 && editorUserId) {
            try {
                const { data: existingMentions } = await supabaseAuth
                    .from('community_mentions')
                    .select('mentioned_user_id')
                    .eq('post_id', postId);

                const existingSet = new Set((existingMentions || []).map(m => m.mentioned_user_id));
                const newMentionIds = Array.from(new Set(mentionedUserIds.filter(id => id && id !== editorUserId && !existingSet.has(id))));

                if (newMentionIds.length > 0) {
                    const mentionRows = newMentionIds.map(mId => ({
                        post_id: postId,
                        reply_id: null,
                        mentioned_user_id: mId,
                        mentioned_by_user_id: editorUserId
                    }));
                    await supabaseAuth.from('community_mentions').insert(mentionRows);

                    const { data: postData } = await supabaseAuth
                        .from('community_posts')
                        .select('slug')
                        .eq('id', postId)
                        .maybeSingle();

                    const postSlug = postData?.slug || '';

                    for (const mId of newMentionIds) {
                        try {
                            await sendCommunityNotification({
                                recipientUserId: mId,
                                actorUserId: editorUserId,
                                actorName: editorName || 'Someone',
                                title: 'You were mentioned',
                                message: `${editorName || 'Someone'} mentioned you in a community discussion.`,
                                link: getCommunityDiscussionUrl(postData || { id: postId, slug: postSlug }),
                                metadata: {
                                    type: 'post_mention',
                                    post_id: postId,
                                    slug: postSlug,
                                    actor_id: editorUserId
                                }
                            });
                        } catch (e) {}
                    }
                }
            } catch (err) {
                console.warn('[Community] Error diffing edit mentions:', err);
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('[Community] Exception in updateCommunityPost:', err);
        return { success: false, error: err.message || 'Failed to update discussion.' };
    }
}

/**
 * Delete a post (soft delete with fallback to hard delete)
 */
export async function deleteCommunityPost(params: {
    postId: string;
    reason?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { postId, reason } = params;
        const { data: { session } } = await supabaseAuth.auth.getSession();
        const currentUserId = session?.user?.id;

        // Try soft-delete first
        const softDeletePayload: any = {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId || null,
            deletion_reason: reason || null
        };

        const { error: softError } = await supabaseAuth
            .from('community_posts')
            .update(softDeletePayload)
            .eq('id', postId);

        if (!softError) {
            return { success: true };
        }

        // Fallback to hard delete if is_deleted column does not exist yet (code 42703)
        if (softError.code === '42703' || softError.message?.includes('is_deleted')) {
            const { error: hardError } = await supabaseAuth
                .from('community_posts')
                .delete()
                .eq('id', postId);

            if (hardError) {
                return { success: false, error: hardError.message };
            }
            return { success: true };
        }

        return { success: false, error: softError.message };
    } catch (err: any) {
        console.error('[Community] Exception in deleteCommunityPost:', err);
        return { success: false, error: err.message || 'Failed to delete discussion.' };
    }
}

/**
 * Author updates their own reply
 */
export async function updateCommunityReply(params: {
    replyId: string;
    content: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { replyId, content } = params;
        if (!content.trim()) {
            return { success: false, error: 'Reply cannot be empty.' };
        }

        const sanitized = sanitizeHtml(content);

        const { error } = await supabaseAuth
            .from('community_replies')
            .update({
                content: sanitized,
                updated_at: new Date().toISOString()
            })
            .eq('id', replyId);

        if (error) {
            console.error('[Community] updateCommunityReply error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[Community] Exception in updateCommunityReply:', err);
        return { success: false, error: err.message || 'Failed to update reply.' };
    }
}

/**
 * Delete a reply (soft delete with fallback to hard delete)
 */
export async function deleteCommunityReply(params: {
    replyId: string;
    reason?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { replyId, reason } = params;
        const { data: { session } } = await supabaseAuth.auth.getSession();
        const currentUserId = session?.user?.id;

        // Try soft-delete first
        const softDeletePayload: any = {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId || null,
            deletion_reason: reason || null
        };

        const { error: softError } = await supabaseAuth
            .from('community_replies')
            .update(softDeletePayload)
            .eq('id', replyId);

        if (!softError) {
            return { success: true };
        }

        // Fallback to hard delete if is_deleted column does not exist yet (code 42703)
        if (softError.code === '42703' || softError.message?.includes('is_deleted')) {
            const { error: hardError } = await supabaseAuth
                .from('community_replies')
                .delete()
                .eq('id', replyId);

            if (hardError) {
                return { success: false, error: hardError.message };
            }
            return { success: true };
        }

        return { success: false, error: softError.message };
    } catch (err: any) {
        console.error('[Community] Exception in deleteCommunityReply:', err);
        return { success: false, error: err.message || 'Failed to delete reply.' };
    }
}

export async function adminDeletePost(postId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    return deleteCommunityPost({ postId, reason });
}

export async function adminDeleteReply(replyId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    return deleteCommunityReply({ replyId, reason });
}

export async function reportContent(params: {
    reporterId: string;
    reason: string;
    postId?: string;
    replyId?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAuth
            .from('community_reports')
            .insert({
                reporter_id: params.reporterId,
                post_id: params.postId || null,
                reply_id: params.replyId || null,
                reason: params.reason
            });

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
