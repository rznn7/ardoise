import { z } from 'zod';

export const pageQuerySchema = z
  .object({ cursor: z.string().min(1).optional() })
  .strict();
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const paginationErrorSchema = z.object({
  error: z.enum(['INVALID_CURSOR']),
});
export type PaginationError = z.infer<typeof paginationErrorSchema>;
