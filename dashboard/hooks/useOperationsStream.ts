'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE, queryKeys } from '@/lib/api'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export function useOperationsStream() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<ConnectionState>('connecting')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const attempts = useRef(0)

  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined

    const connect = () => {
      if (disposed) return
      setState(attempts.current ? 'reconnecting' : 'connecting')
      const url = API_BASE.replace(/^http/, 'ws')
      socket = new WebSocket(`${url}/ws/operations`)
      socket.onopen = () => {
        attempts.current = 0
        setState('live')
      }
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'operations.snapshot') {
            queryClient.invalidateQueries({ queryKey: ['operations'] })
            queryClient.invalidateQueries({ queryKey: ['shell-operations'] })
            queryClient.invalidateQueries({ queryKey: queryKeys.readiness })
          }
        } catch {
          // A malformed event is ignored; the next snapshot remains authoritative.
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (disposed) return
        attempts.current += 1
        setState(attempts.current > 4 ? 'offline' : 'reconnecting')
        const delay = Math.min(1000 * 2 ** (attempts.current - 1), 15_000)
        reconnectTimer.current = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      socket?.close()
    }
  }, [queryClient])

  return state
}
