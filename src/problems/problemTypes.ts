export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Confidence = 1 | 2 | 3 | 4 | 5
export type NeetCodeStatus =
  | 'Not Started'
  | 'Attempted'
  | 'Solved With Help'
  | 'Solved Independently'
  | 'Needs Revision'

export interface Problem {
  id: string
  title: string
  url: string
  difficulty: Difficulty
  topic: string
  pattern: string
  statement: string
  approach: string
  algorithm: string
  javaNotes: string
  timeComplexity: string
  spaceComplexity: string
  mistakes: string
  hints: string
  confidence: Confidence | null
  createdAt: string
  lastReviewedAt: string | null
  isExample: boolean
  neetcodeId?: string
  neetcodeTopic?: string
  neetcodeStatus?: NeetCodeStatus
  neetcodeFirstAttemptedAt?: string | null
  neetcodeLastSolvedAt?: string | null
  neetcodeConfidence?: Confidence | null
  neetcodeEdgeCases?: string
  neetcodeReflection?: string
}

export type ProblemDraft = Omit<
  Problem,
  'id' | 'createdAt' | 'lastReviewedAt' | 'isExample'
> & {
  lastReviewedAt: string
}
