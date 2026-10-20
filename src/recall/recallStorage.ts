import type { Confidence } from '../problems/problemTypes'
import { isValidLocalDate } from './scheduler.ts'

export type RecallOutcome =
  | 'Solved independently'
  | 'Solved with a hint'
  | 'Need the solution'
  | 'Could not solve'

export interface RecallAnswers {
  pattern: string
  approach: string
  algorithm: string
  timeComplexity: string
  spaceComplexity: string
  edgeCases: string
  testInputs?: string
  understanding?: string
  inputOutput?: string
  constraints?: string
  patternReason?: string
  keyInsight?: string
  timeComplexityReason?: string
  spaceComplexityReason?: string
  testCaseExample?: string
  expectedOutput?: string
}

export interface RecallAttempt {
  id: string
  problemId: string
  problemTitle: string
  attemptedAt: string
  outcome: RecallOutcome
  confidence: Confidence
  reflection: string
  answers: RecallAnswers
  hintRevealed?: boolean
  solutionRevealed?: boolean
  nextReviewDate?: string
  reviewIntervalDays?: number
  consecutiveHighConfidenceRecalls?: number
}

export const RECALL_ATTEMPTS_STORAGE_KEY = 'dsa-recall-coach.recall-attempts.v1'
const outcomes: RecallOutcome[] = [
  'Solved independently',
  'Solved with a hint',
  'Need the solution',
  'Could not solve',
]

export function isRecallAttemptRecord(value: unknown): value is RecallAttempt {
  if (typeof value !== 'object' || value === null) return false
  const attempt = value as Record<string, unknown>
  const answers = attempt.answers

  return (
    typeof attempt.id === 'string' &&
    typeof attempt.problemId === 'string' &&
    typeof attempt.problemTitle === 'string' &&
    typeof attempt.attemptedAt === 'string' &&
    !Number.isNaN(Date.parse(attempt.attemptedAt)) &&
    typeof attempt.outcome === 'string' &&
    outcomes.includes(attempt.outcome as RecallOutcome) &&
    (attempt.confidence === 1 ||
      attempt.confidence === 2 ||
      attempt.confidence === 3 ||
      attempt.confidence === 4 ||
      attempt.confidence === 5) &&
    typeof attempt.reflection === 'string' &&
    (attempt.hintRevealed === undefined || typeof attempt.hintRevealed === 'boolean') &&
    (attempt.solutionRevealed === undefined || typeof attempt.solutionRevealed === 'boolean') &&
    (attempt.nextReviewDate === undefined ||
      (typeof attempt.nextReviewDate === 'string' && isValidLocalDate(attempt.nextReviewDate))) &&
    (attempt.reviewIntervalDays === undefined ||
      (typeof attempt.reviewIntervalDays === 'number' &&
        Number.isInteger(attempt.reviewIntervalDays) &&
        attempt.reviewIntervalDays >= 0)) &&
    (attempt.consecutiveHighConfidenceRecalls === undefined ||
      (typeof attempt.consecutiveHighConfidenceRecalls === 'number' &&
        Number.isInteger(attempt.consecutiveHighConfidenceRecalls) &&
        attempt.consecutiveHighConfidenceRecalls >= 0)) &&
    typeof answers === 'object' &&
    answers !== null &&
    ['pattern', 'approach', 'algorithm', 'timeComplexity', 'spaceComplexity', 'edgeCases']
      .every((key) => typeof (answers as Record<string, unknown>)[key] === 'string') &&
    ((answers as Record<string, unknown>).testInputs === undefined ||
      typeof (answers as Record<string, unknown>).testInputs === 'string') &&
    ['understanding', 'inputOutput', 'constraints', 'patternReason', 'keyInsight', 'timeComplexityReason', 'spaceComplexityReason', 'testCaseExample', 'expectedOutput']
      .every((key) => (answers as Record<string, unknown>)[key] === undefined ||
        typeof (answers as Record<string, unknown>)[key] === 'string')
  )
}

export function loadRecallAttempts(): { attempts: RecallAttempt[]; error: string | null } {
  try {
    const stored = window.localStorage.getItem(RECALL_ATTEMPTS_STORAGE_KEY)
    if (stored === null) return { attempts: [], error: null }

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isRecallAttemptRecord)) {
      throw new Error('Saved recall-attempt data has an unsupported format.')
    }

    return { attempts: parsed, error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return {
      attempts: [],
      error: `Recall attempts could not be loaded from browser storage. ${detail}`,
    }
  }
}

export function saveRecallAttempts(attempts: RecallAttempt[]): string | null {
  try {
    window.localStorage.setItem(RECALL_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts))
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `Recall attempt could not be saved to browser storage. ${detail}`
  }
}
