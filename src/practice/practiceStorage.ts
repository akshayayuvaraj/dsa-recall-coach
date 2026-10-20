import type { Confidence } from '../problems/problemTypes'
import type { RecallAnswers, RecallOutcome } from '../recall/recallStorage'

export const PRACTICE_DRAFTS_STORAGE_KEY = 'dsa-recall-coach.practice-drafts.v1'

export type PracticePhase =
  | 'ready'
  | 'recall'
  | 'grade'
  | 'understand'
  | 'pattern'
  | 'approach'
  | 'complexity'
  | 'cases'
  | 'review'

export interface PracticeDraft {
  problemId: string
  phase: PracticePhase
  answers: RecallAnswers
  hintRevealed: boolean
  solutionRevealed: boolean
  outcome: RecallOutcome | null
  confidence: Confidence | null
  forgot: string
  remember: string
  savedAt: string
}

const phases: PracticePhase[] = [
  'ready',
  'recall',
  'grade',
  'understand',
  'pattern',
  'approach',
  'complexity',
  'cases',
  'review',
]
const outcomes: RecallOutcome[] = [
  'Solved independently',
  'Solved with a hint',
  'Need the solution',
  'Could not solve',
]

function isConfidence(value: unknown): value is Confidence {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

export function isPracticeDraft(value: unknown): value is PracticeDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  const answers = draft.answers
  if (typeof answers !== 'object' || answers === null) return false
  const answerRecord = answers as Record<string, unknown>

  return (
    typeof draft.problemId === 'string' &&
    draft.problemId.trim().length > 0 &&
    typeof draft.phase === 'string' &&
    phases.includes(draft.phase as PracticePhase) &&
    ['pattern', 'approach', 'algorithm', 'timeComplexity', 'spaceComplexity', 'edgeCases']
      .every((key) => typeof answerRecord[key] === 'string') &&
    ['testInputs', 'understanding', 'inputOutput', 'constraints', 'patternReason', 'keyInsight', 'timeComplexityReason', 'spaceComplexityReason', 'testCaseExample', 'expectedOutput']
      .every((key) => answerRecord[key] === undefined || typeof answerRecord[key] === 'string') &&
    typeof draft.hintRevealed === 'boolean' &&
    typeof draft.solutionRevealed === 'boolean' &&
    (draft.outcome === null ||
      (typeof draft.outcome === 'string' && outcomes.includes(draft.outcome as RecallOutcome))) &&
    (draft.confidence === null || isConfidence(draft.confidence)) &&
    typeof draft.forgot === 'string' &&
    typeof draft.remember === 'string' &&
    typeof draft.savedAt === 'string' &&
    !Number.isNaN(Date.parse(draft.savedAt))
  )
}

export function loadPracticeDrafts(): { drafts: PracticeDraft[]; error: string | null } {
  try {
    const stored = window.localStorage.getItem(PRACTICE_DRAFTS_STORAGE_KEY)
    if (stored === null) return { drafts: [], error: null }

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isPracticeDraft)) {
      throw new Error('Saved practice drafts have an unsupported format.')
    }
    if (new Set(parsed.map((draft) => draft.problemId)).size !== parsed.length) {
      throw new Error('Saved practice drafts contain duplicate problem IDs.')
    }
    return { drafts: parsed, error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return {
      drafts: [],
      error: `Practice drafts could not be loaded from browser storage. ${detail}`,
    }
  }
}

export function savePracticeDraft(draft: PracticeDraft): string | null {
  const current = loadPracticeDrafts()
  if (current.error) return current.error

  try {
    const nextDrafts = [...current.drafts.filter((item) => item.problemId !== draft.problemId), draft]
    window.localStorage.setItem(PRACTICE_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts))
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `Practice draft could not be saved to browser storage. ${detail}`
  }
}

export function removePracticeDraft(problemId: string): string | null {
  const current = loadPracticeDrafts()
  if (current.error) return current.error

  try {
    const nextDrafts = current.drafts.filter((draft) => draft.problemId !== problemId)
    window.localStorage.setItem(PRACTICE_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts))
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `The saved practice draft could not be removed from browser storage. ${detail}`
  }
}
