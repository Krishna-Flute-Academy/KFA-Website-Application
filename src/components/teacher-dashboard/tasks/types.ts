import React from 'react';

export interface Classroom {
    id: string;
    name: string;
    teacher_id?: string;
}

export interface Student {
    id: string;
    name: string;
    profile_pic_url?: string;
    selected: boolean;
    classroom_ids: string[];
    classroom_names?: string[];
}

export interface TaskSubmission {
    id: string;
    student_id: string;
    student_name: string;
    student_profile_pic_url?: string;
    task_id: string;
    task_title: string;
    task_description?: string;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved' | 'draft';
    submitted_at: string;
    video_url?: string;
    feedback_text?: string;
    score?: number;
    proficiency_level?: string;
    student_notes?: string;
    classroom_id?: string;
    classroom_name?: string;
    file_url?: string;
    file_name?: string;
    file_size?: string | number | null;
    due_date?: string | null;
    inventory_ref_id?: string | null;
    inventory_ref_title?: string | null;
    inventory_ref_type?: string | null;
}

export interface AssignmentBatch {
    assignmentId: string;
    taskTitle: string;
    taskDescription?: string;
    classroomName: string;
    classroomId?: string;
    targetType: string;
    dueDate?: string | null;
    createdAt?: string | null;
    isDraft: boolean;
    inventoryRefType?: string | null;
    inventoryRefId?: string | null;
    inventoryRefTitle?: string | null;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string | number | null;
    submissions: TaskSubmission[];
    totalCount: number;
    submittedCount: number;
    reviewedCount: number;
    approvedCount: number;
    pendingCount: number;
}

export interface TaskTemplateGroup {
    templateKey: string;
    taskTitle: string;
    taskDescription?: string;
    inventoryRefType?: string | null;
    inventoryRefId?: string | null;
    inventoryRefTitle?: string | null;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string | number | null;
    batches: AssignmentBatch[];
    totalStudents: number;
    submittedCount: number;
    reviewedCount: number;
    approvedCount: number;
    pendingCount: number;
    isDraftOnly: boolean;
}

export type TasksTab = 'review' | 'assignments' | 'templates' | 'completed';

export interface TeacherProfile {
    id?: string;
    name: string;
    email: string;
    phone?: string | null;
    role?: string;
    profile_pic_url?: string | null;
}

export function formatFileSize(size: number | string | null | undefined): string {
    if (!size) return '';
    if (typeof size === 'number') {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return String(size);
}

export function formatDateForInput(dateVal: any): string {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    if (str.includes('T')) return str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
