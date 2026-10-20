import { addLocalDays, formatLocalDate } from '../recall/scheduler.ts'

export function startOfMonth(date: Date): Date {
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot create a calendar from an invalid date.')
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function shiftMonth(date: Date, amount: number): Date {
  if (!Number.isInteger(amount)) throw new RangeError('Month navigation must use whole numbers.')
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot navigate from an invalid date.')
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function shiftWeek(date: Date, amount: number): Date {
  if (!Number.isInteger(amount)) throw new RangeError('Week navigation must use whole numbers.')
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot navigate from an invalid date.')
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  shifted.setDate(shifted.getDate() + amount * 7)
  return shifted
}

export function startOfWeek(date: Date): Date {
  if (Number.isNaN(date.getTime())) throw new RangeError('Cannot create a calendar from an invalid date.')
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayOffset = (localDate.getDay() + 6) % 7
  localDate.setDate(localDate.getDate() - mondayOffset)
  return localDate
}

export function getMonthGrid(date: Date): Date[] {
  const firstDay = startOfMonth(date)
  const gridStart = startOfWeek(firstDay)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const leadingDays = (firstDay.getDay() + 6) % 7
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => addLocalDays(gridStart, index))
}

export function getWeekDays(date: Date): Date[] {
  const firstDay = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addLocalDays(firstDay, index))
}

export function sameLocalMonth(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth()
}

export function monthLabel(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

export function weekLabel(days: Date[], locale?: string): string {
  if (days.length !== 7) throw new RangeError('A calendar week must contain seven days.')
  const first = days[0]
  const last = days[6]
  const sameYear = first.getFullYear() === last.getFullYear()
  const start = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(first)
  const end = new Intl.DateTimeFormat(locale, {
    month: first.getMonth() === last.getMonth() ? undefined : 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(last)
  return `${start} – ${end}${sameYear ? `, ${last.getFullYear()}` : ''}`
}

export function localDateKey(date: Date): string {
  return formatLocalDate(date)
}
