import { supabaseAuth } from './supabase-auth';

export interface EndActiveClassOptions {
    classroomId: string;
    sessionDate?: string;
    sessionType?: 'online' | 'offline';
    startedAt?: string | number | Date;
    endedAt?: string | number | Date;
    durationSeconds?: number;
    presentCount?: number;
    absentCount?: number;
    lateCount?: number;
    excusedCount?: number;
    endReason?: 'manual' | 'auto_timeout';
}

export interface EndActiveClassResult {
    success: boolean;
    alreadyEnded?: boolean;
    classroomId: string;
    logId?: string | null;
    startedAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    endReason?: string;
    message?: string;
}

export interface StartActiveClassOptions {
    classroomId: string;
    classroomName?: string;
    meetingLink?: string | null;
    sessionType?: 'online' | 'offline';
    sessionDate?: string;
    startedAt?: number;
}

/**
 * Authoritative canonical operation to end an active class session.
 * Used by all End Class buttons across the application and respects backend idempotency.
 */
export async function endActiveClass(options: EndActiveClassOptions): Promise<EndActiveClassResult> {
    const { classroomId } = options;
    if (!classroomId) {
        throw new Error('Classroom ID is required to end a class session.');
    }

    const sessionDate = options.sessionDate || new Date().toISOString().split('T')[0];
    const sessionType = options.sessionType || 'online';
    
    // Resolve start time
    let startedAtIso: string | undefined;
    if (options.startedAt) {
        startedAtIso = new Date(options.startedAt).toISOString();
    }

    const endedAtIso = options.endedAt 
        ? new Date(options.endedAt).toISOString() 
        : new Date().toISOString();

    const durationSeconds = options.durationSeconds && options.durationSeconds > 0
        ? options.durationSeconds
        : undefined;

    try {
        const { data, error } = await supabaseAuth.rpc('end_classroom_session', {
            p_classroom_id: classroomId,
            p_session_date: sessionDate,
            p_session_type: sessionType,
            p_started_at: startedAtIso || null,
            p_ended_at: endedAtIso,
            p_duration_seconds: durationSeconds || null,
            p_present_count: options.presentCount || 0,
            p_absent_count: options.absentCount || 0,
            p_late_count: options.lateCount || 0,
            p_excused_count: options.excusedCount || 0,
            p_end_reason: options.endReason || 'manual'
        });

        if (error) {
            console.error('[class-session-lifecycle] RPC end_classroom_session returned error:', error);
            throw error;
        }

        const res = (data || {}) as any;

        // Clean local storage state & dispatch events so all UI instances sync
        clearLocalSessionState(classroomId);

        return {
            success: true,
            alreadyEnded: res.already_ended || false,
            classroomId,
            logId: res.log_id,
            startedAt: res.started_at,
            endedAt: res.ended_at,
            durationSeconds: res.duration_seconds,
            endReason: res.end_reason,
            message: res.message
        };
    } catch (err: any) {
        console.error('[class-session-lifecycle] Error ending active session:', err);
        // Do NOT clear localStorage or optimistically assume success if the backend failed!
        throw err;
    }
}

/**
 * Authoritative canonical operation to start a class session.
 */
export async function startActiveClass(options: StartActiveClassOptions): Promise<void> {
    const { classroomId, meetingLink, sessionType, classroomName, sessionDate } = options;
    const nowMs = options.startedAt || Date.now();
    const startedAtIso = new Date(nowMs).toISOString();

    const { error } = await supabaseAuth.rpc('start_classroom_session', {
        p_classroom_id: classroomId,
        p_meeting_link: sessionType === 'online' ? (meetingLink || null) : null,
        p_started_at: startedAtIso
    });

    if (error) {
        console.error('[class-session-lifecycle] Error starting class session:', error);
        throw error;
    }

    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('active_class_session', JSON.stringify({
                classroomId,
                classroomName: classroomName || 'Classroom',
                sessionType: sessionType || 'online',
                sessionDate: sessionDate || new Date().toISOString().split('T')[0],
                startedAt: nowMs
            }));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('class_session_started', { detail: { classroomId } }));
        } catch (e) {
            console.warn('[class-session-lifecycle] Failed to save active_class_session in localStorage:', e);
        }
    }
}

/**
 * Safely reads the currently stored active session from localStorage.
 */
export function getLocalActiveSession(): {
    classroomId: string;
    classroomName: string;
    sessionType: 'online' | 'offline';
    sessionDate: string;
    startedAt: number;
} | null {
    if (typeof window === 'undefined') return null;
    try {
        const str = localStorage.getItem('active_class_session');
        if (!str) return null;
        return JSON.parse(str);
    } catch {
        return null;
    }
}

/**
 * Clears localStorage session cache and notifies open tabs and components.
 */
export function clearLocalSessionState(classroomId?: string) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem('active_class_session');
        window.dispatchEvent(new Event('storage'));
        if (classroomId) {
            window.dispatchEvent(new CustomEvent('class_session_ended', { detail: { classroomId } }));
        }
    } catch (e) {
        console.warn('[class-session-lifecycle] Error clearing local session state:', e);
    }
}
