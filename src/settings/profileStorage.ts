export const PROFILE_STORAGE_KEY = 'dsa-recall-coach.profile.v1'

export interface UserProfile {
  displayName: string
  learningGoal: string
}

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  learningGoal: '',
}

export function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const profile = value as Record<string, unknown>
  return Object.keys(profile).every((key) => key === 'displayName' || key === 'learningGoal') &&
    typeof profile.displayName === 'string' &&
    profile.displayName.length <= 60 &&
    typeof profile.learningGoal === 'string' &&
    profile.learningGoal.length <= 200
}

export function loadProfile(): { profile: UserProfile; error: string | null } {
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (stored === null) return { profile: DEFAULT_PROFILE, error: null }
    const parsed: unknown = JSON.parse(stored)
    if (!isUserProfile(parsed)) throw new Error('Saved profile data has an unsupported format.')
    return { profile: parsed, error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return { profile: DEFAULT_PROFILE, error: `Profile could not be loaded from browser storage. ${detail}` }
  }
}

export function saveProfile(profile: UserProfile): string | null {
  if (typeof profile.displayName !== 'string' || !profile.displayName.trim() || profile.displayName.length > 60) {
    return 'Enter a display name of 1 to 60 characters.'
  }
  if (typeof profile.learningGoal !== 'string' || profile.learningGoal.length > 200) {
    return 'Keep the learning goal within 200 characters.'
  }
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
      displayName: profile.displayName.trim(),
      learningGoal: profile.learningGoal.trim(),
    }))
    return null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown storage error.'
    return `Profile could not be saved to browser storage. ${detail}`
  }
}
