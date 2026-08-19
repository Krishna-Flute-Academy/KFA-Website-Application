/**
 * CSV Export utilities for Admin Reports (Fees and Role Allocation)
 * Uses UTF-8 BOM encoding so symbols (like ₹) and special characters open properly in Excel, Google Sheets, etc.
 */

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
    const escapeCsvCell = (cell: string | number | null | undefined): string => {
        if (cell === null || cell === undefined) return '""';
        const str = String(cell);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
    };

    const csvLines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map(row => row.map(escapeCsvCell).join(','))
    ];

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export interface StudentFeesExportData {
    id: string;
    name: string;
    email: string;
    phone: string;
    batch_name: string;
    fees_basis: string;
    fees_amount: number;
    fees_classes_paid: number;
    fees_collection_date: number | null;
    join_date: string;
    statusLabel?: string;
    collectedInPeriod?: number;
}

/**
 * Export Fees Management Report to CSV
 */
export function exportFeesCSV(
    students: StudentFeesExportData[],
    periodTitle: string,
    getStatusText?: (student: StudentFeesExportData) => string
) {
    const headers = [
        'Student Name',
        'Email',
        'Phone',
        'Batch / Class',
        'Billing Basis',
        'Fee Amount (₹)',
        'Prepaid Classes Left',
        'Collection Day / Date',
        'Standing / Fee Status',
        'Collected in Active Period (₹)',
        'Join Date'
    ];

    const rows = students.map(s => {
        const basisLabel = s.fees_basis === 'class' ? 'Per-Class' : 'Monthly';
        const collectionDayStr = s.fees_basis === 'monthly'
            ? (s.fees_collection_date ? `${s.fees_collection_date}th of month` : 'Unconfigured')
            : 'N/A';
        const statusStr = s.statusLabel || (getStatusText ? getStatusText(s) : 'Active');

        return [
            s.name || 'Unassigned',
            s.email || '',
            s.phone || '',
            s.batch_name || 'Unassigned',
            basisLabel,
            s.fees_amount || 0,
            s.fees_classes_paid ?? 0,
            collectionDayStr,
            statusStr,
            s.collectedInPeriod ?? 0,
            s.join_date || ''
        ];
    });

    const sanitizedTitle = periodTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `KFA_Fees_Report_${sanitizedTitle}_${dateStr}.csv`;

    downloadCSV(filename, headers, rows);
}

export interface UserRoleExportData {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    join_date: string | null;
    teacher_id: string | null;
    level: string | null;
    learning_mode?: string | null;
    fees_basis: string | null;
    fees_amount: number | null;
    fees_classes_paid: number | null;
    fees_collection_date: number | null;
    classroom_students?: {
        classroom_id: string;
        classrooms?: { name: string } | { name: string }[];
    }[];
}

interface ClassroomRef {
    id: string;
    name: string;
    teacher_id: string;
}

interface TeacherRef {
    id: string;
    name: string;
}

/**
 * Export Role Allocation / Registration Approvals Report to CSV
 */
export function exportRoleAllocationCSV(
    users: UserRoleExportData[],
    teachers: TeacherRef[],
    classrooms: ClassroomRef[],
    activeTabLabel: string = 'All Users'
) {
    const teacherMap = new Map<string, string>();
    teachers.forEach(t => teacherMap.set(t.id, t.name));

    const headers = [
        'User ID',
        'Full Name',
        'Email Address',
        'Phone Number',
        'Role',
        'Account Status',
        'Assigned Teacher',
        'Batch / Classroom',
        'Experience Level',
        'Learning Mode',
        'Billing Plan',
        'Fee Amount (₹)',
        'Classes Paid',
        'Collection Day',
        'Join Date'
    ];

    const rows = users.map(u => {
        const teacherName = u.teacher_id ? (teacherMap.get(u.teacher_id) || 'Unassigned') : 'N/A';

        const cData = u.classroom_students?.[0]?.classrooms;
        const className = Array.isArray(cData)
            ? (cData[0] as any)?.name || 'Unassigned'
            : (cData as any)?.name || 'Unassigned';

        const billingPlan = u.fees_basis === 'monthly' ? 'Monthly' : u.fees_basis === 'class' ? 'Per-Class' : 'N/A';
        const collectionDay = u.fees_collection_date ? `${u.fees_collection_date}th` : 'N/A';

        return [
            u.id,
            u.name || 'Unassigned',
            u.email || '',
            u.phone || '',
            u.role || 'pending',
            u.status || 'active',
            teacherName,
            className,
            u.level || 'N/A',
            u.learning_mode || 'N/A',
            billingPlan,
            u.fees_amount ?? 0,
            u.fees_classes_paid ?? 0,
            collectionDay,
            u.join_date || ''
        ];
    });

    const sanitizedTab = activeTabLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `KFA_Role_Allocation_Report_${sanitizedTab}_${dateStr}.csv`;

    downloadCSV(filename, headers, rows);
}
