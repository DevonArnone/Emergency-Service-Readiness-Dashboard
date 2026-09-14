import './globals.css'
import './command.css'
import './identity.css'
import type { Metadata } from 'next'
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
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  )
}
