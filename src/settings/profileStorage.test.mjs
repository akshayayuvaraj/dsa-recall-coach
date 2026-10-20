import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_PROFILE,
  isUserProfile,
  loadProfile,
  PROFILE_STORAGE_KEY,
  saveProfile,
} from './profileStorage.ts'

function withLocalStorage(run) {
  const values = new Map()
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  }
  try {
    run(values)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('profile storage starts with safe defaults and persists trimmed profile values', () => {
  withLocalStorage((values) => {
    assert.deepEqual(loadProfile(), { profile: DEFAULT_PROFILE, error: null })
    assert.equal(saveProfile({ displayName: '  Ada  ', learningGoal: ' Java interviews ' }), null)
    assert.deepEqual(loadProfile(), {
      profile: { displayName: 'Ada', learningGoal: 'Java interviews' },
      error: null,
    })
    assert.equal(values.has(PROFILE_STORAGE_KEY), true)
  })
})

test('profile storage rejects empty names and malformed saved data', () => {
  withLocalStorage((values) => {
    assert.match(saveProfile({ displayName: ' ', learningGoal: '' }), /display name/)
    assert.equal(isUserProfile({ displayName: 'Ada', learningGoal: '', extra: true }), false)
    values.set(PROFILE_STORAGE_KEY, '{bad json')
    assert.match(loadProfile().error, /could not be loaded/)
  })
})
