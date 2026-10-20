import type { Problem } from '../problems/problemTypes'
import {
  compareLocalDates,
  formatLocalDate,
  isValidLocalDate,
} from '../recall/scheduler.ts'
import type { RecallAttempt, RecallOutcome } from '../recall/recallStorage'

export const RECALL_OUTCOMES: RecallOutcome[] = [
  'Solved independently',
  'Solved with a hint',
  'Need the solution',
  'Could not solve',
]

export interface CountByLabel {
  label: string
  count: number
}

export interface ReviewWeek {
  weekStart: string
  completed: number
}

export interface ConfidenceWeek {
  weekStart: string
  average: number
  attempts: number
}

export interface AnalyticsSummary {
  totalProblems: number
  totalAttempts: number
  independentSolveRate: number | null
  independentAttempts: number
  overdueReviews: number
  dueTodayReviews: number
  upcomingReviews: number
  outcomeDistribution: CountByLabel[]
  topicCoverage: CountByLabel[]
  patternCoverage: CountByLabel[]
  reviewCompletion: ReviewWeek[]
  confidenceTrend: ConfidenceWeek[]
}

function localDateFromTimestamp(timestamp: string): string | null {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : formatLocalDate(date)
}

function startOfLocalWeek(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const daysSinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - daysSinceMonday)
  return formatLocalDate(date)
}

function getRecentWeekStarts(today: string, count: number): string[] {
  const starts: string[] = []
  const [year, month, day] = startOfLocalWeek(today).split('-').map(Number)
  const cursor = new Date(year, month - 1, day)
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const week = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - offset * 7)
    starts.push(formatLocalDate(week))
  }
  return starts
}

function buildCoverage(problems: Problem[], field: 'topic' | 'pattern'): CountByLabel[] {
  const counts = new Map<string, number>()
  for (const problem of problems) {
    const label = problem[field].trim() || 'Unassigned'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function buildReviewCompletion(attempts: RecallAttempt[], today: string): ReviewWeek[] {
  const scheduledReviewCounts = new Map<string, number>()
  const attemptsByProblem = new Map<string, RecallAttempt[]>()

  for (const attempt of attempts) {
    const group = attemptsByProblem.get(attempt.problemId) ?? []
    group.push(attempt)
    attemptsByProblem.set(attempt.problemId, group)
  }

  for (const problemAttempts of attemptsByProblem.values()) {
    const ordered = [...problemAttempts].sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt))
    let previous: RecallAttempt | undefined
    for (const attempt of ordered) {
      const attemptDate = localDateFromTimestamp(attempt.attemptedAt)
      if (
        previous?.nextReviewDate &&
        isValidLocalDate(previous.nextReviewDate) &&
        attemptDate &&
        compareLocalDates(attemptDate, previous.nextReviewDate) >= 0
      ) {
        const weekStart = startOfLocalWeek(attemptDate)
        scheduledReviewCounts.set(weekStart, (scheduledReviewCounts.get(weekStart) ?? 0) + 1)
      }
      previous = attempt
    }
  }

  return getRecentWeekStarts(today, 8).map((weekStart) => ({
    weekStart,
    completed: scheduledReviewCounts.get(weekStart) ?? 0,
  }))
}

function buildConfidenceTrend(attempts: RecallAttempt[], today: string): ConfidenceWeek[] {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const attempt of attempts) {
    const attemptDate = localDateFromTimestamp(attempt.attemptedAt)
    if (!attemptDate) continue
    const weekStart = startOfLocalWeek(attemptDate)
    const current = totals.get(weekStart) ?? { sum: 0, count: 0 }
    current.sum += attempt.confidence
    current.count += 1
    totals.set(weekStart, current)
  }

  return getRecentWeekStarts(today, 8).map((weekStart) => {
    const total = totals.get(weekStart)
    return {
      weekStart,
      average: total ? total.sum / total.count : 0,
      attempts: total?.count ?? 0,
    }
  })
}

export function buildAnalyticsSummary(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
): AnalyticsSummary {
  const problemIds = new Set(problems.map((problem) => problem.id))
  const latestScheduledAttempt = new Map<string, RecallAttempt>()
  for (const attempt of [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))) {
    if (problemIds.has(attempt.problemId) && !latestScheduledAttempt.has(attempt.problemId)) {
      latestScheduledAttempt.set(attempt.problemId, attempt)
    }
  }

  let overdueReviews = 0
  let dueTodayReviews = 0
  let upcomingReviews = 0
  for (const attempt of latestScheduledAttempt.values()) {
    const nextReviewDate = attempt.nextReviewDate
    if (!nextReviewDate || !isValidLocalDate(nextReviewDate)) continue
    const comparison = compareLocalDates(nextReviewDate, today)
    if (comparison < 0) overdueReviews += 1
    else if (comparison === 0) dueTodayReviews += 1
    else upcomingReviews += 1
  }

  const outcomeDistribution = RECALL_OUTCOMES.map((label) => ({
    label,
    count: attempts.filter((attempt) => attempt.outcome === label).length,
  }))
  const independentAttempts = outcomeDistribution.find(
    ({ label }) => label === 'Solved independently',
  )?.count ?? 0

  return {
    totalProblems: problems.length,
    totalAttempts: attempts.length,
    independentSolveRate: attempts.length === 0 ? null : independentAttempts / attempts.length,
    independentAttempts,
    overdueReviews,
    dueTodayReviews,
    upcomingReviews,
    outcomeDistribution,
    topicCoverage: buildCoverage(problems, 'topic'),
    patternCoverage: buildCoverage(problems, 'pattern'),
    reviewCompletion: buildReviewCompletion(attempts, today),
    confidenceTrend: buildConfidenceTrend(attempts, today),
  }
}
