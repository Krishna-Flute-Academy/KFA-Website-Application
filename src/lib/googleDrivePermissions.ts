import { supabaseAuth } from './supabase-auth';

export interface GrantPermissionsParams {
    fileId: string;
    teacherEmail?: string | null;
    adminEmail?: string | null;
    oauthToken: string;
}

export interface PermissionResult {
    success: boolean;
    teacherGranted: boolean;
    adminGranted: boolean;
    teacherEmail?: string | null;
    adminEmail?: string | null;
    errorType?: 'auth_expired' | 'forbidden' | 'not_found' | 'api_error' | 'no_emails';
    errorMessage?: string;
}

/**
 * Resolves teacher email and admin email for a specific assignment and student
 */
export async function resolveTeacherAndAdminEmails(params: {
    assignmentId: string;
    classroomId?: string | null;
    studentTeacherId?: string | null;
    knownTeacherEmail?: string | null;
    knownTeacherName?: string | null;
}): Promise<{
    teacherEmail: string | null;
    teacherName: string | null;
    adminEmail: string | null;
    adminEmails: string[];
}> {
    let teacherEmail = params.knownTeacherEmail || null;
    let teacherName = params.knownTeacherName || null;
    let adminEmails: string[] = [];

    try {
        // 1. Resolve Admin Emails from users table (role = 'admin')
        const { data: admins } = await supabaseAuth
            .from('users')
            .select('id, name, email')
            .eq('role', 'admin');

        if (admins && admins.length > 0) {
            adminEmails = admins.map(a => a.email).filter(Boolean);
        }

        // 2. If teacher email not known, resolve from assignment or classroom
        if (!teacherEmail) {
            // Check assignment row for teacher_id or classroom_id
            const { data: asg } = await supabaseAuth
                .from('assignments')
                .select('teacher_id, classroom_id')
                .eq('id', params.assignmentId)
                .maybeSingle();

            let targetTeacherId = asg?.teacher_id || null;

            if (!targetTeacherId && (asg?.classroom_id || params.classroomId)) {
                const targetClassId = asg?.classroom_id || params.classroomId;
                const { data: classRow } = await supabaseAuth
                    .from('classrooms')
                    .select('teacher_id')
                    .eq('id', targetClassId)
                    .maybeSingle();
                targetTeacherId = classRow?.teacher_id || null;
            }

            if (!targetTeacherId && params.studentTeacherId) {
                targetTeacherId = params.studentTeacherId;
            }

            if (targetTeacherId) {
                const { data: teacherUser } = await supabaseAuth
                    .from('users')
                    .select('name, email')
                    .eq('id', targetTeacherId)
                    .maybeSingle();

                if (teacherUser?.email) {
                    teacherEmail = teacherUser.email;
                    teacherName = teacherUser.name || 'Assigned Teacher';
                }
            }
        }
    } catch (err) {
        console.error('Error resolving teacher and admin emails for Drive permission:', err);
    }

    const primaryAdminEmail = adminEmails[0] || null;

    return {
        teacherEmail,
        teacherName,
        adminEmail: primaryAdminEmail,
        adminEmails
    };
}

/**
 * Grants reader permission for a single email on a Google Drive file using OAuth access token
 */
async function grantPermissionSingle(fileId: string, email: string, oauthToken: string): Promise<{ success: boolean; errorType?: string; errorMessage?: string }> {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${oauthToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'user',
                emailAddress: email.trim()
            })
        });

        if (response.ok) {
            return { success: true };
        }

        const errData = await response.json().catch(() => null);
        const errorMsg = errData?.error?.message || '';
        const reason = errData?.error?.errors?.[0]?.reason || '';

        // If permission already exists or user already has access, treat as success
        if (
            response.status === 400 && 
            (reason === 'userAlreadyHasAccess' || 
             reason === 'alreadyExists' || 
             errorMsg.toLowerCase().includes('already has') || 
             errorMsg.toLowerCase().includes('already exists') ||
             errorMsg.toLowerCase().includes('duplicate'))
        ) {
            return { success: true };
        }

        if (response.status === 401) {
            return { 
                success: false, 
                errorType: 'auth_expired', 
                errorMessage: 'Google Drive authorization expired. Please reconnect to grant access.' 
            };
        }

        if (response.status === 403) {
            return { 
                success: false, 
                errorType: 'forbidden', 
                errorMessage: 'You do not have permission to share this file from your Google Drive. Please ensure you own the file or have permission to share it.' 
            };
        }

        if (response.status === 404) {
            return { 
                success: false, 
                errorType: 'not_found', 
                errorMessage: 'The selected file could not be found in your Google Drive.' 
            };
        }

        return { 
            success: false, 
            errorType: 'api_error', 
            errorMessage: errorMsg || `Failed to update Drive permissions (${response.status})` 
        };
    } catch (err: any) {
        return { 
            success: false, 
            errorType: 'api_error', 
            errorMessage: err.message || 'Network error while connecting to Google Drive' 
        };
    }
}

/**
 * Automatically grants reader permission to both the Assigned Teacher and Academy Admin
 */
export async function grantDrivePermissionsToTeacherAndAdmin({
    fileId,
    teacherEmail,
    adminEmail,
    oauthToken
}: GrantPermissionsParams): Promise<PermissionResult> {
    if (!fileId) {
        return {
            success: false,
            teacherGranted: false,
            adminGranted: false,
            errorType: 'api_error',
            errorMessage: 'Missing Google Drive file ID.'
        };
    }

    if (!oauthToken) {
        return {
            success: false,
            teacherGranted: false,
            adminGranted: false,
            errorType: 'auth_expired',
            errorMessage: 'Google authorization token missing. Please reconnect Google Drive.'
        };
    }

    const cleanTeacherEmail = teacherEmail?.trim().toLowerCase() || null;
    const cleanAdminEmail = adminEmail?.trim().toLowerCase() || null;

    if (!cleanTeacherEmail && !cleanAdminEmail) {
        return {
            success: false,
            teacherGranted: false,
            adminGranted: false,
            errorType: 'no_emails',
            errorMessage: 'Could not determine teacher or admin email address.'
        };
    }

    // If teacher and admin emails are identical, perform a single permission call
    const isSameEmail = cleanTeacherEmail && cleanAdminEmail && cleanTeacherEmail === cleanAdminEmail;

    if (isSameEmail) {
        const res = await grantPermissionSingle(fileId, cleanTeacherEmail, oauthToken);
        return {
            success: res.success,
            teacherGranted: res.success,
            adminGranted: res.success,
            teacherEmail: cleanTeacherEmail,
            adminEmail: cleanAdminEmail,
            errorType: res.errorType as any,
            errorMessage: res.errorMessage
        };
    }

    let teacherSuccess = false;
    let adminSuccess = false;
    let firstErrorType: any = null;
    let firstErrorMessage: string | undefined = undefined;

    // Grant teacher permission
    if (cleanTeacherEmail) {
        const res = await grantPermissionSingle(fileId, cleanTeacherEmail, oauthToken);
        if (res.success) {
            teacherSuccess = true;
        } else {
            firstErrorType = res.errorType;
            firstErrorMessage = res.errorMessage;
        }
    } else {
        // No distinct teacher email, fall back to admin
        teacherSuccess = true;
    }

    // Grant admin permission
    if (cleanAdminEmail) {
        const res = await grantPermissionSingle(fileId, cleanAdminEmail, oauthToken);
        if (res.success) {
            adminSuccess = true;
        } else if (!firstErrorType) {
            firstErrorType = res.errorType;
            firstErrorMessage = res.errorMessage;
        }
    } else {
        // No distinct admin email
        adminSuccess = true;
    }

    const overallSuccess = teacherSuccess && adminSuccess;

    return {
        success: overallSuccess,
        teacherGranted: teacherSuccess,
        adminGranted: adminSuccess,
        teacherEmail: cleanTeacherEmail,
        adminEmail: cleanAdminEmail,
        errorType: overallSuccess ? undefined : firstErrorType,
        errorMessage: overallSuccess ? undefined : firstErrorMessage
    };
}
