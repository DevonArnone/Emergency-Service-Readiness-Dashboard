'use client'

import { useState, type ReactNode } from 'react'
import FormDialog from './FormDialog'
import { WriteButton } from './ui'

/** Controlled confirmation for actions launched from menus or other controls. */
export function ConfirmDialog({ open, onOpenChange, title, description, detail, confirmLabel = 'Confirm action', tone = 'danger', onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; detail?: ReactNode
  confirmLabel?: string; tone?: 'primary' | 'danger'; onConfirm: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  return (
    <FormDialog open={open} onOpenChange={(next) => { if (next) setError(undefined); onOpenChange(next) }} title={title} description={description} submitLabel={confirmLabel} submitVariant={tone} submitting={busy} error={error} onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      setError(undefined)
      try { await onConfirm(); onOpenChange(false) } catch (failure) { setError(failure instanceof Error ? failure.message : 'The action could not be completed.') } finally { setBusy(false) }
    }}>
      <p style={{ color: 'var(--ink-2)', fontSize: '0.875rem' }}>{detail || 'Review the selected record before continuing. This action will be recorded in the activity history.'}</p>
    </FormDialog>
  )
}

export default function ConfirmAction({ title, description, children, onConfirm, disabled, className, variant = 'danger' }: {
  title: string; description: string; children: ReactNode; onConfirm: () => Promise<unknown>
  disabled?: boolean; className?: string; variant?: 'danger' | 'secondary'
}) {
  const [open, setOpen] = useState(false)
  return <>
    <WriteButton variant={variant} className={className} disabled={disabled} onClick={() => setOpen(true)}>{children}</WriteButton>
    <ConfirmDialog open={open} onOpenChange={setOpen} title={title} description={description} onConfirm={onConfirm} />
  </>
}
