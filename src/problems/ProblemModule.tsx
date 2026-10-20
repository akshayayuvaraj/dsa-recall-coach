import { useMemo, useRef, useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { dateForDisplay, loadProblems, saveProblems } from './problemStorage'
import type { Confidence, Difficulty, Problem, ProblemDraft } from './problemTypes'
import './ProblemModule.css'

type SortMode = 'recent' | 'title' | 'difficulty' | 'confidence'
type FilterValue = 'all' | string

const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard']
const difficultyOrder: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 }
const today = () => {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const emptyDraft = (): ProblemDraft => ({
  title: '',
  url: '',
  difficulty: 'Easy',
  topic: '',
  pattern: '',
  statement: '',
  approach: '',
  algorithm: '',
  javaNotes: '',
  timeComplexity: '',
  spaceComplexity: '',
  mistakes: '',
  hints: '',
  confidence: null,
  lastReviewedAt: '',
})

function draftFromProblem(problem: Problem): ProblemDraft {
  return {
    title: problem.title,
    url: problem.url,
    difficulty: problem.difficulty,
    topic: problem.topic,
    pattern: problem.pattern,
    statement: problem.statement,
    approach: problem.approach,
    algorithm: problem.algorithm,
    javaNotes: problem.javaNotes,
    timeComplexity: problem.timeComplexity,
    spaceComplexity: problem.spaceComplexity,
    mistakes: problem.mistakes,
    hints: problem.hints,
    confidence: problem.confidence,
    lastReviewedAt: problem.lastReviewedAt ?? '',
  }
}

function newId() {
  return window.crypto.randomUUID()
}

function Modal({
  children,
  label,
  onClose,
  className = '',
}: {
  children: ReactNode
  label: string
  onClose: () => void
  className?: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      aria-label={label}
      className={`problem-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault()
        dialogRef.current?.close()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close()
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      {children}
    </dialog>
  )
}

function ProblemForm({
  problem,
  onClose,
  onSave,
}: {
  problem: Problem | null
  onClose: () => void
  onSave: (draft: ProblemDraft) => void
}) {
  const [draft, setDraft] = useState<ProblemDraft>(
    problem ? draftFromProblem(problem) : emptyDraft(),
  )
  const [validationError, setValidationError] = useState('')

  const update = <K extends keyof ProblemDraft>(key: K, value: ProblemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedUrl = draft.url.trim()
    let parsedUrl: URL

    try {
      parsedUrl = new URL(normalizedUrl)
    } catch {
      setValidationError('Enter a valid problem URL beginning with https:// or http://.')
      return
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      setValidationError('Problem URLs must use http:// or https://.')
      return
    }

    if (!draft.title.trim() || !draft.topic.trim() || (!problem?.neetcodeId && !draft.pattern.trim()) || !draft.statement.trim()) {
      setValidationError(problem?.neetcodeId
        ? 'Add a title, topic, and problem statement before saving.'
        : 'Add a title, topic, pattern, and problem statement before saving.')
      return
    }

    setValidationError('')
    onSave({ ...draft, title: draft.title.trim(), url: normalizedUrl, topic: draft.topic.trim(), pattern: draft.pattern.trim() })
  }

  return (
    <Modal
      className="problem-form-dialog"
      label={problem ? `Edit ${problem.title}` : 'Add a problem'}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <div>
          <span className="module-eyebrow">PROBLEM LIBRARY</span>
          <h2>{problem ? 'Edit problem' : 'Add a problem'}</h2>
          <p>Capture the reasoning you want to remember later.</p>
        </div>
        <button aria-label="Close form" className="dialog-close" onClick={onClose} type="button">×</button>
      </div>
      <form className="problem-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field form-field-wide">
            <span>Problem title <span className="required-mark">*</span></span>
            <input autoFocus maxLength={120} onChange={(event) => update('title', event.target.value)} required value={draft.title} />
          </label>
          <label className="form-field form-field-wide">
            <span>Problem URL <span className="required-mark">*</span></span>
            <input maxLength={2048} onChange={(event) => update('url', event.target.value)} placeholder="https://..." required type="url" value={draft.url} />
          </label>
          <label className="form-field">
            <span>Difficulty <span className="required-mark">*</span></span>
            <select onChange={(event) => update('difficulty', event.target.value as Difficulty)} value={draft.difficulty}>
              {difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Confidence</span>
            <select
              onChange={(event) => update('confidence', event.target.value ? Number(event.target.value) as Confidence : null)}
              value={draft.confidence ?? ''}
            >
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Topic <span className="required-mark">*</span></span>
            <input maxLength={80} onChange={(event) => update('topic', event.target.value)} required value={draft.topic} />
          </label>
          <label className="form-field">
            <span>Problem-solving pattern {!problem?.neetcodeId && <span className="required-mark">*</span>}</span>
            <input maxLength={80} onChange={(event) => update('pattern', event.target.value)} required={!problem?.neetcodeId} value={draft.pattern} />
          </label>
          <label className="form-field form-field-wide">
            <span>Problem statement <span className="required-mark">*</span></span>
            <textarea onChange={(event) => update('statement', event.target.value)} required rows={3} value={draft.statement} />
          </label>
          <label className="form-field form-field-wide">
            <span>Approach</span>
            <textarea onChange={(event) => update('approach', event.target.value)} rows={3} value={draft.approach} />
          </label>
          <label className="form-field form-field-wide">
            <span>Step-by-step algorithm</span>
            <textarea onChange={(event) => update('algorithm', event.target.value)} placeholder={'One step per line'} rows={4} value={draft.algorithm} />
          </label>
          <label className="form-field form-field-wide">
            <span>Java solution notes or code</span>
            <textarea className="code-input" onChange={(event) => update('javaNotes', event.target.value)} rows={5} value={draft.javaNotes} />
          </label>
          <label className="form-field">
            <span>Time complexity</span>
            <input maxLength={100} onChange={(event) => update('timeComplexity', event.target.value)} placeholder="e.g. O(n)" value={draft.timeComplexity} />
          </label>
          <label className="form-field">
            <span>Space complexity</span>
            <input maxLength={100} onChange={(event) => update('spaceComplexity', event.target.value)} placeholder="e.g. O(1)" value={draft.spaceComplexity} />
          </label>
          <label className="form-field form-field-wide">
            <span>Common mistakes</span>
            <textarea onChange={(event) => update('mistakes', event.target.value)} rows={3} value={draft.mistakes} />
          </label>
          <label className="form-field form-field-wide">
            <span>Hints</span>
            <textarea onChange={(event) => update('hints', event.target.value)} rows={3} value={draft.hints} />
          </label>
          <label className="form-field">
            <span>Last review date</span>
            <input onChange={(event) => update('lastReviewedAt', event.target.value)} type="date" value={draft.lastReviewedAt} />
          </label>
        </div>
        {validationError && <p className="form-error" role="alert">{validationError}</p>}
        <div className="form-footer">
          <span><span className="required-mark">*</span> Required fields</span>
          <div>
            <button className="button button-quiet" onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" type="submit">{problem ? 'Save changes' : 'Add problem'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function ProblemDetails({
  problem,
  onClose,
  onEdit,
  onDelete,
  onReview,
}: {
  problem: Problem
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onReview: () => void
}) {
  return (
    <Modal className="problem-details-dialog" label={`${problem.title} details`} onClose={onClose}>
      <div className="details-heading">
        <div>
          <span className="module-eyebrow">PROBLEM DETAILS</span>
          <h2>{problem.title} {problem.isExample && <span className="example-badge">Editable example</span>} {problem.neetcodeId && <span className="example-badge">NeetCode 150</span>}</h2>
          <div className="problem-taxonomy">
            <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
            <span>{problem.neetcodeTopic ?? problem.topic}</span><span className="taxonomy-dot">·</span><span>{problem.pattern || 'Pattern not recorded'}</span>
          </div>
        </div>
        <button aria-label="Close details" className="dialog-close" onClick={onClose} type="button">×</button>
      </div>
      <div className="details-scroll">
        <a className="problem-external-link" href={problem.url} rel="noreferrer" target="_blank">{problem.url}<span aria-hidden="true">↗</span></a>
        <div className="problem-dates">
          <span>Created <strong>{dateForDisplay(problem.createdAt)}</strong></span>
          <span>Last reviewed <strong>{dateForDisplay(problem.lastReviewedAt)}</strong></span>
          <span>Confidence <strong>{problem.confidence ? `${problem.confidence} / 5` : 'Not rated'}</strong></span>
        </div>
        <DetailSection label="Problem statement" content={problem.statement} />
        <DetailSection label="Approach" content={problem.approach} />
        <DetailSection label="Step-by-step algorithm" content={problem.algorithm} ordered />
        <div className="complexity-grid">
          <DetailSection label="Time complexity" content={problem.timeComplexity} />
          <DetailSection label="Space complexity" content={problem.spaceComplexity} />
        </div>
        <DetailSection label="Java solution notes or code" content={problem.javaNotes} code />
        <DetailSection label="Common mistakes" content={problem.mistakes} />
        <DetailSection label="Hints" content={problem.hints} />
      </div>
      <div className="details-footer">
        {problem.neetcodeId
          ? <span className="collection-note">Catalog entries are kept to protect tracker progress.</span>
          : <button className="button button-danger-quiet" onClick={onDelete} type="button">Delete</button>}
        <div>
          <button className="button button-quiet" onClick={onReview} type="button">Mark reviewed today</button>
          <button className="button button-primary" onClick={onEdit} type="button">Edit problem</button>
        </div>
      </div>
    </Modal>
  )
}

function DetailSection({ label, content, ordered = false, code = false }: {
  label: string
  content: string
  ordered?: boolean
  code?: boolean
}) {
  if (!content.trim()) return null
  const lines = content.split('\n').map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
  return (
    <section className="detail-section">
      <h3>{label}</h3>
      {ordered ? (
        <ol className="algorithm-list">{lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol>
      ) : (
        <p className={code ? 'detail-code' : ''}>{content}</p>
      )}
    </section>
  )
}

function DeleteConfirmation({
  problem,
  onCancel,
  onConfirm,
}: {
  problem: Problem
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal className="delete-dialog" label="Confirm problem deletion" onClose={onCancel}>
      <div className="delete-icon">!</div>
      <h2>Delete this problem?</h2>
      <p><strong>{problem.title}</strong> will be permanently removed from this browser’s saved problem library.</p>
      <div className="delete-actions">
        <button className="button button-quiet" onClick={onCancel} type="button">Keep problem</button>
        <button className="button button-danger" onClick={onConfirm} type="button">Delete problem</button>
      </div>
    </Modal>
  )
}

function ProblemCard({
  problem,
  onOpen,
  onEdit,
  onDelete,
}: {
  problem: Problem
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article className="problem-card">
      <div className="problem-card-main">
        <div className="problem-title-row">
          <button className="problem-title-button" onClick={onOpen} type="button">{problem.title}</button>
          {problem.isExample && <span className="example-badge">Editable example</span>}
          {problem.neetcodeId && <span className="example-badge">NeetCode 150</span>}
        </div>
        <div className="problem-taxonomy">
          <span className={`difficulty-pill difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
          <span>{problem.topic}</span><span className="taxonomy-dot">·</span><span>{problem.pattern}</span>
        </div>
        <div className="problem-card-meta">
          <span>Created {dateForDisplay(problem.createdAt)}</span>
          <span>Reviewed {dateForDisplay(problem.lastReviewedAt)}</span>
          <span>Confidence {problem.confidence ? `${problem.confidence}/5` : '—'}</span>
        </div>
      </div>
      <div className="problem-card-actions">
        <button aria-label={`View ${problem.title}`} className="small-action" onClick={onOpen} type="button">View</button>
        <button aria-label={`Edit ${problem.title}`} className="small-action" onClick={onEdit} type="button">Edit</button>
        {!problem.neetcodeId && <button aria-label={`Delete ${problem.title}`} className="small-action small-action-danger" onClick={onDelete} type="button">Delete</button>}
      </div>
    </article>
  )
}

export default function ProblemModule({ initialProblemId = null }: { initialProblemId?: string | null }) {
  const [loaded, setLoaded] = useState(() => loadProblems())
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<FilterValue>('all')
  const [topic, setTopic] = useState<FilterValue>('all')
  const [pattern, setPattern] = useState<FilterValue>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const [editing, setEditing] = useState<Problem | null | false>(false)
  const [selected, setSelected] = useState<Problem | null>(() =>
    loaded.problems.find((problem) => problem.id === initialProblemId) ?? null,
  )
  const [deleting, setDeleting] = useState<Problem | null>(null)
  const [deletingFromDetails, setDeletingFromDetails] = useState(false)

  const persist = (next: Problem[]) => {
    const error = saveProblems(next)
    if (error) {
      setLoaded((current) => ({ ...current, error }))
      return false
    }
    setLoaded({ problems: next, error: null })
    return true
  }

  const topics = useMemo(
    () => [...new Set(loaded.problems.map((problem) => problem.topic))].sort((a, b) => a.localeCompare(b)),
    [loaded.problems],
  )
  const patterns = useMemo(
    () => [...new Set(loaded.problems.map((problem) => problem.pattern))].sort((a, b) => a.localeCompare(b)),
    [loaded.problems],
  )

  const visibleProblems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return loaded.problems
      .filter((problem) => difficulty === 'all' || problem.difficulty === difficulty)
      .filter((problem) => topic === 'all' || problem.topic === topic)
      .filter((problem) => pattern === 'all' || problem.pattern === pattern)
      .filter((problem) => {
        if (!normalizedSearch) return true
        return [problem.title, problem.topic, problem.pattern, problem.statement]
          .some((value) => value.toLowerCase().includes(normalizedSearch))
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'difficulty') return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty] || a.title.localeCompare(b.title)
        if (sort === 'confidence') return (b.confidence ?? 0) - (a.confidence ?? 0) || a.title.localeCompare(b.title)
        return (b.lastReviewedAt ?? b.createdAt).localeCompare(a.lastReviewedAt ?? a.createdAt) || a.title.localeCompare(b.title)
      })
  }, [loaded.problems, search, difficulty, topic, pattern, sort])

  const resetFilters = () => {
    setSearch('')
    setDifficulty('all')
    setTopic('all')
    setPattern('all')
    setSort('recent')
  }

  const saveDraft = (draft: ProblemDraft) => {
    const problems = loaded.problems
    if (editing) {
      const updated = problems.map((problem) =>
        problem.id === editing.id
          ? { ...problem, ...draft, lastReviewedAt: draft.lastReviewedAt || null }
          : problem,
      )
      if (persist(updated)) {
        setSelected(updated.find((problem) => problem.id === editing.id) ?? null)
        setEditing(false)
      }
      return
    }

    const created: Problem = {
      ...draft,
      id: newId(),
      createdAt: today(),
      lastReviewedAt: draft.lastReviewedAt || null,
      isExample: false,
    }
    if (persist([created, ...problems])) setEditing(false)
  }

  const confirmDelete = () => {
    if (!deleting) return
    if (persist(loaded.problems.filter((problem) => problem.id !== deleting.id))) {
      setSelected((current) => current?.id === deleting.id ? null : current)
      setDeleting(null)
      setDeletingFromDetails(false)
    }
  }

  const cancelDelete = () => {
    if (deletingFromDetails) setSelected(deleting)
    setDeleting(null)
    setDeletingFromDetails(false)
  }

  const markReviewed = (problem: Problem) => {
    const updated = loaded.problems.map((item) =>
      item.id === problem.id ? { ...item, lastReviewedAt: today() } : item,
    )
    if (persist(updated)) setSelected(updated.find((item) => item.id === problem.id) ?? null)
  }

  const retryLoad = () => setLoaded(loadProblems())
  const activeFilters = search.trim() !== '' || difficulty !== 'all' || topic !== 'all' || pattern !== 'all'

  return (
    <main className="problems-page">
      <section className="problems-hero">
        <div className="problems-hero-copy">
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> YOUR PROBLEM LIBRARY</span>
          <h1>Make every solution <span>count.</span></h1>
          <p>Keep the approach, the pattern, and the little details that make it stick.</p>
        </div>
        <button className="button button-primary add-problem-button" onClick={() => setEditing(null)} type="button">
          <span aria-hidden="true">+</span> Add problem
        </button>
      </section>

      <div className="problems-section-heading">
        <div>
          <span className="section-kicker">YOUR COLLECTION</span>
          <h2>My problems <span className="collection-count">{loaded.problems.length}</span></h2>
        </div>
        <span className="collection-note">Saved in this browser</span>
      </div>

      {loaded.error && (
        <div className="storage-alert" role="alert">
          <div><strong>Storage needs attention</strong><span>{loaded.error}</span></div>
          <button className="button button-quiet" onClick={retryLoad} type="button">Retry loading</button>
        </div>
      )}

      <section aria-label="Search, filter, and sort problems" className="problem-controls">
        <label className="problem-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search problems</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Search title, topic, or statement..." type="search" value={search} />
        </label>
        <label className="filter-control">
          <span className="sr-only">Filter by difficulty</span>
          <select onChange={(event) => setDifficulty(event.target.value)} value={difficulty}>
            <option value="all">All difficulties</option>
            {difficulties.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-control">
          <span className="sr-only">Filter by topic</span>
          <select onChange={(event) => setTopic(event.target.value)} value={topic}>
            <option value="all">All topics</option>
            {topics.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-control">
          <span className="sr-only">Filter by pattern</span>
          <select onChange={(event) => setPattern(event.target.value)} value={pattern}>
            <option value="all">All patterns</option>
            {patterns.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="filter-control sort-control">
          <span className="sr-only">Sort problems</span>
          <select onChange={(event) => setSort(event.target.value as SortMode)} value={sort}>
            <option value="recent">Recently reviewed</option>
            <option value="title">Title A–Z</option>
            <option value="difficulty">Difficulty</option>
            <option value="confidence">Confidence</option>
          </select>
        </label>
      </section>

      <div className="problem-list-heading">
        <span>{visibleProblems.length} {visibleProblems.length === 1 ? 'problem' : 'problems'}</span>
        {activeFilters && <button className="text-button" onClick={resetFilters} type="button">Clear filters</button>}
      </div>

      {loaded.error ? (
        <div className="problem-empty-state">
          <span className="empty-state-mark">!</span>
          <h3>Your saved problems could not be opened</h3>
          <p>Retry loading to access the problem library. The current storage data has not been overwritten.</p>
          <button className="button button-quiet" onClick={retryLoad} type="button">Retry loading</button>
        </div>
      ) : visibleProblems.length > 0 ? (
        <div className="problem-list">
          {visibleProblems.map((problem) => (
            <ProblemCard
              key={problem.id}
              onDelete={() => {
                setDeletingFromDetails(false)
                setDeleting(problem)
              }}
              onEdit={() => {
                setSelected(null)
                setEditing(problem)
              }}
              onOpen={() => setSelected(problem)}
              problem={problem}
            />
          ))}
        </div>
      ) : (
        <div className="problem-empty-state">
          <span className="empty-state-mark">{loaded.problems.length ? '⌕' : '+'}</span>
          <h3>{loaded.problems.length ? 'No problems match these filters' : 'Start your problem library'}</h3>
          <p>
            {loaded.problems.length
              ? 'Try another search or clear the filters to see your saved problems.'
              : 'Add a problem to save its approach, algorithm, and what you want to remember.'}
          </p>
          {loaded.problems.length ? (
            <button className="button button-quiet" onClick={resetFilters} type="button">Clear filters</button>
          ) : (
            <button className="button button-primary" onClick={() => setEditing(null)} type="button">Add your first problem</button>
          )}
        </div>
      )}

      <footer className="problems-footer">
        <span>Recall.dev <span>·</span> Build recall that lasts.</span>
        <span>My problems</span>
      </footer>

      {editing !== false && (
        <ProblemForm
          key={editing?.id ?? 'new-problem'}
          onClose={() => setEditing(false)}
          onSave={saveDraft}
          problem={editing}
        />
      )}
      {selected && (
        <ProblemDetails
          onClose={() => setSelected(null)}
          onDelete={() => {
            setDeletingFromDetails(true)
            setDeleting(selected)
            setSelected(null)
          }}
          onEdit={() => {
            setEditing(selected)
            setSelected(null)
          }}
          onReview={() => markReviewed(selected)}
          problem={selected}
        />
      )}
      {deleting && (
        <DeleteConfirmation
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          problem={deleting}
        />
      )}
    </main>
  )
}
