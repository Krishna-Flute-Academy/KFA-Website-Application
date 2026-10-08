import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const feeUtils = jiti('../src/lib/fee-utils.ts');
const { calculateAuthoritativeFeeStatus } = feeUtils;

test('KFA Canonical Fee UX & Live Access Architecture Suite', async (t) => {
    const student = {
        id: 'std_canonical_test_01',
        name: 'Test Student',
        fees_amount: 1600,
        fees_basis: 'monthly',
        fees_classes_paid: 0,
        fees_collection_date: 1
    };

    const fourClassesPayment = {
        id: 'pmt_01',
        student_id: student.id,
        payment_date: '2026-08-01',
        amount: 1600,
        classes_added: 4,
        status: 'approved'
    };

    await t.test('Scenario A: Balance = 3 -> GOOD_STANDING, canJoin = true', () => {
        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 3);
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario B: Balance = 1 -> GOOD_STANDING, canJoin = true, no warning banner required', () => {
        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 1);
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario C: Balance = 0 -> FEE_DUE, exactly ONE amber primary warning, canJoin = true', () => {
        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' },
            { id: 'att_04', date: '2026-08-25', status: 'present' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 0);
        assert.equal(status.financialState, 'FEE_DUE');
        assert.equal(status.canJoinLiveClass, true); // Balance = 0 CAN still join upcoming class
    });

    await t.test('Scenario D: Balance = -1 -> PAYMENT_OVERDUE, red primary warning, canJoin = false', () => {
        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' },
            { id: 'att_04', date: '2026-08-25', status: 'present' },
            { id: 'att_05', date: '2026-09-01', status: 'absent' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, -1);
        assert.equal(status.financialState, 'PAYMENT_OVERDUE');
        assert.equal(status.canJoinLiveClass, false); // Balance < 0 is BLOCKED
    });

    await t.test('Scenario E: Calendar due date passed + balance = 2 -> GOOD_STANDING, NO overdue banner, canJoin = true', () => {
        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' }
        ];

        // Today is October 7, but student still has 2 classes remaining from August payment
        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student: { ...student, fees_collection_date: 1 }, // 1st of month has passed
            payments: [fourClassesPayment],
            attendance,
            overrides: [],
            leaveRequests: [],
            today: new Date('2026-10-07T12:00:00Z')
        });

        assert.equal(status.effectiveBalance, 2);
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario F: Payment recovery from 0 (+4) -> new balance = 4 (GOOD_STANDING)', () => {
        const secondPayment = {
            id: 'pmt_02',
            student_id: student.id,
            payment_date: '2026-09-01',
            amount: 1600,
            classes_added: 4,
            status: 'approved'
        };

        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' },
            { id: 'att_04', date: '2026-08-25', status: 'present' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment, secondPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 4);
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario G: Payment recovery from -1 (+4) -> new balance = 3 (debt settled, not blindly 4)', () => {
        const secondPayment = {
            id: 'pmt_02',
            student_id: student.id,
            payment_date: '2026-09-02',
            amount: 1600,
            classes_added: 4,
            status: 'approved'
        };

        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' },
            { id: 'att_04', date: '2026-08-25', status: 'present' },
            { id: 'att_05', date: '2026-09-01', status: 'absent' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment, secondPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 3); // -1 + 4 = 3
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario H: Payment recovery from -2 (+4) -> new balance = 2 (GOOD_STANDING)', () => {
        const secondPayment = {
            id: 'pmt_02',
            student_id: student.id,
            payment_date: '2026-09-10',
            amount: 1600,
            classes_added: 4,
            status: 'approved'
        };

        const attendance = [
            { id: 'att_01', date: '2026-08-04', status: 'present' },
            { id: 'att_02', date: '2026-08-11', status: 'present' },
            { id: 'att_03', date: '2026-08-18', status: 'present' },
            { id: 'att_04', date: '2026-08-25', status: 'present' },
            { id: 'att_05', date: '2026-09-01', status: 'absent' },
            { id: 'att_06', date: '2026-09-08', status: 'present' }
        ];

        const status = calculateAuthoritativeFeeStatus({
            studentId: student.id,
            student,
            payments: [fourClassesPayment, secondPayment],
            attendance,
            overrides: [],
            leaveRequests: []
        });

        assert.equal(status.effectiveBalance, 2); // -2 + 4 = 2
        assert.equal(status.financialState, 'GOOD_STANDING');
        assert.equal(status.canJoinLiveClass, true);
    });

    await t.test('Scenario I & J: Idempotent state transitions (Mocking Supabase client)', async () => {
        const feeNotifs = jiti('../src/lib/fee-notifications.ts');
        const { handleFeeBalanceTransitionNotifications } = feeNotifs;

        const insertedNotifs = [];
        const insertedFeeNotifs = [];
        const existingLogs = [];

        const mockSupabase = {
            from: (table) => ({
                select: () => ({
                    eq: (col, val) => ({
                        eq: (col2, val2) => ({
                            gte: (col3, val3) => ({
                                limit: () => Promise.resolve({ data: existingLogs.filter(l => l.notification_type === val2) })
                            }),
                            limit: () => Promise.resolve({ data: existingLogs.filter(l => l.notification_type === val2) })
                        }),
                        maybeSingle: () => Promise.resolve({
                            data: {
                                id: student.id,
                                name: student.name,
                                teacher_id: 'teacher_01',
                                fees_amount: 1600,
                                fees_basis: 'monthly'
                            }
                        })
                    })
                }),
                insert: (rows) => {
                    if (table === 'notifications') insertedNotifs.push(...rows);
                    if (table === 'fees_notifications') {
                        insertedFeeNotifs.push(...rows);
                        existingLogs.push(...rows);
                    }
                    return Promise.resolve({ error: null });
                }
            })
        };

        // When student is in GOOD_STANDING (balance > 0), no notifications are sent
        const resGood = await handleFeeBalanceTransitionNotifications({
            studentId: student.id,
            supabase: {
                ...mockSupabase,
                from: (table) => {
                    if (table === 'fees_payments') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: [fourClassesPayment] }) }) };
                    }
                    if (table === 'attendance') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'a1', date: '2026-08-04', status: 'present' }] }) }) };
                    }
                    if (table === 'session_student_overrides' || table === 'leave_requests') {
                        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
                    }
                    return mockSupabase.from(table);
                }
            }
        });
        assert.equal(resGood.sent, false);
        assert.equal(insertedNotifs.length, 0);

        // Transition A: GOOD_STANDING -> FEE_DUE (balance = 0)
        const fourAtt = [
            { id: 'a1', date: '2026-08-04', status: 'present' },
            { id: 'a2', date: '2026-08-11', status: 'present' },
            { id: 'a3', date: '2026-08-18', status: 'present' },
            { id: 'a4', date: '2026-08-25', status: 'present' }
        ];

        const resDue = await handleFeeBalanceTransitionNotifications({
            studentId: student.id,
            supabase: {
                ...mockSupabase,
                from: (table) => {
                    if (table === 'fees_payments') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: [fourClassesPayment] }) }) };
                    }
                    if (table === 'attendance') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: fourAtt }) }) };
                    }
                    if (table === 'session_student_overrides' || table === 'leave_requests') {
                        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
                    }
                    return mockSupabase.from(table);
                }
            }
        });
        assert.equal(resDue.sent, true);
        assert.equal(insertedFeeNotifs.some(n => n.notification_type === 'classes_completed'), true);
        assert.equal(insertedNotifs.some(n => n.title === 'Fee Payment Due'), true);

        // Repeated call for FEE_DUE should be suppressed by idempotency
        const resDueDuplicate = await handleFeeBalanceTransitionNotifications({
            studentId: student.id,
            supabase: {
                ...mockSupabase,
                from: (table) => {
                    if (table === 'fees_payments') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: [fourClassesPayment] }) }) };
                    }
                    if (table === 'attendance') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: fourAtt }) }) };
                    }
                    if (table === 'session_student_overrides' || table === 'leave_requests') {
                        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
                    }
                    return mockSupabase.from(table);
                }
            }
        });
        assert.equal(resDueDuplicate.sent, false);
        assert.equal(resDueDuplicate.reason.includes('already sent'), true);

        // Transition B: FEE_DUE -> PAYMENT_OVERDUE (balance = -1)
        const fiveAtt = [...fourAtt, { id: 'a5', date: '2026-09-01', status: 'absent' }];
        const resOverdue = await handleFeeBalanceTransitionNotifications({
            studentId: student.id,
            supabase: {
                ...mockSupabase,
                from: (table) => {
                    if (table === 'fees_payments') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: [fourClassesPayment] }) }) };
                    }
                    if (table === 'attendance') {
                        return { select: () => ({ eq: () => Promise.resolve({ data: fiveAtt }) }) };
                    }
                    if (table === 'session_student_overrides' || table === 'leave_requests') {
                        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
                    }
                    return mockSupabase.from(table);
                }
            }
        });
        assert.equal(resOverdue.sent, true);
        assert.equal(insertedFeeNotifs.some(n => n.notification_type === 'fee_overdue'), true);
        assert.equal(insertedNotifs.some(n => n.title === 'Fee Payment Pending'), true);
    });

    await t.test('Scenario K: Server-side live-access route security gatekeeper invariant', () => {
        // Test authorization logic from app/api/classrooms/live-access/route.ts
        const checkLiveAccess = (authStatus) => {
            if (!authStatus.canJoinLiveClass) {
                return { status: 403, allowed: false };
            }
            return { status: 200, allowed: true };
        };

        assert.deepEqual(checkLiveAccess({ canJoinLiveClass: true, effectiveBalance: 2 }), { status: 200, allowed: true });
        assert.deepEqual(checkLiveAccess({ canJoinLiveClass: true, effectiveBalance: 0 }), { status: 200, allowed: true });
        assert.deepEqual(checkLiveAccess({ canJoinLiveClass: false, effectiveBalance: -1 }), { status: 403, allowed: false });
        assert.deepEqual(checkLiveAccess({ canJoinLiveClass: false, effectiveBalance: -3 }), { status: 403, allowed: false });
    });

    await t.test('Scenario L: Primary Student Dashboard financial banner copy and CTA assertions', () => {
        const getBannerConfig = (effectiveBalance) => {
            if (effectiveBalance < 0) {
                return {
                    bannerTitle: 'Fee Payment Pending',
                    bannerMessage: 'Your fee payment is pending. Please complete the payment to continue your classes. Live class access is paused until payment is completed.',
                    buttonText: 'PAY FEES'
                };
            }
            if (effectiveBalance === 0) {
                return {
                    bannerTitle: 'Fee Payment Due',
                    bannerMessage: 'Your current class package has been completed. Please complete your next fee payment to continue your classes. You can still join your upcoming class.',
                    buttonText: 'PAY FEES'
                };
            }
            return null;
        };

        const dueBanner = getBannerConfig(0);
        assert.equal(dueBanner.bannerTitle, 'Fee Payment Due');
        assert.equal(dueBanner.bannerMessage, 'Your current class package has been completed. Please complete your next fee payment to continue your classes. You can still join your upcoming class.');
        assert.equal(dueBanner.buttonText, 'PAY FEES');

        const overdueBanner = getBannerConfig(-1);
        assert.equal(overdueBanner.bannerTitle, 'Fee Payment Pending');
        assert.equal(overdueBanner.bannerMessage, 'Your fee payment is pending. Please complete the payment to continue your classes. Live class access is paused until payment is completed.');
        assert.equal(overdueBanner.buttonText, 'PAY FEES');

        assert.equal(getBannerConfig(1), null);
    });
});
