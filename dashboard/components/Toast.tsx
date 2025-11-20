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
    error: 'bg-red-500 border-red-600',
    warning: 'bg-orange-500 border-orange-600',
    info: 'bg-blue-500 border-blue-600',
    success: 'bg-green-500 border-green-600',
  }

  const icons = {
    error: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
    success: '✅',
  }

  return (
    <div
      className={`${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl border-2 mb-3 flex items-center space-x-3 animate-slide-in transform transition-all`}
    >
      <span className="text-2xl">{icons[type]}</span>
      <span className="flex-1 font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
      >
        <span className="text-xl">✕</span>
      </button>
    </div>
  )
}

