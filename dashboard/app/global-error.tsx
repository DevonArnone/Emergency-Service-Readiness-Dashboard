'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">Emergency Platform unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">The application shell encountered an unexpected error.</p>
          <button type="button" onClick={reset} className="mt-6 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white">Reload workspace</button>
        </main>
      </body>
    </html>
  )
}
