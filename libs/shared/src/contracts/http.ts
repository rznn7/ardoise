import { type z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type Endpoint = {
  method: HttpMethod;
  path: string;
  status?: number;
  body?: z.ZodType;
  res?: z.ZodType;
};
