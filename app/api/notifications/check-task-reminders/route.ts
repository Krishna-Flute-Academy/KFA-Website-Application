import { NextResponse } from 'next/server';
import { checkAndSendTaskDueReminders } from '../../../../src/lib/task-reminders';

export async function GET() {
    try {
        const result = await checkAndSendTaskDueReminders();
        return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: err?.message || err }, { status: 500 });
    }
}

export async function POST() {
    try {
        const result = await checkAndSendTaskDueReminders();
        return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal Server Error', details: err?.message || err }, { status: 500 });
    }
}
