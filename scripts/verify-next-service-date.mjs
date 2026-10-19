/**
 * Purpose-built verification for the single next-service-date helper.
 *
 * Run:  node --experimental-strip-types --no-warnings scripts/verify-next-service-date.mjs
 * (or:  pnpm verify:dates).  Requires Node 22.6+ for TypeScript type stripping;
 * the main typecheck/lint/build gates still support the Node 20 floor in engines.
 *
 * No test framework is added: Node strips the TypeScript types and the script
 * asserts the exact calendar arithmetic Phase 4 requires (notably month-end).
 */
import assert from 'node:assert/strict';
import {
  addDaysIso,
  addMonthsIso,
  computeNextServiceDate,
  daysBetweenIso,
  describeServiceDue,
  resolveServiceInterval,
} from '../src/lib/services/next-service-date.ts';

const cases = [];

function check(name, fn) {
  fn();
  cases.push(name);
  console.log(`PASS: ${name}`);
}

check('31 Jan 2026 + 1 month = 28 Feb 2026 (not an invalid 31 Feb)', () => {
  assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28');
  assert.equal(computeNextServiceDate('2026-01-31', 1), '2026-02-28');
});

check('31 Jan 2024 + 1 month = 29 Feb 2024 (leap year)', () => {
  assert.equal(computeNextServiceDate('2024-01-31', 1), '2024-02-29');
});

check('31 Aug 2026 + 6 months = 28 Feb 2027', () => {
  assert.equal(computeNextServiceDate('2026-08-31', 6), '2027-02-28');
});

check('31 Mar 2026 + 1 month = 30 Apr 2026', () => {
  assert.equal(computeNextServiceDate('2026-03-31', 1), '2026-04-30');
});

check('30 Nov 2026 + 3 months = 28 Feb 2027', () => {
  assert.equal(computeNextServiceDate('2026-11-30', 3), '2027-02-28');
});

check('31 Jan 2026 + 12 months = 31 Jan 2027', () => {
  assert.equal(computeNextServiceDate('2026-01-31', 12), '2027-01-31');
});

check('equipment interval wins over the company default', () => {
  assert.equal(resolveServiceInterval(6, 12), 6);
  assert.equal(computeNextServiceDate('2026-10-19', 6, 12), '2027-04-19');
});

check('company default applies when the equipment interval is null', () => {
  assert.equal(resolveServiceInterval(null, 6), 6);
  assert.equal(computeNextServiceDate('2026-10-19', null, 6), '2027-04-19');
});

check('fallback is 12 months when both intervals are missing or invalid', () => {
  assert.equal(resolveServiceInterval(null, null), 12);
  assert.equal(resolveServiceInterval(0, null), 12);
  assert.equal(resolveServiceInterval(61, 12), 12);
  assert.equal(computeNextServiceDate('2026-10-19', null, null), '2027-10-19');
});

check('day arithmetic crosses month, year and DST boundaries', () => {
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysIso('2026-03-28', 3), '2026-03-31');
  assert.equal(addDaysIso('2024-02-28', 2), '2024-03-01');
});

check('window day counts are calendar days', () => {
  assert.equal(daysBetweenIso('2026-10-19', '2026-10-26'), 7);
  assert.equal(daysBetweenIso('2026-10-19', '2026-10-18'), -1);
  assert.equal(daysBetweenIso('2026-10-19', 'not-a-date'), null);
});

check('status chips: overdue, due today, due in n days, upcoming', () => {
  assert.deepEqual(describeServiceDue('2026-10-18', '2026-10-19'), {
    tone: 'overdue',
    label: 'Overdue',
    days: -1,
  });
  assert.equal(describeServiceDue('2026-10-19', '2026-10-19').label, 'Due today');
  assert.equal(describeServiceDue('2026-10-27', '2026-10-19').label, 'Due in 8 days');
  assert.deepEqual(describeServiceDue('2026-11-20', '2026-10-19'), {
    tone: 'upcoming',
    label: 'Upcoming',
    days: 32,
  });
});

console.log(`\nALL PASSED: ${cases.length} next-service-date checks`);
