import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return import(encodedModule);
}

const { calculateAuthoritativeFeeStatus, evaluateStudentFeeCycle } = await importTypeScriptModule('../src/lib/fee-utils.ts');

const baseStudent = {
  id: 'aarav-uuid',
  name: 'Aarav',
  role: 'student',
  status: 'active',
  fees_basis: 'monthly',
  fees_amount: 3000,
  fees_collection_date: 1,
  fees_classes_paid: 4,
  join_date: '2026-08-01'
};

test('1. Payment +4 credits establishes GOOD_STANDING and balance 4', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance: [],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.totalPurchasedCredits, 4);
  assert.equal(status.effectiveBalance, 4);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('2. First class attended decrements balance to 3 (GOOD_STANDING)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' }];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 3);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('3. Second class attended decrements balance to 2 (GOOD_STANDING)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 2);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('4. Third class attended decrements balance to 1 (GOOD_STANDING, NO reminder trigger)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 1);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('5. Fourth class attended decrements balance to exactly 0 (FEE_DUE, live access allowed)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 0);
  assert.equal(status.financialState, 'FEE_DUE');
  assert.equal(status.canJoinLiveClass, true);
});

test('6. Month change without payment NEVER manufactures credits (September remains balance 0)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: [],
    today: new Date('2026-09-01T00:00:00Z')
  });
  assert.equal(status.effectiveBalance, 0);
  assert.equal(status.totalPurchasedCredits, 4);
});

test('7. Absent class decrements balance by 1 just like Present', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'absent' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 2);
});

test('8. Late class decrements balance by 1', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'late' }];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 3);
});

test('9. Attendance at balance 0 transitions balance to -1 (PAYMENT_OVERDUE)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' },
    { id: 'a5', student_id: 'aarav-uuid', date: '2026-09-01', status: 'absent' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, -1);
  assert.equal(status.financialState, 'PAYMENT_OVERDUE');
});

test('10. Balance < 0 sets canJoinLiveClass to false (server/client live restriction)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' },
    { id: 'a5', student_id: 'aarav-uuid', date: '2026-09-01', status: 'absent' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.canJoinLiveClass, false);
});

test('11. Balance < 0 DOES NOT set student status to inactive (account remains active)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' },
    { id: 'a5', student_id: 'aarav-uuid', date: '2026-09-01', status: 'absent' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(baseStudent.status, 'active');
  assert.equal(status.financialState, 'PAYMENT_OVERDUE');
});

test('12. Reconciled Excused Leave and Guest Makeup count as exactly ONE deduction (no double counting)', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-09-08', status: 'excused' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-09-09', status: 'present', on_behalf_of_date: '2026-09-08' }
  ];
  const overrides = [
    { id: 'o1', student_id: 'aarav-uuid', override_date: '2026-09-09', makeup_for_date: '2026-09-08' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides,
    leaveRequests: []
  });
  // 4 credits - 1 net class = 3 credits remaining
  assert.equal(status.effectiveBalance, 3);
});

test('13. Unlinked Excused absence with approved leave request does NOT consume credit', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-09-08', status: 'excused' }
  ];
  const leaveRequests = [
    { id: 'l1', student_id: 'aarav-uuid', class_date: '2026-09-08', status: 'approved' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests
  });
  assert.equal(status.effectiveBalance, 4);
});

test('14. Subsequent payment at balance -1 strictly adds +4 arithmetically (-1 + 4 = 3, never capped or reset to 4)', () => {
  const payments = [
    { id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' },
    { id: 'p2', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-09-05', status: 'approved' }
  ];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' },
    { id: 'a5', student_id: 'aarav-uuid', date: '2026-09-01', status: 'absent' }
  ];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  // 8 total purchased - 5 consumed = 3
  assert.equal(status.totalPurchasedCredits, 8);
  assert.equal(status.effectiveBalance, 3);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('15. Discrepancy detection flags mismatch between stored fees_classes_paid and authoritative balance', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' }
  ];
  // Stored says 2, but actual is 0!
  const studentWithDiscrepancy = { ...baseStudent, fees_classes_paid: 2 };
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: studentWithDiscrepancy,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 0);
  assert.equal(status.needsReconciliation, true);
});

test('16. Terminology check: no forbidden grace class terms in authoritative status', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments,
    attendance: [],
    overrides: [],
    leaveRequests: []
  });
  const serialized = JSON.stringify(status).toLowerCase();
  assert.ok(!serialized.includes('grace'));
  assert.ok(!serialized.includes('complimentary'));
});

test('17. evaluateStudentFeeCycle strictly respects calculateAuthoritativeFeeStatus creditsRemaining', () => {
  const payments = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  const attendance = [
    { id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' },
    { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' }
  ];
  const report = evaluateStudentFeeCycle({
    student: baseStudent,
    attendance,
    payments,
    today: new Date('2026-09-01T00:00:00Z'),
    classrooms: [],
    batchSchedules: [],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(report.metrics.creditsRemaining, 0);
  assert.equal(report.metrics.financialState, 'FEE_DUE');
});

test('18. Student pause and resumption: +4 paid, 4 consumed, pause 1 month, resume with +4 payment, 1 consumed -> balance 3, GOOD_STANDING, live access allowed, not overdue', () => {
  const trishaStudent = {
    id: 'trisha-uuid',
    name: 'Trisha Das',
    role: 'student',
    status: 'active',
    fees_basis: 'monthly',
    fees_amount: 2400,
    fees_collection_date: 1,
    fees_classes_paid: 3,
    join_date: '2026-08-01',
    notes: '[Resumed 2026-10-06]'
  };

  // 1 Aug advance payment +4, 6 Oct advance payment +4
  const payments = [
    { id: 'p1', student_id: 'trisha-uuid', amount: 2400, classes_added: 4, payment_date: '2026-08-01', status: 'approved' },
    { id: 'p2', student_id: 'trisha-uuid', amount: 2400, classes_added: 4, payment_date: '2026-10-06', status: 'approved' }
  ];

  // 4 classes consumed in August, 0 in September (paused), 1 on 6 Oct
  const attendance = [
    { id: 'a1', student_id: 'trisha-uuid', date: '2026-08-04', status: 'present' },
    { id: 'a2', student_id: 'trisha-uuid', date: '2026-08-11', status: 'present' },
    { id: 'a3', student_id: 'trisha-uuid', date: '2026-08-18', status: 'absent' },
    { id: 'a4', student_id: 'trisha-uuid', date: '2026-08-25', status: 'absent' },
    { id: 'a5', student_id: 'trisha-uuid', date: '2026-10-06', status: 'present' }
  ];

  // 1. Authoritative status calculation
  const status = calculateAuthoritativeFeeStatus({
    studentId: 'trisha-uuid',
    student: trishaStudent,
    payments,
    attendance,
    overrides: [],
    leaveRequests: []
  });

  assert.equal(status.totalPurchasedCredits, 8);
  assert.equal(status.effectiveBalance, 3);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);

  // 2. Full cycle evaluation (UI display & billing cycle)
  const report = evaluateStudentFeeCycle({
    student: trishaStudent,
    attendance,
    payments,
    today: new Date('2026-10-06T18:00:00Z'),
    classrooms: [],
    batchSchedules: [],
    overrides: [],
    leaveRequests: []
  });

  assert.equal(report.metrics.creditsRemaining, 3);
  assert.equal(report.metrics.financialState, 'GOOD_STANDING');
  assert.equal(report.metrics.classesAvailable, 3);
  assert.equal(report.paymentStatus, 'good');
  assert.equal(report.canJoinLiveClass, true);
  assert.ok(report.formattedDueDate.includes('3 classes'));
  assert.notEqual(report.formattedDueDate, '1 September');
  assert.notEqual(report.formattedDueDate, '1 Sep 2026');
});

test('19. Explicit Global Verification: Balance 4 -> 3 -> 2 -> 1 -> 0 -> -1 -> 3 progression', () => {
  // Test Balance 4
  const p1 = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];
  let status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: [],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 4);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);

  // Test Balance 3
  const att1 = [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: att1,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 3);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);

  // Test Balance 2
  const att2 = [...att1, { id: 'a2', student_id: 'aarav-uuid', date: '2026-08-11', status: 'present' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: att2,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 2);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);

  // Test Balance 1
  const att3 = [...att2, { id: 'a3', student_id: 'aarav-uuid', date: '2026-08-18', status: 'present' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: att3,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 1);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);

  // Test Balance 0: FEE_DUE, but canJoinLiveClass MUST be true
  const att4 = [...att3, { id: 'a4', student_id: 'aarav-uuid', date: '2026-08-25', status: 'present' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: att4,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 0);
  assert.equal(status.financialState, 'FEE_DUE');
  assert.equal(status.canJoinLiveClass, true);

  // Next legitimate class consumed: 0 -> -1
  const att5 = [...att4, { id: 'a5', student_id: 'aarav-uuid', date: '2026-09-01', status: 'present' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p1,
    attendance: att5,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, -1);
  assert.equal(status.financialState, 'PAYMENT_OVERDUE');
  assert.equal(status.canJoinLiveClass, false);

  // Payment +4 received at balance -1: -1 + 4 = 3 (strictly arithmetical, never reset to 4)
  const p2 = [...p1, { id: 'p2', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-09-02', status: 'approved' }];
  status = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p2,
    attendance: att5,
    overrides: [],
    leaveRequests: []
  });
  assert.equal(status.effectiveBalance, 3);
  assert.equal(status.financialState, 'GOOD_STANDING');
  assert.equal(status.canJoinLiveClass, true);
});

test('20. Attendance types deduction verification (Present, Absent, Late consume 1; Excused/Approved Leave consumes 0)', () => {
  const p = [{ id: 'p1', student_id: 'aarav-uuid', amount: 3000, classes_added: 4, payment_date: '2026-08-01', status: 'approved' }];

  // 1. Present
  let res = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p,
    attendance: [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'present' }],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(res.effectiveBalance, 3);

  // 2. Absent (unexcused)
  res = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p,
    attendance: [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'absent' }],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(res.effectiveBalance, 3);

  // 3. Late
  res = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p,
    attendance: [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'late' }],
    overrides: [],
    leaveRequests: []
  });
  assert.equal(res.effectiveBalance, 3);

  // 4. Excused with approved leave
  res = calculateAuthoritativeFeeStatus({
    studentId: 'aarav-uuid',
    student: baseStudent,
    payments: p,
    attendance: [{ id: 'a1', student_id: 'aarav-uuid', date: '2026-08-04', status: 'excused' }],
    overrides: [],
    leaveRequests: [{ id: 'l1', student_id: 'aarav-uuid', class_date: '2026-08-04', status: 'approved' }]
  });
  assert.equal(res.effectiveBalance, 4); // Consumes 0
});
