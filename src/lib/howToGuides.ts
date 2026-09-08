/**
 * Types and defaults for Student How-To Guides
 */

export interface HowToStep {
    order: number;
    text: string;
}

export interface HowToMethod {
    key: string;
    title: string;
    shortTitle?: string;
    description: string;
    badge?: string;
    iconName?: 'youtube' | 'drive' | 'upload';
    requiresTeacherAccess: boolean;
    teacherEmail?: string;
    steps: HowToStep[];
    importantNote?: string;
}

export interface HowToGuide {
    id: string;
    slug: string;
    title: string;
    description: string;
    video_url?: string | null;
    steps: (HowToStep | HowToMethod)[];
    related_policy_id?: string | null;
    display_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * Check if a guide uses method-based/grouped steps (e.g. YouTube, Google Drive, Portal Upload)
 */
export function isMethodBasedGuide(guideOrSteps: HowToGuide | (HowToStep | HowToMethod)[] | undefined | null): boolean {
    if (!guideOrSteps) return false;
    const steps = Array.isArray(guideOrSteps) ? guideOrSteps : guideOrSteps.steps;
    if (!steps || steps.length === 0) return false;
    const first = steps[0] as any;
    return Boolean(first && typeof first === 'object' && Array.isArray(first.steps));
}

export const TEACHER_SUBMISSION_EMAIL = 'kgbhaumik86@gmail.com';

export const DEFAULT_HOW_TO_GUIDES: HowToGuide[] = [
    {
        id: 'how-to-apply-leave',
        slug: 'how-to-apply-leave',
        title: 'How to Apply for Leave',
        description: 'Learn how to inform KFA and request an excused absence when you cannot attend a scheduled class.',
        video_url: null,
        steps: [
            { order: 1, text: 'Open "Attendance & Leave" from the student dashboard navigation menu.' },
            { order: 2, text: 'Click the "Inform Absence / Request Excuse" button in the tracker header (or click "Apply for Excuse" on an upcoming class alert banner).' },
            { order: 3, text: 'In the "Class Leave Request" modal, select your Absence Date (leaves can only be requested for dates with a scheduled class, at least 24 hours in advance).' },
            { order: 4, text: 'Enter your Reason / Notes in the text field explaining why you will be unable to attend.' },
            { order: 5, text: 'Click "Submit Excuse Request" to log your absence with the academy.' },
            { order: 6, text: 'Your request starts with "Pending" status. Once reviewed and approved by your teacher or admin, it records an "Excused Absence" on your calendar. You may then coordinate for an alternative/makeup slot subject to teacher availability and current academy policy rules (makeup classes are not guaranteed and must be completed within the current billing cycle).' }
        ],
        related_policy_id: 'attendance',
        display_order: 1,
        is_active: true
    },
    {
        id: 'how-to-submit-task',
        slug: 'how-to-submit-task',
        title: 'How to Submit a Task',
        description: 'Choose your preferred submission method: YouTube unlisted link, Google Drive shared link, or upload via the portal.',
        video_url: null,
        steps: [
            {
                key: 'youtube',
                title: 'YouTube — Unlisted Video',
                shortTitle: 'YouTube Unlisted',
                description: 'Fastest method. Upload to YouTube, set to Unlisted, and paste the video link.',
                badge: 'Recommended',
                iconName: 'youtube',
                requiresTeacherAccess: false,
                steps: [
                    { order: 1, text: 'Record your flute practice on your phone or camera.' },
                    { order: 2, text: 'Open YouTube (or the YouTube mobile app) and select "Upload Video".' },
                    { order: 3, text: 'Set video visibility to "Unlisted". (IMPORTANT: Do NOT choose "Private", or the teacher will not be able to open or evaluate your video).' },
                    { order: 4, text: 'Publish the upload and tap "Copy Link" to copy your video URL.' },
                    { order: 5, text: 'Return to the KFA Student Dashboard and open "Tasks & Submissions".' },
                    { order: 6, text: 'Select your assigned task and click the "Submit" (or "Resubmit") button.' },
                    { order: 7, text: 'In the submission window, ensure the "Provide Link" tab is selected and paste your copied YouTube URL.' },
                    { order: 8, text: 'Click "Submit Recording". Your task status immediately updates to "Submitted".' }
                ],
                importantNote: 'Why "Unlisted"? An unlisted YouTube video does NOT appear on your public channel or in search results. Anyone without the exact link cannot find it, keeping your riyaaz private while enabling your KFA instructor to review it.'
            } as any,
            {
                key: 'google-drive',
                title: 'Google Drive — Shared Folder/File',
                shortTitle: 'Google Drive',
                description: 'Upload to your Google Drive and share viewing permission with the teacher.',
                badge: 'Access Required',
                iconName: 'drive',
                requiresTeacherAccess: true,
                teacherEmail: TEACHER_SUBMISSION_EMAIL,
                steps: [
                    { order: 1, text: 'Open Google Drive (drive.google.com).' },
                    { order: 2, text: 'Create a folder preferably named: "KFA TASK SUBMISSION - [Your Name]" (or locate your recorded video file).' },
                    { order: 3, text: 'Upload your practice recording file into this folder.' },
                    { order: 4, text: 'Right-click the folder or file, select "Share" → "Share".' },
                    { order: 5, text: `In the "Add people" box, enter teacher email: ${TEACHER_SUBMISSION_EMAIL}` },
                    { order: 6, text: 'Ensure the permission role is set to "Viewer" and click "Send" or "Done" to grant access.' },
                    { order: 7, text: 'Click "Copy Link" to copy the Google Drive share link.' },
                    { order: 8, text: 'Open "Tasks & Submissions" in the KFA portal, click on your task, and click "Submit" (or "Resubmit").' },
                    { order: 9, text: 'Select the "Provide Link" tab, paste your Google Drive URL into the link box, and click "Submit Recording".' }
                ],
                importantNote: `IMPORTANT: Pasting a Google Drive link alone does NOT automatically grant permission. You must explicitly share the file or folder with ${TEACHER_SUBMISSION_EMAIL}, otherwise the instructor will receive an "Access Denied" error and cannot grade your assignment.`
            } as any,
            {
                key: 'portal-upload',
                title: 'Upload from Portal (Google Drive Picker)',
                shortTitle: 'Upload from Portal',
                description: 'Select your recording file directly through the portal submission modal using the Google Drive Picker.',
                badge: 'Access Required',
                iconName: 'upload',
                requiresTeacherAccess: true,
                teacherEmail: TEACHER_SUBMISSION_EMAIL,
                steps: [
                    { order: 1, text: 'Open "Tasks & Submissions" from the student dashboard menu.' },
                    { order: 2, text: 'Click on your assigned task card to view the brief and Sargam notation notes.' },
                    { order: 3, text: 'Click the "Submit" (or "Resubmit") button to open the submission window.' },
                    { order: 4, text: 'In the modal, click the "Upload Video" tab (located right next to "Provide Link").' },
                    { order: 5, text: 'Click "Open Google Drive Picker" and authorize your Google account if prompted.' },
                    { order: 6, text: 'Browse and select your practice recording video file from Google Drive.' },
                    { order: 7, text: 'The selected file name and size will attach to the submission modal.' },
                    { order: 8, text: `Ensure Teacher Access: The portal attaches your file URL, but does NOT alter your Drive permissions. Verify that your file is shared with ${TEACHER_SUBMISSION_EMAIL} on Google Drive.` },
                    { order: 9, text: 'Click "Submit Recording" to complete your submission.' }
                ],
                importantNote: `IMPORTANT: Selecting a file in the portal Drive Picker links the file to your assignment, but does NOT bypass Google Drive privacy settings. Always ensure ${TEACHER_SUBMISSION_EMAIL} has been granted viewing access in your Google Drive.`
            } as any
        ],
        related_policy_id: null,
        display_order: 2,
        is_active: true
    }
];

export const POLICY_ID_NAMES: Record<string, string> = {
    'conduct': 'General Conduct & Riyaaz',
    'attendance': 'Attendance & Leaves Policy',
    'fees': 'Fees & Payments Policy',
    'ip': 'Learning Materials & Copyright',
    'progress': 'Student Progress & Evaluation'
};

/**
 * Helper to find a guide by slug or id from a list (or fall back to defaults)
 */
export function findGuideBySlugOrId(identifier: string, guides?: HowToGuide[]): HowToGuide | null {
    const list = (guides && guides.length > 0) ? guides : DEFAULT_HOW_TO_GUIDES;
    return list.find(g => g.slug === identifier || g.id === identifier) || null;
}
