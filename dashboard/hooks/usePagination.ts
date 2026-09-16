'use client'

import { useState } from 'react'

export function usePagination<T>(items: T[], resetKey: string, pageSize = 25) {
  const [position, setPosition] = useState({ key: resetKey, page: 0 })
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = position.key === resetKey ? Math.min(position.page, pages - 1) : 0
  return {
    rows: items.slice(page * pageSize, (page + 1) * pageSize),
    total: items.length,
    from: items.length ? page * pageSize + 1 : 0,
    to: Math.min(items.length, (page + 1) * pageSize),
    hasPrevious: page > 0,
    hasNext: page + 1 < pages,
    previous: () => setPosition({ key: resetKey, page: Math.max(0, page - 1) }),
    next: () => setPosition({ key: resetKey, page: Math.min(pages - 1, page + 1) }),
  }
}
