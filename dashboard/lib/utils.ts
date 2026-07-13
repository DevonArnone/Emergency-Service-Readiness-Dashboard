import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import clsx, { type ClassValue } from 'clsx'

export function cn(...values: ClassValue[]) {
  return clsx(values)
}

export function formatDate(value?: string | null, pattern = 'MMM d, yyyy') {
  if (!value) return 'Not set'
  const date = parseISO(value)
  return isValid(date) ? format(date, pattern) : 'Not set'
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return 'Not recorded'
  const date = parseISO(value)
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Not recorded'
}

export function titleCase(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
