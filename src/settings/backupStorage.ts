import {
  isProblemRecord,
  loadProblems,
  PROBLEMS_STORAGE_KEY,
} from '../problems/problemStorage.ts'
import type { Problem } from '../problems/problemTypes'
import {
  isRecallAttemptRecord,
  loadRecallAttempts,
  RECALL_ATTEMPTS_STORAGE_KEY,
} from '../recall/recallStorage.ts'
import type { RecallAttempt } from '../recall/recallStorage'
import { isValidLocalDate } from '../recall/scheduler.ts'
import {
  isPracticeDraft,
  loadPracticeDrafts,
  PRACTICE_DRAFTS_STORAGE_KEY,
  type PracticeDraft,
} from '../practice/practiceStorage.ts'
import {
  isUserProfile,
  PROFILE_STORAGE_KEY,
  type UserProfile,
} from './profileStorage.ts'

export const BACKUP_FORMAT = 'dsa-recall-coach-backup'
export const BACKUP_VERSION = 1
export const THEME_STORAGE_KEY = 'dsa-recall-coach.theme.v1'

export interface BackupSettings {
  profile: UserProfile
  theme: 'dark' | 'light'
}

export interface CoachBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  problems: Problem[]
  recallAttempts: RecallAttempt[]
  settings?: BackupSettings
  practiceDrafts?: PracticeDraft[]
}

export interface BackupCounts {
  problems: number
  recallAttempts: number
  practiceDrafts: number
}

export function parseBackup(text: string): { backup: CoachBackup | null; error: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { backup: null, error: 'This file is not valid JSON. Choose a DSA Recall Coach backup.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { backup: null, error: 'The backup must be a JSON object.' }
  }

  const value = parsed as Record<string, unknown>
  const settings = value.settings
  const practiceDrafts = value.practiceDrafts
  let backupSettings: BackupSettings | undefined
  let backupPracticeDrafts: PracticeDraft[] | undefined
  const supportedKeys = new Set(['format', 'version', 'exportedAt', 'problems', 'recallAttempts', 'settings', 'practiceDrafts'])
  if (Object.keys(value).some((key) => !supportedKeys.has(key))) {
    return { backup: null, error: 'The backup contains unsupported fields. No data was changed.' }
  }
  if (value.format !== BACKUP_FORMAT) {
    return { backup: null, error: 'This file is not a recognized DSA Recall Coach backup.' }
  }
  if (value.version !== BACKUP_VERSION) {
    return {
      backup: null,
      error: `Backup version ${String(value.version)} is not supported. This app supports version ${BACKUP_VERSION}.`,
    }
  }
  if (
    typeof value.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(value.exportedAt))
  ) {
    return { backup: null, error: 'The backup export date is missing or invalid.' }
  }
  if (!Array.isArray(value.problems) || !value.problems.every(isValidBackupProblem)) {
    return { backup: null, error: 'The backup contains an invalid problem record. No data was changed.' }
  }
  if (!Array.isArray(value.recallAttempts) || !value.recallAttempts.every(isValidBackupAttempt)) {
    return { backup: null, error: 'The backup contains an invalid recall or scheduling record. No data was changed.' }
  }
  if (practiceDrafts !== undefined) {
    if (!Array.isArray(practiceDrafts) || !practiceDrafts.every(isValidBackupDraft)) {
      return { backup: null, error: 'The backup contains an invalid or duplicate practice draft. No data was changed.' }
    }
    if (new Set(practiceDrafts.map((draft) => draft.problemId)).size !== practiceDrafts.length) {
      return { backup: null, error: 'The backup contains an invalid or duplicate practice draft. No data was changed.' }
    }
    backupPracticeDrafts = practiceDrafts
  }
  if (settings !== undefined) {
    if (!isValidBackupSettings(settings)) {
      return { backup: null, error: 'The backup contains invalid profile or theme settings. No data was changed.' }
    }
    backupSettings = settings
  }
  if (hasDuplicateIds(value.problems) || hasDuplicateIds(value.recallAttempts)) {
    return { backup: null, error: 'The backup contains duplicate record IDs. No data was changed.' }
  }

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: value.exportedAt,
      problems: value.problems,
      recallAttempts: value.recallAttempts,
      ...(backupSettings ? { settings: backupSettings } : {}),
      ...(backupPracticeDrafts === undefined ? {} : { practiceDrafts: backupPracticeDrafts }),
    },
    error: null,
  }
}

function hasDuplicateIds(records: Array<{ id: string }>): boolean {
  return new Set(records.map((record) => record.id)).size !== records.length
}

function hasOnlyKeys(value: object, allowedKeys: string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key))
}

function isValidBackupProblem(value: unknown): value is Problem {
  if (!isProblemRecord(value)) return false
  if (!hasOnlyKeys(value, [
    'id',
    'title',
    'url',
    'difficulty',
    'topic',
    'pattern',
    'statement',
    'approach',
    'algorithm',
    'javaNotes',
    'timeComplexity',
    'spaceComplexity',
    'mistakes',
    'hints',
    'confidence',
    'createdAt',
    'lastReviewedAt',
    'isExample',
    'neetcodeId',
    'neetcodeTopic',
    'neetcodeStatus',
    'neetcodeFirstAttemptedAt',
    'neetcodeLastSolvedAt',
    'neetcodeConfidence',
    'neetcodeEdgeCases',
    'neetcodeReflection',
  ])) return false
  if (
    !value.id.trim() ||
    !value.title.trim() ||
    !value.topic.trim() ||
    (!value.neetcodeId && !value.pattern.trim()) ||
    !value.statement.trim()
  ) return false
  try {
    const url = new URL(value.url)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      isValidLocalDate(value.createdAt) &&
      (value.lastReviewedAt === null || isValidLocalDate(value.lastReviewedAt))
    )
  } catch {
    return false
  }
}

function isValidBackupAttempt(value: unknown): value is RecallAttempt {
  if (!isRecallAttemptRecord(value)) return false
  if (!hasOnlyKeys(value, [
    'id',
    'problemId',
    'problemTitle',
    'attemptedAt',
    'outcome',
    'confidence',
    'reflection',
    'answers',
    'hintRevealed',
    'solutionRevealed',
    'nextReviewDate',
    'reviewIntervalDays',
    'consecutiveHighConfidenceRecalls',
  ])) return false
  if (!hasOnlyKeys(value.answers, [
    'pattern',
    'approach',
    'algorithm',
    'timeComplexity',
    'spaceComplexity',
    'edgeCases',
    'testInputs',
    'understanding',
    'inputOutput',
    'constraints',
    'patternReason',
    'keyInsight',
    'timeComplexityReason',
    'spaceComplexityReason',
    'testCaseExample',
    'expectedOutput',
  ])) return false
  return (
    value.id.trim().length > 0 &&
    value.problemId.trim().length > 0 &&
    value.problemTitle.trim().length > 0 &&
    !Number.isNaN(Date.parse(value.attemptedAt))
  )
}

function isValidBackupSettings(value: unknown): value is BackupSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const settings = value as Record<string, unknown>
  return Object.keys(settings).every((key) => key === 'profile' || key === 'theme') &&
    isUserProfile(settings.profile) &&
    (settings.theme === 'light' || settings.theme === 'dark')
}

function isValidBackupDraft(value: unknown): value is PracticeDraft {
  if (!isPracticeDraft(value)) return false
  const allowedKeys = [
    'problemId',
    'phase',
    'answers',
    'hintRevealed',
    'solutionRevealed',
    'outcome',
    'confidence',
    'forgot',
    'remember',
    'savedAt',
  ]
  return hasOnlyKeys(value, allowedKeys) && hasOnlyKeys(value.answers, [
    'pattern',
    'approach',
    'algorithm',
    'timeComplexity',
    'spaceComplexity',
    'edgeCases',
    'testInputs',
    'understanding',
    'inputOutput',
    'constraints',
    'patternReason',
    'keyInsight',
    'timeComplexityReason',
    'spaceComplexityReason',
    'testCaseExample',
    'expectedOutput',
  ])
}

export function createBackupText(
  problems: Problem[],
  recallAttempts: RecallAttempt[],
  exportedAt = new Date().toISOString(),
  settings?: BackupSettings,
  practiceDrafts?: PracticeDraft[],
): string {
  const backup: CoachBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    problems,
    recallAttempts,
    ...(settings ? { settings } : {}),
    ...(practiceDrafts ? { practiceDrafts } : {}),
  }
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function readBackupForExport(settings?: BackupSettings): { text: string | null; error: string | null } {
  const problemResult = loadProblems()
  const attemptResult = loadRecallAttempts()
  const draftResult = loadPracticeDrafts()
  if (problemResult.error || attemptResult.error || draftResult.error) {
    return {
      text: null,
      error: [problemResult.error, attemptResult.error, draftResult.error].filter(Boolean).join(' '),
    }
  }

  try {
    return {
      text: createBackupText(problemResult.problems, attemptResult.attempts, new Date().toISOString(), settings, draftResult.drafts),
      error: null,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown export error.'
    return { text: null, error: `The backup could not be created. ${detail}` }
  }
}

export function replaceSavedData(backup: CoachBackup): string | null {
  const storage = window.localStorage
  const keys = [PROBLEMS_STORAGE_KEY, RECALL_ATTEMPTS_STORAGE_KEY]
  if (backup.settings) keys.push(PROFILE_STORAGE_KEY, THEME_STORAGE_KEY)
  if (backup.practiceDrafts) keys.push(PRACTICE_DRAFTS_STORAGE_KEY)
  const previousValues = new Map<string, string | null>()

  try {
    for (const key of keys) previousValues.set(key, storage.getItem(key))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `Existing browser data could not be read, so it was not replaced. ${detail}`
  }

  try {
    storage.setItem(PROBLEMS_STORAGE_KEY, JSON.stringify(backup.problems))
    storage.setItem(RECALL_ATTEMPTS_STORAGE_KEY, JSON.stringify(backup.recallAttempts))
    if (backup.settings) {
      storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(backup.settings.profile))
      storage.setItem(THEME_STORAGE_KEY, backup.settings.theme)
    }
    if (backup.practiceDrafts) {
      storage.setItem(PRACTICE_DRAFTS_STORAGE_KEY, JSON.stringify(backup.practiceDrafts))
    }
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    try {
      for (const [key, value] of previousValues) restoreStorageValue(storage, key, value)
      return `The backup could not be saved. Your previous data was restored. ${detail}`
    } catch (rollbackError) {
      const rollbackDetail = rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error.'
      return `The backup could not be saved and browser storage could not fully restore the previous data. Export or refresh immediately. Save error: ${detail} Restore error: ${rollbackDetail}`
    }
  }
}

function restoreStorageValue(storage: Storage, key: string, value: string | null) {
  if (value === null) storage.removeItem(key)
  else storage.setItem(key, value)
}

export function backupCounts(backup: CoachBackup): BackupCounts {
  return {
    problems: backup.problems.length,
    recallAttempts: backup.recallAttempts.length,
    practiceDrafts: backup.practiceDrafts?.length ?? 0,
  }
}
