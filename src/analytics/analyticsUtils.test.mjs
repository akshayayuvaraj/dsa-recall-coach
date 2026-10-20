import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnalyticsSummary } from './analyticsUtils.ts'

const problem = (id, topic = 'Arrays', pattern = 'Hash Map') => ({
  id,
  title: id,
  topic,
  pattern,
})

const localNoon = (year, monthIndex, day) =>
  new Date(year, monthIndex, day, 12).toISOString()

const attempt = (id, problemId, attemptedAt, outcome, confidence, nextReviewDate) => ({
  id,
  problemId,
  problemTitle: problemId,
  attemptedAt,
  outcome,
  confidence,
  reflection: '',
  answers: {
    pattern: '',
    approach: '',
    algorithm: '',
    timeComplexity: '',
    spaceComplexity: '',
    edgeCases: '',
  },
  ...(nextReviewDate ? { nextReviewDate } : {}),
})

test('empty data returns zero counts, no rate, and empty category coverage', () => {
  const summary = buildAnalyticsSummary([], [], '2026-10-19')
  assert.equal(summary.totalProblems, 0)
  assert.equal(summary.totalAttempts, 0)
  assert.equal(summary.independentSolveRate, null)
  assert.equal(summary.overdueReviews, 0)
  assert.equal(summary.dueTodayReviews, 0)
  assert.equal(summary.upcomingReviews, 0)
  assert.deepEqual(summary.topicCoverage, [])
  assert.deepEqual(summary.patternCoverage, [])
  assert.ok(summary.reviewCompletion.every((week) => week.completed === 0))
  assert.ok(summary.confidenceTrend.every((week) => week.average === 0 && week.attempts === 0))
})

test('counts saved problems, outcomes, solve rate, coverage, and current review status from persisted records', () => {
  const problems = [
    problem('a', 'Arrays', 'Hash Map'),
    problem('b', 'Arrays', 'Two Pointers'),
    problem('c', 'Trees', 'Depth-First Search'),
  ]
  const attempts = [
    attempt('a-1', 'a', localNoon(2026, 9, 15), 'Solved independently', 4, '2026-10-18'),
    attempt('a-2', 'a', localNoon(2026, 9, 18), 'Solved with a hint', 3, '2026-10-19'),
    attempt('b-1', 'b', localNoon(2026, 9, 19), 'Could not solve', 1, '2026-10-19'),
    attempt('c-1', 'c', new Date(2026, 9, 19, 13).toISOString(), 'Need the solution', 2, '2026-10-20'),
  ]
  const summary = buildAnalyticsSummary(problems, attempts, '2026-10-19')

  assert.equal(summary.totalProblems, 3)
  assert.equal(summary.totalAttempts, 4)
  assert.equal(summary.independentAttempts, 1)
  assert.equal(summary.independentSolveRate, 0.25)
  assert.equal(summary.overdueReviews, 0)
  assert.equal(summary.dueTodayReviews, 2)
  assert.equal(summary.upcomingReviews, 1)
  assert.equal(summary.reviewCompletion.reduce((sum, week) => sum + week.completed, 0), 1)
  assert.equal(summary.outcomeDistribution.reduce((sum, item) => sum + item.count, 0), 4)
  assert.deepEqual(summary.topicCoverage, [
    { label: 'Arrays', count: 2 },
    { label: 'Trees', count: 1 },
  ])
  assert.equal(summary.confidenceTrend.reduce((sum, week) => sum + week.attempts, 0), 4)
  assert.equal(summary.confidenceTrend.find((week) => week.attempts > 0)?.average, 3.5)
})

test('current due counts use only the latest saved attempt for existing problems', () => {
  const summary = buildAnalyticsSummary(
    [problem('a'), problem('b')],
    [
      attempt('a-old', 'a', localNoon(2026, 9, 15), 'Solved independently', 5, '2026-10-16'),
      attempt('a-new', 'a', localNoon(2026, 9, 18), 'Solved independently', 5, '2026-10-25'),
      attempt('b-old', 'b', localNoon(2026, 9, 17), 'Need the solution', 2, '2026-10-18'),
      attempt('orphan', 'deleted', localNoon(2026, 9, 18), 'Could not solve', 1, '2026-10-18'),
    ],
    '2026-10-19',
  )
  assert.equal(summary.overdueReviews, 1)
  assert.equal(summary.dueTodayReviews, 0)
  assert.equal(summary.upcomingReviews, 1)
})

test('adding another persisted attempt recalculates totals, outcome rate, and confidence trend', () => {
  const problems = [problem('a')]
  const initial = [attempt('a-1', 'a', localNoon(2026, 9, 19), 'Need the solution', 2, '2026-10-20')]
  const updated = [
    ...initial,
    attempt('a-2', 'a', new Date(2026, 9, 19, 13).toISOString(), 'Solved independently', 5, '2026-10-26'),
  ]
  const before = buildAnalyticsSummary(problems, initial, '2026-10-19')
  const after = buildAnalyticsSummary(problems, updated, '2026-10-19')

  assert.equal(before.totalAttempts, 1)
  assert.equal(before.independentSolveRate, 0)
  assert.equal(after.totalAttempts, 2)
  assert.equal(after.independentSolveRate, 0.5)
  assert.equal(after.confidenceTrend.find((week) => week.attempts > 0)?.average, 3.5)
})
