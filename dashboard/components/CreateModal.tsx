'use client'

import { FormEvent, ReactNode } from 'react'

interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
  submitLabel?: string
}

export default function CreateModal({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitLabel = 'Create'
}: CreateModalProps) {
  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await onSubmit(e)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-white/10 bg-slate-950/90 shadow-[0_34px_120px_rgba(0,0,0,0.58)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-6 py-4 backdrop-blur-xl">
          <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {children}
          
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="ops-button-secondary px-5 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ops-button-primary px-5 py-2 text-sm"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
