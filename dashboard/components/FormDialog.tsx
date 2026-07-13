'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { Button, IconButton } from './ui'

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting = false,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  submitting?: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="form-dialog">
          <div className="form-dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && <Dialog.Description>{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild><IconButton label="Close dialog" type="button"><X className="size-4" /></IconButton></Dialog.Close>
          </div>
          <form onSubmit={onSubmit}>
            <div className="form-dialog-body">{children}</div>
            <div className="form-dialog-footer">
              <Dialog.Close asChild><Button type="button">Cancel</Button></Dialog.Close>
              <Button type="submit" variant="primary" busy={submitting}>{submitLabel}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
