import { getStudentFeeStatus } from '../src/lib/fee-utils';

// Simple testing framework
function assertEqual(actual: any, expected: any, message: string) {
    if (actual === expected) {
        console.log(`✅ PASS: ${message}`);
    } else {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
        process.exit(1);
    }
}

function runTests() {
    console.log('--- Fee Status Calculations Unit Tests (TS) ---');

    // Test Case 1: 3 days before due date (Unpaid)
    // Today: 24 June, Due Day: 27. Expected: 'upcoming' status, due on 27 June.
    {
        const today = new Date('2026-06-24T12:00:00');
        const payments: any[] = [];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'upcoming', 'June 24 status should be upcoming');
        assertEqual(result?.formattedDueDate, '27 June', 'June 24 formatted due date should be 27 June');
        assertEqual(result?.diffDays, 3, 'June 24 difference in days should be 3');
    }

    // Test Case 2: On the due date (Unpaid)
    // Today: 27 June, Due Day: 27. Expected: 'due' status, due today.
    {
        const today = new Date('2026-06-27T12:00:00');
        const payments: any[] = [];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'due', 'June 27 status should be due');
        assertEqual(result?.formattedDueDate, '27 June', 'June 27 formatted due date should be 27 June');
        assertEqual(result?.diffDays, 0, 'June 27 difference in days should be 0');
    }

    // Test Case 3: After the due date (Unpaid)
    // Today: 28 June, Due Day: 27. Expected: 'overdue' status, due on 27 June.
    {
        const today = new Date('2026-06-28T12:00:00');
        const payments: any[] = [];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'overdue', 'June 28 status should be overdue');
        assertEqual(result?.formattedDueDate, '27 June', 'June 28 formatted due date should be 27 June');
        assertEqual(result?.diffDays, -1, 'June 28 difference in days should be -1');
    }

    // Test Case 4: Paid on the due date (Paid early or on time)
    // Today: 27 June, Due Day: 27. Paid: 27 June. Expected: 'good' status, next due date: 27 July.
    {
        const today = new Date('2026-06-27T12:00:00');
        const payments = [{ payment_date: '2026-06-27' }];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'good', 'Paid on time: status should be good');
        assertEqual(result?.formattedDueDate, '27 July', 'Paid on time: next due date should be 27 July');
    }

    // Test Case 5: Paid late (Overdue and then paid)
    // Today: 28 June, Due Day: 27. Paid: 28 June. Expected: 'good' status, next due date: 27 July.
    {
        const today = new Date('2026-06-28T12:00:00');
        const payments = [{ payment_date: '2026-06-28' }];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'good', 'Paid late: status should be good');
        assertEqual(result?.formattedDueDate, '27 July', 'Paid late: next due date should be 27 July');
    }

    // Test Case 6: Paid early (Before due date)
    // Today: 24 June, Due Day: 27. Paid: 20 June. Expected: 'good' status, next due date: 27 July.
    {
        const today = new Date('2026-06-24T12:00:00');
        const payments = [{ payment_date: '2026-06-20' }];
        const result = getStudentFeeStatus('monthly', 27, payments, today);
        
        assertEqual(result?.status, 'good', 'Paid early: status should be good');
        assertEqual(result?.formattedDueDate, '27 July', 'Paid early: next due date should be 27 July');
    }

    // Test Case 7: Clamping month-end dates (e.g. Due day 31, in February)
    // Today: 25 February 2026, Due Day: 31. Expected: due on 28 February 2026.
    {
        const today = new Date('2026-02-25T12:00:00');
        const payments: any[] = [];
        const result = getStudentFeeStatus('monthly', 31, payments, today);
        
        assertEqual(result?.status, 'upcoming', 'Feb 25 status should be upcoming for Feb 28 due date');
        assertEqual(result?.formattedDueDate, '28 February', 'Feb 25 due date should clamp to 28 February');
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests();
