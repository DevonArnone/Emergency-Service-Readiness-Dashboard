'use client'

import Toast from './Toast'

export interface ToastMessage {
  id: string
  message: string
  type: 'error' | 'warning' | 'info' | 'success'
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-24 z-50 w-[calc(100%-2rem)] max-w-md space-y-2 lg:top-4">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}
