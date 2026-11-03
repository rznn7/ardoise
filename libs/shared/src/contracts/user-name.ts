import { z } from 'zod';

export const USER_NAME_MAX_LENGTH = 50;

export const userNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(USER_NAME_MAX_LENGTH);
