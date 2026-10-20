import { useCallback, useEffect, useMemo, useState } from 'react'
import { dateForDisplay, loadProblems } from '../problems/problemStorage'
import type { Problem } from '../problems/problemTypes'
import { loadRecallAttempts, type RecallAttempt } from '../recall/recallStorage'
import { getLocalToday } from '../recall/scheduler'
import { buildAnalyticsSummary, RECALL_OUTCOMES, type CountByLabel } from './analyticsUtils'
import './AnalyticsDashboard.css'

interface LoadedAnalytics {
  problems: Problem[]
  attempts: RecallAttempt[]
  problemError: string | null
  attemptError: string | null
}

function loadAnalytics(): LoadedAnalytics {
  const problemResult = loadProblems()
  const attemptResult = loadRecallAttempts()
  return {
    problems: problemResult.problems,
    attempts: attemptResult.attempts,
    problemError: problemResult.error,
    attemptError: attemptResult.error,
  }
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function MetricCard({
  label,
  value,
  description,
  tone = '',
}: {
  label: string
  value: string | number
  description: string
  tone?: string
}) {
  return (
    <article className={`analytics-metric${tone ? ` analytics-metric--${tone}` : ''}`}>
      <span className="analytics-metric-label">{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  )
}

function BarRows({
  items,
  total,
  emptyMessage,
}: {
  items: CountByLabel[]
  total: number
  emptyMessage: string
}) {
  if (items.length === 0 || total === 0) {
    return <p className="analytics-empty-inline">{emptyMessage}</p>
  }

  return (
    <ul className="analytics-bar-list">
      {items.map(({ label, count }) => {
        const percentage = total === 0 ? 0 : (count / total) * 100
        return (
          <li className="analytics-bar-row" key={label}>
            <div className="analytics-bar-label">
              <span>{label}</span>
              <strong>{count}{` · ${Math.round(percentage)}%`}</strong>
            </div>
            <div
              aria-label={`${label}: ${count} of ${total}, ${Math.round(percentage)} percent`}
              aria-valuemax={total}
              aria-valuemin={0}
              aria-valuenow={count}
              className="analytics-bar-track"
              role="progressbar"
            >
              <span style={{ width: `${percentage}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function WeeklyBars({
  title,
  weeks,
  value,
  maxValue,
  describeValue,
  emptyMessage,
}: {
  title: string
  weeks: Array<{ weekStart: string; value: number; attempts?: number }>
  value: string
  maxValue: number
  describeValue: (value: number, attempts?: number) => string
  emptyMessage: string
}) {
  const hasData = weeks.some((week) => week.value > 0)

  return (
    <div aria-label={title} className={`analytics-weekly-chart${hasData ? '' : ' analytics-weekly-chart--empty'}`} role="group">
      {hasData ? (
        <div className="analytics-week-columns">
          {weeks.map((week) => {
            const height = maxValue > 0 ? Math.max((week.value / maxValue) * 100, week.value > 0 ? 6 : 0) : 0
            return (
              <div className="analytics-week-column" key={week.weekStart}>
                <span className="analytics-week-value">{describeValue(week.value, week.attempts)}</span>
                <div className="analytics-week-bar-track">
                  <span
                    aria-label={`${dateForDisplay(week.weekStart)}: ${describeValue(week.value, week.attempts)}`}
                    className="analytics-week-bar"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="analytics-week-label">{dateForDisplay(week.weekStart)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="analytics-empty-inline">{emptyMessage}</p>
      )}
      {hasData && <p className="analytics-chart-footnote">{value}</p>}
    </div>
  )
}

function CoverageList({ items, emptyMessage }: { items: CountByLabel[]; emptyMessage: string }) {
  if (items.length === 0) return <p className="analytics-empty-inline">{emptyMessage}</p>
  return (
    <ul className="analytics-coverage-list">
      {items.map(({ label, count }) => (
        <li key={label}>
          <span>{label}</span>
          <strong>{count} {count === 1 ? 'problem' : 'problems'}</strong>
        </li>
      ))}
    </ul>
  )
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<LoadedAnalytics>(() => loadAnalytics())
  const [today, setToday] = useState(() => getLocalToday())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    window.setTimeout(() => {
      setData(loadAnalytics())
      setToday(getLocalToday())
      setLoading(false)
    }, 80)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setData(loadAnalytics())
      setToday(getLocalToday())
      setLoading(false)
    }, 80)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [refresh])

  const summary = useMemo(
    () => buildAnalyticsSummary(data.problems, data.attempts, today),
    [data.attempts, data.problems, today],
  )
  const outcomeDistribution = useMemo(
    () => RECALL_OUTCOMES.map((label) => ({
      label,
      count: summary.outcomeDistribution.find((item) => item.label === label)?.count ?? 0,
    })),
    [summary.outcomeDistribution],
  )
  const maxReviewCount = Math.max(1, ...summary.reviewCompletion.map((week) => week.completed))
  const maxConfidence = 5
  const attemptLoadFailed = data.attemptError !== null
  const problemLoadFailed = data.problemError !== null

  return (
    <main className="analytics-page">
      <section aria-labelledby="analytics-title" className="analytics-hero">
        <div className="analytics-hero-copy">
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> YOUR SAVED ACTIVITY</span>
          <h1 id="analytics-title">Progress, <span>with context.</span></h1>
          <p>Counts and trends calculated from your saved problems and recall sessions. Nothing here is estimated or filled in.</p>
        </div>
        <button className="analytics-refresh" onClick={refresh} type="button">Refresh data</button>
      </section>

      {(problemLoadFailed || attemptLoadFailed) && (
        <div className="analytics-alert" role="alert">
          <strong>Some analytics could not be loaded.</strong>
          {problemLoadFailed && <span>{data.problemError}</span>}
          {attemptLoadFailed && <span>{data.attemptError}</span>}
        </div>
      )}

      {loading ? (
        <div aria-live="polite" className="analytics-loading">Loading saved analytics…</div>
      ) : (
        <>
          <section aria-label="Key activity metrics" className="analytics-metrics">
            <MetricCard
              description="Problems currently saved in your library."
              label="Saved problems"
              value={problemLoadFailed ? '—' : summary.totalProblems}
            />
            <MetricCard
              description="Recall sessions saved across your history."
              label="Recall attempts"
              value={attemptLoadFailed ? '—' : summary.totalAttempts}
            />
            <MetricCard
              description={summary.totalAttempts === 0
                ? 'Appears after your first saved recall attempt.'
                : `${summary.independentAttempts} independently solved of ${summary.totalAttempts} attempts.`}
              label="Independent solve rate"
              value={attemptLoadFailed ? '—' : formatPercent(summary.independentSolveRate)}
              tone="highlight"
            />
            <MetricCard
              description="Saved problems with a past-due next review date."
              label="Overdue reviews"
              value={attemptLoadFailed || problemLoadFailed ? '—' : summary.overdueReviews}
              tone="overdue"
            />
            <MetricCard
              description="Saved problems scheduled for review today."
              label="Due today"
              value={attemptLoadFailed || problemLoadFailed ? '—' : summary.dueTodayReviews}
              tone="today"
            />
            <MetricCard
              description="Saved problems with a future next review date."
              label="Upcoming reviews"
              value={attemptLoadFailed || problemLoadFailed ? '—' : summary.upcomingReviews}
            />
          </section>

          <section aria-label="Recall activity charts" className="analytics-chart-grid">
            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="section-kicker">SCHEDULED REVIEW FOLLOW-THROUGH</span>
                  <h2>Review completion over time</h2>
                </div>
              </div>
              <p className="analytics-panel-description">
                Counts a review when a saved recall attempt happens on or after that problem’s previous scheduled date. Grouped by local calendar week for the last eight weeks.
              </p>
              {attemptLoadFailed ? (
                <p className="analytics-empty-inline">Recall history is unavailable.</p>
              ) : (
                <WeeklyBars
                  describeValue={(count) => `${count} completed`}
                  maxValue={maxReviewCount}
                  title="Scheduled review completions by local week"
                  value="Each bar is a completed scheduled review."
                  weeks={summary.reviewCompletion.map((week) => ({
                    weekStart: week.weekStart,
                    value: week.completed,
                  }))}
                  emptyMessage="No scheduled reviews were completed in these weeks yet."
                />
              )}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="section-kicker">SAVED OUTCOMES</span>
                  <h2>Outcome distribution</h2>
                </div>
              </div>
              <p className="analytics-panel-description">
                Each count is a saved recall attempt; percentages use all saved attempts as the denominator.
              </p>
              {attemptLoadFailed ? (
                <p className="analytics-empty-inline">Recall history is unavailable.</p>
              ) : (
                <BarRows
                  emptyMessage="Save a recall attempt to see outcome counts."
                  items={outcomeDistribution}
                  total={summary.totalAttempts}
                />
              )}
            </article>

            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="section-kicker">SELF-REPORTED CONFIDENCE</span>
                  <h2>Confidence trends</h2>
                </div>
              </div>
              <p className="analytics-panel-description">
                Average confidence rating (1–5) from saved attempts in each local calendar week. It reflects your rating, not an assessment of mastery.
              </p>
              {attemptLoadFailed ? (
                <p className="analytics-empty-inline">Recall history is unavailable.</p>
              ) : (
                <WeeklyBars
                  describeValue={(average, attempts) => `${average.toFixed(1)} / 5 · ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`}
                  maxValue={maxConfidence}
                  title="Average self-reported confidence by local week"
                  value="Weekly average confidence, scale 1 to 5."
                  weeks={summary.confidenceTrend.map((week) => ({
                    weekStart: week.weekStart,
                    value: week.average,
                    attempts: week.attempts,
                  }))}
                  emptyMessage="Confidence trends will appear after recall attempts are saved."
                />
              )}
            </article>
          </section>

          <section aria-label="Saved problem coverage" className="analytics-coverage-grid">
            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="section-kicker">SAVED PROBLEM LIBRARY</span>
                  <h2>Topic coverage</h2>
                </div>
                <span className="analytics-panel-total">{problemLoadFailed ? '—' : `${summary.totalProblems} total`}</span>
              </div>
              <p className="analytics-panel-description">
                Number of saved problems assigned to each topic. Categories are labels, not mastery levels.
              </p>
              {problemLoadFailed ? (
                <p className="analytics-empty-inline">Problem library is unavailable.</p>
              ) : (
                <CoverageList emptyMessage="Add saved problems to see topic coverage." items={summary.topicCoverage} />
              )}
            </article>
            <article className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="section-kicker">SAVED PROBLEM LIBRARY</span>
                  <h2>Pattern coverage</h2>
                </div>
                <span className="analytics-panel-total">{problemLoadFailed ? '—' : `${summary.totalProblems} total`}</span>
              </div>
              <p className="analytics-panel-description">
                Number of saved problems assigned to each solving pattern. No percentages imply mastery.
              </p>
              {problemLoadFailed ? (
                <p className="analytics-empty-inline">Problem library is unavailable.</p>
              ) : (
                <CoverageList emptyMessage="Add saved problems to see pattern coverage." items={summary.patternCoverage} />
              )}
            </article>
          </section>
        </>
      )}

      <footer className="analytics-footer">
        <span>Recall.dev · Based only on data saved in this browser.</span>
        <span>Last refreshed {dateForDisplay(today)}</span>
      </footer>
    </main>
  )
}
