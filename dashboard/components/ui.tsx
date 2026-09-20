'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import {
  AlertTriangle,
  ArrowRight,
  Inbox,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useAccess } from '@/hooks/useAccess'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({
  className,
  variant = 'secondary',
  busy = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button
      className={cn('button', `button-${variant}`, className)}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className={cn('icon-button', className)} aria-label={label} {...props}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip-content" sideOffset={7}>{label}<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function WriteButton(props: Parameters<typeof Button>[0]) {
  const access = useAccess()
  const permitted = access.data?.can_write === true
  return <Button {...props} disabled={props.disabled || !permitted}
    title={!permitted ? 'Read-only access. An authorized operator account is required.' : props.title} />
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  const access = useAccess()
  return (
    <header className="page-header">
      <div className="min-w-0">
        <div className="page-title-row"><h1>{title}</h1><span className="workspace-code">{eyebrow}</span></div>
        <p className="page-description">{description}</p>
      </div>
      <div className="page-header-controls"><span className="workspace-access">{access.isPending ? 'Checking access' : access.data?.can_write ? 'Operator workspace' : 'Read-only workspace'}</span>{actions && <div className="page-actions">{actions}</div>}</div>
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function StatusBadge({ children, tone = 'neutral', dot = true }: { children: ReactNode; tone?: StatusTone; dot?: boolean }) {
  return <span className={cn('status-badge', `status-${tone}`)}>{dot && <span aria-hidden="true" />}{children}</span>
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  href,
}: {
  label: string
  value: ReactNode
  detail: ReactNode
  icon: LucideIcon
  tone?: StatusTone
  href?: string
}) {
  const content = (
    <>
      <div className="stat-card-heading">
        <span>{label}</span>
        <span className={cn('stat-card-icon', `stat-card-${tone}`)}><Icon className="size-4" aria-hidden="true" /></span>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-detail">{detail}</div>
      {href && <ArrowRight className="stat-card-arrow size-4" aria-hidden="true" />}
    </>
  )
  return href
    ? <Link href={href} className="stat-card stat-card-link">{content}</Link>
    : <div className="stat-card">{content}</div>
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon className="size-5" aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle className="size-5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <strong>Unable to load this data</strong>
        <p>{message || 'Check the API connection and try again.'}</p>
      </div>
      {retry && <Button type="button" variant="ghost" onClick={retry}><RefreshCw className="size-4" />Retry</Button>}
    </div>
  )
}

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="loading-stack" aria-label="Loading data" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => <div key={index} className="loading-row" />)}
    </div>
  )
}

export function Pagination({ total, from, to, hasPrevious, hasNext, previous, next }: {
  total: number; from: number; to: number; hasPrevious: boolean; hasNext: boolean
  previous: () => void; next: () => void
}) {
  return <nav className="pagination" aria-label="Results pages"><span aria-live="polite">{from}–{to} of {total.toLocaleString()} records</span><div><Button type="button" onClick={previous} disabled={!hasPrevious}>Previous</Button><Button type="button" onClick={next} disabled={!hasNext}>Next</Button></div></nav>
}
