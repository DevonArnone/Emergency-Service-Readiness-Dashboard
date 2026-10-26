'use client'

import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '@/lib/api'

const sessionSchema = z.object({
  display_name: z.string().nullable(),
  can_write: z.boolean(),
  can_reset_demo: z.boolean(),
  subject_id: z.string().optional(),
  organization_id: z.string().optional(),
  email: z.string().nullable().optional(),
  roles: z.array(z.string()).default([]),
  is_public_demo: z.boolean().optional(),
})

export function useAccess() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => apiRequest('/api/v1/session', sessionSchema),
    staleTime: 30_000,
  })
}
