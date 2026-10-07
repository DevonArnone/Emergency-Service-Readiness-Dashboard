'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, padding: 24, background: '#0b1a33', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ width: 'min(440px, 100%)', padding: 32, borderRadius: 14, background: '#fff', color: '#0d1b30' }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.25 }}>Aegis Command is unavailable</h1>
          <p style={{ margin: '8px 0 0', color: '#36465f', fontSize: 15, lineHeight: 1.5 }}>The application shell encountered an unexpected error. No records were changed.</p>
          <button type="button" onClick={reset} style={{ marginTop: 24, minHeight: 44, padding: '0 16px', border: 0, borderRadius: 6, background: '#1f4fd8', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Reload workspace</button>
        </main>
      </body>
    </html>
  )
}
