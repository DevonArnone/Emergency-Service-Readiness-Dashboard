'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    error: 'border-red-400/30 bg-red-500/20 text-red-100 shadow-[0_18px_60px_rgba(239,68,68,0.18)]',
    warning: 'border-amber-400/30 bg-amber-500/20 text-amber-100 shadow-[0_18px_60px_rgba(245,158,11,0.16)]',
    info: 'border-sky-400/30 bg-sky-500/20 text-sky-100 shadow-[0_18px_60px_rgba(14,165,233,0.16)]',
    success: 'border-emerald-400/30 bg-emerald-500/20 text-emerald-100 shadow-[0_18px_60px_rgba(16,185,129,0.16)]',
  }

  const icons = {
    error: 'M12 9v3.75m0 3h.007M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z',
    warning: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 0h.008v.008H12V15Z',
    info: 'M11.25 11.25h1.5v5.25h-1.5V11.25Zm0-3h1.5v1.5h-1.5v-1.5ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    success: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  }

  return (
    <div
      className={`${colors[type]} mb-3 flex items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-xl transition-all`}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 bg-white/10">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={icons[type]} />
        </svg>
      </span>
      <span className="flex-1 text-sm font-semibold leading-5">{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="rounded-full p-1 text-current/70 transition-colors hover:bg-white/20 hover:text-current"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
