import type { Problem } from '../problems/problemTypes'
import type { RecallAttempt } from '../recall/recallStorage'
import { compareLocalDates, formatLocalDate } from '../recall/scheduler.ts'

export interface ProblemReviewInfo {
  lastReviewDate: string | null
  nextReviewDate: string | null
  status: 'overdue' | 'due-today' | 'upcoming' | null
}

export interface PracticeCounts {
  dueProblems: number
  overdueProblems: number
  upcomingProblems: number
  scheduledProblems: number
  completedSessions: number
  remainingProblems: number
}

function latestAttemptFor(problemId: string, attempts: RecallAttempt[]): RecallAttempt | null {
  return attempts
    .filter((attempt) => attempt.problemId === problemId)
    .sort((first, second) => second.attemptedAt.localeCompare(first.attemptedAt))[0] ?? null
}

export function getProblemReviewInfo(
  problem: Problem,
  attempts: RecallAttempt[],
  today: string,
): ProblemReviewInfo {
  const latest = latestAttemptFor(problem.id, attempts)
  const lastReviewDate = latest
    ? formatLocalDate(new Date(latest.attemptedAt))
    : problem.lastReviewedAt
  const nextReviewDate = latest?.nextReviewDate ?? null

  if (!nextReviewDate) return { lastReviewDate, nextReviewDate, status: null }
  const comparison = compareLocalDates(nextReviewDate, today)
  return {
    lastReviewDate,
    nextReviewDate,
    status: comparison < 0 ? 'overdue' : comparison === 0 ? 'due-today' : 'upcoming',
  }
}

function reviewPriority(
  problem: Problem,
  attempts: RecallAttempt[],
  today: string,
): [number, string] {
  const review = getProblemReviewInfo(problem, attempts, today)
  if (review.status === 'overdue') return [0, review.nextReviewDate ?? '']
  if (review.status === 'due-today') return [1, review.nextReviewDate ?? '']
  if (review.status === 'upcoming') return [2, review.nextReviewDate ?? '']
  return [3, '']
}

export function prioritizePracticeProblems(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
): Problem[] {
  return [...problems].sort((first, second) => {
    const firstPriority = reviewPriority(first, attempts, today)
    const secondPriority = reviewPriority(second, attempts, today)
    return firstPriority[0] - secondPriority[0] ||
      firstPriority[1].localeCompare(secondPriority[1]) ||
      first.title.localeCompare(second.title)
  })
}

export function filterPracticeProblems(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
  filters: {
    query: string
    difficulty: string
    topic: string
    pattern: string
    reviewStatus?: string
  },
): Problem[] {
  const query = filters.query.trim().toLowerCase()
  const filtered = problems.filter((problem) => (
    (!query || `${problem.title} ${problem.topic} ${problem.pattern}`.toLowerCase().includes(query)) &&
    (!filters.difficulty || problem.difficulty === filters.difficulty) &&
    (!filters.topic || problem.topic === filters.topic) &&
    (!filters.pattern || problem.pattern === filters.pattern) &&
    (!filters.reviewStatus ||
      (filters.reviewStatus === 'unscheduled'
        ? getProblemReviewInfo(problem, attempts, today).status === null
        : getProblemReviewInfo(problem, attempts, today).status === filters.reviewStatus))
  ))
  return prioritizePracticeProblems(filtered, attempts, today)
}

export function getPracticeCounts(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
): PracticeCounts {
  const attemptedProblemIds = new Set(attempts.map((attempt) => attempt.problemId))
  const reviews = problems.map((problem) => getProblemReviewInfo(problem, attempts, today))
  return {
    dueProblems: reviews.filter((review) => review.status === 'due-today').length,
    overdueProblems: reviews.filter((review) => review.status === 'overdue').length,
    upcomingProblems: reviews.filter((review) => review.status === 'upcoming').length,
    scheduledProblems: reviews.filter((review) => review.nextReviewDate !== null).length,
    completedSessions: attempts.length,
    remainingProblems: problems.filter((problem) => !attemptedProblemIds.has(problem.id)).length,
  }
}
