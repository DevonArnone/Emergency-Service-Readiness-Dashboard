import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'

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
        <div className="min-h-screen bg-[#07111f] text-slate-100 lg:flex">
          <Sidebar />
          <main className="min-h-screen flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
