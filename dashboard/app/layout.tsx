import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
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
          <div className="min-h-screen text-slate-100">
            <Sidebar />
            <main className="min-h-screen lg:ml-72">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
