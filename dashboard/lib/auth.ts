import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'

export const OIDC_ENABLED = Boolean(process.env.NEXT_PUBLIC_OIDC_AUTHORITY)
let manager: UserManager | undefined

export function identityManager() {
  if (!OIDC_ENABLED || typeof window === 'undefined') return undefined
  manager ??= new UserManager({
    authority: process.env.NEXT_PUBLIC_OIDC_AUTHORITY!,
    client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'aegis-dashboard',
    redirect_uri: `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: false,
    loadUserInfo: false,
    // Tokens never persist to browser storage; only the short-lived PKCE transaction does.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  })
  return manager
}

export async function accessToken() {
  const user = await identityManager()?.getUser()
  return user && !user.expired ? user.access_token : undefined
}

export async function signIn() {
  const identity = identityManager()
  await identity?.clearStaleState()
  await identity?.signinRedirect()
}

export async function signOut() {
  const identity = identityManager()
  // Clear the local token before leaving, even if the provider is unavailable.
  const user = await identity?.getUser()
  await identity?.removeUser()
  await identity?.signoutRedirect({ id_token_hint: user?.id_token })
}
