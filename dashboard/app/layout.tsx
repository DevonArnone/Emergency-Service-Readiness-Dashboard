import '@fontsource-variable/ibm-plex-sans/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './globals.css'
import './command.css'
import './identity.css'
import './workspaces.css'
import './municipal.css'
import './incidents.css'
import './units.css'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import AppShell from '@/components/AppShell'
import AppProviders from '@/components/AppProviders'

export const metadata: Metadata = {
  title: 'Aegis Command | Fairfax County Concept',
  description: 'An unofficial Fairfax County Fire and Rescue coordination concept with synthetic operational data.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to workspace</a>
        <AppProviders>
          <Suspense fallback={<main id="main-content">{children}</main>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  )
}
