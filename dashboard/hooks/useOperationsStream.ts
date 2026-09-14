'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE, apiRequest, queryKeys } from '@/lib/api'
import { z } from 'zod'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export function useOperationsStream() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<ConnectionState>('connecting')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const attempts = useRef(0)

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined
    let refreshTimer: ReturnType<typeof setTimeout> | undefined

    const retry = () => {
      if (disposed) return
      attempts.current += 1
      setState(attempts.current > 4 ? 'offline' : 'reconnecting')
      reconnectTimer.current = setTimeout(() => void connect(), Math.min(1000 * 2 ** (attempts.current - 1), 15_000))
    }

    const connect = async () => {
      if (disposed) return
      setState(attempts.current ? 'reconnecting' : 'connecting')
      const url = API_BASE.replace(/^http/, 'ws')
      try {
        const grant = await apiRequest('/api/v1/realtime-tickets', z.object({ ticket: z.string(), expires_at: z.string() }), { method: 'POST' })
        if (disposed) return
        socket = new WebSocket(`${url}/ws/operations?ticket=${encodeURIComponent(grant.ticket)}`)
      } catch {
        retry()
        return
      }
      socket.onopen = () => {
        attempts.current = 0
        setState('live')
      }
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if ((message.type === 'operations.snapshot' || message.type === 'operations.event') && !refreshTimer) {
            refreshTimer = setTimeout(() => {
              refreshTimer = undefined
              queryClient.invalidateQueries({ queryKey: ['operations'] })
              queryClient.invalidateQueries({ queryKey: ['shell-operations'] })
              queryClient.invalidateQueries({ queryKey: queryKeys.readiness })
              if (message.type === 'operations.event') queryClient.invalidateQueries()
            }, 100)
          }
        } catch {
          // A malformed event is ignored; the next snapshot remains authoritative.
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        retry()
      }
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (refreshTimer) clearTimeout(refreshTimer)
      socket?.close()
    }
  }, [queryClient])

  return state
}
