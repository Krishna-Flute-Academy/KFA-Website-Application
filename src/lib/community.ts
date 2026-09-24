import { supabaseAuth } from './supabase-auth';
import { sanitizeHtml, htmlToPlainText } from './text-utils';

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
    created_at: string;
    updated_at: string;
    // Enriched fields
    author?: CommunityProfile;
    has_upvoted?: boolean;
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

/**
 * Safely validate and sanitize redirect URLs to prevent open-redirect vulnerabilities.
 */
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

        let query = supabaseAuth
            .from('community_posts')
            .select(`
                id,
                category_id,
                author_id,
                title,
                slug,
                content,
                visibility,
                classroom_id,
                post_type,
                is_pinned,
                is_locked,
                accepted_reply_id,
                views_count,
                upvotes_count,
                replies_count,
                created_at,
                updated_at,
                category:community_categories(id, name, slug, access_scope, icon_name)
            `, { count: 'exact' });

        if (categoryId) {
            query = query.eq('category_id', categoryId);
        }

        if (searchQuery.trim()) {
            const cleanQuery = searchQuery.trim();
            // Use PostgreSQL ilike across title and content
            query = query.or(`title.ilike.%${cleanQuery}%,content.ilike.%${cleanQuery}%`);
        }

        // Apply Tab Filter
        if (tab === 'unanswered') {
            query = query.eq('replies_count', 0);
        } else if (tab === 'solved') {
            query = query.not('accepted_reply_id', 'is', null);
        }

        // Apply Sorting
        if (tab === 'popular') {
            query = query
                .order('is_pinned', { ascending: false })
                .order('upvotes_count', { ascending: false })
                .order('replies_count', { ascending: false })
                .order('created_at', { ascending: false });
        } else {
            // Default: recent (pinned first)
            query = query
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });
        }

        // Range Pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data: posts, count, error } = await query;

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
 * Fetch a single discussion post by its unique slug
 */
export async function getCommunityPostBySlug(
    slug: string,
    currentUserId?: string | null
): Promise<CommunityPost | null> {
    try {
        const { data: post, error } = await supabaseAuth
            .from('community_posts')
            .select(`
                id,
                category_id,
                author_id,
                title,
                slug,
                content,
                visibility,
                classroom_id,
                post_type,
                is_pinned,
                is_locked,
                accepted_reply_id,
                views_count,
                upvotes_count,
                replies_count,
                created_at,
                updated_at,
                category:community_categories(id, name, slug, access_scope, icon_name)
            `)
            .eq('slug', slug)
            .maybeSingle();

        if (error || !post) {
            console.warn('[Community] getCommunityPostBySlug not found or error:', error?.message);
            return null;
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
export async function incrementPostView(postId: string): Promise<void> {
    try {
        await (supabaseAuth.rpc('increment_community_post_view', { p_id: postId }) as unknown as Promise<any>).catch(() => {});
    } catch (err) {
        // View count increment failures are non-blocking
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
        const { data: replies, error } = await supabaseAuth
            .from('community_replies')
            .select(`
                id,
                post_id,
                author_id,
                content,
                parent_reply_id,
                is_accepted,
                upvotes_count,
                created_at,
                updated_at
            `)
            .eq('post_id', postId)
            .order('is_accepted', { ascending: false })
            .order('created_at', { ascending: true });

        if (error || !replies) {
            console.warn('[Community] getCommunityReplies error:', error?.message);
            return [];
        }

        if (replies.length === 0) return [];

        const authorIds = Array.from(new Set(replies.map(r => r.author_id)));
        const replyIds = replies.map(r => r.id);

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
                    .select('reply_id')
                    .eq('user_id', currentUserId)
                    .in('reply_id', replyIds)
                : Promise.resolve({ data: [] })
        ]);

        const profileMap = new Map<string, any>();
        (profilesRes.data || []).forEach(p => profileMap.set(p.id, p));

        const roleMap = new Map<string, string>();
        (rolesRes.data || []).forEach((u: any) => roleMap.set(u.id, u.role));

        const upvotedReplyIds = new Set((reactionsRes.data || []).map((r: any) => r.reply_id));

        return replies.map(r => ({
            ...r,
            author: {
                id: r.author_id,
                display_name: profileMap.get(r.author_id)?.display_name || 'KFA Member',
                avatar_url: profileMap.get(r.author_id)?.avatar_url || null,
                bio: profileMap.get(r.author_id)?.bio || null,
                badge: resolveUserBadge(roleMap.get(r.author_id))
            },
            has_upvoted: upvotedReplyIds.has(r.id)
        }));
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
}): Promise<{ success: boolean; slug?: string; error?: string }> {
    try {
        const { categoryId, title, content, postType = 'question', authorId, authorName, authorAvatar } = params;

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
            .select('slug')
            .single();

        if (insertError) {
            console.error('[Community] createCommunityPost error:', insertError);
            return { success: false, error: insertError.message };
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
}): Promise<{ success: boolean; reply?: CommunityReply; error?: string }> {
    try {
        const { postId, content, authorId, authorName, authorAvatar, parentReplyId } = params;

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

        // Notify post author if not replying to own post
        try {
            const { data: post } = await supabaseAuth
                .from('community_posts')
                .select('author_id, title, slug')
                .eq('id', postId)
                .single();

            if (post && post.author_id !== authorId) {
                await supabaseAuth
                    .from('notifications')
                    .insert({
                        user_id: post.author_id,
                        title: 'New Community Reply',
                        message: `${authorName || 'Someone'} replied to your discussion: "${post.title}"`,
                        type: 'community',
                        is_read: false
                    });
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
 * Toggle Upvote reaction for a post or reply
 */
export async function toggleCommunityReaction(params: {
    userId: string;
    postId?: string;
    replyId?: string;
}): Promise<{ success: boolean; hasUpvoted: boolean; error?: string }> {
    const { userId, postId, replyId } = params;

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
            return { success: true, hasUpvoted: true };
        }
    } catch (err: any) {
        console.error('[Community] Exception in toggleCommunityReaction:', err);
        return { success: false, hasUpvoted: false, error: err.message };
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

export async function adminDeletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAuth
            .from('community_posts')
            .delete()
            .eq('id', postId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function adminDeleteReply(replyId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAuth
            .from('community_replies')
            .delete()
            .eq('id', replyId);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
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
