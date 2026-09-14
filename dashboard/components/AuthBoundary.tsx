'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ShieldCheck, ArrowUpRight } from 'lucide-react'
import { identityManager, OIDC_ENABLED, signIn } from '@/lib/auth'

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
  return <main className="identity-screen">
    <section className="identity-card">
      <ShieldCheck size={34} aria-hidden="true" />
      <p className="command-kicker">AEGIS / SECURE OPERATIONS</p>
      <h1>Command starts<br />with trust<span>.</span></h1>
      <p>Fairfax County Fire and Rescue<br />Unofficial coordination concept</p>
      {status === 'loading' ? <p role="status">Verifying your session…</p> : <>
        <button className="command-primary" onClick={() => { setError(''); void signIn().catch(() => setError('Identity provider unavailable. Please try again.')) }}>Sign in to command <ArrowUpRight size={18} /></button>
        <small>Department identity · Role-based access · Synthetic data</small>
      </>}
      {error && <p role="alert">{error}</p>}
    </section>
  </main>
}
