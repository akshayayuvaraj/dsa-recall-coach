import assert from 'node:assert/strict'
import test from 'node:test'
import { createStarterProblems, isProblemRecord } from '../problems/problemStorage.ts'
import { isRecallAttemptRecord } from '../recall/recallStorage.ts'
import {
  filterPracticeProblems,
  getPracticeCounts,
  getProblemReviewInfo,
  prioritizePracticeProblems,
} from './practiceUtils.ts'
import { isPracticeDraft } from './practiceStorage.ts'

const problems = createStarterProblems()

function attempt(problemId, attemptedAt, nextReviewDate) {
  return {
    id: `attempt-${problemId}-${attemptedAt}`,
    problemId,
    problemTitle: problemId,
    attemptedAt,
    outcome: 'Solved independently',
    confidence: 4,
    reflection: '',
    answers: {
      pattern: '',
      approach: '',
      algorithm: '',
      timeComplexity: '',
      spaceComplexity: '',
      edgeCases: '',
    },
    nextReviewDate,
    reviewIntervalDays: 7,
    consecutiveHighConfidenceRecalls: 1,
  }
}

test('review state uses the latest saved recall schedule and local dates', () => {
  const twoSum = problems[0]
  const attempts = [
    attempt(twoSum.id, '2026-10-10T12:00:00.000Z', '2026-10-12'),
    attempt(twoSum.id, '2026-10-18T12:00:00.000Z', '2026-10-20'),
  ]

  assert.deepEqual(getProblemReviewInfo(twoSum, attempts, '2026-10-19'), {
    lastReviewDate: '2026-10-18',
    nextReviewDate: '2026-10-20',
    status: 'upcoming',
  })
})

test('problem prioritization puts overdue and due-today reviews ahead of upcoming and unscheduled', () => {
  const attempts = [
    attempt(problems[0].id, '2026-10-10T12:00:00.000Z', '2026-10-19'),
    attempt(problems[1].id, '2026-10-10T12:00:00.000Z', '2026-10-15'),
    attempt(problems[2].id, '2026-10-10T12:00:00.000Z', '2026-10-25'),
  ]
  assert.deepEqual(
    prioritizePracticeProblems(problems, attempts, '2026-10-19').map((problem) => problem.id),
    [problems[1].id, problems[0].id, problems[2].id],
  )
})

test('search and difficulty, topic, and pattern filters constrain saved problem choices', () => {
  assert.deepEqual(filterPracticeProblems(problems, [], '2026-10-19', {
    query: 'stock',
    difficulty: 'Easy',
    topic: 'Arrays',
    pattern: 'Sliding Window',
  }).map((problem) => problem.id), [problems[2].id])
  assert.deepEqual(filterPracticeProblems(problems, [], '2026-10-19', {
    query: '',
    difficulty: 'Hard',
    topic: '',
    pattern: '',
  }), [])
})

test('practice counts use saved sessions, due schedules, and never-practiced problems only', () => {
  const attempts = [
    attempt(problems[0].id, '2026-10-10T12:00:00.000Z', '2026-10-18'),
    attempt(problems[0].id, '2026-10-18T12:00:00.000Z', '2026-10-24'),
    attempt(problems[1].id, '2026-10-18T12:00:00.000Z', '2026-10-19'),
  ]
  assert.deepEqual(getPracticeCounts(problems, attempts, '2026-10-19'), {
    dueProblems: 1,
    overdueProblems: 0,
    upcomingProblems: 1,
    scheduledProblems: 2,
    completedSessions: 3,
    remainingProblems: 1,
  })
  assert.deepEqual(getPracticeCounts([], [], '2026-10-19'), {
    dueProblems: 0,
    overdueProblems: 0,
    upcomingProblems: 0,
    scheduledProblems: 0,
    completedSessions: 0,
    remainingProblems: 0,
  })
})

test('practice draft validation accepts saved drafts and rejects malformed data', () => {
  const draft = {
    problemId: 'example-two-sum',
    phase: 'recall',
    answers: {
      pattern: '',
      approach: '',
      algorithm: '',
      timeComplexity: '',
      spaceComplexity: '',
      edgeCases: '',
      testInputs: '',
    },
    hintRevealed: false,
    solutionRevealed: false,
    outcome: null,
    confidence: null,
    forgot: '',
    remember: '',
    savedAt: '2026-10-19T12:00:00.000Z',
  }
  assert.equal(isPracticeDraft(draft), true)
  assert.equal(isPracticeDraft({ ...draft, phase: 'unknown' }), false)
  assert.equal(isPracticeDraft({ ...draft, answers: { ...draft.answers, testInputs: 7 } }), false)
  assert.equal(isPracticeDraft({ ...draft, phase: 'complexity' }), true)
})

test('saved records reject invalid dates used by the practice list', () => {
  assert.equal(isProblemRecord({ ...problems[0], createdAt: '2026-02-30' }), false)
  assert.equal(isProblemRecord({ ...problems[0], lastReviewedAt: '2026-10-40' }), false)
  assert.equal(isRecallAttemptRecord(attempt(problems[0].id, 'not-a-date', '2026-10-19')), false)
})

test('recall records accept optional guided-practice answers and reject malformed optional fields', () => {
  const base = attempt(problems[0].id, '2026-10-19T12:00:00.000Z', '2026-10-20')
  assert.equal(isRecallAttemptRecord({
    ...base,
    answers: { ...base.answers, understanding: 'Return matching indices', inputOutput: 'Array to index pair' },
    hintRevealed: true,
    solutionRevealed: false,
  }), true)
  assert.equal(isRecallAttemptRecord({
    ...base,
    answers: { ...base.answers, expectedOutput: 2 },
  }), false)
  assert.equal(isRecallAttemptRecord({ ...base, hintRevealed: 'yes' }), false)
})
