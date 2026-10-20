import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addLocalDays,
  compareLocalDates,
  formatLocalDate,
  isValidLocalDate,
  scheduleNextReview,
  SCHEDULING_INTERVALS,
} from './scheduler.ts'

const attemptDate = new Date(2026, 9, 19, 15, 30)

function schedule(outcome, confidence, previous = []) {
  return scheduleNextReview(outcome, confidence, attemptDate, previous)
}

test('could not solve schedules a same-day review when practical', () => {
  const result = schedule('Could not solve', 2)
  assert.equal(result.intervalDays, SCHEDULING_INTERVALS.couldNotSolveDays)
  assert.equal(result.nextReviewDate, '2026-10-19')
})

test('need the solution schedules the next local day', () => {
  const result = schedule('Need the solution', 1)
  assert.equal(result.intervalDays, SCHEDULING_INTERVALS.needSolutionDays)
  assert.equal(result.nextReviewDate, '2026-10-20')
})

test('solved with a hint schedules three days later', () => {
  const result = schedule('Solved with a hint', 5)
  assert.equal(result.intervalDays, SCHEDULING_INTERVALS.solvedWithHintDays)
  assert.equal(result.nextReviewDate, '2026-10-22')
})

test('independent recall with low confidence schedules three days later', () => {
  const result = schedule('Solved independently', 3)
  assert.equal(result.intervalDays, SCHEDULING_INTERVALS.solvedIndependentlyLowConfidenceDays)
  assert.equal(result.nextReviewDate, '2026-10-22')
  assert.equal(result.consecutiveHighConfidenceRecalls, 0)
})

test('first independent high-confidence recall schedules seven days later', () => {
  const result = schedule('Solved independently', 4)
  assert.equal(result.intervalDays, 7)
  assert.equal(result.nextReviewDate, '2026-10-26')
  assert.equal(result.consecutiveHighConfidenceRecalls, 1)
})

test('repeated high-confidence recalls gradually extend to the capped interval', () => {
  const history = []
  const intervalDays = [7, 14, 21, 30, 30]

  for (const interval of intervalDays) {
    const result = schedule('Solved independently', 5, history)
    assert.equal(result.intervalDays, interval)
    history.push({
      outcome: 'Solved independently',
      confidence: 5,
      attemptedAt: new Date(attemptDate.getTime() - (history.length + 1) * 86_400_000).toISOString(),
    })
  }
})

test('a non-high-confidence result resets the successful recall streak', () => {
  const result = schedule('Solved independently', 5, [
    {
      outcome: 'Solved with a hint',
      confidence: 5,
      attemptedAt: new Date(attemptDate.getTime() - 60 * 60 * 1000).toISOString(),
    },
    {
      outcome: 'Solved independently',
      confidence: 5,
      attemptedAt: new Date(attemptDate.getTime() - 86_400_000).toISOString(),
    },
  ])
  assert.equal(result.intervalDays, 7)
  assert.equal(result.consecutiveHighConfidenceRecalls, 1)
})

test('local calendar arithmetic crosses month and year boundaries without UTC conversion', () => {
  const lateLocalDay = new Date(2026, 11, 31, 23, 45)
  const nextDay = addLocalDays(lateLocalDay, 1)
  assert.equal(formatLocalDate(lateLocalDay), '2026-12-31')
  assert.equal(formatLocalDate(nextDay), '2027-01-01')
  assert.equal(nextDay.getHours(), 0)
})

test('local day addition preserves calendar days across daylight-saving transitions', () => {
  const beforeTransition = new Date(2024, 2, 9, 12)
  const afterOneDay = addLocalDays(beforeTransition, 1)
  assert.equal(formatLocalDate(afterOneDay), formatLocalDate(new Date(2024, 2, 10, 12)))
  assert.equal(afterOneDay.getHours(), 0)
})

test('local date validation and ordering handle leap dates and reject invalid dates', () => {
  assert.equal(isValidLocalDate('2024-02-29'), true)
  assert.equal(isValidLocalDate('2026-02-29'), false)
  assert.equal(isValidLocalDate('2026-2-09'), false)
  assert.equal(compareLocalDates('2026-10-18', '2026-10-19'), -1)
  assert.equal(compareLocalDates('2026-10-19', '2026-10-19'), 0)
  assert.equal(compareLocalDates('2026-10-20', '2026-10-19'), 1)
  assert.throws(() => compareLocalDates('2026-02-29', '2026-03-01'), RangeError)
})
