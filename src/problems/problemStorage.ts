import type { Confidence, Difficulty, NeetCodeStatus, Problem } from './problemTypes'
import { isValidLocalDate } from '../recall/scheduler.ts'

export const PROBLEMS_STORAGE_KEY = 'dsa-recall-coach.problems.v1'

const today = () => {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function createStarterProblems(): Problem[] {
  const createdAt = today()

  return [
    {
      id: 'example-two-sum',
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
      topic: 'Arrays & Hashing',
      pattern: 'Hash Map',
      statement:
        'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Each input has exactly one solution, and you may not use the same element twice.',
      approach:
        'Store each visited number and its index in a hash map. For each value, look for the complement needed to reach the target before storing the current value.',
      algorithm:
        '1. Create a map from number to its index.\n2. For each index i, compute target - nums[i].\n3. If the complement is in the map, return its index and i.\n4. Otherwise store nums[i] with index i.',
      javaNotes:
        'Use Map<Integer, Integer> for value-to-index lookups. Check for the complement before inserting the current number so an element is not reused.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      mistakes:
        'Returning values instead of indices; using the same array element twice; inserting the current number before checking its complement.',
      hints:
        'What value would pair with the current number to make the target? Can you remember values you have already seen?',
      confidence: null,
      createdAt,
      lastReviewedAt: null,
      isExample: true,
    },
    {
      id: 'example-contains-duplicate',
      title: 'Contains Duplicate',
      url: 'https://leetcode.com/problems/contains-duplicate/',
      difficulty: 'Easy',
      topic: 'Arrays & Hashing',
      pattern: 'Hash Set',
      statement:
        'Given an integer array nums, return true if any value appears at least twice, and return false if every element is distinct.',
      approach:
        'Track values in a set while scanning the array. A value already present in the set is a duplicate.',
      algorithm:
        '1. Create an empty set.\n2. Visit each number in nums.\n3. If the set already contains the number, return true.\n4. Add the number to the set.\n5. Return false after the scan finishes.',
      javaNotes:
        'Use HashSet<Integer>. HashSet.add returns false when the value is already present, which can combine the lookup and insertion.',
      timeComplexity: 'O(n) average',
      spaceComplexity: 'O(n)',
      mistakes:
        'Sorting the input in place when mutation is undesirable; overlooking empty or single-element arrays; using nested loops unnecessarily.',
      hints:
        'What data structure gives a fast membership check while you scan the array once?',
      confidence: null,
      createdAt,
      lastReviewedAt: null,
      isExample: true,
    },
    {
      id: 'example-best-time-stock',
      title: 'Best Time to Buy and Sell Stock',
      url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
      difficulty: 'Easy',
      topic: 'Arrays',
      pattern: 'Sliding Window',
      statement:
        'Given an array prices where prices[i] is the price of a stock on day i, choose one day to buy and a later day to sell. Return the maximum possible profit, or 0 if no profit is possible.',
      approach:
        'Scan once while tracking the lowest price seen so far and the best profit achievable by selling at the current price.',
      algorithm:
        '1. Set the minimum price to the first price and the best profit to 0.\n2. For each later price, update the best profit using price - minimum price.\n3. Update the minimum price if the current price is lower.\n4. Return the best profit.',
      javaNotes:
        'Keep minPrice and maxProfit as integers and update maxProfit before replacing minPrice on each iteration.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      mistakes:
        'Selling before buying; treating a loss as a positive profit; forgetting that no profitable transaction returns 0.',
      hints:
        'For each selling day, what is the cheapest earlier buy price you have seen?',
      confidence: null,
      createdAt,
      lastReviewedAt: null,
      isExample: true,
    },
  ]
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'Easy' || value === 'Medium' || value === 'Hard'
}

function isConfidence(value: unknown): value is Confidence | null {
  return value === null || value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

const neetcodeStatuses: NeetCodeStatus[] = [
  'Not Started',
  'Attempted',
  'Solved With Help',
  'Solved Independently',
  'Needs Revision',
]

export function isProblemRecord(value: unknown): value is Problem {
  if (typeof value !== 'object' || value === null) return false

  const problem = value as Record<string, unknown>
  const textFields = [
    'id',
    'title',
    'url',
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
    'createdAt',
  ]

  return (
    textFields.every((field) => typeof problem[field] === 'string') &&
    isDifficulty(problem.difficulty) &&
    isConfidence(problem.confidence) &&
    (problem.neetcodeId === undefined || (typeof problem.neetcodeId === 'string' && problem.neetcodeId.trim().length > 0)) &&
    (problem.neetcodeTopic === undefined || typeof problem.neetcodeTopic === 'string') &&
    (problem.neetcodeStatus === undefined || (typeof problem.neetcodeStatus === 'string' && neetcodeStatuses.includes(problem.neetcodeStatus as NeetCodeStatus))) &&
    (problem.neetcodeFirstAttemptedAt === undefined || problem.neetcodeFirstAttemptedAt === null ||
      (typeof problem.neetcodeFirstAttemptedAt === 'string' && isValidLocalDate(problem.neetcodeFirstAttemptedAt))) &&
    (problem.neetcodeLastSolvedAt === undefined || problem.neetcodeLastSolvedAt === null ||
      (typeof problem.neetcodeLastSolvedAt === 'string' && isValidLocalDate(problem.neetcodeLastSolvedAt))) &&
    (problem.neetcodeConfidence === undefined || isConfidence(problem.neetcodeConfidence)) &&
    (problem.neetcodeEdgeCases === undefined || typeof problem.neetcodeEdgeCases === 'string') &&
    (problem.neetcodeReflection === undefined || typeof problem.neetcodeReflection === 'string') &&
    typeof problem.createdAt === 'string' &&
    isValidLocalDate(problem.createdAt) &&
    (problem.lastReviewedAt === null ||
      (typeof problem.lastReviewedAt === 'string' && isValidLocalDate(problem.lastReviewedAt))) &&
    typeof problem.isExample === 'boolean'
  )
}

export function loadProblems(): { problems: Problem[]; error: string | null } {
  try {
    const stored = window.localStorage.getItem(PROBLEMS_STORAGE_KEY)
    if (stored === null) {
      const examples = createStarterProblems()
      window.localStorage.setItem(PROBLEMS_STORAGE_KEY, JSON.stringify(examples))
      return { problems: examples, error: null }
    }

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isProblemRecord)) {
      throw new Error('Saved problem data has an unsupported format.')
    }

    return { problems: parsed, error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return {
      problems: [],
      error: `Problems could not be loaded from browser storage. ${detail}`,
    }
  }
}

export function saveProblems(problems: Problem[]): string | null {
  try {
    window.localStorage.setItem(PROBLEMS_STORAGE_KEY, JSON.stringify(problems))
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `Changes could not be saved to browser storage. ${detail}`
  }
}

export function dateForDisplay(value: string | null): string {
  if (!value) return 'Not reviewed'
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
