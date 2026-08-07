'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAuth } from '../../src/lib/supabase-auth';

export default function DebugPranshuPage() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [studentInfo, setStudentInfo] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [overrides, setOverrides] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                setSession(session);
                if (!session) {
                    setError("No session found. Please make sure you are logged in to the teacher/admin dashboard first.");
                    setLoading(false);
                    return;
                }

                // Query Pranshu
                const { data: students, error: sErr } = await supabaseAuth
                    .from('users')
                    .select('*')
                    .ilike('name', '%Pranshu%');

                if (sErr) throw sErr;
                if (!students || students.length === 0) {
                    setError("No student named 'Pranshu' found in the database.");
                    setLoading(false);
                    return;
                }

                const pranshu = students[0];
                setStudentInfo(pranshu);

                // Fetch attendance
                const { data: attData, error: attErr } = await supabaseAuth
                    .from('attendance')
                    .select('*')
                    .eq('student_id', pranshu.id)
                    .order('date', { ascending: false });
                if (attErr) throw attErr;
                setAttendance(attData || []);

                // Fetch leaves
                const { data: leaveData, error: leaveErr } = await supabaseAuth
                    .from('leave_requests')
                    .select('*')
                    .eq('student_id', pranshu.id)
                    .order('class_date', { ascending: false });
                if (leaveErr) throw leaveErr;
                setLeaves(leaveData || []);

                // Fetch overrides
                const { data: overData, error: overErr } = await supabaseAuth
                    .from('session_student_overrides')
                    .select('*')
                    .eq('student_id', pranshu.id)
                    .order('override_date', { ascending: false });
                if (overErr) throw overErr;
                setOverrides(overData || []);

            } catch (err: any) {
                console.error(err);
                setError(err.message || String(err));
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    if (loading) {
        return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading debug data...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: 40, fontFamily: 'sans-serif', color: 'red' }}>
                <h2>Debug Error</h2>
                <p>{error}</p>
                <p>Verify you are running in dev mode and logged in as admin.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: 40, fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh' }}>
            <h1>Pranshu Debug Panel</h1>
            <p>Logged in as: <strong>{session?.user?.email}</strong></p>

            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2>Student Profile</h2>
                <pre>{JSON.stringify(studentInfo, null, 2)}</pre>
            </div>

            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2>Attendance Records ({attendance.length})</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: 8 }}>ID</th>
                            <th style={{ padding: 8 }}>Classroom ID</th>
                            <th style={{ padding: 8 }}>Date</th>
                            <th style={{ padding: 8 }}>Status</th>
                            <th style={{ padding: 8 }}>Marked By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendance.map((att) => (
                            <tr key={att.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: 8 }}>{att.id}</td>
                                <td style={{ padding: 8 }}>{att.classroom_id}</td>
                                <td style={{ padding: 8 }}>{att.date}</td>
                                <td style={{ padding: 8, fontWeight: 'bold', color: att.status === 'excused' ? 'orange' : 'red' }}>{att.status}</td>
                                <td style={{ padding: 8 }}>{att.marked_by}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2>Leave Requests ({leaves.length})</h2>
                <pre>{JSON.stringify(leaves, null, 2)}</pre>
            </div>

            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2>Session Overrides ({overrides.length})</h2>
                <pre>{JSON.stringify(overrides, null, 2)}</pre>
            </div>
        </div>
    );
}
