import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { dateForDisplay, loadProblems, saveProblems } from '../problems/problemStorage'
import type { Problem } from '../problems/problemTypes'
import { loadRecallAttempts } from '../recall/recallStorage'
import { getLocalToday } from '../recall/scheduler'
import { buildTopicSummaries } from './topicUtils'
import './PatternsExplorer.css'

const suggestedTopics = [
  'Arrays',
  'Strings',
  'Hash Map',
  'Sliding Window',
  'Two Pointers',
  'Prefix Sum',
  'Stack',
  'Linked List',
  'Trees',
]

const suggestedPatterns = [
  'Hash Map',
  'Hash Set',
  'Sliding Window',
  'Two Pointers',
  'Prefix Sum',
  'Fast & Slow Pointers',
  'Binary Search',
  'Monotonic Stack',
  'Depth-First Search',
  'Breadth-First Search',
]

interface ExplorerData {
  problems: Problem[]
  attempts: ReturnType<typeof loadRecallAttempts>['attempts']
  problemError: string | null
  recallError: string | null
}

function loadExplorerData(): ExplorerData {
  const problemResult = loadProblems()
  const recallResult = loadRecallAttempts()
  return {
    problems: problemResult.problems,
    attempts: recallResult.attempts,
    problemError: problemResult.error,
    recallError: recallResult.error,
  }
}

function TopicEditor({
  problem,
  onCancel,
  onSave,
}: {
  problem: Problem
  onCancel: () => void
  onSave: (topic: string, pattern: string) => void
}) {
  const [topic, setTopic] = useState(problem.topic)
  const [pattern, setPattern] = useState(problem.pattern)
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!topic.trim() || !pattern.trim()) {
      setError('Enter both a topic and a problem-solving pattern.')
      return
    }
    setError('')
    onSave(topic.trim(), pattern.trim())
  }

  return (
    <form aria-label={`Edit topic and pattern for ${problem.title}`} className="topic-editor" onSubmit={submit}>
      <label>
        <span>Topic</span>
        <input
          aria-label={`Topic for ${problem.title}`}
          list="topic-suggestions"
          maxLength={80}
          onChange={(event) => setTopic(event.target.value)}
          required
          value={topic}
        />
      </label>
      <label>
        <span>Pattern</span>
        <input
          aria-label={`Pattern for ${problem.title}`}
          list="pattern-suggestions"
          maxLength={80}
          onChange={(event) => setPattern(event.target.value)}
          required
          value={pattern}
        />
      </label>
      {error && <p className="topic-editor-error" role="alert">{error}</p>}
      <div className="topic-editor-actions">
        <button className="topic-action topic-action-quiet" onClick={onCancel} type="button">Cancel</button>
        <button className="topic-action topic-action-primary" type="submit">Save labels</button>
      </div>
    </form>
  )
}

function ProblemTopicCard({
  problem,
  onOpen,
  onRecall,
  onEdit,
  editing,
  onCancelEdit,
  onSaveLabels,
}: {
  problem: Problem
  onOpen: () => void
  onRecall: () => void
  onEdit: () => void
  editing: boolean
  onCancelEdit: () => void
  onSaveLabels: (topic: string, pattern: string) => void
}) {
  return (
    <article className="topic-problem-card">
      <div className="topic-problem-main">
        <div className="topic-problem-title-row">
          <h3>{problem.title}</h3>
          {problem.isExample && <span className="topic-example-badge">Editable example</span>}
        </div>
        <div className="topic-problem-labels">
          <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
          <span className="topic-label">{problem.topic || 'Uncategorized'}</span>
          <span aria-hidden="true" className="topic-label-separator">·</span>
          <span className="topic-label">{problem.pattern || 'No pattern assigned'}</span>
        </div>
        <p className="topic-problem-summary">
          {problem.approach.trim() || problem.statement}
        </p>
        <span className="topic-problem-date">Last reviewed {dateForDisplay(problem.lastReviewedAt)}</span>
      </div>
      <div className="topic-problem-actions">
        <button className="topic-action topic-action-quiet" onClick={onEdit} type="button">
          Edit topic &amp; pattern
        </button>
        <button className="topic-action topic-action-quiet" onClick={onOpen} type="button">Open problem</button>
        <button className="topic-action topic-action-primary" onClick={onRecall} type="button">Start recall</button>
      </div>
      {editing && (
        <TopicEditor problem={problem} onCancel={onCancelEdit} onSave={onSaveLabels} />
      )}
    </article>
  )
}

export default function PatternsExplorer({
  onOpenProblem,
  onStartRecall,
  onOpenProblemLibrary,
}: {
  onOpenProblem: (problemId: string) => void
  onStartRecall: (problemId: string) => void
  onOpenProblemLibrary: () => void
}) {
  const [data, setData] = useState<ExplorerData>(() => loadExplorerData())
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(loadExplorerData())
      setLoading(false)
    }, 100)
    return () => window.clearTimeout(timer)
  }, [])

  const summaries = useMemo(
    () => buildTopicSummaries(data.problems, data.attempts, getLocalToday()),
    [data.attempts, data.problems],
  )
  const categories = useMemo(() => {
    const actualTopics = summaries.map(({ topic }) => topic)
    const extraSuggestions = suggestedTopics.filter(
      (suggestion) => !actualTopics.some((topic) => topic.toLocaleLowerCase() === suggestion.toLocaleLowerCase()),
    )
    return [
      ...summaries.map((summary) => ({ ...summary, label: summary.topic || 'Uncategorized' })),
      ...extraSuggestions.map((topic) => ({ topic, label: topic, problems: [], dueProblemCount: 0 })),
    ].sort((a, b) => a.label.localeCompare(b.label))
  }, [summaries])
  const activeCategory = categories.find((category) => category.topic === selectedTopic) ?? null

  const saveLabels = (problemId: string, topic: string, pattern: string) => {
    const updated = data.problems.map((problem) =>
      problem.id === problemId ? { ...problem, topic, pattern } : problem,
    )
    const error = saveProblems(updated)
    if (error) {
      setSaveError(error)
      return
    }
    setData((current) => ({ ...current, problems: updated, problemError: null }))
    setSaveError(null)
    setEditingProblemId(null)
    setSelectedTopic(topic)
  }

  return (
    <main className="patterns-page">
      <section aria-labelledby="patterns-title" className="patterns-hero">
        <div className="patterns-hero-copy">
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> LEARNING CATEGORIES</span>
          <h1 id="patterns-title">Explore your <span>patterns.</span></h1>
          <p>Organize saved problems by topic, revisit their approaches, and start a recall session from any category.</p>
        </div>
        <div aria-hidden="true" className="patterns-hero-art">⌘</div>
      </section>

      <p className="patterns-disclaimer">
        Topics and patterns are learning categories, not claims that any topic has been mastered.
      </p>
      <p className="patterns-disclaimer patterns-due-note">
        Due counts include overdue and due-today problems based on each problem’s latest saved recall.
      </p>

      {data.problemError && (
        <div className="patterns-alert" role="alert">
          <strong>Problem library could not be loaded.</strong>
          <span>{data.problemError}</span>
        </div>
      )}
      {data.recallError && (
        <div className="patterns-alert" role="alert">
          <strong>Due-review counts are unavailable.</strong>
          <span>{data.recallError}</span>
        </div>
      )}
      {saveError && <div className="patterns-alert" role="alert">{saveError}</div>}

      <datalist id="topic-suggestions">
        {suggestedTopics.map((topic) => <option key={topic} value={topic} />)}
      </datalist>
      <datalist id="pattern-suggestions">
        {suggestedPatterns.map((pattern) => <option key={pattern} value={pattern} />)}
      </datalist>

      <section aria-label="Filter problems by topic" className="topic-explorer-layout">
        <div className="topic-list-panel">
          <div className="topic-list-heading">
            <div>
              <span className="section-kicker">BROWSE TOPICS</span>
              <h2>Topics</h2>
            </div>
            <span className="topic-count">{data.problems.length} saved</span>
          </div>
          <div className="topic-category-list">
            <button
              aria-pressed={selectedTopic === null}
              className={`topic-category-button${selectedTopic === null ? ' topic-category-button--active' : ''}`}
              onClick={() => setSelectedTopic(null)}
              type="button"
            >
              <span className="topic-category-name">All topics</span>
              <span className="topic-category-count">{data.problems.length}</span>
            </button>
            {categories.map((category) => (
              <button
                aria-pressed={selectedTopic === category.topic}
                className={`topic-category-button${selectedTopic === category.topic ? ' topic-category-button--active' : ''}`}
                key={category.topic || 'uncategorized'}
                onClick={() => setSelectedTopic(category.topic)}
                type="button"
              >
                <span className="topic-category-name">{category.label}</span>
                <span className="topic-category-meta">
                  <span>{category.problems.length} saved</span>
                  <span className="topic-due-count">
                    {data.recallError ? 'Due —' : `Due ${category.dueProblemCount}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <section aria-live="polite" aria-labelledby="topic-results-title" className="topic-results">
          <div className="topic-results-heading">
            <div>
              <span className="section-kicker">YOUR PROBLEM MAP</span>
              <h2 id="topic-results-title">{activeCategory?.label ?? 'All topics'}</h2>
            </div>
            {activeCategory && (
              <span className="topic-results-count">
                {activeCategory.problems.length} {activeCategory.problems.length === 1 ? 'problem' : 'problems'}
                {!data.recallError && ` · ${activeCategory.dueProblemCount} due`}
              </span>
            )}
          </div>
          {loading ? (
            <div aria-live="polite" className="patterns-empty-state">Loading your saved topics…</div>
          ) : data.problemError ? (
            <div className="patterns-empty-state">
              <h3>Topics are unavailable</h3>
              <p>Fix the problem library storage issue to browse your saved problems.</p>
            </div>
          ) : data.problems.length === 0 ? (
            <div className="patterns-empty-state">
              <h3>No saved problems yet</h3>
              <p>Add a problem in your library to build your topic map from your own data.</p>
              <button className="topic-action topic-action-primary" onClick={() => onOpenProblemLibrary()} type="button">
                Open problem library
              </button>
            </div>
          ) : activeCategory && activeCategory.problems.length === 0 ? (
            <div className="patterns-empty-state">
              <h3>No saved problems in {activeCategory.label} yet</h3>
              <p>This category is available to organize future problems. Assign it while editing a problem’s topic.</p>
              <button className="topic-action topic-action-quiet" onClick={() => setSelectedTopic(null)} type="button">
                Browse all topics
              </button>
            </div>
          ) : (
            <div className="topic-problem-list">
              {(activeCategory?.problems ?? data.problems).map((problem) => (
                <ProblemTopicCard
                  editing={editingProblemId === problem.id}
                  key={problem.id}
                  onCancelEdit={() => setEditingProblemId(null)}
                  onEdit={() => {
                    setEditingProblemId((current) => current === problem.id ? null : problem.id)
                    setSaveError(null)
                  }}
                  onOpen={() => onOpenProblem(problem.id)}
                  onRecall={() => onStartRecall(problem.id)}
                  onSaveLabels={(topic, pattern) => saveLabels(problem.id, topic, pattern)}
                  problem={problem}
                />
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="patterns-footer">
        <span>Recall.dev · Topics come from your saved problem library.</span>
        <span>Patterns &amp; topics</span>
      </footer>
    </main>
  )
}
