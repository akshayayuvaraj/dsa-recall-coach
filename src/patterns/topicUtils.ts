import type { Problem } from '../problems/problemTypes'
import { compareLocalDates, isValidLocalDate } from '../recall/scheduler.ts'
import type { RecallAttempt } from '../recall/recallStorage'

export interface TopicSummary {
  topic: string
  problems: Problem[]
  dueProblemCount: number
}

export function buildTopicSummaries(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
): TopicSummary[] {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]))
  const latestByProblem = new Map<string, RecallAttempt>()

  for (const attempt of [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))) {
    if (problemById.has(attempt.problemId) && !latestByProblem.has(attempt.problemId)) {
      latestByProblem.set(attempt.problemId, attempt)
    }
  }

  const dueProblemIds = new Set(
    [...latestByProblem.values()]
      .filter(
        (attempt) =>
          attempt.nextReviewDate !== undefined &&
          isValidLocalDate(attempt.nextReviewDate) &&
          compareLocalDates(attempt.nextReviewDate, today) <= 0,
      )
      .map((attempt) => attempt.problemId),
  )
  const problemsByTopic = new Map<string, Problem[]>()

  for (const problem of problems) {
    const group = problemsByTopic.get(problem.topic) ?? []
    group.push(problem)
    problemsByTopic.set(problem.topic, group)
  }

  return [...problemsByTopic.entries()]
    .map(([topic, topicProblems]) => ({
      topic,
      problems: [...topicProblems].sort((a, b) => a.title.localeCompare(b.title)),
      dueProblemCount: topicProblems.filter((problem) => dueProblemIds.has(problem.id)).length,
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic))
}
