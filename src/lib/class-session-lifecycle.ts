import { supabaseAuth } from './supabase-auth';

/**
 * Feature Guard: Session-Specific Attendance Writer Flag
 * Controlled by process.env.NEXT_PUBLIC_ENABLE_SESSION_ATTENDANCE ('true' | 'false').
 * When false (default during pre-Phase 3 transition), attendance writers safely pass
 * p_session_id: null, ensuring 100% compatibility with legacy 3-column unique constraints.
 * Enabled after Phase 3 constraints migration is executed.
 */
export function isSessionAttendanceEnabled(): boolean {
    // Strictly driven by compile-time environment variable.
    // Cannot be bypassed via browser localStorage or client-side tampering.
    return process.env.NEXT_PUBLIC_ENABLE_SESSION_ATTENDANCE === 'true';
}

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
    sessionClassification?: 'normal' | 'extra' | 'on_behalf_of';
    targetScheduledDate?: string | null;
    startedAt?: number;
}

export interface StartActiveClassResult {
    success: boolean;
    sessionId?: string | null;
    isExisting?: boolean;
    startedAt?: string;
    classroomId: string;
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
 * Uses init_classroom_session to create or retrieve a stable, database-backed session ID.
 */
export async function startActiveClass(options: StartActiveClassOptions): Promise<StartActiveClassResult> {
    const { 
        classroomId, 
        meetingLink, 
        sessionType, 
        classroomName, 
        sessionDate,
        sessionClassification,
        targetScheduledDate
    } = options;
    const nowMs = options.startedAt || Date.now();
    const effectiveDate = sessionDate || new Date(nowMs).toISOString().split('T')[0];
    const effectiveType = sessionType || 'online';

    // Call init_classroom_session RPC to obtain/lock the authoritative session ID
    let sessionId: string | null = null;
    let isExisting = false;
    let startedAtIso: string | undefined;

    try {
        const { data, error } = await supabaseAuth.rpc('init_classroom_session', {
            p_classroom_id: classroomId,
            p_session_date: effectiveDate,
            p_session_type: effectiveType,
            p_meeting_link: effectiveType === 'online' ? (meetingLink || null) : null,
            p_session_classification: sessionClassification || 'normal',
            p_target_scheduled_date: targetScheduledDate || null
        });

        if (error) {
            console.warn('[class-session-lifecycle] init_classroom_session failed, falling back to start_classroom_session:', error);
            // Graceful fallback to legacy start_classroom_session if init RPC is unavailable
            const fallbackRes = await supabaseAuth.rpc('start_classroom_session', {
                p_classroom_id: classroomId,
                p_meeting_link: effectiveType === 'online' ? (meetingLink || null) : null,
                p_started_at: new Date(nowMs).toISOString()
            });
            if (fallbackRes.error) {
                console.error('[class-session-lifecycle] Error starting class session:', fallbackRes.error);
                throw fallbackRes.error;
            }
        } else if (data) {
            const res = data as any;
            sessionId = res.session_id || null;
            isExisting = Boolean(res.is_existing);
            startedAtIso = res.started_at;
        }
    } catch (err: any) {
        console.error('[class-session-lifecycle] Fatal error in startActiveClass:', err);
        throw err;
    }

    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('active_class_session', JSON.stringify({
                classroomId,
                classroomName: classroomName || 'Classroom',
                sessionType: effectiveType,
                sessionDate: effectiveDate,
                sessionId,
                startedAt: nowMs
            }));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('class_session_started', { 
                detail: { 
                    classroomId,
                    sessionId 
                } 
            }));
        } catch (e) {
            console.warn('[class-session-lifecycle] Failed to save active_class_session in localStorage:', e);
        }
    }

    return {
        success: true,
        sessionId,
        isExisting,
        startedAt: startedAtIso,
        classroomId
    };
}

/**
 * Safely reads the currently stored active session from localStorage.
 */
export function getLocalActiveSession(): {
    classroomId: string;
    classroomName: string;
    sessionType: 'online' | 'offline';
    sessionDate: string;
    sessionId?: string | null;
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
