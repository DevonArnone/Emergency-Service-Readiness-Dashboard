'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { Children, cloneElement, isValidElement, useId, type FormEvent, type ReactNode } from 'react'
import { Button, IconButton, WriteButton } from './ui'

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitVariant = 'primary',
  submitting = false,
  guarded = true,
  error,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  submitVariant?: 'primary' | 'danger'
  submitting?: boolean
  /** Write-gated by default; pass false when the action has its own permission check. */
  guarded?: boolean
  error?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay" />
        <Dialog.Content className="ui-dialog" onOpenAutoFocus={(event) => {
          // Start in the form, not on the close button, so typing and Escape work immediately.
          const dialog = event.currentTarget as HTMLElement
          const first = dialog.querySelector<HTMLElement>('.ui-dialog-body input:not([type="hidden"]), .ui-dialog-body select, .ui-dialog-body textarea')
          event.preventDefault()
          ;(first || dialog).focus()
        }}>
          <div className="ui-dialog-header">
            <div className="min-w-0">
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
              {description && <Dialog.Description asChild><p>{description}</p></Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label="Close dialog" disabled={submitting}><X aria-hidden="true" /></IconButton></Dialog.Close>
          </div>
          {/* A failed submission keeps the dialog and its input; the message sits above the fields it concerns. */}
          <form onSubmit={(event) => { if (submitting) { event.preventDefault(); return } void onSubmit(event) }}>
            <div className="ui-dialog-body">
              {error && <div className="ui-form-error" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span></div>}
              {children}
            </div>
            <div className="ui-dialog-footer">
              <Dialog.Close asChild><Button disabled={submitting}>Cancel</Button></Dialog.Close>
              {guarded ? <WriteButton type="submit" variant={submitVariant} busy={submitting}>{submitLabel}</WriteButton> : <Button type="submit" variant={submitVariant} busy={submitting}>{submitLabel}</Button>}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const controls = Children.map(children, child => {
    if (!isValidElement<Record<string, unknown>>(child) || typeof child.type !== 'string' || !['input', 'select', 'textarea'].includes(child.type)) return child
    return cloneElement(child, { 'aria-labelledby': `${id}-label`, 'aria-describedby': hint ? `${id}-hint` : undefined })
  })
  return <label className="ui-field"><span id={`${id}-label`}>{label}</span>{controls}{hint && <small id={`${id}-hint`}>{hint}</small>}</label>
}
