'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import Image from 'next/image'
import { identityManager, OIDC_ENABLED, signIn } from '@/lib/auth'
import styles from '@/app/states.module.css'
import { Button, InlineError } from './ui'

let callback: Promise<unknown> | undefined

export default function AuthBoundary({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'login'>(OIDC_ENABLED ? 'loading' : 'ready')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    const identity = identityManager()
    if (!identity) return
    let disposed = false
    const expire = () => {
      queryClient.clear()
      setStatus('login')
    }
    identity.events.addAccessTokenExpired(expire)
    identity.events.addUserUnloaded(expire)
    const initialize = async () => {
      try {
        if (window.location.pathname === '/auth/callback') {
          callback ??= identity.signinRedirectCallback()
          await callback
          window.history.replaceState({}, '', '/')
        }
        const user = await identity.getUser()
        if (!disposed) setStatus(user && !user.expired ? 'ready' : 'login')
      } catch {
        if (!disposed) {
          setError('Sign-in could not be verified. Please try again.')
          setStatus('login')
        }
      }
    }
    void initialize()
    return () => {
      disposed = true
      identity.events.removeAccessTokenExpired(expire)
      identity.events.removeUserUnloaded(expire)
    }
  }, [queryClient])

  if (status === 'ready') return children
  return <main className={styles.screen}>
    <section className={styles.card}>
      <div className={styles.mark}>
        <Image src="/brand/aegis-command-seal-v2.png" alt="" width={30} height={44} priority />
        <div><strong>Aegis Command</strong><span>Fairfax County Fire and Rescue · unofficial concept</span></div>
      </div>
      <h1>Sign in to the operating picture</h1>
      <p>Access follows your department role. Operators can change records; analysts and observers read them.</p>
      {status === 'loading' ? <p className={styles.status} role="status"><LoaderCircle className="ui-spin" aria-hidden="true" />Verifying your session…</p> : <div className={styles.actions}>
        <Button variant="primary" onClick={() => { setError(''); void signIn().catch(() => setError('The identity provider is unavailable. Check your connection and try again.')) }}>Sign in to command <ArrowUpRight aria-hidden="true" /></Button>
        <InlineError message={error} />
      </div>}
      {status === 'loading' && <InlineError message={error} />}
      <p className={styles.fine}>Synthetic operational data. Not authorized for dispatch, patient care, or real emergency operations.</p>
    </section>
  </main>
}
