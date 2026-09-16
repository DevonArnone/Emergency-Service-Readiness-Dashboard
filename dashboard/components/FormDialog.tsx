'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Children, cloneElement, isValidElement, useId, type FormEvent, type ReactNode } from 'react'
import { Button, IconButton, WriteButton } from './ui'

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting = false,
  error,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  submitting?: boolean
  error?: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="form-dialog">
          <div className="form-dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label="Close dialog" type="button" disabled={submitting}><X className="size-4" /></IconButton></Dialog.Close>
          </div>
          <form onSubmit={onSubmit}>
            <div className="form-dialog-body">{error && <div className="form-error" role="alert">{error}</div>}{children}</div>
            <div className="form-dialog-footer">
              <Dialog.Close asChild><Button type="button" disabled={submitting}>Cancel</Button></Dialog.Close>
              <WriteButton type="submit" variant="primary" busy={submitting}>{submitLabel}</WriteButton>
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
  return <label className="field"><span id={`${id}-label`}>{label}</span>{controls}{hint && <small id={`${id}-hint`}>{hint}</small>}</label>
}
