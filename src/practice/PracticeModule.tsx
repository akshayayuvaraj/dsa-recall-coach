import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dateForDisplay, loadProblems } from '../problems/problemStorage'
import type { Confidence, Problem } from '../problems/problemTypes'
import {
  loadRecallAttempts,
  saveRecallAttempts,
  type RecallAnswers,
  type RecallAttempt,
  type RecallOutcome,
} from '../recall/recallStorage'
import { getLocalToday, scheduleNextReview } from '../recall/scheduler'
import {
  loadPracticeDrafts,
  removePracticeDraft,
  savePracticeDraft,
  type PracticeDraft,
  type PracticePhase,
} from './practiceStorage'
import {
  filterPracticeProblems,
  getPracticeCounts,
  getProblemReviewInfo,
} from './practiceUtils'
import './PracticeModule.css'

type RecallStage = 'understand' | 'pattern' | 'approach' | 'complexity' | 'cases' | 'review'
type Screen = 'chooser' | RecallStage | 'grade' | 'complete' | 'history'
type AnswerKey = keyof RecallAnswers

interface StageField {
  key: AnswerKey
  label: string
  placeholder: string
  rows: number
}

interface StageDefinition {
  id: RecallStage
  title: string
  prompt: string
  description: string
  fields: StageField[]
}

const stages: StageDefinition[] = [
  {
    id: 'understand',
    title: 'Understand',
    prompt: 'Put the problem in your own words.',
    description: 'Clarify what is being asked before reaching for a familiar pattern.',
    fields: [
      { key: 'understanding', label: 'Your summary', placeholder: 'Explain the problem in a sentence or two.', rows: 4 },
      { key: 'inputOutput', label: 'Input and expected output', placeholder: 'What are you given, and exactly what should you return?', rows: 3 },
      { key: 'constraints', label: 'Constraints to keep in mind', placeholder: 'Capture limits or assumptions that affect the solution.', rows: 3 },
    ],
  },
  {
    id: 'pattern',
    title: 'Identify the pattern',
    prompt: 'Which data structure or algorithm pattern fits?',
    description: 'Name the pattern first, then explain the clue that makes it appropriate.',
    fields: [
      { key: 'pattern', label: 'Pattern or data structure', placeholder: 'For example: two pointers, hash map, BFS…', rows: 3 },
      { key: 'patternReason', label: 'Why does it fit this problem?', placeholder: 'Point to the property of the input or task that suggests this pattern.', rows: 4 },
    ],
  },
  {
    id: 'approach',
    title: 'Recall the approach',
    prompt: 'Reconstruct the key insight and algorithm.',
    description: 'Write it as if you were explaining your reasoning to an interviewer.',
    fields: [
      { key: 'keyInsight', label: 'Key insight', placeholder: 'What observation makes the solution work?', rows: 4 },
      { key: 'approach', label: 'Approach', placeholder: 'Explain the idea in your own words.', rows: 5 },
      { key: 'algorithm', label: 'Algorithm steps', placeholder: 'Write the important steps in order.', rows: 6 },
    ],
  },
  {
    id: 'complexity',
    title: 'Complexity',
    prompt: 'Account for the time and extra space.',
    description: 'State a complexity and justify it from the operations in your approach.',
    fields: [
      { key: 'timeComplexity', label: 'Time complexity', placeholder: 'e.g. O(n)', rows: 2 },
      { key: 'timeComplexityReason', label: 'Why is that the time complexity?', placeholder: 'Explain what work is done as the input grows.', rows: 3 },
      { key: 'spaceComplexity', label: 'Space complexity', placeholder: 'e.g. O(n)', rows: 2 },
      { key: 'spaceComplexityReason', label: 'Why is that the space complexity?', placeholder: 'Describe the additional memory used and what it stores.', rows: 3 },
    ],
  },
  {
    id: 'cases',
    title: 'Test your reasoning',
    prompt: 'Check the edges, not just the happy path.',
    description: 'List meaningful cases, then work through one concrete example and its expected output.',
    fields: [
      { key: 'edgeCases', label: 'Edge cases to test', placeholder: 'Consider empty, minimal, repeated, boundary, or unusual inputs when relevant.', rows: 4 },
      { key: 'testCaseExample', label: 'Example test case', placeholder: 'Write one representative input in any format that is clear to you.', rows: 4 },
      { key: 'expectedOutput', label: 'Expected output and why', placeholder: 'What should that example produce? Explain briefly.', rows: 3 },
      { key: 'testInputs', label: 'Other useful inputs (optional)', placeholder: 'Add another case if it helps test the approach.', rows: 3 },
    ],
  },
  {
    id: 'review',
    title: 'Review & compare',
    prompt: 'Compare your recall with your saved reference.',
    description: 'Your notes stay in view. Hints and reference notes remain hidden until you reveal them.',
    fields: [],
  },
]

const outcomes: { value: RecallOutcome; label: string }[] = [
  { value: 'Solved independently', label: '1 · Solved independently' },
  { value: 'Solved with a hint', label: '2 · Solved with the hint' },
  { value: 'Could not solve', label: '3 · Could not solve it' },
]

const confidenceLabels: Record<Confidence, string> = {
  1: 'Not confident',
  2: 'A little confident',
  3: 'Somewhat confident',
  4: 'Confident',
  5: 'Very confident',
}

const emptyAnswers = (): RecallAnswers => ({
  pattern: '',
  approach: '',
  algorithm: '',
  timeComplexity: '',
  spaceComplexity: '',
  edgeCases: '',
  testInputs: '',
  understanding: '',
  inputOutput: '',
  constraints: '',
  patternReason: '',
  keyInsight: '',
  timeComplexityReason: '',
  spaceComplexityReason: '',
  testCaseExample: '',
  expectedOutput: '',
})

function legacyPhase(phase: PracticePhase): Screen {
  if (phase === 'ready') return 'understand'
  if (phase === 'recall') return 'approach'
  if (phase === 'grade') return 'grade'
  return phase
}

function isJavaCode(value: string): boolean {
  const hasClass = /\b(?:public\s+)?class\s+[A-Z_$][\w$]*/.test(value)
  const hasMethod = /\b(?:public|private|protected)\s+(?:static\s+)?[\w<>[\], ?]+\s+\w+\s*\([^)]*\)\s*\{/.test(value)
  return hasClass && hasMethod && value.includes('}')
}

function formatAttemptDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Icon({ name, size = 18 }: { name: 'spark' | 'arrow' | 'chevron' | 'check' | 'book' | 'clock'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M4 18a2.5 2.5 0 0 1 2.5-2.5H20" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }
  return (
    <svg aria-hidden="true" className="practice-icon" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width={size}>
      {paths[name]}
    </svg>
  )
}

function PracticeProblemCard({
  problem,
  attempts,
  today,
  hasDraft,
  onStart,
}: {
  problem: Problem
  attempts: RecallAttempt[]
  today: string
  hasDraft: boolean
  onStart: (problemId: string) => void
}) {
  const review = getProblemReviewInfo(problem, attempts, today)
  const status = review.status === 'overdue'
    ? 'Overdue'
    : review.status === 'due-today'
      ? 'Due today'
      : review.status === 'upcoming'
        ? 'Upcoming'
        : 'Not scheduled'

  return (
    <article className="practice-problem-card">
      <div className="practice-card-top">
        <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
        <span className={`practice-review-badge${review.status ? ` practice-review-${review.status}` : ''}`}>{status}</span>
      </div>
      <h3>{problem.title}</h3>
      <p className="practice-card-classification">{problem.topic} <span>·</span> {problem.pattern}</p>
      <div className="practice-card-dates">
        <span>Last attempt <strong>{review.lastReviewDate ? dateForDisplay(review.lastReviewDate) : 'Not reviewed'}</strong></span>
        <span>Review date <strong>{review.nextReviewDate ? dateForDisplay(review.nextReviewDate) : 'Not scheduled'}</strong></span>
      </div>
      {problem.isExample && <span className="example-badge">Editable starter example</span>}
      {hasDraft && <span className="practice-draft-badge">Resume later · draft saved</span>}
      <button className="practice-button practice-button-secondary" onClick={() => onStart(problem.id)} type="button">
        {hasDraft ? 'Resume session' : 'Practice this problem'}
      </button>
    </article>
  )
}

function AnswerField({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: StageField
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="practice-answer-field">
      <span>{field.label}</span>
      <textarea
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        rows={field.rows}
        value={value}
      />
    </label>
  )
}

function ReferenceField({
  title,
  answer,
  reference,
  revealed,
}: {
  title: string
  answer: string
  reference: string
  revealed: boolean
}) {
  return (
    <section className="practice-comparison">
      <h4>{title}</h4>
      <div className="practice-comparison-columns">
        <div><span>Your recall</span><p>{answer.trim() || 'No answer recorded for this prompt.'}</p></div>
        <div><span>Saved reference</span><p>{revealed ? reference.trim() || 'No saved reference for this construct.' : 'Hidden until you reveal the saved solution.'}</p></div>
      </div>
    </section>
  )
}

function CompletionPanel({
  attempt,
  problem,
  saveWarning,
  onPractice,
  onAnother,
  onReview,
  onDashboard,
}: {
  attempt: RecallAttempt
  problem: Problem | null
  saveWarning: string | null
  onPractice: () => void
  onAnother: () => void
  onReview: () => void
  onDashboard: () => void
}) {
  const revisit = [
    attempt.outcome !== 'Solved independently' ? `Recorded outcome: ${attempt.outcome}.` : '',
    ...attempt.reflection.split('\n').filter(Boolean),
    problem?.mistakes.trim() ? `Saved reference note: ${problem.mistakes}` : '',
  ].filter(Boolean)

  return (
    <section aria-labelledby="practice-complete-title" aria-live="polite" className="practice-completion">
      <span className="practice-completion-icon"><Icon name="check" size={23} /></span>
      <span className="practice-eyebrow">SESSION SAVED TO THIS BROWSER</span>
      <h2 id="practice-complete-title">Recall session complete</h2>
      <p className="practice-completion-problem">{attempt.problemTitle}</p>
      <div className="practice-completion-summary">
        <span>Attempted outcome<strong>{attempt.outcome}</strong></span>
        <span>Confidence<strong>{attempt.confidence}/5 · {confidenceLabels[attempt.confidence]}</strong></span>
        <span>Saved<strong>{formatAttemptDate(attempt.attemptedAt)}</strong></span>
        {attempt.nextReviewDate && <span>Review date<strong>{dateForDisplay(attempt.nextReviewDate)}</strong></span>}
      </div>
      <section className="practice-revisit">
        <h3>What to revisit</h3>
        {revisit.length
          ? <ul>{revisit.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
          : <p>No reflection or saved mistake notes were added for this attempt.</p>}
      </section>
      {saveWarning && <p className="practice-inline-error" role="alert">{saveWarning}</p>}
      <div className="practice-completion-actions">
        <button className="practice-button practice-button-primary" onClick={onPractice} type="button">Practice this problem</button>
        <button className="practice-button practice-button-secondary" onClick={onAnother} type="button">Another problem</button>
        <button className="practice-button practice-button-secondary" onClick={onReview} type="button">Review this problem</button>
        <button className="practice-button practice-button-quiet" onClick={onDashboard} type="button">Back to dashboard</button>
        <button className="practice-button practice-button-quiet" onClick={onAnother} type="button">Practice dashboard</button>
      </div>
    </section>
  )
}

export default function PracticeModule({
  onOpenProblems,
  onDashboard,
  initialProblemId = null,
}: {
  onOpenProblems: () => void
  onDashboard: () => void
  initialProblemId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [problems, setProblems] = useState<Problem[]>([])
  const [attempts, setAttempts] = useState<RecallAttempt[]>([])
  const [drafts, setDrafts] = useState<PracticeDraft[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('chooser')
  const [selectedProblemId, setSelectedProblemId] = useState('')
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<RecallAnswers>(emptyAnswers)
  const [hintRevealed, setHintRevealed] = useState(false)
  const [solutionRevealed, setSolutionRevealed] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [outcome, setOutcome] = useState<RecallOutcome | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [forgot, setForgot] = useState('')
  const [remember, setRemember] = useState('')
  const [completedAttempt, setCompletedAttempt] = useState<RecallAttempt | null>(null)
  const [query, setQuery] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [patternFilter, setPatternFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [draftStatus, setDraftStatus] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const problemResult = loadProblems()
      const attemptResult = loadRecallAttempts()
      const draftResult = loadPracticeDrafts()
      setProblems(problemResult.problems)
      setAttempts(attemptResult.attempts)
      setDrafts(draftResult.drafts)
      setLoadError([problemResult.error, attemptResult.error, draftResult.error].filter(Boolean).join(' ') || null)
      const initialProblem = problemResult.problems.find((problem) => problem.id === initialProblemId)
      if (initialProblem) {
        const draft = draftResult.drafts.find((item) => item.problemId === initialProblemId)
        setSelectedProblemId(initialProblem.id)
        setAnswers({ ...emptyAnswers(), ...draft?.answers })
        setHintRevealed(draft?.hintRevealed ?? false)
        setSolutionRevealed(draft?.solutionRevealed ?? false)
        setOutcome(draft?.outcome ?? null)
        setConfidence(draft?.confidence ?? null)
        setForgot(draft?.forgot ?? '')
        setRemember(draft?.remember ?? '')
        setDraftStatus(draft ? `Draft restored · saved ${formatAttemptDate(draft.savedAt)}` : '')
        setScreen(draft ? legacyPhase(draft.phase) : 'understand')
      }
      setLoading(false)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [initialProblemId])

  const today = getLocalToday()
  const selectedProblem = problems.find((problem) => problem.id === selectedProblemId) ?? null
  const counts = useMemo(() => getPracticeCounts(problems, attempts, today), [problems, attempts, today])
  const filteredProblems = useMemo(() => filterPracticeProblems(
    problems,
    attempts,
    today,
    { query, difficulty: difficultyFilter, topic: topicFilter, pattern: patternFilter, reviewStatus: reviewFilter },
  ), [problems, attempts, today, query, difficultyFilter, topicFilter, patternFilter, reviewFilter])
  const activeHistoryAttempt = attempts.find((attempt) => attempt.id === activeHistoryId) ?? null
  const currentStageIndex = stages.findIndex((stage) => stage.id === screen)
  const activeStage = stages.find((stage) => stage.id === screen) ?? null

  const persistDraft = (
    phase: PracticePhase = screen === 'grade' ? 'grade' : activeStage?.id ?? 'understand',
    overrides: Partial<Omit<PracticeDraft, 'problemId' | 'savedAt'>> = {},
  ): boolean => {
    if (!selectedProblem || !activeStage && screen !== 'grade') return false
    const draft: PracticeDraft = {
      problemId: selectedProblem.id,
      phase,
      answers,
      hintRevealed,
      solutionRevealed,
      outcome,
      confidence,
      forgot,
      remember,
      savedAt: new Date().toISOString(),
      ...overrides,
    }
    const error = savePracticeDraft(draft)
    if (error) {
      setDraftError(error)
      setDraftStatus('')
      return false
    }
    setDrafts((current) => [...current.filter((item) => item.problemId !== draft.problemId), draft])
    setDraftError(null)
    setDraftStatus(`Draft saved · ${new Date(draft.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
    return true
  }

  const startSession = (problemId: string) => {
    const problem = problems.find((item) => item.id === problemId)
    if (!problem) return
    const draft = drafts.find((item) => item.problemId === problemId)
    setSelectedProblemId(problemId)
    setAnswers({ ...emptyAnswers(), ...draft?.answers })
    setHintRevealed(draft?.hintRevealed ?? false)
    setSolutionRevealed(draft?.solutionRevealed ?? false)
    setOutcome(draft?.outcome ?? null)
    setConfidence(draft?.confidence ?? null)
    setForgot(draft?.forgot ?? '')
    setRemember(draft?.remember ?? '')
    setCompletedAttempt(null)
    setActiveHistoryId(null)
    setSaveError(null)
    setSaveWarning(null)
    setDraftError(null)
    setDraftStatus(draft ? `Draft restored · saved ${formatAttemptDate(draft.savedAt)}` : '')
    setFocusMode(false)
    setScreen(draft ? legacyPhase(draft.phase) : 'understand')
  }

  const updateAnswer = (key: AnswerKey, value: string) => {
    const nextAnswers = { ...answers, [key]: value }
    setAnswers(nextAnswers)
    persistDraft(undefined, { answers: nextAnswers })
  }

  const changeStage = (next: Screen) => {
    if (selectedProblem && (activeStage || screen === 'grade')) {
      const nextPhase: PracticePhase = next === 'grade'
        ? 'grade'
        : stages.find((stage) => stage.id === next)?.id ?? 'understand'
      persistDraft(nextPhase)
    }
    setScreen(next)
    setDraftError(null)
  }

  const saveDraftAndReturn = () => {
    if (!selectedProblem) {
      setScreen('chooser')
      return
    }
    if (!persistDraft()) return
    setScreen('chooser')
    setFocusMode(false)
  }

  const exitSession = () => {
    if (activeStage || screen === 'grade') {
      const abandon = window.confirm('Leave this practice session? Your answers, revealed notes, and selected recall stage will be saved under Resume later.')
      if (!abandon) return
      if (!persistDraft()) return
    }
    setFocusMode(false)
    onDashboard()
  }

  const revealCode = async () => {
    if (!selectedProblem || !isJavaCode(selectedProblem.javaNotes)) return
    try {
      await navigator.clipboard.writeText(selectedProblem.javaNotes)
      setCopyStatus('Java solution copied.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Clipboard access is unavailable.'
      setCopyStatus(`Could not copy Java code. ${detail}`)
    }
  }

  const saveAttempt = () => {
    if (savingRef.current || completedAttempt || !selectedProblem || !outcome || !confidence) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const attemptedAt = new Date()
      const schedule = scheduleNextReview(
        outcome,
        confidence,
        attemptedAt,
        attempts
          .filter((attempt) => attempt.problemId === selectedProblem.id)
          .map(({ outcome: previousOutcome, confidence: previousConfidence, attemptedAt: previousDate }) => ({
            outcome: previousOutcome,
            confidence: previousConfidence,
            attemptedAt: previousDate,
          })),
      )
      const reflection = [
        forgot.trim() ? `What I forgot: ${forgot.trim()}` : '',
        remember.trim() ? `What to remember next time: ${remember.trim()}` : '',
      ].filter(Boolean).join('\n')
      const attempt: RecallAttempt = {
        id: window.crypto.randomUUID(),
        problemId: selectedProblem.id,
        problemTitle: selectedProblem.title,
        attemptedAt: attemptedAt.toISOString(),
        outcome,
        confidence,
        reflection,
        answers: { ...answers, testInputs: answers.testInputs ?? '' },
        hintRevealed,
        solutionRevealed,
        nextReviewDate: schedule.nextReviewDate,
        reviewIntervalDays: schedule.intervalDays,
        consecutiveHighConfidenceRecalls: schedule.consecutiveHighConfidenceRecalls,
      }
      const nextAttempts = [attempt, ...attempts]
      const error = saveRecallAttempts(nextAttempts)
      if (error) {
        setSaveError(error)
        return
      }
      setAttempts(nextAttempts)
      setCompletedAttempt(attempt)
      setScreen('complete')
      const removeError = removePracticeDraft(selectedProblem.id)
      if (removeError) {
        setSaveWarning(`The attempt was saved, but its draft could not be cleared. ${removeError}`)
      } else {
        setDrafts((current) => current.filter((draft) => draft.problemId !== selectedProblem.id))
        setSaveWarning(null)
      }
      setDraftStatus('')
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown save error.'
      setSaveError(`The recall attempt could not be saved. ${detail}`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const openAnotherProblem = () => {
    setSelectedProblemId('')
    setCompletedAttempt(null)
    setActiveHistoryId(null)
    setAnswers(emptyAnswers())
    setHintRevealed(false)
    setSolutionRevealed(false)
    setOutcome(null)
    setConfidence(null)
    setForgot('')
    setRemember('')
    setDraftStatus('')
    setSaveError(null)
    setSaveWarning(null)
    setScreen('chooser')
  }

  const reviewAttempt = (attempt: RecallAttempt) => {
    setActiveHistoryId(attempt.id)
    setScreen('history')
  }

  const updateReflection = (kind: 'forgot' | 'remember', value: string) => {
    if (kind === 'forgot') {
      setForgot(value)
      persistDraft(undefined, { forgot: value })
    } else {
      setRemember(value)
      persistDraft(undefined, { remember: value })
    }
  }

  const activeFields = activeStage?.fields ?? []
  const stageAnswered = activeFields.filter((field) => (answers[field.key] ?? '').trim()).length
  const isSession = Boolean(activeStage || screen === 'grade')
  const liveHistoryProblem = activeHistoryAttempt
    ? problems.find((problem) => problem.id === activeHistoryAttempt.problemId) ?? null
    : null

  return (
    <main className={`practice-page${focusMode ? ' practice-focus-mode' : ''}`}>
      <header className="practice-workspace-header">
        <div className="practice-brand-lockup">
          <span className="practice-brand-mark"><Icon name="spark" size={19} /></span>
          <span className="practice-brand-copy"><strong>Recall<span>.dev</span></strong><small>DSA practice workspace</small></span>
        </div>
        <div className="practice-header-main">
          <div className="practice-title-row">
            <div>
              <span className="practice-eyebrow">JAVA · SDE1 PREPARATION</span>
              <h1>Recall practice</h1>
              <p>Build a clear explanation before you reach for the editor.</p>
            </div>
            <button className="practice-button practice-button-secondary practice-exit-button" onClick={exitSession} type="button">
              <span aria-hidden="true">←</span> {isSession ? 'Save & exit' : 'Back to dashboard'}
            </button>
          </div>
          {isSession && (
            <div className="practice-session-progress">
              <span className="practice-progress-copy">Step {screen === 'grade' ? 7 : currentStageIndex + 1} of 7 <span>· {screen === 'grade' ? 'Grade your recall' : activeStage?.title}</span></span>
              <div aria-label={`Step ${screen === 'grade' ? 7 : currentStageIndex + 1} of 7`} className="practice-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={7} aria-valuenow={screen === 'grade' ? 7 : currentStageIndex + 1}>
                <span style={{ width: `${((screen === 'grade' ? 7 : currentStageIndex + 1) / 7) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div aria-live="polite" className="practice-loading"><span className="practice-spinner" />Loading your saved problems and practice history…</div>
      ) : loadError ? (
        <div className="practice-error" role="alert"><strong>Practice data could not be loaded</strong><p>{loadError}</p><button className="practice-button practice-button-secondary" onClick={() => window.location.reload()} type="button">Reload practice</button></div>
      ) : (
        <>
          {screen === 'chooser' && (
            <>
              <section aria-label="Review queue overview" className="practice-overview">
                {counts.scheduledProblems > 0 ? (
                  <>
                    <article><span>Due today</span><strong>{counts.dueProblems}</strong><small>Scheduled for today</small></article>
                    <article><span>Overdue</span><strong>{counts.overdueProblems}</strong><small>Past the saved review date</small></article>
                    <article><span>Upcoming</span><strong>{counts.upcomingProblems}</strong><small>Future scheduled reviews</small></article>
                  </>
                ) : (
                  <article className="practice-no-schedule"><span>Review schedule</span><strong>No scheduled reviews yet</strong><small>Counts appear after the scheduler records a review date.</small></article>
                )}
                <div className="practice-overview-total"><span>Saved library</span><strong>{problems.length} <small>problems</small></strong><span>{counts.completedSessions} saved {counts.completedSessions === 1 ? 'attempt' : 'attempts'}</span></div>
              </section>

              <section aria-labelledby="practice-library-title" className="practice-library">
                <div className="practice-section-heading">
                  <div><span className="practice-eyebrow">YOUR SAVED LIBRARY</span><h2 id="practice-library-title">Choose a problem to practice</h2></div>
                  <span className="practice-result-count">{filteredProblems.length} of {problems.length} problems</span>
                </div>
                <div className="practice-filters">
                  <label className="practice-search-field"><span>Search</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Title, topic, or pattern" type="search" value={query} /></label>
                  <label><span>Difficulty</span><select onChange={(event) => setDifficultyFilter(event.target.value)} value={difficultyFilter}><option value="">All difficulties</option>{['Easy', 'Medium', 'Hard'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                  <label><span>Review status</span><select onChange={(event) => setReviewFilter(event.target.value)} value={reviewFilter}><option value="">Any status</option><option value="overdue">Overdue</option><option value="due-today">Due today</option><option value="upcoming">Upcoming</option><option value="unscheduled">Not scheduled</option></select></label>
                  <label><span>Topic</span><select onChange={(event) => setTopicFilter(event.target.value)} value={topicFilter}><option value="">All topics</option>{[...new Set(problems.map((problem) => problem.topic))].sort().map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label>
                  <label><span>Pattern</span><select onChange={(event) => setPatternFilter(event.target.value)} value={patternFilter}><option value="">All patterns</option>{[...new Set(problems.map((problem) => problem.pattern))].sort().map((pattern) => <option key={pattern} value={pattern}>{pattern}</option>)}</select></label>
                </div>
                <p className="practice-priority-note">Due and overdue items are prioritized using the latest saved scheduler date.</p>

                {drafts.length > 0 && (
                  <section aria-labelledby="practice-resume-title" className="practice-resume-panel">
                    <div className="practice-section-heading"><div><span className="practice-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3 id="practice-resume-title">Resume later</h3></div><span className="practice-result-count">{drafts.length} saved drafts</span></div>
                    <div className="practice-resume-list">
                      {drafts.map((draft) => {
                        const draftProblem = problems.find((problem) => problem.id === draft.problemId)
                        return draftProblem ? (
                          <div className="practice-resume-row" key={draft.problemId}>
                            <span><strong>{draftProblem.title}</strong><small>{stages.find((stage) => stage.id === legacyPhase(draft.phase))?.title ?? 'Grade your recall'} · saved {formatAttemptDate(draft.savedAt)}</small></span>
                            <button className="practice-button practice-button-secondary" onClick={() => startSession(draft.problemId)} type="button">Resume</button>
                          </div>
                        ) : null
                      })}
                    </div>
                    {drafts.some((draft) => !problems.some((problem) => problem.id === draft.problemId)) && <p className="practice-missing-note">Some saved drafts refer to problems that are no longer in your library.</p>}
                  </section>
                )}

                {filteredProblems.length ? (
                  <div className="practice-problem-grid">{filteredProblems.map((problem) => <PracticeProblemCard attempts={attempts} hasDraft={drafts.some((draft) => draft.problemId === problem.id)} key={problem.id} onStart={startSession} problem={problem} today={today} />)}</div>
                ) : problems.length ? (
                  <div className="practice-no-results"><h3>No problems match these filters</h3><p>Adjust your search or clear a filter to see saved problems.</p><button className="practice-button practice-button-secondary" onClick={() => { setQuery(''); setDifficultyFilter(''); setTopicFilter(''); setPatternFilter(''); setReviewFilter('') }} type="button">Clear filters</button></div>
                ) : (
                  <div className="practice-empty"><span className="practice-empty-mark"><Icon name="book" size={24} /></span><span className="practice-eyebrow">YOUR LIBRARY IS EMPTY</span><h2>Add a problem to begin</h2><p>Practice works from your existing saved problem library. Add a problem and its reference notes in My Problems; nothing is copied into a separate practice library.</p><button className="practice-button practice-button-primary" onClick={onOpenProblems} type="button">Open My Problems</button></div>
                )}
              </section>
              <HistoryList attempts={attempts} onOpen={reviewAttempt} />
            </>
          )}

          {isSession && selectedProblem && (
            <div className="practice-session-layout">
              {!focusMode && (
                <aside className="practice-session-aside">
                  <div className="practice-outline-heading"><span>SESSION OUTLINE</span><button aria-expanded={outlineOpen} aria-label={`${outlineOpen ? 'Collapse' : 'Expand'} session outline`} onClick={() => setOutlineOpen((value) => !value)} type="button">{outlineOpen ? '−' : '+'}</button></div>
                  {outlineOpen && (
                    <nav aria-label="Recall session stages" className="practice-outline">
                      {stages.map((stage, index) => {
                        const active = screen === stage.id
                        const completed = currentStageIndex > index || screen === 'grade'
                        const reachable = index <= currentStageIndex || screen === 'grade'
                        return (
                          <button aria-current={active ? 'step' : undefined} className={`practice-outline-step${active ? ' is-active' : ''}${completed ? ' is-complete' : ''}`} disabled={!reachable} key={stage.id} onClick={() => changeStage(stage.id)} type="button">
                            <span className="practice-outline-number">{completed ? <Icon name="check" size={13} /> : index + 1}</span><span>{stage.title}</span>
                          </button>
                        )
                      })}
                      <div className={`practice-outline-step${screen === 'grade' ? ' is-active' : ''}${screen === 'grade' ? ' is-complete' : ''}`}><span className="practice-outline-number">{screen === 'grade' ? <Icon name="check" size={13} /> : 7}</span><span>Grade your recall</span></div>
                    </nav>
                  )}
                  <div className="practice-aside-actions">
                    <button className="practice-text-button" onClick={() => setFocusMode(true)} type="button">Enter focus mode</button>
                    <details className="practice-keyboard-help"><summary>Keyboard help</summary><p>Use Tab and Shift+Tab to move between controls. Use Enter or Space to activate a button. Use arrow keys within native radio groups and select menus.</p></details>
                  </div>
                </aside>
              )}
              <div className="practice-session-main">
                <section aria-labelledby="practice-problem-title" className="practice-session-problem">
                  <div className="practice-problem-meta"><span className={`difficulty-pill difficulty-${selectedProblem.difficulty.toLowerCase()}`}>{selectedProblem.difficulty}</span><span>{selectedProblem.topic}</span><span className="practice-pattern-tag">{selectedProblem.pattern}</span>{selectedProblem.isExample && <span className="example-badge">Editable starter example</span>}</div>
                  <h2 id="practice-problem-title">{selectedProblem.title}</h2>
                  {selectedProblem.statement.trim() ? <p className="practice-statement">{selectedProblem.statement}</p> : <p className="practice-inline-error" role="alert">No problem statement is saved for this problem.</p>}
                  {selectedProblem.url.trim() && <a className="practice-source-link" href={selectedProblem.url} rel="noopener noreferrer" target="_blank">Open source problem <span aria-hidden="true">↗</span></a>}
                  <div className="practice-problem-meta-foot"><span>Topic <strong>{selectedProblem.topic}</strong></span><span>Pattern <strong>{selectedProblem.pattern}</strong></span><span>Batch <strong>Not tracked in saved problem data</strong></span></div>
                </section>

                {focusMode && <div className="practice-focus-bar"><span>Focus mode · essential controls remain available</span><button className="practice-text-button" onClick={() => setFocusMode(false)} type="button">Exit focus mode</button></div>}

                {activeStage && (
                  <section aria-labelledby="practice-stage-title" className="practice-stage-panel">
                    <div className="practice-stage-heading"><div><span className="practice-eyebrow">STAGE {currentStageIndex + 1} OF 6</span><h2 id="practice-stage-title">{activeStage.prompt}</h2><p>{activeStage.description}</p></div>{activeFields.length > 0 && <span className="practice-stage-answer-count">{stageAnswered}/{activeFields.length} prompts</span>}</div>
                    {activeFields.map((field) => <AnswerField field={field} key={field.key} onChange={(value) => updateAnswer(field.key, value)} value={answers[field.key] ?? ''} />)}

                    {screen === 'review' && (
                      <div className="practice-review-content">
                        <div className="practice-comparison-list">
                          <ReferenceField answer={answers.understanding ?? ''} reference={selectedProblem.statement} revealed={solutionRevealed} title="Understand the problem" />
                          <ReferenceField answer={`${answers.pattern ?? ''}${answers.patternReason ? `\n\nWhy: ${answers.patternReason}` : ''}`} reference={selectedProblem.pattern} revealed={solutionRevealed} title="Pattern" />
                          <ReferenceField answer={`${answers.keyInsight ?? ''}${answers.approach ? `\n\n${answers.approach}` : ''}${answers.algorithm ? `\n\nSteps:\n${answers.algorithm}` : ''}`} reference={`${selectedProblem.approach}\n\n${selectedProblem.algorithm}`.trim()} revealed={solutionRevealed} title="Approach and algorithm" />
                          <ReferenceField answer={`${answers.timeComplexity ?? ''}${answers.timeComplexityReason ? ` · ${answers.timeComplexityReason}` : ''}\n${answers.spaceComplexity ?? ''}${answers.spaceComplexityReason ? ` · ${answers.spaceComplexityReason}` : ''}`} reference={`Time: ${selectedProblem.timeComplexity}\nSpace: ${selectedProblem.spaceComplexity}`} revealed={solutionRevealed} title="Complexity" />
                          <ReferenceField answer={`${answers.edgeCases ?? ''}\nExample: ${answers.testCaseExample ?? ''}\nExpected output: ${answers.expectedOutput ?? ''}`} reference={selectedProblem.mistakes} revealed={solutionRevealed} title="Test cases and common mistakes" />
                        </div>
                        <section className="practice-reveal-panel">
                          <div><span className="practice-eyebrow">REVEAL ONLY WHEN READY</span><h3>Saved references</h3><p>Reveal a hint on its own, or reveal saved solution notes separately.</p></div>
                          <div className="practice-reveal-actions">
                            <button aria-expanded={hintRevealed} className="practice-button practice-button-secondary" onClick={() => { const next = !hintRevealed; setHintRevealed(next); persistDraft(undefined, { hintRevealed: next }) }} type="button">{hintRevealed ? 'Hide hint' : 'Reveal hint'}</button>
                            <button aria-expanded={solutionRevealed} className="practice-button practice-button-primary" onClick={() => { const next = !solutionRevealed; setSolutionRevealed(next); persistDraft(undefined, { solutionRevealed: next }); setCopyStatus('') }} type="button">{solutionRevealed ? 'Hide saved solution' : 'Reveal saved solution'}</button>
                          </div>
                          {hintRevealed && <div className="practice-revealed-note"><strong>Saved hint</strong><p>{selectedProblem.hints.trim() || 'No hint is saved for this problem.'}</p></div>}
                          {solutionRevealed && (
                            <div className="practice-solution">
                              {selectedProblem.approach.trim() && <section><h4>Saved approach</h4><p>{selectedProblem.approach}</p></section>}
                              {selectedProblem.algorithm.trim() && <section><h4>Saved algorithm</h4><pre>{selectedProblem.algorithm}</pre></section>}
                              {selectedProblem.javaNotes.trim() && <section><div className="practice-code-heading"><h4>Java notes or code</h4>{isJavaCode(selectedProblem.javaNotes) && <button className="practice-copy-button" onClick={() => void revealCode()} type="button">Copy Java code</button>}</div><pre className={isJavaCode(selectedProblem.javaNotes) ? 'practice-code' : ''}>{selectedProblem.javaNotes}</pre>{copyStatus && <span aria-live="polite" className="practice-copy-status">{copyStatus}</span>}</section>}
                              {selectedProblem.timeComplexity.trim() && <section><h4>Saved time complexity</h4><p>{selectedProblem.timeComplexity}</p></section>}
                              {selectedProblem.spaceComplexity.trim() && <section><h4>Saved space complexity</h4><p>{selectedProblem.spaceComplexity}</p></section>}
                              {selectedProblem.mistakes.trim() && <section><h4>Saved common mistakes</h4><p>{selectedProblem.mistakes}</p></section>}
                              {!selectedProblem.approach.trim() && !selectedProblem.algorithm.trim() && !selectedProblem.javaNotes.trim() && !selectedProblem.timeComplexity.trim() && !selectedProblem.spaceComplexity.trim() && !selectedProblem.mistakes.trim() && <p className="practice-missing-note">No saved solution reference is available for this problem. No reference answer has been invented.</p>}
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                    <div className="practice-stage-actions">
                      <span aria-live="polite">{(draftError ?? draftStatus) || 'Your notes save to a local draft as you type.'}</span>
                      <div><button className="practice-button practice-button-secondary" onClick={saveDraftAndReturn} type="button">Save draft &amp; exit</button>{currentStageIndex > 0 && <button className="practice-button practice-button-quiet" onClick={() => changeStage(stages[currentStageIndex - 1].id)} type="button">Back</button>}<button className="practice-button practice-button-primary" onClick={() => changeStage(currentStageIndex === stages.length - 1 ? 'grade' : stages[currentStageIndex + 1].id)} type="button">{currentStageIndex === stages.length - 1 ? 'Continue to grading' : 'Continue'} <Icon name="arrow" size={15} /></button></div>
                    </div>
                  </section>
                )}

                {screen === 'grade' && (
                  <section aria-labelledby="practice-grade-title" className="practice-stage-panel practice-grade">
                    <div className="practice-stage-heading"><div><span className="practice-eyebrow">FINAL STEP · GRADE YOUR RECALL</span><h2 id="practice-grade-title">How did the attempt go?</h2><p>Choose the outcome that best reflects how you arrived at your answer.</p></div></div>
                    <fieldset className="practice-choice-fieldset"><legend>Attempt outcome</legend><div className="practice-outcomes">{outcomes.map((item) => <button aria-pressed={outcome === item.value} className={`practice-outcome${outcome === item.value ? ' practice-outcome-selected' : ''}`} key={item.value} onClick={() => { setOutcome(item.value); persistDraft('grade', { outcome: item.value }) }} type="button"><span aria-hidden="true" className="practice-radio" />{item.label}</button>)}</div></fieldset>
                    <fieldset className="practice-choice-fieldset practice-confidence"><legend>Confidence · choose 1 to 5</legend><div className="practice-confidence-options">{([1, 2, 3, 4, 5] as const).map((rating) => <button aria-label={`Confidence ${rating}: ${confidenceLabels[rating]}`} aria-pressed={confidence === rating} className={`practice-confidence-option${confidence === rating ? ' practice-confidence-selected' : ''}`} key={rating} onClick={() => { setConfidence(rating); persistDraft('grade', { confidence: rating }) }} type="button"><strong>{rating}</strong><span>{confidenceLabels[rating]}</span></button>)}</div></fieldset>
                    <div className="practice-reflections"><AnswerField field={{ key: 'understanding', label: 'What did I forget?', placeholder: 'Capture the specific part you want to revisit.', rows: 4 }} onChange={(value) => updateReflection('forgot', value)} value={forgot} /><AnswerField field={{ key: 'understanding', label: 'What should I remember next time?', placeholder: 'Save the reminder you want to see on a future review.', rows: 4 }} onChange={(value) => updateReflection('remember', value)} value={remember} /></div>
                    {(draftError || saveError) && <p className="practice-inline-error" role="alert">{draftError ?? saveError}</p>}
                    <div className="practice-stage-actions"><span>{!outcome || !confidence ? 'Select an outcome and confidence rating to save this attempt.' : 'This attempt will be added to your shared recall history.'}</span><div><button className="practice-button practice-button-secondary" onClick={saveDraftAndReturn} type="button">Save draft &amp; exit</button><button className="practice-button practice-button-quiet" onClick={() => changeStage('review')} type="button">Back</button><button className="practice-button practice-button-primary" disabled={!outcome || !confidence || saving} onClick={saveAttempt} type="button">{saving ? 'Saving…' : 'Save attempt'}</button></div></div>
                  </section>
                )}
              </div>
            </div>
          )}

          {screen === 'complete' && completedAttempt && (
            <CompletionPanel
              attempt={completedAttempt}
              onAnother={openAnotherProblem}
              onDashboard={onDashboard}
              onPractice={() => startSession(completedAttempt.problemId)}
              onReview={() => reviewAttempt(completedAttempt)}
              problem={problems.find((problem) => problem.id === completedAttempt.problemId) ?? null}
              saveWarning={saveWarning}
            />
          )}

          {screen === 'history' && (
            <section aria-labelledby="practice-history-title" className="practice-history-page">
              <div className="practice-section-heading"><div><span className="practice-eyebrow">YOUR SAVED RECALL HISTORY</span><h2 id="practice-history-title">{activeHistoryAttempt ? activeHistoryAttempt.problemTitle : 'Attempt history'}</h2></div><button className="practice-button practice-button-secondary" onClick={() => { setActiveHistoryId(null); setScreen('chooser') }} type="button">Back to practice</button></div>
              {activeHistoryAttempt ? (
                <article className="practice-history-detail">
                  <div className="practice-history-summary"><span>Problem ID<strong>{activeHistoryAttempt.problemId}</strong></span><span>Attempted<strong>{formatAttemptDate(activeHistoryAttempt.attemptedAt)}</strong></span><span>Outcome<strong>{activeHistoryAttempt.outcome}</strong></span><span>Confidence<strong>{activeHistoryAttempt.confidence}/5 · {confidenceLabels[activeHistoryAttempt.confidence]}</strong></span><span>Hint revealed<strong>{activeHistoryAttempt.hintRevealed ? 'Yes' : 'No'}</strong></span><span>Solution revealed<strong>{activeHistoryAttempt.solutionRevealed ? 'Yes' : 'No'}</strong></span></div>
                  {activeHistoryAttempt.nextReviewDate && <p className="practice-history-review-date">Review date · {dateForDisplay(activeHistoryAttempt.nextReviewDate)}</p>}
                  <h3>Your saved answers</h3>
                  <div className="practice-comparison-list">{stages.slice(0, 5).flatMap((stage) => stage.fields.map((field) => ({ ...field, stage: stage.title }))).filter((field) => (activeHistoryAttempt.answers[field.key] ?? '').trim()).map((field) => <div className="practice-history-answer" key={`${field.stage}-${field.key}`}><span>{field.stage} · {field.label}</span><p>{activeHistoryAttempt.answers[field.key]}</p></div>)}</div>
                  <h3>Your reflection</h3><p className="practice-history-reflection">{activeHistoryAttempt.reflection || 'No reflection was saved for this attempt.'}</p>
                  {liveHistoryProblem ? <><h3>Saved problem reference</h3><p className="practice-history-reflection">{liveHistoryProblem.mistakes.trim() || 'No saved mistake notes are available for comparison.'}</p><button className="practice-button practice-button-primary" onClick={() => startSession(liveHistoryProblem.id)} type="button">Practice this problem again</button></> : <p className="practice-missing-note">This problem has been deleted from your library. The saved attempt and reflection remain available in history.</p>}
                </article>
              ) : <HistoryList attempts={attempts} onOpen={reviewAttempt} />}
            </section>
          )}

          {screen === 'chooser' && problems.length === 0 && (
            <section className="practice-library-empty-note"><p>Your saved attempt history remains available even when the problem library is empty.</p></section>
          )}
        </>
      )}
      {!loading && <footer className="practice-footer"><span>Recall.dev · Practice from your saved problem library.</span><span>Problems, drafts, and attempts are stored in this browser.</span></footer>}
    </main>
  )
}

function HistoryList({ attempts, onOpen }: { attempts: RecallAttempt[]; onOpen: (attempt: RecallAttempt) => void }) {
  return (
    <section aria-labelledby="practice-history-list-title" className="practice-history-list">
      <div className="practice-section-heading"><div><span className="practice-eyebrow">YOUR PRACTICE</span><h2 id="practice-history-list-title">Attempt history</h2></div><span className="practice-result-count">{attempts.length} saved</span></div>
      {attempts.length ? (
        <div className="practice-attempt-list">{attempts.map((attempt) => (
          <article className="practice-attempt-row" key={attempt.id}>
            <div><strong>{attempt.problemTitle}</strong><span>{formatAttemptDate(attempt.attemptedAt)}</span>{attempt.reflection && <p>{attempt.reflection}</p>}</div>
            <div className="practice-attempt-outcome"><strong>{attempt.outcome}</strong><span>Confidence {attempt.confidence}/5</span><button className="practice-text-button" onClick={() => onOpen(attempt)} type="button">Open reflection</button></div>
          </article>
        ))}</div>
      ) : <div className="practice-no-results"><Icon name="clock" size={22} /><h3>No saved attempts yet</h3><p>Completed practice sessions appear here with their date, outcome, confidence, and reflection.</p></div>}
    </section>
  )
}
