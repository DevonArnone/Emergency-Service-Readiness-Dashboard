'use client'

import { useState, type ReactNode } from 'react'
import FormDialog from './FormDialog'
import { WriteButton } from './ui'

export default function ConfirmAction({ title, description, children, onConfirm, disabled, className }: {
  title: string; description: string; children: ReactNode; onConfirm: () => Promise<unknown>
  disabled?: boolean; className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  return <>
    <WriteButton variant="danger" className={className} disabled={disabled} onClick={() => { setError(undefined); setOpen(true) }}>{children}</WriteButton>
    <FormDialog open={open} onOpenChange={setOpen} title={title} description={description} submitLabel="Confirm action" submitting={busy} error={error} onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      try { await onConfirm(); setOpen(false) } catch (failure) { setError(failure instanceof Error ? failure.message : 'The action could not be completed.') } finally { setBusy(false) }
    }}><p className="confirmation-copy">Review the selected record before continuing. This action will be recorded in the activity history.</p></FormDialog>
  </>
}
