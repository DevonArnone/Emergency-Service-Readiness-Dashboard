import './globals.css'
import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'
import AppProviders from '@/components/AppProviders'

export const metadata: Metadata = {
  title: 'Emergency Readiness Dashboard',
  description: 'Real-time emergency staffing, certification readiness, and Snowflake-backed command analytics.',
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
