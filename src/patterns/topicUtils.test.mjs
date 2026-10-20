import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTopicSummaries } from './topicUtils.ts'

const problem = (id, topic) => ({
  id,
  title: id,
  topic,
})

const attempt = (problemId, attemptedAt, nextReviewDate) => ({
  id: `${problemId}-${attemptedAt}`,
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
})

test('topic summaries count unique problems whose latest saved review is due or overdue', () => {
  const summaries = buildTopicSummaries(
    [problem('a', 'Arrays'), problem('b', 'Arrays'), problem('c', 'Trees')],
    [
      attempt('a', '2026-10-18T10:00:00.000Z', '2026-10-19'),
      attempt('a', '2026-10-17T10:00:00.000Z', '2026-10-17'),
      attempt('b', '2026-10-18T10:00:00.000Z', '2026-10-18'),
      attempt('c', '2026-10-18T10:00:00.000Z', '2026-10-20'),
    ],
    '2026-10-19',
  )

  assert.deepEqual(
    summaries.map(({ topic, problems: topicProblems, dueProblemCount }) => ({
      topic,
      count: topicProblems.length,
      dueProblemCount,
    })),
    [
      { topic: 'Arrays', count: 2, dueProblemCount: 2 },
      { topic: 'Trees', count: 1, dueProblemCount: 0 },
    ],
  )
})

test('topics without problems stay absent and latest legacy attempts without dates do not reuse stale dates', () => {
  const latestWithoutSchedule = attempt('a', '2026-10-19T10:00:00.000Z', undefined)
  const summaries = buildTopicSummaries(
    [problem('a', 'Strings')],
    [latestWithoutSchedule, attempt('a', '2026-10-18T10:00:00.000Z', '2026-10-18')],
    '2026-10-19',
  )

  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].topic, 'Strings')
  assert.equal(summaries[0].dueProblemCount, 0)
})
