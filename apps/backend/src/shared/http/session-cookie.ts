import { type Response } from 'express';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from 'src/session/domain/session';

export const setSessionCookie = (res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env['COOKIE_SECURE'] === 'true',
    maxAge: SESSION_TTL_MS,
  });
};
