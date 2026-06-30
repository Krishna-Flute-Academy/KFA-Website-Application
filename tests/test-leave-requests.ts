// Test leave request validation logic
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

function checkLeaveAdvanceDays(dateStr: string, today: Date) {
    today.setHours(0, 0, 0, 0);
    
    const selectedClassDate = new Date(dateStr);
    selectedClassDate.setHours(0, 0, 0, 0);

    const diffTime = selectedClassDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function runTests() {
    console.log('--- Leave Requests 1-Day Advance Check Tests ---');

    const today = new Date('2026-06-27T12:00:00');

    // Test Case 1: Requesting tomorrow (succeeds)
    {
        const diffDays = checkLeaveAdvanceDays('2026-06-28', today);
        assertEqual(diffDays >= 1, true, 'Request for tomorrow should succeed');
    }

    // Test Case 2: Requesting today (fails)
    {
        const diffDays = checkLeaveAdvanceDays('2026-06-27', today);
        assertEqual(diffDays >= 1, false, 'Request for today should fail');
    }

    // Test Case 3: Requesting yesterday (fails)
    {
        const diffDays = checkLeaveAdvanceDays('2026-06-26', today);
        assertEqual(diffDays >= 1, false, 'Request for yesterday should fail');
    }

    // Test Case 4: Requesting 10 days from now (succeeds)
    {
        const diffDays = checkLeaveAdvanceDays('2026-07-07', today);
        assertEqual(diffDays >= 1, true, 'Request for next week should succeed');
    }

    console.log('\n🎉 ALL LEAVE REQUEST VALIDATION TESTS PASSED!');
}

runTests();
