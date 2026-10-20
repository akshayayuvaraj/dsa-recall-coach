import type { Confidence } from '../problems/problemTypes'
import type { RecallOutcome } from './recallStorage'

export const SCHEDULING_INTERVALS = {
  couldNotSolveDays: 0,
  needSolutionDays: 1,
  solvedWithHintDays: 3,
  solvedIndependentlyLowConfidenceDays: 3,
  solvedIndependentlyHighConfidenceDays: [7, 14, 21, 30] as const,
  highConfidenceThreshold: 4,
} as const

export interface PreviousRecall {
  outcome: RecallOutcome
  confidence: Confidence
  attemptedAt: string
}

export interface ReviewSchedule {
  nextReviewDate: string
  intervalDays: number
  consecutiveHighConfidenceRecalls: number
}

function localDateParts(date: Date): [number, number, number] {
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot schedule from an invalid date.')
  return [date.getFullYear(), date.getMonth(), date.getDate()]
}

export function formatLocalDate(date: Date): string {
  const [year, month, day] = localDateParts(date)
  return `${year}-${`${month + 1}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`
}

export function addLocalDays(date: Date, days: number): Date {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError('Review intervals must be non-negative whole days.')
  }
  const [year, month, day] = localDateParts(date)
  const result = new Date(year, month, day)
  result.setDate(result.getDate() + days)
  return result
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  )
}

function isSuccessfulHighConfidenceRecall(recall: PreviousRecall): boolean {
  return (
    recall.outcome === 'Solved independently' &&
    recall.confidence >= SCHEDULING_INTERVALS.highConfidenceThreshold
  )
}

export function scheduleNextReview(
  outcome: RecallOutcome,
  confidence: Confidence,
  attemptedAt: Date,
  previousRecalls: PreviousRecall[] = [],
): ReviewSchedule {
  const today = new Date(...localDateParts(attemptedAt))
  let intervalDays: number
  let consecutiveHighConfidenceRecalls = 0

  if (outcome === 'Could not solve') {
    intervalDays = SCHEDULING_INTERVALS.couldNotSolveDays
  } else if (outcome === 'Need the solution') {
    intervalDays = SCHEDULING_INTERVALS.needSolutionDays
  } else if (outcome === 'Solved with a hint') {
    intervalDays = SCHEDULING_INTERVALS.solvedWithHintDays
  } else if (confidence < SCHEDULING_INTERVALS.highConfidenceThreshold) {
    intervalDays = SCHEDULING_INTERVALS.solvedIndependentlyLowConfidenceDays
  } else {
    const successfulHighConfidenceHistory = previousRecalls
      .filter((recall) => recall.attemptedAt < attemptedAt.toISOString())
      .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))

    for (const recall of successfulHighConfidenceHistory) {
      if (!isSuccessfulHighConfidenceRecall(recall)) break
      consecutiveHighConfidenceRecalls += 1
    }

    const intervals = SCHEDULING_INTERVALS.solvedIndependentlyHighConfidenceDays
    const intervalIndex = Math.min(consecutiveHighConfidenceRecalls, intervals.length - 1)
    intervalDays = intervals[intervalIndex]
    consecutiveHighConfidenceRecalls += 1
  }

  const nextReviewDate = formatLocalDate(addLocalDays(today, intervalDays))
  return { nextReviewDate, intervalDays, consecutiveHighConfidenceRecalls }
}

export function compareLocalDates(first: string, second: string): -1 | 0 | 1 {
  if (!isValidLocalDate(first) || !isValidLocalDate(second)) {
    throw new RangeError('Expected valid local calendar dates in YYYY-MM-DD format.')
  }
  return first < second ? -1 : first > second ? 1 : 0
}

export function getLocalToday(now = new Date()): string {
  return formatLocalDate(now)
}
