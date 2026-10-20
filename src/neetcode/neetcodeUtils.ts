import { neetcode150Catalog } from './neetcode150Catalog.ts'
import type { Confidence, Difficulty, NeetCodeStatus, Problem } from '../problems/problemTypes'

export interface NeetCodeCatalogEntry {
  topic: string
  title: string
  difficulty: Difficulty
  url: string
  neetcodeUrl: string
}

interface NeetCodeCatalog {
  catalog: string
  version: number
  verifiedEntryCount: number
  sourceReferences: readonly string[]
  problems: readonly NeetCodeCatalogEntry[]
}

export const NEETCODE_TOPICS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Heap / Priority Queue',
  'Backtracking',
  'Tries',
  'Graphs',
  'Advanced Graphs',
  '1-D Dynamic Programming',
  '2-D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Math & Geometry',
  'Bit Manipulation',
] as const

export const NEETCODE_STATUSES: NeetCodeStatus[] = [
  'Not Started',
  'Attempted',
  'Solved With Help',
  'Solved Independently',
  'Needs Revision',
]

const difficultyOrder: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 }
const solvedStatuses: NeetCodeStatus[] = ['Solved With Help', 'Solved Independently']
const catalog: NeetCodeCatalog = neetcode150Catalog

export function getNeetCodeId(entry: NeetCodeCatalogEntry): string {
  const slug = `${entry.topic}-${entry.title}`
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `nc150-${slug}`
}

function isValidHttpUrl(value: string, hostname: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === hostname
  } catch {
    return false
  }
}

export function validateNeetCodeCatalog(value: unknown = catalog): {
  valid: boolean
  count: number
  categories: string[]
  errors: string[]
} {
  const errors: string[] = []
  if (typeof value !== 'object' || value === null) {
    return { valid: false, count: 0, categories: [], errors: ['The NeetCode catalog is not an object.'] }
  }

  const candidate = value as Partial<NeetCodeCatalog>
  const entries = candidate.problems
  if (!Array.isArray(entries)) {
    return { valid: false, count: 0, categories: [], errors: ['The NeetCode catalog has no problem list.'] }
  }
  const categories = [...new Set(entries.map((entry) => entry.topic))]
  const titles = new Set<string>()
  const ids = new Set<string>()

  if (candidate.catalog !== 'NeetCode 150' || candidate.version !== 1) {
    errors.push('The catalog identity or version is not supported.')
  }
  if (candidate.verifiedEntryCount !== 150 || entries.length !== 150) {
    errors.push(`Expected exactly 150 entries; found ${entries.length}.`)
  }
  if (!Array.isArray(candidate.sourceReferences) ||
    !candidate.sourceReferences.includes('https://neetcode.io/roadmap/') ||
    !candidate.sourceReferences.includes('https://github.com/krmanik/Anki-NeetCode/blob/main/neetcode-150-list.json')) {
    errors.push('Required catalog source references are missing.')
  }

  for (const entry of entries) {
    if (!entry || typeof entry.title !== 'string' || !entry.title.trim()) {
      errors.push('A catalog entry has a missing title.')
      continue
    }
    const normalizedTitle = entry.title.trim().toLocaleLowerCase()
    if (titles.has(normalizedTitle)) errors.push(`Duplicate title: ${entry.title}.`)
    titles.add(normalizedTitle)

    if (!NEETCODE_TOPICS.includes(entry.topic as (typeof NEETCODE_TOPICS)[number])) {
      errors.push(`Unrecognized category for ${entry.title}: ${entry.topic}.`)
    }
    if (!['Easy', 'Medium', 'Hard'].includes(entry.difficulty)) {
      errors.push(`Unrecognized difficulty for ${entry.title}.`)
    }
    if (!isValidHttpUrl(entry.url, 'leetcode.com') ||
      !/^\/problems\/[a-z0-9-]+\/$/.test(new URL(entry.url).pathname)) {
      errors.push(`Invalid LeetCode link for ${entry.title}.`)
    }
    if (!isValidHttpUrl(entry.neetcodeUrl, 'neetcode.io') ||
      !new URL(entry.neetcodeUrl).pathname.startsWith('/problems/')) {
      errors.push(`Invalid NeetCode link for ${entry.title}.`)
    } else if (new URL(entry.neetcodeUrl).searchParams.get('list') !== 'neetcode150') {
      errors.push(`NeetCode link is not tagged for the NeetCode 150 list: ${entry.title}.`)
    }
    const id = getNeetCodeId(entry)
    if (ids.has(id)) errors.push(`Duplicate stable catalog ID: ${id}.`)
    ids.add(id)
  }

  return { valid: errors.length === 0, count: entries.length, categories, errors }
}

export function getNeetCodeCatalog(): NeetCodeCatalogEntry[] {
  return [...catalog.problems]
}

export function syncNeetCodeProblems(
  problems: Problem[],
  entries = getNeetCodeCatalog(),
  createdAt = new Date().toISOString().slice(0, 10),
): { problems: Problem[]; added: number; linked: number; error: string | null } {
  const catalogCheck = validateNeetCodeCatalog(catalog)
  if (!catalogCheck.valid) {
    return { problems, added: 0, linked: 0, error: catalogCheck.errors.join(' ') }
  }

  const next = [...problems]
  const usedProblemIds = new Set<string>()
  let added = 0
  let linked = 0

  for (const entry of entries) {
    const neetcodeId = getNeetCodeId(entry)
    const byId = next.filter((problem) => problem.neetcodeId === neetcodeId)
    const title = entry.title.trim().toLocaleLowerCase()
    const url = new URL(entry.url).pathname.replace(/\/$/, '')
    const byIdentity = next.filter((problem) => (
      problem.title.trim().toLocaleLowerCase() === title ||
      (() => {
        try {
          const savedUrl = new URL(problem.url)
          return savedUrl.hostname === 'leetcode.com' &&
            savedUrl.pathname.replace(/\/$/, '') === url
        } catch {
          return false
        }
      })()
    ))
    const matches = [...new Map([...byId, ...byIdentity].map((problem) => [problem.id, problem])).values()]
    if (matches.length > 1 || (matches[0]?.neetcodeId && matches[0].neetcodeId !== neetcodeId)) {
      return {
        problems,
        added: 0,
        linked: 0,
        error: `Could not safely link "${entry.title}" because multiple or conflicting problem records exist. Resolve the duplicate in My Problems, then reload this tracker.`,
      }
    }

    const existing = matches[0]
    if (existing) {
      if (usedProblemIds.has(existing.id)) {
        return {
          problems,
          added: 0,
          linked: 0,
          error: `The problem record "${existing.title}" matches more than one catalog entry. No catalog changes were saved.`,
        }
      }
      usedProblemIds.add(existing.id)
      const index = next.findIndex((problem) => problem.id === existing.id)
      next[index] = {
        ...existing,
        url: entry.url,
        difficulty: entry.difficulty,
        topic: entry.topic,
        neetcodeId,
        neetcodeTopic: entry.topic,
        neetcodeStatus: existing.neetcodeStatus ?? 'Not Started',
      }
      linked += 1
      continue
    }

    next.push({
      id: neetcodeId,
      title: entry.title,
      url: entry.url,
      difficulty: entry.difficulty,
      topic: entry.topic,
      pattern: '',
      statement: 'Open the linked original problem for its full statement. The tracker does not copy the original prompt.',
      approach: '',
      algorithm: '',
      javaNotes: '',
      timeComplexity: '',
      spaceComplexity: '',
      mistakes: '',
      hints: '',
      confidence: null,
      createdAt,
      lastReviewedAt: null,
      isExample: false,
      neetcodeId,
      neetcodeTopic: entry.topic,
      neetcodeStatus: 'Not Started',
      neetcodeConfidence: null,
      neetcodeEdgeCases: '',
      neetcodeReflection: '',
    })
    added += 1
  }

  if (new Set(next.map((problem) => problem.neetcodeId).filter(Boolean)).size !== entries.length) {
    return { problems, added: 0, linked: 0, error: 'Catalog synchronization did not result in exactly 150 unique shared problem records.' }
  }
  return { problems: next, added, linked, error: null }
}

export interface NeetCodeProgress {
  total: number
  completed: number
  attempted: number
  needsRevision: number
  notAttempted: number
  byTopic: Array<{ topic: string; total: number; completed: number }>
  byDifficulty: Array<{ difficulty: Difficulty; total: number; completed: number }>
}

export function getNeetCodeProgress(
  entries: NeetCodeCatalogEntry[],
  records: Problem[],
): NeetCodeProgress {
  const recordById = new Map(records.filter((problem) => problem.neetcodeId).map((problem) => [problem.neetcodeId!, problem]))
  const completedCount = (subset: NeetCodeCatalogEntry[]) => subset.filter((entry) => {
    const status = recordById.get(getNeetCodeId(entry))?.neetcodeStatus ?? 'Not Started'
    return solvedStatuses.includes(status)
  }).length

  return {
    total: entries.length,
    completed: completedCount(entries),
    attempted: entries.filter((entry) => ['Attempted', 'Solved With Help', 'Solved Independently', 'Needs Revision'].includes(
      recordById.get(getNeetCodeId(entry))?.neetcodeStatus ?? 'Not Started',
    )).length,
    needsRevision: entries.filter((entry) => recordById.get(getNeetCodeId(entry))?.neetcodeStatus === 'Needs Revision').length,
    notAttempted: entries.filter((entry) => (
      (recordById.get(getNeetCodeId(entry))?.neetcodeStatus ?? 'Not Started') === 'Not Started'
    )).length,
    byTopic: [...new Set(entries.map((entry) => entry.topic))].map((topic) => {
      const topicEntries = entries.filter((entry) => entry.topic === topic)
      return { topic, total: topicEntries.length, completed: completedCount(topicEntries) }
    }),
    byDifficulty: (['Easy', 'Medium', 'Hard'] as const).map((difficulty) => {
      const difficultyEntries = entries.filter((entry) => entry.difficulty === difficulty)
      return { difficulty, total: difficultyEntries.length, completed: completedCount(difficultyEntries) }
    }),
  }
}

export function filterNeetCodeProblems(
  entries: NeetCodeCatalogEntry[],
  records: Problem[],
  filters: { query: string; topic: string; difficulty: string; status: string; sort: 'recommended' | 'title' | 'difficulty' },
): NeetCodeCatalogEntry[] {
  const recordById = new Map(records.filter((problem) => problem.neetcodeId).map((problem) => [problem.neetcodeId!, problem]))
  const query = filters.query.trim().toLocaleLowerCase()
  const filtered = entries.filter((entry) => {
    const status = recordById.get(getNeetCodeId(entry))?.neetcodeStatus ?? 'Not Started'
    return (!query || entry.title.toLocaleLowerCase().includes(query)) &&
      (!filters.topic || entry.topic === filters.topic) &&
      (!filters.difficulty || entry.difficulty === filters.difficulty) &&
      (!filters.status || status === filters.status)
  })
  if (filters.sort === 'title') return filtered.sort((first, second) => first.title.localeCompare(second.title))
  if (filters.sort === 'difficulty') {
    return filtered.sort((first, second) =>
      difficultyOrder[first.difficulty] - difficultyOrder[second.difficulty] ||
      first.title.localeCompare(second.title),
    )
  }
  return filtered
}

export function confidenceValue(value: string): Confidence | null {
  if (value === '') return null
  const rating = Number(value)
  return rating === 1 || rating === 2 || rating === 3 || rating === 4 || rating === 5 ? rating : null
}
