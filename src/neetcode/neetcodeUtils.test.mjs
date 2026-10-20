import assert from 'node:assert/strict'
import test from 'node:test'
import { createStarterProblems } from '../problems/problemStorage.ts'
import { getNeetCodeCatalog } from './neetcodeUtils.ts'
import {
  filterNeetCodeProblems,
  getNeetCodeId,
  getNeetCodeProgress,
  syncNeetCodeProblems,
  validateNeetCodeCatalog,
} from './neetcodeUtils.ts'

const catalog = getNeetCodeCatalog()

test('verified catalog contains exactly 150 unique entries and valid source metadata', () => {
  const validation = validateNeetCodeCatalog()
  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.equal(validation.count, 150)
  assert.equal(new Set(catalog.map((entry) => entry.title)).size, 150)
  assert.equal(new Set(catalog.map(getNeetCodeId)).size, 150)
  assert.equal(validation.categories.length, 18)
  assert.ok(catalog.every((entry) => ['Easy', 'Medium', 'Hard'].includes(entry.difficulty)))
  assert.ok(catalog.every((entry) => new URL(entry.url).hostname === 'leetcode.com'))
  assert.ok(catalog.every((entry) => new URL(entry.neetcodeUrl).hostname === 'neetcode.io'))
})

test('category assignments match the source list distribution', () => {
  const counts = Object.fromEntries(catalog.reduce((totals, entry) => {
    totals.set(entry.topic, (totals.get(entry.topic) ?? 0) + 1)
    return totals
  }, new Map()))
  assert.deepEqual(counts, {
    'Arrays & Hashing': 9,
    'Two Pointers': 5,
    'Sliding Window': 6,
    Stack: 6,
    'Binary Search': 7,
    'Linked List': 11,
    Trees: 15,
    'Heap / Priority Queue': 7,
    Backtracking: 10,
    Tries: 3,
    Graphs: 13,
    'Advanced Graphs': 6,
    '1-D Dynamic Programming': 12,
    '2-D Dynamic Programming': 11,
    Greedy: 8,
    Intervals: 6,
    'Math & Geometry': 8,
    'Bit Manipulation': 7,
  })
})

test('catalog validation rejects duplicates, invalid categories, and unsupported links', () => {
  const duplicate = { ...catalog[0] }
  const invalid = {
    catalog: 'NeetCode 150',
    version: 1,
    verifiedEntryCount: 150,
    sourceReferences: [
      'https://neetcode.io/roadmap/',
      'https://github.com/krmanik/Anki-NeetCode/blob/main/neetcode-150-list.json',
    ],
    problems: [...catalog.slice(1), { ...duplicate, topic: 'Made-up topic', url: 'https://example.com/problem' }],
  }
  const result = validateNeetCodeCatalog(invalid)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('Unrecognized category')))
  assert.ok(result.errors.some((error) => error.includes('Invalid LeetCode link')))
})

test('catalog sync links existing problems without losing their notes and is idempotent', () => {
  const existing = createStarterProblems()
  existing[0].javaNotes = 'My personal Java note'
  const first = syncNeetCodeProblems(existing)
  assert.equal(first.error, null)
  assert.equal(first.added, 147)
  assert.equal(first.linked, 3)
  assert.equal(first.problems.length, 150)
  const twoSum = first.problems.find((problem) => problem.title === 'Two Sum')
  assert.equal(twoSum.id, 'example-two-sum')
  assert.equal(twoSum.neetcodeId, getNeetCodeId(catalog.find((entry) => entry.title === 'Two Sum')))
  assert.equal(twoSum.javaNotes, 'My personal Java note')

  const progressRecord = { ...twoSum, neetcodeStatus: 'Solved Independently', neetcodeConfidence: 4 }
  const withProgress = first.problems.map((problem) => problem.id === progressRecord.id ? progressRecord : problem)
  const second = syncNeetCodeProblems(withProgress)
  assert.equal(second.error, null)
  assert.equal(second.added, 0)
  assert.equal(second.problems.length, 150)
  assert.equal(second.problems.find((problem) => problem.id === twoSum.id).neetcodeStatus, 'Solved Independently')
  assert.equal(second.problems.find((problem) => problem.id === twoSum.id).javaNotes, 'My personal Java note')
})

test('progress uses saved statuses and category/difficulty counts from real catalog groups', () => {
  const entries = catalog.slice(0, 4)
  const records = entries.map((entry, index) => ({
    id: getNeetCodeId(entry),
    neetcodeId: getNeetCodeId(entry),
    neetcodeTopic: entry.topic,
    neetcodeStatus: ['Solved Independently', 'Solved With Help', 'Attempted', 'Needs Revision'][index],
    title: entry.title,
  }))
  const progress = getNeetCodeProgress(entries, records)
  assert.equal(progress.total, 4)
  assert.equal(progress.completed, 2)
  assert.equal(progress.attempted, 4)
  assert.equal(progress.needsRevision, 1)
  assert.equal(progress.notAttempted, 0)
  assert.deepEqual(progress.byDifficulty.reduce((sum, item) => sum + item.total, 0), 4)
})

test('search, topic, difficulty, status filters and sort modes use catalog order and real status', () => {
  const records = catalog.map((entry) => ({
    id: getNeetCodeId(entry),
    neetcodeId: getNeetCodeId(entry),
    neetcodeStatus: entry.title === 'Two Sum' ? 'Attempted' : 'Not Started',
    title: entry.title,
  }))
  const titleMatches = filterNeetCodeProblems(catalog, records, {
    query: 'two sum', topic: '', difficulty: '', status: '', sort: 'recommended',
  })
  assert.deepEqual(titleMatches.map((entry) => entry.title), ['Two Sum', 'Two Sum II Input Array Is Sorted'])
  const filtered = filterNeetCodeProblems(catalog, records, {
    query: '', topic: 'Arrays & Hashing', difficulty: 'Easy', status: 'Attempted', sort: 'title',
  })
  assert.deepEqual(filtered.map((entry) => entry.title), ['Two Sum'])
  const sortedByDifficulty = filterNeetCodeProblems(catalog, records, {
    query: '', topic: '', difficulty: '', status: '', sort: 'difficulty',
  })
  assert.ok(sortedByDifficulty.findIndex((entry) => entry.difficulty === 'Medium') <
    sortedByDifficulty.findIndex((entry) => entry.difficulty === 'Hard'))
})
