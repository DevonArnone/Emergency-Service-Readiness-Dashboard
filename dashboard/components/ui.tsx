'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  Inbox,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react'
import * as m from 'motion/react-m'
import Link from 'next/link'
import { createContext, forwardRef, useContext, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useAccess } from '@/hooks/useAccess'
import { useDockedInspector } from '@/hooks/useMediaQuery'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean; block?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = 'secondary', busy = false, block = false, children, disabled, type = 'button', ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cn('ui-button', variant !== 'secondary' && `ui-button-${variant}`, block && 'ui-button-block', className)} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy && <LoaderCircle className="ui-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }>(function IconButton({ label, children, className, type = 'button', ...props }, ref) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button ref={ref} type={type} className={cn('ui-icon-button', className)} aria-label={label} {...props}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="ui-tooltip" sideOffset={6}>{label}<Tooltip.Arrow className="ui-tooltip-arrow" /></Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
})

const READ_ONLY_REASON = 'Read-only access. An authorized operator account is required.'

/** A control that changes records: stays visible in read-only sessions, disabled with the reason. */
export const WriteButton = forwardRef<HTMLButtonElement, ButtonProps>(function WriteButton(props, ref) {
  const access = useAccess()
  const permitted = access.data?.can_write === true
  return <Button ref={ref} {...props} disabled={props.disabled || !permitted} title={!permitted ? READ_ONLY_REASON : props.title} />
})

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode; eyebrow?: string }) {
  const access = useAccess()
  const operator = access.data?.can_write === true
  return (
    <header className="ui-page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="ui-page-actions">
        <span className="ui-access">{operator ? <PencilLine aria-hidden="true" /> : <Eye aria-hidden="true" />}{access.isPending ? 'Checking access' : operator ? 'Operator access' : 'Read-only access'}</span>
        {actions}
      </div>
    </header>
  )
}

type SummaryTone = 'ok' | 'warn' | 'bad' | undefined
export type SummaryItem = { label: string; value: ReactNode; detail?: ReactNode; tone?: SummaryTone; href?: string }

export function SummaryStrip({ items, label }: { items: SummaryItem[]; label: string }) {
  return (
    <dl className="ui-summary" aria-label={label}>
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone}>
          <dt>{item.label}</dt>
          <dd>{item.href ? <Link href={item.href}>{item.value}</Link> : item.value}{item.detail && <small>{item.detail}</small>}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Panel({ title, description, action, footer, children, className, headingLevel = 2, id, bodyClassName, flush = false, ...rest }: {
  title?: string; description?: ReactNode; action?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string
  headingLevel?: 2 | 3; id?: string; bodyClassName?: string; flush?: boolean
} & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section className={cn('ui-panel', className)} id={id} aria-labelledby={title ? headingId : undefined} {...rest}>
      {title && (
        <div className="ui-panel-header">
          <div className="min-w-0"><Heading id={headingId}>{title}</Heading>{description && <p>{description}</p>}</div>
          {action}
        </div>
      )}
      {flush ? children : <div className={cn('ui-panel-body', bodyClassName)}>{children}</div>}
      {footer && <div className="ui-panel-footer">{footer}</div>}
    </section>
  )
}

export function Section({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-section">
      <div className="ui-section-head"><h3>{title}</h3>{meta && <span>{meta}</span>}</div>
      {children}
    </section>
  )
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function StatusBadge({ children, tone = 'neutral', dot = true }: { children: ReactNode; tone?: StatusTone; dot?: boolean }) {
  return <span className="ui-badge" data-tone={tone}>{dot && <i aria-hidden="true" />}{children}</span>
}

export function Meter({ value, tone, label }: { value: number; tone?: StatusTone; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return <span className="ui-meter" data-tone={tone} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><i style={{ width: `${clamped}%` }} /></span>
}

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string }>(function SearchInput({ label, className, ...props }, ref) {
  return <label className={cn('ui-search', className)}><span className="sr-only">{label}</span><Search aria-hidden="true" /><input ref={ref} type="search" {...props} /></label>
})

/** Advanced filters stay behind a labeled disclosure so the toolbar keeps to search, scope, and the primary action. */
export function Filters({ label = 'More filters', activeCount = 0, children }: { label?: string; activeCount?: number; children: ReactNode }) {
  return (
    <details className="ui-disclosure ui-filters">
      <summary><SlidersHorizontal aria-hidden="true" />{label}{activeCount > 0 && <StatusBadge tone="info" dot={false}>{activeCount} active</StatusBadge>}<ChevronDown className="ui-chevron" aria-hidden="true" /></summary>
      <div className="ui-filters-body" style={{ marginTop: 8 }}>{children}</div>
    </details>
  )
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon"><Icon aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="ui-error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>Unable to load this data</strong>
        <p>{message || 'Check the API connection and try again.'}</p>
      </div>
      {retry && <Button onClick={retry}><RefreshCw aria-hidden="true" />Retry</Button>}
    </div>
  )
}

export function LoadingState({ rows = 5, label = 'Loading data' }: { rows?: number; label?: string }) {
  return (
    <div className="ui-skeleton" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
    </div>
  )
}

export type NoticeValue = { tone: 'success' | 'danger'; message: string } | null

export function Notice({ notice, onDismiss }: { notice: NoticeValue; onDismiss: () => void }) {
  if (!notice) return null
  return (
    <div className="ui-notice" data-tone={notice.tone} role={notice.tone === 'danger' ? 'alert' : 'status'}>
      {notice.tone === 'danger' ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  )
}

export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="ui-inline-error" role="alert"><AlertTriangle aria-hidden="true" /><span>{message}</span></p>
}

export function Pagination({ total, from, to, hasPrevious, hasNext, previous, next }: {
  total: number; from: number; to: number; hasPrevious: boolean; hasNext: boolean
  previous: () => void; next: () => void
}) {
  return (
    <nav className="ui-pagination" aria-label="Results pages">
      <span aria-live="polite">{from}–{to} of {total.toLocaleString()} records</span>
      <div><Button onClick={previous} disabled={!hasPrevious}>Previous</Button><Button onClick={next} disabled={!hasNext}>Next</Button></div>
    </nav>
  )
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="ui-link" href={href}>{children}<ArrowRight aria-hidden="true" /></Link>
}

const InspectorContext = createContext<{ drawer: boolean; dismiss?: () => void; closeLabel: string }>({ drawer: false, closeLabel: 'Close details' })

/**
 * Selected-record inspector. Docked beside the workspace from 1280px; below that it is a
 * full-height drawer that opens on an explicit selection and returns focus when closed.
 */
export function Inspector({ label, open, onClose, recordKey, dismissible = false, closeLabel = 'Close details', children }: { label: string; open: boolean; onClose: () => void; recordKey?: string; dismissible?: boolean; closeLabel?: string; children: ReactNode }) {
  const docked = useDockedInspector()
  if (docked) {
    return (
      <InspectorContext.Provider value={{ drawer: false, dismiss: dismissible ? onClose : undefined, closeLabel }}>
        <aside className="ui-inspector ui-inspector-docked" aria-label={label}>
          <m.div key={recordKey} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'contents' }}>{children}</m.div>
        </aside>
      </InspectorContext.Provider>
    )
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay" />
        {/* Focus the drawer itself: focusing the close button would open its tooltip and swallow the first Escape. */}
        <Dialog.Content className="ui-drawer" aria-describedby={undefined} onOpenAutoFocus={(event) => { event.preventDefault(); (event.currentTarget as HTMLElement).focus() }}>
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <InspectorContext.Provider value={{ drawer: true, closeLabel }}>
            <div className="ui-inspector">{children}</div>
          </InspectorContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function InspectorHeader({ kind, title, subtitle, badge, headingId, children }: { kind?: string; title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; headingId?: string; children?: ReactNode }) {
  const { drawer, dismiss, closeLabel } = useContext(InspectorContext)
  return (
    <header className="ui-inspector-header">
      <div className="min-w-0">
        {kind && <span className="ui-inspector-kind">{kind}</span>}
        <h2 id={headingId}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {drawer && <Dialog.Close asChild><IconButton label={closeLabel}><X aria-hidden="true" /></IconButton></Dialog.Close>}
        {!drawer && dismiss && <IconButton label={closeLabel} onClick={dismiss}><X aria-hidden="true" /></IconButton>}
      </div>
    </header>
  )
}

export function InspectorBody({ children }: { children: ReactNode }) {
  return <div className="ui-inspector-body">{children}</div>
}

export function InspectorFooter({ children }: { children: ReactNode }) {
  return <footer className="ui-inspector-footer">{children}</footer>
}
