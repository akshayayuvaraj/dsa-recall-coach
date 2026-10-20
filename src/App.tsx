import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'
import ProblemModule from './problems/ProblemModule'
import RecallModule from './recall/RecallModule'
import RevisionCalendar from './calendar/RevisionCalendar'
import PatternsExplorer from './patterns/PatternsExplorer'
import AnalyticsDashboard from './analytics/AnalyticsDashboard'
import SettingsData from './settings/SettingsData'
import { loadProfile, saveProfile, type UserProfile } from './settings/profileStorage'
import { THEME_STORAGE_KEY, type BackupSettings } from './settings/backupStorage'
import PracticeModule from './practice/PracticeModule'
import NeetCodeTracker from './neetcode/NeetCodeTracker'

type Page = 'overview' | 'problems' | 'recall' | 'practice' | 'neetcode' | 'calendar' | 'patterns' | 'analytics' | 'settings'

type IconName =
  | 'overview'
  | 'problems'
  | 'recall'
  | 'practice'
  | 'neetcode'
  | 'calendar'
  | 'pattern'
  | 'analytics'
  | 'search'
  | 'sun'
  | 'moon'
  | 'chevron'
  | 'menu'
  | 'spark'
  | 'arrow'
  | 'lock'
  | 'clock'

const iconPaths: Record<IconName, ReactNode> = {
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="4" rx="1.5" /><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  problems: <><path d="M8 5.5h11M8 12h11M8 18.5h11" /><circle cx="4.5" cy="5.5" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18.5" r="1" /></>,
  recall: <><path d="M20 11a8 8 0 0 0-14.9-4L3 10" /><path d="M3 4v6h6M4 13a8 8 0 0 0 14.9 4L21 14" /><path d="M21 20v-6h-6" /></>,
  practice: <><path d="m8 5 11 7-11 7V5Z" /><path d="M4 5v14" /></>,
  neetcode: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="11" cy="19" r="1.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  pattern: <><path d="M12 3 14.2 9.8 21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" /><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3Z" /></>,
  analytics: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /><path d="M17 6h3v3" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
  moon: <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  )
}

function ProfileDialog({
  profile,
  onClose,
  onSave,
}: {
  profile: UserProfile
  onClose: () => void
  onSave: (profile: UserProfile) => string | null
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [learningGoal, setLearningGoal] = useState(profile.learningGoal)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!displayName.trim()) {
      setError('Add a display name to save your profile.')
      return
    }
    const saveError = onSave({ displayName: displayName.trim(), learningGoal: learningGoal.trim() })
    if (saveError) setError(saveError)
    else dialogRef.current?.close()
  }

  return (
    <dialog
      aria-labelledby="profile-dialog-title"
      className="profile-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          dialogRef.current?.close()
        }
      }}
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
      <span className="profile-dialog-kicker">PERSONAL WORKSPACE</span>
      <h2 id="profile-dialog-title">Your profile</h2>
      <p>Your name and learning goal are saved only in this browser.</p>
      <form onSubmit={submit}>
        <label>
          <span>Display name</span>
          <input autoFocus maxLength={60} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
        </label>
        <label>
          <span>Learning goal <small>Optional</small></span>
          <textarea maxLength={200} onChange={(event) => setLearningGoal(event.target.value)} placeholder="For example: Prepare for SDE-1 interviews in Java" rows={3} value={learningGoal} />
        </label>
        {error && <p className="profile-dialog-error" role="alert">{error}</p>}
        <div className="profile-dialog-actions">
          <button className="profile-dialog-secondary" onClick={() => dialogRef.current?.close()} type="button">Cancel</button>
          <button className="profile-dialog-primary" type="submit">Save profile</button>
        </div>
      </form>
    </dialog>
  )
}

function ProfileInfoDialog({
  kind,
  onClose,
  onOpenSettings,
}: {
  kind: 'account' | 'signout'
  onClose: () => void
  onOpenSettings: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  const isAccount = kind === 'account'
  return (
    <dialog
      aria-labelledby="profile-info-title"
      className="profile-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          dialogRef.current?.close()
        }
      }}
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
      <span className="profile-dialog-kicker">LOCAL-ONLY APP</span>
      <h2 id="profile-info-title">{isAccount ? 'Account settings' : 'Sign out'}</h2>
      <p>{isAccount
        ? 'This app stores your data on this device. There is no account or authentication backend, so account management and cross-device sync are not available.'
        : 'Sign out is unavailable because this local-only app has no authenticated session. Your saved progress will remain on this device.'}</p>
      <div className="profile-dialog-actions">
        <button className="profile-dialog-secondary" onClick={() => dialogRef.current?.close()} type="button">Close</button>
        {isAccount && <button className="profile-dialog-primary" onClick={onOpenSettings} type="button">Open Settings &amp; data</button>}
      </div>
    </dialog>
  )
}

const navigation: { label: string; icon: IconName; available: boolean }[] = [
  { label: 'Overview', icon: 'overview', available: true },
  { label: 'My problems', icon: 'problems', available: true },
  { label: 'Recall', icon: 'recall', available: true },
  { label: 'Practice', icon: 'practice', available: true },
  { label: 'NeetCode 150', icon: 'neetcode', available: true },
  { label: 'Revision calendar', icon: 'calendar', available: true },
  { label: 'Pattern', icon: 'pattern', available: true },
  { label: 'Analytics', icon: 'analytics', available: true },
]

function Sidebar({
  collapsed,
  onToggle,
  query,
  page,
  onNavigate,
}: {
  collapsed: boolean
  onToggle: () => void
  query: string
  page: Page
  onNavigate: (page: Page) => void
}) {
  const filteredNavigation = navigation.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <a aria-label="Recall home" className="brand" href="#overview">
        <span aria-hidden="true" className="brand-mark"><Icon name="spark" size={20} /></span>
        <span className="brand-copy">
          <span className="brand-name">Recall<span className="brand-name-accent">.dev</span></span>
          <span className="brand-caption">DSA learning space</span>
        </span>
      </a>

      <div className="sidebar-section-label">WORKSPACE</div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {filteredNavigation.length > 0 ? (
          filteredNavigation.map((item) => {
            const itemPage: Page | null = item.label === 'Overview'
              ? 'overview'
              : item.label === 'My problems'
                ? 'problems'
                : item.label === 'Recall'
                  ? 'recall'
                  : item.label === 'Practice'
                    ? 'practice'
                    : item.label === 'NeetCode 150'
                      ? 'neetcode'
                  : item.label === 'Revision calendar'
                    ? 'calendar'
                    : item.label === 'Pattern'
                      ? 'patterns'
                      : item.label === 'Analytics'
                        ? 'analytics'
                        : null
            const active = itemPage === page

            return (
              <button
                aria-current={active ? 'page' : undefined}
                aria-label={item.available ? item.label : `${item.label}, not available yet`}
                className={`nav-item${active ? ' nav-item--active' : ''}`}
                disabled={!item.available}
                key={item.label}
                onClick={() => itemPage && onNavigate(itemPage)}
                title={`${item.label}${item.available ? '' : ' — not available yet'}`}
                type="button"
              >
                <Icon name={item.icon} size={19} />
                <span className="nav-label">{item.label}</span>
                {!item.available && <span className="nav-soon">Soon</span>}
              </button>
            )
          })
        ) : (
          <p className="nav-empty">No sections match “{query}”.</p>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="note-icon"><Icon name="spark" size={17} /></span>
          <div className="note-copy">
            <strong>Make it stick.</strong>
            <span>Your next chapter starts with one problem.</span>
          </div>
        </div>
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="collapse-button"
          onClick={onToggle}
          type="button"
        >
          <Icon name="menu" size={18} />
          <span className="nav-label">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </button>
      </div>
    </aside>
  )
}

function Topbar({
  lightTheme,
  profile,
  onSaveProfile,
  onToggleTheme,
  search,
  onSearchChange,
  page,
  onOpenSettings,
}: {
  lightTheme: boolean
  profile: UserProfile
  onSaveProfile: (profile: UserProfile) => string | null
  onToggleTheme: () => void
  search: string
  onSearchChange: (value: string) => void
  page: Page
  onOpenSettings: () => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [dialog, setDialog] = useState<'profile' | 'account' | 'signout' | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profileOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false)
        profileButtonRef.current?.focus()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [profileOpen])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target
      if (
        event.key === '/' &&
        !(target instanceof HTMLElement && (
          target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        ))
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span className="breadcrumb-muted">Workspace</span>
        <Icon name="chevron" size={15} />
        <span className="breadcrumb-current">
          {page === 'overview'
            ? 'Overview'
            : page === 'problems'
              ? 'My problems'
              : page === 'recall'
                ? 'Recall'
                : page === 'practice'
                  ? 'Practice'
                  : page === 'neetcode'
                    ? 'NeetCode 150'
                : page === 'calendar'
                  ? 'Revision calendar'
                  : page === 'patterns'
                    ? 'Patterns & topics'
                    : page === 'analytics'
                      ? 'Analytics'
                      : 'Settings & data'}
        </span>
      </div>
      <div className="topbar-actions">
        <label className="search-box">
          <Icon name="search" size={18} />
          <span className="sr-only">Search workspace sections</span>
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search sections..."
            ref={searchInputRef}
            type="search"
            value={search}
          />
          <kbd>/</kbd>
        </label>
        <span className="topbar-divider" />
        <button
          aria-label={`Switch to ${lightTheme ? 'dark' : 'light'} theme`}
          aria-pressed={lightTheme}
          className="icon-button theme-button"
          onClick={onToggleTheme}
          title={`Switch to ${lightTheme ? 'dark' : 'light'} theme`}
          type="button"
        >
          <Icon name={lightTheme ? 'moon' : 'sun'} size={19} />
        </button>
        <div className="profile-wrap" ref={profileRef}>
          <button
            aria-expanded={profileOpen}
            aria-label={`Open profile menu${profile.displayName ? ` for ${profile.displayName}` : ''}`}
            aria-controls="profile-menu"
            className="profile-button"
            onClick={() => setProfileOpen((open) => !open)}
            ref={profileButtonRef}
            type="button"
          >
            <span aria-hidden="true" className="avatar">{profile.displayName.trim().charAt(0).toUpperCase() || 'U'}</span>
            <span className="profile-name">{profile.displayName || 'Your profile'}</span>
            <span className="profile-caret"><Icon name="chevron" size={15} /></span>
          </button>
          {profileOpen && (
            <div aria-label="Profile menu" className="profile-menu" id="profile-menu" role="group">
              <div className="profile-menu-heading">
                <strong>{profile.displayName || 'Your profile'}</strong>
                <span>{profile.learningGoal || 'Personal workspace'}</span>
              </div>
              <button
                className="profile-menu-item"
                onClick={() => {
                  setProfileOpen(false)
                  setDialog('profile')
                }}
                type="button"
              >
                Edit profile <span>Name and learning goal</span>
              </button>
              <button
                className="profile-menu-item"
                onClick={() => {
                  setProfileOpen(false)
                  onOpenSettings()
                }}
                type="button"
              >
                Settings &amp; data <span>Theme, export and import</span>
              </button>
              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); setDialog('account') }} type="button">
                Account settings <span>Local device storage</span>
              </button>
              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); setDialog('signout') }} type="button">
                Sign out <span>Unavailable in local-only mode</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {dialog === 'profile' && <ProfileDialog onClose={() => setDialog(null)} onSave={onSaveProfile} profile={profile} />}
      {(dialog === 'account' || dialog === 'signout') && (
        <ProfileInfoDialog
          kind={dialog}
          onClose={() => setDialog(null)}
          onOpenSettings={() => {
            setDialog(null)
            onOpenSettings()
          }}
        />
      )}
    </header>
  )
}

function EmptyCard({
  icon,
  title,
  description,
  status,
  onOpen,
  actionLabel,
}: {
  icon: IconName
  title: string
  description: string
  status: string
  onOpen?: () => void
  actionLabel?: string
}) {
  return (
    <article className="empty-card">
      <div className="empty-card-top">
        <span className="empty-card-icon"><Icon name={icon} size={19} /></span>
        <span className="availability">{status}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {onOpen ? (
        <button className="empty-card-footer empty-card-footer-action" onClick={onOpen} type="button">
          <span>{actionLabel ?? `Open ${title.toLowerCase()}`}</span>
          <Icon name="arrow" size={16} />
        </button>
      ) : (
        <div className="empty-card-footer">
          <span>No activity yet</span>
          <Icon name="arrow" size={16} />
        </div>
      )}
    </article>
  )
}

function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <main className="dashboard" id="overview">
      <section aria-labelledby="welcome-title" className="welcome-panel">
        <div className="welcome-orb welcome-orb-one" />
        <div className="welcome-orb welcome-orb-two" />
        <div className="welcome-content">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR LEARNING SPACE</span>
          <h1 id="welcome-title">Build recall that <span>lasts.</span></h1>
          <p>A calmer way to turn solved problems into knowledge you can actually remember.</p>
          <div className="welcome-meta">
            <span><Icon name="spark" size={15} /> First module</span>
            <span className="meta-separator" />
            <span>Overview</span>
          </div>
        </div>
        <div aria-hidden="true" className="welcome-art">
          <div className="art-ring art-ring-one" />
          <div className="art-ring art-ring-two" />
          <div className="art-center"><Icon name="spark" size={33} /></div>
          <span className="art-dot art-dot-one" />
          <span className="art-dot art-dot-two" />
          <span className="art-dot art-dot-three" />
        </div>
      </section>

      <section aria-labelledby="workspace-title" className="workspace-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">YOUR WORKSPACE</span>
            <h2 id="workspace-title">Your workspace</h2>
          </div>
          <span className="quiet-label"><span /></span>
        </div>
        <div className="card-grid">
          <EmptyCard
            description="Keep problem statements, patterns, approaches, and review notes together."
            icon="problems"
            onOpen={() => onNavigate('problems')}
            actionLabel="Open problem library"
            status="Ready to use"
            title="Problem library"
          />
          <EmptyCard
            description="Practice recalling your approach before revealing saved solutions."
            icon="recall"
            onOpen={() => onNavigate('recall')}
            actionLabel="Start recall practice"
            status="Ready to use"
            title="Recall queue"
          />
          <EmptyCard
            description="Choose due problems first, save recall drafts, and record completed sessions."
            icon="practice"
            onOpen={() => onNavigate('practice')}
            actionLabel="Open Practice"
            status="Ready to use"
            title="Practice"
          />
          <EmptyCard
            description="See overdue, due-today, and upcoming problem reviews."
            icon="calendar"
            onOpen={() => onNavigate('calendar')}
            actionLabel="Open revision calendar"
            status="Ready to use"
            title="Revision calendar"
          />
          <EmptyCard
            description="Browse saved problems by topic and keep their patterns easy to revisit."
            icon="pattern"
            onOpen={() => onNavigate('patterns')}
            actionLabel="Explore topics"
            status="Ready to use"
            title="Patterns & topics"
          />
          <EmptyCard
            description="Review counts, outcomes, and confidence trends from your saved recall history."
            icon="analytics"
            onOpen={() => onNavigate('analytics')}
            actionLabel="Open analytics"
            status="Ready to use"
            title="Analytics"
          />
        </div>
      </section>

      <section aria-labelledby="next-title" className="next-section">
        <div className="next-icon"><Icon name="clock" size={19} /></div>
        <div className="next-copy">
          <h2 id="next-title">Your next step</h2>
          <p>Your problem library, recall practice, Practice, revision calendar, topic explorer, and analytics are ready.</p>
        </div>
        <span className="module-tag"><Icon name="spark" size={14} /> YOUR SAVED DATA</span>
      </section>

      <footer className="dashboard-footer">
        <span>Recall.dev <span className="footer-dot">·</span> Made for the long game.</span>
        <span>Module 01 <span className="footer-dot">/</span> Overview</span>
      </footer>
    </main>
  )
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [{ lightTheme, error: themeError }, setThemePreference] = useState(() => {
    try {
      return {
        lightTheme: window.localStorage.getItem(THEME_STORAGE_KEY) === 'light',
        error: null as string | null,
      }
    } catch {
      return {
        lightTheme: false,
        error: 'Theme preference could not be read from browser storage.',
      }
    }
  })
  const [profileState, setProfileState] = useState(() => loadProfile())
  const { profile, error: profileError } = profileState
  const [search, setSearch] = useState('')
  const [page, setPage] = useState<Page>('overview')
  const [recallProblemId, setRecallProblemId] = useState<string | null>(null)
  const [problemToOpenId, setProblemToOpenId] = useState<string | null>(null)
  const [practiceProblemId, setPracticeProblemId] = useState<string | null>(null)

  const navigate = (nextPage: Page) => {
    if (nextPage !== 'recall') setRecallProblemId(null)
    if (nextPage !== 'problems') setProblemToOpenId(null)
    if (nextPage !== 'practice') setPracticeProblemId(null)
    setPage(nextPage)
  }
  const openRecallForProblem = (problemId: string) => {
    setRecallProblemId(problemId)
    setPage('recall')
  }
  const openProblemDetails = (problemId: string) => {
    setProblemToOpenId(problemId)
    setPage('problems')
  }
  const openPracticeForProblem = (problemId: string) => {
    setPracticeProblemId(problemId)
    setPage('practice')
  }
  const toggleTheme = () => {
    setThemePreference((current) => {
      const lightTheme = !current.lightTheme
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, lightTheme ? 'light' : 'dark')
        return { lightTheme, error: null }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown storage error.'
        return { lightTheme, error: `Theme changed for this session but could not be saved. ${detail}` }
      }
    })
  }
  const saveUserProfile = (nextProfile: UserProfile) => {
    const error = saveProfile(nextProfile)
    if (!error) setProfileState({ profile: nextProfile, error: null })
    return error
  }
  const applyImportedSettings = (settings?: BackupSettings) => {
    if (!settings) return
    setProfileState({ profile: settings.profile, error: null })
    setThemePreference({ lightTheme: settings.theme === 'light', error: null })
  }

  return (
    <div className={`app-shell${lightTheme ? ' theme-light' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        onNavigate={navigate}
        page={page}
        query={search}
      />
      <div className="main-column">
        <Topbar
          lightTheme={lightTheme}
          profile={profile}
          onSaveProfile={saveUserProfile}
          onSearchChange={setSearch}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => navigate('settings')}
          page={page}
          search={search}
        />
        {page === 'overview' ? (
          <Dashboard onNavigate={navigate} />
        ) : page === 'problems' ? (
          <ProblemModule initialProblemId={problemToOpenId} />
        ) : page === 'recall' ? (
          <RecallModule initialProblemId={recallProblemId} />
        ) : page === 'practice' ? (
          <PracticeModule
            initialProblemId={practiceProblemId}
            onDashboard={() => navigate('overview')}
            onOpenProblems={() => navigate('problems')}
          />
        ) : page === 'neetcode' ? (
          <NeetCodeTracker onStartRecall={openPracticeForProblem} />
        ) : page === 'calendar' ? (
          <RevisionCalendar onOpenProblem={openRecallForProblem} />
        ) : page === 'patterns' ? (
          <PatternsExplorer
            onOpenProblem={openProblemDetails}
            onOpenProblemLibrary={() => navigate('problems')}
            onStartRecall={openRecallForProblem}
          />
        ) : page === 'analytics' ? (
          <AnalyticsDashboard />
        ) : (
          <SettingsData
            lightTheme={lightTheme}
            profile={profile}
            profileError={profileError}
            onSettingsImported={applyImportedSettings}
            onToggleTheme={toggleTheme}
            themeError={themeError}
          />
        )}
      </div>
    </div>
  )
}

export default App
