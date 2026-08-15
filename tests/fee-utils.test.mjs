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

const { getStudentFeeStatus } = await importTypeScriptModule('../src/lib/fee-utils.ts');

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('returns null for non-monthly fee configurations', () => {
  assert.equal(getStudentFeeStatus('class', 27, [], new Date('2026-06-24T12:00:00')), null);
  assert.equal(getStudentFeeStatus(null, 27, [], new Date('2026-06-24T12:00:00')), null);
  assert.equal(getStudentFeeStatus('monthly', null, [], new Date('2026-06-24T12:00:00')), null);
});

test('marks unpaid students as upcoming within three days of due date', () => {
  const result = getStudentFeeStatus('monthly', 27, [], new Date('2026-06-24T12:00:00'));

  assert.equal(result.status, 'upcoming');
  assert.equal(result.formattedDueDate, '27 June');
  assert.equal(result.diffDays, 3);
  assert.equal(localDateString(result.dueDate), '2026-06-27');
});

test('marks unpaid students as due on the collection day', () => {
  const result = getStudentFeeStatus('monthly', 27, [], new Date('2026-06-27T12:00:00'));

  assert.equal(result.status, 'due');
  assert.equal(result.formattedDueDate, '27 June');
  assert.equal(result.diffDays, 0);
});

test('marks unpaid students as overdue after the collection day', () => {
  const result = getStudentFeeStatus('monthly', 27, [], new Date('2026-06-28T12:00:00'));

  assert.equal(result.status, 'overdue');
  assert.equal(result.formattedDueDate, '27 June');
  assert.equal(result.diffDays, -1);
});

test('moves paid students to the next monthly due date', () => {
  const result = getStudentFeeStatus(
    'monthly',
    27,
    [{ payment_date: '2026-06-27' }],
    new Date('2026-06-27T12:00:00'),
  );

  assert.equal(result.status, 'good');
  assert.equal(result.formattedDueDate, '27 July');
  assert.equal(result.diffDays, 30);
  assert.equal(localDateString(result.dueDate), '2026-07-27');
});

test('counts payments after the previous due date as covering the current cycle', () => {
  const result = getStudentFeeStatus(
    'monthly',
    27,
    [{ payment_date: '2026-06-20' }],
    new Date('2026-06-24T12:00:00'),
  );

  assert.equal(result.status, 'good');
  assert.equal(result.formattedDueDate, '27 July');
});

test('ignores payments from the previous billing cycle', () => {
  const result = getStudentFeeStatus(
    'monthly',
    27,
    [{ payment_date: '2026-05-27' }],
    new Date('2026-06-24T12:00:00'),
  );

  assert.equal(result.status, 'upcoming');
  assert.equal(result.formattedDueDate, '27 June');
});

test('clamps due dates to the final day of shorter months', () => {
  const result = getStudentFeeStatus('monthly', 31, [], new Date('2026-02-25T12:00:00'));

  assert.equal(result.status, 'upcoming');
  assert.equal(result.formattedDueDate, '28 February');
  assert.equal(result.diffDays, 3);
  assert.equal(localDateString(result.dueDate), '2026-02-28');
});

test('clamps leap-year February due dates to February 29', () => {
  const result = getStudentFeeStatus('monthly', 31, [], new Date('2028-02-26T12:00:00'));

  assert.equal(result.status, 'upcoming');
  assert.equal(result.formattedDueDate, '29 February');
  assert.equal(result.diffDays, 3);
  assert.equal(localDateString(result.dueDate), '2028-02-29');
});

test('handles year rollover when the next due date is in January', () => {
  const result = getStudentFeeStatus(
    'monthly',
    31,
    [{ payment_date: '2026-12-31' }],
    new Date('2026-12-31T12:00:00'),
  );

  assert.equal(result.status, 'good');
  assert.equal(result.formattedDueDate, '31 January');
  assert.equal(localDateString(result.dueDate), '2027-01-31');
});

test('does not advance due date to next month for a late payment of the previous cycle', () => {
  // Collection day: 1. Today is August 8, 2026.
  // Student paid on July 2, 2026 (1 day late for their July 1st due date).
  // The next due date should be August 1st, 2026 (and status should be overdue since they haven't paid for August yet).
  const result = getStudentFeeStatus(
    'monthly',
    1,
    [{ payment_date: '2026-07-02' }],
    new Date('2026-08-08T12:00:00')
  );

  assert.equal(result.status, 'overdue');
  assert.equal(localDateString(result.dueDate), '2026-08-01');
  assert.equal(result.formattedDueDate, '1 August');
});

const { calculateClassesAdded } = await importTypeScriptModule('../src/lib/fee-utils.ts');

test('calculateClassesAdded returns 1 class for class-basis payments of 1 class fee', () => {
  assert.equal(calculateClassesAdded(500, 500, 'class'), 1);
  assert.equal(calculateClassesAdded(1000, 500, 'class'), 2);
});

test('calculateClassesAdded returns 4 classes for monthly-basis full monthly payment', () => {
  assert.equal(calculateClassesAdded(2000, 2000, 'monthly'), 4);
  assert.equal(calculateClassesAdded(500, 2000, 'monthly'), 1);
});

