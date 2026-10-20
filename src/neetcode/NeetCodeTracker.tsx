import { useMemo, useState } from 'react'
import { dateForDisplay, loadProblems, saveProblems } from '../problems/problemStorage'
import type { Confidence, Problem } from '../problems/problemTypes'
import { loadRecallAttempts } from '../recall/recallStorage'
import { isValidLocalDate } from '../recall/scheduler'
import {
  confidenceValue,
  filterNeetCodeProblems,
  getNeetCodeCatalog,
  getNeetCodeId,
  getNeetCodeProgress,
  NEETCODE_STATUSES,
  syncNeetCodeProblems,
  validateNeetCodeCatalog,
} from './neetcodeUtils'
import type { NeetCodeCatalogEntry } from './neetcodeUtils'
import './NeetCodeTracker.css'

type ViewMode = 'list' | 'cards'
type SortMode = 'recommended' | 'title' | 'difficulty'

const catalog = getNeetCodeCatalog()
const catalogValidation = validateNeetCodeCatalog()

function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`
}

function saveDate(value: string): string | null {
  if (!value) return null
  return isValidLocalDate(value) ? value : null
}

function statusClass(status: string): string {
  return status.toLowerCase().replaceAll(' ', '-')
}

function recordForEntry(entry: NeetCodeCatalogEntry, records: Problem[]): Problem | undefined {
  const neetcodeId = getNeetCodeId(entry)
  return records.find((record) => record.neetcodeId === neetcodeId)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function NeetCodeTracker({ onStartRecall }: { onStartRecall: (problemId: string) => void }) {
  const [initialTracker] = useState(() => {
    if (!catalogValidation.valid) return { records: [] as Problem[], error: catalogValidation.errors.join(' ') }
    const loaded = loadProblems()
    if (loaded.error) return { records: [] as Problem[], error: loaded.error }
    const synced = syncNeetCodeProblems(loaded.problems)
    if (synced.error) return { records: loaded.problems, error: synced.error }
    if (JSON.stringify(synced.problems) !== JSON.stringify(loaded.problems)) {
      const error = saveProblems(synced.problems)
      return error
        ? { records: loaded.problems, error }
        : { records: synced.problems, error: null }
    }
    return { records: synced.problems, error: null }
  })
  const [records, setRecords] = useState<Problem[]>(initialTracker.records)
  const [storageError, setStorageError] = useState<string | null>(initialTracker.error)
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortMode>('recommended')
  const [view, setView] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const attemptResult = useMemo(() => loadRecallAttempts(), [])
  const attempts = attemptResult.attempts
  const progress = useMemo(() => getNeetCodeProgress(catalog, records), [records])
  const filtered = useMemo(() => filterNeetCodeProblems(
    catalog,
    records,
    { query, topic: topicFilter, difficulty: difficultyFilter, status: statusFilter, sort },
  ), [records, query, topicFilter, difficultyFilter, statusFilter, sort])
  const continueEntry = catalog.find((entry) => {
    const status = recordForEntry(entry, records)?.neetcodeStatus ?? 'Not Started'
    return status === 'Needs Revision'
  }) ?? catalog.find((entry) => {
    const status = recordForEntry(entry, records)?.neetcodeStatus ?? 'Not Started'
    return status !== 'Solved Independently' && status !== 'Solved With Help'
  })
  const latestAttemptByProblem = new Map<string, string>()
  for (const attempt of attempts) {
    const previous = latestAttemptByProblem.get(attempt.problemId)
    if (!previous || Date.parse(attempt.attemptedAt) > Date.parse(previous)) {
      latestAttemptByProblem.set(attempt.problemId, attempt.attemptedAt)
    }
  }
  const recentEntries = [...latestAttemptByProblem.entries()]
    .sort((first, second) => Date.parse(second[1]) - Date.parse(first[1]))
    .slice(0, 5)
    .map(([problemId, attemptedAt]) => ({
      record: records.find((problem) => problem.id === problemId),
      attemptedAt,
    }))
    .filter((item): item is { record: Problem; attemptedAt: string } => Boolean(item.record))

  const persistRecord = (updatedRecord: Problem) => {
    const next = records.map((record) => record.id === updatedRecord.id ? updatedRecord : record)
    const error = saveProblems(next)
    if (error) {
      setStorageError(error)
      setFeedback('')
      return false
    }
    setRecords(next)
    setStorageError(null)
    setFeedback(`${updatedRecord.title} saved.`)
    return true
  }

  const updateStatus = (entry: NeetCodeCatalogEntry, status: Problem['neetcodeStatus']) => {
    const record = recordForEntry(entry, records)
    if (!record || !status) return
    const today = localToday()
    const nextRecord: Problem = {
      ...record,
      neetcodeStatus: status,
      neetcodeFirstAttemptedAt: status === 'Not Started'
        ? record.neetcodeFirstAttemptedAt ?? null
        : record.neetcodeFirstAttemptedAt ?? today,
      neetcodeLastSolvedAt: status === 'Solved With Help' || status === 'Solved Independently'
        ? today
        : record.neetcodeLastSolvedAt ?? null,
    }
    persistRecord(nextRecord)
  }

  const updateField = (
    entry: NeetCodeCatalogEntry,
    key: 'pattern' | 'approach' | 'algorithm' | 'timeComplexity' | 'spaceComplexity' | 'javaNotes' | 'mistakes' | 'neetcodeEdgeCases' | 'neetcodeReflection' | 'neetcodeFirstAttemptedAt' | 'neetcodeLastSolvedAt' | 'neetcodeConfidence',
    value: string | Confidence | null,
  ) => {
    const record = recordForEntry(entry, records)
    if (!record) return
    if (key === 'neetcodeFirstAttemptedAt' || key === 'neetcodeLastSolvedAt') {
      const date = saveDate(String(value))
      if (value && !date) {
        setStorageError('Enter a valid calendar date.')
        return
      }
      persistRecord({ ...record, [key]: date })
      return
    }
    if (key === 'neetcodeConfidence') {
      const confidence = value === null ? null : confidenceValue(String(value))
      if (value !== null && confidence === null) {
        setStorageError('Confidence must be a rating from 1 to 5.')
        return
      }
      persistRecord({ ...record, neetcodeConfidence: confidence })
      return
    }
    persistRecord({ ...record, [key]: value as string })
  }

  const startRecall = (entry: NeetCodeCatalogEntry) => {
    const record = recordForEntry(entry, records)
    if (record) onStartRecall(record.id)
  }

  const refreshCatalog = () => {
    const loaded = loadProblems()
    if (loaded.error) {
      setStorageError(loaded.error)
      return
    }
    const synced = syncNeetCodeProblems(loaded.problems)
    if (synced.error) {
      setStorageError(synced.error)
      return
    }
    const error = JSON.stringify(synced.problems) !== JSON.stringify(loaded.problems)
      ? saveProblems(synced.problems)
      : null
    if (error) {
      setStorageError(error)
      return
    }
    setRecords(synced.problems)
    setStorageError(null)
    setFeedback(`${synced.added} catalog records added; ${synced.linked} existing problem records linked. Saved notes and statuses were preserved.`)
  }

  const clearFilters = () => {
    setQuery('')
    setTopicFilter('')
    setDifficultyFilter('')
    setStatusFilter('')
    setSort('recommended')
  }

  const renderCard = (entry: NeetCodeCatalogEntry, index: number) => {
    const record = recordForEntry(entry, records)
    if (!record) return null
    const status = record.neetcodeStatus ?? 'Not Started'
    const lastAttempt = latestAttemptByProblem.get(record.id)
    return (
      <article className={`nc-problem-card${editingId === record.id ? ' nc-problem-card-editing' : ''}`} key={record.id}>
        <div className="nc-card-top"><span className="nc-order">{`${index + 1}`.padStart(3, '0')}</span><span className={`difficulty-pill difficulty-${entry.difficulty.toLowerCase()}`}>{entry.difficulty}</span><span className={`nc-status-badge nc-status-${statusClass(status)}`}>{status}</span></div>
        <h3>{entry.title}</h3>
        <span className="nc-card-topic">{entry.topic}</span>
        {lastAttempt && <span className="nc-card-last-attempt">Last practised {formatDateTime(lastAttempt)}</span>}
        <div className="nc-card-actions">
          <a className="nc-action-button nc-action-link" href={entry.url} rel="noopener noreferrer" target="_blank">Original problem</a>
          <button className="nc-action-button" onClick={() => startRecall(entry)} type="button">Start recall</button>
          <button className="nc-action-button" onClick={() => startRecall(entry)} type="button">Schedule / review</button>
          <button className="nc-action-button nc-action-quiet" onClick={() => setEditingId(editingId === record.id ? null : record.id)} type="button">{editingId === record.id ? 'Close notes' : 'Java notes'}</button>
        </div>
        <div className="nc-status-controls">
          <label><span>Tracking status</span><select onChange={(event) => updateStatus(entry, event.target.value as Problem['neetcodeStatus'])} value={status}>{NEETCODE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div><button className="nc-small-action" onClick={() => updateStatus(entry, 'Attempted')} type="button">Mark attempted</button><button className="nc-small-action" onClick={() => updateStatus(entry, 'Solved Independently')} type="button">Mark solved</button></div>
        </div>
        {editingId === record.id && <NotesEditor entry={entry} record={record} onSave={updateField} />}
      </article>
    )
  }

  if (!catalogValidation.valid) {
    return <main className="neetcode-page"><CatalogError errors={catalogValidation.errors} count={catalogValidation.count} /></main>
  }

  if (storageError && !records.some((record) => record.neetcodeId)) {
    return <main className="neetcode-page"><CatalogError count={catalog.length} errors={[storageError]}><button className="nc-button nc-button-secondary" onClick={refreshCatalog} type="button">Retry tracker storage</button></CatalogError></main>
  }

  return (
    <main className="neetcode-page">
      <header className="nc-hero">
        <div><span className="nc-eyebrow">AMAZON SDE-1 · JAVA PREPARATION</span><h1>NeetCode <span>150</span></h1><p>A structured path from first attempt to confident recall. Track your own progress; every note is saved with the problem you already use elsewhere.</p></div>
        <div className="nc-hero-progress"><strong>{progress.completed}<span> / {progress.total}</span></strong><span>problems solved</span><div className="nc-progress-track" role="progressbar" aria-label="NeetCode 150 completed problems" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><span style={{ width: `${(progress.completed / progress.total) * 100}%` }} /></div><small>{progress.notAttempted} not started · {progress.needsRevision} need revision</small></div>
      </header>

      {storageError && <div className="nc-alert" role="alert">{storageError}</div>}
      {feedback && <p aria-live="polite" className="nc-feedback">{feedback}</p>}

      {continueEntry ? (
        <section aria-labelledby="nc-continue-title" className="nc-continue-panel">
          <div><span className="nc-eyebrow">YOUR NEXT STEP</span><h2 id="nc-continue-title">Continue learning</h2><p>{continueEntry.title} <span>· {continueEntry.topic} · {continueEntry.difficulty}</span></p></div>
          <button className="nc-button nc-button-primary" onClick={() => startRecall(continueEntry)} type="button">Start recall</button>
        </section>
      ) : (
        <section className="nc-continue-panel nc-path-complete"><div><span className="nc-eyebrow">ALL PROBLEMS COMPLETED</span><h2>Review your saved attempts</h2><p>Every catalog problem is marked solved. Continue using the review dates from your shared recall history.</p></div></section>
      )}

      {attemptResult.error && <div className="nc-alert" role="alert">{attemptResult.error} Recent-practice indicators are unavailable until recall history can be loaded.</div>}

      {recentEntries.length > 0 && (
        <section aria-labelledby="nc-recent-title" className="nc-recent-section">
          <div className="nc-section-heading"><div><span className="nc-eyebrow">FROM YOUR RECALL HISTORY</span><h2 id="nc-recent-title">Recently practised</h2></div><span>Latest {recentEntries.length} problems</span></div>
          <div className="nc-recent-list">{recentEntries.map(({ record, attemptedAt }) => (
            <article key={record.id}><div><strong>{record.title}</strong><span>{formatDateTime(attemptedAt)}</span></div><button className="nc-small-action" onClick={() => onStartRecall(record.id)} type="button">Practice again</button></article>
          ))}</div>
        </section>
      )}

      <section aria-label="NeetCode progress by difficulty" className="nc-difficulty-progress">
        {progress.byDifficulty.map((item) => <article key={item.difficulty}><span className={`difficulty-pill difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span><strong>{item.completed}<small> / {item.total}</small></strong><span>solved</span></article>)}
      </section>

      <section aria-labelledby="nc-topics-title" className="nc-topics-section">
        <div className="nc-section-heading"><div><span className="nc-eyebrow">ROADMAP BREAKDOWN</span><h2 id="nc-topics-title">Progress by topic</h2></div><span>{progress.byTopic.length} verified categories</span></div>
        <div className="nc-topic-grid">{progress.byTopic.map((item) => <button className={`nc-topic-chip${topicFilter === item.topic ? ' is-selected' : ''}`} key={item.topic} onClick={() => setTopicFilter(topicFilter === item.topic ? '' : item.topic)} type="button"><span>{item.topic}</span><strong>{item.completed}/{item.total}</strong><span className="nc-topic-bar"><i style={{ width: `${item.total ? (item.completed / item.total) * 100 : 0}%` }} /></span></button>)}</div>
      </section>

      <section aria-labelledby="nc-problems-title" className="nc-catalog-section">
        <div className="nc-section-heading"><div><span className="nc-eyebrow">ORDERED ROADMAP</span><h2 id="nc-problems-title">Problem tracker</h2></div><span>{filtered.length} of {catalog.length} problems</span></div>
        <div className="nc-filters">
          <label className="nc-search"><span>Search title</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Find a problem…" type="search" value={query} /></label>
          <label><span>Topic</span><select onChange={(event) => setTopicFilter(event.target.value)} value={topicFilter}><option value="">All topics</option>{progress.byTopic.map((item) => <option key={item.topic}>{item.topic}</option>)}</select></label>
          <label><span>Difficulty</span><select onChange={(event) => setDifficultyFilter(event.target.value)} value={difficultyFilter}><option value="">All difficulties</option>{['Easy', 'Medium', 'Hard'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Completion</span><select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="">All statuses</option>{NEETCODE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Sort</span><select onChange={(event) => setSort(event.target.value as SortMode)} value={sort}><option value="recommended">Recommended order</option><option value="title">Title</option><option value="difficulty">Difficulty</option></select></label>
        </div>
        <div className="nc-catalog-toolbar"><span>Problems are linked to the same records used by My Problems and Recall Practice.</span><div><button aria-pressed={view === 'list'} className={`nc-view-toggle${view === 'list' ? ' is-selected' : ''}`} onClick={() => setView('list')} type="button">List</button><button aria-pressed={view === 'cards'} className={`nc-view-toggle${view === 'cards' ? ' is-selected' : ''}`} onClick={() => setView('cards')} type="button">Cards</button></div></div>
        {filtered.length ? (
          view === 'cards' ? (
            <div className="nc-card-grid">{filtered.map((entry) => renderCard(entry, catalog.indexOf(entry)))}</div>
          ) : (
            <div className="nc-list">
              {filtered.map((entry) => {
                const record = recordForEntry(entry, records)
                if (!record) return null
                const status = record.neetcodeStatus ?? 'Not Started'
                const index = catalog.indexOf(entry)
                return (
                  <article className={`nc-list-row${editingId === record.id ? ' nc-list-row-editing' : ''}`} key={record.id}>
                    <span className="nc-order">{`${index + 1}`.padStart(3, '0')}</span>
                    <div className="nc-list-title"><strong>{entry.title}</strong><span>{entry.topic}</span></div>
                    <span className={`difficulty-pill difficulty-${entry.difficulty.toLowerCase()}`}>{entry.difficulty}</span>
                    <label className={`nc-status-control nc-status-${statusClass(status)}`}><span className="sr-only">Status for {entry.title}</span><select onChange={(event) => updateStatus(entry, event.target.value as Problem['neetcodeStatus'])} value={status}>{NEETCODE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <div className="nc-row-actions"><a aria-label={`Open original problem: ${entry.title}`} href={entry.url} rel="noopener noreferrer" target="_blank">Original</a><a aria-label={`Open NeetCode: ${entry.title}`} href={entry.neetcodeUrl} rel="noopener noreferrer" target="_blank">NeetCode</a><button aria-label={`Start recall: ${entry.title}`} onClick={() => startRecall(entry)} type="button">Recall</button><button aria-label={`Schedule or review ${entry.title}`} onClick={() => startRecall(entry)} type="button">Schedule / review</button><button aria-label={`Edit Java notes: ${entry.title}`} onClick={() => setEditingId(editingId === record.id ? null : record.id)} type="button">Notes</button></div>
                    {editingId === record.id && <div className="nc-inline-editor"><NotesEditor entry={entry} record={record} onSave={updateField} /><div className="nc-quick-status"><button onClick={() => updateStatus(entry, 'Attempted')} type="button">Mark attempted</button><button onClick={() => updateStatus(entry, 'Solved Independently')} type="button">Mark solved</button></div></div>}
                  </article>
                )
              })}
            </div>
          )
        ) : (
          <div className="nc-empty"><h3>No problems match your filters</h3><p>Try another search, status, difficulty, or topic.</p><button className="nc-button nc-button-secondary" onClick={clearFilters} type="button">Clear filters</button></div>
        )}
        <p className="nc-catalog-sources">Catalog validation: {catalog.length} unique titles across {progress.byTopic.length} categories. Sources: <a href="https://neetcode.io/roadmap/" rel="noopener noreferrer" target="_blank">NeetCode roadmap</a> · <a href="https://github.com/krmanik/Anki-NeetCode/blob/main/neetcode-150-list.json" rel="noopener noreferrer" target="_blank">Public metadata list</a>. Each row links to both original platforms.</p>
      </section>
    </main>
  )
}

function NotesEditor({
  entry,
  record,
  onSave,
}: {
  entry: NeetCodeCatalogEntry
  record: Problem
  onSave: (
    entry: NeetCodeCatalogEntry,
    key: 'pattern' | 'approach' | 'algorithm' | 'timeComplexity' | 'spaceComplexity' | 'javaNotes' | 'mistakes' | 'neetcodeEdgeCases' | 'neetcodeReflection' | 'neetcodeFirstAttemptedAt' | 'neetcodeLastSolvedAt' | 'neetcodeConfidence',
    value: string | Confidence | null,
  ) => void
}) {
  const textFields: Array<{ key: 'pattern' | 'approach' | 'algorithm' | 'timeComplexity' | 'spaceComplexity' | 'javaNotes' | 'mistakes' | 'neetcodeEdgeCases' | 'neetcodeReflection'; label: string; rows: number }> = [
    { key: 'pattern', label: 'Key pattern', rows: 2 },
    { key: 'approach', label: 'Approach', rows: 3 },
    { key: 'algorithm', label: 'Algorithm', rows: 4 },
    { key: 'timeComplexity', label: 'Time complexity', rows: 2 },
    { key: 'spaceComplexity', label: 'Space complexity', rows: 2 },
    { key: 'javaNotes', label: 'Java solution notes or personal code', rows: 6 },
    { key: 'mistakes', label: 'Mistakes to avoid', rows: 3 },
    { key: 'neetcodeEdgeCases', label: 'Edge cases', rows: 3 },
    { key: 'neetcodeReflection', label: 'Optional reflection', rows: 3 },
  ]
  const firstAttempt = record.neetcodeFirstAttemptedAt ?? ''
  const lastSolved = record.neetcodeLastSolvedAt ?? ''

  return (
    <div className="nc-notes-editor">
      <div className="nc-notes-heading"><div><strong>Personal notes · Java interview prep</strong><span>{entry.title} · shared problem record</span></div><label><span>Confidence</span><select onChange={(event) => onSave(entry, 'neetcodeConfidence', confidenceValue(event.target.value))} value={record.neetcodeConfidence ?? ''}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label></div>
      <div className="nc-note-dates">
        <label><span>Date first attempted</span><input onChange={(event) => onSave(entry, 'neetcodeFirstAttemptedAt', event.target.value)} type="date" value={firstAttempt} /></label>
        <label><span>Date last solved</span><input onChange={(event) => onSave(entry, 'neetcodeLastSolvedAt', event.target.value)} type="date" value={lastSolved} /></label>
        {record.lastReviewedAt && <span>Last reviewed by shared library: <strong>{dateForDisplay(record.lastReviewedAt)}</strong></span>}
      </div>
      <div className="nc-notes-grid">{textFields.map((field) => <label className={field.key === 'javaNotes' || field.key === 'approach' || field.key === 'algorithm' ? 'nc-note-wide' : ''} key={field.key}><span>{field.label}</span><textarea onChange={(event) => onSave(entry, field.key, event.target.value)} placeholder={`Add your own ${field.label.toLowerCase()}…`} rows={field.rows} value={record[field.key] as string ?? ''} /></label>)}</div>
    </div>
  )
}

function CatalogError({ errors, count, children }: { errors: string[]; count: number; children?: React.ReactNode }) {
  return (
    <section className="nc-catalog-error" role="alert"><span className="nc-eyebrow">CATALOG VALIDATION</span><h1>NeetCode 150 is not ready</h1><p>The tracker needs exactly 150 unique, verified entries before it can be used. Current entry count: {count}.</p><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>{children}</section>
  )
}
