import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { dateForDisplay, loadProblems } from '../problems/problemStorage'
import type { Confidence, Problem } from '../problems/problemTypes'
import {
  loadRecallAttempts,
  saveRecallAttempts,
  type RecallAnswers,
  type RecallAttempt,
  type RecallOutcome,
} from './recallStorage'
import {
  compareLocalDates,
  getLocalToday,
  scheduleNextReview,
} from './scheduler'
import './RecallModule.css'

type LoadState<T> = { value: T | null; error: string | null }

const prompts: { key: keyof RecallAnswers; label: string; placeholder: string }[] = [
  {
    key: 'pattern',
    label: 'What pattern does the problem use?',
    placeholder: 'Name the pattern and what clue led you to it...',
  },
  {
    key: 'approach',
    label: 'Explain the approach in your own words.',
    placeholder: 'Describe the main idea without looking at your saved notes...',
  },
  {
    key: 'algorithm',
    label: 'What is the algorithm step by step?',
    placeholder: 'Write one step per line...',
  },
  {
    key: 'timeComplexity',
    label: 'What is the time complexity and why?',
    placeholder: 'Include the complexity and why it has that cost...',
  },
  {
    key: 'spaceComplexity',
    label: 'What is the space complexity and why?',
    placeholder: 'Include the complexity and what extra memory is used...',
  },
  {
    key: 'edgeCases',
    label: 'Which edge cases should be tested?',
    placeholder: 'List inputs or boundary conditions worth checking...',
  },
]

const outcomes: RecallOutcome[] = [
  'Solved independently',
  'Solved with a hint',
  'Need the solution',
  'Could not solve',
]

const noAttempts: RecallAttempt[] = []

const emptyAnswers = (): RecallAnswers => ({
  pattern: '',
  approach: '',
  algorithm: '',
  timeComplexity: '',
  spaceComplexity: '',
  edgeCases: '',
})

function loadData(): {
  problems: LoadState<Problem[]>
  attempts: LoadState<RecallAttempt[]>
} {
  const problemResult = loadProblems()
  const attemptResult = loadRecallAttempts()
  return {
    problems: { value: problemResult.problems, error: problemResult.error },
    attempts: { value: attemptResult.attempts, error: attemptResult.error },
  }
}

function formatAttemptDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="recall-detail-block">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  )
}

function SolutionReveal({ problem }: { problem: Problem }) {
  const sections = [
    { title: 'Approach', value: problem.approach },
    { title: 'Step-by-step algorithm', value: problem.algorithm, ordered: true },
    { title: 'Java solution notes or code', value: problem.javaNotes, code: true },
    { title: 'Time complexity', value: problem.timeComplexity },
    { title: 'Space complexity', value: problem.spaceComplexity },
    { title: 'Common mistakes', value: problem.mistakes },
    { title: 'Hints', value: problem.hints },
  ].filter((section) => section.value.trim() !== '')

  return (
    <section aria-labelledby="revealed-solution-title" className="revealed-solution">
      <div className="revealed-solution-heading">
        <span className="solution-check" aria-hidden="true">✓</span>
        <div>
          <h3 id="revealed-solution-title">Saved solution revealed</h3>
          <p>Compare it with your recall, then grade how the attempt went.</p>
        </div>
      </div>
      {sections.length > 0 ? (
        <div className="revealed-solution-grid">
          {sections.map((section) => (
            <DetailBlock key={section.title} title={section.title}>
              {section.ordered ? (
                <ol className="recall-algorithm">
                  {section.value.split('\n').map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
                    .map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
                </ol>
              ) : (
                <p className={section.code ? 'recall-code' : ''}>{section.value}</p>
              )}
            </DetailBlock>
          ))}
        </div>
      ) : (
        <p className="solution-empty">
          This problem has no saved approach, algorithm, code notes, complexity, hints, or mistake notes yet.
          You can add them in My problems.
        </p>
      )}
    </section>
  )
}

function CompletionCard({ attempt, onAgain }: { attempt: RecallAttempt; onAgain: () => void }) {
  return (
    <section aria-live="polite" className="recall-completion">
      <span className="completion-mark" aria-hidden="true">✓</span>
      <span className="module-eyebrow">ATTEMPT SAVED</span>
      <h2>Good work showing up for recall.</h2>
      <p>
        <strong>{attempt.problemTitle}</strong> · {attempt.outcome} · Confidence {attempt.confidence}/5
      </p>
      {attempt.nextReviewDate && (
        <span className="completion-review-date">
          Next review {attempt.reviewIntervalDays === 0 ? 'today' : `in ${attempt.reviewIntervalDays} ${attempt.reviewIntervalDays === 1 ? 'day' : 'days'}`}
          {' · '}{dateForDisplay(attempt.nextReviewDate)}
        </span>
      )}
      <span className="completion-date">Saved {formatAttemptDate(attempt.attemptedAt)}</span>
      <button className="button button-primary" onClick={onAgain} type="button">Practice another problem</button>
    </section>
  )
}

function RecentAttempts({ attempts }: { attempts: RecallAttempt[] }) {
  if (attempts.length === 0) return null

  return (
    <section aria-labelledby="recent-attempts-title" className="recent-attempts">
      <div className="recall-section-heading">
        <div>
          <span className="section-kicker">YOUR PRACTICE</span>
          <h2 id="recent-attempts-title">Recent attempts</h2>
        </div>
        <span className="attempt-count">{attempts.length} saved</span>
      </div>
      <div className="attempt-list">
        {attempts.slice(0, 5).map((attempt) => (
          <article className="attempt-row" key={attempt.id}>
            <div className="attempt-row-copy">
              <strong>{attempt.problemTitle}</strong>
              <span>{formatAttemptDate(attempt.attemptedAt)}</span>
              {attempt.reflection && <p>{attempt.reflection}</p>}
            </div>
            <div className="attempt-result">
              <span>{attempt.outcome}</span>
              <span>Confidence {attempt.confidence}/5</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ReviewSchedulePanel({
  problems,
  attempts,
}: {
  problems: Problem[]
  attempts: RecallAttempt[]
}) {
  const today = getLocalToday()
  const scheduledReviews = useMemo(() => {
    const problemIds = new Set(problems.map((problem) => problem.id))
    const latestByProblem = new Map<string, RecallAttempt>()

    for (const attempt of [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))) {
      if (
        problemIds.has(attempt.problemId) &&
        attempt.nextReviewDate &&
        !latestByProblem.has(attempt.problemId)
      ) {
        latestByProblem.set(attempt.problemId, attempt)
      }
    }

    return [...latestByProblem.values()].sort((a, b) =>
      (a.nextReviewDate ?? '').localeCompare(b.nextReviewDate ?? ''),
    )
  }, [attempts, problems])

  const overdue = scheduledReviews.filter((attempt) =>
    compareLocalDates(attempt.nextReviewDate!, today) < 0,
  )
  const dueToday = scheduledReviews.filter((attempt) =>
    compareLocalDates(attempt.nextReviewDate!, today) === 0,
  )
  const upcoming = scheduledReviews.filter((attempt) =>
    compareLocalDates(attempt.nextReviewDate!, today) > 0,
  )

  return (
    <section aria-labelledby="review-schedule-title" className="review-schedule">
      <div className="recall-section-heading">
        <div>
          <span className="section-kicker">SPACED REPETITION</span>
          <h2 id="review-schedule-title">Review schedule</h2>
        </div>
        <span className="schedule-date">Today · {dateForDisplay(today)}</span>
      </div>
      <div className="schedule-counts">
        <div className="schedule-count schedule-count-overdue">
          <strong>{overdue.length}</strong><span>Overdue</span>
        </div>
        <div className="schedule-count schedule-count-due">
          <strong>{dueToday.length}</strong><span>Due today</span>
        </div>
        <div className="schedule-count schedule-count-upcoming">
          <strong>{upcoming.length}</strong><span>Upcoming</span>
        </div>
      </div>
      {scheduledReviews.length === 0 ? (
        <p className="schedule-empty">Complete a recall attempt to create your first scheduled review.</p>
      ) : (
        <div className="schedule-list">
          {scheduledReviews.slice(0, 6).map((attempt) => {
            const comparison = compareLocalDates(attempt.nextReviewDate!, today)
            const status = comparison < 0 ? 'Overdue' : comparison === 0 ? 'Due today' : 'Upcoming'
            return (
              <div className="schedule-row" key={attempt.problemId}>
                <div>
                  <strong>{attempt.problemTitle}</strong>
                  <span>{attempt.reviewIntervalDays === 0
                    ? 'Review again today'
                    : `Review in ${attempt.reviewIntervalDays} ${attempt.reviewIntervalDays === 1 ? 'day' : 'days'}`}</span>
                </div>
                <div className={`schedule-row-date schedule-row-${comparison < 0 ? 'overdue' : comparison === 0 ? 'due' : 'upcoming'}`}>
                  <span>{status}</span>
                  <strong>{dateForDisplay(attempt.nextReviewDate!)}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function RecallModule({ initialProblemId = null }: { initialProblemId?: string | null }) {
  const [data, setData] = useState<{
    problems: LoadState<Problem[]>
    attempts: LoadState<RecallAttempt[]>
  }>({
    problems: { value: null, error: null },
    attempts: { value: null, error: null },
  })
  const [loading, setLoading] = useState(true)
  const [selectedProblemId, setSelectedProblemId] = useState(initialProblemId ?? '')
  const [answers, setAnswers] = useState<RecallAnswers>(emptyAnswers)
  const [revealed, setRevealed] = useState(false)
  const [outcome, setOutcome] = useState<RecallOutcome | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [reflection, setReflection] = useState('')
  const [completed, setCompleted] = useState<RecallAttempt | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    window.setTimeout(() => {
      setData(loadData())
      setLoading(false)
    }, 120)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(loadData())
      setLoading(false)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  const problems = data.problems.value ?? []
  const attempts = data.attempts.value ?? noAttempts
  const selectedProblem = problems.find((problem) => problem.id === selectedProblemId) ?? null
  const unansweredPrompts = prompts.filter((prompt) => !answers[prompt.key].trim()).length
  const recentAttempts = useMemo(
    () => [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)),
    [attempts],
  )

  const resetPractice = () => {
    setSelectedProblemId('')
    setAnswers(emptyAnswers())
    setRevealed(false)
    setOutcome(null)
    setConfidence(null)
    setReflection('')
    setCompleted(null)
    setSaveError(null)
  }

  const selectProblem = (problemId: string) => {
    setSelectedProblemId(problemId)
    setAnswers(emptyAnswers())
    setRevealed(false)
    setOutcome(null)
    setConfidence(null)
    setReflection('')
    setCompleted(null)
    setSaveError(null)
  }

  const saveAttempt = () => {
    if (!selectedProblem || !outcome || !confidence || !data.attempts.value) return

    const attemptedAt = new Date()
    const previousRecalls = data.attempts.value
      .filter((attempt) => attempt.problemId === selectedProblem.id)
      .map((attempt) => ({
        outcome: attempt.outcome,
        confidence: attempt.confidence,
        attemptedAt: attempt.attemptedAt,
      }))
    const schedule = scheduleNextReview(outcome, confidence, attemptedAt, previousRecalls)
    const attempt: RecallAttempt = {
      id: window.crypto.randomUUID(),
      problemId: selectedProblem.id,
      problemTitle: selectedProblem.title,
      attemptedAt: attemptedAt.toISOString(),
      outcome,
      confidence,
      reflection: reflection.trim(),
      answers,
      nextReviewDate: schedule.nextReviewDate,
      reviewIntervalDays: schedule.intervalDays,
      consecutiveHighConfidenceRecalls: schedule.consecutiveHighConfidenceRecalls,
    }
    const nextAttempts = [attempt, ...data.attempts.value]
    const error = saveRecallAttempts(nextAttempts)
    if (error) {
      setSaveError(error)
      return
    }

    setData((current) => ({
      ...current,
      attempts: { value: nextAttempts, error: null },
    }))
    setCompleted(attempt)
    setSaveError(null)
  }

  return (
    <main className="recall-page">
      <section className="recall-hero">
        <div className="recall-hero-copy">
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> RETRIEVAL PRACTICE</span>
          <h1>Remember it <span>before</span> you see it.</h1>
          <p>Rebuild the reasoning from memory. Your saved solution stays tucked away until you choose to reveal it.</p>
        </div>
        <div aria-hidden="true" className="recall-hero-mark">?</div>
      </section>

      {loading ? (
        <div aria-live="polite" className="recall-loading">
          <span className="loading-indicator" />
          <span>Loading your saved problems and practice history…</span>
        </div>
      ) : data.problems.error || data.attempts.error ? (
        <div className="recall-storage-error" role="alert">
          <div>
            <strong>Recall practice could not load</strong>
            <p>{data.problems.error ?? data.attempts.error}</p>
            {data.attempts.error && data.problems.error && <p>{data.attempts.error}</p>}
          </div>
          <button className="button button-quiet" onClick={reload} type="button">Retry loading</button>
        </div>
      ) : problems.length === 0 ? (
        <section className="recall-empty">
          <span className="recall-empty-icon" aria-hidden="true">↗</span>
          <span className="section-kicker">YOUR LIBRARY IS EMPTY</span>
          <h2>Add a saved problem to begin</h2>
          <p>Recall practice uses the problems already in your library. Add one in My problems, then come back to practice.</p>
        </section>
      ) : completed ? (
        <>
          <CompletionCard attempt={completed} onAgain={resetPractice} />
          <ReviewSchedulePanel attempts={recentAttempts} problems={problems} />
          <RecentAttempts attempts={recentAttempts} />
        </>
      ) : (
        <>
          <section aria-labelledby="choose-problem-title" className="recall-select-panel">
            <div className="recall-section-heading">
              <div>
                <span className="section-kicker">START A SESSION</span>
                <h2 id="choose-problem-title">Choose a saved problem</h2>
              </div>
              <span className="problem-total">{problems.length} {problems.length === 1 ? 'problem' : 'problems'}</span>
            </div>
            <label className="recall-problem-select">
              <span className="sr-only">Select a problem to practice</span>
              <select onChange={(event) => selectProblem(event.target.value)} value={selectedProblemId}>
                <option value="">Select from your problem library…</option>
                {problems.map((problem) => (
                  <option key={problem.id} value={problem.id}>
                    {problem.title} · {problem.difficulty}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <ReviewSchedulePanel attempts={attempts} problems={problems} />

          {selectedProblem && (
            <>
              <section aria-labelledby="recall-problem-title" className="recall-problem-card">
                <div className="recall-problem-meta">
                  <span className={`difficulty-pill difficulty-${selectedProblem.difficulty.toLowerCase()}`}>
                    {selectedProblem.difficulty}
                  </span>
                  <span>{selectedProblem.topic}</span>
                  {selectedProblem.isExample && <span className="example-badge">Editable example</span>}
                </div>
                <h2 id="recall-problem-title">{selectedProblem.title}</h2>
                <p>{selectedProblem.statement || 'No problem statement has been saved for this problem yet.'}</p>
                <a className="recall-problem-link" href={selectedProblem.url} rel="noreferrer" target="_blank">
                  Open problem statement <span aria-hidden="true">↗</span>
                </a>
              </section>

              {!completed && (
                <section aria-labelledby="recall-prompts-title" className="recall-questions">
                  <div className="recall-section-heading">
                    <div>
                      <span className="section-kicker">RECALL FROM MEMORY</span>
                      <h2 id="recall-prompts-title">Work it through before revealing</h2>
                    </div>
                    <span className="prompt-progress">
                      {prompts.length - unansweredPrompts} / {prompts.length} answered
                    </span>
                  </div>
                  <div className="recall-prompt-grid">
                    {prompts.map((prompt, index) => (
                      <label className="recall-prompt" key={prompt.key}>
                        <span className="recall-prompt-label">
                          <span>{`${index + 1}`.padStart(2, '0')}</span>
                          {prompt.label}
                        </span>
                        <textarea
                          onChange={(event) => setAnswers((current) => ({
                            ...current,
                            [prompt.key]: event.target.value,
                          }))}
                          placeholder={prompt.placeholder}
                          rows={prompt.key === 'algorithm' ? 4 : 3}
                          value={answers[prompt.key]}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="reveal-row">
                    <p>{unansweredPrompts > 0
                      ? `${unansweredPrompts} ${unansweredPrompts === 1 ? 'prompt remains' : 'prompts remain'} before you can reveal the saved solution.`
                      : 'All prompts answered. Reveal when you are ready to compare.'}</p>
                    <button
                      className="button button-primary reveal-button"
                      disabled={unansweredPrompts > 0}
                      onClick={() => setRevealed(true)}
                      type="button"
                    >
                      Reveal solution
                    </button>
                  </div>
                </section>
              )}

              {revealed && (
                <>
                  <SolutionReveal problem={selectedProblem} />
                  <section aria-labelledby="grade-attempt-title" className="grade-panel">
                    <div className="recall-section-heading">
                      <div>
                        <span className="section-kicker">REFLECT, THEN SAVE</span>
                        <h2 id="grade-attempt-title">How did the attempt go?</h2>
                      </div>
                    </div>
                    <fieldset className="outcome-fieldset">
                      <legend>Choose an outcome</legend>
                      <div className="outcome-options">
                        {outcomes.map((item) => (
                          <button
                            aria-pressed={outcome === item}
                            className={`outcome-option${outcome === item ? ' outcome-option--selected' : ''}`}
                            key={item}
                            onClick={() => setOutcome(item)}
                            type="button"
                          >
                            <span className="outcome-radio" aria-hidden="true" />
                            {item}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="confidence-fieldset">
                      <legend>How confident did you feel? <span>Choose 1–5</span></legend>
                      <div aria-label="Confidence from 1 to 5" className="confidence-options" role="group">
                        {([1, 2, 3, 4, 5] as const).map((rating) => (
                          <button
                            aria-label={`Confidence ${rating} of 5`}
                            aria-pressed={confidence === rating}
                            className={`confidence-option${confidence === rating ? ' confidence-option--selected' : ''}`}
                            key={rating}
                            onClick={() => setConfidence(rating)}
                            type="button"
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      <div className="confidence-ends"><span>Not confident</span><span>Very confident</span></div>
                    </fieldset>
                    <label className="reflection-field">
                      <span>Reflection <span>Optional</span></span>
                      <textarea
                        onChange={(event) => setReflection(event.target.value)}
                        placeholder="What would you like to remember for next time?"
                        rows={3}
                        value={reflection}
                      />
                    </label>
                    {saveError && <p className="recall-save-error" role="alert">{saveError}</p>}
                    <div className="save-attempt-row">
                      <p>{!outcome || !confidence ? 'Choose an outcome and confidence rating to save this attempt.' : 'Your attempt will be saved to this browser.'}</p>
                      <button
                        className="button button-primary"
                        disabled={!outcome || !confidence}
                        onClick={saveAttempt}
                        type="button"
                      >
                        Save attempt
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          <RecentAttempts attempts={recentAttempts} />
        </>
      )}

      {!loading && (
        <footer className="problems-footer recall-footer">
          <span>Recall.dev <span>·</span> Build recall that lasts.</span>
          <span>Recall practice</span>
        </footer>
      )}
    </main>
  )
}
