import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { loadProblems } from '../problems/problemStorage'
import { loadRecallAttempts } from '../recall/recallStorage'
import {
  backupCounts,
  parseBackup,
  readBackupForExport,
  replaceSavedData,
  type BackupSettings,
  type CoachBackup,
} from './backupStorage'
import type { UserProfile } from './profileStorage'
import './SettingsData.css'

const MAX_BACKUP_SIZE_BYTES = 20 * 1024 * 1024

function saveBackupFile(text: string): string | null {
  try {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `dsa-recall-coach-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown download error.'
    return `The backup download could not be started. ${detail}`
  }
}

function ImportConfirmation({
  backup,
  busy,
  onCancel,
  onConfirm,
}: {
  backup: CoachBackup
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const counts = backupCounts(backup)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      aria-labelledby="import-confirm-title"
      className="settings-confirm-dialog"
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
      onClose={onCancel}
      ref={dialogRef}
    >
      <span className="settings-dialog-kicker">REPLACE LOCAL DATA</span>
      <h2 id="import-confirm-title">Import this backup?</h2>
      <p>
        This replaces the current problem library and recall history with {counts.problems} saved
        {counts.problems === 1 ? ' problem' : ' problems'} and {counts.recallAttempts} recall
        {counts.recallAttempts === 1 ? ' attempt' : ' attempts'}
        {backup.practiceDrafts
          ? `, plus ${counts.practiceDrafts} saved ${counts.practiceDrafts === 1 ? 'practice draft' : 'practice drafts'}.`
          : ', and will leave current practice drafts unchanged because this older backup has no draft data.'}
        {' '}This cannot be undone.
      </p>
      <p className="settings-dialog-schedule-note">
        Scheduling dates, intervals, and recall streaks included in the attempt history will be restored too.
        {backup.settings ? ' The saved profile and theme preferences in this backup will also be replaced.' : ' This older backup has no profile or theme settings; those will be left unchanged.'}
      </p>
      <div className="settings-dialog-actions">
        <button
          autoFocus
          className="settings-button settings-button-quiet"
          disabled={busy}
          onClick={() => dialogRef.current?.close()}
          type="button"
        >
          Keep current data
        </button>
        <button
          className="settings-button settings-button-danger"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy ? 'Importing…' : 'Replace and import'}
        </button>
      </div>
    </dialog>
  )
}

export default function SettingsData({
  lightTheme,
  profile,
  profileError,
  onSettingsImported,
  onToggleTheme,
  themeError,
}: {
  lightTheme: boolean
  profile: UserProfile
  profileError: string | null
  onSettingsImported: (settings?: BackupSettings) => void
  onToggleTheme: () => void
  themeError: string | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<CoachBackup | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [counts, setCounts] = useState(() => {
    const problems = loadProblems()
    const attempts = loadRecallAttempts()
    return {
      problems: problems.error ? null : problems.problems.length,
      attempts: attempts.error ? null : attempts.attempts.length,
      error: [problems.error, attempts.error].filter(Boolean).join(' ') || null,
    }
  })

  const refreshCounts = () => {
    const problems = loadProblems()
    const attempts = loadRecallAttempts()
    setCounts({
      problems: problems.error ? null : problems.problems.length,
      attempts: attempts.error ? null : attempts.attempts.length,
      error: [problems.error, attempts.error].filter(Boolean).join(' ') || null,
    })
  }

  const exportData = () => {
    setError(null)
    setStatus(null)
    const result = readBackupForExport({ profile, theme: lightTheme ? 'light' : 'dark' })
    if (result.error || !result.text) {
      setError(result.error ?? 'The backup could not be created.')
      return
    }
    const downloadError = saveBackupFile(result.text)
    if (downloadError) {
      setError(downloadError)
      return
    }
    setStatus('Backup downloaded. Store the JSON file somewhere safe outside this browser.')
  }

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setStatus(null)
    if (file.size > MAX_BACKUP_SIZE_BYTES) {
      setError('This backup is larger than 20 MB. Choose a smaller JSON backup file.')
      return
    }

    setLoading(true)
    try {
      const contents = await file.text()
      const result = parseBackup(contents)
      if (result.error || !result.backup) {
        setError(result.error ?? 'The selected backup could not be validated.')
        return
      }
      setPendingBackup(result.backup)
    } catch (fileError) {
      const detail = fileError instanceof Error ? fileError.message : 'Unknown file read error.'
      setError(`The selected backup could not be read. ${detail}`)
    } finally {
      setLoading(false)
    }
  }

  const confirmImport = () => {
    if (!pendingBackup || busy) return
    setBusy(true)
    const importError = replaceSavedData(pendingBackup)
    setBusy(false)
    setPendingBackup(null)
    if (importError) {
      setError(importError)
      return
    }

    const importedCounts = backupCounts(pendingBackup)
    setCounts({ problems: importedCounts.problems, attempts: importedCounts.recallAttempts, error: null })
    onSettingsImported(pendingBackup.settings)
    setError(null)
    setStatus(
      `Backup imported successfully: ${importedCounts.problems} problems, ${importedCounts.recallAttempts} recall attempts, and ${importedCounts.practiceDrafts} practice drafts${pendingBackup.settings ? ', profile, and theme preferences' : ''}.`,
    )
  }

  return (
    <main className="settings-page">
      <section aria-labelledby="settings-title" className="settings-hero">
        <div>
          <span className="module-eyebrow"><span className="hero-eyebrow-dot" /> PERSONAL WORKSPACE</span>
          <h1 id="settings-title">Settings &amp; <span>your data.</span></h1>
          <p>Choose your display theme and back up your problem library, recall progress, notes, review history, and profile settings.</p>
        </div>
      </section>

      {(error || themeError || profileError || counts.error) && (
        <div className="settings-alert" role="alert">
          {[error, themeError, profileError, counts.error].filter(Boolean).map((message) => <span key={message}>{message}</span>)}
        </div>
      )}
      {status && <div aria-live="polite" className="settings-status" role="status">{status}</div>}

      <section aria-labelledby="appearance-title" className="settings-section">
        <div className="settings-section-heading">
          <div>
            <span className="section-kicker">APPEARANCE</span>
            <h2 id="appearance-title">Theme</h2>
          </div>
          <span className="settings-section-value">{lightTheme ? 'Light theme' : 'Dark theme'} selected</span>
        </div>
        <div className="settings-theme-card">
          <div>
            <strong>Display theme</strong>
            <p>The theme applies consistently across your workspace and is saved in this browser.</p>
          </div>
          <button
            aria-pressed={lightTheme}
            className="settings-button settings-button-quiet"
            onClick={onToggleTheme}
            type="button"
          >
            Switch to {lightTheme ? 'dark' : 'light'} theme
          </button>
        </div>
      </section>

      <section aria-labelledby="data-title" className="settings-section">
        <div className="settings-section-heading">
          <div>
            <span className="section-kicker">PORTABILITY</span>
            <h2 id="data-title">Backup &amp; restore</h2>
          </div>
          <span className="settings-section-value">JSON · versioned format</span>
        </div>
        <div className="settings-data-card">
          <p>
            A backup includes saved problems, tracker statuses and notes, resumable practice drafts, complete
            recall history (outcomes, confidence, reflections, and scheduling dates, intervals, and streaks),
            your display name, learning goal, and theme preference.
          </p>
          <div className="settings-data-counts">
            <span><strong>{counts.problems ?? '—'}</strong> saved problems</span>
            <span><strong>{counts.attempts ?? '—'}</strong> recall attempts</span>
          </div>
          <div className="settings-actions">
            <button className="settings-button settings-button-primary" onClick={exportData} type="button">
              Export JSON backup
            </button>
            <button
              className="settings-button settings-button-quiet"
              disabled={loading || busy}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {loading ? 'Reading backup…' : 'Choose backup to import'}
            </button>
            <input
              accept=".json,application/json"
              aria-label="Select DSA Recall Coach JSON backup"
              className="settings-file-input"
              onChange={chooseBackup}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="storage-title" className="settings-section">
        <div className="settings-section-heading">
          <div>
            <span className="section-kicker">IMPORTANT</span>
            <h2 id="storage-title">Where your data lives</h2>
          </div>
        </div>
        <div className="settings-storage-note">
          <strong>Local browser storage is not cloud synchronization.</strong>
          <p>
            Problems, practice drafts, recall attempts, profile settings, and theme preferences are stored in this browser on this device.
            They are not synced to an account or another device. Browser data may be lost if site data or
            local storage is cleared, so export backups regularly and keep a copy somewhere safe.
          </p>
          <p>Imported backups replace the current saved problem library and recall history; export first if you need to preserve them.</p>
        </div>
      </section>

      <footer className="settings-footer">
        <span>Recall.dev · Your data stays in your browser unless you export it.</span>
        <button className="settings-refresh-button" onClick={refreshCounts} type="button">Refresh saved-data counts</button>
      </footer>

      {pendingBackup && (
        <ImportConfirmation
          backup={pendingBackup}
          busy={busy}
          onCancel={() => setPendingBackup(null)}
          onConfirm={confirmImport}
        />
      )}
    </main>
  )
}
