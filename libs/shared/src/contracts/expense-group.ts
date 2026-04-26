import { z } from 'zod'

export const createExpenseGroupRequestSchema = z.object({ name: z.string(), currencyCode: z.string() })
export type CreateExpenseGroupRequest = z.infer<typeof createExpenseGroupRequestSchema>
