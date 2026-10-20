import assert from 'node:assert/strict'
import test from 'node:test'
import { createStarterProblems } from '../problems/problemStorage.ts'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackupText,
  parseBackup,
  THEME_STORAGE_KEY,
  replaceSavedData,
} from './backupStorage.ts'
import { PROBLEMS_STORAGE_KEY } from '../problems/problemStorage.ts'
import { PROFILE_STORAGE_KEY } from './profileStorage.ts'
import { RECALL_ATTEMPTS_STORAGE_KEY } from '../recall/recallStorage.ts'
import { PRACTICE_DRAFTS_STORAGE_KEY } from '../practice/practiceStorage.ts'

const attempt = {
  id: 'attempt-1',
  problemId: 'example-two-sum',
  problemTitle: 'Two Sum',
  attemptedAt: '2026-10-19T10:00:00.000Z',
  outcome: 'Solved independently',
  confidence: 5,
  reflection: 'Remember the complement lookup.',
  answers: {
    pattern: 'Hash Map',
    approach: 'Track prior values.',
    algorithm: 'Scan and look up the complement.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    edgeCases: 'No reuse.',
    testInputs: 'nums=[2,7], target=9',
  },
  nextReviewDate: '2026-11-02',
  reviewIntervalDays: 14,
  consecutiveHighConfidenceRecalls: 2,
}

function validBackup() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-10-19T10:00:00.000Z',
    problems: createStarterProblems(),
    recallAttempts: [attempt],
  }
}

test('backup exports and parses problems, attempts, and scheduling metadata intact', () => {
  const backup = validBackup()
  const parsed = parseBackup(createBackupText(backup.problems, backup.recallAttempts, backup.exportedAt))

  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.backup, backup)
  assert.equal(parsed.backup.recallAttempts[0].nextReviewDate, '2026-11-02')
  assert.equal(parsed.backup.recallAttempts[0].reviewIntervalDays, 14)
  assert.equal(parsed.backup.recallAttempts[0].consecutiveHighConfidenceRecalls, 2)
})

test('backup validation gives clear errors for invalid JSON and unsupported versions', () => {
  assert.match(parseBackup('{bad').error, /not valid JSON/)
  const unsupported = { ...validBackup(), version: 2 }
  assert.match(parseBackup(JSON.stringify(unsupported)).error, /version 2 is not supported/)
})

test('backup validation rejects malformed problem and recall scheduling records', () => {
  const badProblem = validBackup()
  badProblem.problems[0] = { ...badProblem.problems[0], createdAt: '2026-02-30' }
  assert.match(parseBackup(JSON.stringify(badProblem)).error, /invalid problem record/)

  const badAttempt = validBackup()
  badAttempt.recallAttempts[0] = { ...attempt, nextReviewDate: '2026-10-40' }
  assert.match(parseBackup(JSON.stringify(badAttempt)).error, /invalid recall or scheduling record/)
})

test('backup validation rejects duplicate IDs and unknown envelope fields', () => {
  const duplicate = validBackup()
  duplicate.recallAttempts.push({ ...attempt })
  assert.match(parseBackup(JSON.stringify(duplicate)).error, /duplicate record IDs/)

  const unsupportedField = { ...validBackup(), extra: 'not part of version one' }
  assert.match(parseBackup(JSON.stringify(unsupportedField)).error, /unsupported fields/)
})

test('backup validation rejects unknown problem, attempt, and answer fields', () => {
  const problemWithExtra = validBackup()
  problemWithExtra.problems[0] = { ...problemWithExtra.problems[0], extra: 'unsupported' }
  assert.match(parseBackup(JSON.stringify(problemWithExtra)).error, /invalid problem record/)

  const attemptWithExtra = validBackup()
  attemptWithExtra.recallAttempts[0] = { ...attempt, extra: 'unsupported' }
  assert.match(
    parseBackup(JSON.stringify(attemptWithExtra)).error,
    /invalid recall or scheduling record/,
  )

  const answerWithExtra = validBackup()
  answerWithExtra.recallAttempts[0] = {
    ...attempt,
    answers: { ...attempt.answers, extra: 'unsupported' },
  }
  assert.match(
    parseBackup(JSON.stringify(answerWithExtra)).error,
    /invalid recall or scheduling record/,
  )

  const legacyAnswerShape = validBackup()
  delete legacyAnswerShape.recallAttempts[0].answers.testInputs
  assert.equal(parseBackup(JSON.stringify(legacyAnswerShape)).error, null)
})

test('empty backup arrays are valid and do not invent saved records', () => {
  const empty = {
    ...validBackup(),
    problems: [],
    recallAttempts: [],
  }
  const parsed = parseBackup(JSON.stringify(empty))
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.backup.problems, [])
  assert.deepEqual(parsed.backup.recallAttempts, [])
})

test('backup round-trips profile and theme preferences and rejects malformed settings', () => {
  const backup = validBackup()
  const practiceDraft = {
    problemId: 'example-two-sum',
    phase: 'approach',
    answers: {
      pattern: 'Hash Map',
      approach: 'Remember prior values.',
      algorithm: '',
      timeComplexity: '',
      spaceComplexity: '',
      edgeCases: '',
    },
    hintRevealed: false,
    solutionRevealed: false,
    outcome: null,
    confidence: null,
    forgot: '',
    remember: '',
    savedAt: '2026-10-20T00:00:00.000Z',
  }
  const settings = {
    profile: { displayName: 'Ada', learningGoal: 'Prepare for SDE interviews' },
    theme: 'light',
  }
  const parsed = parseBackup(createBackupText(
    backup.problems,
    backup.recallAttempts,
    backup.exportedAt,
    settings,
    [practiceDraft],
  ))
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.backup.settings, settings)
  assert.deepEqual(parsed.backup.practiceDrafts, [practiceDraft])

  const invalid = { ...backup, settings: { profile: { displayName: 'Ada', learningGoal: '' }, theme: 'blue' } }
  assert.match(parseBackup(JSON.stringify(invalid)).error, /invalid profile or theme settings/)
  const invalidDraft = { ...backup, practiceDrafts: [{ ...practiceDraft, unknown: true }] }
  assert.match(parseBackup(JSON.stringify(invalidDraft)).error, /invalid or duplicate practice draft/)
})

test('confirmed data replacement restores profile and theme alongside study records', () => {
  const values = new Map()
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  }
  try {
    const backup = {
      ...validBackup(),
      settings: {
        profile: { displayName: 'Ada', learningGoal: 'Java interview prep' },
        theme: 'light',
      },
      practiceDrafts: [{
        problemId: 'example-two-sum',
        phase: 'approach',
        answers: {
          pattern: '',
          approach: '',
          algorithm: '',
          timeComplexity: '',
          spaceComplexity: '',
          edgeCases: '',
        },
        hintRevealed: false,
        solutionRevealed: false,
        outcome: null,
        confidence: null,
        forgot: '',
        remember: '',
        savedAt: '2026-10-20T00:00:00.000Z',
      }],
    }
    assert.equal(replaceSavedData(backup), null)
    assert.deepEqual(JSON.parse(values.get(PROBLEMS_STORAGE_KEY)), backup.problems)
    assert.deepEqual(JSON.parse(values.get(RECALL_ATTEMPTS_STORAGE_KEY)), backup.recallAttempts)
    assert.deepEqual(JSON.parse(values.get(PROFILE_STORAGE_KEY)), backup.settings.profile)
    assert.equal(values.get(THEME_STORAGE_KEY), 'light')
    assert.deepEqual(JSON.parse(values.get(PRACTICE_DRAFTS_STORAGE_KEY)), backup.practiceDrafts)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
