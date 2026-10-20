import { useEffect, useMemo, useState } from 'react'
import type { Problem } from '../problems/problemTypes'
import { dateForDisplay, loadProblems } from '../problems/problemStorage'
import { loadRecallAttempts, type RecallAttempt } from '../recall/recallStorage'
import {
  compareLocalDates,
  getLocalToday,
  isValidLocalDate,
} from '../recall/scheduler'
import {
  getMonthGrid,
  getWeekDays,
  localDateKey,
  monthLabel,
  sameLocalMonth,
  shiftMonth,
  shiftWeek,
  startOfMonth,
  weekLabel,
} from './calendarUtils'
import './RevisionCalendar.css'

type ViewMode = 'month' | 'week'
type ReviewStatus = 'overdue' | 'today' | 'upcoming'

interface ScheduledReview {
  problem: Problem
  attempt: RecallAttempt
  date: string
  status: ReviewStatus
}

function localDateFromKey(key: string): Date {
  if (!isValidLocalDate(key)) throw new RangeError('Expected a valid review date.')
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function loadCalendarData(): { problems: Problem[]; attempts: RecallAttempt[]; error: string | null } {
  const problemResult = loadProblems()
  const attemptResult = loadRecallAttempts()
  return {
    problems: problemResult.problems,
    attempts: attemptResult.attempts,
    error: problemResult.error ?? attemptResult.error,
  }
}

function buildScheduledReviews(
  problems: Problem[],
  attempts: RecallAttempt[],
  today: string,
): ScheduledReview[] {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]))
  const latestByProblem = new Map<string, RecallAttempt>()
  const orderedAttempts = [...attempts].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))

  for (const attempt of orderedAttempts) {
    if (
      problemById.has(attempt.problemId) &&
      !latestByProblem.has(attempt.problemId)
    ) {
      latestByProblem.set(attempt.problemId, attempt)
    }
  }

  return [...latestByProblem.values()]
    .filter((attempt) => attempt.nextReviewDate && isValidLocalDate(attempt.nextReviewDate))
    .map((attempt) => {
      const date = attempt.nextReviewDate!
      const comparison = compareLocalDates(date, today)
      const status: ReviewStatus = comparison < 0 ? 'overdue' : comparison === 0 ? 'today' : 'upcoming'
      return {
        problem: problemById.get(attempt.problemId)!,
        attempt,
        date,
        status,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.problem.title.localeCompare(b.problem.title))
}

function getViewLabel(view: ViewMode, anchor: Date): string {
  return view === 'month' ? monthLabel(anchor) : weekLabel(getWeekDays(anchor))
}

function CalendarReview({
  review,
  onOpen,
  compact = false,
}: {
  review: ScheduledReview
  onOpen: () => void
  compact?: boolean
}) {
  return (
    <button
      aria-label={`${review.problem.title}, ${review.status === 'today' ? 'due today' : review.status}, review ${dateForDisplay(review.date)}. Open recall practice.`}
      className={`calendar-review calendar-review--${review.status}${compact ? ' calendar-review--compact' : ''}`}
      onClick={onOpen}
      type="button"
    >
      <span className="calendar-review-title">{review.problem.title}</span>
      {!compact && (
        <span className="calendar-review-status">
          {review.status === 'overdue' ? 'Overdue' : review.status === 'today' ? 'Due today' : 'Upcoming'}
        </span>
      )}
    </button>
  )
}

function EmptyCalendarState({ hasAnyScheduledReviews }: { hasAnyScheduledReviews: boolean }) {
  return (
    <div className="calendar-empty-state">
      <span aria-hidden="true" className="calendar-empty-icon">◷</span>
      <h3>{hasAnyScheduledReviews ? 'No reviews in this period' : 'No scheduled reviews yet'}</h3>
      <p>
        {hasAnyScheduledReviews
          ? 'This view has no scheduled problem reviews. Check another month or week to find upcoming reviews.'
          : 'Complete a recall session to schedule a review. Your saved scheduler dates will appear here.'}
      </p>
    </div>
  )
}

export default function RevisionCalendar({
  onOpenProblem,
}: {
  onOpenProblem: (problemId: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [calendarData, setCalendarData] = useState<{
    problems: Problem[]
    attempts: RecallAttempt[]
    error: string | null
  }>({ problems: [], attempts: [], error: null })
  const [today, setToday] = useState(() => getLocalToday())
  const [anchorDate, setAnchorDate] = useState(() => localDateFromKey(getLocalToday()))
  const [view, setView] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState(() => getLocalToday())

  const load = () => {
    setLoading(true)
    window.setTimeout(() => {
      setCalendarData(loadCalendarData())
      const currentDate = getLocalToday()
      setToday(currentDate)
      setLoading(false)
    }, 120)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCalendarData(loadCalendarData())
      const currentDate = getLocalToday()
      setToday(currentDate)
      setAnchorDate(localDateFromKey(currentDate))
      setSelectedDate(currentDate)
      setLoading(false)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  const scheduledReviews = useMemo(
    () => buildScheduledReviews(calendarData.problems, calendarData.attempts, today),
    [calendarData.attempts, calendarData.problems, today],
  )
  const reviewsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledReview[]>()
    for (const review of scheduledReviews) {
      const group = grouped.get(review.date) ?? []
      group.push(review)
      grouped.set(review.date, group)
    }
    return grouped
  }, [scheduledReviews])
  const days = view === 'month' ? getMonthGrid(anchorDate) : getWeekDays(anchorDate)
  const selectedDateReviews = reviewsByDate.get(selectedDate) ?? []
  const selectedDay = localDateFromKey(selectedDate)
  const periodContainsReviews = days.some((day) => reviewsByDate.has(localDateKey(day)))

  const goToToday = () => {
    const now = localDateFromKey(getLocalToday())
    setToday(localDateKey(now))
    setAnchorDate(view === 'month' ? startOfMonth(now) : now)
    setSelectedDate(localDateKey(now))
  }

  const navigatePeriod = (amount: number) => {
    const nextAnchor = view === 'month'
      ? shiftMonth(anchorDate, amount)
      : shiftWeek(anchorDate, amount)
    setAnchorDate(nextAnchor)
    setSelectedDate(localDateKey(nextAnchor))
  }

  const changeView = (nextView: ViewMode) => {
    if (nextView === view) return
    setView(nextView)
    setAnchorDate(nextView === 'month' ? startOfMonth(selectedDay) : selectedDay)
  }

  const retry = () => load()

  return (
    <main className="revision-calendar-page">
      <section className="calendar-hero">
        <div className="calendar-hero-copy">
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> SPACED REPETITION</span>
          <h1>Keep the right ideas <span>in rotation.</span></h1>
          <p>Your review calendar, driven by the next review dates from real recall sessions.</p>
        </div>
        <div aria-hidden="true" className="calendar-hero-art">↻</div>
      </section>

      {loading ? (
        <div aria-live="polite" className="calendar-loading">
          <span className="loading-indicator" />
          <span>Loading your scheduled reviews…</span>
        </div>
      ) : calendarData.error ? (
        <div className="calendar-error" role="alert">
          <div><strong>Calendar data could not be loaded</strong><p>{calendarData.error}</p></div>
          <button className="button button-quiet" onClick={retry} type="button">Retry loading</button>
        </div>
      ) : (
        <>
          <section aria-label="Revision calendar" className="calendar-panel">
            <div className="calendar-toolbar">
              <div className="calendar-period">
                <h2>{getViewLabel(view, anchorDate)}</h2>
                <button className="calendar-today-button" onClick={goToToday} type="button">Today</button>
              </div>
              <div className="calendar-toolbar-actions">
                <div aria-label="Calendar view" className="calendar-view-switch" role="group">
                  <button
                    aria-pressed={view === 'month'}
                    className={view === 'month' ? 'calendar-view-active' : ''}
                    onClick={() => changeView('month')}
                    type="button"
                  >
                    Month
                  </button>
                  <button
                    aria-pressed={view === 'week'}
                    className={view === 'week' ? 'calendar-view-active' : ''}
                    onClick={() => changeView('week')}
                    type="button"
                  >
                    Week
                  </button>
                </div>
                <div className="calendar-navigation">
                  <button aria-label={`Previous ${view}`} onClick={() => navigatePeriod(-1)} type="button">‹</button>
                  <button aria-label={`Next ${view}`} onClick={() => navigatePeriod(1)} type="button">›</button>
                </div>
              </div>
            </div>

            <div aria-label="Review status legend" className="calendar-legend">
              <span><i className="legend-dot legend-dot-overdue" /> Overdue</span>
              <span><i className="legend-dot legend-dot-today" /> Due today</span>
              <span><i className="legend-dot legend-dot-upcoming" /> Upcoming</span>
            </div>

            {scheduledReviews.length === 0 && (
              <EmptyCalendarState hasAnyScheduledReviews={false} />
            )}
            {view === 'month' ? (
              <div className="month-calendar">
                <div aria-hidden="true" className="calendar-weekdays">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="month-grid">
                  {days.map((day) => {
                    const key = localDateKey(day)
                    const dayReviews = reviewsByDate.get(key) ?? []
                    const isToday = key === today
                    const isSelected = key === selectedDate
                    return (
                      <button
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={`${dateForDisplay(key)}${isToday ? ', today' : ''}${dayReviews.length ? `, ${dayReviews.length} reviews` : ''}`}
                        className={`month-day${sameLocalMonth(day, anchorDate) ? '' : ' month-day--outside'}${isToday ? ' month-day--today' : ''}${isSelected ? ' month-day--selected' : ''}${dayReviews.length ? ' month-day--has-reviews' : ''}`}
                        key={key}
                        onClick={() => setSelectedDate(key)}
                        type="button"
                      >
                        <span className="month-day-number">{day.getDate()}</span>
                        {dayReviews.length > 0 && (
                          <span className="month-day-reviews">
                            {dayReviews.slice(0, 2).map((review) => (
                              <span
                                aria-hidden="true"
                                className={`month-review-dot month-review-dot--${review.status}`}
                                key={review.problem.id}
                              />
                            ))}
                            {dayReviews.length > 2 && <span className="month-review-more">+{dayReviews.length - 2}</span>}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="week-calendar">
                {days.map((day) => {
                  const key = localDateKey(day)
                  const dayReviews = reviewsByDate.get(key) ?? []
                  const isToday = key === today
                  const isSelected = key === selectedDate
                  return (
                    <section
                      aria-label={`${dateForDisplay(key)}${isToday ? ', today' : ''}`}
                      className={`week-day${isToday ? ' week-day--today' : ''}${isSelected ? ' week-day--selected' : ''}`}
                      key={key}
                    >
                      <button
                        aria-current={isToday ? 'date' : undefined}
                        className="week-day-heading"
                        onClick={() => setSelectedDate(key)}
                        type="button"
                      >
                        <span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span>
                        <strong>{day.getDate()}</strong>
                        {isToday && <i>Today</i>}
                      </button>
                      <div className="week-day-reviews">
                        {dayReviews.map((review) => (
                          <CalendarReview
                            key={review.problem.id}
                            onOpen={() => onOpenProblem(review.problem.id)}
                            review={review}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}

            {view === 'month' && (
              <section aria-labelledby="selected-day-title" className="selected-day-agenda">
                <div className="agenda-heading">
                  <h3 id="selected-day-title">{dateForDisplay(selectedDate)}{selectedDate === today ? ' · Today' : ''}</h3>
                  <span>{selectedDateReviews.length} {selectedDateReviews.length === 1 ? 'review' : 'reviews'}</span>
                </div>
                {selectedDateReviews.length > 0 ? (
                  <div className="agenda-list">
                    {selectedDateReviews.map((review) => (
                      <CalendarReview
                        key={review.problem.id}
                        onOpen={() => onOpenProblem(review.problem.id)}
                        review={review}
                      />
                    ))}
                  </div>
                ) : scheduledReviews.length > 0 && periodContainsReviews ? (
                  <p className="agenda-empty">No scheduled reviews on this day. Select a marked day to see its problems.</p>
                ) : scheduledReviews.length === 0 ? (
                  <p className="agenda-empty">A review will appear here after a recall session is saved.</p>
                ) : (
                  <EmptyCalendarState hasAnyScheduledReviews={scheduledReviews.length > 0} />
                )}
              </section>
            )}
          </section>
          <footer className="problems-footer calendar-footer">
            <span>Recall.dev <span>·</span> Reviews from your saved recall history.</span>
            <span>Revision calendar</span>
          </footer>
        </>
      )}
    </main>
  )
}
