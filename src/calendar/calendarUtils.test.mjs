import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMonthGrid,
  getWeekDays,
  localDateKey,
  weekLabel,
  sameLocalMonth,
  shiftMonth,
  shiftWeek,
  startOfMonth,
  startOfWeek,
} from './calendarUtils.ts'

test('month navigation crosses year boundaries and normalizes to the first day', () => {
  const december = shiftMonth(new Date(2026, 11, 24), 1)
  const november = shiftMonth(december, -2)

  assert.equal(localDateKey(december), '2027-01-01')
  assert.equal(localDateKey(november), '2026-11-01')
  assert.equal(localDateKey(startOfMonth(new Date(2026, 9, 19))), '2026-10-01')
})

test('month grid includes full Monday-first weeks across month boundaries', () => {
  const february = getMonthGrid(new Date(2026, 1, 18))
  assert.equal(february.length % 7, 0)
  assert.equal(february[0].getDay(), 1)
  assert.equal(localDateKey(february[0]), '2026-01-26')
  assert.equal(february.some((date) => localDateKey(date) === '2026-02-01'), true)
  assert.equal(february.some((date) => localDateKey(date) === '2026-02-28'), true)
  assert.equal(february.some((date) => localDateKey(date) === '2026-03-01'), true)
  assert.equal(february.filter((date) => sameLocalMonth(date, new Date(2026, 1, 1))).length, 28)
})

test('leap-year February grid contains February 29', () => {
  const dates = getMonthGrid(new Date(2024, 1, 10))
  assert.equal(dates.some((date) => localDateKey(date) === '2024-02-29'), true)
})

test('week views start on Monday and step exactly seven local calendar days', () => {
  const anchor = new Date(2026, 0, 1, 17)
  const week = getWeekDays(anchor)
  const previous = getWeekDays(shiftWeek(anchor, -1))
  const next = getWeekDays(shiftWeek(anchor, 1))

  assert.equal(week.length, 7)
  assert.equal(week[0].getDay(), 1)
  assert.equal(localDateKey(week[0]), '2025-12-29')
  assert.equal(localDateKey(week[6]), '2026-01-04')
  assert.equal(localDateKey(previous[0]), '2025-12-22')
  assert.equal(localDateKey(next[0]), '2026-01-05')
})

test('week label includes both years when a week crosses a year boundary', () => {
  const week = getWeekDays(new Date(2026, 0, 1))
  assert.match(weekLabel(week, 'en-US'), /2025/)
  assert.match(weekLabel(week, 'en-US'), /2026/)
})
